import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const temp = await mkdtemp(join(tmpdir(), 'dwellcraft-test-'));
try {
  const target = join(temp, 'core.mjs');
  await build({
    entryPoints: ['tests/core.test.ts'],
    outfile: target,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'warning',
  });
  const run = spawnSync(process.execPath, ['--test', target], {
    stdio: 'inherit',
  });
  process.exitCode = run.status ?? 1;
} finally {
  await rm(temp, { recursive: true, force: true });
}
