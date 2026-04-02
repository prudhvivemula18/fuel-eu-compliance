import type { HttpApiDeps } from '../../adapters/inbound/http/httpApiDeps.js';
import {
  ApplyBankPrismaAdapter,
  BankEntryRepositoryPrismaAdapter,
  PoolCreationPrismaAdapter,
  RouteRepositoryPrismaAdapter,
  ShipComplianceRepositoryPrismaAdapter,
} from '../../adapters/outbound/postgres/index.js';
import { ComplianceService } from '../../core/application/ComplianceService.js';
import { ApplyBankUseCase } from '../../core/application/use-cases/applyBankUseCase.js';
import { BankCreditUseCase } from '../../core/application/use-cases/bankCreditUseCase.js';
import { CompareRoutesUseCase } from '../../core/application/use-cases/compareRoutesUseCase.js';
import { GetAdjustedComplianceBalanceUseCase } from '../../core/application/use-cases/getAdjustedComplianceBalanceUseCase.js';
import { GetComplianceBalanceUseCase } from '../../core/application/use-cases/getComplianceBalanceUseCase.js';
import { ListBankRecordsUseCase } from '../../core/application/use-cases/listBankRecordsUseCase.js';
import { ListRoutesUseCase } from '../../core/application/use-cases/listRoutesUseCase.js';
import { ProcessPoolUseCase } from '../../core/application/use-cases/processPoolUseCase.js';
import { SetBaselineRouteUseCase } from '../../core/application/use-cases/setBaselineRouteUseCase.js';
import type { PrismaClient } from '@prisma/client';

export function createHttpApiDeps(prisma: PrismaClient): HttpApiDeps {
  const routeRepo = new RouteRepositoryPrismaAdapter(prisma);
  const shipComplianceRepo = new ShipComplianceRepositoryPrismaAdapter(prisma);
  const bankRepo = new BankEntryRepositoryPrismaAdapter(prisma);
  const applyBankPort = new ApplyBankPrismaAdapter(prisma);
  const poolCreation = new PoolCreationPrismaAdapter(prisma);

  const complianceService = new ComplianceService(routeRepo);

  return {
    complianceService,
    listRoutesUseCase: new ListRoutesUseCase(routeRepo),
    setBaselineRouteUseCase: new SetBaselineRouteUseCase(routeRepo),
    compareRoutesUseCase: new CompareRoutesUseCase(routeRepo),
    getComplianceBalanceUseCase: new GetComplianceBalanceUseCase(
      shipComplianceRepo,
      complianceService,
    ),
    getAdjustedComplianceBalanceUseCase: new GetAdjustedComplianceBalanceUseCase(
      shipComplianceRepo,
      bankRepo,
      complianceService,
    ),
    listBankRecordsUseCase: new ListBankRecordsUseCase(bankRepo),
    bankCreditUseCase: new BankCreditUseCase(bankRepo),
    applyBankUseCase: new ApplyBankUseCase(applyBankPort),
    processPoolUseCase: new ProcessPoolUseCase(
      poolCreation,
      routeRepo,
      complianceService,
    ),
  };
}
