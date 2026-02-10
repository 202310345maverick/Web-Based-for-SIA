'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

interface ReviewPapersProps {
  params: { id: string };
}

interface Paper {
  id: number;
  studentName: string;
  status: string;
  score: number | null;
}

export default function ReviewPapersPage({ params }: ReviewPapersProps) {
  const papers: Paper[] = [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/exams/${params.id}`}
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Review Papers</h1>
            <p className="text-sm text-muted-foreground">Review and manage scanned documents</p>
          </div>
        </div>
      </div>

      {/* Papers Grid */}
      {papers.length === 0 ? (
        <Card className="p-8 border text-center">
          <p className="text-muted-foreground">No scanned papers available yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {papers.map(paper => (
            <Card key={paper.id} className="p-4 border hover:shadow-md transition-shadow">
              <div className="aspect-video bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Paper Preview</p>
              </div>
              <h3 className="font-semibold text-foreground mb-1">{paper.studentName}</h3>
              <div className="flex items-center justify-between text-sm mb-3">
                <span className="text-muted-foreground">{paper.status}</span>
                {paper.score && <span className="text-primary font-semibold">{paper.score}%</span>}
              </div>
              <button className="w-full px-3 py-2 border rounded-md text-sm font-semibold hover:bg-muted transition-colors">
                View Details
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
