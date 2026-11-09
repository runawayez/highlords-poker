import { spawnSync } from 'node:child_process';
if (process.env.CONFIRM_FREE_PLAN !== 'yes') {
  console.error(
    'Verify Workers Free in the Cloudflare dashboard, no paid subscriptions/card or upgrades. Then set CONFIRM_FREE_PLAN=yes. See docs/deployment.md.',
  );
  process.exit(1);
}
process.exit(
  spawnSync('pnpm', ['exec', 'wrangler', 'deploy', '--config', 'apps/worker/wrangler.jsonc'], {
    stdio: 'inherit',
  }).status ?? 1,
);
