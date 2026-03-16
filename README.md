# InvoiceScan

Plataforma de automatización de facturas construida con estándares de producción desde el día 1.

Recibe PDFs de facturas, extrae datos automáticamente (OCR + LLM), los valida contra reglas de negocio por proveedor, gestiona un workflow de aprobación multi-rol, exporta datos validados y notifica por email en cada transición de estado.

---

## Tecnologías principales

| Tecnología | Por qué la usamos |
|---|---|
| **NestJS** | Framework de Node.js con arquitectura modular que nos obliga a estructurar bien el código. Tiene inyección de dependencias nativa, lo que es clave para Clean Architecture. |
| **TypeScript** | Tipado estático que elimina errores en tiempo de compilación. En un proyecto de producción es innegociable. |
| **PostgreSQL** | Base de datos relacional robusta, open source y con soporte excelente para JSON, índices avanzados y transacciones. |
| **Redis** | Almacén de datos en memoria. Lo usamos para colas de trabajo (BullMQ) y para invalidar tokens JWT revocados. |
| **pnpm** | Gestor de paquetes más rápido y eficiente que npm. Diseñado específicamente para monorepos con workspaces. |
| **Docker** | Nos permite levantar PostgreSQL y Redis en local sin instalarlos en la máquina. Todos los desarrolladores tienen el mismo entorno. |
| **Zod** | Librería de validación con inferencia de tipos TypeScript. Define los schemas una vez y los usa tanto en backend como en frontend. |
| **neverthrow** | Implementa el patrón `Result<T, E>` para manejar errores sin usar `throw`. Hace el flujo de errores explícito y tipado. |

---

## Arquitectura

Este proyecto usa **Clean Architecture** organizada en un **monorepo con pnpm workspaces**.

### ¿Qué es Clean Architecture?

Es una forma de organizar el código en capas con una regla de dependencias estricta: las capas internas no saben nada de las externas.

```
domain ← application ← infrastructure
domain ← application ← interface
```

- **domain**: el núcleo del negocio. Sin dependencias externas. Funciona solo con TypeScript puro.
- **application**: los casos de uso. Orquesta el dominio. No sabe nada de HTTP ni de base de datos.
- **infrastructure**: todo lo externo: base de datos, email, OCR, colas, almacenamiento.
- **interface**: los controladores HTTP, guards, pipes de NestJS.

**¿Por qué hacerlo así?** Porque si mañana cambias de PostgreSQL a MongoDB, o de NestJS a Express, solo tienes que cambiar la capa de infraestructura. El dominio y los casos de uso no se tocan.

### ¿Qué es un Monorepo?

Un monorepo es un único repositorio Git que contiene múltiples proyectos relacionados. En este caso:

```
packages/
├── backend/    ← API NestJS
├── frontend/   ← App React (fase futura)
└── shared/     ← Tipos y schemas Zod compartidos (fase futura)
```

**¿Por qué un monorepo?** Porque `backend` y `frontend` comparten tipos y schemas. Si los defines una vez en `shared`, nunca se desincronizarán. Con repos separados tendrías que duplicar código o publicar paquetes npm internos.

### ¿Qué es pnpm workspaces?

Es la funcionalidad de pnpm que permite gestionar múltiples paquetes dentro del mismo repositorio. Con un solo `pnpm install` en la raíz se instalan las dependencias de todos los paquetes. Además, permite que un paquete referencie a otro interno (por ejemplo, `backend` puede importar `shared`) sin publicarlo en npm.

---

## Estructura del proyecto

```
InvoiceScan/
├── .env                    ← Variables de entorno locales (no se commitea)
├── .env.example            ← Plantilla de variables de entorno (sí se commitea)
├── .gitignore              ← Archivos ignorados por Git
├── docker-compose.yml      ← Infraestructura local (PostgreSQL + Redis)
├── package.json            ← Scripts del monorepo raíz
├── pnpm-workspace.yaml     ← Configuración de workspaces
└── packages/
    ├── backend/            ← API NestJS
    ├── frontend/           ← App React (pendiente)
    └── shared/             ← Código compartido (pendiente)
```

---

## Fases de desarrollo

### FASE 0 — Setup y configuración base

**¿Qué hicimos?**

Sentamos toda la base del proyecto antes de escribir una sola línea de lógica de negocio. El objetivo era tener un entorno de desarrollo funcional, reproducible y bien configurado.

**Pasos seguidos:**

1. **`git init` + rama `main`**
   Inicializamos el repositorio Git y nombramos la rama principal `main` (el estándar actual, antes se llamaba `master`).

2. **Estructura de monorepo con pnpm workspaces**
   Creamos `pnpm-workspace.yaml` para que pnpm sepa que hay múltiples paquetes en `packages/*`. El `package.json` raíz solo contiene scripts que delegan a los paquetes internos, no instala dependencias propias.

3. **Scaffolding de NestJS en `packages/backend`**
   Usamos el CLI oficial de NestJS (`@nestjs/cli`) con `pnpm dlx` (equivalente a `npx` pero para pnpm) para generar la estructura base del backend. El flag `--skip-git` evita que NestJS inicialice su propio repositorio Git, porque ya tenemos el nuestro en la raíz.

   ```bash
   pnpm dlx @nestjs/cli new backend --package-manager pnpm --skip-git
   ```

4. **Carpetas `shared` y `frontend` con `package.json` mínimo**
   Las creamos vacías con solo un `package.json` que las identifica como workspaces de pnpm. Así la estructura del monorepo está completa desde el día 1, aunque el código llegue en fases futuras.

5. **Docker Compose con PostgreSQL y Redis**
   En lugar de instalar PostgreSQL y Redis directamente en la máquina, los levantamos como contenedores Docker. Ventajas:
   - Cualquier persona puede reproducir el entorno con `docker compose up -d`
   - No contamina la máquina local con instalaciones globales
   - Fácil de resetear si algo va mal

   Ambos servicios tienen **healthcheck**: Docker verifica periódicamente que el servicio responde antes de considerarlo listo. Esto evita que el backend arranque antes de que la base de datos esté lista.

   Los datos persisten en **volúmenes Docker** (`pgdata`, `redisdata`). Sin volúmenes, cada vez que bajas los contenedores pierdes todos los datos.

6. **`.gitignore`**
   Define qué archivos Git debe ignorar. Lo más importante:
   - `node_modules/` — las dependencias se instalan desde `package.json`, no se guardan en Git
   - `.env` — contiene secretos (contraseñas, API keys). **Nunca va en Git**
   - `dist/` — el código compilado se genera, no se versiona

7. **`.env.example` y `.env`**
   `.env.example` es la plantilla pública: lista todas las variables necesarias sin valores. Se commitea para que cualquier desarrollador sepa qué necesita configurar.
   `.env` tiene los valores reales para desarrollo local. No se commitea nunca.

   Los `JWT_SECRET` y `JWT_REFRESH_SECRET` se generaron aleatoriamente con 64 caracteres hexadecimales (usando `crypto.randomBytes` de Node.js). El CLAUDE.md exige mínimo 32 caracteres porque cuanto más largo, más difícil de romper por fuerza bruta.

**Conceptos clave aprendidos en esta fase:**

- **Monorepo vs multirepo**: un monorepo agrupa proyectos relacionados en un solo repo. Facilita compartir código y mantener consistencia, a costa de mayor complejidad de tooling.

- **pnpm vs npm**: pnpm usa un store global de paquetes y hard links, por lo que es más rápido y eficiente en disco. Su implementación de workspaces es más estricta: solo puedes importar lo que declaras explícitamente como dependencia.

- **Docker para desarrollo local**: no instalas nada en tu máquina. Todo corre en contenedores aislados. `docker compose up -d` levanta todo, `docker compose down` lo para. Los datos persisten en volúmenes.

- **Variables de entorno**: separan la configuración del código. El mismo código funciona en local, staging y producción cambiando solo el `.env`. Los secretos nunca van en Git.

- **JWT secrets**: el backend los usará para firmar tokens de autenticación. Si alguien consigue el secret, puede fabricar tokens válidos. Por eso deben ser largos, aleatorios y nunca públicos.

**Commit de cierre:**
```
chore(setup): initialize monorepo with NestJS backend, Docker and base config
```

---

### FASE 1 — Domain: entidades, value objects y CI básico

**¿Qué hicimos?**

Construimos el núcleo del negocio: la capa `domain`. Es la parte más importante del proyecto y la que más cambia en Clean Architecture — si aquí está bien, todo lo demás es mecánica.

También migramos Jest (el test runner que NestJS instala por defecto) a Vitest, y creamos el pipeline de CI en GitHub Actions.

---

#### Bloque 1 — Migración de Jest a Vitest

NestJS instala Jest por defecto, pero usamos **Vitest** porque:
- Es mucho más rápido (usa esbuild internamente)
- Compatible con el ecosistema Vite que usaremos en el frontend
- Configuración más simple y moderna
- Soporte nativo de ESM

Para que Vitest pueda procesar los decoradores de NestJS (`@Injectable()`, `@Controller()`...) instalamos `unplugin-swc` + `@swc/core`. SWC es un compilador de TypeScript/JavaScript escrito en Rust, mucho más rápido que `ts-jest`.

La configuración de cobertura exige:
- Mínimo **80% de líneas** cubiertas
- Mínimo **90% de branches** (caminos `if/else`) en el dominio

---

#### Bloque 2 — `neverthrow` y el patrón `Result<T, E>`

Instalamos `neverthrow` como dependencia de producción. Esta librería implementa el tipo `Result<T, E>` que hace los errores **explícitos en la firma de la función**.

Sin `neverthrow`:
```typescript
// TypeScript no sabe que puede fallar
function aprobarFactura(factura: Invoice): Invoice { ... }
```

Con `neverthrow`:
```typescript
// El error es parte del contrato. El compilador obliga a manejarlo.
function aprobarFactura(factura: Invoice): Result<Invoice, InvalidStateTransitionError> { ... }
```

Si intentas usar `result.value` sin comprobar antes si es un error, TypeScript no te deja compilar.

---

#### Bloque 3 — Errores de dominio tipados

Creamos una jerarquía de errores propia en `src/domain/errors/`. La base es la clase abstracta `DomainError`:

```typescript
export abstract class DomainError {
  abstract readonly code: string;
  constructor(public readonly message: string) {}
}
```

Todos los errores concretos heredan de ella y tienen un `code` único en mayúsculas. Esto permite que el controller mapee errores a códigos HTTP sin depender del texto del mensaje:

| Archivo | Errores |
|---|---|
| `invoice.errors.ts` | `InvoiceNotFoundError`, `InvalidStateTransitionError`, `InvoiceAlreadyProcessingError`, `ExtractionFailedError`, `ValidationFailedError` |
| `provider.errors.ts` | `ProviderNotFoundError`, `ProviderAlreadyExistsError` |
| `user.errors.ts` | `UserNotFoundError`, `UnauthorizedError` |
| `value-object.errors.ts` | `InvalidInvoiceAmountError`, `InvalidInvoiceStatusError`, `InvalidInvoiceDateError`, `InvalidTaxIdError`, `InvalidProviderNameError` |

**TDD aplicado:** primero escribimos los tests que fallan (Red), luego el código mínimo para que pasen (Green).

---

#### Bloque 4 — Value Objects

Los Value Objects son objetos del dominio que **no tienen identidad propia** — se definen únicamente por su valor. Son inmutables y se validan al crearse.

Patrón `create()` con constructor privado:

```typescript
export class InvoiceAmount {
  private constructor(private readonly value: number) {}

  static create(value: number): Result<InvoiceAmount, InvalidInvoiceAmountError> {
    if (value <= 0) return err(new InvalidInvoiceAmountError(value));
    if (!hasMaxTwoDecimals(value)) return err(new InvalidInvoiceAmountError(value));
    return ok(new InvoiceAmount(value));
  }
}
```

El constructor es `private` — la única forma de crear un `InvoiceAmount` es vía `create()`. Si existe, está validado. Si la validación falla, nunca llega a existir.

| Value Object | Reglas |
|---|---|
| `InvoiceAmount` | Mayor que 0, máximo 2 decimales |
| `InvoiceStatus` | Enum estricto: `PENDING`, `PROCESSING`, `EXTRACTED`, `VALIDATION_FAILED`, `READY_FOR_APPROVAL`, `APPROVED`, `REJECTED` |
| `InvoiceDate` | No puede ser fecha futura |
| `TaxId` | Formato NIF (`12345678A`) o CIF (`A1234567`) |
| `ProviderName` | No vacío, máximo 100 caracteres |

---

#### Bloque 5 — Entities de dominio

Las Entities tienen **identidad propia** — dos `Invoice` con los mismos datos son distintas si tienen distinto `id`. Su igualdad se basa en el identificador.

La entity más importante es `Invoice`, el **aggregate root**. Contiene la máquina de estados completa del workflow:

```
PENDING → PROCESSING → EXTRACTED → READY_FOR_APPROVAL → APPROVED
                                 ↘ VALIDATION_FAILED      ↘ REJECTED
```

Cada transición es un método que devuelve `Result<void, InvalidStateTransitionError>`. Si intentas una transición inválida (aprobar una factura `PENDING`), obtienes un `Err` tipado — nunca una excepción en tiempo de ejecución.

| Entity | Responsabilidad |
|---|---|
| `Invoice` | Aggregate root. Contiene la máquina de estados. |
| `Provider` | Configuración de un proveedor (Telefónica, Amazon...). |
| `User` | Datos mínimos del usuario en el dominio (id, email, rol). |
| `AuditEvent` | Registro inmutable de cada acción sensible. |
| `InvoiceEvent` | Historial de cada transición de estado. |

---

#### Bloque 6 — CI básico con GitHub Actions

Creamos `.github/workflows/ci.yml` que se ejecuta en cada push a `main`/`develop` y en cada Pull Request.

Pasos del pipeline:

| Paso | Qué hace | Por qué |
|---|---|---|
| `lint` | ESLint revisa el estilo y calidad del código | Detecta errores comunes y mantiene consistencia |
| `typecheck` | `tsc --noEmit` verifica los tipos sin compilar | Garantiza que TypeScript está satisfecho |
| `test` | Vitest ejecuta todos los tests unitarios | Confirma que la lógica funciona |
| `build` | NestJS compila el proyecto | Garantiza que el código producción es genereable |
| `secret-scan` | Gitleaks busca secretos accidentalmente commiteados | Seguridad — un JWT secret en Git es un desastre |
| `audit` | `pnpm audit` busca vulnerabilidades conocidas | Seguridad de dependencias |

Si cualquier paso falla, el CI bloquea el merge. Así nadie puede fusionar código roto a `main`.

---

**Resumen de tests al cerrar FASE 1:**

| Categoría | Archivos | Tests |
|---|---|---|
| Domain errors | 3 | 12 |
| Value objects | 5 | 38 |
| Entities | 5 | 39 |
| NestJS base | 1 | 1 |
| **Total** | **14** | **90** |

**Commit de cierre:**
```
feat(domain): add value objects, entities, domain errors and basic CI
```

---

### FASE 2 — Casos de uso, repositorios, puertos, DTOs y factories

**¿Qué hicimos?**

Construimos la capa `application` completa: los casos de uso que orquestan el dominio, las interfaces de repositorios, los puertos para servicios externos, los DTOs con Zod y las factories de test.

Esta fase no toca infraestructura (base de datos, email, almacenamiento) — eso llega en fases futuras. Aquí todo se mockea: los tests comprueban la lógica pura de los casos de uso sin depender de nada externo.

---

#### Bloque 1 — Interfaces de repositorios

Los repositorios son **contratos** que definen cómo se accede a los datos. Viven en `src/domain/repositories/` como interfaces TypeScript puras — sin ninguna implementación.

```typescript
export interface InvoiceRepository {
  findById(id: string): Promise<Invoice | null>;
  findAll(filters: InvoiceFilters): Promise<PaginatedResult<Invoice>>;
  findByUploaderId(uploaderId: string, filters: InvoiceFilters): Promise<PaginatedResult<Invoice>>;
  save(invoice: Invoice): Promise<void>;
  delete(id: string): Promise<void>;
}
```

**¿Por qué solo interfaces y no implementaciones?**

Porque los casos de uso no deben saber si los datos vienen de PostgreSQL, de MongoDB o de un archivo en disco. Solo necesitan saber *qué operaciones existen*. La implementación concreta con TypeORM llega en FASE 3.

Esta es la **D** de SOLID (Dependency Inversion): las capas de alto nivel dependen de abstracciones, no de implementaciones concretas.

Repositorios creados:

| Interfaz | Métodos principales |
|---|---|
| `InvoiceRepository` | `findById`, `findAll`, `findByUploaderId`, `save`, `delete` |
| `ProviderRepository` | `findById`, `findByName`, `findAll`, `save` |
| `UserRepository` | `findById`, `findByEmail`, `findAll`, `save`, `delete` |
| `AuditEventRepository` | `findById`, `findAll`, `save` |

---

#### Bloque 2 — Puertos de aplicación

Los puertos son interfaces para servicios externos que los casos de uso necesitan pero no implementan. Viven en `src/application/ports/`.

La diferencia con los repositorios es que los repositorios son siempre sobre datos del dominio (facturas, usuarios...), mientras que los puertos son sobre servicios externos genéricos:

| Puerto | Para qué sirve | Implementación futura |
|---|---|---|
| `NotificationPort` | Enviar notificaciones de cambio de estado | `NodemailerAdapter` en FASE 11 |
| `StoragePort` | Guardar y recuperar ficheros PDF | `LocalStorageAdapter` / `S3Adapter` en FASE 4 |
| `AuditPort` | Registrar eventos de auditoría | Implementación con TypeORM en FASE 3 |
| `LLMPort` | Llamar a un modelo de lenguaje (Google AI Studio) | `AIStudioAdapter` en FASE 7 |

Ejemplo del `StoragePort`:

```typescript
export interface StoragePort {
  save(buffer: Buffer, mimeType: string): Promise<StoredFile>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
```

El caso de uso llama a `this.storage.save(buffer, mimeType)` sin saber si el archivo se guarda en disco local o en AWS S3. Si en el futuro se cambia de almacenamiento, solo se cambia el adaptador — el caso de uso no se toca.

---

#### Bloque 3 — Factories de test

Las factories son funciones que crean objetos de dominio válidos con datos por defecto, permitiendo sobrescribir solo lo que cada test necesita.

**¿Por qué son necesarias?**

Sin factories, cada test construye el objeto manualmente:

```typescript
// Sin factory — repetitivo y frágil
const invoice = Invoice.create({
  id: 'inv-123',
  providerId: 'provider-abc',
  uploaderId: 'user-xyz',
  filePath: 'uploads/test.pdf',
  amount: InvoiceAmount.create(100)._unsafeUnwrap(),
  date: InvoiceDate.create(new Date('2025-01-15'))._unsafeUnwrap(),
  createdAt: new Date('2025-01-15'),
})._unsafeUnwrap();
```

Si el constructor de `Invoice` cambia, hay que actualizar cada test que construya una factura. Con factory:

```typescript
// Con factory — conciso y mantenible
const invoice = createInvoice();                          // valores por defecto
const invoice = createInvoice({ uploaderId: 'user-1' }); // solo lo que importa al test
```

**Factories vs mocks — ¿cuál es la diferencia?**

Son conceptos distintos que se usan juntos:

- Una **factory** crea un **objeto de dominio real** con estado real y métodos reales. Puedes llamar `invoice.approve()` y funciona de verdad.
- Un **mock** simula una **dependencia externa** (un repositorio, un puerto) controlando su comportamiento artificialmente.

```typescript
it('should approve an invoice', async () => {
  // Factory: crea datos reales
  const invoice = createInvoice();
  invoice.startProcessing()._unsafeUnwrap();
  invoice.markExtracted({ rawText: '...' })._unsafeUnwrap();
  invoice.markReadyForApproval()._unsafeUnwrap();

  // Mock: simula el repositorio (infraestructura)
  const mockRepo = {
    findById: vi.fn().mockResolvedValue(invoice), // devuelve el objeto real de la factory
    save: vi.fn(),
  };

  const useCase = new ApproveInvoiceUseCase(mockRepo, ...);
  const result = await useCase.execute({ invoiceId: invoice.getId(), approverId: 'user-1' });

  expect(result.isOk()).toBe(true);
});
```

**Diseño de los valores por defecto:**

- El `id` usa `randomUUID()` en cada llamada — así nunca hay colisiones entre objetos creados en el mismo test.
- El resto de campos son fijos y predecibles — así los tests pueden hacer assertions sobre valores concretos.

Factories creadas: `createInvoice`, `createProvider`, `createUser`, `createAuditEvent`, `createInvoiceEvent`.

---

#### Bloque 4 — DTOs con Zod

Los DTOs (*Data Transfer Objects*) definen qué datos entran y salen de cada caso de uso. Con Zod, un único schema hace dos cosas a la vez: valida los datos en tiempo de ejecución **y** define el tipo TypeScript.

**¿Por qué Zod y no solo TypeScript?**

TypeScript solo existe en compilación. Cuando compilas, `tsc` convierte todo el TypeScript a JavaScript eliminando completamente los tipos. El servidor ejecuta ese JavaScript puro, que no tiene ningún concepto de tipos.

```
Tú escribes TypeScript → tsc compila → Node.js ejecuta JavaScript (sin tipos)
```

Esto significa que cuando llega una petición HTTP, el body es JavaScript puro — podría ser cualquier cosa. TypeScript no puede protegerte de datos externos malformados en runtime:

```typescript
// TypeScript cree que esto es correcto en compilación...
async function aprobarFactura(input: { invoiceId: string }) { ... }

// ...pero en runtime el body puede ser: { invoiceId: "" } o { invoiceId: 99999 } o {}
// TypeScript ya no existe para detectarlo
```

Zod valida **en runtime**, dentro del JavaScript que se está ejecutando:

```typescript
const schema = z.object({
  invoiceId: z.string().uuid(),
});

const result = schema.safeParse(req.body);
if (!result.success) {
  // Zod detectó en runtime que invoiceId no es un UUID válido
  return res.status(400).json({ error: result.error });
}
// Aquí sí puedes confiar en los datos
```

**Resumen:** TypeScript te protege de *tus propios errores* al escribir código. Zod te protege del *mundo exterior* en tiempo de ejecución.

Cada DTO tiene un schema de entrada (lo que recibe el use case) y uno de salida (lo que devuelve):

| DTO | Input | Output |
|---|---|---|
| `upload-invoice` | `uploaderId`, `providerId`, `fileBuffer`, `mimeType`, `fileSizeBytes` | `invoiceId`, `status`, `filePath`, `createdAt` |
| `approve-invoice` | `invoiceId`, `approverId` (UUIDs) | `invoiceId`, `status`, `approverId` |
| `reject-invoice` | `invoiceId`, `approverId`, `reason` (no vacío) | `invoiceId`, `status`, `approverId`, `reason` |
| `get-invoice` | `invoiceId`, `requesterId`, `requesterRole` | Todos los campos de la factura |
| `list-invoices` | `requesterId`, `requesterRole`, paginación, filtros | `items[]`, `total`, `page`, `limit` |
| `create-provider` | `name`, `adapterType` (enum) | `providerId`, `name`, `adapterType`, `createdAt` |
| `create-user` | `email`, `role`, `password` (mín. 8 chars) | `userId`, `email`, `role`, `createdAt` |

---

#### Bloque 5 — Casos de uso con TDD

Los casos de uso son la capa que orquesta el dominio para cumplir una acción concreta. Cada uno hace exactamente una cosa.

Flujo de un caso de uso típico:

```
1. Recibir el DTO de entrada
2. Buscar los datos necesarios (vía repositorio mockeado)
3. Ejecutar la lógica de dominio (entity, value object)
4. Persistir los cambios (vía repositorio)
5. Efectos secundarios (auditoría, notificación)
6. Devolver Result<Output, DomainError>
```

**TDD aplicado:** para cada use case se escribe primero el test (rojo), luego la implementación mínima (verde), luego se refactoriza.

Casos de uso implementados:

**`UploadInvoiceUseCase`** — Guarda el PDF en `StoragePort`, crea la `Invoice` en estado `PENDING`, la persiste y registra la auditoría. El importe se inicializa con `InvoiceAmount.createPlaceholder()` porque aún no hay OCR — se actualizará en FASE 5.

**`ApproveInvoiceUseCase`** — Busca la factura, delega la validación de la transición al dominio (`invoice.approve()`), persiste, audita y notifica. Si la factura no está en `READY_FOR_APPROVAL`, el dominio devuelve `Err` y el use case lo propaga.

**`RejectInvoiceUseCase`** — Igual que approve pero con razón de rechazo obligatoria.

**`GetInvoiceUseCase`** — Aplica RBAC (control de acceso por roles): un `uploader` solo puede ver sus propias facturas. `validator`, `approver` y `admin` pueden ver cualquiera. Si un uploader intenta acceder a una factura ajena, devuelve `UnauthorizedError`.

**`ListInvoicesUseCase`** — Usa `findByUploaderId` para uploaders (solo ven las suyas) y `findAll` para el resto. Soporta paginación y filtros.

**`CreateProviderUseCase`** — Comprueba que el nombre no esté ya en uso antes de crear.

**`CreateUserUseCase`** — Comprueba que el email no esté ya en uso antes de crear.

---

#### Problemas encontrados y cómo se resolvieron

**1. Zod no instalado en el backend**

Al crear los DTOs, TypeScript no encontraba el módulo `zod`. El motivo: en un monorepo con pnpm workspaces, cada paquete debe declarar sus dependencias explícitamente en su propio `package.json`. No hereda las dependencias de otros paquetes automáticamente.

Solución: `pnpm --filter backend add zod`.

**2. `InvoiceAmount.create(0)` falla — amount 0 no es válido**

Para el upload inicial, antes del OCR, no sabemos el importe real. Se intentó usar `InvoiceAmount.create(0)` como valor provisional, pero la regla de negocio del value object rechaza `value <= 0` (ninguna factura real tiene importe cero).

La solución incorrecta habría sido relajar la regla de negocio para admitir 0 — eso corrompería una invariante del dominio.

La solución correcta: añadir `InvoiceAmount.createPlaceholder()`, un método estático separado con nombre explícito que comunica la intención — *"este importe es provisional, se actualizará tras OCR"*. La regla de negocio principal queda intacta.

**3. TypeScript rechaza `Set.has()` con tipos más amplios**

Se usó un `Set` para los roles con acceso total. TypeScript infiere el tipo del Set como `Set<'validator' | 'approver' | 'admin'>`, y el método `.has()` solo acepta exactamente esos tres valores.

Pero `input.requesterRole` puede ser cualquier `UserRoleValue` — incluyendo `'uploader'`. TypeScript rechaza pasarlo a `.has()` porque `'uploader'` no está en el tipo del Set.

Importante: esto **no es un error de runtime**. En JavaScript, `set.has('uploader')` simplemente devuelve `false`. El problema es solo en compilación — TypeScript es demasiado estricto en este caso concreto.

El cast no funcionó porque no cambia el tipo del Set, solo el del argumento.

Solución: usar `string[]` con `.includes()`, que acepta cualquier `string` sin restricciones. El comportamiento en runtime es idéntico.

```typescript
// ❌ TypeScript rechaza esto en compilación
const ROLES = new Set(['validator', 'approver', 'admin']);
ROLES.has(input.requesterRole); // Error: 'uploader' no asignable

// ✅ TypeScript acepta esto
const ROLES: string[] = ['validator', 'approver', 'admin'];
ROLES.includes(input.requesterRole); // OK
```

La lección: **TypeScript en compilación puede ser más estricto que JavaScript en runtime. A veces hay que buscar alternativas que satisfagan al compilador sin cambiar la lógica.**

---

**Resumen de tests al cerrar FASE 2:**

| Categoría | Archivos de test | Tests |
|---|---|---|
| Domain errors | 3 | 12 |
| Value objects | 5 | 38 |
| Entities | 5 | 39 |
| Use cases | 7 | 30 |
| NestJS base | 1 | 1 |
| **Total** | **21** | **120** |

**Commit de cierre:**
```
feat(application): add use cases, repositories, ports, DTOs and test factories
```

---

### FASE 3 — Base de datos: migraciones, ORM entities, mappers y repositorios reales

**¿Qué hicimos?**

Implementamos la capa de infraestructura de datos completa: la conexión real a PostgreSQL via TypeORM, las tablas de la base de datos creadas mediante migraciones versionadas, las clases ORM que mapean entre tablas y código, los mappers que traducen entre el mundo ORM y el mundo del dominio, y los repositorios concretos que implementan las interfaces definidas en FASE 2.

Al cerrar esta fase, el backend puede persistir y recuperar todos los objetos del dominio en una base de datos PostgreSQL real.

---

#### Bloque 1 — Configuración de entorno y módulo de base de datos

**`config.schema.ts` — Validación de variables de entorno con Zod**

Creamos un schema Zod que valida todas las variables de entorno al arrancar la aplicación. Si falta alguna variable requerida o tiene un formato incorrecto, la app falla inmediatamente con un mensaje claro.

**¿Por qué validar en el arranque?**

Sin validación, un error de configuración se manifestaría en tiempo de ejecución, quizá horas después o en una ruta poco frecuente. Con Zod al inicio, falla rápido y con mensaje claro:

```
❌ Sin validación: "SASL: client password must be a string" (oscuro)
✅ Con Zod: "DATABASE_URL: Invalid url" (claro)
```

**`database.module.ts`**

El módulo de NestJS que configura TypeORM. Lee la `DATABASE_URL` del entorno validado y configura la conexión con:
- `synchronize: false` — nunca alterar el schema automáticamente en producción
- `migrationsRun: false` — las migraciones se ejecutan a mano, no al arrancar
- `logging: false` — sin SQL verboso en producción (configurable)

**`data-source.ts`**

Archivo independiente del framework NestJS, necesario para que el CLI de TypeORM pueda ejecutar migraciones sin arrancar toda la aplicación. Carga el `.env` desde la raíz del monorepo con una ruta explícita.

---

#### Bloque 2 — ORM Entities

Las ORM Entities son clases TypeScript decoradas con `@Entity()`, `@Column()`, etc., que TypeORM usa para mapear cada clase a una tabla de base de datos. Son **pura infraestructura** — no contienen lógica de negocio.

**¿Por qué no usar las entities de dominio directamente con TypeORM?**

Las entities de dominio tienen constructores privados, métodos de negocio (`invoice.approve()`) y el patrón `Result<T,E>`. Si se decorasen con `@Entity()` de TypeORM, se violaría la regla de dependencias: el dominio importaría TypeORM (infraestructura).

Solución: dos clases separadas conectadas por un mapper.

| ORM Entity | Tabla | Notas |
|---|---|---|
| `UserOrmEntity` | `users` | id UUID, email unique, role, timestamps |
| `UserCredentialOrmEntity` | `user_credentials` | password hash, FK a users |
| `ProviderOrmEntity` | `providers` | name unique, adapterType, isActive |
| `InvoiceOrmEntity` | `invoices` | status, amount (numeric), FK a user y provider |
| `InvoiceEventOrmEntity` | `invoice_events` | historial de transiciones, inmutable |
| `AuditEventOrmEntity` | `audit_events` | registro de acciones, inmutable |

---

#### Bloque 3 — Método `reconstruct()` y Mappers

**`reconstruct()` en las entities de dominio**

Para que los mappers puedan crear entities de dominio desde datos de base de datos (que ya están validados), añadimos el método estático `reconstruct()` a todas las entities. A diferencia de `create()` (que valida con `Result`), `reconstruct()` confía en que los datos son correctos — ya fueron validados cuando se guardaron. Permite construir sin el overhead del `Result<T,E>`.

```typescript
// create() — para datos externos no confiables
static create(props): Result<Invoice, DomainError> { ... }

// reconstruct() — para datos ya validados de la DB
static reconstruct(props): Invoice { ... }
```

**Mappers**

Los mappers traducen en ambas direcciones entre el mundo ORM y el mundo del dominio:

```
ORM Entity  ──toDomain()──→  Domain Entity
Domain Entity ──toOrm()────→  ORM Entity
```

Un mapper por entidad: `UserMapper`, `ProviderMapper`, `InvoiceMapper`, `InvoiceEventMapper`, `AuditEventMapper`.

---

#### Bloque 4 — Migraciones

Las migraciones son la forma correcta de gestionar el schema de la base de datos en producción. Cada migración es un archivo TypeScript con dos métodos:

- `up()` — aplica el cambio (crear tabla, añadir columna...)
- `down()` — revierte el cambio (para poder hacer rollback)

```
pnpm --filter backend migration:run   ← aplica migraciones pendientes
pnpm --filter backend migration:revert ← revierte la última migración
```

**Naming convention:** `YYYYMMDDHHMMSS_DescripcionCorta.ts` — el timestamp garantiza el orden de ejecución.

Migraciones creadas y ejecutadas exitosamente:

| Migración | Tabla | Descripción |
|---|---|---|
| `1741650001000-CreateUsersTable` | `users` | Tabla base de usuarios |
| `1741650002000-CreateUserCredentialsTable` | `user_credentials` | Credenciales separadas por seguridad |
| `1741650003000-CreateProvidersTable` | `providers` | Proveedores de facturas |
| `1741650004000-CreateInvoicesTable` | `invoices` | Facturas con FK a usuarios y proveedores |
| `1741650005000-CreateInvoiceEventsTable` | `invoice_events` | Historial de transiciones de estado |
| `1741650006000-CreateAuditEventsTable` | `audit_events` | Log de auditoría inmutable |

**¿Por qué las credenciales están en tabla separada?**

Por el principio de responsabilidad única y seguridad. Si en el futuro se añade OAuth o SSO, los usuarios pueden existir sin credenciales propias. Además, limita la superficie de ataque: una query de usuarios no expone accidentalmente hashes de contraseñas.

**Problema encontrado: conflicto de puerto PostgreSQL**

Hay una instalación local de PostgreSQL en Windows que ocupa el puerto `5432`. Docker no puede usar ese puerto. Solución: cambiar el puerto del contenedor a `5433:5432` en `docker-compose.yml` y actualizar `DATABASE_URL` a `postgresql://...@localhost:5433/invoicescan`.

---

#### Bloque 5 — Implementaciones de repositorios con TypeORM

Implementamos las 4 interfaces de repositorio definidas en FASE 2, ahora con TypeORM real:

- `UserTypeOrmRepository` — implementa `UserRepository`
- `ProviderTypeOrmRepository` — implementa `ProviderRepository`
- `InvoiceTypeOrmRepository` — implementa `InvoiceRepository`
- `AuditEventTypeOrmRepository` — implementa `AuditEventRepository`

Cada repositorio:
1. Recibe el `Repository<OrmEntity>` de TypeORM por inyección de dependencias
2. Usa el mapper correspondiente para convertir entre ORM y dominio
3. Implementa los filtros explícitamente (`WHERE user_id = :uploaderId`) — nunca RLS de PostgreSQL
4. Devuelve entidades de dominio, nunca ORM entities

---

#### Bloque 6 — Tests de integración contra PostgreSQL real

Los tests de integración verifican que los repositorios funcionan correctamente contra una base de datos real. No son mocks — hablan con el PostgreSQL de Docker.

**Infraestructura de test:**

`db-test.helper.ts` proporciona dos funciones:
- `createTestDataSource()` — crea y conecta un DataSource TypeORM para tests
- `clearTables(ds)` — borra todas las filas en el orden correcto (respetando FK constraints) antes de cada test

**¿Por qué borrar antes de cada test y no solo una vez?**

Porque cada test debe ser independiente: si un test inserta datos y falla a medias, el siguiente no debe encontrar esos datos. Cada `it()` empieza con una base de datos vacía.

**Problemas encontrados y resueltos:**

**1. `DATABASE_URL` era `undefined` en el contexto de Vitest**

El helper usaba `join(__dirname, '../../../../.env')` para encontrar el `.env`. En el contexto de ejecución de Vitest, `__dirname` resuelve a la ruta del archivo dentro de `src/`, pero el número de niveles hacia arriba era incorrecto — llegaba a `packages/backend/`, no a la raíz del monorepo donde vive `.env`.

Solución: usar `process.cwd()` en lugar de `__dirname`. Vitest siempre establece `process.cwd()` al directorio raíz del paquete (`packages/backend/`), desde donde subir dos niveles (`../../.env`) sí alcanza la raíz del monorepo.

**2. TypeORM no podía cargar las ORM Entities desde un glob en tests**

La configuración inicial del DataSource de test usaba un glob string:
```typescript
entities: ['../entities/*.orm-entity.{ts,js}']
```

En el contexto de tests, TypeORM intenta cargar estos archivos con `require()` en tiempo de ejecución. Pero SWC (que transforma los archivos) solo actúa sobre imports estáticos, no sobre `require()` dinámico a archivos `.ts` crudos. Resultado: `SyntaxError: Invalid or unexpected token`.

Solución: importar las clases directamente:
```typescript
import { UserOrmEntity } from '../entities/user.orm-entity';
// ...
entities: [UserOrmEntity, ProviderOrmEntity, ...]
```

Los imports estáticos sí son procesados por SWC, y TypeORM recibe las clases ya transpiladas.

**Cobertura de los tests de integración:**

| Suite | Tests | Qué verifica |
|---|---|---|
| `UserTypeOrmRepository` | 11 | save, findById, findByEmail, findAll, delete, round-trip |
| `ProviderTypeOrmRepository` | 7 | save, findById, findByName, findAll, round-trip |
| `InvoiceTypeOrmRepository` | 10 | save, findById, findByUploaderId, findAll con filtros, delete, round-trip |
| `AuditEventTypeOrmRepository` | 8 | save, findById, findAll con filtros, round-trip |
| **Total** | **36** | — |

---

**Resumen de tests al cerrar FASE 3:**

| Categoría | Archivos | Tests |
|---|---|---|
| Unit (domain + use cases) | 21 | 120 |
| Integration (repositorios reales) | 4 | 36 |
| **Total** | **25** | **156** |

**Commit de cierre:**
```
feat(infrastructure): add TypeORM setup, migrations, mappers and repository implementations
```

---

### FASE 4 — Subida de PDFs: almacenamiento, validación y endpoint HTTP

**¿Qué hicimos?**

Implementamos el flujo completo de subida de un PDF: desde que llega al servidor como bytes crudos hasta que queda guardado en disco y registrado en la base de datos. Esta es la primera funcionalidad observable del sistema — puedes hacer una petición HTTP real y ver el resultado.

---

#### Bloque 1 — `LocalStorageAdapter`: implementación de `StoragePort`

El `StoragePort` (definido en FASE 2 como interfaz) recibe su primera implementación concreta: `LocalStorageAdapter`. Guarda los archivos en la carpeta `uploads/` del servidor.

**¿Por qué una interfaz + un adaptador en lugar de escribir directamente a disco?**

Porque en el futuro querremos guardar en AWS S3 u otro servicio cloud. Si el código del use case escribiese directamente a disco con `fs.writeFile(...)`, habría que modificarlo cuando cambie el almacenamiento. Con el adaptador, el use case llama a `this.storage.save(buffer, mimeType)` sin saber dónde va el archivo. Cambiar de disco local a S3 es solo crear un nuevo adaptador — el use case no se toca.

**Métodos implementados:**

| Método | Qué hace |
|---|---|
| `save(buffer, mimeType)` | Genera un UUID, escribe el buffer en `uploads/<uuid>.<ext>`, devuelve `{ key, mimeType, sizeBytes }` |
| `get(key)` | Lee el archivo de disco y devuelve el buffer |
| `delete(key)` | Borra el archivo. Si no existe, no lanza error (idempotente) |
| `getSignedUrl(key, expiresInSeconds)` | Genera un token temporal: codifica `key:expiresAt` en base64url y devuelve `/files/<token>` |

**¿Qué es una signed URL?**

Es una URL con un token de tiempo limitado que autoriza el acceso a un recurso sin requerir autenticación adicional. En lugar de exponer `/uploads/archivo-secreto.pdf` directamente (que cualquiera podría adivinar), el servidor genera `/files/<token>` donde el token lleva incrustada la fecha de expiración. Cuando alguien accede a esa URL, el servidor valida que el token no ha expirado antes de servir el archivo.

El nombre del archivo guardado en disco es siempre un UUID (`a3f2...pdf`) — nunca el nombre original que subió el usuario. Esto previene ataques de path traversal (alguien que suba un archivo llamado `../../etc/passwd`).

**Inyección de dependencias con tokens de string:**

En NestJS, la inyección de dependencias funciona con tokens de identificación. Para clases concretas, el token es la propia clase. Para interfaces (que no existen en runtime), necesitamos un token de string:

```typescript
export const STORAGE_TOKEN = 'STORAGE_TOKEN';

// En el módulo:
{ provide: STORAGE_TOKEN, useClass: LocalStorageAdapter }

// En el use case:
constructor(@Inject(STORAGE_TOKEN) private readonly storage: StoragePort) {}
```

El `STORAGE_TOKEN` es la "etiqueta" que NestJS usa para saber qué instancia inyectar. Como `StoragePort` es una interfaz de TypeScript y no existe en JavaScript compilado, necesitamos esta etiqueta de string para que NestJS la reconozca en runtime.

---

#### Bloque 2 — `FileValidationPipe`: validación antes del controlador

Un **Pipe** en NestJS es una clase que transforma o valida los datos antes de que lleguen al handler del controlador. Si la validación falla, lanza una excepción y el handler nunca se ejecuta.

El `FileValidationPipe` aplica tres reglas en orden:

1. **Presencia**: si no hay archivo → `400 Bad Request: "No file uploaded."`
2. **Tamaño**: si supera `MAX_UPLOAD_SIZE_MB` (10 MB por defecto, configurable via entorno) → `400 Bad Request: "File exceeds the maximum allowed size of 10 MB."`
3. **Tipo MIME real**: usa la librería `file-type` para leer los primeros bytes del buffer (los *magic bytes*) e identificar el formato real → si no es `application/pdf` → `400 Bad Request: "Invalid file type. Only PDF files are accepted."`

**¿Qué son los magic bytes?**

Todo formato de archivo tiene una firma en sus primeros bytes que identifica el formato independientemente de la extensión. Por ejemplo:
- PDF: `%PDF` (25 50 44 46)
- PNG: `\x89PNG` (89 50 4E 47)
- JPEG: `\xFF\xD8\xFF`

Si alguien renombra `foto.png` a `factura.pdf` e intenta subirlo, la extensión y la cabecera `Content-Type` de HTTP dirán `application/pdf` — pero los primeros bytes del archivo revelan que es un PNG. El pipe detecta esto y rechaza el archivo con `400 Invalid file type (detected: image/png)`.

**Problema con `file-type` y ESM en NestJS (CommonJS):**

`file-type` es una librería ESM pura (solo funciona con `import`, no con `require`). NestJS compila a CommonJS. Intentar `import { fileTypeFromBuffer } from 'file-type'` directamente daría error en runtime.

Solución: usar import dinámico dentro de la función:
```typescript
const { fileTypeFromBuffer } = await import('file-type');
```

El `await import()` dinámico sí funciona en CommonJS para cargar módulos ESM.

**Problema con la detección de PNG:**

`file-type` necesita ver el chunk `IHDR` completo de un PNG para identificarlo (mínimo 29 bytes), no solo la firma de 8 bytes. En los tests, usamos un buffer PNG completo con el IHDR para que la detección funcione correctamente.

---

#### Bloque 3 — `InvoicesController` + `InvoicesModule`

**`InvoicesController`**

El controlador gestiona `POST /api/v1/invoices/upload`. Su responsabilidad es exclusivamente traducir HTTP ↔ use case: recibir el archivo, validarlo (via pipe), llamar al use case y devolver la respuesta.

```
HTTP request (multipart/form-data)
   → FileInterceptor (Multer lee el archivo a memoria)
   → FileValidationPipe (valida presencia, tamaño, MIME)
   → uploadInvoiceUseCase.execute(...)
   → { data: result.value }  (HTTP 201)
```

Multer usa `memoryStorage()` — el archivo no se escribe a disco aquí, solo vive en memoria como `file.buffer`. Es el `LocalStorageAdapter` quien decide cómo y dónde persistirlo.

Los `uploaderId` y `providerId` son UUIDs placeholder hasta FASE 8 (autenticación JWT) y FASE 9 (selección de proveedor desde el body).

**Manejo de errores del use case:**

Si el use case devuelve `result.isErr()`, el controlador lanza `InternalServerErrorException`. Esto es un placeholder — en FASE 9 se añadirá un `ExceptionFilter` que mapea cada tipo de `DomainError` a su código HTTP apropiado.

**`InvoicesModule`**

El módulo conecta todas las piezas mediante el sistema de DI de NestJS:

```
InvoicesModule
  imports: [DatabaseModule, StorageModule]
  controllers: [InvoicesController]
  providers:
    - AUDIT_TOKEN → NoOpAuditAdapter (placeholder hasta FASE 9)
    - UPLOAD_INVOICE_USE_CASE_TOKEN → UploadInvoiceUseCase (wired via useFactory)
```

El `useFactory` recibe los tres objetos inyectados ya resueltos por NestJS (`InvoiceRepository`, `StoragePort`, `AuditPort`) y construye el use case. Están tipados correctamente con las interfaces de dominio — sin `any`.

**¿Por qué `useFactory` en lugar de `useClass`?**

`useClass` funciona cuando NestJS puede instanciar la clase automáticamente (detecta los parámetros del constructor). Pero `UploadInvoiceUseCase` está en la capa de `application` y no tiene decoradores NestJS — no puede ser inyectado directamente. El `useFactory` nos da control explícito: recibimos los tres objetos ya resueltos y construimos el use case a mano.

**`NoOpAuditAdapter`:**

Es un adaptador temporal que implementa `AuditPort` pero no persiste nada — solo escribe en el log. Permite que la app funcione sin una tabla de auditoría completamente implementada. Se reemplazará por el adaptador TypeORM real en FASE 9.

---

#### Bloque 4 — Tests

**Tests unitarios — `LocalStorageAdapter` (11 tests):**

Usan un directorio temporal real (`test-uploads-tmp`). No hay mocks del sistema de archivos — el adaptador escribe y lee de disco de verdad. Esto es deliberado: `fs` no es una dependencia de negocio, no tiene sentido mockearla.

Escenarios cubiertos: escritura correcta, unicidad de claves UUID, creación automática del directorio si no existe, extensión vacía para MIME desconocido, lectura correcta, error al leer archivo inexistente, borrado correcto, idempotencia del borrado, formato de signed URL, codificación de la clave en el token, codificación del timestamp de expiración.

**Tests unitarios — `FileValidationPipe` (9 tests):**

Prueban el pipe de forma aislada, sin NestJS ni HTTP. Cada regla tiene al menos dos tests: uno que verifica que lanza `BadRequestException` y otro que verifica que el mensaje es el correcto.

**Tests E2E con Supertest — `InvoicesController` (4 tests):**

Levantan un servidor NestJS completo en memoria (sin base de datos real — el use case está mockeado con `vi.fn()`). Supertest hace peticiones HTTP reales contra ese servidor.

La importación de Supertest debe ser `import request from 'supertest'` (import por defecto), no `import * as request from 'supertest'`. Con la sintaxis de namespace (`* as`), Vitest no resuelve correctamente la función principal del módulo en el contexto ESM/CJS.

Escenarios cubiertos:

| Test | Input | Expected |
|---|---|---|
| PDF válido | Buffer con magic bytes PDF | 201 + `{ data: { invoiceId, status } }` |
| Sin archivo | Petición sin campo `file` | 400 + mensaje "No file uploaded" |
| Archivo demasiado grande | Buffer de 11 MB con magic bytes PDF | 400 + mensaje "maximum allowed size" |
| Tipo MIME incorrecto | Buffer PNG enviado como PDF | 400 + mensaje "Invalid file type" |

---

#### Problemas encontrados y cómo se resolvieron

**1. `multer` no estaba instalado como dependencia directa**

Aunque `@nestjs/platform-express` incluye Multer internamente, TypeScript necesita los tipos de `multer` para las anotaciones `Express.Multer.File`. Al ejecutar los tests, el resolver de módulos no encontraba `multer`.

Solución: `pnpm --filter backend add multer` + `pnpm --filter backend add -D @types/multer`.

**2. `import * as request from 'supertest'` fallaba en Vitest**

El error `(0 , __vite_ssr_import_2__) is not a function` aparecía al llamar `request(app.getHttpServer())`. El motivo: Vitest en modo SSR trata los módulos CJS de forma distinta, y la importación namespace de un módulo que exporta una función como `module.exports` no resuelve correctamente la función principal.

Solución: cambiar a `import request from 'supertest'` (import del default export).

**3. `any` en `useFactory` violaba las reglas del proyecto**

El `useFactory` del módulo tenía `(invoiceRepo: any, storage: any, auditor: any)`. Aunque funciona en runtime, viola explícitamente la regla `❌ any en TypeScript` del CLAUDE.md.

Solución: tipar los parámetros con las interfaces reales usando `import type`: `InvoiceRepository`, `StoragePort`, `AuditPort`. El `import type` es solo información de tipos — no genera código JavaScript, por lo que no introduce dependencias circulares en runtime.

**4. `throw new Error()` en el controlador era demasiado genérico**

Cuando el use case devuelve `isErr()`, lanzar `new Error(message)` genera un HTTP 500 sin estructura. NestJS convierte los errores no capturados en respuestas de error genéricas.

Solución: lanzar `new InternalServerErrorException(message)` — que es la excepción tipada de NestJS para errores 500. Genera una respuesta con el formato estándar de NestJS: `{ statusCode: 500, message: "...", error: "Internal Server Error" }`. En FASE 9 esto se reemplazará por un `ExceptionFilter` que mapea cada `DomainError` al código HTTP correcto.

**5. Rutas relativas incorrectas en `invoices.module.ts`**

El módulo vive en `src/invoices.module.ts` pero usaba rutas `../infrastructure/...` (subiendo un nivel desde `src/`). Como el archivo ya está en `src/`, las rutas correctas son `./infrastructure/...`.

Solución: corregir todas las rutas a `./`.

---

**Resumen de tests al cerrar FASE 4:**

| Categoría | Archivos | Tests |
|---|---|---|
| Unit (domain + use cases) | 21 | 120 |
| Unit (storage + pipe + controller) | 3 | 24 |
| Integration (repositorios reales) | 4 | 36 |
| **Total** | **28** | **180** |

**Commit de cierre:**
```
feat(infrastructure): add file upload with LocalStorageAdapter, FileValidationPipe and InvoicesController
```

---

### FASE 5+6 — OCR con Tesseract, ProcessInvoiceUseCase y colas BullMQ

**¿Qué hicimos?**

Implementamos el procesamiento asíncrono de facturas: tras la subida, un job de BullMQ orquesta el OCR (extracción de texto del PDF con Tesseract) y actualiza el estado de la factura. También añadimos Bull Board, una UI web para monitorizar las colas en tiempo real.

Esta fase combina dos fases del plan original (FASE 5 = OCR y FASE 6 = colas) porque están estrechamente relacionadas: el worker de la cola invoca el use case que llama al OCR.

---

#### Bloque 1 — `OcrPort` y `ProcessInvoiceUseCase`

**`OcrPort`** es la interfaz del puerto OCR en `src/application/ports/ocr.port.ts`:

```typescript
export interface OcrPort {
  extractText(buffer: Buffer): Promise<OcrResult>;
}

export type OcrResult =
  | { success: true; text: string }
  | { success: false; error: string };
```

El use case recibe el `OcrPort` como dependencia — no sabe si el OCR lo hace Tesseract, Google Vision u otra librería. Esta es la **D de SOLID**: depende de la abstracción, no de la implementación concreta.

**`ProcessInvoiceUseCase`** orquesta todo el flujo de procesamiento:

```
1. Busca la factura por ID
2. Recupera el PDF del storage (StoragePort)
3. Llama al OCR (OcrPort) para extraer el texto
4. Si OCR falla → invoice.markValidationFailed() → VALIDATION_FAILED
5. Si OCR OK → invoice.markExtracted({ rawText }) → EXTRACTED
6. Persiste el cambio
7. Registra auditoría
```

Devuelve `Result<Invoice, DomainError>`. Nunca lanza excepciones.

**Cambio retrocompatible en `invoice.entity.ts`:**

El método `markValidationFailed()` aceptaba solo desde `EXTRACTED`. Lo extendimos para aceptar también desde `PROCESSING`, porque si el OCR falla la factura está en `PROCESSING` (nunca llegó a `EXTRACTED`). Los 19 tests de entidad existentes siguieron pasando.

---

#### Bloque 2 — `TesseractAdapter`

`TesseractAdapter` implementa `OcrPort` usando `tesseract.js` v7:

```typescript
const worker = await createWorker(['spa', 'eng']);
const { data } = await worker.recognize(buffer);
await worker.terminate();
return { success: true, text: data.text };
```

El worker se crea y destruye en cada llamada. Así no hay estado compartido entre jobs concurrentes — cada procesamiento es completamente independiente.

**`OCR_TOKEN = 'OcrPort'`** es el token de inyección de dependencias. Como `OcrPort` es una interfaz TypeScript (no existe en JavaScript compilado), necesitamos esta constante de string para que NestJS sepa qué instancia inyectar.

Los tests del adaptador mockean `tesseract.js` completamente — no se ejecuta OCR real en los tests unitarios. Esto hace los tests rápidos y deterministas.

---

#### Bloque 3 — BullMQ: colas y worker

**¿Qué es BullMQ?**

BullMQ es una librería de colas de trabajo basada en Redis. En lugar de procesar el OCR sincrónicamente (bloqueando la petición HTTP durante segundos), el upload encola un job y responde inmediatamente. Un worker separado lo procesa en segundo plano.

```
Usuario sube PDF → HTTP 201 inmediato → Job en Redis → Worker procesa OCR
```

Esto mejora la experiencia de usuario (no espera el OCR) y la resiliencia del sistema (si el OCR falla, el job se reintenta automáticamente).

**`InvoiceQueueService`** — el productor:

```typescript
async enqueueProcessing(invoiceId: string, storagePath: string): Promise<void> {
  await this.queue.add('process', { invoiceId, storagePath }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  });
}
```

Tres reintentos con backoff exponencial: si falla, espera 2s, luego 4s, luego 8s. Si falla tres veces, el job pasa a la Dead Letter Queue (`failed-jobs`).

**`ProcessInvoiceWorker`** — el consumidor:

```typescript
@Processor(PROCESS_INVOICE_QUEUE)
export class ProcessInvoiceWorker extends WorkerHost {
  async process(job: Job): Promise<void> {
    const result = await this.useCase.execute({
      invoiceId: job.data.invoiceId,
      storagePath: job.data.storagePath,
    });
    if (result.isErr()) throw new Error(result.error.message);
  }
}
```

El worker delega completamente al `ProcessInvoiceUseCase`. Si el use case devuelve `Err`, el worker lanza un error — BullMQ lo detecta y reintenta el job según la política configurada.

**`UploadInvoiceUseCase` actualizado:**

Añadimos `InvoiceQueuePort` como cuarta dependencia. Tras guardar la factura, encola el job de procesamiento:

```typescript
await this.queue.enqueueProcessing(invoice.getId(), storedFile.key);
```

---

#### Bloque 4 — Bull Board: UI de monitorización

Bull Board es una interfaz web que muestra el estado de todas las colas en tiempo real. Se monta en `/admin/queues`.

```typescript
BullBoardModule.forRoot({
  route: '/admin/queues',
  adapter: ExpressAdapter,
}),
BullBoardModule.forFeature({
  name: PROCESS_INVOICE_QUEUE,
  adapter: BullMQAdapter,
}),
```

Desde `/admin/queues` puedes ver:
- Jobs activos, en espera, completados y fallidos
- El payload de cada job (`invoiceId`, `storagePath`)
- El número de reintentos y el error que causó el fallo
- Botones para reintentar jobs fallidos manualmente

**¿Por qué es útil en producción?**

Cuando un OCR falla repetidamente, puedes ver exactamente qué job falló, con qué datos, y cuántas veces se reintentó — sin necesidad de buscar en logs.

---

#### Problemas encontrados y cómo se resolvieron

**1. `markValidationFailed` rechazaba la transición desde `PROCESSING`**

El OCR falla mientras la factura está en `PROCESSING`. El método solo aceptaba desde `EXTRACTED`. Extendimos la validación para aceptar ambos estados origen sin cambiar el comportamiento existente.

**2. `STORAGE_TOKEN` vs `'StoragePort'` en `JobsModule`**

El `JobsModule` intentaba inyectar el `StoragePort` con la cadena literal `'StoragePort'`, pero `StorageModule` exporta el token bajo la constante `STORAGE_TOKEN = 'STORAGE_TOKEN'`. Ambos strings son distintos. Solución: importar y usar la constante `STORAGE_TOKEN` en lugar de la cadena literal.

**3. `UploadInvoiceUseCase` tiene ahora 4 parámetros en el constructor**

El `useFactory` en `invoices.module.ts` debía recibir el `InvoiceQueueService` como cuarto parámetro. Actualizamos tanto el `inject` array como la firma del `useFactory`.

---

**Resumen de tests al cerrar FASE 5+6:**

| Categoría | Archivos | Tests |
|---|---|---|
| Unit (domain + use cases) | 21 | 120 |
| Unit (storage + pipe + controller) | 3 | 24 |
| Unit (OCR adapter + queue + worker) | 3 | 12 |
| Integration (repositorios reales) | 4 | 36 |
| NestJS base | 1 | 1 |
| **Total** | **32** | **193** |

> Nota: el recuento en la sesión fue 165 tests (sin contar los 36 de integración que corren en suite separada).

**Commit de cierre:**
```
feat(ocr+queue): add Tesseract OCR, ProcessInvoiceUseCase and BullMQ worker
```

---

### FASE 7 — Extracción LLM con Google AI Studio

**¿Qué hicimos?**

Completamos el flujo de extracción de datos de facturas integrando un modelo de lenguaje (LLM) como segunda etapa tras el OCR. El texto crudo que devuelve Tesseract se envía a Google AI Studio (Gemini), que extrae 7 campos estructurados. Si ambas etapas tienen éxito, la factura pasa a `READY_FOR_APPROVAL` automáticamente.

---

#### Bloque 1 — `LLMError` y `LLMPort`

**`LLMError`** es el error de dominio para fallos del LLM. Hereda de `DomainError` con `code: 'LLM_ERROR'`. Vive en `src/domain/errors/llm.errors.ts` y se exporta desde `src/domain/errors/index.ts`.

**`LLMPort`** es la interfaz del puerto LLM en `src/application/ports/llm.port.ts`. Define el contrato que cualquier adaptador LLM debe cumplir:

```typescript
export interface LLMExtractionResult {
  total: number | null;
  fecha: string | null;         // formato 'YYYY-MM-DD'
  numeroFactura: string | null;
  nifEmisor: string | null;
  nombreEmisor: string | null;
  baseImponible: number | null;
  iva: number | null;
}

export interface LLMPort {
  extractInvoiceData(ocrText: string): Promise<Result<LLMExtractionResult, LLMError>>;
}

export const LLM_TOKEN = 'LLMPort';
```

Todos los campos son `null`able — el LLM puede no encontrar alguno en una factura concreta. Devuelve `Result<LLMExtractionResult, LLMError>`, nunca lanza excepciones.

---

#### Bloque 2 — `AIStudioAdapter`

`AIStudioAdapter` implementa `LLMPort` usando `@google/generative-ai` (el SDK oficial de Google). Vive en `src/infrastructure/llm/ai-studio.adapter.ts`.

**Flujo interno:**

```
ocrText → buildPrompt(ocrText) → Gemini API → rawText (JSON string)
         → JSON.parse() → ExtractionSchema.safeParse() → LLMExtractionResult
```

**Prompt en español:** el adaptador construye un prompt que instruye al modelo a devolver exactamente un JSON con los 7 campos, usando `null` cuando no encuentre un campo. El prompt indica reglas de formato: `fecha` en ISO `YYYY-MM-DD`, `total` y `baseImponible` como números decimales, `iva` como porcentaje numérico.

**Validación con Zod:** la respuesta del modelo se valida con `ExtractionSchema`. Esto garantiza que el JSON que devuelve el LLM tiene la forma exacta esperada antes de devolverlo como `LLMExtractionResult`. Si el LLM devuelve campos como strings en lugar de números, Zod los coerciona automáticamente.

**Fast-fail sin API key:** si `AISTUDIO_API_KEY` está vacía, el adaptador devuelve `Err(LLMError)` inmediatamente sin hacer ninguna llamada de red. La app arranca sin la key (es opcional en el schema de configuración), pero el procesamiento de facturas fallará hasta que se configure.

```typescript
if (!this.apiKey) {
  return err(new LLMError('AISTUDIO_API_KEY no está configurada...'));
}
```

**Modelo configurable:** el modelo concreto (`gemini-1.5-flash` por defecto) se pasa como parámetro del constructor y se lee de la variable de entorno `AISTUDIO_MODEL`. Cambiarlo no requiere modificar código.

---

#### Bloque 3 — `ExtractedData` y `ProcessInvoiceUseCase`

**`ExtractedData` actualizado** en `src/domain/entities/invoice.entity.ts`:

```typescript
export interface ExtractedData {
  rawText: string;
  total: number | null;
  fecha: string | null;
  numeroFactura: string | null;
  nifEmisor: string | null;
  nombreEmisor: string | null;
  baseImponible: number | null;
  iva: number | null;
}
```

Reemplaza el genérico `[key: string]: unknown` por los 7 campos explícitos. Ahora TypeScript conoce exactamente qué campos hay en los datos extraídos.

**`ProcessInvoiceUseCase` extendido** con `LLMPort` como 5º parámetro. El nuevo flujo completo:

```
1. Busca la factura por ID
2. PENDING → PROCESSING
3. Recupera el PDF del storage
4. OCR (OcrPort) — si falla → VALIDATION_FAILED, fin
5. LLM extraction (LLMPort) — si falla → VALIDATION_FAILED, fin
6. PROCESSING → EXTRACTED (con rawText + 7 campos LLM)
7. EXTRACTED → READY_FOR_APPROVAL
8. Persiste
9. Registra auditoría
```

Si OCR falla, el LLM no se llama. Si LLM falla, la factura queda en `VALIDATION_FAILED` con el mensaje de error del LLM.

---

#### Bloque 4 — `InvoiceMapper` actualizado

El mapper en `src/infrastructure/db/mappers/invoice.mapper.ts` lee el JSONB de PostgreSQL campo a campo con tipos explícitos:

```typescript
const raw = orm.extractedData as Record<string, unknown> | null;
const extractedData: ExtractedData | null = raw
  ? {
      rawText: (raw['rawText'] as string) ?? '',
      total: (raw['total'] as number | null) ?? null,
      // ...los 7 campos
    }
  : null;
```

No hay migración nueva — los 7 campos LLM van dentro del campo `extracted_data` de tipo JSONB que ya existía en la tabla `invoices`. JSONB puede almacenar cualquier estructura JSON, por lo que añadir campos no requiere cambiar el schema de la base de datos.

---

#### Bloque 5 — Wiring en `JobsModule`

`AIStudioAdapter` se inyecta en `jobs.module.ts` bajo `LLM_TOKEN`. Lee la API key y el modelo desde `ConfigService` (que a su vez los lee del `.env` validado por Zod):

```typescript
{
  provide: LLM_TOKEN,
  useFactory: (config: ConfigService) => {
    const apiKey = config.get<string>('AISTUDIO_API_KEY') ?? '';
    const model = config.get<string>('AISTUDIO_MODEL') ?? 'gemini-1.5-flash';
    return new AIStudioAdapter(apiKey, model);
  },
  inject: [ConfigService],
},
```

`ProcessInvoiceUseCase` se construye ahora con 5 parámetros:

```typescript
useFactory: (invoiceRepo, storage, ocr, auditor, llm) =>
  new ProcessInvoiceUseCase(invoiceRepo, storage, ocr, auditor, llm),
inject: ['InvoiceRepository', STORAGE_TOKEN, OCR_TOKEN, AUDIT_TOKEN, LLM_TOKEN],
```

**Para usar la extracción LLM real,** añade al `.env`:

```
AISTUDIO_API_KEY=tu-api-key-de-google-ai-studio
AISTUDIO_MODEL=gemini-1.5-flash
```

Sin la key, el sistema sigue funcionando pero las facturas quedarán en `VALIDATION_FAILED` con mensaje explicativo.

---

**Resumen de tests al cerrar FASE 7:**

| Categoría | Archivos | Tests |
|---|---|---|
| Unit (domain + use cases) | 22 | 131 |
| Unit (storage + pipe + controller) | 3 | 24 |
| Unit (OCR + LLM + queue + worker) | 4 | 19 |
| Integration (repositorios reales) | 4 | 36 |
| NestJS base | 1 | 1 |
| **Total** | **34** | **211** |

**Commit de cierre:**
```
feat(llm): add AIStudioAdapter, LLM extraction in ProcessInvoiceUseCase
```

---

### FASE 8 — Autenticación JWT + roles + guards

**¿Qué hicimos?**

Hasta este punto, cualquier persona podía llamar a `POST /api/v1/invoices/upload` sin identificarse. La API no tenía ningún mecanismo de autenticación ni de control de acceso. En esta fase lo añadimos todo:

- **Autenticación**: verificamos que quien llama a la API es quien dice ser, usando JWT (JSON Web Tokens).
- **Autorización**: verificamos que el usuario autenticado tiene permiso para hacer lo que intenta, usando RBAC (Role-Based Access Control).

Al cerrar esta fase, la API tiene un sistema de login completo con tokens de acceso y refresh, cookies HttpOnly, revocación de tokens en Redis y control de acceso por roles en cada endpoint.

---

#### ¿Qué es un JWT? ¿Por qué no usar sesiones?

Un **JWT (JSON Web Token)** es una cadena de texto en tres partes separadas por puntos:

```
eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyIsInJvbGUiOiJ1cGxvYWRlciJ9.Xsv3...
     HEADER                          PAYLOAD                              SIGNATURE
```

- **Header**: indica el algoritmo de firma (`HS256` = HMAC-SHA256).
- **Payload**: contiene los datos del usuario (`sub` = userId, `role`, `iat` = issued at, `exp` = expires at). Estos datos son visibles — no están cifrados, solo codificados en Base64.
- **Signature**: firma HMAC que garantiza que el token no ha sido manipulado. Se genera con el `JWT_SECRET` que solo conoce el servidor.

**¿Por qué JWT y no sesiones?**

Con sesiones, el servidor guarda el estado de cada usuario autenticado en memoria o en base de datos. Con JWT, el token es **autocontenido** — el servidor puede verificar la identidad leyendo el token sin consultar ninguna base de datos (basta con verificar la firma con el `JWT_SECRET`). Esto hace el sistema más escalable y más fácil de distribuir entre múltiples instancias del servidor.

El trade-off: un JWT no se puede "revocar" antes de su expiración... a menos que uses una lista de tokens revocados en Redis, que es exactamente lo que hacemos con los refresh tokens.

---

#### ¿Qué son el access token y el refresh token?

Usamos dos tokens con responsabilidades distintas:

| | Access Token | Refresh Token |
|---|---|---|
| **Duración** | 15 minutos | 7 días |
| **Dónde vive** | Header `Authorization: Bearer <token>` | Cookie HttpOnly |
| **Para qué sirve** | Autenticar cada petición a la API | Obtener un nuevo access token cuando el actual expira |
| **Se puede revocar?** | No (expira solo) | Sí (se borra de Redis en logout) |

**¿Por qué el access token dura solo 15 minutos?**

Si alguien intercepta tu access token, solo puede usarlo durante 15 minutos. Si durase días, sería un desastre de seguridad.

**¿Por qué el refresh token vive en una cookie HttpOnly?**

Una cookie `HttpOnly` es una cookie que el navegador envía automáticamente en cada petición pero que el código JavaScript de la página **no puede leer**. Esto la hace inmune a ataques XSS (Cross-Site Scripting), donde código malicioso inyectado en la página intenta robar tokens del `localStorage`.

Si el access token estuviese en `localStorage`, cualquier script malicioso podría leerlo con `localStorage.getItem('token')`. En una cookie HttpOnly, eso es imposible.

---

#### Bloque 1 — `JwtStrategy`: cómo NestJS verifica el JWT en cada petición

`JwtStrategy` es la pieza que Passport (la librería de autenticación) usa para verificar el token en cada petición autenticada.

```typescript
// packages/backend/src/interface/http/guards/jwt.strategy.ts

export interface JwtPayload {
  sub: string;   // userId (estándar RFC 7519: "subject")
  role: string;
  iat?: number;  // issued at
  exp?: number;  // expires at
}

export interface AuthenticatedUser {
  userId: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? '',
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return { userId: payload.sub, role: payload.role };
  }
}
```

**¿Qué hace exactamente Passport cuando llega una petición protegida?**

```
1. Passport extrae el token del header: Authorization: Bearer eyJ...
2. Verifica la firma con JWT_SECRET (si es inválida → 401 automático)
3. Comprueba que no ha expirado (si expiró → 401 automático)
4. Llama a validate(payload) con los datos decodificados del token
5. El valor retornado por validate() se escribe en req.user
```

El método `validate()` simplemente renombra `sub → userId`. El campo `sub` es el estándar RFC 7519 para el identificador del sujeto del token, pero en el resto del código queremos decir `userId` (más legible). Esta traducción ocurre aquí y solo aquí.

**¿Por qué `PassportStrategy(Strategy, 'jwt')` y no directamente `Strategy`?**

`PassportStrategy` es el decorador de NestJS que integra Passport con el sistema de inyección de dependencias. El segundo argumento `'jwt'` es el nombre con que se registra esta estrategia. Más tarde, `AuthGuard('jwt')` usa ese mismo nombre para buscar la estrategia correcta.

---

#### Bloque 2 — `JwtAuthGuard`: el guardián de cada endpoint protegido

Un **Guard** en NestJS es una clase que decide si una petición puede continuar hacia el handler del controlador o se bloquea. Se ejecuta después de los middlewares pero antes de los pipes y el handler.

```typescript
// packages/backend/src/interface/http/guards/jwt-auth.guard.ts

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  override handleRequest<TUser = any>(err: any, user: any): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Invalid or missing access token');
    }
    return user as TUser;
  }
}
```

**¿Por qué extender `AuthGuard('jwt')` en lugar de usarlo directamente?**

El `AuthGuard('jwt')` de Passport, cuando el token es inválido o está ausente, por defecto devuelve `null` en el parámetro `user` del método `handleRequest`. Si no sobreescribes ese método, el guard permitirá que la petición continúe con `req.user = undefined`. El error aparecería mucho más tarde, en algún punto inesperado del código.

Sobreescribir `handleRequest` nos permite **fallar inmediatamente** con un error claro: `UnauthorizedException('Invalid or missing access token')` → HTTP 401.

**Cómo se aplica el guard:**

```typescript
// A nivel de controlador — protege TODOS los endpoints de la clase:
@Controller('api/v1/invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController { ... }

// A nivel de endpoint individual — protege solo ese método:
@Post('refresh')
@UseGuards(JwtAuthGuard)
async refresh(...) { ... }
```

---

#### Bloque 3 — `@Roles()` y `RolesGuard`: control de acceso por rol

La autenticación responde "¿quién eres?". La autorización responde "¿qué puedes hacer?".

**`@Roles()` — el decorador que marca qué roles pueden acceder:**

```typescript
// packages/backend/src/interface/http/guards/roles.decorator.ts

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRoleValue[]) =>
  SetMetadata(ROLES_KEY, roles);
```

`SetMetadata` es una función de NestJS que adjunta metadatos a un handler o clase. Es como pegar una etiqueta invisible en el endpoint:

```typescript
@Patch(':id/approve')
@Roles('approver', 'admin')   // ← etiqueta: "solo approver y admin"
async approve(...) { ... }
```

**`RolesGuard` — el guard que lee esa etiqueta y comprueba el rol del usuario:**

```typescript
// packages/backend/src/interface/http/guards/roles.guard.ts

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Lee los roles requeridos de los metadatos del endpoint
    const requiredRoles = this.reflector.getAllAndOverride<UserRoleValue[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],  // busca en el método, luego en la clase
    );

    // 2. Si no hay @Roles(), cualquier usuario autenticado puede pasar
    if (!requiredRoles || requiredRoles.length === 0) return true;

    // 3. Lee el usuario autenticado que JwtAuthGuard escribió en req.user
    const { user } = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();

    // 4. Comprueba si el rol del usuario está en la lista de roles permitidos
    if (!user || !requiredRoles.includes(user.role as UserRoleValue)) {
      throw new ForbiddenException(`Requires one of roles: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
```

**`getAllAndOverride` vs `getAllAndMerge`:**

- `getAllAndOverride`: busca primero en el método, luego en la clase. Si el método tiene `@Roles()`, usa esos. Si no, usa los de la clase. El primero que encuentra "gana".
- `getAllAndMerge`: combina los roles de método y clase. No lo usamos porque queremos que el decorador en el método sobreescriba el de la clase, no que se sumen.

**Registro global del `RolesGuard`:**

```typescript
// packages/backend/src/app.module.ts
providers: [
  {
    provide: APP_GUARD,
    useClass: RolesGuard,
  },
],
```

`APP_GUARD` es un token especial de NestJS que registra el guard como **global** — se aplica automáticamente a todos los endpoints de toda la aplicación sin necesidad de añadir `@UseGuards(RolesGuard)` en cada controlador.

**Orden de ejecución de los guards:** `JwtAuthGuard` (verifica el token) se ejecuta antes que `RolesGuard` (verifica el rol). Esto es importante: el `RolesGuard` necesita que `req.user` esté poblado, lo cual solo ocurre si `JwtAuthGuard` pasó primero. Si no hay token válido, `JwtAuthGuard` lanza el 401 antes de que `RolesGuard` llegue a ejecutarse.

---

#### Bloque 4 — `@CurrentUser()`: el decorador que extrae el usuario del request

En lugar de acceder a `req.user` manualmente en cada método del controlador, creamos un decorador de parámetro que lo hace por nosotros:

```typescript
// packages/backend/src/interface/http/guards/current-user.decorator.ts

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
```

Uso en el controlador:

```typescript
// Sin @CurrentUser() — verbose y acoplado a Express
async approve(@Req() req: Request, @Param('id') id: string) {
  const user = req.user as AuthenticatedUser;
  // ...
}

// Con @CurrentUser() — limpio y tipado
async approve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
  // user.userId y user.role ya están disponibles directamente
}
```

La ventaja es doble: el código es más limpio, y en los tests del controlador es más fácil de mockear — no necesitas un objeto `Request` completo, solo puedes inyectar `{ user: { userId: 'x', role: 'approver' } }` directamente.

---

#### Bloque 5 — `AuthController`: los tres endpoints de autenticación

```typescript
// packages/backend/src/interface/http/controllers/auth.controller.ts

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',  // solo HTTPS en producción
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,               // 7 días en milisegundos
  path: '/',
};
```

**`POST /api/v1/auth/login`:**

```typescript
@Post('login')
@HttpCode(HttpStatus.OK)
@Throttle({ default: { limit: 5, ttl: 60000 } })  // máx. 5 intentos por minuto por IP
async login(
  @Body(new ZodValidationPipe(LoginInputSchema)) body: LoginInput,
  @Res({ passthrough: true }) res: Response,
) {
  const result = await this.loginUseCase.execute(body);
  if (result.isErr()) throw new UnauthorizedException(result.error.message);

  const { accessToken, refreshToken, userId, role } = result.value;
  res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
  return { data: { accessToken, userId, role } };
}
```

Puntos clave:
- `@Throttle({ default: { limit: 5, ttl: 60000 } })`: limita a 5 intentos por minuto por IP. Protege contra ataques de fuerza bruta.
- `@Res({ passthrough: true })`: NestJS necesita el objeto `res` de Express para setear la cookie, pero con `passthrough: true` sigue gestionando la serialización del return value. Sin `passthrough: true`, tendrías que llamar a `res.json(...)` manualmente.
- El `accessToken` va en el body JSON (para que el frontend lo use en el header `Authorization`).
- El `refreshToken` va en la cookie HttpOnly (para que el navegador lo envíe automáticamente y JavaScript no pueda leerlo).

**`POST /api/v1/auth/refresh`:**

```typescript
@Post('refresh')
@HttpCode(HttpStatus.OK)
@UseGuards(JwtAuthGuard)
async refresh(
  @CurrentUser() user: AuthenticatedUser,
  @Req() req: Request,
) {
  const cookies = req.cookies as Record<string, string> | undefined;
  const refreshToken = cookies?.['refreshToken'];

  if (!refreshToken) throw new UnauthorizedException('No refresh token');

  const result = await this.refreshTokenUseCase.execute({
    userId: user.userId,
    refreshToken,
  });

  if (result.isErr()) throw new UnauthorizedException(result.error.message);
  return { data: { accessToken: result.value.accessToken } };
}
```

¿Por qué este endpoint requiere `JwtAuthGuard` si el access token ha expirado? Porque el frontend llama a `/refresh` cuando el access token está **a punto** de expirar (por ejemplo, 1 minuto antes), no cuando ya ha expirado. Si el access token ya caducó, el usuario necesita hacer login de nuevo.

**`POST /api/v1/auth/logout`:**

```typescript
@Post('logout')
@HttpCode(HttpStatus.NO_CONTENT)
@UseGuards(JwtAuthGuard)
async logout(
  @CurrentUser() user: AuthenticatedUser,
  @Res({ passthrough: true }) res: Response,
) {
  await this.logoutUseCase.execute({ userId: user.userId });
  res.clearCookie('refreshToken', { path: '/' });
}
```

El `LogoutUseCase` borra el refresh token de Redis. La cookie se limpia con `clearCookie`. A partir de ese momento, aunque alguien tuviese el refresh token, Redis lo rechazaría porque ya no existe en la lista de tokens válidos.

---

#### Bloque 6 — `AuthModule`: conectar todas las piezas

`AuthModule` es el módulo de NestJS que registra todos los proveedores de autenticación:

```
AuthModule
  imports:
    - PassportModule           ← integración NestJS + Passport
    - JwtModule.registerAsync  ← configura la firma JWT con JWT_SECRET del entorno
    - DatabaseModule           ← acceso a UserTypeOrmRepository, UserCredentialTypeOrmRepository
  providers:
    - JwtStrategy              ← estrategia de verificación de tokens
    - LOGIN_USE_CASE_TOKEN     → LoginUseCase
    - REFRESH_TOKEN_USE_CASE_TOKEN → RefreshTokenUseCase
    - LOGOUT_USE_CASE_TOKEN    → LogoutUseCase
    - TOKEN_STORE_TOKEN        → RedisTokenStoreAdapter
  controllers:
    - AuthController
```

**`JwtModule.registerAsync`:**

```typescript
JwtModule.registerAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    secret: configService.get<string>('JWT_SECRET'),
    signOptions: { expiresIn: '15m' },
  }),
  inject: [ConfigService],
}),
```

`registerAsync` en lugar de `register` porque necesitamos leer el secret del `ConfigService` (que a su vez lo lee del `.env`). Si usásemos `register({ secret: process.env.JWT_SECRET })`, el valor se leería en el momento de definir el módulo (antes de que NestJS haya inicializado el `ConfigModule`), lo que podría resultar en `undefined`.

---

#### Bloque 7 — `UserCredentialOrmEntity` y bcrypt

Las credenciales de usuario están en una tabla separada de los usuarios:

```typescript
// packages/backend/src/infrastructure/db/entities/user-credential.orm-entity.ts
@Entity('user_credentials')
export class UserCredentialOrmEntity {
  @PrimaryColumn('uuid')
  userId: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @OneToOne(() => UserOrmEntity)
  @JoinColumn({ name: 'user_id' })
  user: UserOrmEntity;
}
```

Las contraseñas se almacenan hasheadas con **bcrypt** (salt rounds: 12). Bcrypt es una función de hash diseñada específicamente para contraseñas: es lenta por diseño (para dificultar ataques de fuerza bruta) y añade un salt aleatorio (para que dos usuarios con la misma contraseña tengan hashes distintos).

```typescript
// Al crear usuario:
const hash = await bcrypt.hash(password, 12);

// Al verificar login:
const isValid = await bcrypt.compare(plainPassword, storedHash);
```

Nunca se guarda la contraseña en texto plano. Nunca. Ni en la base de datos ni en los logs.

---

#### Problemas encontrados en FASE 8 y cómo se resolvieron

**1. `@Throttle` requería configuración del módulo `ThrottlerModule`**

El decorador `@Throttle` de `@nestjs/throttler` solo funciona si `ThrottlerModule` está importado en el módulo raíz. Sin él, NestJS lanza un error al arrancar porque el guard `ThrottlerGuard` no encuentra su configuración.

Solución: importar `ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])` en `AppModule` como configuración base, y sobreescribir en el endpoint específico de login con `@Throttle({ default: { limit: 5, ttl: 60000 } })`.

**2. `cookieParser` no estaba instalado**

El método `req.cookies` devolvía `undefined` porque el middleware `cookie-parser` no estaba registrado. NestJS no lo instala por defecto — es un middleware de Express que hay que añadir explícitamente.

Solución: `pnpm --filter backend add cookie-parser` + `pnpm --filter backend add -D @types/cookie-parser` + `app.use(cookieParser())` en `main.ts`.

**3. El `RedisTokenStoreAdapter` necesitaba el cliente de ioredis**

`ioredis` no estaba instalado. BullMQ usa Redis internamente pero no expone su cliente. Hay que instalar `ioredis` por separado para poder crear el cliente propio que usa el `TokenStoreAdapter`.

Solución: `pnpm --filter backend add ioredis` + `pnpm --filter backend add -D @types/ioredis`.

---

#### Decisiones de diseño registradas (FASE 8)

| Decisión | Elección | Motivo |
|---|---|---|
| Librería auth | Passport + `@nestjs/passport` | Integración nativa con NestJS; soporta múltiples estrategias (local, JWT, OAuth) con el mismo patrón |
| Access token | JWT en `Authorization: Bearer` header | Estándar de facto para APIs REST; el frontend lo envía en cada petición |
| Refresh token | JWT en cookie HttpOnly | Inmune a XSS; el navegador lo envía automáticamente; JavaScript no puede leerlo |
| Revocación refresh token | Redis (lista de tokens válidos) | Redis ya está en el stack para BullMQ; sin coste adicional de infraestructura |
| Duración access token | 15 minutos | Ventana de exposición pequeña si es interceptado |
| Duración refresh token | 7 días | Balance entre UX y seguridad |
| Rate limiting login | 5 req/min por IP | Previene ataques de fuerza bruta sin bloquear usuarios legítimos |
| Bcrypt salt rounds | 12 | Suficientemente lento para dificultar brute force, suficientemente rápido para UX |
| `RolesGuard` global | `APP_GUARD` en AppModule | Elimina el ruido de `@UseGuards(RolesGuard)` en cada controlador; no se puede olvidar |

---

**Resumen de tests al cerrar FASE 8:**

| Categoría | Archivos | Tests |
|---|---|---|
| Unit (domain + use cases) | 22 | 131 |
| Unit (controllers + guards + pipes) | 4 | 30 |
| Unit (OCR + LLM + queue + worker) | 4 | 19 |
| Integration (repositorios reales) | 4 | 36 |
| NestJS base | 1 | 1 |
| **Total** | **35** | **217** |

**Commit de cierre:**
```
feat(auth): implement JWT auth with roles and guards (FASE 8)
```

---

### FASE 9 — Controllers HTTP completos + Zod pipes + EventBus + Outbox pattern

**¿Qué hicimos?**

La FASE 9 es la más extensa de todo el proyecto hasta ahora. Conecta tres capas distintas en un único sprint:

1. **Capa HTTP**: los controllers REST completos con todos los endpoints de facturas, un filtro global de errores de dominio, y un pipe de validación Zod reutilizable.
2. **Capa de aplicación**: los use cases de aprobación y rechazo se refactorizan para publicar domain events.
3. **Capa de eventos**: implementamos el patrón Outbox (garantía de entrega de eventos aunque la app se caiga) y los handlers no-op preparados para las notificaciones de FASE 11.

Al cerrar esta fase, la API REST es completamente funcional: se pueden subir facturas, listarlas, verlas en detalle, aprobarlas, rechazarlas, y consultar el historial de estados. Todo protegido con JWT y RBAC.

---

#### Bloque 1 — `DomainErrorFilter`: convertir errores de dominio en respuestas HTTP correctas

**El problema que resuelve:**

Los use cases devuelven `Result<T, DomainError>`. Los controllers hacen `throw result.error` cuando hay un error. Sin nada más, NestJS no sabe qué hacer con un `DomainError` (no es una `HttpException`) y lo convierte en un 500 genérico. Pero `InvoiceNotFoundError` debería ser un 404, `InvalidStateTransitionError` debería ser un 409, etc.

El `DomainErrorFilter` es un **ExceptionFilter global** que intercepta **todas** las excepciones que llegan al HTTP layer y las convierte al código HTTP correcto.

**¿Qué es un ExceptionFilter?**

En NestJS, el flujo de una petición HTTP es:

```
Request → Middleware → Guard → Pipe → Handler → Interceptor → Response
                                          ↓ (si falla)
                                    ExceptionFilter → Response de error
```

Un `ExceptionFilter` captura cualquier excepción que ocurra en ese flujo y tiene control total sobre la respuesta de error que se devuelve al cliente.

```typescript
// packages/backend/src/interface/http/filters/domain-error.filter.ts

const DOMAIN_ERROR_STATUS_MAP: Record<string, number> = {
  // 404 — recurso no encontrado
  INVOICE_NOT_FOUND:    404,
  PROVIDER_NOT_FOUND:   404,
  USER_NOT_FOUND:       404,

  // 401 — no autenticado
  INVALID_CREDENTIALS:  401,

  // 403 — autenticado pero sin permiso
  UNAUTHORIZED:         403,

  // 409 — conflicto de estado
  INVALID_STATE_TRANSITION:    409,
  INVOICE_ALREADY_PROCESSING:  409,
  PROVIDER_ALREADY_EXISTS:     409,
  USER_ALREADY_EXISTS:         409,

  // 422 — datos semánticamente inválidos (reglas de negocio)
  INVALID_FIELD:              422,
  VALIDATION_FAILED:          422,
  INVALID_INVOICE_AMOUNT:     422,
  INVALID_INVOICE_STATUS:     422,
  INVALID_INVOICE_DATE:       422,
  INVALID_TAX_ID:             422,
  INVALID_PROVIDER_NAME:      422,
};

@Catch()  // sin argumentos → captura TODAS las excepciones
export class DomainErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    // ── Camino 1: HttpException de NestJS (BadRequestException, ForbiddenException, etc.)
    // Estas ya tienen el código HTTP correcto — las pasamos sin modificar
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res.status(status).json(body);
      return;
    }

    // ── Camino 2: DomainError — mapear el código al HTTP status correcto
    if (exception instanceof DomainError) {
      const status = DOMAIN_ERROR_STATUS_MAP[exception.code] ?? 500;

      if (status >= 500) {
        this.logger.error(`Unhandled DomainError [${exception.code}]: ${exception.message}`);
      }

      res.status(status).json({
        error: {
          code: exception.code,
          message: exception.message,
        },
      });
      return;
    }

    // ── Camino 3: Error completamente inesperado → 500 genérico
    // El mensaje real se loguea en el servidor pero NO se expone al cliente
    const errMessage = exception instanceof Error ? exception.message : String(exception);
    this.logger.error(`Unhandled exception: ${errMessage}`);

    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}
```

**Los tres caminos del filtro explicados:**

- **Camino 1 (HttpException)**: cuando un Guard lanza `ForbiddenException`, o un Pipe lanza `BadRequestException`, o el controller lanza `UnauthorizedException` manualmente — estas ya son excepciones de NestJS con el código HTTP correcto. El filtro las respeta y las deja pasar sin modificar.

- **Camino 2 (DomainError)**: cuando el controller hace `throw result.error` y ese error es un `InvoiceNotFoundError`, el filtro busca `'INVOICE_NOT_FOUND'` en el mapa y devuelve un 404 con `{ error: { code: 'INVOICE_NOT_FOUND', message: '...' } }`.

- **Camino 3 (cualquier otra cosa)**: un error de base de datos inesperado, un null pointer, lo que sea. El mensaje real se loguea en el servidor (para que el desarrollador pueda investigar) pero el cliente solo recibe `'An unexpected error occurred'` — nunca se expone el stack trace ni información interna.

**Registro en `main.ts`:**

```typescript
app.useGlobalFilters(new DomainErrorFilter());
```

`useGlobalFilters` registra el filtro globalmente — intercepta excepciones de toda la aplicación.

---

#### Bloque 1b — `main.ts`: seguridad HTTP en el arranque

`main.ts` es el punto de entrada de la aplicación. En FASE 9 añadimos tres configuraciones de seguridad:

```typescript
// packages/backend/src/main.ts

async function bootstrap() {
  validateConfig();  // falla rápido si faltan variables de entorno
  const app = await NestFactory.create(AppModule);

  // ── 1. Helmet: cabeceras de seguridad HTTP ───────────────────────────
  app.use(helmet());

  // ── 2. CORS: solo permite peticiones del frontend configurado ────────
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,                            // permite enviar cookies
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],  // métodos permitidos
  });

  // ── 3. Cookie parser: necesario para leer la cookie del refreshToken ─
  app.use(cookieParser());

  // ── 4. Filtro global de errores de dominio ───────────────────────────
  app.useGlobalFilters(new DomainErrorFilter());

  await app.listen(process.env.PORT ?? 3000);
}
```

**¿Qué hace `helmet()`?**

Helmet es un middleware que añade automáticamente ~15 cabeceras de seguridad HTTP. Algunas de las más importantes:

| Cabecera | Protección |
|---|---|
| `Content-Security-Policy` | Indica al navegador de dónde puede cargar recursos; mitiga XSS |
| `Strict-Transport-Security` | Fuerza HTTPS; el navegador no intentará HTTP |
| `X-Content-Type-Options: nosniff` | El navegador no "adivina" el tipo MIME de un recurso |
| `X-Frame-Options: SAMEORIGIN` | Previene clickjacking (la página no puede cargarse en un iframe externo) |

Una sola línea `app.use(helmet())` activa todo esto.

**¿Por qué CORS con `credentials: true`?**

Sin `credentials: true`, el navegador no enviará cookies en peticiones cross-origin. Y el refresh token vive en una cookie. Sin esta configuración, el logout (y el refresh) no funcionarían desde el frontend.

---

#### Bloque 1c — `ZodValidationPipe`: validación reutilizable con Zod

```typescript
// packages/backend/src/interface/http/pipes/zod-validation.pipe.ts

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body validation failed',
          details: result.error.flatten().fieldErrors,
        },
      });
    }
    return result.data;
  }
}
```

Este pipe es **genérico**: recibe cualquier `ZodSchema` en el constructor y valida el valor que pasa por él. Se usa así:

```typescript
// En el body de una petición JSON:
@Body(new ZodValidationPipe(LoginInputSchema)) body: LoginInput

// En los query params:
@Query(new ZodValidationPipe(ListInvoicesQuerySchema)) query: ListInvoicesQuery

// En el body de un PATCH:
@Body(new ZodValidationPipe(RejectBodySchema)) body: RejectBody
```

Si la validación falla, NestJS lanza un `400 Bad Request` con los errores campo a campo:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body validation failed",
    "details": {
      "reason": ["reason is required"]
    }
  }
}
```

---

#### Bloque 2 — `GET /invoices` y `GET /invoices/:id`: listado y detalle

**El problema de los query params como strings:**

Los query params de HTTP siempre llegan como strings, incluso si el valor es un número. Si el usuario pide `GET /invoices?page=2&limit=20`, el servidor recibe `{ page: "2", limit: "20" }` — strings, no números.

El schema de la capa de aplicación (`ListInvoicesInput`) usa `z.number()`. Si pasásemos directamente `"2"` a un campo `z.number()`, Zod lo rechazaría porque `"2"` es un string, no un número.

Por eso en el controller definimos un schema específico para la capa HTTP con `z.coerce.number()`:

```typescript
// Solo en el controller — este schema no existe en la capa de aplicación
const ListInvoicesQuerySchema = z.object({
  status: z.string().optional(),
  page:   z.coerce.number().int().min(1).default(1),    // "2" → 2
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  sort:   z.string().optional(),
});
```

`z.coerce.number()` convierte automáticamente `"20"` al número `20` antes de validar. Esto es específico de HTTP — no contamina los DTOs de la capa de aplicación que trabajan con tipos ya parseados.

**RBAC en el listado:**

```typescript
@Get()
@Roles('uploader', 'validator', 'approver', 'admin')
async list(
  @CurrentUser() user: AuthenticatedUser,
  @Query(new ZodValidationPipe(ListInvoicesQuerySchema)) query: ListInvoicesQuery,
) {
  const result = await this.listInvoicesUseCase.execute({
    requesterId: user.userId,
    requesterRole: user.role as 'uploader' | 'validator' | 'approver' | 'admin',
    status: query.status,
    page: query.page,
    limit: query.limit,
    sort: query.sort,
  });
  // ...
  return { data: items, meta: { total, page, limit } };
}
```

El controller pasa `requesterId` y `requesterRole` al use case. La decisión de qué facturas devolver vive en el use case, no en el controller:

- Si `requesterRole === 'uploader'` → `invoiceRepo.findByUploaderId(requesterId, filters)` (solo las suyas)
- Si rol superior → `invoiceRepo.findAll(filters)` (todas)

Esta lógica está en el use case, no en el controller, porque es **lógica de negocio** (quién puede ver qué) y no lógica de HTTP.

**Registro global del `RolesGuard` en `AppModule`:**

```typescript
// packages/backend/src/app.module.ts
providers: [
  AppService,
  {
    provide: APP_GUARD,
    useClass: RolesGuard,
  },
],
```

Con `APP_GUARD`, el `RolesGuard` se ejecuta en **cada petición** de toda la aplicación sin excepciones. Los endpoints sin `@Roles()` permiten el paso de cualquier usuario autenticado (el guard devuelve `true` cuando no hay metadatos de roles).

---

#### Bloque 3a — Domain events y el patrón Outbox: ¿por qué y cómo?

**El problema que necesitábamos resolver:**

Cuando se aprueba una factura, deben ocurrir dos cosas:
1. El estado de la factura cambia a `APPROVED` en la base de datos.
2. Se envía una notificación (email, webhook, lo que sea).

La implementación naive sería:

```typescript
// ❌ Incorrecto — acoplado y sin garantías
await invoiceRepo.save(invoice);           // 1. guardar
await notifier.sendEmail(invoice.getId()); // 2. notificar
```

Problema: si la aplicación se cae entre el paso 1 y el paso 2, la factura queda aprobada en la base de datos pero la notificación nunca se envía. No hay forma de saberlo ni de recuperarse automáticamente.

**¿Qué es el patrón Outbox?**

El patrón Outbox (o Transactional Outbox) resuelve este problema guardando el evento en la misma base de datos que el estado, de forma que sobrevive a fallos de la aplicación:

```
ANTES (sin Outbox):
1. invoiceRepo.save(invoice)     ← éxito
2. app.crash() 💥
3. notifier.sendEmail()          ← nunca se ejecuta → notificación perdida

DESPUÉS (con Outbox):
1. invoiceRepo.save(invoice)     ← éxito
2. outboxRepo.save(event)        ← éxito (guardado en la misma DB)
3. app.crash() 💥                ← el evento sobrevive en la DB
4. [app se reinicia, 10s después]
5. OutboxPollerWorker lee el evento con processed=false
6. Publica el evento en EventEmitter2
7. El handler lo procesa (en FASE 11: envía el email)
8. outboxRepo.markProcessed(event.id)
```

El evento es duradero porque está en la base de datos, no en memoria. Aunque la app se caiga mil veces, el evento se procesará eventualmente.

**¿Por qué "at-least-once delivery" y no "exactly-once"?**

"At-least-once" significa que el evento se procesará al menos una vez — podría procesarse más de una vez si el poller falla entre `emitAsync` y `markProcessed`. Por eso los handlers deben ser **idempotentes**: procesar el mismo evento dos veces debe tener el mismo resultado que procesarlo una vez. En FASE 11, el handler de email verificará si ya se envió el email para ese evento antes de enviarlo de nuevo.

---

#### Bloque 3a (cont.) — Implementación: domain events, `EventBusPort`, `OutboxEventBusAdapter`

**Las clases de domain events:**

```typescript
// packages/backend/src/domain/events/domain-event.base.ts
export abstract class DomainEventBase {
  readonly occurredAt: Date;

  constructor(
    readonly eventType: string,
    readonly payload: unknown,
  ) {
    this.occurredAt = new Date();
  }
}
```

```typescript
// packages/backend/src/domain/events/invoice-approved.event.ts
export interface InvoiceApprovedPayload {
  invoiceId: string;
  approverId: string;
  status: string;
}

export class InvoiceApprovedEvent extends DomainEventBase {
  declare readonly payload: InvoiceApprovedPayload;

  constructor(payload: InvoiceApprovedPayload) {
    super('invoice.approved', payload);
  }
}
```

`declare readonly payload: InvoiceApprovedPayload` es una forma de TypeScript de "especializar" el tipo del campo `payload` heredado (que en la base es `unknown`) sin redeclararlo en JavaScript. No genera ningún código JavaScript — es solo una anotación de tipo.

**`EventBusPort`: la interfaz que usan los use cases:**

```typescript
// packages/backend/src/application/ports/event-bus.port.ts
export interface EventBusPort {
  publish(event: DomainEventBase): Promise<void>;
}

export const EVENT_BUS_TOKEN = 'EVENT_BUS_TOKEN';
```

Los use cases dependen de esta interfaz. No saben si el evento se guarda en una base de datos, se envía a Kafka, o se descarta. Esto aplica la **D de SOLID**: dependemos de la abstracción, no de la implementación.

**`OutboxEventBusAdapter`: la implementación que persiste en la DB:**

```typescript
// packages/backend/src/infrastructure/events/outbox-event-bus.adapter.ts
@Injectable()
export class OutboxEventBusAdapter implements EventBusPort {
  private readonly logger = new Logger(OutboxEventBusAdapter.name);

  constructor(
    @Inject(OUTBOX_EVENT_REPOSITORY)
    private readonly outboxRepo: OutboxEventRepository,
  ) {}

  async publish(event: DomainEventBase): Promise<void> {
    // NO publicamos en EventEmitter2 aquí.
    // Solo guardamos en la tabla outbox_events.
    // El OutboxPollerWorker lo publicará en EventEmitter2.
    await this.outboxRepo.save(event);
    this.logger.log(`Outbox event queued: ${event.eventType}`);
  }
}
```

La clave: `publish()` no envía el evento — lo guarda. La publicación real ocurre en el `OutboxPollerWorker` (Bloque 3b).

**La migración de `outbox_events`:**

```sql
-- packages/backend/src/infrastructure/db/migrations/1741650007000-CreateOutboxEventsTable.ts

CREATE TABLE outbox_events (
  id            UUID         NOT NULL,
  event_type    VARCHAR(100) NOT NULL,
  payload       JSONB        NOT NULL,      -- el evento completo serializado
  processed     BOOLEAN      NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ  NULL,
  CONSTRAINT pk_outbox_events PRIMARY KEY (id)
);

-- Índice parcial: SOLO indexa las filas donde processed = false.
-- Cuando un evento se marca como processed = true, desaparece del índice.
-- Esto hace que el índice sea pequeño y eficiente incluso con millones de eventos históricos.
CREATE INDEX idx_outbox_events_unprocessed
  ON outbox_events (created_at ASC)
  WHERE processed = false;
```

**¿Por qué un índice parcial?**

Sin el índice parcial, si la tabla tiene 1 millón de eventos históricos (todos con `processed = true`) y 5 pendientes (con `processed = false`), una query `WHERE processed = false` tendría que escanear el millón de filas para encontrar las 5. Con el índice parcial, el índice solo contiene las 5 filas pendientes — la query es instantánea.

**`ApproveInvoiceUseCase` y `RejectInvoiceUseCase` refactorizados:**

Antes de FASE 9, estos use cases tenían `NotificationPort` como dependencia y llamaban al notificador directamente. Ahora usan `EventBusPort` para publicar eventos y delegan la notificación al handler de eventos:

```typescript
// packages/backend/src/application/use-cases/approve-invoice.use-case.ts
export class ApproveInvoiceUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly auditor: AuditPort,
    private readonly eventBus: EventBusPort,   // ← nuevo (reemplaza NotificationPort)
  ) {}

  async execute(input: ApproveInvoiceInput) {
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) return err(new InvoiceNotFoundError(input.invoiceId));

    const approveResult = invoice.approve(input.approverId);
    if (approveResult.isErr()) return err(approveResult.error);

    await this.invoiceRepo.save(invoice);    // 1. guardar el nuevo estado

    await this.auditor.record({             // 2. registrar auditoría
      action: 'approve',
      resourceId: invoice.getId(),
      userId: input.approverId,
    });

    await this.eventBus.publish(            // 3. guardar evento en outbox_events
      new InvoiceApprovedEvent({
        invoiceId: invoice.getId(),
        approverId: input.approverId,
        status: invoice.getStatus().getValue(),
      }),
    );

    return ok({
      invoiceId: invoice.getId(),
      status: invoice.getStatus().getValue(),
      approverId: input.approverId,
    });
  }
}
```

**¿Por qué eliminar `NotificationPort` de los use cases?**

Porque los use cases no deberían saber nada sobre notificaciones. Su responsabilidad es aprobar la factura. La consecuencia de esa aprobación (enviar un email) es responsabilidad de otro componente (el handler de eventos). Esto aplica el **Principio de Responsabilidad Única**: cada clase hace una sola cosa.

---

#### Bloque 3b — `OutboxPollerWorker`: el corazón del patrón Outbox

```typescript
// packages/backend/src/interface/jobs/outbox-poller.worker.ts

@Processor(OUTBOX_POLLER_QUEUE)
@Injectable()
export class OutboxPollerWorker extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(OutboxPollerWorker.name);

  constructor(
    @Inject(OUTBOX_EVENT_REPOSITORY)
    private readonly outboxRepo: OutboxEventRepository,
    @InjectQueue(OUTBOX_POLLER_QUEUE)
    private readonly pollerQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  // Se ejecuta una vez cuando NestJS inicializa el módulo
  async onModuleInit(): Promise<void> {
    await this.pollerQueue.add(
      'poll',
      {},
      {
        repeat: { every: 10_000 },           // ejecutar cada 10 segundos
        jobId: 'outbox-poller-repeatable',   // ID fijo para deduplicación
      },
    );
    this.logger.log('OutboxPollerWorker: repeatable job registrado (cada 10s)');
  }

  // BullMQ llama a este método cada 10 segundos
  async process(_job: Job): Promise<void> {
    const events = await this.outboxRepo.findUnprocessed();

    if (events.length === 0) return; // nada que procesar

    this.logger.log(`OutboxPollerWorker: procesando ${events.length} evento(s)`);

    for (const event of events) {
      try {
        // Emite el evento en el EventEmitter2 in-process
        // Los handlers (@OnEvent) reciben el evento aquí
        await this.eventEmitter.emitAsync(event.eventType, event);

        // Solo marca como procesado si el handler no lanzó error
        await this.outboxRepo.markProcessed(event.id);

        this.logger.log(`OutboxPollerWorker: evento procesado`, {
          id: event.id,
          eventType: event.eventType,
        });
      } catch (err) {
        // Si el handler falla, logueamos y continuamos con el siguiente evento.
        // El evento fallido queda con processed = false.
        // El siguiente ciclo de 10s lo reintentará automáticamente.
        this.logger.error(
          `OutboxPollerWorker: error procesando evento ${event.id}`,
          { eventType: event.eventType, error: err instanceof Error ? err.message : String(err) },
        );
      }
    }
  }
}
```

**¿Por qué `onModuleInit` en lugar de registrar el job en el módulo?**

El Repeatable Job de BullMQ necesita la cola activa para registrarse. La cola está disponible cuando el módulo ya está inicializado. `onModuleInit` se ejecuta justo después de que NestJS inicializa el módulo — es el momento correcto.

El `jobId: 'outbox-poller-repeatable'` garantiza que aunque el servidor se reinicie muchas veces, BullMQ solo mantiene una instancia del job repetible (deduplicación por ID). Sin el `jobId`, cada arranque del servidor añadiría una nueva instancia del job, y pronto habría decenas de pollers corriendo en paralelo.

**¿Por qué el try/catch está dentro del bucle, no fuera?**

Si el try/catch estuviese fuera del bucle:

```typescript
// ❌ Si el segundo evento falla, el tercero, cuarto... nunca se procesan
try {
  for (const event of events) {
    await this.eventEmitter.emitAsync(event.eventType, event);
    await this.outboxRepo.markProcessed(event.id);
  }
} catch (err) {
  // solo logueamos y el ciclo termina aquí
}
```

Con el try/catch dentro del bucle, si el segundo evento falla, el poller sigue con el tercero, cuarto, etc. El evento fallido se reintentará en el siguiente ciclo de 10s.

**`EventEmitter2` y `emitAsync`:**

`emitAsync` es como `emit` pero espera a que todas las promesas de los handlers se resuelvan antes de continuar. Sin `async`, si un handler lanzase una excepción dentro de una promesa, el error quedaría sin capturar y el poller no sabría que falló.

**`EventEmitterModule` en `AppModule`:**

```typescript
// packages/backend/src/app.module.ts
EventEmitterModule.forRoot(),
```

Este módulo es el sistema de mensajería in-process. Los eventos no salen de la aplicación — viajan dentro del mismo proceso de Node.js desde el poller hasta los handlers. Es ligero y suficiente para FASE 9 y FASE 11.

**Handlers no-op (preparados para FASE 11):**

```typescript
// packages/backend/src/infrastructure/events/handlers/invoice-approved.handler.ts

@Injectable()
export class InvoiceApprovedHandler {
  private readonly logger = new Logger(InvoiceApprovedHandler.name);

  @OnEvent('invoice.approved', { async: true })
  async handle(event: InvoiceApprovedEvent): Promise<void> {
    // FASE 9: solo logueamos — no hacemos nada
    this.logger.log('invoice.approved recibido (no-op)', {
      invoiceId: event.payload.invoiceId,
      approverId: event.payload.approverId,
      status: event.payload.status,
    });
    // FASE 11: this.notifier.notifyStatusChange(...) → email real
  }
}
```

`{ async: true }` en `@OnEvent` es crucial: hace que EventEmitter2 espere a que la promesa del handler se resuelva (o rechace) antes de continuar. Sin `async: true`, el error de un handler async no podría ser capturado por el try/catch del poller.

El `InvoiceRejectedHandler` es idéntico pero escucha `'invoice.rejected'` y loguea también el campo `reason`.

**Por qué "no-op" ahora y no el email real:**

En FASE 11, cambiar el comportamiento del handler no requiere tocar ni los use cases ni los controllers — solo el handler. Esto es el **Principio Open/Closed**: el sistema está abierto a extensión (añadir el email en el handler) pero cerrado a modificación (los use cases no cambian).

---

#### Bloque 4 — `GET /invoices/:id/events`: historial de transiciones

```typescript
// packages/backend/src/application/use-cases/get-invoice-events.use-case.ts

export class GetInvoiceEventsUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly invoiceEventRepo: InvoiceEventRepository,
  ) {}

  async execute(input: GetInvoiceEventsInput) {
    // 1. Verificar que la factura existe
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) return err(new InvoiceNotFoundError(input.invoiceId));

    // 2. RBAC: uploaders solo pueden ver eventos de sus propias facturas
    const hasFullAccess = ROLES_WITH_FULL_ACCESS.includes(input.requesterRole);
    const isOwner = invoice.getUploaderId() === input.requesterId;

    if (!hasFullAccess && !isOwner) {
      return err(new UnauthorizedError('access invoice events'));
    }

    // 3. Obtener el historial completo (ordenado cronológicamente)
    const events = await this.invoiceEventRepo.findByInvoiceId(input.invoiceId);

    return ok(
      events.map(event => ({
        id: event.getId(),
        invoiceId: event.getInvoiceId(),
        from: event.getFrom(),
        to: event.getTo(),
        userId: event.getUserId(),
        timestamp: event.getTimestamp(),
      })),
    );
  }
}
```

Respuesta de ejemplo para una factura aprobada:

```json
{
  "data": [
    { "from": "pending",             "to": "processing",        "userId": "user-123", "timestamp": "2025-03-10T10:00:00Z" },
    { "from": "processing",          "to": "extracted",         "userId": "system",   "timestamp": "2025-03-10T10:00:15Z" },
    { "from": "extracted",           "to": "ready_for_approval","userId": "system",   "timestamp": "2025-03-10T10:00:15Z" },
    { "from": "ready_for_approval",  "to": "approved",          "userId": "user-456", "timestamp": "2025-03-10T11:30:00Z" }
  ]
}
```

Este historial es inmutable — una vez registrado, ningún event puede modificarse. La tabla `invoice_events` no tiene operación de update ni delete en el repositorio.

---

#### Bloque 5 — `PATCH approve/reject` + `providerId` desde el body del upload

**`PATCH /invoices/:id/approve` y `PATCH /invoices/:id/reject`:**

```typescript
// packages/backend/src/interface/http/controllers/invoices.controller.ts

const RejectBodySchema = z.object({
  reason: z.string().min(1, 'reason is required'),
});

@Patch(':id/approve')
@Roles('approver', 'admin')   // solo approver y admin pueden aprobar
@HttpCode(HttpStatus.OK)
async approve(
  @CurrentUser() user: AuthenticatedUser,
  @Param('id') invoiceId: string,
) {
  const result = await this.approveInvoiceUseCase.execute({
    invoiceId,
    approverId: user.userId,  // el approverId viene del JWT, nunca del body
  });

  if (result.isErr()) throw result.error;

  return { data: result.value };
}

@Patch(':id/reject')
@Roles('approver', 'admin')
@HttpCode(HttpStatus.OK)
async reject(
  @CurrentUser() user: AuthenticatedUser,
  @Param('id') invoiceId: string,
  @Body(new ZodValidationPipe(RejectBodySchema)) body: RejectBody,
) {
  const result = await this.rejectInvoiceUseCase.execute({
    invoiceId,
    approverId: user.userId,
    reason: body.reason,
  });

  if (result.isErr()) throw result.error;

  return { data: result.value };
}
```

El `approverId` **siempre** viene del JWT verificado, nunca del body de la petición. Si viniese del body, cualquiera podría hacer una aprobación en nombre de otro usuario simplemente enviando `{ "approverId": "otro-user-id" }`.

**`providerId` desde el body del upload multipart:**

Hasta FASE 8, el `providerId` en el upload estaba hardcodeado en el controller. En FASE 9 lo leemos del body de la petición multipart:

```typescript
const UploadBodySchema = z.object({
  providerId: z.string().uuid({ message: 'providerId must be a valid UUID' }),
});

@Post('upload')
@Roles('uploader', 'validator', 'approver', 'admin')
@UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
async upload(
  @CurrentUser() user: AuthenticatedUser,
  @UploadedFile(new FileValidationPipe()) file: Express.Multer.File,
  @Body() body: UploadBody,
) {
  // Validación manual en lugar de ZodValidationPipe como decorador de parámetro
  const parsed = UploadBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException(
      parsed.error.flatten().fieldErrors.providerId?.join(', ')
      ?? 'providerId must be a valid UUID'
    );
  }

  const result = await this.uploadInvoiceUseCase.execute({
    uploaderId: user.userId,
    providerId: parsed.data.providerId,
    fileBuffer: file.buffer,
    mimeType: file.mimetype as 'application/pdf',
    fileSizeBytes: file.size,
  });

  if (result.isErr()) throw result.error;

  return { data: result.value };
}
```

**¿Por qué `safeParse` manual en lugar de `ZodValidationPipe` como decorador de `@Body()`?**

En requests `multipart/form-data`, Multer parsea los campos de texto y los escribe en el body antes de que NestJS ejecute los pipes de parámetro. El objeto `body` que llega tiene `Object.getPrototypeOf(body) === null` — es un objeto con prototipo nulo (sin métodos de `Object.prototype`). Algunos métodos de Zod y NestJS dan por asumido que el objeto tiene el prototipo estándar.

El `UploadBodySchema.safeParse(body)` funciona correctamente con objetos null-prototype — Zod accede a las propiedades directamente sin asumir el prototipo. Por eso usamos `safeParse` directamente en el cuerpo del método, en lugar de `@Body(new ZodValidationPipe(UploadBodySchema))`.

---

#### Problemas encontrados en FASE 9 y cómo se resolvieron

**1. Zod v4 rechaza UUIDs con nibble de versión 0**

Zod v4 aplica la especificación RFC 4122 estrictamente. Un UUID RFC 4122 válido tiene el nibble de versión (carácter en la posición 14) en el rango `1-5`. Los UUIDs de la forma `00000000-0000-0000-0000-000000000002` tienen el nibble en `0`, lo cual **técnicamente** no es un UUID RFC 4122 válido aunque se parezca a uno.

Los tests de upload usaban `VALID_PROVIDER_ID = '00000000-0000-0000-0000-000000000002'` como ID de prueba. Con Zod v4 y el schema `UploadBodySchema` que valida `providerId` como UUID, estos tests empezaron a fallar con error de validación aunque el resto del código funcionase correctamente.

Solución: cambiar a un UUID con nibble de versión válido en todos los tests: `'a1b2c3d4-e5f6-4789-abcd-ef0123456789'`.

Lección: cuando actualizas una librería de validación, revisa si la nueva versión es más estricta en los estándares. Lo que pasaba en v3 puede fallar en v4.

**2. `InvoiceEventTypeOrmRepository` necesitaba `InvoiceEventOrmEntity` registrada en TypeORM**

Al añadir el `GetInvoiceEventsUseCase`, necesitamos `InvoiceEventRepository` implementado. La implementación TypeORM usa `InvoiceEventOrmEntity`, que debe estar en la lista de `entities` del `DataSource`. Si no está, TypeORM lanza `EntityMetadataNotFoundError`.

Solución: añadir `InvoiceEventOrmEntity` al array de entities en `database.module.ts` y en `data-source.ts`.

**3. `OutboxPollerWorker` vs `ProcessInvoiceWorker`: ambos en `JobsModule`**

El `OutboxPollerWorker` necesita `OUTBOX_EVENT_REPOSITORY` inyectado. Este token se provee en `InvoicesModule` (donde están todos los repositorios). `JobsModule` importa `InvoicesModule`, por lo que el token está disponible. Sin embargo, el orden de declaración en los providers de `JobsModule` importa: el worker debe declararse después de que los tokens que inyecta estén registrados.

Solución: verificar que `InvoicesModule` está en los `imports` de `JobsModule` y que los providers del worker están después de los imports.

**4. `EventEmitterModule` no estaba en `AppModule`**

Los handlers `InvoiceApprovedHandler` y `InvoiceRejectedHandler` usan `@OnEvent()`. Este decorador requiere que `EventEmitterModule` esté importado en el módulo raíz. Sin él, NestJS arranca sin error pero los handlers nunca reciben eventos — no hay ningún aviso de que algo falta.

Solución: `EventEmitterModule.forRoot()` en los imports de `AppModule`.

---

#### Decisiones de diseño registradas (FASE 9)

| Decisión | Elección | Motivo |
|---|---|---|
| Patrón Outbox | T2: dos saves separados | Suficiente por ahora. T1 (atómico en la misma transacción) en FASE 13 con Unit of Work |
| Worker Outbox | BullMQ Repeatable Job | Ya existe BullMQ en el stack; visible en Bull Board; reintentos automáticos |
| EventBus in-process | `@nestjs/event-emitter` (EventEmitter2) | Sin nueva infraestructura; suficiente para notificaciones fire-and-forget |
| Frecuencia poller | 10 segundos | Balance entre latencia de notificación y carga sobre PostgreSQL |
| Índice Outbox | Parcial (`WHERE processed = false`) | El índice no crece con el historial; O(1) en lugar de O(n) |
| `NotificationPort` en use cases | Eliminado | Use cases publican eventos; handlers gestionan consecuencias; SRP cumplido |
| Handlers en FASE 9 | No-op (Logger) | FASE 11 implementa el handler real sin tocar use cases ni controllers |
| `approverId` en el body | Nunca — viene del JWT | Previene suplantación de identidad en aprobaciones |
| `providerId` desde multipart | `safeParse` manual | Objetos null-prototype de Multer no son compatibles con `ZodValidationPipe` como decorador |

---

**Resumen de tests al cerrar FASE 9:**

| Categoría | Archivos | Tests |
|---|---|---|
| Unit (domain + use cases) | 24 | 140 |
| Unit (controllers + guards + pipes + filters) | 5 | 50 |
| Unit (OCR + LLM + queue + workers) | 5 | 22 |
| Integration (repositorios reales) | 4 | 36 |
| NestJS base | 1 | 1 |
| **Total** | **38** | **261** |

**Commit de cierre:**
```
feat(api): HTTP controllers, EventBus, Outbox pattern (FASE 9)
```

---

---

### FASE 10 — Frontend React: dashboard, listado, detalle y upload

**¿Qué hicimos?**

Construimos la interfaz de usuario completa usando **Next.js 15** con App Router, **shadcn/ui** como librería de componentes, **TanStack Query** para la gestión del estado del servidor y **Tailwind CSS v4** para los estilos. El frontend consume la API REST del backend y respeta los roles de usuario: cada rol ve solo lo que le corresponde.

---

#### Bloque 1 — Estructura y tecnologías del frontend

**¿Por qué Next.js con App Router?**

Next.js es el framework de React más usado en producción. El App Router (introducido en Next.js 13) usa React Server Components por defecto, lo que mejora el rendimiento inicial y el SEO. Para una aplicación de gestión de facturas que no necesita SSR agresivo, lo usamos principalmente en modo cliente (`'use client'`), pero la estructura nos da acceso a layouts anidados, rutas de grupo y gestión de metadatos.

**¿Por qué TanStack Query?**

TanStack Query (antes React Query) gestiona el ciclo de vida completo del estado asíncrono:
- **Caché automático**: no hace la misma petición dos veces si los datos están frescos.
- **Refetch inteligente**: refresca automáticamente los datos cuando el usuario vuelve a la pestaña.
- **Estados de carga y error**: `isLoading`, `isError`, `data` disponibles directamente.
- **Mutaciones**: `useMutation` gestiona las operaciones POST/PATCH con callbacks `onSuccess`/`onError`.

Sin TanStack Query, habría que gestionar manualmente `useEffect`, `useState` para loading, cancellation, y la invalidación del caché — mucho código repetitivo y propenso a bugs.

**¿Por qué shadcn/ui?**

shadcn/ui no es una librería de componentes instalada como dependencia — es una colección de componentes que se copian directamente en el proyecto y se pueden modificar libremente. Cada componente usa Radix UI (accesibilidad) + Tailwind CSS (estilos). Ventajas:
- Control total sobre el código de los componentes.
- No dependes de actualizaciones de una librería externa para cambiar estilos.
- Accesibilidad garantizada por Radix UI (teclado, ARIA, foco).

---

#### Bloque 2 — Autenticación y contexto de usuario

El contexto de autenticación (`AuthContext`) gestiona el estado global del usuario:

```typescript
// packages/frontend/context/auth-context.tsx

interface AuthContextType {
  user: AuthUser | null;    // { userId, role, accessToken }
  login: (email, password) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}
```

El `accessToken` se guarda en memoria (en el estado de React), no en `localStorage`. Así es inmune a ataques XSS. El `refreshToken` vive en la cookie HttpOnly que el backend gestiona automáticamente.

**Interceptor de Axios para renovar el token:**

```typescript
// packages/frontend/lib/api.ts

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      try {
        const { data } = await api.post('/auth/refresh');
        const newToken = data.data.accessToken;
        // Actualizar el token en memoria y reintentar la petición
        error.config.headers['Authorization'] = `Bearer ${newToken}`;
        return api(error.config);
      } catch {
        // Refresh falló → sesión expirada → redirigir al login
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

Cuando el backend devuelve un 401 (token expirado), el interceptor intenta renovarlo silenciosamente. Si la renovación tiene éxito, reintenta la petición original. El usuario no se da cuenta de que su token expiró. Solo ve el login si el refresh token también expiró (después de 7 días).

---

#### Bloque 3 — Páginas implementadas

**`/login`** — Formulario de login con React Hook Form + Zod. Muestra errores de validación campo a campo. Redirige al dashboard tras login exitoso.

**`/dashboard`** — Vista principal con:
- **Tarjetas de estadísticas**: total de facturas por estado (pendientes, en proceso, aprobadas, rechazadas).
- **Gráfico de actividad reciente**: usando Recharts para mostrar el volumen de facturas por semana.
- **Tabla de facturas recientes**: las últimas 5 facturas con acceso rápido.

**`/invoices`** — Listado completo con:
- Filtros por estado (dropdown) y ordenación por fecha.
- Paginación con controles prev/next.
- Cada fila muestra el estado con un badge de color (`APPROVED` = verde, `REJECTED` = rojo, etc.).
- Botón para abrir el detalle de cada factura.

**`/invoices/:id`** — Detalle con:
- Datos extraídos por el LLM: número de factura, proveedor, NIF, importe, fecha, IVA.
- Estado actual con historial de transiciones.
- **Botones de acción según rol y estado**: `approver` ve "Approve" y "Reject" si la factura está en `READY_FOR_APPROVAL`. `validator` ve "Send to Approval" si está en `READY_FOR_VALIDATION`. Estos botones son condicionales — no aparecen si el rol o el estado no lo permiten.
- Sección de notas con formulario para añadir.

**`/upload`** — Formulario de subida de PDF con:
- Zona de drag-and-drop usando `react-dropzone`.
- Selector de proveedor (dropdown con los proveedores disponibles).
- Barra de progreso durante el upload.
- Mensaje de éxito con enlace al detalle de la factura creada.

---

#### Bloque 4 — Role-aware UI

La interfaz adapta su contenido al rol del usuario autenticado. La información del rol viene del JWT decodificado en el `AuthContext`.

```typescript
// Ejemplo: botones de acción condicionales en el detalle
const canApprove =
  user?.role === 'approver' &&
  invoice.status === 'READY_FOR_APPROVAL';

const canSendToApproval =
  ['validator', 'approver', 'admin'].includes(user?.role ?? '') &&
  invoice.status === 'READY_FOR_VALIDATION';
```

Los uploaders solo ven sus propias facturas (el backend lo filtra), mientras que validators, approvers y admins ven todas. El frontend no necesita implementar este filtro — el backend ya devuelve solo lo que cada usuario puede ver.

---

**Resumen al cerrar FASE 10 (parcial):**

| Página | Estado |
|---|---|
| Login | ✅ Completa |
| Dashboard con stats | ✅ Completa |
| Listado de facturas | ✅ Completa |
| Detalle de factura | ✅ Completa |
| Upload de PDF | ✅ Completa |
| Página de proveedores (admin) | Pendiente |
| Página de usuarios (admin) | Pendiente |
| Export UI | Pendiente |
| Responsive mobile | Pendiente |

**Commit de cierre:**
```
feat(frontend): add Next.js frontend with dashboard, invoice list/detail, upload and login
```

---

### FASE 11 — Emails con Resend: notificaciones reales en cada transición

**¿Qué hicimos?**

Implementamos el envío real de emails usando **Resend** (el SDK moderno de envío de emails, que reemplaza a Nodemailer como estaba planificado en CLAUDE.md). Los emails se envían en cada transición importante del workflow de facturas: cuando se envía a validación, cuando se envía a aprobación, cuando se aprueba y cuando se rechaza.

La arquitectura del patrón Outbox de FASE 9 brilla aquí: para activar los emails, **no tocamos ni una línea** de los use cases ni de los controllers. Solo implementamos los handlers de eventos.

---

#### Bloque 1 — Por qué Resend en lugar de Nodemailer

El CLAUDE.md planificaba usar Nodemailer. Sin embargo, Resend ofrece varias ventajas sobre Nodemailer para un proyecto de producción:

| | Nodemailer | Resend |
|---|---|---|
| **Envío real** | Requiere configurar SMTP (Gmail, Mailgun...) | API HTTP simple con `RESEND_API_KEY` |
| **Deliverability** | Depende del servidor SMTP elegido | Infraestructura optimizada para entregabilidad |
| **Errores tipados** | Error genérico de Node.js | Objeto `{ data, error }` tipado |
| **SDK** | Solo Node.js | SDK oficial para múltiples lenguajes |
| **Desarrollo local** | Necesita cuenta y servidor SMTP real | Funciona con clave de prueba en sandbox |

La decisión se registra como divergencia del plan original con justificación técnica.

---

#### Bloque 2 — `NotificationPort` y `ResendAdapter`

**`NotificationPort`** (ya existía desde FASE 9) define el contrato:

```typescript
// packages/backend/src/application/ports/notification.port.ts

export type NotificationEventType =
  | 'sent_for_validation'
  | 'sent_for_validation_self'
  | 'sent_for_approval'
  | 'approved'
  | 'rejected';

export interface InvoiceNotificationPayload {
  eventType: NotificationEventType;
  invoiceId: string;
  toEmails: string[];           // destinatarios ya resueltos por el handler
  invoiceNumber?: string;       // datos extraídos por el LLM (opcionales)
  vendorName?: string;
  amount?: number | null;
  actorEmail?: string;          // quién realizó la acción
  latestNote?: string;          // última nota añadida a la factura
  rejectionReason?: string;     // solo en rejected
}

export interface NotificationPort {
  notifyStatusChange(payload: InvoiceNotificationPayload): Promise<void>;
}
```

**`ResendAdapter`** implementa `NotificationPort`:

```typescript
// packages/backend/src/infrastructure/notification/resend.adapter.ts

export class ResendAdapter implements NotificationPort {
  private readonly resend: Resend;
  private readonly logger = new Logger(ResendAdapter.name);

  constructor(
    apiKey: string,
    private readonly fromEmail: string,
  ) {
    this.resend = new Resend(apiKey);
  }

  async notifyStatusChange(payload: InvoiceNotificationPayload): Promise<void> {
    if (!payload.toEmails.length) return;  // sin destinatarios → no hacer nada

    const template = this.resolveTemplate(payload);

    for (const recipient of payload.toEmails) {
      const idempotencyKey = `${payload.eventType}/${payload.invoiceId}/${recipient}`;

      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [recipient],
        subject: template.subject,
        html: template.html,
        headers: {
          'X-Entity-Ref-ID': idempotencyKey,  // idempotencia en Resend
        },
      });

      if (error) {
        this.logger.error('Failed to send email via Resend', {
          invoiceId: payload.invoiceId,
          recipient,
          error: error.message,
        });
        // Nunca lanzar — un email fallido no debe crashear el worker del outbox
      }
    }
  }
}
```

**Puntos clave del diseño:**

**Un email por destinatario**: en lugar de enviar un email con múltiples destinatarios en `to[]`, enviamos un email individual a cada receptor. Esto permite la idempotencia a nivel de `(eventType, invoiceId, recipient)` — si el outbox reintenta el evento, Resend detecta la clave duplicada y descarta el duplicado.

**Idempotencia con `X-Entity-Ref-ID`**: la cabecera personalizada `X-Entity-Ref-ID` actúa como clave de idempotencia en Resend. Si el mismo email se intenta enviar dos veces con la misma clave (porque el outbox reintentó el evento), Resend descarta el segundo. Esto garantiza que el usuario nunca recibe el mismo email dos veces.

**Nunca lanzar en caso de error**: si Resend devuelve un error, lo logueamos pero no lanzamos. Si el `ResendAdapter` lanzase una excepción, el `OutboxPollerWorker` la capturaría y no marcaría el evento como procesado — causando que se reintente infinitamente. El email fallido se loguea y se acepta la pérdida.

**`ResendAdapter` no es `@Injectable()`** — se instancia manualmente con `new ResendAdapter(apiKey, fromEmail)` en `notification.module.ts`. Por eso mantiene `new Logger()` en lugar de `@InjectPinoLogger`.

---

#### Bloque 3 — Templates HTML de email

Los templates están en `src/infrastructure/notification/email-templates.ts`. Son funciones puras que reciben el payload y devuelven `{ subject: string, html: string }`.

```typescript
// Ejemplo: template de aprobación
export function approvedTemplate(payload: InvoiceNotificationPayload) {
  return {
    subject: `Invoice ${payload.invoiceNumber ?? payload.invoiceId} Approved`,
    html: layout(`
      <h2>Invoice Approved</h2>
      ${invoiceDetails(payload)}
      ${payload.actorEmail ? `<p>Approved by: <strong>${escapeHtml(payload.actorEmail)}</strong></p>` : ''}
      ${payload.latestNote ? noteSection(payload.latestNote) : ''}
    `),
  };
}
```

**Templates implementados:**

| Template | Destinatario | Evento |
|---|---|---|
| `sentForValidationTemplate` | Validator asignado al uploader | Uploader envía a validación |
| `sentForValidationSelfTemplate` | Approver asignado al validator | Validator/approver/admin sube su propia factura |
| `sentForApprovalTemplate` | Approver asignado al validator | Validator envía a aprobación |
| `approvedTemplate` | Uploader + validator | Approver aprueba la factura |
| `rejectedTemplate` | Uploader + validator | Approver rechaza con razón |

**`escapeHtml`**: todos los campos de datos del usuario (nombre del proveedor, razón de rechazo, nota) pasan por `escapeHtml` antes de insertarse en el HTML. Esto previene XSS en el email — si el razón de rechazo contiene `<script>alert('XSS')</script>`, se convierte en texto escapado y no en JavaScript ejecutable.

---

#### Bloque 4 — Handlers de eventos con lógica de notificación

Los 4 handlers implementados en FASE 9 como no-op ahora tienen lógica real. Cada handler:
1. Recibe el evento del OutboxPollerWorker via `@OnEvent(...)`.
2. Carga la factura y los usuarios relacionados del repositorio.
3. Resuelve los destinatarios según la lógica de negocio del evento.
4. Llama a `notifier.notifyStatusChange(...)`.

**`InvoiceApprovedHandler`** y **`InvoiceRejectedHandler`**: notifican tanto al **uploader** como al **validator** (ambos son partes interesadas cuando se aprueba o rechaza). Los emails se deduplicarán si son la misma persona (validator que subió su propia factura).

```typescript
// Deduplicación via Set
const emailSet = new Set<string>();
const uploader = await this.userRepo.findById(uploaderId);
if (uploader) emailSet.add(uploader.getEmail());
if (validatorId) {
  const validator = await this.userRepo.findById(validatorId);
  if (validator) emailSet.add(validator.getEmail());
}
const toEmails = [...emailSet]; // sin duplicados
```

**`InvoiceSentForApprovalHandler`**: notifica al **approver asignado al validator** que revisó la factura. Resuelve el approver usando `AssignmentRepository.getAssignedApproverForValidator(validatorId)`.

**`InvoiceSentForValidationHandler`**: lógica con dos flujos:
- **Flujo normal** (actor es `uploader`): notifica al validator asignado al uploader.
- **Flujo self-upload** (actor es `validator`, `approver` o `admin`): notifica al approver asignado a ese validator. El evento es `'sent_for_validation_self'` para usar un template diferente.

---

#### Bloque 5 — Sistema de asignaciones

Para resolver "¿quién es el validator asignado a este uploader?" y "¿quién es el approver asignado a este validator?", añadimos un sistema de asignaciones completo:

**Tablas nuevas (migration):**
- `uploader_validator_assignments`: `(uploader_id, validator_id)` — qué validator supervisa a qué uploader.
- `validator_approver_assignments`: `(validator_id, approver_id)` — qué approver supervisa a qué validator.

**`AssignmentRepository`** con 8 métodos:
- `assignUploaderToValidator(uploaderId, validatorId)`
- `assignValidatorToApprover(validatorId, approverId)`
- `getAssignedValidatorForUploader(uploaderId)` → validatorId | null
- `getAssignedApproverForValidator(validatorId)` → approverId | null
- `getAssignedUploaderIds(validatorId)` → string[] (para `ListInvoicesUseCase`)
- `getAssignedValidatorIds(approverId)` → string[] (para `ListInvoicesUseCase`)
- `removeUploaderAssignment(uploaderId)`
- `removeValidatorAssignment(validatorId)`

**Endpoint de administración `POST /api/v1/admin/assignments`** (solo `admin`): permite crear asignaciones entre usuarios.

---

**Resumen de tests al cerrar FASE 11:**

| Categoría | Archivos | Tests |
|---|---|---|
| Unit (domain + use cases) | 24 | 140 |
| Unit (controllers + guards + pipes + filters) | 5 | 50 |
| Unit (OCR + LLM + queue + workers) | 5 | 22 |
| Unit (handlers + templates + ResendAdapter) | 6 | 47 |
| Integration (repositorios reales) | 4 | 36 |
| **Total** | **44** | **295** |

> El incremento en handlers se debe a que los 4 handlers (approved, rejected, sent_for_approval, sent_for_validation) ahora tienen lógica completa con 9-12 tests cada uno.

**Variables de entorno nuevas en FASE 11:**

```
RESEND_API_KEY=       # API key de Resend (obligatoria para envío real)
RESEND_FROM_EMAIL=    # Email remitente (ej: invoicescan@tu-dominio.com)
```

**Commit de cierre:**
```
feat(notifications): implement email notifications with Resend (FASE 11)
```

---

### FASE 12 — Export CSV/JSON + paquete shared + ESLint frontend

**¿Qué hicimos?**

FASE 12 combina tres mejoras ortogonales pero relacionadas:
1. **Export asíncrono de facturas** a CSV y JSON via BullMQ.
2. **Paquete `shared`** como fuente de verdad de tipos y schemas Zod compartidos entre backend y frontend.
3. **ESLint del frontend** con configuración de Next.js.

---

#### Bloque 1 — Export asíncrono de facturas

El export de facturas puede implicar miles de filas. Hacerlo síncronamente en una petición HTTP causaría:
- Timeout del cliente si tarda más de 30s.
- Bloqueo del event loop de Node.js durante la serialización.
- Memoria consumida por todos los datos a la vez.

La solución: **export asíncrono via BullMQ**.

**Flujo del export:**

```
1. POST /api/v1/invoices/export
   → Controller encola job en BullMQ → devuelve { jobId } inmediato (202 Accepted)

2. [Worker en segundo plano]
   → Carga todas las facturas del usuario (respeta su rol)
   → Serializa a CSV o JSON
   → Escribe el archivo en exports/<jobId>.<ext>

3. GET /api/v1/exports/:jobId/status
   → Frontend hace polling cada 2s
   → Cuando status = 'completed' → aparece botón de descarga con downloadUrl

4. GET /api/v1/exports/:jobId/download
   → Sirve el archivo con Content-Disposition: attachment
```

**`ExportInvoicesWorker`** — el worker BullMQ:

```typescript
// packages/backend/src/interface/jobs/export-invoices.worker.ts

@Processor(EXPORT_INVOICE_QUEUE)
export class ExportInvoicesWorker extends WorkerHost {
  async process(job: Job<ExportJobData>): Promise<void> {
    const { jobId, format, requesterId, requesterRole } = job.data;

    // 1. Obtener TODAS las facturas (sin paginación) con scoping por rol
    const invoices = await this.fetchInvoices(requesterId, requesterRole, filters);

    // 2. Serializar
    const content = format === 'csv' ? this.toCsv(invoices) : JSON.stringify(this.toJson(invoices), null, 2);

    // 3. Escribir a disco
    await writeFile(`exports/${jobId}.${format}`, content, 'utf8');
  }
}
```

El scoping por rol replica la lógica de `ListInvoicesUseCase`: uploaders ven solo sus facturas, validators ven las de sus uploaders asignados, approvers ven las de la jerarquía completa bajo ellos, admins ven todo.

**CSV con RFC 4180**: el formato CSV sigue el estándar RFC 4180 — cada valor va entre comillas dobles, las comillas dentro de valores se escapan duplicándolas (`"` → `""`). Esto garantiza que valores con comas o saltos de línea no rompen el archivo.

**Idempotencia**: escribir el mismo `jobId` dos veces sobreescribe el mismo archivo. Si el worker se reinicia, el resultado es idéntico.

---

#### Bloque 2 — Paquete `packages/shared`

El paquete `shared` es la **fuente de verdad** para tipos y schemas Zod que el backend y el frontend necesitan conocer:

```
packages/shared/src/index.ts
  → Schemas Zod de DTOs (InvoiceDto, UserDto, ProviderDto...)
  → Tipos TypeScript inferidos de esos schemas
  → Enums (InvoiceStatusEnum, UserRole)
  → Constantes compartidas
```

**¿Por qué era necesario?**

Sin `shared`, si añades un campo al DTO de `InvoiceDto` en el backend, tenías que actualizarlo manualmente también en el frontend. Con `shared`, el cambio se hace en un lugar y TypeScript detecta el error si el frontend no lo refleja.

```typescript
// packages/shared/src/index.ts
import { z } from 'zod';

export const InvoiceDtoSchema = z.object({
  invoiceId: z.string().uuid(),
  status: z.enum(['PENDING', 'PROCESSING', 'EXTRACTED', /* ... */]),
  uploaderId: z.string().uuid(),
  amount: z.number(),
  // ...
});

export type InvoiceDto = z.infer<typeof InvoiceDtoSchema>;
```

```typescript
// packages/backend — consume el schema para validar respuestas del controller
import { InvoiceDtoSchema } from '@invoice-flow/shared';

// packages/frontend — consume el tipo para tipar los hooks de TanStack Query
import type { InvoiceDto } from '@invoice-flow/shared';
const { data } = useQuery<InvoiceDto[]>({ queryKey: ['invoices'] });
```

**Configuración del workspace**:

```json
// packages/shared/package.json
{
  "name": "@invoice-flow/shared",
  "version": "0.0.1",
  "main": "./src/index.ts"
}
```

```json
// packages/backend/package.json
{
  "dependencies": {
    "@invoice-flow/shared": "workspace:*"
  }
}
```

La referencia `workspace:*` le dice a pnpm que use el paquete local, no npmjs.com.

---

#### Bloque 3 — ESLint del frontend con Next.js

El frontend usaba solo `typescript-eslint` por defecto, sin las reglas específicas de Next.js. Esto significaba que no se detectaban:
- Imágenes `<img>` que deberían ser `<Image>` de Next.js.
- Links `<a>` que deberían ser `<Link>` de Next.js.
- Uso incorrecto de APIs de Next.js (por ejemplo, acceder a `params` sin `await` en App Router).

Añadimos `eslint-config-next` con las reglas de `next/core-web-vitals`:

```javascript
// packages/frontend/eslint.config.mjs
import nextPlugin from '@next/eslint-plugin-next';

export default [
  ...compat.extends('next/core-web-vitals'),
  // + reglas typescript-eslint existentes
];
```

Esto detecta y corrige problemas de rendimiento y correctness específicos de Next.js en tiempo de lint, antes de llegar a producción.

---

**Resumen al cerrar FASE 12:**

| Mejora | Estado |
|---|---|
| Export CSV async (BullMQ + polling) | ✅ Completo |
| Export JSON async | ✅ Completo |
| Endpoint status + download | ✅ Completo |
| Paquete `shared` con DTOs Zod | ✅ Completo |
| Backend consume `shared` | ✅ Completo |
| Frontend tipado con `shared` | ✅ Completo |
| ESLint Next.js en frontend | ✅ Completo |

**Commit de cierre:**
```
feat(export+shared): add async CSV/JSON export, shared package, frontend eslint (FASE 12)
```

---

### FASE 13 — Observabilidad: OpenTelemetry + PinoLogger + Unit of Work atómico

**¿Qué hicimos?**

FASE 13 es la fase de **calidad de producción**: añade las herramientas que hacen que el sistema sea operable, debuggeable y confiable bajo carga. Tres piezas independientes pero complementarias:

1. **Unit of Work atómico (T1)**: las operaciones críticas de aprobación y rechazo ocurren dentro de una única transacción PostgreSQL.
2. **OpenTelemetry completo**: trazas, métricas y logs estructurados exportados a SigNoz.
3. **Migración a PinoLogger**: todos los loggers del sistema usan Pino (el logger más rápido para Node.js) con serialización JSON.

---

#### Bloque 1 — Unit of Work atómico

**El problema que resuelve:**

Cuando se aprueba una factura, ocurren tres operaciones de base de datos:
1. `invoiceRepo.save(invoice)` — cambia el estado a `APPROVED`.
2. `invoiceEventRepo.save(event)` — registra la transición en el historial.
3. `outboxRepo.save(outboxEvent)` — guarda el evento para la notificación.

Si la aplicación se cae entre las operaciones 2 y 3, la factura queda aprobada pero nunca llega la notificación. Si se cae entre 1 y 2, el historial de transiciones queda incompleto.

**La solución — Transacción PostgreSQL atómica:**

```typescript
// packages/backend/src/application/ports/unit-of-work.port.ts

export interface UoWContext {
  invoiceRepo: InvoiceRepository;
  invoiceEventRepo: InvoiceEventRepository;
  outboxRepo: OutboxEventRepository;
}

export interface UnitOfWorkPort {
  execute<T>(fn: (ctx: UoWContext) => Promise<T>): Promise<T>;
}
```

```typescript
// packages/backend/src/infrastructure/db/unit-of-work.typeorm.ts

@Injectable()
export class TypeOrmUnitOfWork implements UnitOfWorkPort {
  constructor(
    private readonly dataSource: DataSource,
    private readonly invoiceRepo: InvoiceTypeOrmRepository,
    private readonly invoiceEventRepo: InvoiceEventTypeOrmRepository,
    private readonly outboxRepo: OutboxEventTypeOrmRepository,
  ) {}

  async execute<T>(fn: (ctx: UoWContext) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (em: EntityManager) => {
      // Los tres repos comparten el mismo EntityManager → misma transacción
      const ctx: UoWContext = {
        invoiceRepo:      this.invoiceRepo.forManager(em),
        invoiceEventRepo: this.invoiceEventRepo.forManager(em),
        outboxRepo:       this.outboxRepo.forManager(em),
      };
      return fn(ctx);
    });
  }
}
```

**`forManager(em)`** — el patrón clave:

Cada repositorio TypeORM tiene ahora un método `forManager(em: EntityManager)` que devuelve una nueva instancia del repositorio que usa ese `EntityManager` específico (y por tanto la misma conexión de base de datos y la misma transacción abierta):

```typescript
// packages/backend/src/infrastructure/db/repositories/invoice.typeorm-repository.ts

forManager(em: EntityManager): InvoiceTypeOrmRepository {
  return new InvoiceTypeOrmRepository(em.getRepository(InvoiceOrmEntity));
}
```

**`ApproveInvoiceUseCase` con Unit of Work:**

```typescript
async execute(input: ApproveInvoiceInput) {
  const invoice = await this.invoiceRepo.findById(input.invoiceId);
  if (!invoice) return err(new InvoiceNotFoundError(input.invoiceId));

  const approveResult = invoice.approve(input.approverId);
  if (approveResult.isErr()) return err(approveResult.error);

  // Las tres operaciones ocurren en una sola transacción PostgreSQL
  await this.unitOfWork.execute(async (ctx) => {
    await ctx.invoiceRepo.save(invoice);

    const invoiceEvent = InvoiceEvent.create({ ... });
    await ctx.invoiceEventRepo.save(invoiceEvent.value);

    await ctx.outboxRepo.save(
      new InvoiceApprovedEvent({ invoiceId: invoice.getId(), approverId: input.approverId, status: 'APPROVED' })
    );
  });

  // La auditoría está FUERA de la transacción: un fallo de auditoría
  // no debe revertir la aprobación real de la factura
  await this.auditor.record({ action: 'approve', resourceId: invoice.getId(), userId: input.approverId });

  invoicesApprovedCounter.add(1, { approverId: input.approverId });

  return ok({ invoiceId: invoice.getId(), status: 'APPROVED', approverId: input.approverId });
}
```

**¿Por qué la auditoría queda fuera de la transacción?**

La auditoría registra *que la aprobación ocurrió* — esto debe ser verdad incluso si el registro de auditoría falla. Si estuviese dentro de la transacción y el insert de auditoría fallase por algún motivo (tabla llena, red caída), la transacción se revertiría y la factura **no** quedaría aprobada. Eso sería incorrecto: la lógica de negocio ocurrió, solo falló el efecto secundario de registrarlo.

**`eventBus` eliminado de approve/reject**: con el Unit of Work, el `outboxRepo.save()` ocurre directamente dentro de la transacción. Ya no se necesita el `EventBusPort` — la publicación del evento es parte de la misma operación atómica. Los constructores de `ApproveInvoiceUseCase` y `RejectInvoiceUseCase` ya no tienen `EventBusPort` como dependencia.

---

#### Bloque 2 — OpenTelemetry

**¿Qué es OpenTelemetry?**

OpenTelemetry (OTel) es el estándar de la industria para **observabilidad**. Define tres pilares:

| Pilar | Qué responde | Herramienta en OTel |
|---|---|---|
| **Trazas** | ¿Qué pasó exactamente en esta petición y cuánto tardó cada paso? | `Span`, `Tracer` |
| **Métricas** | ¿Cuántas facturas se aprobaron hoy? ¿Cuánto tarda el OCR? | `Counter`, `Histogram` |
| **Logs** | ¿Qué mensajes emitió el sistema? | Logs estructurados correlacionados con trazas |

**¿Por qué OTel en lugar de una librería específica (Datadog, New Relic...)?**

OTel es **vendor-neutral**: el mismo código exporta datos a Jaeger, SigNoz, Datadog, o cualquier otro backend. Si cambias de proveedor de observabilidad, no cambias el código de instrumentación — solo cambias la URL del colector.

**`tracing.ts` — Setup del SDK:**

```typescript
// packages/backend/src/tracing.ts
// Este archivo se importa PRIMERO en main.ts — antes de cualquier otro import

const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];

if (endpoint) {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,  // 'invoice-flow-backend'
    }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
      exportIntervalMillis: 10_000,  // cada 10 segundos
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false }, // demasiado verboso
      }),
    ],
  });
  sdk.start();
}
// Si no hay OTEL_EXPORTER_OTLP_ENDPOINT → no-op automático (API OTel devuelve spans vacíos)
```

**No-op mode**: cuando `OTEL_EXPORTER_OTLP_ENDPOINT` no está configurado, el SDK no se inicializa. La API de OTel (`trace.getTracer(...)`) devuelve automáticamente un "no-op tracer" que ignora todas las operaciones sin errores. La aplicación funciona igual con o sin colector configurado.

**Variables de entorno para OTel:**

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318  # SigNoz o Jaeger
OTEL_SERVICE_NAME=invoice-flow-backend              # nombre del servicio en el UI
```

**Métricas implementadas** en `src/shared/metrics/metrics.ts`:

| Métrica | Tipo | Atributos | Dónde se incrementa |
|---|---|---|---|
| `invoices_approved_total` | Counter | `approverId` | `ApproveInvoiceUseCase` |
| `invoices_rejected_total` | Counter | `approverId` | `RejectInvoiceUseCase` |
| `invoices_processed_total` | Counter | `status: 'success'\|'error'` | `ProcessInvoiceUseCase` |
| `outbox_events_processed_total` | Counter | `eventType` | `OutboxPollerWorker` |
| `ocr_duration_ms` | Histogram | `invoiceId` | `ProcessInvoiceUseCase` |

**Trazas en `ProcessInvoiceUseCase`:**

```typescript
const tracer = trace.getTracer('invoice-flow-backend');
return tracer.startActiveSpan('ProcessInvoiceUseCase.execute', async (span) => {
  span.setAttribute('invoice.id', input.invoiceId);
  const startMs = Date.now();
  try {
    return await this._execute(input);
  } catch (e) {
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw e;
  } finally {
    ocrDurationHistogram.record(Date.now() - startMs, { invoiceId: input.invoiceId });
    span.end();
  }
});
```

Con estas trazas, en SigNoz puedes ver exactamente cuánto tarda el OCR + LLM para cada factura concreta, y correlacionar latencias altas con facturas específicas.

---

#### Bloque 3 — PinoLogger: el logger de producción

**¿Por qué Pino?**

`new Logger('ContextName')` de NestJS (que usa internamente `console.log`) tiene varios problemas en producción:
- Los logs son texto plano — difíciles de buscar y analizar con herramientas como Elasticsearch.
- No hay correlación con trazas de OTel (sin `traceId` en el log).
- Es notablemente más lento que Pino.

**Pino** es el logger más rápido para Node.js (serializa a JSON usando código C nativo). `nestjs-pino` integra Pino con NestJS:

```typescript
// packages/backend/src/app.module.ts

LoggerModule.forRoot({
  pinoHttp: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV === 'production'
      ? undefined                     // JSON puro en producción (para Elasticsearch)
      : { target: 'pino-pretty' },    // formato bonito en desarrollo
    mixin() {
      // Añade el traceId de OTel a cada log automáticamente
      const span = trace.getActiveSpan();
      if (!span) return {};
      const { traceId, spanId } = span.spanContext();
      return { traceId, spanId };
    },
  },
}),
```

El `mixin` que añade `traceId` es crucial: permite correlacionar un log con la traza OTel que lo generó. En SigNoz puedes ver un log y en un click ir a la traza completa de esa petición.

**Patrón de migración — de `new Logger()` a `@InjectPinoLogger`:**

```typescript
// ❌ Antes (NestJS Logger)
@Injectable()
export class InvoiceApprovedHandler {
  private readonly logger = new Logger(InvoiceApprovedHandler.name);
  // logger.log('message', { ctx }) — objeto como segundo parámetro

// ✅ Después (PinoLogger)
@Injectable()
export class InvoiceApprovedHandler {
  constructor(
    @InjectPinoLogger(InvoiceApprovedHandler.name)
    private readonly logger: PinoLogger,
    // ...resto de dependencias
  ) {}
  // logger.info({ ctx }, 'message') — objeto PRIMERO, mensaje DESPUÉS (estándar Pino)
```

**Diferencia clave en la firma de los métodos de log:**

```typescript
// NestJS Logger (contexto como segundo argumento)
this.logger.log('Invoice approved', { invoiceId, approverId });

// PinoLogger (objeto de contexto PRIMERO, mensaje DESPUÉS — estándar Pino)
this.logger.info({ invoiceId, approverId }, 'Invoice approved');
```

Esta diferencia es importante: Pino serializa eficientemente todos los campos del objeto como propiedades del JSON del log, lo que facilita la búsqueda por `invoiceId` en herramientas de análisis.

**Casos especiales — mantienen `new Logger()`:**

| Clase | Razón |
|---|---|
| `DomainErrorFilter` | Instanciada con `new DomainErrorFilter()` en `main.ts` — sin DI de NestJS |
| `LocalStorageAdapter` | Instanciada con `new LocalStorageAdapter(uploadsDir)` en `storage.module.ts` |
| `OutboxEventBusAdapter` | Instanciada con `useFactory` en `invoices.module.ts` |
| `ResendAdapter` | Instanciada con `new ResendAdapter(apiKey, from)` en `notification.module.ts` |

Estas clases no están gestionadas por el contenedor de DI de NestJS, por lo que `@InjectPinoLogger` (que requiere DI) no puede usarse en ellas.

---

#### Bloque 4 — SigNoz en Docker Compose

SigNoz es el backend de observabilidad open-source que recibe y visualiza los datos de OTel. Se añade a `docker-compose.yml` con un perfil separado para no levantarlo automáticamente:

```bash
# Solo levantar observabilidad cuando se necesita
docker compose --profile observability up -d signoz
```

SigNoz expone:
- `http://localhost:4318` — endpoint OTLP/HTTP (para configurar en `OTEL_EXPORTER_OTLP_ENDPOINT`)
- `http://localhost:3301` — UI web de SigNoz (trazas, métricas, logs)

---

**Resumen de tests al cerrar FASE 13:**

| Categoría | Archivos | Tests |
|---|---|---|
| Unit (domain + use cases) | 24 | 140 |
| Unit (controllers + guards + pipes + filters) | 5 | 50 |
| Unit (OCR + LLM + queue + workers) | 5 | 22 |
| Unit (handlers + templates + ResendAdapter) | 6 | 47 |
| Unit (UoW specs actualizados) | 2 | 12 |
| Integration (repositorios reales) | 4 | 36 |
| **Total** | **44** | **344** |

**Variables de entorno nuevas en FASE 13:**

```
OTEL_EXPORTER_OTLP_ENDPOINT=   # URL del colector OTLP (ej: http://localhost:4318)
OTEL_SERVICE_NAME=              # Nombre del servicio en SigNoz (default: invoice-flow-backend)
```

**Commit de cierre:**
```
feat(fase13): UoW atomic TX + OpenTelemetry + PinoLogger migration
```

---

### FASE 14 — Tests E2E + CI completo

**¿Qué hicimos?**

Completamos la pirámide de tests añadiendo la capa E2E (extremo a extremo). Hasta esta fase teníamos 344 tests unitarios y 36 de integración — todo testeado con mocks o contra la base de datos, pero nunca con el servidor HTTP real corriendo y procesando peticiones reales. En esta fase arrancamos la aplicación NestJS completa en memoria, la conectamos a PostgreSQL y Redis reales, y ejecutamos flujos completos del workflow de facturas vía HTTP.

También extendimos el pipeline de CI con dos jobs nuevos que corren estos tests automáticamente en GitHub Actions.

---

#### Bloque 1 — Arquitectura de los tests E2E

**¿Por qué E2E con Supertest en lugar de Playwright?**

Playwright es ideal para tests de interfaz de usuario (navegador). Nuestros E2E cubren la **API REST**, no el frontend — lo más crítico para garantizar que el backend funciona correctamente de extremo a extremo. Supertest hace peticiones HTTP reales contra el servidor NestJS sin necesitar un navegador.

La diferencia con los tests de integración de FASE 3 es que aquí:
- La aplicación **completa** arranca (todos los módulos, guards, filtros, pipes, workers BullMQ).
- Los tests se comunican vía **HTTP** igual que lo haría el frontend.
- Los estados del workflow se transicionan mediante peticiones reales con JWT.

**Configuración — `vitest-e2e.config.ts`:**

```typescript
// packages/backend/test/vitest-e2e.config.ts
export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,   // suites secuenciales — comparten estado de BD
    testTimeout: 30_000,      // 30s por test — BullMQ workers necesitan tiempo
    hookTimeout: 30_000,
    globalSetup: ['test/setup/global-setup.ts'],
  },
});
```

- **`fileParallelism: false`**: las tres suites E2E corren secuencialmente porque comparten la misma base de datos. Si corriesen en paralelo, las inserciones de una suite interferirían con las assertions de otra.
- **`testTimeout: 30_000`**: el worker BullMQ procesa el job de OCR+LLM de forma asíncrona. El test necesita tiempo para sondear el estado hasta que el worker termina.
- **`globalSetup`**: antes de ejecutar ninguna spec, el helper de setup crea la conexión TypeORM y aplica todas las migraciones pendientes en la base de datos de test.

---

#### Bloque 2 — `global-setup.ts`: migraciones antes de todo

```typescript
// packages/backend/test/setup/global-setup.ts

export async function setup(): Promise<void> {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env['DATABASE_URL'],
    entities: [UserOrmEntity, InvoiceOrmEntity, /* ... todas las entidades */],
    migrations: ['src/infrastructure/db/migrations/*.{ts,js}'],
    synchronize: false,
    logging: false,
  });

  await ds.initialize();
  await ds.runMigrations();
  await ds.destroy();
}
```

Este archivo corre **una sola vez** antes de todas las specs, en un proceso separado de Vitest. Aplica las migraciones una vez y cierra la conexión — las specs individuales crean sus propias conexiones a través del módulo NestJS.

**¿Por qué importar las entidades explícitamente en lugar de un glob?**

`global-setup.ts` corre en el contexto de Vitest con SWC. TypeORM usaría `require()` dinámico para cargar un glob de archivos `.ts`, pero SWC solo transforma imports estáticos — el `require()` dinámico recibe archivos `.ts` crudos y falla. Importando las clases explícitamente, SWC las transpila correctamente antes de que TypeORM las use.

---

#### Bloque 3 — Los helpers de test E2E

**`e2e-app.helper.ts` — arrancar la app con LLM stubbed:**

```typescript
// packages/backend/test/helpers/e2e-app.helper.ts

export const stubLlmResult: LLMExtractionResult = {
  total: 1210.0,
  fecha: '2025-03-01',
  numeroFactura: 'FACT-E2E-001',
  nifEmisor: '12345678A',
  nombreEmisor: 'Test Vendor S.L.',
  baseImponible: 1000.0,
  iva: 210.0,
  ivaPorcentaje: 21,
};

export async function createE2EApp(): Promise<E2EApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(LLM_TOKEN)   // ← sustituye el LLM real por el stub
    .useValue(stubLlmAdapter)
    .compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());                        // igual que main.ts
  app.useGlobalFilters(new DomainErrorFilter());  // igual que main.ts

  await app.init();
  return { app, http: app.getHttpServer() };
}
```

**¿Por qué sustituir el LLM?**

`AIStudioAdapter` llama a Google AI Studio. En los tests E2E no queremos llamadas de red reales porque:
- Son lentas (latencia de red).
- Requieren `AISTUDIO_API_KEY` en CI.
- Son no deterministas (el modelo puede cambiar su respuesta).

`overrideProvider(LLM_TOKEN).useValue(stubLlmAdapter)` reemplaza el adaptador real por uno que siempre devuelve los mismos datos de prueba. **Todo lo demás es real**: PostgreSQL, Redis, BullMQ workers, guards JWT, filtros de error.

Aplica también los mismos middlewares que `main.ts` (`cookieParser`, `DomainErrorFilter`) — si no, las cookies de refreshToken no funcionarían y los errores de dominio llegarían como 500 genéricos.

**`db-e2e.helper.ts` — limpiar la BD entre suites:**

```typescript
export async function clearAllTables(app: INestApplication): Promise<void> {
  const ds = app.get<DataSource>(getDataSourceToken());
  // Las tablas se borran en orden inverso a las FK constraints
  await ds.query(`TRUNCATE TABLE
    uploader_validator_assignments, validator_approver_assignments,
    outbox_events, audit_events, invoice_events, invoice_notes,
    invoices, providers, user_credentials, users
    RESTART IDENTITY CASCADE`);
}
```

`TRUNCATE ... CASCADE` borra datos de todas las tablas relacionadas en una sola operación, respetando el orden de las claves foráneas. `RESTART IDENTITY` resetea los contadores de secuencia. Se llama en `beforeAll` y `afterAll` de cada spec para garantizar aislamiento total.

**`seed-e2e.helper.ts` — usuarios y proveedor para tests:**

Crea directamente en la base de datos (sin pasar por los use cases) 5 usuarios de test con sus credenciales y un proveedor genérico. Usa **bcrypt rounds=1** en lugar de los 12 de producción — el hashing lento de producción haría los tests insufriblemente lentos (12 bcrypt hashes a rounds=12 tardarían ~12 segundos solo en setup).

**`auth-e2e.helper.ts` — hacer login y obtener token:**

```typescript
export async function loginAs(http, email, password): Promise<{ accessToken: string }> {
  const res = await request(http)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  return { accessToken: res.body.data.accessToken };
}
```

**`wait-for-status.helper.ts` — sondeo de estado asíncrono:**

```typescript
export async function waitForStatus(
  http, token, invoiceId, expectedStatus,
  maxAttempts = 20, intervalMs = 1000
): Promise<InvoiceData> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await request(http)
      .get(`/api/v1/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${token}`);

    if (res.body.data?.status === expectedStatus) return res.body.data;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Invoice never reached status ${expectedStatus}`);
}
```

El worker BullMQ procesa el job de OCR+LLM de forma asíncrona. El test no puede asumir cuándo terminará — hace polling cada segundo hasta que el estado esperado aparece, o falla después de 20 intentos (20 segundos).

---

#### Bloque 4 — Las tres suites E2E

**`auth.e2e-spec.ts` — 14 tests de autenticación:**

Flujos cubiertos:
- `POST /auth/login` → 200 + accessToken en body + refreshToken en cookie HttpOnly
- `POST /auth/login` con contraseña incorrecta → 401 (sin distinguir "usuario no encontrado" vs "contraseña incorrecta" — previene enumeración de usuarios)
- `POST /auth/login` con email malformado → 400
- `POST /auth/refresh` con cookie válida → nuevo accessToken diferente del original
- `POST /auth/refresh` sin cookie → 401
- `POST /auth/logout` → 204 + cookie limpiada
- `GET /invoices` sin token → 401 (guard global)
- `POST /admin/users` con token de uploader → 403 (rol insuficiente)
- `GET /health` sin token → 200 (endpoint `@Public()`)

**`invoices.e2e-spec.ts` — ~20 tests del workflow completo:**

Flujo happy-path completo en 5 pasos encadenados:

```
upload → [BullMQ worker] → EXTRACTED → send-to-validation → READY_FOR_VALIDATION
  → send-to-approval → READY_FOR_APPROVAL → approve → APPROVED
```

Cada paso es un `it()` separado que hereda el `invoiceId` del paso anterior. Después de cada transición, el test verifica el estado en la respuesta HTTP.

Otros flujos cubiertos:
- Flujo de rechazo: `READY_FOR_APPROVAL → REJECTED` con `{ reason }` obligatorio.
- Transición inválida: aprobar una factura en `EXTRACTED` → 409 `INVALID_STATE_TRANSITION`.
- Recurso inexistente: aprobar UUID inexistente → 404.
- RBAC: uploaderB no puede ver facturas de uploaderA → 403.
- RBAC: uploader no puede aprobar → 403.
- Validator puede listar todas las facturas.
- Upload sin `providerId` → 400. Sin archivo → 400. Con PNG en lugar de PDF → 400.
- Notas: validator puede añadir, uploader no puede (403).

**`exports.e2e-spec.ts` — 6 tests de exportación:**

```
POST /invoices/export?format=csv → 202 { jobId }
  → [BullMQ ExportWorker en segundo plano]
  → GET /exports/:jobId/status → polling hasta status='done'
  → GET /exports/:jobId/download → archivo CSV con header 'invoiceId,status,...'
```

También cubre: export JSON (válido y parseable), uploader no puede exportar (403), jobId inexistente → 404.

---

#### Bloque 5 — CI: jobs `integration` y `e2e`

Se añadieron dos jobs al pipeline de GitHub Actions:

```
quality → integration
quality → e2e
```

Ambos jobs necesitan los secrets de GitHub:
- `CI_JWT_SECRET` — mínimo 32 caracteres
- `CI_JWT_REFRESH_SECRET` — mínimo 32 caracteres, diferente al anterior

**¿Por qué estos secrets no están hardcodeados en el YAML?**

El `JWT_SECRET` es lo que protege toda la autenticación. Si estuviese en el repositorio (aunque sea en un archivo de CI), cualquiera que lea el historial de Git podría fabricar tokens válidos para la instancia de CI. Los secrets de GitHub Actions se inyectan en variables de entorno sin aparecer en los logs ni en el código.

Cada job levanta sus propios servicios Docker (Postgres + Redis) como contenedores de GitHub Actions, aplica migraciones mediante el `globalSetup`, y ejecuta los tests contra esos servicios.

```yaml
# Extracto del job e2e en .github/workflows/ci.yml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_DB: invoicescan_e2e
    options: --health-cmd "pg_isready" --health-interval 10s

  redis:
    image: redis:7-alpine
    options: --health-cmd "redis-cli ping" --health-interval 10s

steps:
  - name: Create uploads and exports directories
    run: mkdir -p packages/backend/uploads packages/backend/exports

  - name: Run E2E tests
    run: pnpm --filter backend test:e2e
```

`mkdir -p uploads exports` es necesario porque los workers BullMQ escriben archivos en esos directorios. En desarrollo local existen porque están en `.gitignore` y se crean al primer uso. En CI son directorios efímeros que hay que crear explícitamente.

---

**Resumen de tests al cerrar FASE 14:**

| Suite | Archivos | Tests aproximados |
|---|---|---|
| Unit (domain + use cases + infra) | 44 | 344 |
| Integration (repositorios TypeORM reales) | 4 | 36 |
| E2E (workflow completo vía HTTP) | 3 | ~40 |
| **Total** | **51** | **~420** |

**Commit de cierre:**
```
feat(fase14-15): E2E tests + CI integration/e2e jobs + Docker multi-stage
```

---

### FASE 15 — Docker multi-stage + infraestructura de producción

**¿Qué hicimos?**

Empaquetamos la aplicación completa en imágenes Docker listas para producción. El objetivo: con `docker compose --profile full up`, levantar el stack completo (base de datos, migraciones, backend, frontend) sin instalar Node.js, pnpm ni nada en la máquina destino.

Tres piezas principales:
1. **Dockerfile del backend** — imagen ligera de producción con solo las dependencias necesarias.
2. **Dockerfile del frontend** — imagen standalone de Next.js.
3. **Perfil `full` en docker-compose.yml** — orquestación completa con orden de arranque.

---

#### Bloque 1 — Dockerfile del backend: 3 etapas

```dockerfile
# packages/backend/Dockerfile

# ── Etapa 1: deps ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
# Solo los manifests — para aprovechar la caché de Docker
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/backend/package.json ./packages/backend/package.json
RUN pnpm install --frozen-lockfile   # instala TODO (incluyendo devDeps para build)

# ── Etapa 2: build ────────────────────────────────────────────────────────────
FROM deps AS build
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend
RUN pnpm --filter backend build     # compila TypeScript → dist/
# pnpm deploy extrae SOLO las deps de producción en un directorio limpio
RUN pnpm --filter backend deploy --prod /app/deploy
RUN cp -r packages/backend/dist /app/deploy/dist

# ── Etapa 3: production ───────────────────────────────────────────────────────
FROM node:22-alpine AS production
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
WORKDIR /app
COPY --from=build --chown=nestjs:nodejs /app/deploy ./
RUN mkdir -p uploads exports && chown nestjs:nodejs uploads exports
USER nestjs
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

**¿Por qué 3 etapas?**

El patrón multi-etapa es fundamental para producción. Cada etapa solo hereda el resultado de la anterior, no su contexto de build:

| Etapa | Contiene | Tamaño aproximado |
|---|---|---|
| `deps` | todo `node_modules` (incluyendo devDeps) | ~800 MB |
| `build` | código fuente + `dist/` compilado | ~850 MB |
| `production` | solo `node_modules` de producción + `dist/` | ~200 MB |

La imagen final no tiene TypeScript, Vitest, `@nestjs/cli`, ni ninguna herramienta de desarrollo. Menos código = menor superficie de ataque.

**`pnpm deploy --prod`**

El comando `pnpm --filter backend deploy --prod /app/deploy` crea un directorio `/app/deploy` que contiene exactamente lo que el backend necesita en runtime:
- Solo las dependencias de `dependencies` (no `devDependencies`).
- El `package.json` del paquete.
- Los symlinks del workspace resueltos (el paquete `shared` se copia directamente).

Esta es la forma oficial de pnpm para empaquetar un paquete de un workspace para producción.

**Usuario no-root:**

```dockerfile
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs
```

Ejecutar el proceso como usuario root en un contenedor Docker es un riesgo de seguridad — si hay una vulnerabilidad en la aplicación que permite escapar del contenedor, el atacante tendría privilegios de root en el host. El usuario `nestjs` (uid 1001) solo tiene permisos sobre el directorio de la aplicación.

**HEALTHCHECK:**

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1
```

Docker sondea el endpoint `/health` cada 30 segundos. Si falla 3 veces consecutivas, el contenedor se marca como `unhealthy`. Docker Compose usa este estado para determinar si el servicio está listo antes de arrancar los dependientes.

---

#### Bloque 2 — `run-migrations.ts`: migraciones sin ts-node en producción

```typescript
// packages/backend/src/run-migrations.ts

async function runMigrations(): Promise<void> {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env['DATABASE_URL'],
    entities: [join(__dirname, 'infrastructure/db/entities/*.orm-entity.js')],
    migrations: [join(__dirname, 'infrastructure/db/migrations/*.js')],
    synchronize: false,
  });

  await ds.initialize();
  const ran = await ds.runMigrations({ transaction: 'each' });
  console.log(`Applied ${ran.length} migration(s).`);
  await ds.destroy();
  process.exit(0);
}
```

En desarrollo, las migraciones se ejecutan con el CLI de TypeORM vía `ts-node`:
```bash
pnpm --filter backend migration:run
# → typeorm-ts-node-commonjs migration:run -d data-source.ts
```

En producción dentro de Docker, no hay `ts-node` — solo el JavaScript compilado en `dist/`. Este script se compila junto con el resto del backend (`nest build` lo incluye porque está en `src/`) y se ejecuta simplemente como:

```bash
node dist/run-migrations.js
```

Las entidades y migraciones se cargan desde el directorio `dist/` mediante globs de `.js` — los archivos compilados.

---

#### Bloque 3 — Dockerfile del frontend: Next.js standalone

```dockerfile
# packages/frontend/Dockerfile

# ── Etapa 1: deps ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
# ... instala deps del workspace

# ── Etapa 2: build ────────────────────────────────────────────────────────────
FROM deps AS build
COPY packages/shared ./packages/shared
COPY packages/frontend ./packages/frontend
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @invoice-flow/frontend build

# ── Etapa 3: production ───────────────────────────────────────────────────────
FROM node:22-alpine AS production
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
WORKDIR /app
# Solo el output standalone — sin node_modules ni código fuente
COPY --from=build --chown=nextjs:nodejs /app/packages/frontend/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/packages/frontend/.next/static ./packages/frontend/.next/static
COPY --from=build --chown=nextjs:nodejs /app/packages/frontend/public ./packages/frontend/public
USER nextjs
EXPOSE 3001
CMD ["node", "packages/frontend/server.js"]
```

**`output: 'standalone'` en `next.config.mjs`:**

Next.js por defecto genera una carpeta `.next/` que requiere tener todo `node_modules` instalado para funcionar. Con `output: 'standalone'`, Next.js genera una carpeta `.next/standalone/` que contiene el servidor Node.js y solo las dependencias estrictamente necesarias para ejecutarlo — sin `node_modules` completos.

```javascript
// packages/frontend/next.config.mjs
const nextConfig = {
  output: 'standalone',
  // ...
};
```

El resultado es que la imagen de producción del frontend pesa ~80 MB en lugar de ~500 MB.

**`NEXT_PUBLIC_API_URL` como build arg:**

```dockerfile
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
```

Las variables `NEXT_PUBLIC_*` de Next.js se incrustan en el bundle del cliente en **tiempo de build** (no en tiempo de ejecución). Por eso deben pasarse como `ARG` al build del Dockerfile. Para cambiar la URL de la API en producción:

```bash
docker compose --profile full build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.tu-dominio.com
```

---

#### Bloque 4 — Perfil `full` en docker-compose.yml

```yaml
services:
  # postgres y redis existen desde FASE 0 (sin perfil — siempre activos)

  migrate:
    profiles: [full]
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
      target: build    # usa la etapa 'build' (tiene el dist/ compilado)
    command: sh -c "node packages/backend/dist/run-migrations.js"
    depends_on:
      postgres:
        condition: service_healthy   # espera a que Postgres esté listo

  app:
    profiles: [full]
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
    ports:
      - "${PORT:-3000}:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully  # espera a que migrate termine OK
    env_file: .env
    volumes:
      - uploads:/app/uploads
      - exports:/app/exports

  frontend:
    profiles: [full]
    build:
      context: .
      dockerfile: packages/frontend/Dockerfile
    ports:
      - "3001:3001"
    depends_on:
      - app
```

**Orden de arranque garantizado:**

```
postgres (healthy) ─┬─→ migrate (completed_successfully) ─→ app (healthy) ─→ frontend
redis    (healthy) ─┘
```

`condition: service_completed_successfully` significa que Docker Compose espera a que el contenedor `migrate` termine con código de salida 0 antes de arrancar `app`. Si las migraciones fallan, `app` nunca arranca — lo que es el comportamiento correcto (la app no debe correr sin el schema de base de datos).

**Volúmenes para datos persistentes:**

```yaml
volumes:
  uploads:   # PDFs subidos por los usuarios
  exports:   # CSVs/JSONs generados por el ExportWorker
```

Sin estos volúmenes, cada `docker compose down` perdería todos los PDFs y exports. Los volúmenes Docker persisten los datos entre reinicios del contenedor.

**Comandos de uso:**

```bash
# Construir las imágenes (necesario la primera vez y tras cambios de código)
docker compose --profile full build

# Levantar todo el stack (base de datos + migraciones + backend + frontend)
docker compose --profile full up

# Solo infraestructura (para desarrollo local con pnpm)
docker compose up -d    # solo postgres + redis

# Observabilidad (SigNoz)
docker compose --profile observability up -d
```

---

#### Problemas encontrados y cómo se resolvieron

**1. `run-migrations.ts` necesitaba incluirse en el build de NestJS**

El archivo vive en `src/run-migrations.ts`. El `nest build` usa `tsconfig.build.json` que excluye `test/**/*` pero incluye todo lo demás en `src/`. El archivo se compila correctamente a `dist/run-migrations.js` con el resto del backend.

**2. El `migrate` service necesita el `dist/` disponible**

El servicio `migrate` en docker-compose.yml usa `target: build` para reutilizar la etapa intermedia del Dockerfile que ya tiene el código compilado, en lugar de construir una tercera imagen separada solo para migraciones.

**3. Directorio `exports/` no existía al arrancar el `ExportWorker`**

El worker intenta escribir `exports/<jobId>.csv`. Si el directorio no existe, falla con `ENOENT`. El Dockerfile del backend incluye `RUN mkdir -p uploads exports` para crear ambos directorios al construir la imagen.

---

**Variables de entorno necesarias para el perfil `full`:**

Todas las variables del `.env` más:

```
PORT=3000                              # puerto del backend en el host
NEXT_PUBLIC_API_URL=http://localhost:3000  # URL de la API para el frontend
```

**Commit de cierre:**
```
feat(fase14-15): E2E tests + CI integration/e2e jobs + Docker multi-stage
```

---

*Este README se actualiza al cerrar cada fase.*
