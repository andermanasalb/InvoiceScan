export interface ExportJobOptions {
  format: 'csv' | 'json';
  requesterId: string;
  requesterRole: 'uploader' | 'validator' | 'approver' | 'admin';
  status?: string;
  sort?: string;
}

export interface ExportQueuePort {
  enqueueExport(options: ExportJobOptions): Promise<string>; // returns jobId
}
