/**
 * compliance.test.ts
 *
 * Unit tests for the FuelEU Maritime Compliance core domain logic.
 * All repository ports are mocked — no database connection is required.
 * Tests cover:
 *   - ComplianceService.complianceBalanceFromRouteKpis  (CB formula)
 *   - ComplianceService.calculateRouteCompliance        (async, repo-delegating)
 *   - ProcessPoolUseCase.execute                        (pooling logic & validation)
 *   - GetComplianceBalanceUseCase.execute               (CB retrieval with fallback)
 */

import { ComplianceService } from '../src/core/application/ComplianceService';
import { ProcessPoolUseCase } from '../src/core/application/use-cases/processPoolUseCase';
import { GetComplianceBalanceUseCase } from '../src/core/application/use-cases/getComplianceBalanceUseCase';
import { ValidationError, RouteNotFoundError, BaselineRouteNotFoundError } from '../src/core/application/errors';
import type { RouteRepositoryPort, RouteEntity } from '../src/core/application/ports/routeRepositoryPort';
import type { ShipComplianceRepositoryPort, ShipComplianceRecord } from '../src/core/application/ports/shipComplianceRepositoryPort';
import type { PoolCreationPort } from '../src/core/application/ports/poolCreationPort';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

const LCV = 42; // MJ/kg — matches ComplianceService constant

/** Baseline route: represents the 2025 regulatory GHG intensity limit. */
const BASELINE_ROUTE: RouteEntity = {
  id: 'uuid-baseline',
  route_id: 'R001',
  vessel_type: 'Container Ship',
  fuel_type: 'VLSFO',
  year: 2025,
  ghg_intensity: 91.16,  // gCO2eq/MJ — FuelEU 2025 limit placeholder
  fuel_consumption: 12000,
  distance: 4500,
  total_emissions: 1026000,
  is_baseline: true,
};

/** Compliant route: GHG intensity below baseline → positive CB. */
const COMPLIANT_ROUTE: RouteEntity = {
  id: 'uuid-r002',
  route_id: 'R002',
  vessel_type: 'Bulk Carrier',
  fuel_type: 'LNG',
  year: 2025,
  ghg_intensity: 71.20,
  fuel_consumption: 9500,
  distance: 3800,
  total_emissions: 676400,
  is_baseline: false,
};

/** Non-compliant route: GHG intensity above baseline → negative CB. */
const NON_COMPLIANT_ROUTE: RouteEntity = {
  id: 'uuid-r003',
  route_id: 'R003',
  vessel_type: 'Tanker',
  fuel_type: 'HFO',
  year: 2025,
  ghg_intensity: 112.00,
  fuel_consumption: 15000,
  distance: 6000,
  total_emissions: 1680000,
  is_baseline: false,
};

// ---------------------------------------------------------------------------
// Mock Factories
// ---------------------------------------------------------------------------

function makeRouteRepo(overrides: Partial<RouteRepositoryPort> = {}): RouteRepositoryPort {
  return {
    findAll: jest.fn().mockResolvedValue([BASELINE_ROUTE, COMPLIANT_ROUTE, NON_COMPLIANT_ROUTE]),
    findByRouteId: jest.fn().mockResolvedValue(null),
    findByRouteIdAndYear: jest.fn().mockResolvedValue(null),
    findBaseline: jest.fn().mockResolvedValue(BASELINE_ROUTE),
    setBaselineRouteId: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeShipComplianceRepo(records: ShipComplianceRecord[] = []): ShipComplianceRepositoryPort {
  return {
    findAll: jest.fn().mockResolvedValue(records),
  };
}

function makePoolCreationPort(poolId = 'pool-uuid-test'): PoolCreationPort {
  return {
    createPoolWithAllocations: jest.fn().mockResolvedValue({ pool_id: poolId }),
  };
}

// ---------------------------------------------------------------------------
// Helper: expected CB for a given route against the baseline
// ---------------------------------------------------------------------------

function expectedCB(route: RouteEntity, baseline: RouteEntity): number {
  return (baseline.ghg_intensity - route.ghg_intensity) * (route.fuel_consumption * LCV);
}

// ===========================================================================
// SUITE 1: ComplianceService — complianceBalanceFromRouteKpis (synchronous)
// ===========================================================================

describe('ComplianceService.complianceBalanceFromRouteKpis', () => {
  let service: ComplianceService;

  beforeEach(() => {
    service = new ComplianceService(makeRouteRepo());
  });

  it('returns a positive CB when route GHG intensity is below baseline (compliant)', () => {
    const cb = service.complianceBalanceFromRouteKpis(COMPLIANT_ROUTE, BASELINE_ROUTE);
    const expected = expectedCB(COMPLIANT_ROUTE, BASELINE_ROUTE);
    expect(cb).toBeCloseTo(expected, 2);
    expect(cb).toBeGreaterThan(0);
  });

  it('returns a negative CB when route GHG intensity is above baseline (non-compliant)', () => {
    const cb = service.complianceBalanceFromRouteKpis(NON_COMPLIANT_ROUTE, BASELINE_ROUTE);
    const expected = expectedCB(NON_COMPLIANT_ROUTE, BASELINE_ROUTE);
    expect(cb).toBeCloseTo(expected, 2);
    expect(cb).toBeLessThan(0);
  });

  it('returns zero CB when route GHG intensity exactly matches baseline', () => {
    const sameAsBaseline = { ...COMPLIANT_ROUTE, ghg_intensity: BASELINE_ROUTE.ghg_intensity };
    const cb = service.complianceBalanceFromRouteKpis(sameAsBaseline, BASELINE_ROUTE);
    expect(cb).toBe(0);
  });

  it('scales proportionally with fuel consumption', () => {
    const doubled = { ...COMPLIANT_ROUTE, fuel_consumption: COMPLIANT_ROUTE.fuel_consumption * 2 };
    const cbSingle = service.complianceBalanceFromRouteKpis(COMPLIANT_ROUTE, BASELINE_ROUTE);
    const cbDoubled = service.complianceBalanceFromRouteKpis(doubled, BASELINE_ROUTE);
    expect(cbDoubled).toBeCloseTo(cbSingle * 2, 2);
  });

  it('applies the LCV constant (42 MJ/kg) in Energy_total computation', () => {
    // CB = (91.16 - 71.20) × (9500 × 42)
    const ghgDiff = BASELINE_ROUTE.ghg_intensity - COMPLIANT_ROUTE.ghg_intensity;
    const energyTotal = COMPLIANT_ROUTE.fuel_consumption * 42;
    const manualCB = ghgDiff * energyTotal;

    const cb = service.complianceBalanceFromRouteKpis(COMPLIANT_ROUTE, BASELINE_ROUTE);
    expect(cb).toBeCloseTo(manualCB, 5);
  });

  it('handles a route with zero fuel consumption (edge case → CB = 0)', () => {
    const zeroFuel = { ...COMPLIANT_ROUTE, fuel_consumption: 0 };
    const cb = service.complianceBalanceFromRouteKpis(zeroFuel, BASELINE_ROUTE);
    expect(cb).toBe(0);
  });
});

// ===========================================================================
// SUITE 2: ComplianceService — calculateRouteCompliance (async)
// ===========================================================================

describe('ComplianceService.calculateRouteCompliance', () => {
  it('returns Compliant status for a route below baseline intensity', async () => {
    const repo = makeRouteRepo({
      findByRouteId: jest.fn().mockResolvedValue(COMPLIANT_ROUTE),
      findBaseline: jest.fn().mockResolvedValue(BASELINE_ROUTE),
    });
    const service = new ComplianceService(repo);

    const result = await service.calculateRouteCompliance('R002');

    expect(result.route_id).toBe('R002');
    expect(result.status).toBe('Compliant');
    expect(result.compliance_balance).toBeGreaterThan(0);
  });

  it('returns Non-Compliant status for a route above baseline intensity', async () => {
    const repo = makeRouteRepo({
      findByRouteId: jest.fn().mockResolvedValue(NON_COMPLIANT_ROUTE),
      findBaseline: jest.fn().mockResolvedValue(BASELINE_ROUTE),
    });
    const service = new ComplianceService(repo);

    const result = await service.calculateRouteCompliance('R003');

    expect(result.route_id).toBe('R003');
    expect(result.status).toBe('Non-Compliant');
    expect(result.compliance_balance).toBeLessThan(0);
  });

  it('throws RouteNotFoundError when the target route does not exist', async () => {
    const repo = makeRouteRepo({
      findByRouteId: jest.fn().mockResolvedValue(null),
    });
    const service = new ComplianceService(repo);

    await expect(service.calculateRouteCompliance('R999')).rejects.toThrow(RouteNotFoundError);
  });

  it('throws BaselineRouteNotFoundError when no baseline is configured', async () => {
    const repo = makeRouteRepo({
      findByRouteId: jest.fn().mockResolvedValue(COMPLIANT_ROUTE),
      findBaseline: jest.fn().mockResolvedValue(null),
    });
    const service = new ComplianceService(repo);

    await expect(service.calculateRouteCompliance('R002')).rejects.toThrow(BaselineRouteNotFoundError);
  });

  it('delegates repository access through the port interface, not directly', async () => {
    const repo = makeRouteRepo({
      findByRouteId: jest.fn().mockResolvedValue(COMPLIANT_ROUTE),
      findBaseline: jest.fn().mockResolvedValue(BASELINE_ROUTE),
    });
    const service = new ComplianceService(repo);

    await service.calculateRouteCompliance('R002');

    // Verifies hexagonal boundary: ComplianceService must ONLY use the port interface
    expect(repo.findByRouteId).toHaveBeenCalledWith('R002');
    expect(repo.findBaseline).toHaveBeenCalled();
  });
});

// ===========================================================================
// SUITE 3: ProcessPoolUseCase — pooling logic and validation
// ===========================================================================

describe('ProcessPoolUseCase.execute', () => {
  let routeRepo: RouteRepositoryPort;
  let poolPort: PoolCreationPort;
  let service: ComplianceService;
  let useCase: ProcessPoolUseCase;

  beforeEach(() => {
    routeRepo = makeRouteRepo({
      findByRouteId: jest.fn().mockImplementation(async (id: string) => {
        if (id.toUpperCase() === 'R001') return BASELINE_ROUTE;
        if (id.toUpperCase() === 'R002') return COMPLIANT_ROUTE;
        if (id.toUpperCase() === 'R003') return NON_COMPLIANT_ROUTE;
        return null;
      }),
    });
    poolPort = makePoolCreationPort('pool-test-id');
    service = new ComplianceService(routeRepo);
    useCase = new ProcessPoolUseCase(poolPort, routeRepo, service);
  });

  it('creates a pool and redistributes CB equally among members', async () => {
    // R001 and R002 are both compliant → positive pool total
    const result = await useCase.execute({
      year: 2025,
      members: [{ ship_id: 'R001' }, { ship_id: 'R002' }],
    });

    expect(result.pool_id).toBe('pool-test-id');
    expect(result.year).toBe(2025);
    expect(result.allocations).toHaveLength(2);

    const cbR001 = expectedCB(BASELINE_ROUTE, BASELINE_ROUTE); // baseline vs itself → 0
    const cbR002 = expectedCB(COMPLIANT_ROUTE, BASELINE_ROUTE);
    const expectedShare = (cbR001 + cbR002) / 2;

    result.allocations.forEach((alloc) => {
      expect(alloc.cb_after).toBeCloseTo(expectedShare, 2);
    });
  });

  it('persists the pool by calling PoolCreationPort.createPoolWithAllocations', async () => {
    await useCase.execute({
      year: 2025,
      members: [{ ship_id: 'R002' }],
    });

    expect(poolPort.createPoolWithAllocations).toHaveBeenCalledTimes(1);
    expect(poolPort.createPoolWithAllocations).toHaveBeenCalledWith(
      2025,
      expect.arrayContaining([
        expect.objectContaining({ ship_id: 'R002' }),
      ]),
    );
  });

  it('throws ValidationError when members array is empty', async () => {
    await expect(useCase.execute({ year: 2025, members: [] })).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when year is not a finite number', async () => {
    await expect(useCase.execute({ year: NaN, members: [{ ship_id: 'R002' }] })).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when a member ship_id is blank', async () => {
    await expect(
      useCase.execute({ year: 2025, members: [{ ship_id: '   ' }] }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when a member route does not exist in the database', async () => {
    await expect(
      useCase.execute({ year: 2025, members: [{ ship_id: 'R999' }] }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when a member route year does not match the pool year', async () => {
    const wrongYearRoute = { ...COMPLIANT_ROUTE, year: 2024 };
    (routeRepo.findByRouteId as jest.Mock).mockResolvedValue(wrongYearRoute);

    await expect(
      useCase.execute({ year: 2025, members: [{ ship_id: 'R002' }] }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when no baseline route is configured', async () => {
    (routeRepo.findBaseline as jest.Mock).mockResolvedValue(null);

    await expect(
      useCase.execute({ year: 2025, members: [{ ship_id: 'R002' }] }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when combined pool CB is negative (net deficit)', async () => {
    // R003 alone is non-compliant — pool total is negative
    await expect(
      useCase.execute({ year: 2025, members: [{ ship_id: 'R003' }] }),
    ).rejects.toThrow(ValidationError);
  });

  it('records cb_before correctly from the formula before redistribution', async () => {
    const result = await useCase.execute({
      year: 2025,
      members: [{ ship_id: 'R002' }],
    });

    const expected = expectedCB(COMPLIANT_ROUTE, BASELINE_ROUTE);
    expect(result.allocations[0]!.cb_before).toBeCloseTo(expected, 2);
  });
});

// ===========================================================================
// SUITE 4: GetComplianceBalanceUseCase — retrieval with computed fallback
// ===========================================================================

describe('GetComplianceBalanceUseCase.execute', () => {
  it('returns stored records when they exist', async () => {
    const stored: ShipComplianceRecord[] = [
      { id: 'rec-1', ship_id: 'R002', year: 2025, cb_gco2eq: 7984800 },
    ];
    const shipRepo = makeShipComplianceRepo(stored);
    const routeRepo = makeRouteRepo();
    const service = new ComplianceService(routeRepo);
    const uc = new GetComplianceBalanceUseCase(shipRepo, service);

    const result = await uc.execute({ ship_id: 'R002', year: 2025 });

    expect(result).toEqual(stored);
    expect(shipRepo.findAll).toHaveBeenCalledWith({ ship_id: 'R002', year: 2025 });
  });

  it('falls back to computed CB when no stored record exists', async () => {
    const shipRepo = makeShipComplianceRepo([]);
    const routeRepo = makeRouteRepo({
      findByRouteIdAndYear: jest.fn().mockResolvedValue(COMPLIANT_ROUTE),
      findBaseline: jest.fn().mockResolvedValue(BASELINE_ROUTE),
    });
    const service = new ComplianceService(routeRepo);
    const uc = new GetComplianceBalanceUseCase(shipRepo, service);

    const result = await uc.execute({ ship_id: 'R002', year: 2025 });

    expect(result).toHaveLength(1);
    expect(result[0]!.ship_id).toBe('R002');
    expect(result[0]!.cb_gco2eq).toBeCloseTo(expectedCB(COMPLIANT_ROUTE, BASELINE_ROUTE), 2);
    expect(result[0]!.id).toMatch(/^computed:/);
  });

  it('returns empty array when no record and no year filter provided', async () => {
    const shipRepo = makeShipComplianceRepo([]);
    const routeRepo = makeRouteRepo();
    const service = new ComplianceService(routeRepo);
    const uc = new GetComplianceBalanceUseCase(shipRepo, service);

    const result = await uc.execute({ ship_id: 'R002' });

    expect(result).toEqual([]);
  });

  it('returns empty array when route is not found in fallback path', async () => {
    const shipRepo = makeShipComplianceRepo([]);
    const routeRepo = makeRouteRepo({
      findByRouteIdAndYear: jest.fn().mockResolvedValue(null),
    });
    const service = new ComplianceService(routeRepo);
    const uc = new GetComplianceBalanceUseCase(shipRepo, service);

    const result = await uc.execute({ ship_id: 'R999', year: 2025 });

    expect(result).toEqual([]);
  });

  it('returns all records when called with no filter', async () => {
    const stored: ShipComplianceRecord[] = [
      { id: 'rec-1', ship_id: 'R001', year: 2025, cb_gco2eq: 0 },
      { id: 'rec-2', ship_id: 'R002', year: 2025, cb_gco2eq: 7984800 },
    ];
    const shipRepo = makeShipComplianceRepo(stored);
    const routeRepo = makeRouteRepo();
    const service = new ComplianceService(routeRepo);
    const uc = new GetComplianceBalanceUseCase(shipRepo, service);

    const result = await uc.execute();

    expect(result).toEqual(stored);
  });
});
