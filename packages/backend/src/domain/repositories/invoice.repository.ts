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
  save(invoice: Invoice): Promise<void>;
  delete(id: string): Promise<void>;
}
