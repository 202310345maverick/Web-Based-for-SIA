'use client';

import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import ScanningDashboard from '@/components/scanning/ScanningDashboard';
import { use } from 'react';

export default function ScanningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  // In a real app, fetch exam data here
  const examData = {
    id: id,
    title: 'Midterm Examination',
    questionCount: 50,
  };

  return (
    <ProtectedLayout>
      <ScanningDashboard
        examId={examData.id}
        examTitle={examData.title}
        questionCount={examData.questionCount}
      />
    </ProtectedLayout>
  );
}
