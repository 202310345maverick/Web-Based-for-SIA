'use client';

import TagReportsPage from "@/components/pages/TagReports";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { use } from "react";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  return (
    <ProtectedLayout>
      <TagReportsPage params={{ id }} />
    </ProtectedLayout>
  );
}
