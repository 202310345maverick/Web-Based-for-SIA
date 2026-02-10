'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ReactNode } from 'react';

export function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <MainLayout>{children}</MainLayout>
    </ProtectedRoute>
  );
}
