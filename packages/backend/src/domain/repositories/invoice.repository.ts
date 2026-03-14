/**
 * InvoiceRepository — contrato del repositorio de facturas.
 *
 * Esta interfaz pertenece al dominio: define qué operaciones de persistencia
 * necesita la capa de aplicación sin acoplarse a ninguna tecnología de base de datos.
 * La implementación concreta vive en infrastructure/db/repositories/.
 */
import { Invoice } from '../entities';

export interface InvoiceFilters {
  status?: string;
  page?: number;
  limit?: number;
  sort?: string; // e.g. 'createdAt:desc'
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface InvoiceRepository {
  findById(id: string): Promise<Invoice | null>;
  findAll(filters: InvoiceFilters): Promise<PaginatedResult<Invoice>>;
  findByUploaderId(
    uploaderId: string,
    filters: InvoiceFilters,
  ): Promise<PaginatedResult<Invoice>>;
  /** Devuelve el conteo de facturas agrupado por estado. Una sola query SQL. */
  countByStatus(): Promise<Record<string, number>>;
  /** Igual que countByStatus pero limitado a las facturas de un uploader concreto. */
  countByStatusForUploader(uploaderId: string): Promise<Record<string, number>>;
  save(invoice: Invoice): Promise<void>;
  delete(id: string): Promise<void>;
}
