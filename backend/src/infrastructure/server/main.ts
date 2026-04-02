import { createHttpApp } from '../../adapters/inbound/http/index.js';
import { disconnectPrisma, getPrismaClient } from '../db/index.js';
import { createHttpApiDeps } from './httpDepsFactory.js';
import { registerApiRoutes } from './routes.js';

const port = Number(process.env.PORT) || 3000;

const prisma = getPrismaClient();
const httpDeps = createHttpApiDeps(prisma);

const app = createHttpApp();
registerApiRoutes(app, httpDeps);

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
