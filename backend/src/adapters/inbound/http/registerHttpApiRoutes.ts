import type { Router } from 'express';
import { createBankingHttpController } from './controllers/bankingHttpController.js';
import { createComplianceHttpController } from './controllers/complianceHttpController.js';
import { createPoolingHttpController } from './controllers/poolingHttpController.js';
import { createRoutesHttpController } from './controllers/routesHttpController.js';
import type { HttpApiDeps } from './httpApiDeps.js';

export function registerHttpApiRoutes(router: Router, deps: HttpApiDeps): void {
  const routes = createRoutesHttpController(deps);
  const compliance = createComplianceHttpController(deps);
  const banking = createBankingHttpController(deps);
  const pooling = createPoolingHttpController(deps);

  router.get('/routes/comparison', (req, res, next) => {
    void routes.comparison(req, res, next);
  });
  router.post('/routes/:id/baseline', (req, res, next) => {
    void routes.setBaseline(req, res, next);
  });
  router.get('/routes', (req, res, next) => {
    void routes.list(req, res, next);
  });

  router.get('/compliance/cb', (req, res, next) => {
    void compliance.getCb(req, res, next);
  });
  router.get('/compliance/adjusted-cb', (req, res, next) => {
    void compliance.getAdjustedCb(req, res, next);
  });
  router.get('/compliance/:routeId', (req, res, next) => {
    void compliance.getRouteCompliance(req, res, next);
  });

  router.get('/banking/records', (req, res, next) => {
    void banking.listRecords(req, res, next);
  });
  router.post('/banking/bank', (req, res, next) => {
    void banking.bank(req, res, next);
  });
  router.post('/banking/apply', (req, res, next) => {
    void banking.apply(req, res, next);
  });

  router.post('/pools', (req, res, next) => {
    void pooling.createPool(req, res, next);
  });
}
