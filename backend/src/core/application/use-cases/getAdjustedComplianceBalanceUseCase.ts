import type { ComplianceService } from '../ComplianceService.js';
import type { BankEntryRepositoryPort } from '../ports/bankEntryRepositoryPort.js';
import type { ShipComplianceRepositoryPort } from '../ports/shipComplianceRepositoryPort.js';
import { RouteNotFoundError } from '../errors.js';

export type AdjustedComplianceRow = {
  ship_id: string
  year: number
  cb_gco2eq: number
  bank_gco2eq: number
  adjusted_cb_gco2eq: number
};

export class GetAdjustedComplianceBalanceUseCase {
  constructor(
    private readonly shipCompliance: ShipComplianceRepositoryPort,
    private readonly bankEntries: BankEntryRepositoryPort,
    private readonly compliance: ComplianceService,
  ) {}

  async execute(filter?: {
    ship_id?: string
    year?: number
  }): Promise<AdjustedComplianceRow[]> {
    let rows = await this.shipCompliance.findAll(filter);

    if (
      rows.length === 0 &&
      filter?.ship_id &&
      filter.year !== undefined
    ) {
      try {
        const cb = await this.compliance.calculateComplianceBalanceForRouteYear(
          filter.ship_id,
          filter.year,
        );
        const sid = filter.ship_id.trim().toUpperCase();
        rows = [
          {
            id: `computed:${sid}:${filter.year}`,
            ship_id: sid,
            year: filter.year,
            cb_gco2eq: cb,
          },
        ];
      } catch (e) {
        if (!(e instanceof RouteNotFoundError)) {
          throw e;
        }
        rows = [];
      }
    }

    const rowKey = (ship_id: string, year: number) => `${ship_id}\t${year}`;
    const groups = new Map<string, { ship_id: string; year: number; cb: number }>();

    for (const row of rows) {
      const key = rowKey(row.ship_id, row.year);
      const prev = groups.get(key);
      const nextCb = (prev?.cb ?? 0) + row.cb_gco2eq;
      groups.set(key, { ship_id: row.ship_id, year: row.year, cb: nextCb });
    }

    const keysFromCompliance = new Set(groups.keys());
    const bankRows = await this.bankEntries.findAll(filter);
    const bankGroups = new Map<string, number>();

    for (const b of bankRows) {
      const key = rowKey(b.ship_id, b.year);
      keysFromCompliance.add(key);
      bankGroups.set(key, (bankGroups.get(key) ?? 0) + b.amount_gco2eq);
    }

    const result: AdjustedComplianceRow[] = [];

    for (const key of keysFromCompliance) {
      const [ship_id, yearStr] = key.split('\t');
      const year = Number(yearStr);
      const cb = groups.get(key)?.cb ?? 0;
      const bank_gco2eq = bankGroups.get(key) ?? 0;
      result.push({
        ship_id,
        year,
        cb_gco2eq: cb,
        bank_gco2eq,
        adjusted_cb_gco2eq: cb + bank_gco2eq,
      });
    }

    result.sort((a, b) =>
      a.ship_id === b.ship_id ? a.year - b.year : a.ship_id.localeCompare(b.ship_id),
    );

    return result;
  }
}
