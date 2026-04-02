import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '../../../../core/application/errors.js';
import type { HttpApiDeps } from '../httpApiDeps.js';

function parseShipYearQuery(req: Request): {
  ship_id?: string
  year?: number
} {
  const shipRaw = req.query.ship_id;
  const ship_id =
    typeof shipRaw === 'string' && shipRaw.trim()
      ? shipRaw.trim()
      : undefined;

  const yearRaw = req.query.year;
  if (yearRaw === undefined) {
    return { ship_id, year: undefined };
  }
  const y = Array.isArray(yearRaw) ? yearRaw[0] : yearRaw;
  const year = typeof y === 'string' ? Number(y) : Number(y);
  if (!Number.isFinite(year)) {
    throw new ValidationError('Invalid year query parameter');
  }

  return { ship_id, year };
}

function readJsonBody<T extends Record<string, unknown>>(body: unknown): T {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('JSON body is required');
  }
  return body as T;
}

export function createBankingHttpController(deps: Pick<
  HttpApiDeps,
  'listBankRecordsUseCase' | 'bankCreditUseCase' | 'applyBankUseCase'
>) {
  return {
    async listRecords(req: Request, res: Response, next: NextFunction) {
      try {
        const filter = parseShipYearQuery(req);
        const rows = await deps.listBankRecordsUseCase.execute(filter);
        res.json(rows);
      } catch (e) {
        if (e instanceof ValidationError) {
          res.status(400).json({ error: e.message });
          return;
        }
        next(e);
      }
    },

    async bank(req: Request, res: Response, next: NextFunction) {
      try {
        const b = readJsonBody<{
          ship_id?: unknown
          year?: unknown
          amount_gco2eq?: unknown
        }>(req.body);
        const rawShip =
          typeof b.ship_id === 'string' ? b.ship_id : String(b.ship_id ?? '');
        const ship_id = rawShip.trim().toUpperCase();
        const year = typeof b.year === 'number' ? b.year : Number(b.year);
        const amount_gco2eq =
          typeof b.amount_gco2eq === 'number'
            ? b.amount_gco2eq
            : Number(b.amount_gco2eq);

        const row = await deps.bankCreditUseCase.execute({
          ship_id,
          year,
          amount_gco2eq,
        });
        res.status(201).json(row);
      } catch (e) {
        if (e instanceof ValidationError) {
          res.status(400).json({ error: e.message });
          return;
        }
        next(e);
      }
    },

    async apply(req: Request, res: Response, next: NextFunction) {
      try {
        const b = readJsonBody<{
          ship_id?: unknown
          year?: unknown
        }>(req.body);
        const rawShip =
          typeof b.ship_id === 'string' ? b.ship_id : String(b.ship_id ?? '');
        const ship_id = rawShip.trim().toUpperCase();

        const year = typeof b.year === 'number' ? b.year : Number(b.year);

        const result = await deps.applyBankUseCase.execute({ ship_id, year });
        res.json(result);
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
