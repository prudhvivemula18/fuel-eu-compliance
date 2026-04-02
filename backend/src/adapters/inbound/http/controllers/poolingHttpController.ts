import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '../../../../core/application/errors.js';
import type { HttpApiDeps } from '../httpApiDeps.js';

export function createPoolingHttpController(deps: Pick<
  HttpApiDeps,
  'processPoolUseCase'
>) {
  return {
    async createPool(req: Request, res: Response, next: NextFunction) {
      try {
        const body = req.body as unknown;
        if (!body || typeof body !== 'object') {
          res.status(400).json({ error: 'JSON body is required' });
          return;
        }
        const b = body as {
          year?: unknown
          members?: unknown
        };
        const year = typeof b.year === 'number' ? b.year : Number(b.year);
        const members = b.members;

        const result = await deps.processPoolUseCase.execute({
          year,
          members: Array.isArray(members)
            ? members.map((m) => {
                const row = m as { ship_id?: unknown };
                return {
                  ship_id:
                    typeof row.ship_id === 'string'
                      ? row.ship_id
                      : String(row.ship_id ?? ''),
                };
              })
            : [],
        });
        res.status(201).json(result);
      } catch (e) {
        if (e instanceof ValidationError) {
          res.status(400).json({ error: e.message });
          return;
        }
        next(e);
      }
    },
  };
}
