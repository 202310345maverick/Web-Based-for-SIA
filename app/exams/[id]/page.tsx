'use client';

import ExamDetails from "@/components/pages/ExamDetails";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { use } from "react";

export default function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  return (
    <ProtectedLayout>
      <ExamDetails params={{ id }} />
    </ProtectedLayout>
  );
}
