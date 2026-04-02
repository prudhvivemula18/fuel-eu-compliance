import type { NextFunction, Request, Response } from 'express';
import {
  BaselineRouteNotFoundError,
  RouteNotFoundError,
  ValidationError,
} from '../../../../core/application/errors.js';
import type { HttpApiDeps } from '../httpApiDeps.js';

function paramId(req: Request): string | undefined {
  const raw = req.params.id;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v?.trim() || undefined;
}

export function createRoutesHttpController(deps: Pick<
  HttpApiDeps,
  'listRoutesUseCase' | 'setBaselineRouteUseCase' | 'compareRoutesUseCase'
>) {
  return {
    async list(_req: Request, res: Response, next: NextFunction) {
      try {
        const rows = await deps.listRoutesUseCase.execute();
        res.json(rows);
      } catch (e) {
        next(e);
      }
    },

    async setBaseline(req: Request, res: Response, next: NextFunction) {
      try {
        const id = paramId(req);
        if (!id) {
          res.status(400).json({ error: 'Missing route id' });
          return;
        }
        await deps.setBaselineRouteUseCase.execute(id);
        res.status(204).send();
      } catch (e) {
        if (e instanceof RouteNotFoundError) {
          res.status(404).json({ error: e.message });
          return;
        }
        next(e);
      }
    },

    async comparison(_req: Request, res: Response, next: NextFunction) {
      try {
        const result = await deps.compareRoutesUseCase.execute();
        res.json(result);
      } catch (e) {
        if (e instanceof BaselineRouteNotFoundError) {
          res.status(503).json({ error: e.message });
          return;
        }
        if (e instanceof ValidationError) {
          res.status(400).json({ error: e.message });
          return;
        }
        next(e);
      }
    },
  };
}
