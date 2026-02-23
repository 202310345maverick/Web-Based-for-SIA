'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Eye, User, X } from 'lucide-react';
import { getExamById, Exam } from '@/services/examService';
import { AnswerKeyService } from '@/services/answerKeyService';
import { ScanningService } from '@/services/scanningService';
import { getClassById, Class } from '@/services/classService';
import { AnswerChoice, ScannedResult } from '@/types/scanning';
import { toast } from 'sonner';

interface ReviewPapersProps {
  params: { id: string };
}

interface PaperWithDetails extends ScannedResult {
  studentName: string;
  percentage: number;
  letterGrade: string;
}

interface BubbleSheetPreviewProps {
  answers: AnswerChoice[];
  answerKey: AnswerChoice[];
  choicesPerQuestion: number;
}

function BubbleSheetPreview({ answers, answerKey, choicesPerQuestion }: BubbleSheetPreviewProps) {
  const choices = Array.from({ length: choicesPerQuestion }, (_, i) => String.fromCharCode(65 + i));
  
  return (
    <div className="bg-white p-4 sm:p-6 border rounded-xl shadow-sm mb-6 overflow-x-auto">
      <div className="flex items-center justify-between mb-4 border-b pb-2">
        <h3 className="font-bold text-gray-800 uppercase tracking-wider text-sm">Visual Paper Preview</h3>
        <div className="flex gap-4 text-[10px] font-semibold">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary"></div><span>Student Choice</span></div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full border-2 border-green-500"></div><span>Correct Key</span></div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4">
        {[0, 1, 2, 3].map(colIdx => {
          const start = colIdx * 25;
          const end = Math.min(start + 25, answerKey.length);
          if (start >= answerKey.length) return null;
          
          return (
            <div key={colIdx} className="space-y-1">
              {Array.from({ length: end - start }, (_, i) => {
                const qIdx = start + i;
                const studentAns = answers[qIdx]?.toUpperCase();
                const correctAns = answerKey[qIdx]?.toUpperCase();
                
                return (
                  <div key={qIdx} className="flex items-center gap-2 h-6">
                    <span className="text-[10px] font-bold text-gray-400 w-4 text-right">{qIdx + 1}</span>
                    <div className="flex gap-1">
                      {choices.map(choice => {
                        const isStudent = studentAns === choice;
                        const isCorrect = correctAns === choice;
                        
                        return (
                          <div 
                            key={choice}
                            className={`w-4 h-4 rounded-full border flex items-center justify-center text-[8px] font-bold transition-all
                              ${isStudent ? 'bg-primary text-white border-primary shadow-sm' : 'bg-transparent text-gray-400 border-gray-300'}
                              ${isCorrect ? 'ring-2 ring-green-500 ring-offset-1' : ''}
                            `}
                          >
                            {choice}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ReviewPapersPage({ params }: ReviewPapersProps) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [papers, setPapers] = useState<PaperWithDetails[]>([]);
  const [answerKey, setAnswerKey] = useState<AnswerChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaper, setSelectedPaper] = useState<PaperWithDetails | null>(null);
  const examId = params.id;

  const calculateLetterGrade = (percentage: number): string => {
    if (percentage >= 90) return 'A';
    if (percentage >= 85) return 'A-';
    if (percentage >= 80) return 'B+';
    if (percentage >= 75) return 'B';
    if (percentage >= 70) return 'C+';
    if (percentage >= 65) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  const getGradeColor = (grade: string): string => {
    if (grade.startsWith('A')) return 'text-green-700 bg-green-50';
    if (grade.startsWith('B')) return 'text-lime-700 bg-lime-50';
    if (grade.startsWith('C')) return 'text-yellow-700 bg-yellow-50';
    if (grade.startsWith('D')) return 'text-orange-700 bg-orange-50';
    return 'text-red-700 bg-red-50';
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const examData = await getExamById(examId);
        if (!examData) {
          toast.error('Exam not found');
          setLoading(false);
          return;
        }
        setExam(examData);

        const akResult = await AnswerKeyService.getAnswerKeyByExamId(examId);
        let ak: AnswerChoice[] = [];
        if (akResult.success && akResult.data) {
          ak = akResult.data.answers;
          setAnswerKey(ak);
        }

        let cls: Class | null = null;
        if ((examData as any).classId) {
          cls = await getClassById((examData as any).classId);
        }

        const scannedResult = await ScanningService.getScannedResultsByExamId(examId);
        if (scannedResult.success && scannedResult.data) {
          const papersWithDetails: PaperWithDetails[] = scannedResult.data
            .filter(r => !r.isNullId)
            .map(result => {
              let studentName = result.studentId;
              if (cls) {
                const student = cls.students.find(s => s.student_id === result.studentId);
                if (student) {
                  studentName = `${student.last_name}, ${student.first_name}`;
                }
              }
              const percentage = result.totalQuestions > 0
                ? Math.round((result.score / result.totalQuestions) * 100)
                : 0;
              return {
                ...result,
                studentName,
                percentage,
                letterGrade: calculateLetterGrade(percentage),
              };
            });
          setPapers(papersWithDetails);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load exam data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [examId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading papers...</p>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="space-y-6">
        <Link href="/exams" className="p-2 hover:bg-muted rounded-md transition-colors inline-block">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <p className="text-foreground">Exam not found</p>
      </div>
    );
  }

  const avgScore = papers.length > 0
    ? Math.round(papers.reduce((sum, p) => sum + p.percentage, 0) / papers.length)
    : 0;
  const highestScore = papers.length > 0 ? Math.max(...papers.map(p => p.percentage)) : 0;
  const lowestScore = papers.length > 0 ? Math.min(...papers.map(p => p.percentage)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <Link href={`/exams/${examId}`} className="p-2 hover:bg-muted rounded-md transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 flex-shrink-0" />
            Review Papers
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Exam: {exam.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4 border">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Total Scanned</p>
          <p className="text-xl sm:text-2xl font-bold text-primary">{papers.length}</p>
        </Card>
        <Card className="p-3 sm:p-4 border">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Average Score</p>
          <p className="text-xl sm:text-2xl font-bold text-primary">{avgScore}%</p>
        </Card>
        <Card className="p-3 sm:p-4 border">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Highest</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{highestScore}%</p>
        </Card>
        <Card className="p-3 sm:p-4 border">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Lowest</p>
          <p className="text-xl sm:text-2xl font-bold text-red-600">{lowestScore}%</p>
        </Card>
      </div>

      {selectedPaper ? (
        <Card className="p-4 sm:p-6 border">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{selectedPaper.studentName}</h2>
                <p className="text-sm text-muted-foreground">ID: {selectedPaper.studentId}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`px-4 py-2 rounded-lg text-xl font-bold ${getGradeColor(selectedPaper.letterGrade)}`}>
                {selectedPaper.letterGrade}
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedPaper(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Score</p>
              <p className="text-lg font-bold">{selectedPaper.score}/{selectedPaper.totalQuestions}</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Percentage</p>
              <p className="text-lg font-bold">{selectedPaper.percentage}%</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Scanned</p>
              <p className="text-sm font-bold">
                {selectedPaper.scannedAt
                  ? new Date(selectedPaper.scannedAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })
                  : 'N/A'}
              </p>
            </div>
          </div>

          <BubbleSheetPreview 
            answers={selectedPaper.answers} 
            answerKey={answerKey} 
            choicesPerQuestion={exam.choices_per_item} 
          />

          {answerKey.length > 0 && (
            <div>
              <h3 className="font-semibold text-foreground mb-3">Answer Comparison</h3>
              {(() => {
                const halfPoint = Math.ceil(selectedPaper.answers.length / 2);
                const firstHalf = selectedPaper.answers.slice(0, halfPoint);
                const secondHalf = selectedPaper.answers.slice(halfPoint);

                return (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Questions 1-{halfPoint}</p>
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                        {firstHalf.map((answer, i) => {
                          const isCorrect = answerKey[i] && answer && answer.toUpperCase() === answerKey[i].toUpperCase();
                          return (
                            <div key={i} className="text-center">
                              <span className="text-[10px] text-muted-foreground block mb-1">{i + 1}</span>
                              <div className={`w-9 h-9 flex items-center justify-center rounded-lg border-2 text-sm font-bold ${
                                isCorrect
                                  ? 'border-green-500 bg-green-50 text-green-700'
                                  : answer
                                    ? 'border-red-500 bg-red-50 text-red-700'
                                    : 'border-gray-300 bg-gray-50 text-gray-400'
                              }`}>
                                {answer || '-'}
                              </div>
                              {answerKey[i] && !isCorrect && (
                                <span className="text-[9px] text-green-600 font-medium">{answerKey[i]}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {secondHalf.length > 0 && (
                      <div className="pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Questions {halfPoint + 1}-{selectedPaper.answers.length}</p>
                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                          {secondHalf.map((answer, i) => {
                            const idx = halfPoint + i;
                            const isCorrect = answerKey[idx] && answer && answer.toUpperCase() === answerKey[idx].toUpperCase();
                            return (
                              <div key={idx} className="text-center">
                                <span className="text-[10px] text-muted-foreground block mb-1">{idx + 1}</span>
                                <div className={`w-9 h-9 flex items-center justify-center rounded-lg border-2 text-sm font-bold ${
                                  isCorrect
                                    ? 'border-green-500 bg-green-50 text-green-700'
                                    : answer
                                      ? 'border-red-500 bg-red-50 text-red-700'
                                      : 'border-gray-300 bg-gray-50 text-gray-400'
                                }`}>
                                  {answer || '-'}
                                </div>
                                {answerKey[idx] && !isCorrect && (
                                  <span className="text-[9px] text-green-600 font-medium">{answerKey[idx]}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-4 pt-3 border-t text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-50 border-2 border-green-500 rounded" />
                        <span className="text-muted-foreground">Correct</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-red-50 border-2 border-red-500 rounded" />
                        <span className="text-muted-foreground">Incorrect</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-4 border">
          <h2 className="text-lg font-bold text-foreground mb-4">Scanned Papers ({papers.length})</h2>

          {papers.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No papers scanned yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Scan answer sheets from the exam page to see results here.
              </p>
              <Link href={`/exams/${examId}/scanning`}>
                <Button className="mt-4" variant="outline">Go to Scanner</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {papers.map(paper => (
                <div
                  key={paper.id}
                  onClick={() => setSelectedPaper(paper)}
                  className="p-4 border rounded-lg hover:shadow-md transition-all cursor-pointer hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{paper.studentName}</p>
                        <p className="text-xs text-muted-foreground">{paper.studentId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-bold text-foreground">{paper.score}/{paper.totalQuestions}</p>
                        <p className="text-xs text-muted-foreground">{paper.percentage}%</p>
                      </div>
                      <div className={`px-3 py-1 rounded-lg text-sm font-bold ${getGradeColor(paper.letterGrade)}`}>
                        {paper.letterGrade}
                      </div>
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
