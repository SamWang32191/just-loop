#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

function runCommand(command, args, options = {}) {
  const { cwd = repoRoot, stdio = 'inherit', env } = options;

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      stdio,
      env: env ?? process.env,
    });

    child.once('error', rejectPromise);
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      const error = new Error(
        `Command failed: ${command} ${args.join(' ')}` +
          (code !== null ? ` (exit code ${code})` : '') +
          (signal ? ` (signal ${signal})` : ''),
      );

      error.code = code;
      error.signal = signal;
      error.command = command;
      error.args = args;
      error.cwd = cwd;
      rejectPromise(error);
    });
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  let tarball;
  let primaryError;
  let cleanupError;

  try {
    const packOutput = await new Promise((resolvePromise, rejectPromise) => {
      const child = spawn('npm', ['pack', '--json'], {
        cwd: repoRoot,
        stdio: ['ignore', 'pipe', 'inherit'],
        env: process.env,
      });

      let stdout = '';

      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });

      child.once('error', rejectPromise);
      child.once('close', (code, signal) => {
        if (code !== 0) {
          rejectPromise(new Error(`npm pack failed${code !== null ? ` with exit code ${code}` : ''}${signal ? ` (signal ${signal})` : ''}`));
          return;
        }

        try {
          resolvePromise(JSON.parse(stdout));
        } catch (error) {
          rejectPromise(error);
        }
      });
    });

    assert(Array.isArray(packOutput) && packOutput.length > 0, 'npm pack did not return any tarball metadata');

    const { filename, files } = packOutput[0];
    assert(typeof filename === 'string' && filename.length > 0, 'npm pack metadata is missing filename');
    assert(Array.isArray(files), 'npm pack metadata is missing files');

    tarball = resolve(repoRoot, filename);
    const filePaths = files.map((file) => file.path);

    const requiredFiles = ['README.md', 'LICENSE', 'dist/src/index.js', 'dist/src/index.d.ts'];
    for (const requiredFile of requiredFiles) {
      assert(filePaths.includes(requiredFile), `Tarball is missing required file: ${requiredFile}`);
    }

    const forbiddenPrefixMatches = ['docs/', 'tests/', 'src/'];
    for (const forbiddenPrefix of forbiddenPrefixMatches) {
      assert(!filePaths.some((filePath) => filePath.startsWith(forbiddenPrefix)), `Tarball contains forbidden path prefix: ${forbiddenPrefix}`);
    }

    const forbiddenFiles = ['task_plan.md', 'findings.md', 'progress.md'];
    for (const forbiddenFile of forbiddenFiles) {
      assert(!filePaths.includes(forbiddenFile), `Tarball contains forbidden file: ${forbiddenFile}`);
    }

    await runCommand('npm', ['run', 'smoke:pack', '--', tarball]);
  } catch (error) {
    primaryError = error;
  } finally {
    if (tarball) {
      try {
        await rm(tarball, { force: true });
      } catch (error) {
        cleanupError = error;
      }
    }
  }

  if (cleanupError) {
    if (primaryError) {
      console.error('Cleanup failed:', cleanupError);
    } else {
      throw cleanupError;
    }
  }

  if (primaryError) {
    throw primaryError;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
