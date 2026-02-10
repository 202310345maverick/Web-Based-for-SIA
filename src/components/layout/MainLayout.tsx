'use client';

import { Sidebar } from './Sidebar';
import { SidebarProvider, useSidebarContext } from '@/contexts/SidebarContext';
import { ReactNode } from 'react';

function MainLayoutContent({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebarContext();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className={`flex-1 overflow-auto bg-background transition-all duration-300 ${collapsed ? 'ml-16' : 'ml-64'} p-4 sm:p-6 md:p-8`}>
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

export function MainLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </SidebarProvider>
  );
}
