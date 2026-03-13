'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CopyableIdProps {
  id: string;
  label?: string;
  truncate?: boolean;
  className?: string;
}

export function CopyableId({ id, label, truncate = true, className }: CopyableIdProps) {
  const [copied, setCopied] = useState(false);

  const displayId = truncate ? `${id.slice(0, 8)}...` : id;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleCopy}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md bg-zinc-800/50 px-2 py-1 font-mono text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100',
            className
          )}
        >
          {label && <span className="text-zinc-500">{label}:</span>}
          <span>{displayId}</span>
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.div
                key="check"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Check className="h-3 w-3 text-emerald-400" />
              </motion.div>
            ) : (
              <motion.div
                key="copy"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Copy className="h-3 w-3 text-zinc-500" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="font-mono text-xs">
        {copied ? 'Copied!' : id}
      </TooltipContent>
    </Tooltip>
  );
}
