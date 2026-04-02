# Reflection: AI-Assisted Development of a Regulatory Compliance System

**Subject:** Software Engineering — AI-Assisted Development  
**Project:** FuelEU Maritime Compliance Dashboard  
**Architecture:** Hexagonal (Ports & Adapters)

---

## The Promise and the Constraint

Building a regulatory compliance system is, at its core, an exercise in precision. The FuelEU Maritime Regulation (EU) 2023/1805 defines specific obligations — GHG intensity thresholds, compliance balance calculations, banking provisions, pooling arrangements — that admit no ambiguity in implementation. A rounding error, an incorrectly modelled cascade, or a transactional inconsistency does not merely produce a suboptimal user experience; it produces a legally consequential misrepresentation of a vessel's compliance status. This context made the decision to use AI-assisted code generation both compelling and fraught.

The efficiency gains from AI-assisted development were immediate and substantial during the project's early phases. Boilerplate that would typically consume the majority of a sprint — Prisma schema definition, migration files, Express controller scaffolding, TypeScript interface declarations — was generated in minutes. The AI demonstrated a robust command of idiomatic TypeScript, Prisma query patterns, and Express 5 request/response handling. For tasks that are essentially mechanical translations of a specification into code, the AI was genuinely excellent.

## Where Automation Ends and Judgement Begins

The efficiency dividend came with a persistent and instructive failure mode: **architectural boundary erosion**. On three distinct occasions, the AI generated code that crossed the hexagonal architecture's primary boundary — importing Prisma constructs (`PrismaClient`, model types, `$transaction`) into the domain or use-case layer. This was not random error; it was a systematic preference. The AI consistently optimised for the shortest path to a working implementation, and the shortest path in a Node.js application is almost always to reach for the ORM at the point of need, regardless of the layer that point of need sits within.

This observation reveals a fundamental tension in AI-assisted software engineering. The AI is trained on the aggregate of human-written code, the overwhelming majority of which does not implement strict layered architectures. When instructed to write a `ProcessPoolUseCase`, the AI's statistical model suggests that use-cases typically contain database queries, because in the corpus of real-world code, they do. Overriding this tendency requires an active, continuous human presence — not merely a well-written initial prompt, but a reviewer who understands the architectural rationale deeply enough to recognise a violation, articulate why it is a violation, and reformulate the prompt accordingly.

This is the **Human-in-the-Loop** requirement in its most precise form. It is not supervision in the sense of reading outputs for correctness; it is architectural stewardship — the application of domain knowledge that the AI does not possess, not because the information is unavailable to it, but because it lacks the contextual commitment to a specific design decision that informed, intentional engineering requires.

## The Regulatory Dimension

The FuelEU compliance domain introduced a second axis of complexity that AI assistance was ill-equipped to navigate without human guidance. Two specific cases illustrate this.

First, the banking mechanism. The AI initially modelled compliance surplus banking as an idempotent `upsert` — one record per `(ship_id, year)`. This is a reasonable default for many financial ledger designs. However, FuelEU's Article 23 banking provisions contemplate partial credits and partial applications of surplus across multiple transactions within a reporting year. The correct model requires an append-only ledger of `bank_entries` rows, summed at query time. The AI had no way to derive this from the Prisma schema or the TypeScript interfaces alone; it required regulatory knowledge that could only enter the system through human intervention.

Second, the pooling validation. The AI's initial implementation of `ProcessPoolUseCase` did not include the critical invariant that the combined pool compliance balance must be non-negative before a pooling agreement can be formed — a direct requirement of Article 22, which prohibits pooling arrangements where the aggregate deficit of participating vessels would remain uncovered. This guard was added during human review of the generated use-case, after the regulatory text was re-consulted. The AI, asked to implement "a pooling use-case," had no means of knowing that FuelEU pooling carries this specific precondition.

These cases demonstrate that regulatory software cannot be treated as a purely technical exercise. The boundary between clean code and legally correct code is not one that static analysis or even comprehensive unit testing can fully police. It requires a human being who has read the regulation.

## Balancing Regulatory Fidelity and Architectural Cleanliness

A tension emerged between the desire for regulatory accuracy and the desire for clean architecture. The `ComplianceService` formula — `CB = (GHG_limit − GHG_actual) × (fuel_consumption × LCV)` — is a simplification. The actual FuelEU intensity calculation involves fuel-specific Well-to-Wake emission factors, voyage-specific energy accounting, and wind-assisted propulsion corrections that were outside the scope of this project. The constant `LCV_MJ_PER_KG = 42` is a placeholder, not a regulatory value.

The architectural decision to isolate this formula in `ComplianceService`, however, was correct regardless of its current simplification. When the regulatory model is extended — and it will be, as FuelEU enters full force in 2025 — the formula expansion is localised to a single, well-tested class. The port interfaces and adapter pattern mean that no other layer needs to change. This is the practical dividend of Hexagonal Architecture for a compliance system: not merely theoretical elegance, but genuine change-cost reduction in the face of inevitable regulatory evolution.

## Conclusion

AI assistance proved genuinely valuable for this project in the domain of mechanical code generation. It compressed the implementation timeline for boilerplate, adapters, and controller scaffolding significantly. However, it consistently required human correction at two categories of decision point: architectural boundary enforcement, where the AI defaulted to the shortest path regardless of layering discipline; and regulatory fidelity, where the correct behaviour could only be specified by a human who had engaged with the underlying legislation.

The appropriate model for AI-assisted regulatory software development is not autonomous generation with human review, but collaborative generation with human architectural ownership. The AI is a highly capable implementation tool. The responsibility for what the implementation means — its correctness relative to a legal standard, its structural integrity relative to an architectural commitment — rests entirely with the engineer. This project reinforced that conclusion at every phase of its development.
