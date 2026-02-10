'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

interface ItemAnalysisProps {
  params: { id: string };
}

interface Question {
  id: number;
  correctRate: number;
  difficulty: string;
  discrimination: number;
}

export default function ItemAnalysisPage({ params }: ItemAnalysisProps) {
  const questions: Question[] = [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/exams/${params.id}`}
          className="p-2 hover:bg-muted rounded-md transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Item Analysis</h1>
          <p className="text-sm text-muted-foreground">Analyze question performance and difficulty</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Average Correct Rate</p>
          <p className="text-2xl font-bold text-primary">0%</p>
        </Card>
        <Card className="p-4 border">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Avg Discrimination</p>
          <p className="text-2xl font-bold text-primary">0</p>
        </Card>
        <Card className="p-4 border">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Questions Analyzed</p>
          <p className="text-2xl font-bold text-primary">0</p>
        </Card>
      </div>

      {/* Questions Table */}
      <Card className="p-4 border">
        <h2 className="text-lg font-bold text-foreground mb-4">Question Statistics</h2>
        <div className="space-y-3">
          {questions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No question data available yet.</p>
          ) : (
            questions.map(q => (
              <div key={q.id} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-foreground">Question {q.id}</span>
                  <span className="text-sm font-semibold text-primary">{q.correctRate}% Correct</span>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="px-2 py-1 bg-blue-50 text-primary rounded">Difficulty: {q.difficulty}</span>
                  <span className="px-2 py-1 bg-blue-50 text-primary rounded">Discrimination: {q.discrimination}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
