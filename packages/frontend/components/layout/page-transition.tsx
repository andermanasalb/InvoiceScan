'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

const pageVariants = {
  hidden: { 
    opacity: 0, 
    y: 20 
  },
  visible: { 
    opacity: 1, 
    y: 0 
  },
  exit: { 
    opacity: 0, 
    y: -20 
  },
};

const pageTransition = {
  duration: 0.3,
  ease: 'easeOut',
};

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={pageVariants}
        transition={pageTransition}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Stagger container for list items
export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
};

// Stagger item for list items
export const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
};

// Modal/dialog animation variants
export const modalVariants = {
  hidden: { 
    opacity: 0, 
    scale: 0.95 
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: {
      duration: 0.15,
    },
  },
};

// Card hover animation
export const cardHoverVariants = {
  initial: { 
    scale: 1,
    boxShadow: '0 0 0 rgba(99, 102, 241, 0)',
  },
  hover: { 
    scale: 1.01,
    boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)',
    transition: {
      duration: 0.2,
    },
  },
};
