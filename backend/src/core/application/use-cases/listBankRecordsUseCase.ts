import type {
  BankEntryRecord,
  BankEntryRepositoryPort,
} from '../ports/bankEntryRepositoryPort.js';

export class ListBankRecordsUseCase {
  constructor(private readonly bankEntries: BankEntryRepositoryPort) {}

  execute(filter?: { ship_id?: string; year?: number }): Promise<BankEntryRecord[]> {
    return this.bankEntries.findAll(filter);
  }
}
