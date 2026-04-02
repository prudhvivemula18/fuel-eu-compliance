import type { NextFunction, Request, Response } from 'express';
import {
  BaselineRouteNotFoundError,
  RouteNotFoundError,
  ValidationError,
} from '../../../../core/application/errors.js';
import type { HttpApiDeps } from '../httpApiDeps.js';

function parseShipYearQuery(req: Request): {
  ship_id?: string
  year?: number
} {
  const shipRaw = req.query.ship_id;
  const shipStr = Array.isArray(shipRaw) ? shipRaw[0] : shipRaw;
  /** Public ship / route-style id (e.g. R002); matches `ship_compliance.ship_id`, not Route UUID. */
  const ship_id =
    typeof shipStr === 'string' && shipStr.trim()
      ? shipStr.trim().toUpperCase()
      : undefined;

  const yearRaw = req.query.year;
  if (yearRaw === undefined) {
    return { ship_id, year: undefined };
  }
  const y = Array.isArray(yearRaw) ? yearRaw[0] : yearRaw;
  if (y === '' || y === undefined || y === null) {
    return { ship_id, year: undefined };
  }
  const year = typeof y === 'string' ? Number(y) : Number(y);
  if (!Number.isFinite(year) || !Number.isInteger(year)) {
    throw new ValidationError('Invalid year query parameter');
  }

  return { ship_id, year };
}

function paramRouteId(req: Request): string | undefined {
  const raw = req.params.routeId;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v?.trim() || undefined;
}

export function createComplianceHttpController(deps: Pick<
  HttpApiDeps,
  | 'complianceService'
  | 'getComplianceBalanceUseCase'
  | 'getAdjustedComplianceBalanceUseCase'
>) {
  return {
    async getCb(req: Request, res: Response, next: NextFunction) {
      try {
        const filter = parseShipYearQuery(req);
        const rawSid = req.query.ship_id;
        const sidStr = Array.isArray(rawSid) ? rawSid[0] : rawSid;
        const requestedShip =
          typeof sidStr === 'string' && sidStr.trim() !== '';

        const rows = await deps.getComplianceBalanceUseCase.execute(filter);

        if (requestedShip && rows.length === 0) {
          const sid = filter.ship_id ?? 'unknown';
          const msg =
            filter.year !== undefined
              ? `No compliance balance found for ship ${sid} in year ${filter.year}.`
              : `No compliance balance found for ship ${sid}.`;
          res.status(404).json({ error: msg });
          return;
        }

        res.json(rows);
      } catch (e) {
        if (e instanceof ValidationError) {
          res.status(400).json({ error: e.message });
          return;
        }
        if (e instanceof BaselineRouteNotFoundError) {
          res.status(503).json({ error: e.message });
          return;
        }
        next(e);
      }
    },

    async getAdjustedCb(req: Request, res: Response, next: NextFunction) {
      try {
        const filter = parseShipYearQuery(req);
        const rawSid = req.query.ship_id;
        const sidStr = Array.isArray(rawSid) ? rawSid[0] : rawSid;
        const requestedShip =
          typeof sidStr === 'string' && sidStr.trim() !== '';

        const rows =
          await deps.getAdjustedComplianceBalanceUseCase.execute(filter);

        if (requestedShip && rows.length === 0) {
          const sid = filter.ship_id ?? 'unknown';
          const msg =
            filter.year !== undefined
              ? `No compliance balance found for ship ${sid} in year ${filter.year}.`
              : `No compliance balance found for ship ${sid}.`;
          res.status(404).json({ error: msg });
          return;
        }

        res.json(rows);
      } catch (e) {
        if (e instanceof ValidationError) {
          res.status(400).json({ error: e.message });
          return;
        }
        if (e instanceof BaselineRouteNotFoundError) {
          res.status(503).json({ error: e.message });
          return;
        }
        next(e);
      }
    },

    async getRouteCompliance(req: Request, res: Response, next: NextFunction) {
      try {
        const routeId = paramRouteId(req);
        if (!routeId) {
          res.status(400).json({ error: 'Missing routeId' });
          return;
        }
        const result =
          await deps.complianceService.calculateRouteCompliance(routeId);
        res.json(result);
      } catch (e) {
        if (e instanceof RouteNotFoundError) {
          res.status(404).json({ error: e.message });
          return;
        }
        if (e instanceof BaselineRouteNotFoundError) {
          res.status(503).json({ error: e.message });
          return;
        }
        next(e);
      }
    },
  };
}
