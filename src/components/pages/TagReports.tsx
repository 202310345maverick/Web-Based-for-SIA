'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

interface TagReportsProps {
  params: { id: string };
}

interface Tag {
  id: number;
  name: string;
  color: string;
  questions: number;
}

export default function TagReportsPage({ params }: TagReportsProps) {
  const tags: Tag[] = [];

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
            <h1 className="text-3xl font-bold text-foreground">Tag Reports</h1>
            <p className="text-sm text-muted-foreground">Categorize and analyze questions by topic</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          New Tag
        </button>
      </div>

      {/* Tags Grid */}
      {tags.length === 0 ? (
        <Card className="p-8 border text-center">
          <p className="text-muted-foreground">No tags created yet. Click "New Tag" to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tags.map(tag => (
            <Card key={tag.id} className="p-4 border">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-4 h-4 rounded-full ${tag.color}`} />
                <button className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <h3 className="font-semibold text-foreground mb-1">{tag.name}</h3>
              <p className="text-sm text-muted-foreground">{tag.questions} questions</p>
              <button className="mt-3 w-full px-3 py-2 border rounded-md text-sm font-semibold hover:bg-muted transition-colors">
                View Report
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
