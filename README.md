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

*Este README se actualiza al cerrar cada fase.*
