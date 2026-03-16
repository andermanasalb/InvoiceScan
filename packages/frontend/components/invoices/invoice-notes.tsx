/**
 * @file InvoiceNotes component.
 *
 * Renders notes for an invoice.
 *   - When readOnly=false (default): shows existing notes + add-note form.
 *     Used for validator / approver / admin.
 *   - When readOnly=true: shows existing notes only (no form).
 *     Used for uploaders who can read but not write notes.
 */
'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useInvoiceNotes } from '@/hooks/use-invoice-notes';
import { useAddNote } from '@/hooks/use-invoice-mutations';

interface InvoiceNotesProps {
  invoiceId: string;
  /** When true the add-note form is hidden; only existing notes are shown. */
  readOnly?: boolean;
}

export function InvoiceNotes({ invoiceId, readOnly = false }: InvoiceNotesProps) {
  const { data: notes = [], isLoading: isLoadingNotes } = useInvoiceNotes(invoiceId);
  const addNoteMutation = useAddNote();
  const [noteContent, setNoteContent] = useState('');

  const handleSubmitNote = async () => {
    if (!noteContent.trim()) return;
    try {
      await addNoteMutation.mutateAsync({ id: invoiceId, content: noteContent.trim() });
      setNoteContent('');
    } catch {
      // error already handled by mutation's onError toast — prevent bubbling
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
    >
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight text-zinc-50">
        <MessageSquare className="h-5 w-5 text-zinc-400" />
        Notes
        {readOnly && (
          <span className="text-xs font-normal text-zinc-500">(read-only)</span>
        )}
      </h3>

      {/* Existing notes */}
      {isLoadingNotes ? (
        <div className="mb-4 space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : notes.length > 0 ? (
        <div className="mb-4 space-y-3">
          {notes.map((note) => (
            <div
              key={note.noteId}
              className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-4"
            >
              <p className="mb-2 text-sm text-zinc-200">{note.content}</p>
              <p className="text-xs text-zinc-500">
                {note.authorEmail ?? note.authorId.slice(0, 8) + '…'} ·{' '}
                {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-sm text-zinc-500">No notes yet.</p>
      )}

      {/* Add note form — only for non-read-only users */}
      {!readOnly && (
        <div className="space-y-3">
          <Textarea
            placeholder="Add a note..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            className="resize-none border-zinc-700 bg-zinc-800 text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500"
            rows={3}
            maxLength={2000}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-600">{noteContent.length}/2000</span>
            <Button
              onClick={handleSubmitNote}
              disabled={!noteContent.trim() || addNoteMutation.isPending}
              size="sm"
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {addNoteMutation.isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-2 h-3.5 w-3.5" />
              )}
              Add Note
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
