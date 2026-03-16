'use client';

import { Toaster } from 'sonner';

export function ToasterClient() {
  return (
    <Toaster
      theme="dark"
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#18181B',
          border: '1px solid #27272A',
          color: '#FAFAFA',
        },
      }}
    />
  );
}
