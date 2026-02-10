'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Save, Check } from 'lucide-react';

interface AnswerKeyEditorProps {
  params: { id: string };
}

export default function AnswerKeyEditor({ params }: AnswerKeyEditorProps) {
  const totalQuestions = 50; // Would get from exam data
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [saved, setSaved] = useState(false);

  const handleAnswerChange = (questionNumber: number, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionNumber]: answer
    }));
  };

  const handleSaveAnswerKey = () => {
    // In real app, would save to backend
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const answersEntered = Object.keys(answers).length;
  const answersPercentage = Math.round((answersEntered / totalQuestions) * 100);

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
            <h1 className="text-3xl font-bold text-foreground">Edit Answer Key</h1>
            <p className="text-sm text-muted-foreground">Set correct answers for all questions</p>
          </div>
        </div>
        <button
          onClick={handleSaveAnswerKey}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors"
        >
          {saved ? (
            <>
              <Check className="w-5 h-5" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save Answer Key
            </>
          )}
        </button>
      </div>

      {/* Progress Card */}
      <Card className="p-4 border bg-blue-50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-muted-foreground mb-1">Progress</p>
            <p className="text-2xl font-bold text-primary">{answersEntered} / {totalQuestions}</p>
          </div>
          <div className="w-24 h-24 rounded-full bg-white border-4 border-primary flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{answersPercentage}%</p>
              <p className="text-xs text-muted-foreground">Complete</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Answer Key Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: totalQuestions }, (_, i) => i + 1).map((questionNum) => (
          <div key={questionNum} className="space-y-2">
            <label className="text-sm font-semibold text-foreground block">
              Question {questionNum}
            </label>
            <select
              value={answers[questionNum] || ''}
              onChange={(e) => handleAnswerChange(questionNum, e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm font-semibold"
            >
              <option value="">-</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
            {answers[questionNum] && (
              <p className="text-xs font-bold text-primary text-center">✓ {answers[questionNum]}</p>
            )}
          </div>
        ))}
      </div>

      {/* Action Bar */}
      <div className="flex gap-3">
        <Link
          href={`/exams/${params.id}`}
          className="flex-1 px-4 py-3 border rounded-md font-semibold text-center hover:bg-muted transition-colors"
        >
          Cancel
        </Link>
        <button
          onClick={handleSaveAnswerKey}
          className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors"
        >
          Save Answer Key
        </button>
      </div>
    </div>
  );
}
