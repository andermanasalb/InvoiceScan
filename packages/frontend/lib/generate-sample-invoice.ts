/**
 * @file Sample invoice PDF generator for the InvoiceScan upload page.
 *
 * Produces a realistic-looking Spanish invoice PDF (jsPDF, client-side only)
 * with randomised vendor data, line items, VAT, and totals.  The resulting
 * file is downloaded directly by the browser — no server round-trip required.
 *
 * Only imported dynamically (`import('jspdf')`) to keep jsPDF out of the
 * initial JS bundle.
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Static data ─────────────────────────────────────────────────────────────

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

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Generates a random Spanish-style invoice PDF and triggers a browser download.
 *
 * Uses a dynamic `import('jspdf')` so the library is only loaded when this
 * function is called, keeping it out of the initial page bundle.
 */
export async function generateSampleInvoice(): Promise<void> {
  // Dynamic import — jsPDF is client-side only and fairly large
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const companyIdx = randomBetween(0, SAMPLE_COMPANIES.length - 1);
  const company = SAMPLE_COMPANIES[companyIdx];
  const services = SAMPLE_SERVICES[companyIdx];

  const invoiceNum = `INV-${new Date().getFullYear()}-${padStart(randomBetween(1, 9999), 4)}`;
  const invoiceDate = randomDate(1);
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + 30);

  // Detail lines: 2-4 items
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

  // Header — issuing company
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

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // FACTURA title + metadata
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

  // Bill-to section
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

  // ── Line-items table ─────────────────────────────────────────────────────────
  const colDesc  = margin;
  const colQty   = 120;
  const colUnit  = 148;
  const colTotal = rightX;

  // Table header
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

  // Divider
  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // ── Totals ───────────────────────────────────────────────────────────────────
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

  // ── Footer ───────────────────────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text(
    'Documento generado automáticamente para pruebas — InvoiceScan',
    pageW / 2,
    285,
    { align: 'center' },
  );

  doc.save(`${invoiceNum}.pdf`);
}
