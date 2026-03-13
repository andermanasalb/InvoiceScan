'use client';

import { useForm } from 'react-hook-form';
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

type RejectFormData = {
  reason: string;
};

interface RejectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isLoading?: boolean;
}

export function RejectModal({ 
  open, 
  onOpenChange, 
  onConfirm, 
  isLoading 
}: RejectModalProps) {
  const { 
    register, 
    handleSubmit, 
    formState: { errors },
    reset,
  } = useForm<RejectFormData>();

  const onSubmit = (data: RejectFormData) => {
    onConfirm(data.reason);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-zinc-800 bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Reject Invoice</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Please provide a reason for rejecting this invoice.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-zinc-300">
              Reason for rejection
            </Label>
            <Textarea
              id="reason"
              placeholder="Enter the reason for rejection..."
              {...register('reason', { required: 'Rejection reason is required' })}
              className="min-h-24 border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500"
            />
            {errors.reason && (
              <p className="text-xs text-rose-400">{errors.reason.message}</p>
            )}
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
              type="submit"
              disabled={isLoading}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {isLoading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Rejecting...
                </>
              ) : (
                'Reject'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
