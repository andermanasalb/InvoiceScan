/**
 * @file InvoiceNotes component.
 *
 * Renders the notes section on the invoice detail page: existing notes
 * (with loading skeletons) and a textarea form to add a new note.
 *
 * Only displayed for users with the validator / approver / admin role —
 * the parent page is responsible for gating visibility via `canAddNote`.
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
}

/**
 * Notes panel for a single invoice.
 *
 * Fetches notes via `useInvoiceNotes`, renders them in chronological order,
 * and provides an add-note form that posts via `useAddNote`.
 */
export function InvoiceNotes({ invoiceId }: InvoiceNotesProps) {
  const { data: notes = [], isLoading: isLoadingNotes } = useInvoiceNotes(invoiceId);
  const addNoteMutation = useAddNote();
  const [noteContent, setNoteContent] = useState('');

  const handleSubmitNote = async () => {
    if (!noteContent.trim()) return;
    await addNoteMutation.mutateAsync({ id: invoiceId, content: noteContent.trim() });
    setNoteContent('');
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
                {note.authorId.slice(0, 8)}... ·{' '}
                {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-sm text-zinc-500">No notes yet.</p>
      )}

      {/* Add note form */}
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
    </motion.div>
  );
}
