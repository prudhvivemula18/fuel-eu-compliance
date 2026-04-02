import { ValidationError } from '../errors.js';
import type {
  BankEntryRecord,
  BankEntryRepositoryPort,
} from '../ports/bankEntryRepositoryPort.js';

export class BankCreditUseCase {
  constructor(private readonly bankEntries: BankEntryRepositoryPort) {}

  async execute(input: {
    ship_id: string
    year: number
    amount_gco2eq: number
  }): Promise<BankEntryRecord> {
    if (!input.ship_id?.trim()) {
      throw new ValidationError('ship_id is required');
    }
    if (!Number.isFinite(input.year)) {
      throw new ValidationError('year must be a number');
    }
    if (!Number.isFinite(input.amount_gco2eq)) {
      throw new ValidationError('amount_gco2eq must be a number');
    }

    return this.bankEntries.create({
      ship_id: input.ship_id.trim(),
      year: input.year,
      amount_gco2eq: input.amount_gco2eq,
    });
  }
}
