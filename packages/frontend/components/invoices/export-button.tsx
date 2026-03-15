'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useExportInvoices, type ExportFormat } from '@/hooks/use-export-invoices';

interface ExportButtonProps {
  /** Current active status filter — passed to the export job so it respects the view. */
  status?: string;
  /** Current active sort filter. */
  sort?: string;
}

/**
 * ExportButton
 *
 * Renders an "Export" button that opens a small modal asking for CSV or JSON.
 * On confirm it enqueues an async export job and polls until the file is ready,
 * then triggers a browser download automatically.
 */
export function ExportButton({ status, sort }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const { exportInvoices, isPending } = useExportInvoices();

  const handleExport = () => {
    exportInvoices({ format, status, sort });
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={isPending}
        className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
      >
        {isPending ? (
          <>
            <Spinner className="mr-2 h-4 w-4" />
            Exporting…
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            Export
          </>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-900 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Export Invoices</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Choose the format for your export. The file will include all
              invoices matching the current filters.
            </DialogDescription>
          </DialogHeader>

          {/* Format selector */}
          <div className="flex gap-3 py-2">
            {(['csv', 'json'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={[
                  'flex-1 rounded-lg border py-3 text-sm font-medium transition-colors',
                  format === f
                    ? 'border-violet-500 bg-violet-600/20 text-violet-300'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
                ].join(' ')}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              className="bg-violet-600 text-white hover:bg-violet-700"
            >
              <Download className="mr-2 h-4 w-4" />
              Export {format.toUpperCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
