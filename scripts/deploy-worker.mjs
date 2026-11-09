import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.env.CONFIRM_FREE_PLAN !== 'yes') {
  console.error(
    'Confirme o plano Workers Free e defina CONFIRM_FREE_PLAN=yes. Consulte docs/deployment.md.',
  );
  process.exit(1);
}

// Use Node directly so Windows does not need to launch a pnpm.cmd shell wrapper.
const wranglerPath = fileURLToPath(
  new URL('bin/wrangler.js', import.meta.resolve('wrangler/package.json')),
);
const result = spawnSync(
  process.execPath,
  [wranglerPath, 'deploy', '--config', 'apps/worker/wrangler.jsonc', ...process.argv.slice(2)],
  { stdio: 'inherit' },
);

if (result.error) {
  console.error('Não foi possível iniciar o Wrangler:', result.error.message);
}
if (result.signal) {
  console.error('O Wrangler foi interrompido pelo sinal', result.signal);
}
process.exit(result.status ?? 1);
