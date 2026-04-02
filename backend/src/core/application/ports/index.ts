/**
 * Port interfaces (inbound and outbound). Core depends on abstractions only;
 * adapters implement these contracts. No framework or ORM types here.
 */

export type { ApplyBankPort, ApplyBankResult } from './applyBankPort.js';
export type {
  BankEntryRecord,
  BankEntryRepositoryPort,
} from './bankEntryRepositoryPort.js';
export type {
  PoolCreationPort,
  PoolMemberAllocation,
} from './poolCreationPort.js';
export type {
  RouteEntity,
  RouteRepositoryPort,
} from './routeRepositoryPort.js';
export type {
  ShipComplianceRecord,
  ShipComplianceRepositoryPort,
} from './shipComplianceRepositoryPort.js';
