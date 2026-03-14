'use client';

import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InvoiceStatus } from '@/types/invoice';

const STEPS: InvoiceStatus[] = [
  'PENDING',
  'PROCESSING',
  'EXTRACTED',
  'READY_FOR_VALIDATION',
  'READY_FOR_APPROVAL',
  'APPROVED',
];

const stepLabels: Record<InvoiceStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  EXTRACTED: 'Extracted',
  VALIDATION_FAILED: 'Validation Failed',
  READY_FOR_VALIDATION: 'Needs Validation',
  READY_FOR_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

interface StatusStepperProps {
  currentStatus: InvoiceStatus;
}

export function StatusStepper({ currentStatus }: StatusStepperProps) {
  const currentIndex = STEPS.indexOf(currentStatus);
  const isFailed = currentStatus === 'VALIDATION_FAILED';
  const isRejected = currentStatus === 'REJECTED';

  // If rejected, show REJECTED instead of APPROVED at the end
  const displaySteps = isRejected 
    ? [...STEPS.slice(0, -1), 'REJECTED' as InvoiceStatus]
    : STEPS;

  // For failed validation, show up to EXTRACTED then VALIDATION_FAILED
  const failedSteps = ['PENDING', 'PROCESSING', 'VALIDATION_FAILED'] as InvoiceStatus[];

  const stepsToRender = isFailed ? failedSteps : displaySteps;

  const getStepState = (step: InvoiceStatus, index: number) => {
    if (isFailed) {
      if (step === 'VALIDATION_FAILED') return 'failed';
      const failedIndex = failedSteps.indexOf(currentStatus);
      if (index < failedIndex) return 'completed';
      if (index === failedIndex) return 'current';
      return 'upcoming';
    }

    if (isRejected && step === 'REJECTED') {
      return 'rejected';
    }

    if (currentIndex === -1) {
      // Status not in main flow
      return index === 0 ? 'current' : 'upcoming';
    }

    // Special case: EXTRACTED is a completed machine step (OCR done).
    // The next human action is READY_FOR_VALIDATION, so highlight that instead.
    if (currentStatus === 'EXTRACTED') {
      if (step === 'EXTRACTED') return 'completed';
      if (step === 'READY_FOR_VALIDATION') return 'action-needed';
    }

    // APPROVED is a terminal success state — always show as ✓ completed.
    if (currentStatus === 'APPROVED' && step === 'APPROVED') return 'completed';

    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="flex items-center justify-between">
      {stepsToRender.map((step, index) => {
        const state = getStepState(step, index);
        const isLast = index === stepsToRender.length - 1;

        return (
          <div key={step} className="flex flex-1 items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <motion.div
                initial={false}
                animate={{
                  scale: state === 'current' || state === 'action-needed' ? 1.1 : 1,
                }}
                className={cn(
                  'relative flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
                  state === 'completed' && 'border-indigo-500 bg-indigo-500',
                  state === 'current' && 'border-indigo-500 bg-transparent',
                  state === 'action-needed' && 'border-cyan-500 bg-transparent',
                  state === 'upcoming' && 'border-zinc-700 bg-transparent',
                  state === 'failed' && 'border-rose-500 bg-rose-500',
                  state === 'rejected' && 'border-red-500 bg-red-500'
                )}
              >
                {state === 'completed' && (
                  <Check className="h-4 w-4 text-white" />
                )}
                {state === 'failed' && (
                  <X className="h-4 w-4 text-white" />
                )}
                {state === 'rejected' && (
                  <X className="h-4 w-4 text-white" />
                )}
                {state === 'current' && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-indigo-500"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [1, 0.5, 1],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                )}
                {state === 'action-needed' && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-cyan-500"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [1, 0.4, 1],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                )}
                {state === 'upcoming' && (
                  <div className="h-2 w-2 rounded-full bg-zinc-700" />
                )}
              </motion.div>

              {/* Step label */}
              <span
                className={cn(
                  'mt-2 text-xs font-medium',
                  state === 'completed' && 'text-indigo-400',
                  state === 'current' && 'text-indigo-400',
                  state === 'action-needed' && 'text-cyan-400',
                  state === 'upcoming' && 'text-zinc-600',
                  state === 'failed' && 'text-rose-400',
                  state === 'rejected' && 'text-red-400'
                )}
              >
                {stepLabels[step]}
                {state === 'action-needed' && (
                  <span className="ml-1 text-cyan-500">→</span>
                )}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={cn(
                  'mx-2 h-0.5 flex-1',
                  state === 'completed' ? 'bg-indigo-500' : 'bg-zinc-800'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
