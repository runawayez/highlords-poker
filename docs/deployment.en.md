[Português](./deployment.md) | **English**

# Deployment and zero-billing operation

The Verify workflow can publish the existing Worker after successful checks once the operator configures the Cloudflare repository secrets. Public operation needs the operator's own provider accounts and configuration. No paid-plan selection, card entry, upgrade, analytics or payment integration exists in the app.

## Option A — Node + SQLite

```sh
pnpm install --frozen-lockfile
pnpm check
cp .env.example .env
# Set ALLOWED_ORIGINS to the exact HTTPS origin(s), DATA_PATH to a durable private volume.
pnpm start
```

Put HTTPS/WSS termination in front of port 3001; preserve Upgrade headers and restrict the port to the reverse proxy. Node serves both `apps/web/dist` and `/api`. Use one process per database, graceful restarts and a persistent disk. The dev runner is not a production supervisor. OS, hardware, electricity and internet are the operator's costs.

## Option B — Cloudflare Workers Free + Vercel Hobby

1. Verify in the Cloudflare dashboard that the account remains on **Workers Free**, with no paid Workers subscription, card or automatic upgrades. Check current provider terms and eligibility before any deployment.
2. Set the exact frontend HTTPS origin in `apps/worker/wrangler.jsonc` ALLOWED_ORIGINS. Keep the SQLite migration and binding. Optional: lower MAX_ROOMS or enable MAINTENANCE.
3. Authenticate the operator's Wrangler outside the repository, without committing credentials. Run `CONFIRM_FREE_PLAN=yes pnpm worker:deploy` only after the plan check. The deployment script stops without this assertion; it cannot inspect or change the account billing plan.
4. Copy the returned Worker origin into Vercel's **VITE_API_URL** environment variable. The frontend is a static Vite build; root `vercel.json` defines the output and SPA fallback. Use a personal Hobby project only when eligible for its terms; do not select a paid upgrade. Set API origin before building.
5. Rebuild frontend, check HTTPS/WSS, language switching, password entry, two independent browser profiles and a reconnect. Avoid `http://` APIs from an HTTPS frontend. Vercel is not used to run this project's persistent Node server.

`pnpm exec wrangler deploy --dry-run --config apps/worker/wrangler.jsonc` checks bundle/config without provisioning. The Cloudflare adapter is packaged and typechecked in this repository, but a dry run does not prove production account access, deployment or operational capacity.

## Quotas and brakes

Provider documentation checked **2026-11-09**: [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [limits](https://developers.cloudflare.com/durable-objects/platform/limits/). Workers Free supports only SQLite-backed Durable Objects. Documented free daily ceilings include 100,000 DO requests, 13,000 GB-s duration, 5 million rows read, 100,000 rows written, and 5 GB total stored data. Alarms count as requests, and alarm updates count as writes. Free quota exhaustion rejects further operations rather than charging; limits reset at 00:00 UTC. Recheck the official tables before publishing; other account workloads share these quotas.

Application defaults: 30 rooms, 500 sessions, 300 sockets total, 20 spectators/room, 90 entrants/tournament, 6 MiB serialized state and 40,000 persisted writes per UTC day. A five-second active Worker alarm yields at most 17,280 alarm calls/day before traffic; each state save plus alarm rescheduling also consumes storage operations. These are conservative admission brakes, **not** a load guarantee or a billing API.

Monitor request counts, duration, rows written and storage in Cloudflare's usage dashboard. At 80% of any free ceiling, set MAINTENANCE=true and redeploy the existing free Worker; restore when usage permits. Lower room caps for smaller quotas shared with other applications. The app's own daily write brake rejects mutations with MAINTENANCE. Provider failures return an error without confirming RAM-only actions. The app never upgrades a plan to restore availability.

Room/chat/history retention bounds storage. If the provider requires payment to keep operating, leave the service unavailable or self-host; do not add a card or enable a paid resource. No third-party public hosting can honestly guarantee unlimited, free, 24/7 availability.

## Automatic GitHub deployment

Vercel follows `main`. The **Publicar Worker** job in **Verify** publishes the backend only after both verification jobs succeed, including unit/integration tests, browser tests, formatting and Worker dry-run packaging. Pull requests and other branches never deploy the backend. Deployments are serialized and outdated commits are skipped before checkout.

Configure these two [repository secrets](https://github.com/runawayez/highlords-poker/settings/secrets/actions) once:

- `CLOUDFLARE_API_TOKEN`: an API token created using **Edit Cloudflare Workers**, scoped to the account running this project; do not use a Global API Key.
- `CLOUDFLARE_ACCOUNT_ID`: the account ID from Cloudflare's dashboard, not a zone ID.

Then open [Actions → Verify](https://github.com/runawayez/highlords-poker/actions/workflows/ci.yml), choose **Run workflow**, select `main` and run it. This first run verifies credentials and deployment. Future updates to `main` run tests and deploy automatically; no local login or terminal command is required. The workflow uses the existing Worker and checks `/api/health` after publishing.

Missing secrets produce an explicit warning and a deployment-not-executed job summary; tests remain available. Replace an expired or revoked token in GitHub and rerun the workflow. Never send tokens through chat or commit them. Local Wrangler OAuth login does not authenticate GitHub Actions. Secrets are supplied only to the configuration check and deployment step, not dependency installation or test jobs.

The workflow retains the operator's existing Workers Free assertion (`CONFIRM_FREE_PLAN=yes`); it does not inspect or change billing. Official reference: [Cloudflare GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).
