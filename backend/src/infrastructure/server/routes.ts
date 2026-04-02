import type { Application } from 'express';
import { Router } from 'express';
import type { HttpApiDeps } from '../../adapters/inbound/http/httpApiDeps.js';
import { registerHttpApiRoutes } from '../../adapters/inbound/http/registerHttpApiRoutes.js';

export function registerApiRoutes(app: Application, deps: HttpApiDeps): void {
  const api = Router();
  registerHttpApiRoutes(api, deps);
  app.use('/api', api);
}
