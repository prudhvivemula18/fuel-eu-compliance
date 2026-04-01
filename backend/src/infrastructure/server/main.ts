import { createHttpApp } from '../../adapters/inbound/http/index.js';
import { disconnectPrisma } from '../db/index.js';

const port = Number(process.env.PORT) || 3000;
const app = createHttpApp();

const server = app.listen(port, () => {
  console.log(`HTTP server listening on http://localhost:${port}`);
});

async function shutdown(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await disconnectPrisma();
}

process.on('SIGINT', () => {
  void shutdown().then(() => process.exit(0));
});
process.on('SIGTERM', () => {
  void shutdown().then(() => process.exit(0));
});
