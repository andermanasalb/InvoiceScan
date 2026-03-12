/**
 * DomainEventBase
 *
 * Clase base para todos los domain events del sistema.
 * Los domain events son inmutables y se crean en el momento en que ocurren.
 *
 * Regla: el dominio NUNCA importa infraestructura. Esta clase es puro TypeScript.
 */
export abstract class DomainEventBase {
  readonly occurredAt: Date;

  constructor(
    readonly eventType: string,
    readonly payload: unknown,
  ) {
    this.occurredAt = new Date();
  }
}
