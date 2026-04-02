import type { ComplianceService } from '../../../core/application/ComplianceService.js';
import type { ApplyBankUseCase } from '../../../core/application/use-cases/applyBankUseCase.js';
import type { BankCreditUseCase } from '../../../core/application/use-cases/bankCreditUseCase.js';
import type { CompareRoutesUseCase } from '../../../core/application/use-cases/compareRoutesUseCase.js';
import type { GetAdjustedComplianceBalanceUseCase } from '../../../core/application/use-cases/getAdjustedComplianceBalanceUseCase.js';
import type { GetComplianceBalanceUseCase } from '../../../core/application/use-cases/getComplianceBalanceUseCase.js';
import type { ListBankRecordsUseCase } from '../../../core/application/use-cases/listBankRecordsUseCase.js';
import type { ListRoutesUseCase } from '../../../core/application/use-cases/listRoutesUseCase.js';
import type { ProcessPoolUseCase } from '../../../core/application/use-cases/processPoolUseCase.js';
import type { SetBaselineRouteUseCase } from '../../../core/application/use-cases/setBaselineRouteUseCase.js';

export type HttpApiDeps = {
  complianceService: ComplianceService
  listRoutesUseCase: ListRoutesUseCase
  setBaselineRouteUseCase: SetBaselineRouteUseCase
  compareRoutesUseCase: CompareRoutesUseCase
  getComplianceBalanceUseCase: GetComplianceBalanceUseCase
  getAdjustedComplianceBalanceUseCase: GetAdjustedComplianceBalanceUseCase
  listBankRecordsUseCase: ListBankRecordsUseCase
  bankCreditUseCase: BankCreditUseCase
  applyBankUseCase: ApplyBankUseCase
  processPoolUseCase: ProcessPoolUseCase
};
