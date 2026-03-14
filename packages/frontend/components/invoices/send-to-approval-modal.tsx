'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

interface SendToApprovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with an optional note. Empty string means no note. */
  onConfirm: (note: string) => void;
  isLoading?: boolean;
}

export function SendToApprovalModal({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: SendToApprovalModalProps) {
  const [note, setNote] = useState('');

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) setNote('');
    onOpenChange(newOpen);
  };

  const handleConfirm = () => {
    onConfirm(note.trim());
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-zinc-800 bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Send to Approval</DialogTitle>
          <DialogDescription className="text-zinc-400">
            This invoice has been validated. Optionally add a note for the approver before sending.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="approval-note" className="text-zinc-300">
            Note for approver{' '}
            <span className="text-zinc-500">(optional)</span>
          </Label>
          <Textarea
            id="approval-note"
            placeholder="Add any relevant notes for the approver..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-24 border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
            className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-violet-600 text-white hover:bg-violet-700"
          >
            {isLoading ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Sending…
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send to Approval
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
