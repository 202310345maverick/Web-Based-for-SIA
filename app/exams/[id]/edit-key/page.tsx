'use client';

import AnswerKeyEditor from "@/components/pages/AnswerKeyEditor";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { use } from "react";

export default function EditKeyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  return (
    <ProtectedLayout>
      <AnswerKeyEditor params={{ id }} />
    </ProtectedLayout>
  );
}
