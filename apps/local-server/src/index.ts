import { createLocalServer } from './server.ts';

const port = Number(process.env.PORT ?? 3001);
const app = createLocalServer();
await app.listen(port);
console.log(`Highlords Poker http://localhost:${port}`);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
