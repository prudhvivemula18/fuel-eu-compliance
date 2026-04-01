import type { Application } from 'express';
import { Router } from 'express';
import type { ComplianceService } from '../../core/application/ComplianceService.js';
import { createComplianceController } from './controllers/ComplianceController.js';

export function registerApiRoutes(
  app: Application,
  complianceService: ComplianceService,
): void {
  const api = Router();
  const compliance = createComplianceController(complianceService);

  api.get('/compliance/:routeId', (req, res, next) => {
    void compliance.getRouteCompliance(req, res, next);
  });

  app.use('/api', api);
}
