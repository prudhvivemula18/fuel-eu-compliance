import { createHttpApp } from '../../adapters/inbound/http/index.js';
import { RouteComplianceReadPrismaAdapter } from '../../adapters/outbound/postgres/routeComplianceReadAdapter.js';
import { ComplianceService } from '../../core/application/ComplianceService.js';
import { disconnectPrisma, getPrismaClient } from '../db/index.js';
import { registerApiRoutes } from './routes.js';

const port = Number(process.env.PORT) || 3000;

const prisma = getPrismaClient();
const complianceService = new ComplianceService(
  new RouteComplianceReadPrismaAdapter(prisma),
);

const app = createHttpApp();
registerApiRoutes(app, complianceService);

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
