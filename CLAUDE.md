# InvoiceScan — CLAUDE.md

> Este documento es la fuente de verdad del proyecto.
> Léelo entero antes de generar cualquier código.
> Nunca te salgas de las convenciones aquí definidas.

---

## 🎯 Qué es este proyecto

`invoice-flow` es una plataforma de automatización de facturas que:

1. Recibe PDFs de facturas por upload.
2. Extrae datos automáticamente (OCR + LLM).
3. Valida datos contra reglas de negocio por proveedor.
4. Gestiona un workflow de aprobación multi-rol.
5. Exporta datos validados (CSV, JSON).
6. Notifica por email en cada transición de estado.

**No es un proyecto de demo.** Está construido con estándares
de producción desde el día 1: TDD, Clean Architecture, seguridad,
observabilidad y CI/CD.

---

## 👥 Roles y permisos

| Rol       | Puede hacer                                                     |
|-----------|-----------------------------------------------------------------|
| uploader  | Subir facturas, ver sus propias facturas, revisar datos extraídos y enviar a validación (sus propias facturas) |
| validator | Ver todas las facturas, añadir notas, enviar a validación (facturas ajenas en EXTRACTED), enviar a aprobación |
| approver  | Todo lo anterior + aprobar o rechazar facturas                  |
| admin     | Todo + gestionar usuarios y configuración                       |

---

## 🏗️ Arquitectura: Monorepo (pnpm workspaces) + Clean Architecture

Estructura de monorepo:

```
packages/
├── shared/                      ← Tipos, DTOs Zod y contratos compartidos (backend + frontend)
│
├── backend/                     ← NestJS application
│   └── src/
│       ├── domain/              ← Núcleo. Sin dependencias externas. NUNCA importa infra.
│       │   ├── entities/        ← Invoice, User, AuditEvent, InvoiceEvent
│       │   ├── value-objects/   ← InvoiceAmount, TaxId, InvoiceDate, InvoiceStatus
│       │   ├── repositories/    ← Interfaces (contratos), no implementaciones
│       │   ├── events/          ← DomainEventBase, InvoiceApprovedEvent, InvoiceRejectedEvent, ...
│       │   └── errors/          ← Errores de dominio tipados
│       │
│       ├── application/         ← Casos de uso. Orquesta dominio. Sin HTTP ni DB.
│       │   ├── use-cases/       ← Un archivo por caso de uso
│       │   ├── dtos/            ← Input/Output DTOs con Zod
│       │   └── ports/           ← Interfaces para servicios externos (email, ocr, llm, eventbus...)
│       │
│       ├── infrastructure/      ← Todo lo externo: DB, email, OCR, LLM, colas, almacenamiento
│       │   ├── db/              ← TypeORM entities, migrations, repositories impl., mappers
│       │   ├── adapters/        ← TelefonicaAdapter, AmazonAdapter, GenericAdapter (LLM fallback)
│       │   ├── ocr/             ← TesseractAdapter, PdfParseAdapter
│       │   ├── llm/             ← AIStudioAdapter (implementación de LLMPort)
│       │   ├── queue/           ← BullMQ producers
│       │   ├── events/          ← OutboxEventBusAdapter, handlers de domain events
│       │   ├── notification/    ← ResendAdapter (implementa NotificationPort)
│       │   └── storage/         ← LocalStorageAdapter
│       │
│       ├── interface/           ← NestJS controllers, guards, pipes, interceptors
│       │   ├── http/
│       │   │   ├── controllers/
│       │   │   ├── guards/
│       │   │   ├── interceptors/
│       │   │   └── pipes/
│       │   └── jobs/            ← Workers BullMQ que delegan a use-cases
│       │
│       └── shared/              ← Logger, config, tipos globales, utilidades puras
│           ├── config/
│           ├── errors/
│           ├── logger/
│           └── types/
│
└── frontend/                    ← Next.js 15 (App Router) + React 19 application
```

El paquete `shared` es la fuente de verdad para tipos y schemas Zod: se define una vez y se consume tanto en backend (validación) como en frontend (formularios), eliminando desincronización.

### Regla de dependencias (NUNCA violar)

```
domain ← application ← infrastructure
domain ← application ← interface
```

- `domain` no importa nada del proyecto.
- `application` importa solo `domain`.
- `infrastructure` e `interface` importan `application` y `domain`.
- **NUNCA** importar infrastructure desde domain o application.

---

## 🧪 Testing: TDD obligatorio

### Pirámide de tests

```
     ┌───────┐
     │  E2E  │  ← ~40 tests HTTP (Vitest + Supertest)
    ─┤───────├─
   ─ │  INT  │  ← ~29 tests (repos TypeORM reales contra PostgreSQL en Docker)
  ─  ├───────┤
─    │ UNIT  │  ← ~328 tests (dominio + use cases + infra, todo mockeado)
─────────└───────┘
```

**Estado actual:** 40 archivos de test, 328 tests unitarios pasando.

### Flujo TDD (Red → Green → Refactor)

```
Escribe el test que describe el comportamiento esperado → FALLA (Red)
Escribe el mínimo código para que pase → PASA (Green)
Refactoriza sin romper el test (Refactor)
Commit
```

### Estructura de cada test

```typescript
// Patrón: Arrange / Act / Assert (AAA)
describe('InvoiceService', () => {
  describe('extractData', () => {
    it('should return structured data when PDF is valid', async () => {
      // Arrange
      const mockOCR = createMockOCRAdapter();
      const service = new InvoiceService(mockOCR);
      const pdfBuffer = Buffer.from('fake-pdf');

      // Act
      const result = await service.extractData(pdfBuffer);

      // Assert
      expect(result.isOk()).toBe(true);
      expect(result.value.total).toBeGreaterThan(0);
    });
  });
});
```

### Reglas de testing

- Cobertura mínima: 80% líneas, 90% branches en dominio.
- Tests de dominio: sin mocks de frameworks (puro TypeScript).
- Tests de use-cases: mockear repositories e interfaces.
- Tests de infrastructure: usar base de datos real en Docker.
- Tests E2E: Vitest + Supertest contra app NestJS arrancada en proceso.
- Nunca testear implementación, testear comportamiento.
- Un `it()` describe un único comportamiento o escenario. Puede tener múltiples assertions sobre ese mismo comportamiento.

### Herramientas de testing

```
Unit + Integration + E2E HTTP : Vitest + Supertest (sobre NestJS)
Mocks                          : vi.fn(), vi.spyOn()
Fixtures                       : factories en src/domain/test/factories/
Coverage                       : V8 (Vitest)
```

### Factories de test (siempre usar)

```typescript
// src/domain/test/factories/invoice.factory.ts
export const createInvoice = (overrides?: Partial<...>): Invoice => ...

// Factories disponibles:
// createInvoice, createUser, createAuditEvent, createInvoiceEvent, createExtractedData
```

---

## 🔒 Seguridad (OWASP Top 10 — cumplir siempre)

### Autenticación y sesión

- JWT con expiración corta (15min access token, 7d refresh token).
- Refresh token en HttpOnly cookie (no localStorage).
- Invalidación de refresh tokens en Redis (lista de revocados con TTL igual al tiempo de expiración del token).
- NUNCA guardar contraseñas en texto plano: bcrypt con salt rounds 12.
- Rate limiting en login: máximo 5 intentos por IP por minuto.
- Rate limiting en upload: máximo 20 uploads por hora por usuario (rol uploader). Sin límite para validator, approver y admin.

### Autorización

- RBAC (Role-Based Access Control) en cada endpoint.
- Guards de NestJS verifican rol antes de llegar al controller.
- Validar owner en recursos (un uploader solo ve sus propias facturas).
- Principio de mínimo privilegio: cada rol solo tiene lo que necesita.

### Validación de entrada (todas las entradas)

- Zod valida 100% de inputs en DTOs antes del controller.
- Sanitizar nombres de archivo (evitar path traversal).
- Limitar tamaño de upload: máximo 10MB por PDF.
- Validar tipo MIME real del archivo (no confiar en extensión).
- Zod schemas como única fuente de verdad para DTOs.

### Seguridad HTTP

```typescript
// Cabeceras obligatorias (Helmet en NestJS)
app.use(helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } },
  hsts: { maxAge: 31536000 },
  noSniff: true,
  xssFilter: true,
}));

// CORS restringido
app.enableCors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
});
```

### Archivos subidos

- Servir archivos con signed URLs (nunca ruta directa).
- Guardar fuera del webroot.
- Generar nombre con UUID (nunca el nombre original del usuario).

### Variables de entorno

- NUNCA secretos en código fuente ni en git.
- `.env.example` con todas las variables sin valores.
- Validar variables al arrancar con Zod config schema.
- Secret scanning activo en GitHub Actions.

### Audit log

- Registrar toda acción sensible: login, upload, approve, reject, delete.
- Inmutable: nunca borrar audit events.
- Incluir: userId, action, resourceId, ip, timestamp.

---

## 🗄️ Base de datos

### Migraciones

- Nunca `synchronize: true` en producción.
- Todas las migraciones en `src/infrastructure/db/migrations/`.
- Naming: `YYYYMMDDHHMMSS_descripcion_corta.ts`.
- Cada migración tiene método `up` y `down`.
- Probar `down` en local antes de hacer PR.

### Patrones

- Repository pattern: interfaces en `domain/repositories/`, implementación en `infrastructure/db/`.
- Nunca TypeORM entities en domain. Las entities de ORM son infra.
- Mappers para convertir entre ORM entity y domain entity.
- Transacciones explícitas en operaciones multi-tabla.
- Soft delete en lugar de hard delete en recursos importantes.
- Seguridad a nivel de fila: filtros explícitos en los repositorios (`WHERE user_id = :userId`).

### Índices

```sql
CREATE INDEX idx_invoices_status      ON invoices(status);
CREATE INDEX idx_invoices_user_id     ON invoices(user_id);
CREATE INDEX idx_invoices_created_at  ON invoices(created_at);
CREATE INDEX idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX idx_outbox_events_processed ON outbox_events(processed) WHERE processed = false;
```

### Tabla `providers`

La tabla `providers` existe en la DB y tiene un FK desde `invoices.provider_id`.
**No hay CRUD de providers expuesto**: el diseño actual siempre usa el proveedor genérico
(insertado en seed). La selección automática de proveedor por OCR/LLM es trabajo futuro.

- `ProviderOrmEntity` se mantiene en TypeORM para resolver el `@ManyToOne` en `InvoiceOrmEntity`.
- No hay `Provider` domain entity, ni repositorio de dominio, ni use case de providers.
- `GENERIC_PROVIDER_ID` está en `packages/shared` y el frontend lo hardcodea al hacer upload.

---

## 🚦 Estados del workflow (máquina de estados)

```
PENDING
  → PROCESSING                               (job OCR encolado automáticamente)
      → EXTRACTED                            (OCR completado — el worker SE DETIENE AQUÍ)
            → VALIDATION_FAILED              (datos no pasan reglas de negocio del adapter)
            → READY_FOR_VALIDATION           (uploader o validator/approver/admin envían manualmente)
                  → READY_FOR_APPROVAL       (approver/admin envían manualmente)
                        → APPROVED           (approver aprueba)
                        → REJECTED           (approver rechaza)

Transiciones manuales:
  EXTRACTED            → READY_FOR_VALIDATION  (uploader en sus propias facturas; validator/approver/admin en cualquiera)
  READY_FOR_VALIDATION → READY_FOR_APPROVAL    (approver/admin — no puede ser quien hizo el paso anterior, salvo admin)
  VALIDATION_FAILED    → PROCESSING            (validator/approver/admin pulsa "Retry" — re-encola job)
  REJECTED             → READY_FOR_APPROVAL    (resubmisión tras corrección)
```

> **IMPORTANTE:** El worker `process-invoice` se detiene en `EXTRACTED`. El uploader
> revisa los datos extraídos por la IA y pulsa "Send to Validation" para iniciar el
> workflow de revisión humana. La transición `EXTRACTED → READY_FOR_VALIDATION` es
> una acción humana explícita vía `PATCH /api/v1/invoices/:id/send-to-validation`.
>
> **Regla cross-ownership:** quien mueve la factura a `READY_FOR_VALIDATION` (almacenado
> como `validatorId`) NO puede también moverla a `READY_FOR_APPROVAL`, salvo que sea admin.

### Reglas de transición

- Solo transiciones válidas del diagrama arriba.
- Cualquier transición inválida lanza `InvalidStateTransitionError`.
- Guardar historial completo de transiciones en `invoice_events`.
- Cada transición dispara un domain event via Outbox.

---

## 🎨 Dominio: Value Objects y Entities

### Value Objects (inmutables, sin id)

```typescript
// Todos en domain/value-objects/
InvoiceAmount    // valida > 0, máximo 2 decimales
TaxId            // formato NIF/CIF válido
InvoiceDate      // no puede ser futuro
InvoiceStatus    // enum estricto
```

### Entities

```typescript
// domain/entities/
Invoice          // aggregate root
User             // datos mínimos (no repetir auth)
AuditEvent       // inmutable
InvoiceEvent     // historial de estados
```

### Domain Events

```typescript
// domain/events/
// Clase base: DomainEventBase { eventType, occurredAt, payload }
InvoiceUploadedEvent
InvoiceProcessedEvent
InvoiceSentForValidationEvent
InvoiceSentForApprovalEvent
InvoiceApprovedEvent    // payload: { invoiceId, approverId, status, occurredAt }
InvoiceRejectedEvent    // payload: { invoiceId, approverId, reason, status, occurredAt }
```

---

## 📦 Casos de uso (uno por acción)

```
application/use-cases/
├── upload-invoice.use-case.ts
├── process-invoice.use-case.ts
├── approve-invoice.use-case.ts
├── reject-invoice.use-case.ts
├── send-invoice-for-validation.use-case.ts
├── send-invoice-for-approval.use-case.ts
├── retry-invoice.use-case.ts
├── get-invoice.use-case.ts
├── list-invoices.use-case.ts
├── get-invoice-events.use-case.ts
├── get-invoice-notes.use-case.ts
├── add-invoice-note.use-case.ts
├── export-invoices.use-case.ts
├── get-export-status.use-case.ts
├── login.use-case.ts
├── refresh-token.use-case.ts
├── logout.use-case.ts
└── create-user.use-case.ts
```

### Estructura de un use case

```typescript
export class ApproveInvoiceUseCase {
  constructor(
    private invoiceRepo: InvoiceRepository,
    private eventBus: EventBusPort,
    private auditor: AuditPort,
  ) {}

  async execute(input: ApproveInvoiceDto): Promise<Result<Invoice, DomainError>> {
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) return err(new InvoiceNotFoundError(input.invoiceId));

    const result = invoice.approve(input.approverId);
    if (result.isErr()) return result;

    await this.invoiceRepo.save(invoice);
    await this.eventBus.publish(new InvoiceApprovedEvent({ ... }));
    await this.auditor.record({ action: 'approve', ... });

    return ok(invoice);
  }
}
```

---

## 🔄 Patrón Result<T, E> (nunca throw en dominio)

```typescript
// Librería: neverthrow
import { ok, err, Result } from 'neverthrow';

// Uso correcto en controller
const result = await useCase.execute(input);
if (result.isErr()) {
  throw new DomainErrorException(result.error);
}
return result.value;
```

---

## 🔌 Adapters de proveedores

```typescript
// domain/ports/invoice-adapter.interface.ts
export interface InvoiceAdapter {
  extract(pdfText: string): Promise<Result<ExtractedInvoiceData, ExtractionError>>;
  validate(data: ExtractedInvoiceData): ValidationResult;
}

// infrastructure/adapters/
TelefonicaAdapter   // regex específicos para facturas Telefónica
AmazonAdapter       // formato Amazon Business
GenericAdapter      // fallback: extracción via LLM (Google AI Studio)

// application/ports/
LLMPort             // interfaz para llamadas al LLM (implementada por AIStudioAdapter)

// infrastructure/llm/
AIStudioAdapter     // implementación de LLMPort usando Google AI Studio API
                    // usa Structured Outputs para garantizar JSON tipado
                    // modelo configurado via variable de entorno AISTUDIO_MODEL
```

### Factory de adapters

```typescript
// infrastructure/adapters/adapter.factory.ts
export class AdapterFactory {
  create(providerName: string): InvoiceAdapter {
    const adapters: Record<string, InvoiceAdapter> = {
      telefonica: new TelefonicaAdapter(),
      amazon: new AmazonAdapter(),
    };
    return adapters[providerName] ?? new GenericAdapter();
  }
}
```

---

## 📨 Colas y workers (BullMQ)

### Colas disponibles

```
process-invoice    ← OCR + extracción + validación
outbox-poller      ← drena outbox_events y publica domain events (repeatable, cada 10s)
export-invoices    ← generación CSV/JSON async
```

### Configuración obligatoria

```typescript
const queue = new Queue('process-invoice', {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});
```

### Workers: idempotencia

- Cada worker debe ser idempotente (procesar dos veces da mismo resultado).
- Guardar jobId en DB para detectar duplicados.
- DLQ: jobs fallidos tras 3 reintentos van a cola `failed-jobs`.

---

## 📬 Patrón Outbox (Transactional Outbox)

Garantiza at-least-once delivery de domain events aunque la app se caiga entre el save y la publicación del evento.

### Flujo completo

```
ApproveInvoiceUseCase / RejectInvoiceUseCase
  → invoice.approve() / invoice.reject()
  → invoiceRepo.save(invoice)           ← persiste estado nuevo
  → outboxRepo.save(outboxEvent)        ← persiste evento pendiente (T2: dos saves separados)
  → auditor.record(...)
  → ok(...)

[cada 10s] OutboxPollerWorker (BullMQ Repeatable Job)
  → outboxRepo.findUnprocessed()
  → eventEmitter.emit(event.eventType, event)   ← in-process EventEmitter2
  → outboxRepo.markProcessed(event.id)

InvoiceApprovedHandler / InvoiceRejectedHandler / ...
  → notifier.notifyStatusChange(...)    ← ResendAdapter manda email real
```

### Tabla `outbox_events`

```sql
outbox_events
  id            UUID        PK
  event_type    VARCHAR     ← 'invoice.approved' | 'invoice.rejected' | ...
  payload       JSONB       ← evento serializado completo
  processed     BOOLEAN     DEFAULT false
  created_at    TIMESTAMP
  processed_at  TIMESTAMP   NULLABLE

CREATE INDEX idx_outbox_events_processed ON outbox_events(processed) WHERE processed = false;
```

### Decisiones de diseño (registradas)

| Decisión | Elección | Motivo |
|----------|----------|--------|
| Transacciones outbox | T2: dos saves separados | Suficiente. T1 atómico pendiente junto con OpenTelemetry |
| Worker outbox | BullMQ Repeatable Job | Ya existe BullMQ, visible en Bull Board, con reintentos |
| EventBus in-process | `@nestjs/event-emitter` (EventEmitter2) | Ligero, suficiente para notificaciones fire-and-forget |
| Email provider | Resend (ResendAdapter) | API simple, fiable, sin SMTP propio |
| NotificationPort en use cases | Eliminado | Los use cases solo conocen EventBusPort. La notificación es responsabilidad del handler |

---

## 📡 API REST: convenciones

### Endpoints implementados

```
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout

POST   /api/v1/invoices/upload                      ← subir PDF
GET    /api/v1/invoices                             ← listar (filtros + paginación)
GET    /api/v1/invoices/:id                         ← detalle
PATCH  /api/v1/invoices/:id/send-to-validation      ← EXTRACTED → READY_FOR_VALIDATION
PATCH  /api/v1/invoices/:id/send-to-approval        ← READY_FOR_VALIDATION → READY_FOR_APPROVAL
PATCH  /api/v1/invoices/:id/retry                   ← VALIDATION_FAILED → PROCESSING
PATCH  /api/v1/invoices/:id/approve                 ← aprobar
PATCH  /api/v1/invoices/:id/reject                  ← rechazar
GET    /api/v1/invoices/:id/events                  ← historial de estados
GET    /api/v1/invoices/:id/notes                   ← listar notas
POST   /api/v1/invoices/:id/notes                   ← añadir nota (validator/approver/admin)
POST   /api/v1/invoices/export                      ← encola job, devuelve { jobId }
GET    /api/v1/exports/:jobId/status                ← polling: { status, progress, downloadUrl }

POST   /api/v1/users                                ← crear usuario (admin)
GET    /api/v1/users                                ← listar usuarios (admin)

GET    /api/v1/health                               ← health check
GET    /api/v1/metrics                              ← métricas Prometheus (OpenTelemetry)
```

### Formato de respuesta (siempre)

```typescript
// Éxito
{ "data": { ... }, "meta": { "page": 1, "total": 45 } }  // meta solo en listas

// Error
{ "error": { "code": "INVOICE_NOT_FOUND", "message": "Invoice inv-123 not found" } }
```

### Paginación (obligatoria en listas)

```
GET /api/v1/invoices?page=1&limit=20&status=pending&sort=createdAt:desc
```

---

## 📊 Observabilidad (OpenTelemetry + SigNoz)

### Tres pilares

```typescript
// 1. Traces → qué pasó y cuánto tardó
span.setAttribute('invoice.id', invoiceId);

// 2. Metrics → cuántas veces y qué números
invoices_processed_total.inc({ status: 'success' });

// 3. Logs → mensajes estructurados (nunca console.log)
this.logger.info('Invoice approved', { invoiceId, approverId, traceId });
```

### Logger estructurado (siempre JSON en producción)

```typescript
// Nunca console.log en el código. Siempre this.logger.
this.logger.info('message',  { context: 'InvoiceService', ...metadata });
this.logger.error('message', { error: err.message, stack: err.stack });
this.logger.warn('message',  { ... });
```

---

## 🔧 Configuración y variables de entorno

### Schema de validación (obligatorio al arrancar)

```typescript
// src/shared/config/env.schema.ts
const EnvSchema = z.object({
  NODE_ENV:              z.enum(['development', 'test', 'production']),
  PORT:                  z.coerce.number().default(3000),
  DATABASE_URL:          z.string().url(),
  REDIS_URL:             z.string().url(),
  JWT_SECRET:            z.string().min(32),
  JWT_REFRESH_SECRET:    z.string().min(32),
  FRONTEND_URL:          z.string().url(),
  RESEND_API_KEY:        z.string().optional(),
  RESEND_FROM_EMAIL:     z.string().optional(),
  MAX_UPLOAD_SIZE_MB:    z.coerce.number().default(10),
  AISTUDIO_API_KEY:      z.string().optional(),
  AISTUDIO_MODEL:        z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
});
```

### Variables (.env.example)

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/invoicescan
REDIS_URL=redis://localhost:6379
JWT_SECRET=                    # min 32 chars
JWT_REFRESH_SECRET=            # min 32 chars, diferente al anterior
FRONTEND_URL=http://localhost:3001
RESEND_API_KEY=                # opcional, requerido para emails reales
RESEND_FROM_EMAIL=             # opcional, ej: noreply@tudominio.com
MAX_UPLOAD_SIZE_MB=10
AISTUDIO_API_KEY=              # opcional, requerido para GenericAdapter (LLM fallback)
AISTUDIO_MODEL=                # modelo de AI Studio a usar
OTEL_EXPORTER_OTLP_ENDPOINT=   # opcional, ej: http://localhost:4318
```

> **CI:** Los secrets `CI_JWT_SECRET` y `CI_JWT_REFRESH_SECRET` (≥32 chars) deben crearse
> manualmente en GitHub → Settings → Secrets and variables → Actions.

---

## 🐳 Docker Compose (desarrollo local)

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports: ["3000:3000"]
    depends_on: [postgres, redis]
    volumes:
      - ./uploads:/app/uploads

  frontend:
    build: ./packages/frontend
    ports: ["3001:3001"]

  postgres:
    image: postgres:16-alpine
    volumes: [pgdata:/var/lib/postgresql/data]
    environment:
      POSTGRES_DB: invoicescan
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes: [redisdata:/data]

volumes:
  pgdata:
  redisdata:
```

---

## 🔁 Git: convenciones

### Branching

```
main         ← solo merges desde develop con PR aprobado
develop      ← integración
feature/xxx  ← nueva feature
fix/xxx      ← bugfix
chore/xxx    ← setup, deps, config
test/xxx     ← solo tests
refactor/xxx ← refactoring sin cambio funcional
```

### Commits (Conventional Commits)

```
feat(invoices): add OCR extraction with Tesseract
fix(auth): refresh token not invalidated on logout
test(domain): add InvoiceAmount value object tests
chore(docker): update postgres to 16-alpine
refactor(use-cases): extract validation to domain service
```

### Pull Request checklist

```
[ ] Tests pasan (unit + integration)
[ ] Cobertura no baja de 80%
[ ] Sin secretos en código
[ ] Migraciones tienen down()
[ ] Logger en lugar de console.log
[ ] Variables de entorno documentadas en .env.example
```

---

## ⚡ CI/CD: GitHub Actions

```yaml
# .github/workflows/ci.yml
jobs:
  quality:
    steps:
      - lint           # ESLint + Prettier
      - typecheck      # tsc --noEmit
      - test:unit      # Vitest unit tests
      - test:integration  # con Postgres + Redis en Docker
      - coverage          # falla si < 80%
      - secret-scan       # Gitleaks
      - audit             # pnpm audit --audit-level=high
      - build             # asegura que compila

  e2e:
    needs: quality
    steps:
      - docker compose up -d
      - test:e2e          # Vitest + Supertest contra app arrancada
      - docker compose down
```

---

## 📐 Principios de código (SOLID)

| Principio | Aplicación en este proyecto |
|-----------|----------------------------|
| S — Single Responsibility | Un use case, una acción. Un adapter, un proveedor. |
| O — Open/Closed | Añadir proveedor = nuevo adapter, no modificar existentes. |
| L — Liskov | Todos los adapters intercambiables vía InvoiceAdapter. |
| I — Interface Segregation | InvoiceAdapter solo tiene `extract()` y `validate()`. |
| D — Dependency Inversion | Use cases dependen de interfaces, no de TypeORM. |

### Reglas adicionales

- DRY: si copias código dos veces, extrae utilidad.
- KISS: la solución más simple que funciona.
- YAGNI: no añadir funcionalidad que no se necesita ahora.
- Fail fast: validar inputs al principio, nunca al final.
- Immutability: preferir objetos inmutables en dominio.

---

## 🚫 Prohibido (nunca hacer)

```
❌ console.log() en código de producción
❌ any en TypeScript (usa unknown + type guard)
❌ synchronize: true en TypeORM
❌ guardar secrets en código o git
❌ importar infrastructure desde domain
❌ throw en domain (usa Result<T,E>)
❌ lógica de negocio en controllers
❌ queries SQL en use cases o domain
❌ testear implementación (testea comportamiento)
❌ merge sin tests pasando
❌ rutas directas a archivos subidos
❌ refreshToken en localStorage
❌ bcrypt rounds < 10
```

---

## ✅ Checklist antes de cada commit

```
[ ] Tests pasan           : pnpm --filter backend test --run
[ ] Lint pasa             : pnpm --filter backend lint
[ ] TypeScript sin errores: pnpm --filter backend typecheck
[ ] Ningún console.log nuevo
[ ] Ningún secret en código
[ ] Sin import de infra desde domain/application
[ ] Factories usadas en tests (no objetos inline)
[ ] Variables de entorno nuevas documentadas en .env.example
```

---

## 🗂️ Stack técnico

```
Backend   : @nestjs/core, @nestjs/typeorm, typeorm, pg, bullmq, ioredis,
            tesseract.js, pdf-parse, resend, zod, neverthrow, jsonwebtoken,
            bcrypt, helmet, @opentelemetry/sdk-node

Frontend  : next.js 15 (App Router), react 19, typescript,
            @tanstack/react-query, axios, zod, react-hook-form,
            shadcn/ui, tailwindcss v4, framer-motion,
            recharts, react-dropzone, sonner

Testing   : vitest, supertest
Infra     : PostgreSQL 16, Redis 7, Docker Compose, GitHub Actions
```

Las versiones concretas se gestionan en `package.json`. Usar siempre la última versión estable de cada librería.

---

## 📋 Fases de desarrollo

```
FASE 0  : Setup + Docker + monorepo pnpm               ✅
FASE 1  : Domain entities + value objects + CI          ✅  (TDD)
FASE 2  : Use cases con mocks                           ✅  (TDD)
FASE 3  : DB migrations + TypeORM repositories          ✅
FASE 4  : Upload PDFs + LocalStorageAdapter             ✅
FASE 5  : OCR Tesseract + pdf-parse + parsing           ✅
FASE 6  : Colas BullMQ + workers + Bull Board           ✅
FASE 7  : Adapters por proveedor + AIStudioAdapter      ✅
FASE 8  : Auth JWT + roles + guards + RBAC              ✅
FASE 9  : Controllers HTTP + Zod pipes + Outbox pattern ✅
FASE 10 : Frontend Next.js 15                           ✅
            → Dashboard, invoice list/detail, upload, login
            → Role-aware UI y workflow actions completos
            → Admin users page + assignment management
            → Export UI + responsive
FASE 11 : Emails con Resend                             ✅
            → ResendAdapter implementa NotificationPort con no-op fallback
            → Handlers disparan emails en cada transición relevante
            → NotificationModule selecciona adapter según RESEND_API_KEY
FASE 12 : Export CSV/JSON async + packages/shared       ✅
            → Export CSV/JSON via BullMQ (export-invoices queue)
            → packages/shared con Zod DTOs compartidos
FASE 13 : Observabilidad OpenTelemetry + SigNoz         ✅
            → Traces, métricas, logs estructurados (pino + OTel)
            → OTEL_EXPORTER_OTLP_ENDPOINT configurable, no-op sin collector
            → Métricas: invoices_approved/rejected/processed, outbox_events, ocr_duration
FASE 14 : E2E Vitest + Supertest + CI completo          ✅
            → 375 unit tests (49 archivos, 100% passing)
            → E2E HTTP: invoices workflow, exports, auth (Vitest + Supertest)
            → Playwright UI E2E: auth, upload, invoices, workflow, dashboard
            → CI: 5 jobs (backend quality, frontend quality, integration, e2e, playwright)
            → Coverage: lines ≥80%, branches ≥72% enforced
FASE 15 : Docker Compose completo + multi-stage build   ✅
            → Backend: node:22-alpine multi-stage (deps → build → production)
            → Frontend: Next.js standalone output, node:22-alpine
            → docker compose --profile full para stack completo
            → docker compose --profile observability para SigNoz
            → Healthchecks en todos los servicios
```

### Convenciones de variables de entorno

- **Sin SMTP** — el proyecto usa Resend para emails. No hay SMTP_HOST/PORT/USER/PASS.
- **RESEND_API_KEY** opcional — sin ella, los emails son no-op (la app arranca igualmente).
- **AISTUDIO_API_KEY** opcional — sin ella, el GenericAdapter LLM está desactivado.
- **CI_JWT_SECRET / CI_JWT_REFRESH_SECRET** — deben crearse manualmente en GitHub
  Settings → Secrets and variables → Actions (mínimo 32 chars cada uno).

---

## 🎯 Definición de "hecho" (DoD)

Una feature está HECHA cuando:

```
✅ Tests unitarios del dominio/use-case
✅ Test de integración del endpoint/worker
✅ Cobertura no baja de 80%
✅ Sin vulnerabilidades pnpm audit level high
✅ Logger estructurado (no console.log)
✅ Variables de entorno documentadas
✅ Migración con up() y down() si toca DB
✅ CI verde en GitHub Actions
```
