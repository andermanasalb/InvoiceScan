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
| admin     | Todo + gestionar usuarios, proveedores y configuración          |

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
│       │   ├── entities/        ← Objetos de negocio puros
│       │   ├── value-objects/   ← InvoiceAmount, TaxId, InvoiceStatus...
│       │   ├── repositories/    ← Interfaces (contratos), no implementaciones
│       │   ├── services/        ← Lógica de negocio pura
│       │   └── errors/          ← Errores de dominio tipados
│       │
│       ├── application/         ← Casos de uso. Orquesta dominio. Sin HTTP ni DB.
│       │   ├── use-cases/       ← Un archivo por caso de uso
│       │   ├── dtos/            ← Input/Output DTOs con Zod
│       │   └── ports/           ← Interfaces para servicios externos (email, ocr, llm...)
│       │
│   ├── infrastructure/      ← Todo lo externo: DB, email, OCR, LLM, colas, HTTP
│   │   ├── db/              ← TypeORM entities, migrations, repositories impl.
│   │   ├── ocr/             ← TesseractAdapter
│   │   ├── llm/             ← AIStudioAdapter (implementación de LLMPort)
│   │   ├── queue/           ← BullMQ producers y workers
│   │   ├── email/           ← NodemailerAdapter
│   │   └── storage/         ← LocalStorageAdapter, S3Adapter
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
└── frontend/                    ← React + Next.js (App Router) application
```

El paquete `shared` es la fuente de verdad para tipos y schemas Zod: se define una vez y se consume tanto en backend (validación) como en frontend (formularios), eliminando desincronización.

### Regla de dependencias (NUNCA violar)


domain ← application ← infrastructure
domain ← application ← interface
text

- `domain` no importa nada del proyecto.
- `application` importa solo `domain`.
- `infrastructure` e `interface` importan `application` y `domain`.
- **NUNCA** importar infrastructure desde domain o application.

---

## 🧪 Testing: TDD obligatorio

### Pirámide de tests


text
     ┌───────┐
     │  E2E  │  ← 10% (flujos críticos completos)
    ─┤───────├─
   ─ │  INT  │  ← 30% (repos reales, colas, HTTP)
  ─  ├───────┤
─    │ UNIT  │  ← 60% (dominio + use cases, todo mockeado)

─────────└───────┘
text

### Flujo TDD (Red → Green → Refactor)


Escribe el test que describe el comportamiento esperado → FALLA (Red)
Escribe el mínimo código para que pase → PASA (Green)
Refactoriza sin romper el test (Refactor)
Commit
text

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

Reglas de testing
Cobertura mínima: 80% líneas, 90% branches en dominio.
Tests de dominio: sin mocks de frameworks (puro TypeScript).
Tests de use-cases: mockear repositories e interfaces.
Tests de infrastructure: usar base de datos real en Docker.
Tests E2E: Playwright o Supertest contra app arrancada.
Nunca testear implementación, testear comportamiento.
Un it() describe un único comportamiento o escenario. Puede tener múltiples assertions sobre ese mismo comportamiento.
Herramientas de testing
text
Unit + Integration : Vitest
E2E HTTP           : Supertest (sobre NestJS)
E2E UI             : Playwright
Mocks              : vi.fn(), vi.spyOn()
Fixtures           : factories en test/factories/
Coverage           : V8 (Vitest)

Factories de test (siempre usar)
typescript
// test/factories/invoice.factory.ts
export const createInvoice = (overrides?: Partial<Invoice>): Invoice => ({
  id: 'inv-' + randomUUID(),
  status: InvoiceStatus.PENDING,
  total: new InvoiceAmount(100),
  provider: 'generic',
  createdAt: new Date(),
  ...overrides,
});

🔒 Seguridad (OWASP Top 10 — cumplir siempre)
Autenticación y sesión
JWT con expiración corta (15min access token, 7d refresh token).
Refresh token en HttpOnly cookie (no localStorage).
Invalidación de refresh tokens en Redis (lista de revocados con TTL igual al tiempo de expiración del token). Redis ya está en el stack para BullMQ, sin coste adicional de infraestructura.
NUNCA guardar contraseñas en texto plano: bcrypt con salt rounds 12.
Rate limiting en login: máximo 5 intentos por IP por minuto.
Rate limiting en upload: máximo 20 uploads por hora por usuario (rol uploader). Sin límite para validator, approver y admin.
Autorización
RBAC (Role-Based Access Control) en cada endpoint.
Guards de NestJS verifican rol antes de llegar al controller.
Validar owner en recursos (un uploader solo ve sus propias facturas).
Principio de mínimo privilegio: cada rol solo tiene lo que necesita.
Validación de entrada (todas las entradas)
Zod valida 100% de inputs en DTOs antes del controller.
Sanitizar nombres de archivo (evitar path traversal).
Limitar tamaño de upload: máximo 10MB por PDF.
Validar tipo MIME real del archivo (no confiar en extensión).
Zod schemas como única fuente de verdad para DTOs.
Seguridad HTTP
typescript
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

Archivos subidos
Escanear virus (opcional pero valorable: ClamAV).
Servir archivos con signed URLs (nunca ruta directa).
Guardar fuera del webroot.
Generar nombre con UUID (nunca el nombre original del usuario).
Variables de entorno
NUNCA secretos en código fuente ni en git.
.env.example con todas las variables sin valores.
Validar variables al arrancar con Zod config schema.
Secret scanning activo en GitHub Actions.
Audit log
Registrar toda acción sensible: login, upload, approve, reject, delete.
Inmutable: nunca borrar audit events.
Incluir: userId, action, resourceId, ip, timestamp.
🗄️ Base de datos
Migraciones
Nunca synchronize: true en producción.
Todas las migraciones en src/infrastructure/db/migrations/.
Naming: YYYYMMDDHHMMSS_descripcion_corta.ts.
Cada migración tiene método up y down.
Probar down en local antes de hacer PR.
Patrones
Repository pattern: interfaces en domain/repositories/, implementación en infrastructure/db/.
Nunca TypeORM entities en domain. Las entities de ORM son infra.
Mappers para convertir entre ORM entity y domain entity.
Transacciones explícitas en operaciones multi-tabla.
Soft delete en lugar de hard delete en recursos importantes.
Seguridad a nivel de fila: filtros explícitos en los repositorios (`WHERE user_id = :userId`). Nunca depender de RLS de PostgreSQL con TypeORM (incompatible con connection pooling).
Índices (revisar en PR)
sql
CREATE INDEX idx_invoices_status     ON invoices(status);
CREATE INDEX idx_invoices_user_id    ON invoices(user_id);
CREATE INDEX idx_invoices_created_at ON invoices(created_at);
CREATE INDEX idx_audit_events_user_id ON audit_events(user_id);

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
  EXTRACTED           → READY_FOR_VALIDATION (uploader revisa datos de la IA y pulsa "Send to Validation" en sus propias facturas;
                                              validator/approver/admin pueden hacerlo en facturas ajenas)
  READY_FOR_VALIDATION → READY_FOR_APPROVAL  (approver/admin pulsan "Send to Approval" — no puede ser quien hizo el paso anterior, salvo admin)
  VALIDATION_FAILED   → PROCESSING           (validator/approver/admin pulsa "Retry" — re-encola job)
  REJECTED            → READY_FOR_APPROVAL   (resubmisión tras corrección del proveedor)
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
- Cada transición dispara un domain event.
🎨 Dominio: Value Objects y Entities
Value Objects (inmutables, sin id)
typescript
// Todos en domain/value-objects/
InvoiceAmount    // valida > 0, máximo 2 decimales
TaxId            // formato NIF/CIF válido
InvoiceDate      // no puede ser futuro
ProviderName     // no vacío, max 100 chars
InvoiceStatus    // enum estricto

Entities
typescript
// domain/entities/
Invoice          // aggregate root
Provider         // configuración de adapter
User             // datos mínimos (no repetir auth)
AuditEvent       // inmutable
InvoiceEvent     // historial de estados

Domain Events
typescript
// domain/events/
// Clase base: DomainEventBase { eventType, occurredAt, payload }
InvoiceUploadedEvent
InvoiceProcessedEvent
InvoiceApprovedEvent   // payload: { invoiceId, approverId, status, occurredAt }
InvoiceRejectedEvent   // payload: { invoiceId, approverId, reason, status, occurredAt }

📦 Casos de uso (uno por acción)
text
application/use-cases/
├── upload-invoice.use-case.ts
├── process-invoice.use-case.ts
├── validate-invoice.use-case.ts
├── approve-invoice.use-case.ts
├── reject-invoice.use-case.ts
├── get-invoice.use-case.ts
├── list-invoices.use-case.ts
├── export-invoices.use-case.ts
├── create-provider.use-case.ts
└── create-user.use-case.ts

Estructura de un use case
typescript
export class ApproveInvoiceUseCase {
  constructor(
    private invoiceRepo: InvoiceRepository,
    private eventBus: EventBusPort,
    private auditor: AuditPort,
  ) {}

  async execute(input: ApproveInvoiceDto): Promise<Result<Invoice, DomainError>> {
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) return Err(new InvoiceNotFoundError(input.invoiceId));

    const result = invoice.approve(input.approverId);
    if (result.isErr()) return result;

    await this.invoiceRepo.save(invoice);
    await this.eventBus.publish(new InvoiceApprovedEvent({ invoiceId: invoice.getId(), approverId: input.approverId, status: invoice.getStatus().getValue() }));
    await this.auditor.record({ action: 'approve', resourceId: invoice.getId(), userId: input.approverId });

    return Ok(invoice);
  }
}

🔄 Patrón Result<T, E> (nunca throw en dominio)
typescript
// Librería: neverthrow (estándar de facto en TypeScript)
// import { ok, err, Result, ResultAsync } from 'neverthrow';

// Uso correcto en controller
const result = await useCase.execute(input);
if (result.isErr()) {
  return errorResponse(result.error);
}
return successResponse(result.value);

🔌 Adapters de proveedores
typescript
// domain/repositories/invoice-adapter.interface.ts
export interface InvoiceAdapter {
  extract(pdfText: string): Promise<Result<ExtractedInvoiceData, ExtractionError>>;
  validate(data: ExtractedInvoiceData): ValidationResult;
}

// infrastructure/adapters/
TelefonicaAdapter   // regex específicos para facturas Telefónica
AmazonAdapter       // formato Amazon Business
GenericAdapter      // fallback: extracción via LLM (Google AI Studio, modelo a definir en Fase 7)

// application/ports/
LLMPort             // interfaz para llamadas al LLM (implementada por AIStudioAdapter)

// infrastructure/llm/
AIStudioAdapter     // implementación de LLMPort usando Google AI Studio API
                    // usa Structured Outputs para garantizar JSON tipado
                    // modelo concreto configurado via variable de entorno AISTUDIO_MODEL

Factory de adapters
typescript
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

📨 Colas y workers (BullMQ)
Colas disponibles
text
process-invoice    ← OCR + extracción + validación
outbox-poller      ← drena outbox_events y publica domain events (repeatable, cada 10s)
send-notification  ← emails async (FASE 11)
export-invoices    ← generación CSV/JSON async

Configuración obligatoria
typescript
const queue = new Queue('process-invoice', {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

Workers: idempotencia
Cada worker debe ser idempotente (procesar dos veces da mismo resultado).
Guardar jobId en DB para detectar duplicados.
DLQ: jobs fallidos tras 3 reintentos van a cola failed-jobs.

## 📬 Patrón Outbox (Transactional Outbox)

Garantiza at-least-once delivery de domain events aunque la app se caiga entre el save y la publicación del evento.

### Flujo completo

```
ApproveInvoiceUseCase / RejectInvoiceUseCase
  → invoice.approve() / invoice.reject()
  → invoiceRepo.save(invoice)           ← persiste estado nuevo
  → outboxRepo.save(outboxEvent)        ← persiste evento pendiente (T2: dos saves separados)
  → auditor.record(...)
  → Ok(...)

[cada 10s] OutboxPollerWorker (BullMQ Repeatable Job)
  → outboxRepo.findUnprocessed()
  → eventEmitter.emit(event.eventType, event)   ← in-process EventEmitter2
  → outboxRepo.markProcessed(event.id)

[FASE 9 - ahora]  InvoiceApprovedHandler / InvoiceRejectedHandler
  → logger.info('event received')       ← no-op, solo log

[FASE 11]         InvoiceApprovedHandler / InvoiceRejectedHandler
  → notifier.notifyStatusChange(...)    ← Nodemailer manda email real
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

### Archivos del patrón Outbox

```
src/domain/events/
  domain-event.base.ts             ← clase base: { eventType, occurredAt, payload }
  invoice-approved.event.ts        ← payload: { invoiceId, approverId, status }
  invoice-rejected.event.ts        ← payload: { invoiceId, approverId, reason, status }

src/application/ports/
  event-bus.port.ts                ← interface EventBusPort { publish(event: DomainEventBase): Promise<void> }

src/domain/repositories/
  outbox-event.repository.ts       ← interface: save, findUnprocessed, markProcessed

src/infrastructure/db/
  entities/outbox-event.orm-entity.ts
  repositories/outbox-event.typeorm-repository.ts
  migrations/YYYYMMDDHHMMSS_create_outbox_events.ts

src/infrastructure/events/
  outbox-event-bus.adapter.ts      ← implementa EventBusPort: guarda en outbox_events
  handlers/
    invoice-approved.handler.ts    ← @OnEvent('invoice.approved') → logger (no-op en FASE 9)
    invoice-rejected.handler.ts    ← @OnEvent('invoice.rejected') → logger (no-op en FASE 9)

src/infrastructure/notification/
  no-op-notification.adapter.ts    ← implementa NotificationPort, solo logger
  notification.module.ts

src/interface/jobs/
  outbox-poller.worker.ts          ← BullMQ Repeatable Job, cada 10s
```

### Decisiones de diseño (registradas)

| Decisión | Elección | Motivo |
|----------|----------|--------|
| Transacciones outbox | T2: dos saves separados | Suficiente por ahora. T1 (Unit of Work atómico) en FASE 13 junto con OpenTelemetry |
| Worker outbox | BullMQ Repeatable Job | Ya existe BullMQ, visible en Bull Board, con reintentos |
| EventBus in-process | `@nestjs/event-emitter` (EventEmitter2) | Ligero, suficiente para notificaciones fire-and-forget |
| Handlers email ahora | No-op (Logger) | FASE 11 implementa el handler real sin tocar use cases ni controllers |
| NotificationPort en use cases | Eliminado de ApproveInvoiceUseCase y RejectInvoiceUseCase | Los use cases solo conocen EventBusPort. La notificación es responsabilidad del handler |
📡 API REST: convenciones
Endpoints
text
POST   /api/v1/invoices/upload                  ← subir PDF
GET    /api/v1/invoices                         ← listar (filtros + paginación)
GET    /api/v1/invoices/:id                     ← detalle
PATCH  /api/v1/invoices/:id/send-to-approval    ← validator envía a aprobación (EXTRACTED → READY_FOR_APPROVAL)
PATCH  /api/v1/invoices/:id/retry               ← validator reintenta (VALIDATION_FAILED → PROCESSING)
PATCH  /api/v1/invoices/:id/approve             ← aprobar
PATCH  /api/v1/invoices/:id/reject              ← rechazar
GET    /api/v1/invoices/:id/events              ← historial de estados
GET    /api/v1/invoices/:id/notes               ← listar notas
POST   /api/v1/invoices/:id/notes               ← añadir nota (validator/approver/admin)
POST   /api/v1/invoices/export                  ← encola job de export, devuelve { jobId }
GET    /api/v1/exports/:jobId/status            ← polling: { status, progress, downloadUrl }
POST   /api/v1/providers                        ← crear proveedor (admin)
GET    /api/v1/providers                        ← listar proveedores
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/health                           ← health check
GET    /api/v1/metrics                          ← métricas Prometheus

Formato de respuesta (siempre)
typescript
// Éxito
{
  "data": { ... },
  "meta": { "page": 1, "total": 45 }  // en listas
}

// Error
{
  "error": {
    "code": "INVOICE_NOT_FOUND",
    "message": "Invoice inv-123 not found",
    "details": { ... }                 // solo en dev
  }
}

Paginación (obligatoria en listas)
text
GET /api/v1/invoices?page=1&limit=20&status=pending&sort=createdAt:desc

📊 Observabilidad (OpenTelemetry)
Tres pilares
typescript
// 1. Traces → qué pasó y cuánto tardó
span.setAttribute('invoice.id', invoiceId);
span.setAttribute('invoice.provider', provider);

// 2. Metrics → cuántas veces y qué números
invoices_processed_total.inc({ status: 'success' });
ocr_duration_seconds.observe(duration);

// 3. Logs → mensajes estructurados
logger.info('Invoice approved', {
  invoiceId,
  approverId,
  duration: elapsed,
  traceId: span.spanContext().traceId,
});

Logger estructurado (siempre JSON en producción)
typescript
// Nunca console.log en el código. Siempre this.logger.
this.logger.info('message',  { context: 'InvoiceService', ...metadata });
this.logger.error('message', { error: err.message, stack: err.stack });
this.logger.warn('message',  { ... });

🔧 Configuración y variables de entorno
Schema de validación (obligatorio al arrancar)
typescript
// shared/config/config.schema.ts
const ConfigSchema = z.object({
  NODE_ENV:              z.enum(['development', 'test', 'production']),
  PORT:                  z.coerce.number().default(3000),
  DATABASE_URL:          z.string().url(),
  REDIS_URL:             z.string().url(),
  JWT_SECRET:            z.string().min(32),
  JWT_REFRESH_SECRET:    z.string().min(32),
  FRONTEND_URL:          z.string().url(),
  SMTP_HOST:             z.string(),
  SMTP_PORT:             z.coerce.number(),
  SMTP_USER:             z.string(),
  SMTP_PASS:             z.string(),
  MAX_UPLOAD_SIZE_MB:    z.coerce.number().default(10),
  GOOGLE_VISION_API_KEY: z.string().optional(),
  AISTUDIO_API_KEY:      z.string().optional(),
  AISTUDIO_MODEL:        z.string().optional(),  // modelo concreto a definir en Fase 7
});

Variables (.env.example)
text
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/invoicescan
REDIS_URL=redis://localhost:6379
JWT_SECRET=                    # min 32 chars
JWT_REFRESH_SECRET=            # min 32 chars, diferente al anterior
FRONTEND_URL=http://localhost:5173
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAX_UPLOAD_SIZE_MB=10
GOOGLE_VISION_API_KEY=         # opcional
AISTUDIO_API_KEY=              # opcional, requerido para GenericAdapter (LLM fallback)
AISTUDIO_MODEL=                # modelo de AI Studio a usar (definir en Fase 7)

🐳 Docker Compose (desarrollo local)
text
# docker-compose.yml
services:
  app:
    build: .
    ports: ["3000:3000"]
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgresql://user:pass@postgres:5432/invoicescan
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

🔁 Git: convenciones
Branching
text
main         ← solo merges desde develop con PR aprobado
develop      ← integración
feature/xxx  ← nueva feature
fix/xxx      ← bugfix
chore/xxx    ← setup, deps, config
test/xxx     ← solo tests
refactor/xxx ← refactoring sin cambio funcional

Commits (Conventional Commits)
text
feat(invoices): add OCR extraction with Tesseract
fix(auth): refresh token not invalidated on logout
test(domain): add InvoiceAmount value object tests
chore(docker): update postgres to 16-alpine
refactor(use-cases): extract validation to domain service
docs(readme): add architecture diagram

Pull Request checklist
text
[ ] Tests pasan (unit + integration)
[ ] Cobertura no baja de 80%
[ ] Sin secretos en código
[ ] Migraciones tienen down()
[ ] Logger en lugar de console.log
[ ] Variables de entorno documentadas en .env.example
[ ] README actualizado si cambia funcionalidad

⚡ CI/CD: GitHub Actions
text
# .github/workflows/ci.yml
jobs:
  quality:
    steps:
      - lint           # ESLint + Prettier
      - typecheck      # tsc --noEmit
      - test:unit
      - test:integration  # con Postgres + Redis en Docker
      - coverage          # falla si < 80%
      - secret-scan       # Gitleaks
      - audit             # npm audit --audit-level=high
      - build             # asegura que compila

  e2e:
    needs: quality
    steps:
      - docker compose up -d
      - test:e2e          # Playwright
      - docker compose down

📐 Principios de código (SOLID)
PrincipioAplicación en este proyecto
S — Single Responsibility
Un use case, una acción. Un adapter, un proveedor.
O — Open/Closed
Añadir proveedor = nuevo adapter, no modificar existentes.
L — Liskov
Todos los adapters intercambiables vía InvoiceAdapter.
I — Interface Segregation
InvoiceAdapter solo tiene extract() y validate().
D — Dependency Inversion
Use cases dependen de interfaces, no de TypeORM.
Reglas adicionales
DRY: si copias código dos veces, extrae utilidad.
KISS: la solución más simple que funciona.
YAGNI: no añadir funcionalidad que no se necesita ahora.
Fail fast: validar inputs al principio, nunca al final.
Immutability: preferir objetos inmutables en dominio.
🚫 Prohibido (nunca hacer)
text
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

✅ Checklist antes de cada commit
text
[ ] Tests pasan          : npm run test
[ ] Lint pasa            : npm run lint
[ ] TypeScript sin errores: npm run typecheck
[ ] Ningún console.log nuevo
[ ] Ningún secret en código
[ ] Sin import de infra desde domain/application
[ ] Factories usadas en tests (no objetos inline)
[ ] Variables de entorno nuevas documentadas

🗂️ Stack técnico
```
Backend   : @nestjs/core, @nestjs/typeorm, typeorm, pg, bullmq, ioredis,
            tesseract.js, nodemailer, zod, neverthrow, jsonwebtoken,
            bcrypt, helmet, winston, @opentelemetry/sdk-node

Frontend  : next.js (App Router), react 19, typescript,
            @tanstack/react-query, axios, zod, react-hook-form,
            shadcn/ui, tailwindcss v4, framer-motion,
            recharts, react-dropzone, sonner

Testing   : vitest, supertest, @playwright/test
```
Las versiones concretas se gestionan en `package.json`. Usar siempre la última versión estable de cada librería.

📋 Fases de desarrollo
text
FASE 0  : Setup + Docker                      (1h)   ✅
FASE 1  : Domain entities + value objects + CI básico  (3h) ← TDD  ✅
FASE 2  : Use cases con mocks                 (3h) ← TDD  ✅
FASE 3  : DB migrations + repositories        (2h)   ✅
FASE 4  : Upload PDFs + storage               (2h)   ✅
FASE 5  : OCR Tesseract + parsing             (3h)   ✅
FASE 6  : Colas BullMQ + workers + Bull Board (3h)   ✅
FASE 7  : Adapters por proveedor              (3h)   ✅
FASE 8  : Auth JWT + roles + guards           (3h)   ✅
FASE 9  : Controllers HTTP + Zod pipes + EventBus + Outbox  (4h)  ✅
FASE 10 : Frontend React                      (5h)   ✅ (parcial)
            → Next.js App Router + shadcn/ui + TanStack Query
            → Dashboard, invoice list/detail, upload, login
            → Role-aware UI y workflow actions
            → Pendiente: providers page, users page, export UI,
              provider selector en upload, mobile responsive
FASE 11 : Emails Nodemailer                   (2h)
            → Solo cambiar InvoiceApprovedHandler / InvoiceRejectedHandler
            → NodemailerAdapter implementa NotificationPort
            → Use cases y controllers NO se tocan
FASE 12 : Export CSV/JSON                     (1h)
FASE 13 : Observabilidad OpenTelemetry        (3h)
            → Unit of Work atómico (T1): invoice + outbox en misma transacción
FASE 14 : E2E Playwright + CI completo        (2h)
FASE 15 : Docker Compose completo + deploy    (2h)

🎯 Definición de "hecho" (DoD)
Una feature está HECHA cuando:
text
✅ Tests unitarios del dominio/use-case
✅ Test de integración del endpoint/worker
✅ Cobertura no baja de 80%
✅ Sin vulnerabilidades npm audit level high
✅ Logger estructurado (no console.log)
✅ Variables de entorno documentadas
✅ Migración con up() y down() si toca DB
✅ README actualizado
✅ CI verde en GitHub Actions
