'use client';

import ReviewPapersPage from "@/components/pages/ReviewPapers";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { use } from "react";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  return (
    <ProtectedLayout>
      <ReviewPapersPage params={{ id }} />
    </ProtectedLayout>
  );
}
