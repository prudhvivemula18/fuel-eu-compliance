# FuelEU Maritime Compliance Dashboard

A full-stack regulatory compliance tool for shipping operators, built to model the **FuelEU Maritime Regulation (EU) 2023/1805**. The system computes per-vessel Compliance Balances (CB), supports surplus banking across reporting years, and enables multi-vessel pooling agreements — all behind a clean RESTful API and a React dashboard.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Domain / Application** | TypeScript (pure, no runtime deps) | Regulatory math, use-cases, port interfaces |
| **API Server** | Node.js 22 + Express 5 | HTTP transport; inbound adapter |
| **ORM / Migrations** | Prisma 6 + PostgreSQL | Database access; outbound adapter |
| **Frontend** | React 19 + Vite 8 + Tailwind CSS 4 | Compliance dashboard UI |
| **Type System** | TypeScript 5.9 (strict) | End-to-end type safety |

---

## Architecture: Hexagonal (Ports & Adapters)

The project deliberately adopts **Hexagonal Architecture** (Alistair Cockburn, 2005) to enforce a hard boundary between regulatory business logic and the volatile persistence/HTTP infrastructure.

```
┌──────────────────────────────────────────────────────────────┐
│                        CORE (Domain)                         │
│  ComplianceService · Use-Cases · Domain Entities · Ports     │
│  — Zero dependencies on Prisma, Express, or Node I/O —      │
└───────────────────┬──────────────────────┬───────────────────┘
                    │  Port interfaces      │  Port interfaces
          ┌─────────▼──────────┐  ┌────────▼────────────────┐
          │  INBOUND ADAPTERS  │  │   OUTBOUND ADAPTERS      │
          │  Express HTTP      │  │   Prisma / PostgreSQL    │
          │  Controllers       │  │   Repository Adapters    │
          └────────────────────┘  └─────────────────────────┘
```

### Why Hexagonal for a Compliance System?

FuelEU regulations are complex, numerically precise, and will evolve. Embedding `PrismaClient` directly inside compliance calculations (a common AI-generated anti-pattern) would couple the regulatory math to the database, making unit testing, regulatory audits, and future database migrations significantly more difficult.

By defining **Port interfaces** (`RouteRepositoryPort`, `ShipComplianceRepositoryPort`, `BankEntryRepositoryPort`, `PoolCreationPort`) in the core, the `ComplianceService` and all use-cases are **fully testable with in-memory mocks** and **completely agnostic of persistence technology**.

**Domain Layer** (`src/core/`): Pure TypeScript. Contains `ComplianceService` (CB formula), all use-cases, and port interface definitions. Has zero imports from `@prisma/client` or `express`.

**Infrastructure Layer** (`src/adapters/outbound/postgres/`): Prisma adapter classes that implement the port interfaces. Contains all database logic — `PrismaClient` never crosses into the core.

**Inbound Adapters** (`src/adapters/inbound/http/`): Express controllers that parse HTTP requests and delegate to use-cases. They are thin — no business logic lives here.

**Composition Root** (`src/infrastructure/server/httpDepsFactory.ts`): The single location where concrete adapters are instantiated and injected into use-cases. This is the only place that "knows" about both layers.

---

## Core Compliance Formula

The FuelEU Maritime Compliance Balance (CB) is calculated as:

```
CB = (GHG_limit − GHG_actual) × Energy_total
   = (baseline.ghg_intensity − route.ghg_intensity) × (fuel_consumption_kg × LCV_MJ_per_kg)
```

Where `LCV` (Lower Calorific Value) defaults to **42 MJ/kg** (marine fuel placeholder). A **positive CB** indicates a surplus (compliant); a **negative CB** indicates a deficit (non-compliant).

This formula is implemented purely in `ComplianceService.complianceBalanceFromRouteKpis()` with no database calls, enabling deterministic unit testing.

---

## Project Structure

```
fuel-eu-compliance/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma              # DB schema: Route, ShipCompliance, Pool, BankEntry
│   └── src/
│       ├── core/
│       │   ├── domain/                # Pure TS interfaces: Route, Pool, ShipCompliance, BankEntry
│       │   └── application/
│       │       ├── ComplianceService.ts    # Core GHG/CB math
│       │       ├── errors.ts              # Domain error types
│       │       ├── ports/                 # Repository & service interfaces (the "hexagon boundary")
│       │       └── use-cases/             # GetComplianceBalance, ProcessPool, BankCredit, etc.
│       ├── adapters/
│       │   ├── inbound/http/
│       │   │   └── controllers/       # Express HTTP controllers
│       │   └── outbound/postgres/     # Prisma implementations of port interfaces
│       └── infrastructure/
│           ├── db/                    # Prisma client singleton + seed data
│           └── server/
│               ├── main.ts            # Entry point
│               ├── httpDepsFactory.ts # Composition root
│               └── routes.ts          # Route registration
└── frontend/
    └── src/
        ├── components/               # Dashboard, BankingTab, PoolingTab
        └── hooks/
            └── useCompliance.ts      # Data fetching hook
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 22
- PostgreSQL (local or Docker)

### Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env: set DATABASE_URL=postgresql://user:pass@localhost:5432/fueleu

npm install
npm run db:migrate    # Apply Prisma migrations
npm run db:seed       # Seed sample routes and compliance records
npm run dev           # Start API server on http://localhost:3000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev           # Vite dev server on http://localhost:5173
```

---

## API Reference

### `GET /api/routes`

Returns all voyage route records ordered by `route_id`.

**Request**
```http
GET /api/routes HTTP/1.1
Host: localhost:3000
```

**Response** `200 OK`
```json
[
  {
    "id": "a1b2c3d4-...",
    "route_id": "R001",
    "vessel_type": "Container Ship",
    "fuel_type": "VLSFO",
    "year": 2025,
    "ghg_intensity": 85.50,
    "fuel_consumption": 12000,
    "distance": 4500,
    "total_emissions": 1026000,
    "is_baseline": true
  },
  {
    "id": "e5f6g7h8-...",
    "route_id": "R002",
    "vessel_type": "Bulk Carrier",
    "fuel_type": "LNG",
    "year": 2025,
    "ghg_intensity": 71.20,
    "fuel_consumption": 9500,
    "distance": 3800,
    "total_emissions": 676400,
    "is_baseline": false
  }
]
```

---

### `POST /api/pools`

Creates a compliance pooling agreement for a given reporting year. Validates that the combined pool balance is non-negative (surplus must cover any deficits) and persists the allocation. Returns the `pool_id` and each member's CB before and after redistribution.

**Request**
```http
POST /api/pools HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "year": 2025,
  "members": [
    { "ship_id": "R001" },
    { "ship_id": "R002" },
    { "ship_id": "R003" }
  ]
}
```

**Response** `201 Created`
```json
{
  "pool_id": "pool-uuid-...",
  "year": 2025,
  "allocations": [
    { "ship_id": "R001", "cb_before": 594300.00, "cb_after": 346250.00 },
    { "ship_id": "R002", "cb_before": 601200.00, "cb_after": 346250.00 },
    { "ship_id": "R003", "cb_before": -156750.00, "cb_after": 346250.00 }
  ]
}
```

**Error Responses**

| Status | Condition |
|---|---|
| `400` | Missing/invalid `year`, empty `members`, unknown `ship_id`, year mismatch, or combined CB is negative |
| `503` | No baseline route (`is_baseline = true`) configured in the database |

---

### Additional Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/compliance/cb` | Compliance Balance per ship/year (with optional `?ship_id=&year=` filters) |
| `GET` | `/api/compliance/cb/adjusted` | CB adjusted for banked surplus/deficit |
| `GET` | `/api/compliance/routes/compare` | All routes vs. baseline: % diff and compliant flag |
| `PATCH` | `/api/routes/:id/baseline` | Designate a route as the regulatory baseline |
| `GET` | `/api/banking` | List all bank entries |
| `POST` | `/api/banking/credit` | Credit a surplus balance to a ship's bank account |
| `POST` | `/api/banking/apply` | Apply banked credit to reduce a deficit |

---

## Data Models (Prisma Schema Summary)

| Model | Key Fields |
|---|---|
| `Route` | `route_id`, `ghg_intensity`, `fuel_consumption`, `is_baseline` |
| `ShipCompliance` | `ship_id`, `year`, `cb_gco2eq` |
| `BankEntry` | `ship_id`, `year`, `amount_gco2eq` |
| `Pool` | `year`, `created_at` |
| `PoolMember` | `pool_id`, `ship_id`, `cb_before`, `cb_after` |

---

## Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/fueleu_db
PORT=3000
```

---

