import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type {
  ApplyBankPort,
  ApplyBankResult,
} from '../../../core/application/ports/applyBankPort.js';

const shipYearWhere = (ship_id: string, year: number) => ({
  ship_id: { equals: ship_id, mode: 'insensitive' as const },
  year,
});

export class ApplyBankPrismaAdapter implements ApplyBankPort {
  constructor(private readonly db: PrismaClient) {}

  async applyToShipYear(ship_id: string, year: number): Promise<ApplyBankResult> {
    return this.db.$transaction(async (tx) => {
      const entries = await tx.bankEntry.findMany({
        where: shipYearWhere(ship_id, year),
      });
      const applied = entries.reduce(
        (s, e) => s + e.amount_gco2eq.toNumber(),
        0,
      );

      if (entries.length === 0) {
        const existing = await tx.shipCompliance.findMany({
          where: shipYearWhere(ship_id, year),
        });
        const cbAfter =
          existing.reduce((s, r) => s + r.cb_gco2eq.toNumber(), 0) || 0;
        return { applied_amount_gco2eq: 0, cb_gco2eq_after: cbAfter };
      }

      await tx.bankEntry.deleteMany({ where: shipYearWhere(ship_id, year) });

      const complianceRows = await tx.shipCompliance.findMany({
        where: shipYearWhere(ship_id, year),
      });

      let cbAfter: number;

      if (complianceRows.length === 0) {
        const created = await tx.shipCompliance.create({
          data: {
            ship_id: ship_id.toUpperCase(),
            year,
            cb_gco2eq: new Prisma.Decimal(applied),
          },
        });
        cbAfter = created.cb_gco2eq.toNumber();
      } else if (complianceRows.length === 1) {
        const current = complianceRows[0].cb_gco2eq.toNumber();
        const next = current + applied;
        const updated = await tx.shipCompliance.update({
          where: { id: complianceRows[0].id },
          data: { cb_gco2eq: new Prisma.Decimal(next) },
        });
        cbAfter = updated.cb_gco2eq.toNumber();
      } else {
        const totalCb = complianceRows.reduce(
          (s, r) => s + r.cb_gco2eq.toNumber(),
          0,
        );
        cbAfter = totalCb + applied;
        await tx.shipCompliance.deleteMany({
          where: shipYearWhere(ship_id, year),
        });
        await tx.shipCompliance.create({
          data: {
            ship_id: ship_id.toUpperCase(),
            year,
            cb_gco2eq: new Prisma.Decimal(cbAfter),
          },
        });
      }

      return {
        applied_amount_gco2eq: applied,
        cb_gco2eq_after: cbAfter,
      };
    });
  }
}
