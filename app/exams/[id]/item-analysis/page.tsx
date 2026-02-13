'use client';

import ItemAnalysisPage from "@/components/pages/ItemAnalysis";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { use } from "react";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  return (
    <ProtectedLayout>
      <ItemAnalysisPage params={{ id }} />
    </ProtectedLayout>
  );
}
