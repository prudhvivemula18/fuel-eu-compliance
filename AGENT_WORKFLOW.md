# Agent Workflow Log: FuelEU Maritime Compliance Dashboard

**Project:** FuelEU Maritime Compliance Dashboard  
**Architecture Pattern:** Hexagonal (Ports & Adapters)  
**Methodology:** AI-Assisted Phased Prompting with Human-in-the-Loop Architectural Enforcement  
**Total Development Phases:** 6

---

## Overview

This document records the phased development process used to build the FuelEU Maritime Compliance Dashboard. Each phase was introduced to the AI agent through deliberately scoped prompts — a technique referred to throughout this log as **Phased Prompting**. The approach limited the AI's generation scope to one architectural concern at a time, preventing cross-layer contamination and reducing the cognitive overhead of reviewing large, monolithic outputs.

A recurring challenge documented below is the **Architectural Leak** — instances where the AI agent, left without explicit constraint, attempted to introduce Prisma ORM logic (`PrismaClient`, model queries, `transaction`) directly into Domain or Use-Case layer files. Each detected leak is documented with the corrective action taken.

---

## Phase 1: Regulatory Mathematics (Domain Core)

**Objective:** Implement the FuelEU Compliance Balance formula as a pure, side-effect-free TypeScript service.

**Prompt Strategy:**  
The initial prompt was scoped exclusively to the mathematical specification:

> *"Implement a `ComplianceService` TypeScript class. It must have zero imports from any database library. It should expose a synchronous method `complianceBalanceFromRouteKpis(target, baseline)` that computes CB = (GHG_limit − GHG_actual) × (fuel_consumption × LCV). LCV = 42 MJ/kg. Also expose an async method `calculateRouteCompliance(routeId)` that delegates repository access to an injected `RouteRepositoryPort` interface — define that interface too."*

**Outcome:** The AI produced a correct implementation of `ComplianceService` and the `RouteRepositoryPort` interface. The mathematical formula was accurate and the `LCV_MJ_PER_KG` constant was correctly isolated.

**Architectural Leak Detected — Phase 1:**  
In an early draft, the AI generated `calculateRouteCompliance` with a direct import of `PrismaClient` and an inline `prisma.route.findFirst()` call, rather than delegating through the `RouteRepositoryPort` interface. The method signature was:

```typescript
// ❌ LEAKED — AI-generated anti-pattern (rejected)
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async calculateRouteCompliance(routeId: string) {
  const route = await prisma.route.findFirst({ where: { route_id: routeId } });
  // ...
}
```

**Corrective Action:** The prompt was revised to explicitly prohibit any import outside the `core/` directory and to require that all data access occur via the injected port. The re-generated output correctly used the constructor-injected `RouteRepositoryPort`:

```typescript
// ✅ CORRECTED — Port-based delegation
constructor(private readonly routes: RouteRepositoryPort) {}

async calculateRouteCompliance(routeId: string): Promise<RouteComplianceResult> {
  const [target, baseline] = await Promise.all([
    this.routes.findByRouteId(routeId),
    this.routes.findBaseline(),
  ]);
  // ...
}
```

---

## Phase 2: Database Schema & Prisma Migrations

**Objective:** Design the PostgreSQL schema and generate Prisma migrations for `routes`, `ship_compliance`, `bank_entries`, `pools`, and `pool_members`.

**Prompt Strategy:**  
Scoped entirely to the persistence model. The AI was given the domain interfaces from Phase 1 as reference and asked to produce a `schema.prisma` that mapped to those interfaces without adding fields that the domain did not require.

> *"Given these TypeScript domain interfaces, produce a Prisma schema for PostgreSQL. Use `Decimal` for all monetary/GHG balance fields. The `Pool` model must have a cascading `PoolMember` relation. Do not add any application logic to this file."*

**Outcome:** The Prisma schema was generated correctly, including `@db.Decimal(18, 4)` precision for compliance balance fields and a `Cascade` delete relation from `Pool` to `PoolMember`. The migration SQL was reviewed manually to confirm index correctness.

**Design Decision (Human):** The AI initially suggested adding a `status` enum column to the `pools` table (`PENDING`, `ACTIVE`, `CLOSED`). This was rejected on the grounds that compliance status is a computed property derivable from the pooling allocations — persisting it would introduce a risk of stale state. The schema was kept minimal.

---

## Phase 3: Repository Adapters & Composition Root

**Objective:** Implement the outbound Prisma adapters that satisfy the port interfaces, and build the composition root that wires all dependencies together.

**Prompt Strategy:**  
Each adapter was prompted individually. For example:

> *"Implement `RouteRepositoryPrismaAdapter` that implements `RouteRepositoryPort`. Use `PrismaClient` injected via the constructor. All `route_id` lookups must be case-insensitive (use Prisma's `mode: 'insensitive'`). The `setBaselineRouteId` method must be transactional — use `prisma.$transaction`."*

**Outcome:** All five adapters (`RouteRepositoryPrismaAdapter`, `ShipComplianceRepositoryPrismaAdapter`, `BankEntryRepositoryPrismaAdapter`, `ApplyBankPrismaAdapter`, `PoolCreationPrismaAdapter`) were generated correctly and conformed to their respective ports.

**Composition Root:** The `httpDepsFactory.ts` file — the single file that imports both `@prisma/client` and the domain use-cases — was generated last and reviewed carefully to confirm that it was the **only** location where adapters were instantiated. This file is the architectural keystone: if Prisma types appear anywhere else in the core, the boundary has been violated.

**Architectural Leak Detected — Phase 3:**  
During generation of `processPoolUseCase.ts`, the AI included an import of `PoolCreationPrismaAdapter` directly inside the use-case file to call `createPoolWithAllocations`. This was a direct boundary violation:

```typescript
// ❌ LEAKED — Prisma adapter imported inside a use-case (rejected)
import { PoolCreationPrismaAdapter } from '../../../adapters/outbound/postgres/poolCreationPrismaAdapter.js';
```

**Corrective Action:** The use-case was regenerated with `PoolCreationPort` injected via the constructor. The adapter is resolved only in `httpDepsFactory.ts`.

---

## Phase 4: Express HTTP Layer (Inbound Adapters)

**Objective:** Implement the Express 5 HTTP controllers for all API routes, connecting the inbound HTTP surface to the use-cases.

**Prompt Strategy:**  
Controllers were generated with an explicit instruction that they must contain **no business logic** — their sole responsibility is to parse HTTP input, call a use-case, and map the result to an HTTP response with an appropriate status code.

> *"Generate an Express controller for the pooling API. It must parse the JSON body, delegate entirely to `ProcessPoolUseCase.execute()`, and return HTTP 201 on success. Map `ValidationError` to 400. The controller must not compute compliance balances itself."*

**Outcome:** All four controllers (`routesHttpController`, `complianceHttpController`, `bankingHttpController`, `poolingHttpController`) were generated as thin delegators. Error mapping was consistent across controllers: `ValidationError → 400`, `RouteNotFoundError → 404`, `BaselineRouteNotFoundError → 503`.

**Observation:** The AI correctly identified that `503 Service Unavailable` was semantically appropriate for the missing-baseline scenario — the API cannot serve compliance data without a configured baseline, analogous to a downstream dependency being unavailable.

---

## Phase 5: Compliance Banking Logic

**Objective:** Implement the FuelEU banking mechanism — allowing ships with surplus CB to carry credit forward into future reporting years, and to apply that credit against deficits.

**Prompt Strategy:**  
The banking prompt explicitly referenced the FuelEU Article 23 mechanism (banking of surplus compliance balances) to give the AI regulatory context:

> *"Implement `BankCreditUseCase` and `ApplyBankUseCase`. Banking credits a positive CB amount to `bank_entries` for a given `ship_id` and `year`. Applying deducts from the bank and records a corresponding negative entry. Both operations must validate that amounts are positive numbers. Use the `BankEntryRepositoryPort` interface."*

**Outcome:** Both use-cases were generated correctly. `GetAdjustedComplianceBalanceUseCase` was also produced in this phase, combining `ShipComplianceRepositoryPort` and `BankEntryRepositoryPort` data into a unified `adjusted_cb_gco2eq` view.

**Regulatory Nuance (Human Override):** The AI initially modelled banking as an idempotent `upsert` operation (one bank record per ship/year). This was overridden: FuelEU banking can involve multiple partial credits and partial applications within a year. The schema was corrected to allow multiple `bank_entries` rows per `(ship_id, year)`, summed at query time.

---

## Phase 6: Pooling Logic & React Frontend

**Objective:** Implement the `ProcessPoolUseCase` for FuelEU Article 22 compliance pooling, and build the React dashboard frontend.

**Prompt Strategy (Pooling):**  
> *"Implement `ProcessPoolUseCase`. It must: (1) validate that a baseline route exists, (2) fetch each member route by `route_id`, (3) compute each member's CB using `ComplianceService.complianceBalanceFromRouteKpis`, (4) validate that the total pool CB is ≥ 0 (no net deficit), (5) redistribute the total equally across members as `cb_after`, and (6) persist the pool via `PoolCreationPort`."*

**Outcome:** The pooling use-case was generated correctly, including the equal-redistribution logic and the non-negative pool total validation. The use-case correctly delegates all persistence to `PoolCreationPort` — no Prisma logic is present in the core.

**Prompt Strategy (Frontend):**  
The frontend was prompted as a separate, self-contained phase:

> *"Generate a React 19 + Tailwind CSS 4 + Vite 8 frontend. Build three views: a main Dashboard with GHG intensity comparisons, a Banking tab for crediting/applying bank balances, and a Pooling tab for creating pool agreements. All data fetched from `localhost:3000/api`. Use a custom `useCompliance` hook for API calls."*

**Outcome:** The frontend components were generated with appropriate separation (`Dashboard.tsx`, `BankingTab.tsx`, `PoolingTab.tsx`) and a shared `useCompliance.ts` hook. The AI correctly placed all API interaction in the hook rather than inline within component render functions.

---

## Summary: Phased Prompting Effectiveness

| Phase | AI Contribution | Human Intervention |
|---|---|---|
| 1 — Math | Formula implementation, port interface | Rejected Prisma leak in `ComplianceService` |
| 2 — DB Schema | Full schema generation | Rejected status enum anti-pattern |
| 3 — Adapters | All 5 Prisma adapters, composition root | Rejected Prisma import inside use-case |
| 4 — HTTP Layer | All 4 Express controllers + error mapping | Minor query parsing corrections |
| 5 — Banking | BankCredit, ApplyBank, AdjustedCB use-cases | Corrected upsert → multi-row banking model |
| 6 — Pooling + UI | ProcessPool use-case, full React frontend | Validated equal redistribution logic |

### Key Observation

The primary failure mode of AI-assisted development in a layered architecture is **boundary erosion** — the AI optimises for producing a working output in the shortest path, which frequently means collapsing layers. In this project, **three architectural leaks** were detected and rejected across Phases 1, 3, and an early draft of Phase 6. All three involved Prisma constructs appearing in the domain or use-case layer.

Phased Prompting was effective precisely because it constrained the AI's "surface of knowledge" at generation time. By withholding the Prisma schema during Phase 1, the AI could not inadvertently reach for it. Human review at each phase boundary was the critical enforcement mechanism.
