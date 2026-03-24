#!/usr/bin/env node

import { access, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

async function runCommand(command, args, options = {}) {
  const { cwd = repoRoot, stdio = 'inherit', env } = options;

  return await new Promise((resolvePromise, rejectPromise) => {
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

async function main() {
  const tarballArg = process.argv[2];

  if (!tarballArg) {
    throw new Error('Usage: node scripts/smoke-pack.mjs <tarball-path>');
  }

  const tarball = resolve(repoRoot, tarballArg);
  await access(tarball);
  const tarballStat = await stat(tarball);

  if (!tarballStat.isFile()) {
    throw new Error(`Tarball must be a file: ${tarball}`);
  }

  if (!basename(tarball).endsWith('.tgz')) {
    throw new Error(`Tarball must end with .tgz: ${tarball}`);
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'just-loop-smoke-'));
  let primaryError;
  let cleanupError;

  try {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify(
        {
          name: 'just-loop-smoke-consumer',
          private: true,
          type: 'module',
        },
        null,
        2,
      ) + '\n',
    );

    await writeFile(
      join(tempDir, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            strict: true,
            noEmit: true,
            skipLibCheck: true,
          },
          include: ['index.ts'],
        },
        null,
        2,
      ) + '\n',
    );

    await writeFile(
      join(tempDir, 'index.ts'),
      "import plugin from '@w32191/just-loop';\n\nvoid plugin;\n",
    );

    await writeFile(
      join(tempDir, 'runtime-check.mjs'),
      "import plugin from '@w32191/just-loop';\n\nif (plugin === undefined) {\n  throw new Error('default export is undefined');\n}\n",
    );

    await runCommand('npm', ['install', '--no-save', tarball], { cwd: tempDir });
    await runCommand('node', ['runtime-check.mjs'], { cwd: tempDir });

    await runCommand('npx', ['--no-install', 'tsc', '-p', join(tempDir, 'tsconfig.json'), '--noEmit'], {
      cwd: repoRoot,
    });
  } catch (error) {
    primaryError = error;
  } finally {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      cleanupError = error;
    }
  }

  if (cleanupError) {
    if (!primaryError) {
      throw cleanupError;
    }

    console.error('Cleanup failed:', cleanupError);
  }

  if (primaryError) {
    throw primaryError;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
