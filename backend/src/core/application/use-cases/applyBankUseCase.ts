import { ValidationError } from '../errors.js';
import type { ApplyBankPort, ApplyBankResult } from '../ports/applyBankPort.js';

export class ApplyBankUseCase {
  constructor(private readonly applyBank: ApplyBankPort) {}

  execute(input: { ship_id: string; year: number }): Promise<ApplyBankResult> {
    if (!input.ship_id?.trim()) {
      throw new ValidationError('ship_id is required');
    }
    if (!Number.isFinite(input.year)) {
      throw new ValidationError('year must be a number');
    }

    return this.applyBank.applyToShipYear(input.ship_id.trim(), input.year);
  }
}
