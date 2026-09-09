import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// Vercel serves the client export; no Worker or server credentials are needed.
const result = spawnSync(
  process.execPath,
  ['node_modules/vinext/dist/cli.js', 'build'],
  {
    stdio: 'inherit',
    env: { ...process.env, DWELLCRAFT_STATIC_EXPORT: '1' },
  },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
if (!existsSync('dist/client/index.html')) {
  throw new Error('Static export is missing dist/client/index.html');
}
