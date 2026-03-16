# InvoiceScan

A production-grade invoice automation platform built with Clean Architecture, strict TDD, RBAC, BullMQ async processing, the Outbox pattern for reliable event delivery, OpenTelemetry observability, and a 5-job GitHub Actions CI pipeline that covers lint, type-check, unit, integration, E2E HTTP, and Playwright UI tests.

---

## What it does

InvoiceScan automates the end-to-end lifecycle of supplier invoices:

1. **Upload** — an uploader drags a PDF into the app (max 10 MB, MIME-validated server-side).
2. **Extract** — the backend enqueues a BullMQ job that runs OCR (Tesseract.js + pdf.js) and feeds the raw text to Google Gemini to extract structured fields: total, tax base, VAT amount, VAT %, invoice number, date, issuer name and TIN.
3. **Review** — the uploader inspects the AI-extracted data and explicitly sends it to validation.
4. **Validate** — a validator checks the data and pushes it to approval.
5. **Approve or Reject** — an approver makes the final decision, optionally with a rejection reason.
6. **Export** — approved invoices can be exported as CSV or JSON via an async export queue.
7. **Notify** — every workflow transition fires an email via **Resend** using the Outbox pattern (at-least-once delivery guaranteed).

The platform enforces strict **RBAC** (uploader → validator → approver) with cross-ownership enforcement: the person who sends an invoice to validation cannot also approve it — unless they are an admin.

---

## Architecture

### Clean Architecture — strict layer boundaries

```
packages/
├── shared/              ← Zod schemas + TypeScript types (consumed by backend AND frontend)
├── backend/
│   └── src/
│       ├── domain/      ← Pure TypeScript. Zero framework dependencies.
│       ├── application/ ← Use cases + ports (interfaces). No HTTP, no DB.
│       ├── infrastructure/ ← All externals: DB, queue, OCR, LLM, email, storage, events
│       └── interface/   ← NestJS controllers, guards, pipes, BullMQ workers
└── frontend/            ← Next.js 15 (App Router)
```

The dependency rule is enforced by convention and validated in CI:

```
domain ← application ← infrastructure
domain ← application ← interface
```

The `domain` layer has **zero** imports from the project. The `application` layer imports only `domain`. Infrastructure and interface may import application and domain — never the other way around.

### Domain layer

- **Entities:** `Invoice` (aggregate root), `User`, `AuditEvent`, `InvoiceEvent`
- **Value Objects:** `InvoiceAmount` (validates > 0, max 2 decimals), `TaxId` (NIF/CIF format), `InvoiceDate` (no future dates), `InvoiceStatus` (strict enum)
- **Domain Events:** `InvoiceUploadedEvent`, `InvoiceSentForValidationEvent`, `InvoiceSentForApprovalEvent`, `InvoiceApprovedEvent`, `InvoiceRejectedEvent` — all extend `DomainEventBase`
- **Typed errors:** `InvalidStateTransitionError`, `InvoiceNotFoundError`, `UserNotFoundError`, `LLMError`, `OCRError`, `ValueObjectError` — all extend `DomainError`
- **State machine on `Invoice`:** every transition (`startProcessing`, `markExtracted`, `markReadyForValidation`, etc.) validates the current state and returns `Result<void, InvalidStateTransitionError>`. Invalid transitions are caught at compile time and tested at unit level.

### Application layer — one file per use case

```
upload-invoice          process-invoice         send-to-validation
send-to-approval        approve-invoice         reject-invoice
retry-invoice           get-invoice             list-invoices
get-invoice-events      get-invoice-notes       add-invoice-note
get-invoice-stats       export-invoices         get-export-status
login                   logout                  refresh-token
create-user             list-users              delete-user
assign-uploader         assign-validator        remove-assignment
get-assignment-tree
```

Every use case returns `Result<T, DomainError>` via **neverthrow** — no thrown exceptions for business failures. The `DomainErrorFilter` in the interface layer maps domain errors to correct HTTP status codes.

### Ports (interfaces) in application layer

```
InvoiceQueuePort    ExportQueuePort    LLMPort
OCRPort             StoragePort        NotificationPort
EventBusPort        AuditPort          TokenStorePort
UnitOfWorkPort
```

### Infrastructure adapters

| Port | Adapter | Notes |
|---|---|---|
| `OCRPort` | `TesseractAdapter` + `PdfParseAdapter` | Tesseract.js for image-heavy PDFs; pdf.js for text-layer PDFs |
| `LLMPort` | `AIStudioAdapter` | Google Gemini via `@google/generative-ai`. Zod validates and coerces the LLM response. 30 s timeout. |
| `NotificationPort` | `ResendAdapter` | Idempotency key per event/invoice/recipient prevents duplicate sends on outbox retries |
| `EventBusPort` | `OutboxEventBusAdapter` | Persists events to `outbox_events` table instead of publishing directly — guarantees at-least-once delivery |
| `TokenStorePort` | `RedisTokenStoreAdapter` | Refresh token revocation list in Redis with TTL |
| `StoragePort` | `LocalStorageAdapter` | UUID filenames, stored outside webroot |
| `AuditPort` | `AuditAdapter` | Immutable append-only audit log |
| `InvoiceQueuePort` | `InvoiceQueueService` (BullMQ) | Enqueues OCR+LLM jobs |
| `ExportQueuePort` | `ExportQueueService` (BullMQ) | Enqueues CSV/JSON export jobs |

### Background workers

- **`ProcessInvoiceWorker`** — BullMQ consumer. Runs OCR → LLM → persists extracted data → updates status to `EXTRACTED`.
- **`ExportInvoicesWorker`** — BullMQ consumer. Generates CSV or JSON exports asynchronously.
- **`OutboxPollerWorker`** — `setInterval`-based poller (every 10 s). Reads `outbox_events WHERE processed = false`, emits each event via NestJS `EventEmitter2`, marks as processed. Overlap-safe with a `running` flag. OTel-traced.

### Outbox event handlers (at-least-once email delivery)

Each domain event has a dedicated handler that resolves recipients and calls `NotificationPort.notifyStatusChange()`:

- `InvoiceSentForValidationHandler` → notifies the assigned validator
- `InvoiceSentForApprovalHandler` → notifies approvers
- `InvoiceApprovedHandler` → notifies the uploader
- `InvoiceRejectedHandler` → notifies the uploader with the rejection reason

---

## Security

Security is not an afterthought — it's enforced at every layer.

### Authentication

- **JWT dual-token flow:** 15-minute access token (Bearer header) + 7-day refresh token (HttpOnly, `SameSite=Strict` cookie).
- **Refresh token revocation:** stored as a Redis key with TTL equal to the token expiry. Logout = immediate invalidation.
- **Password hashing:** bcrypt with 12 salt rounds.
- **Rate limiting:** `@nestjs/throttler` — 5 login attempts per IP per minute, 20 uploads/hour for uploader role.

### Authorization

- **`JwtAuthGuard`** protects every route by default. `@Public()` decorator opt-out for login/register.
- **`RolesGuard`** reads `@Roles(...)` metadata and validates `req.user.role` against required roles.
- **Row-level ownership:** uploader role receives a `WHERE uploader_id = :userId` filter in `InvoiceTypeOrmRepository.findAll()` — they never see other users' invoices.

### HTTP security headers (Helmet)

```
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

### Input validation

- **Zod** validates 100% of incoming DTOs before they reach controllers — via a custom `ZodValidationPipe`.
- **`FileValidationPipe`** checks the real MIME type of uploaded files (not just the extension) using `file-type`.
- **Upload size limit:** 10 MB (configurable via `MAX_UPLOAD_SIZE_MB`).
- **SQL injection prevention:** sort field names in `InvoiceTypeOrmRepository` are validated against an `ALLOWED_SORT_FIELDS` allowlist before being interpolated into queries.
- **Config validated at startup:** `ConfigSchema` (Zod) parses `process.env` — if any required variable is missing or malformed, the process exits immediately with a clear error.

### File storage

- Files are stored with **UUID filenames** — the original user-supplied name is never used.
- Files are served via **signed URLs**, never via direct path access.
- Storage directory is outside the HTTP webroot.

### CORS

Restricted to `FRONTEND_URL` — no wildcard origins. Only `GET`, `POST`, `PATCH`, `DELETE` methods allowed.

### Audit log

Every sensitive action (login, upload, approve, reject, state transition) is recorded in `audit_events`. Immutable — never deleted. Columns: `userId`, `action`, `resourceId`, `ip`, `occurredAt`.

### CI secret scanning

**Gitleaks** runs on every push/PR via GitHub Actions and blocks the pipeline if any secret pattern is detected in the diff.

---

## Observability

### OpenTelemetry (traces + metrics)

The SDK (`tracing.ts`) is imported as the **first** module in `main.ts` so auto-instrumentation patches Node.js HTTP, PostgreSQL (pg), and Redis clients at load time.

When `OTEL_EXPORTER_OTLP_ENDPOINT` is not set, the SDK is not initialised — the `@opentelemetry/api` package returns a no-op tracer, so all `trace.getTracer()` calls in the codebase are safe and cost nothing.

**Custom metrics** (defined as singletons in `src/shared/metrics/metrics.ts`):

| Metric | Type | Description |
|---|---|---|
| `invoices_approved_total` | Counter | Labelled by `approverId` |
| `invoices_rejected_total` | Counter | Labelled by `approverId` |
| `invoices_processed_total` | Counter | Labelled by `status: success\|error` |
| `outbox_events_processed_total` | Counter | Labelled by `eventType` |
| `ocr_duration_ms` | Histogram | Duration of the full OCR + LLM pipeline |

Metrics are exported every 10 seconds via OTLP/HTTP.

### SigNoz (local collector)

```bash
docker compose --profile observability up
# SigNoz UI → http://localhost:3301
# OTLP HTTP → http://localhost:4318
```

### Structured logging (Pino)

`nestjs-pino` replaces the default NestJS logger with Pino — JSON in production, pretty-printed in dev. The `OutboxPollerWorker` and all workers use `@InjectPinoLogger` for correlation-aware structured logs.

---

## Database

### Schema (10 migrations, all with `up` and `down`)

| Table | Purpose |
|---|---|
| `users` | Identity — email, role, created_at |
| `user_credentials` | Password hash stored separately from identity |
| `providers` | Invoice providers (Generic/Telefonica/Amazon) |
| `invoices` | Core aggregate — status, extracted data, validator/approver IDs |
| `invoice_events` | Immutable state transition history |
| `invoice_notes` | Reviewer comments per invoice |
| `audit_events` | Immutable security audit trail |
| `outbox_events` | Transactional Outbox — domain events pending delivery |
| `user_assignments` | Uploader → Validator assignment tree |

### Patterns

- **Repository pattern:** interfaces in `domain/repositories/`, TypeORM implementations in `infrastructure/db/repositories/`.
- **ORM entities are infrastructure**, never imported by domain. **Mappers** (`InvoiceMapper`, `UserMapper`, etc.) translate between ORM entities and domain entities.
- **`TypeOrmUnitOfWork`** wraps multi-table operations in explicit PostgreSQL transactions.
- **Soft delete** on important resources. No hard deletes.
- **`synchronize: false`** always — schema changes go through versioned migrations only.
- **Indexes** on `status`, `user_id`, `created_at`, and `outbox_events.processed WHERE processed = false`.

---

## Code quality

### Tooling

- **ESLint** + **Prettier** — consistent style enforced across all packages.
- **TypeScript strict mode** — no `any`, no implicit `any`, strict null checks.
- **Husky pre-commit:** lint + typecheck + unit tests must pass before any commit.
- **Husky pre-push:** full build must pass before push.
- **`neverthrow`** for typed `Result<T, E>` — no untyped throws for business logic.
- **Zod** as the single source of truth for all DTOs and config — validation at the boundary, types inferred from schemas.
- **`@invoice-flow/shared`** package — Zod schemas and TypeScript types defined once, consumed by both backend and frontend. No type drift between API contract and UI.

### CI pipeline (GitHub Actions)

5 parallel/sequential jobs on every push and pull request to `main` / `develop`. Concurrency groups cancel in-progress runs on the same branch to save CI minutes.

| Job | Runs on | After |
|---|---|---|
| **Backend quality** | ubuntu-latest | — |
| **Frontend quality** | ubuntu-latest | — |
| **Backend integration** | ubuntu-latest + PostgreSQL + Redis services | `quality` passes |
| **Backend E2E HTTP** | ubuntu-latest + PostgreSQL + Redis services | `quality` passes |
| **Playwright UI E2E** | ubuntu-latest + full stack (built + seeded) | `quality` + `frontend` pass |

**Backend quality job** runs:
1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test:cov` (unit tests with V8 coverage, no real DB needed — everything mocked)
4. `pnpm build`
5. **Gitleaks** secret scan
6. `pnpm audit --audit-level=high` (dependency vulnerability check)

**Frontend quality job** runs: lint → typecheck → build → dependency audit.

**Integration job** spins up real PostgreSQL 16 and Redis 7 as GitHub Actions services and runs TypeORM repository tests against them.

**E2E HTTP job** boots a full NestJS application in-process with Supertest.

**Playwright job** builds backend and frontend from source, runs migrations, seeds demo users, starts both servers, waits for health checks, then runs the full browser test suite. Reports and failure artifacts are uploaded as workflow artifacts (7-day retention).

---

## Tech stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Radix UI, TanStack Query, Framer Motion |
| **Backend** | NestJS 11, TypeScript, neverthrow |
| **Shared types** | Zod schemas, pnpm workspace package `@invoice-flow/shared` |
| **Database** | PostgreSQL 16, TypeORM 0.3, versioned migrations, Unit of Work |
| **Queue** | BullMQ 5 on Redis 7, Bull Board dashboard |
| **OCR** | Tesseract.js 7, pdf.js (pdfjs-dist) |
| **LLM extraction** | Google AI Studio — Gemini (`@google/generative-ai`) |
| **Email** | Resend SDK — idempotent, HTML templates per event type |
| **Auth** | JWT (access + refresh), bcrypt 12 rounds, Redis revocation |
| **Observability** | OpenTelemetry SDK (traces + metrics), SigNoz, Pino structured logs |
| **Security** | Helmet, CORS, Throttler, Gitleaks, `pnpm audit` |
| **Monorepo** | pnpm workspaces |
| **Testing** | Vitest, Supertest, Playwright |
| **CI** | GitHub Actions — 5-job pipeline with pnpm cache |
| **Infrastructure** | Docker Compose (PostgreSQL, Redis, optional SigNoz, optional full stack) |
| **Code quality** | ESLint, Prettier, Husky, TypeScript strict |

---

## Project structure

```
InvoiceScan/
├── .github/
│   └── workflows/
│       └── ci.yml                   # 5-job CI pipeline
│
├── packages/
│   ├── shared/                      # @invoice-flow/shared — Zod schemas + TS types
│   │
│   ├── backend/                     # NestJS application
│   │   └── src/
│   │       ├── domain/
│   │       │   ├── entities/        # Invoice, User, AuditEvent, InvoiceEvent
│   │       │   ├── value-objects/   # InvoiceAmount, TaxId, InvoiceDate, InvoiceStatus
│   │       │   ├── events/          # DomainEventBase + 5 domain events
│   │       │   ├── errors/          # Typed domain errors (one file per aggregate)
│   │       │   └── repositories/   # Repository interfaces (contracts)
│   │       │
│   │       ├── application/
│   │       │   ├── use-cases/       # 23 use cases — one file each
│   │       │   ├── ports/           # 10 port interfaces
│   │       │   └── dtos/            # Zod-validated input/output DTOs
│   │       │
│   │       ├── infrastructure/
│   │       │   ├── db/              # TypeORM entities, migrations, repositories, mappers
│   │       │   ├── ocr/             # TesseractAdapter, PdfParseAdapter
│   │       │   ├── llm/             # AIStudioAdapter (Gemini)
│   │       │   ├── notification/    # ResendAdapter + HTML email templates
│   │       │   ├── events/          # OutboxEventBusAdapter + 4 event handlers
│   │       │   ├── queue/           # BullMQ producers (invoice + export)
│   │       │   ├── storage/         # LocalStorageAdapter
│   │       │   ├── audit/           # AuditAdapter
│   │       │   └── auth/            # RedisTokenStoreAdapter
│   │       │
│   │       ├── interface/
│   │       │   ├── http/
│   │       │   │   ├── controllers/ # invoices, auth, admin, exports, health
│   │       │   │   ├── guards/      # JwtAuthGuard, RolesGuard
│   │       │   │   ├── pipes/       # ZodValidationPipe, FileValidationPipe
│   │       │   │   └── filters/     # DomainErrorFilter
│   │       │   └── jobs/            # ProcessInvoiceWorker, ExportWorker, OutboxPollerWorker
│   │       │
│   │       └── shared/
│   │           ├── config/          # ConfigSchema (Zod) — validated at startup
│   │           └── metrics/         # OTel Counter + Histogram singletons
│   │
│   └── frontend/                    # Next.js 15 (App Router)
│       ├── app/                     # Pages and layouts
│       ├── components/              # shadcn/ui + custom components
│       ├── hooks/                   # TanStack Query hooks
│       └── e2e/                     # Playwright tests
│
└── docker-compose.yml               # PostgreSQL, Redis, optional SigNoz + full app stack
```

---

## Running locally

### Prerequisites

- Node.js >= 18
- pnpm >= 9
- Docker Desktop

### 1. Clone and install

```bash
git clone <repo-url>
cd InvoiceScan
pnpm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

**Required:**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL — default: `postgresql://user:pass@localhost:5433/invoicescan` |
| `REDIS_URL` | Redis — default: `redis://localhost:6379` |
| `JWT_SECRET` | Random string ≥ 32 characters |
| `JWT_REFRESH_SECRET` | Random string ≥ 32 characters, different from above |
| `FRONTEND_URL` | `http://localhost:3001` |

**Optional (app starts fine without them):**

| Variable | Description |
|---|---|
| `AISTUDIO_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) — enables Gemini LLM extraction |
| `AISTUDIO_MODEL` | e.g. `gemini-1.5-flash` |
| `RESEND_API_KEY` | [Resend](https://resend.com) — enables email notifications |
| `RESEND_FROM_EMAIL` | e.g. `InvoiceScan <noreply@yourdomain.com>` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | e.g. `http://localhost:4318` — enables OTel export |

### 3. Start everything

```bash
pnpm dev
```

This single command: starts Docker (PostgreSQL + Redis) → waits for health checks → runs migrations → seeds demo users → starts backend + frontend concurrently.

| Service | URL |
|---|---|
| Backend API | http://localhost:3000/api/v1 |
| Frontend | http://localhost:3001 |
| BullMQ dashboard | http://localhost:3000/queues |
| Health check | http://localhost:3000/api/v1/health |

### 4. Demo accounts (created by seed)

| Email | Password | Role |
|---|---|---|
| admin@invoicescan.com | Admin1234! | admin |
| approver@invoicescan.com | Approver1234! | approver |
| validator@invoicescan.com | Validator1234! | validator |
| uploader@invoicescan.com | Uploader1234! | uploader |

### 5. Observability (optional)

```bash
docker compose --profile observability up
# SigNoz UI → http://localhost:3301
```

Set `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` in `.env` to start shipping traces and metrics.

---

## Available scripts

### Root (monorepo)

```bash
pnpm dev              # Infra + migrations + seed + backend + frontend
pnpm build            # Build all packages
pnpm lint             # Lint all packages
pnpm typecheck        # Type-check all packages
pnpm test             # Unit tests across all packages
pnpm infra:up         # Start Docker containers only
pnpm infra:down       # Stop Docker containers
pnpm infra:reset      # Wipe all volumes + restart fresh
```

### Backend

```bash
pnpm --filter backend start:dev          # Dev server (watch mode)
pnpm --filter backend test               # Unit tests (Vitest)
pnpm --filter backend test:watch         # Unit tests in watch mode
pnpm --filter backend test:integration   # Integration tests (real PostgreSQL)
pnpm --filter backend test:e2e           # E2E HTTP tests (Supertest)
pnpm --filter backend test:cov           # Coverage report (V8)
pnpm --filter backend migration:run      # Run pending migrations
pnpm --filter backend migration:revert   # Revert last migration
pnpm --filter backend migration:generate # Generate migration from entity diff
pnpm --filter backend seed               # Idempotent seed (demo users + generic provider)
```

### Frontend

```bash
pnpm --filter @invoice-flow/frontend dev              # Dev server (Turbopack)
pnpm --filter @invoice-flow/frontend build            # Production build
pnpm --filter @invoice-flow/frontend test:e2e         # Playwright tests (headless)
pnpm --filter @invoice-flow/frontend test:e2e:ui      # Playwright interactive UI mode
pnpm --filter @invoice-flow/frontend test:e2e:headed  # Playwright headed mode
pnpm --filter @invoice-flow/frontend test:e2e:report  # Open last Playwright report
```

---

## Testing

The project follows **TDD** throughout: every behavior is specified as a failing test before any implementation is written (Red → Green → Refactor).

### Test pyramid

| Level | Count | Tools | Notes |
|---|---|---|---|
| **Unit** | ~328 tests | Vitest | Domain + use cases + infra adapters. All external dependencies mocked via `vi.fn()`. No real DB, no network. |
| **Integration** | ~29 tests | Vitest | TypeORM repositories against a real PostgreSQL 16 instance in Docker. |
| **E2E HTTP** | ~40 tests | Vitest + Supertest | Full NestJS application booted in-process. Real DB + Redis. |
| **E2E UI** | Playwright | Playwright | Real browser (Chromium) against the full running stack. Includes auth flows, file upload, workflow transitions. |

### Test patterns

```typescript
// Arrange / Act / Assert — consistent across all test files
describe('ApproveInvoiceUseCase', () => {
  it('should approve invoice and publish domain event', async () => {
    // Arrange
    const invoice = createInvoice({ status: InvoiceStatusEnum.READY_FOR_APPROVAL });
    const mockRepo = createMockInvoiceRepository({ findById: invoice });
    const mockEventBus = createMockEventBus();
    const useCase = new ApproveInvoiceUseCase(mockRepo, mockEventBus, mockAuditor);

    // Act
    const result = await useCase.execute({ invoiceId: invoice.getId(), approverId: 'u1' });

    // Assert
    expect(result.isOk()).toBe(true);
    expect(mockEventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'invoice.approved',
    }));
  });
});
```

- **Factories** (`createInvoice`, `createUser`, `createAuditEvent`, …) keep tests DRY and readable.
- **Domain tests** have zero framework imports — pure TypeScript classes only.
- **Coverage target:** 80% lines, 90% branches on the domain layer.

---

## Roles and permissions

| Role | Capabilities |
|---|---|
| **uploader** | Upload invoices · View own invoices · Review extracted data · Send own invoices to validation |
| **validator** | Everything above + View all invoices · Add notes · Send any invoice to approval |
| **approver** | Everything above + Approve or reject invoices |
| **admin** | Everything + Manage users · Create/delete accounts · Assignment management |

Cross-ownership rule: whoever sends an invoice to `READY_FOR_VALIDATION` (`validatorId` stored on the invoice) cannot also send it to `READY_FOR_APPROVAL` — unless they are admin.

---

## Invoice workflow

```
PENDING → PROCESSING → EXTRACTED
                            │
                            ├── VALIDATION_FAILED          (business rules not met)
                            │         └── PROCESSING        (validator retries)
                            │
                            └── READY_FOR_VALIDATION
                                        │
                                        └── READY_FOR_APPROVAL
                                                    │
                                                    ├── APPROVED
                                                    └── REJECTED
                                                              └── READY_FOR_APPROVAL (resubmit)
```

- Every transition is validated by the `Invoice` aggregate root and returns a typed `Result`.
- Every transition is persisted in `invoice_events` (immutable history).
- Every manual transition fires a domain event via `EventBusPort` → persisted in `outbox_events` → picked up by `OutboxPollerWorker` → dispatched to the matching handler → email sent via Resend.
