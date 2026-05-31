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
          style: {
            background: '#111111',
            color: '#FFFFFF',
            border: '1px solid #222222',
          },
        }}
      />
      {children}
    </QueryClientProvider>
  );
}
