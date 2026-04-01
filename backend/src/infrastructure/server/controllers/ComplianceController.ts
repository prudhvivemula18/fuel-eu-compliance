import type { NextFunction, Request, Response } from 'express';
import {
  BaselineRouteNotFoundError,
  RouteNotFoundError,
} from '../../../core/application/errors.js';
import type { ComplianceService } from '../../../core/application/ComplianceService.js';

export function createComplianceController(service: ComplianceService) {
  return {
    async getRouteCompliance(req: Request, res: Response, next: NextFunction) {
      try {
        const raw = req.params.routeId;
        const routeId = Array.isArray(raw) ? raw[0] : raw;
        if (!routeId) {
          res.status(400).json({ error: 'Missing routeId' });
          return;
        }
        const result = await service.calculateRouteCompliance(routeId);
        res.json(result);
      } catch (err) {
        if (err instanceof RouteNotFoundError) {
          res.status(404).json({ error: err.message });
          return;
        }
        if (err instanceof BaselineRouteNotFoundError) {
          res.status(503).json({ error: err.message });
          return;
        }
        next(err);
      }
    },
  };
}
