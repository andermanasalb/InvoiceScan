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

*Este README se actualiza al cerrar cada fase.*
