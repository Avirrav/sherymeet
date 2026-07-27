'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster
        theme="dark"
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          // M3 snackbar: inverse surface, read from the theme tokens so
          // toasts follow any palette change.
          style: {
            background: 'var(--color-md-surface-container-high)',
            color: 'var(--color-md-on-surface)',
            border: '1px solid var(--color-md-outline-variant)',
            borderRadius: 'var(--radius-md-xs)',
          },
        }}
      />
      {children}
    </QueryClientProvider>
  );
}
