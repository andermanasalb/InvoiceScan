'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';

interface ApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ApproveDialog({ 
  open, 
  onOpenChange, 
  onConfirm, 
  isLoading 
}: ApproveDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-zinc-800 bg-zinc-900">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-zinc-100">
            Approve this invoice?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            This action cannot be undone. The invoice will be marked as approved.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            disabled={isLoading}
            className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isLoading}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {isLoading ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Approving...
              </>
            ) : (
              'Approve'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
