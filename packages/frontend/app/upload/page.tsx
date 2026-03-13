'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, Check, Download } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useUploadInvoice } from '@/hooks/use-invoice-mutations';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── Sample invoice generator ────────────────────────────────────────────────

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function padStart(n: number, len = 2) {
  return String(n).padStart(len, '0');
}

function randomDate(yearsBack = 1): Date {
  const now = new Date();
  const past = new Date(now.getFullYear() - yearsBack, now.getMonth(), now.getDate());
  return new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime()));
}

function formatDate(d: Date) {
  return `${padStart(d.getDate())}/${padStart(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const SAMPLE_COMPANIES = [
  { name: 'Telefónica de España S.A.U.', nif: 'A-28015865', address: 'Gran Vía 28, 28013 Madrid' },
  { name: 'Amazon EU SARL', nif: 'B-83960965', address: 'Calle Valgrande 6, 28108 Alcobendas' },
  { name: 'Microsoft Ibérica S.R.L.', nif: 'A-28304834', address: 'Paseo del Club Deportivo 1, 28223 Pozuelo' },
  { name: 'Endesa Energía S.A.U.', nif: 'A-81948077', address: 'Ribera del Loira 60, 28042 Madrid' },
  { name: 'Repsol Butano S.A.', nif: 'A-28076420', address: 'Méndez Álvaro 44, 28045 Madrid' },
];

const SAMPLE_SERVICES = [
  ['Servicio de telecomunicaciones', 'Línea fija ADSL 300 Mbps', 'Pack fibra + móvil', 'Roaming internacional'],
  ['Servicios en la nube AWS', 'Almacenamiento S3 (500 GB)', 'Instancias EC2', 'Transferencia de datos'],
  ['Licencias Microsoft 365', 'Soporte técnico Premium', 'Azure Active Directory', 'Power BI Pro'],
  ['Suministro eléctrico', 'Potencia contratada (kW)', 'Energía activa', 'Discriminación horaria'],
  ['Gas natural (m³)', 'Cuota de servicio', 'Impuesto sobre hidrocarburos', 'Alquiler contador'],
];

async function generateSampleInvoice(): Promise<void> {
  // Importación dinámica para que jsPDF solo se cargue en cliente
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const companyIdx = randomBetween(0, SAMPLE_COMPANIES.length - 1);
  const company = SAMPLE_COMPANIES[companyIdx];
  const services = SAMPLE_SERVICES[companyIdx];

  const invoiceNum = `INV-${new Date().getFullYear()}-${padStart(randomBetween(1, 9999), 4)}`;
  const invoiceDate = randomDate(1);
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + 30);

  // Líneas de detalle: 2-4 items
  const numLines = randomBetween(2, Math.min(4, services.length));
  const lines: { desc: string; qty: number; unit: number; total: number }[] = [];
  for (let i = 0; i < numLines; i++) {
    const qty = randomBetween(1, 5);
    const unit = parseFloat((randomBetween(1000, 30000) / 100).toFixed(2));
    lines.push({ desc: services[i], qty, unit, total: parseFloat((qty * unit).toFixed(2)) });
  }

  const subtotal = parseFloat(lines.reduce((s, l) => s + l.total, 0).toFixed(2));
  const vat = parseFloat((subtotal * 0.21).toFixed(2));
  const total = parseFloat((subtotal + vat).toFixed(2));

  // ── Layout ──────────────────────────────────────────────────────────────────
  const pageW = 210;
  const margin = 20;
  let y = margin;

  // Cabecera — empresa emisora
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(company.name, margin, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(company.address, margin, y);
  y += 5;
  doc.text(`NIF: ${company.nif}`, margin, y);
  y += 12;

  // Separador
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Título FACTURA + datos
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('FACTURA', margin, y);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  const rightX = pageW - margin;
  doc.text(`Nº factura: ${invoiceNum}`, rightX, y - 8, { align: 'right' });
  doc.text(`Fecha:       ${formatDate(invoiceDate)}`, rightX, y - 3, { align: 'right' });
  doc.text(`Vencimiento: ${formatDate(dueDate)}`, rightX, y + 2, { align: 'right' });
  y += 14;

  // Datos del cliente (destinatario genérico)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('FACTURADO A:', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('InvoiceScan Demo Company S.L.', margin, y);
  y += 4;
  doc.text('NIF: B-12345678', margin, y);
  y += 4;
  doc.text('Calle Demo 1, 28001 Madrid', margin, y);
  y += 12;

  // ── Tabla de líneas ─────────────────────────────────────────────────────────
  const colDesc = margin;
  const colQty  = 120;
  const colUnit = 148;
  const colTotal = rightX;

  // Cabecera tabla
  doc.setFillColor(245, 245, 247);
  doc.rect(margin, y - 4, pageW - margin * 2, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.text('DESCRIPCIÓN', colDesc, y);
  doc.text('CANT.', colQty, y);
  doc.text('P. UNIT. (€)', colUnit, y);
  doc.text('TOTAL (€)', colTotal, y, { align: 'right' });
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  for (const line of lines) {
    doc.text(line.desc, colDesc, y);
    doc.text(String(line.qty), colQty, y);
    doc.text(line.unit.toFixed(2), colUnit, y);
    doc.text(line.total.toFixed(2), colTotal, y, { align: 'right' });
    y += 6;
  }

  // Separador
  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // ── Totales ─────────────────────────────────────────────────────────────────
  const totalLabelX = 145;
  const totalValueX = rightX;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Subtotal:', totalLabelX, y);
  doc.text(`${subtotal.toFixed(2)} €`, totalValueX, y, { align: 'right' });
  y += 6;

  doc.text('IVA (21%):', totalLabelX, y);
  doc.text(`${vat.toFixed(2)} €`, totalValueX, y, { align: 'right' });
  y += 6;

  doc.setDrawColor(180, 180, 180);
  doc.line(totalLabelX, y, pageW - margin, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text('TOTAL:', totalLabelX, y);
  doc.text(`${total.toFixed(2)} €`, totalValueX, y, { align: 'right' });
  y += 16;

  // ── Pie de página ────────────────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text('Documento generado automáticamente para pruebas — InvoiceScan', pageW / 2, 285, { align: 'center' });

  // Descarga
  doc.save(`${invoiceNum}.pdf`);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function UploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const uploadMutation = useUploadInvoice();

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: unknown[]) => {
    setFileError(null);
    uploadMutation.reset();

    if (rejectedFiles.length > 0) {
      setFileError('Only PDF files up to 10 MB are accepted');
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];

      if (file.size > MAX_FILE_SIZE) {
        setFileError('Only PDF files up to 10 MB are accepted');
        return;
      }

      if (file.type !== 'application/pdf') {
        setFileError('Only PDF files up to 10 MB are accepted');
        return;
      }

      setSelectedFile(file);
    }
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileError(null);
    uploadMutation.reset();
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      await uploadMutation.mutateAsync({ file: selectedFile });
    } catch {
      // Error is already handled by the mutation's onError callback (toast).
      // Catching here prevents an unhandled promise rejection.
    }
  };

  const handleDownloadSample = async () => {
    setIsGenerating(true);
    try {
      await generateSampleInvoice();
    } finally {
      setIsGenerating(false);
    }
  };

  const isDisabled = !selectedFile || uploadMutation.isPending;

  const buttonLabel = uploadMutation.isPending
    ? 'Uploading...'
    : uploadMutation.isError
    ? 'Upload failed — retry'
    : 'Upload Invoice';

  return (
    <AppShell title="Upload Invoice">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Sample invoice download */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-3"
        >
          <div>
            <p className="text-sm font-medium text-zinc-300">Need a test invoice?</p>
            <p className="text-xs text-zinc-500">Download a randomly generated PDF ready to upload</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadSample}
            disabled={isGenerating}
            className="shrink-0 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
          >
            {isGenerating ? (
              <Spinner className="mr-2 h-3.5 w-3.5" />
            ) : (
              <Download className="mr-2 h-3.5 w-3.5" />
            )}
            {isGenerating ? 'Generating...' : 'Download sample'}
          </Button>
        </motion.div>

        {/* File Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
        >
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-zinc-50">
            Upload File
          </h2>

          <AnimatePresence mode="wait">
            {!selectedFile ? (
              <motion.div
                key="dropzone"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div
                  {...getRootProps()}
                  className={cn(
                    'cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-all',
                    isDragActive
                      ? 'scale-[1.02] border-indigo-500 bg-indigo-950/30'
                      : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/30'
                  )}
                >
                  <input {...getInputProps()} />
                  <motion.div
                    animate={isDragActive ? { scale: 1.1 } : { scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800"
                  >
                    <Upload className={cn(
                      'h-8 w-8',
                      isDragActive ? 'text-indigo-400' : 'text-zinc-500'
                    )} />
                  </motion.div>
                  <p className="text-zinc-300">
                    {isDragActive
                      ? 'Drop your PDF here...'
                      : 'Drag & drop your PDF here or click to browse'}
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">
                    PDF only, max 10 MB
                  </p>
                </div>

                {fileError && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 text-sm text-rose-400"
                  >
                    {fileError}
                  </motion.p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="file-selected"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-4 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500/10">
                  <FileText className="h-6 w-6 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-zinc-200">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
                    <Check className="h-4 w-4 text-emerald-400" />
                  </div>
                  <button
                    onClick={handleRemoveFile}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Upload Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Button
            onClick={handleUpload}
            disabled={isDisabled}
            className={cn(
              'w-full py-6 text-lg text-white disabled:opacity-50',
              uploadMutation.isError
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            )}
          >
            {uploadMutation.isPending ? (
              <>
                <Spinner className="mr-2 h-5 w-5" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-5 w-5" />
                {buttonLabel}
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </AppShell>
  );
}
