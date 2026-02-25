'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  TrendingUp,
  Users,
  GraduationCap,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Loader2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { getClasses, Class } from '@/services/classService';
import { getExams, Exam } from '@/services/examService';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  GradeRecord,
  ClassSummaryData,
  calculateLetterGrade,
  exportGradesToCSV,
  exportGradesToExcel,
  exportGradesToPDF,
  printClassSummary,
  printStudentReportCard,
} from '@/services/reportExportService';

// ── Chart colors ──
const GRADE_COLORS: Record<string, string> = {
  A: '#166534',
  B: '#2563eb',
  C: '#B38B00',
  D: '#ea580c',
  F: '#dc2626',
};

// ── Utility functions ──
function getGradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-green-700 bg-green-100 border-green-200';
  if (grade.startsWith('B')) return 'text-blue-700 bg-blue-100 border-blue-200';
  if (grade.startsWith('C')) return 'text-yellow-700 bg-yellow-100 border-yellow-200';
  if (grade.startsWith('D')) return 'text-orange-700 bg-orange-100 border-orange-200';
  return 'text-red-700 bg-red-100 border-red-200';
}

function getStatusColor(status: string): string {
  if (status === 'approved') return 'text-green-700 bg-green-50 border-green-200';
  if (status === 'reviewed') return 'text-blue-700 bg-blue-50 border-blue-200';
  return 'text-gray-700 bg-gray-50 border-gray-200';
}

function letterGrade(pct: number): string {
  return calculateLetterGrade(pct);
}

// ── Statistics helpers ──
interface ExamStatistics {
  examId: string;
  examTitle: string;
  className: string;
  date: string;
  totalStudents: number;
  averagePercentage: number;
  medianPercentage: number;
  highestPercentage: number;
  lowestPercentage: number;
  stdDeviation: number;
  passRate: number;
  failRate: number;
  gradeDistribution: Record<string, number>;
}

function computeExamStatistics(
  examGrades: GradeRecord[],
  examTitle: string,
  className: string,
  date: string,
  examId: string,
): ExamStatistics {
  const percentages = examGrades.map(g => g.percentage);
  const n = percentages.length;
  if (n === 0) {
    return {
      examId, examTitle, className, date,
      totalStudents: 0, averagePercentage: 0, medianPercentage: 0,
      highestPercentage: 0, lowestPercentage: 0, stdDeviation: 0,
      passRate: 0, failRate: 0,
      gradeDistribution: { A: 0, B: 0, C: 0, D: 0, F: 0 },
    };
  }
  const sorted = [...percentages].sort((a, b) => a - b);
  const avg = Math.round(sorted.reduce((s, v) => s + v, 0) / n * 10) / 10;
  const median = n % 2 === 0
    ? Math.round((sorted[n / 2 - 1] + sorted[n / 2]) / 2 * 10) / 10
    : sorted[Math.floor(n / 2)];
  const variance = sorted.reduce((s, v) => s + (v - avg) ** 2, 0) / n;
  const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;
  const passed = examGrades.filter(g => g.percentage >= 60).length;

  const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const g of examGrades) {
    const base = g.letterGrade[0];
    if (base in dist) dist[base]++;
  }

  return {
    examId, examTitle, className, date,
    totalStudents: n,
    averagePercentage: avg,
    medianPercentage: median,
    highestPercentage: Math.max(...percentages),
    lowestPercentage: Math.min(...percentages),
    stdDeviation: stdDev,
    passRate: Math.round((passed / n) * 1000) / 10,
    failRate: Math.round(((n - passed) / n) * 1000) / 10,
    gradeDistribution: dist,
  };
}

function computeClassStats(classGrades: GradeRecord[]) {
  if (classGrades.length === 0) return null;

  const uniqueExams = new Set(classGrades.map(g => g.examId));
  const studentMap = new Map<string, { name: string; grades: GradeRecord[] }>();
  for (const g of classGrades) {
    if (!studentMap.has(g.studentId)) studentMap.set(g.studentId, { name: g.studentName, grades: [] });
    studentMap.get(g.studentId)!.grades.push(g);
  }

  const avg = Math.round(classGrades.reduce((s, g) => s + g.percentage, 0) / classGrades.length * 10) / 10;
  const passed = classGrades.filter(g => g.percentage >= 60).length;
  const passRate = Math.round((passed / classGrades.length) * 1000) / 10;

  const studentAvgs = Array.from(studentMap.entries()).map(([, s]) => ({
    name: s.name,
    avg: Math.round(s.grades.reduce((sum, g) => sum + g.percentage, 0) / s.grades.length * 10) / 10,
  }));
  studentAvgs.sort((a, b) => b.avg - a.avg);

  return {
    totalStudents: studentMap.size,
    totalExams: uniqueExams.size,
    overallAverage: avg,
    passRate,
    topPerformers: studentAvgs.filter(s => s.avg >= 85).slice(0, 5),
    atRisk: studentAvgs.filter(s => s.avg < 60).slice(0, 5),
  };
}

// ── Firestore timestamp to ISO string ──
function toISOString(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'object' && val !== null && 'toDate' in val) {
    return (val as Timestamp).toDate().toISOString();
  }
  return new Date(val as string).toISOString();
}

// ── Main Component ──
export default function Reports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [grades, setGrades] = useState<GradeRecord[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'name' | 'percentage' | 'date'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // ── Fetch data from Firestore ──
  useEffect(() => {
    async function fetchAll() {
      if (!user?.id) return;
      setLoading(true);
      try {
        const [userClasses, userExams] = await Promise.all([
          getClasses(user.id),
          getExams(user.id),
        ]);
        setClasses(userClasses);
        setExams(userExams);

        // Build student name lookup from embedded class data
        const studentNameMap = new Map<string, string>();
        for (const cls of userClasses) {
          for (const s of cls.students || []) {
            if (s.student_id) {
              studentNameMap.set(s.student_id, `${s.last_name}, ${s.first_name}`);
            }
          }
        }

        // Map exam → class
        const examClassMap = new Map<string, { classId: string; className: string }>();
        for (const exam of userExams) {
          const cls = userClasses.find(
            c => c.class_name === exam.className || (exam as any).classId === c.id
          );
          if (cls) {
            examClassMap.set(exam.id, { classId: cls.id, className: cls.class_name });
          }
        }

        const allGrades: GradeRecord[] = [];
        const processedKeys = new Set<string>();

        // 1) Fetch from scannedResults (batches of 10 for Firestore 'in' limit)
        const allExamIds = userExams.map(e => e.id);
        for (let i = 0; i < allExamIds.length; i += 10) {
          const batch = allExamIds.slice(i, i + 10);
          try {
            const q = query(collection(db, 'scannedResults'), where('examId', 'in', batch));
            const snap = await getDocs(q);
            snap.forEach(docSnap => {
              const data = docSnap.data();
              if (data.isNullId) return;
              const key = `${data.studentId}_${data.examId}`;
              if (processedKeys.has(key)) return;
              processedKeys.add(key);

              const exam = userExams.find(e => e.id === data.examId);
              const classInfo = examClassMap.get(data.examId);
              const percentage = data.totalQuestions > 0
                ? Math.round((data.score / data.totalQuestions) * 100)
                : 0;

              allGrades.push({
                id: docSnap.id,
                studentId: data.studentId,
                studentName: studentNameMap.get(data.studentId) || data.studentId,
                examId: data.examId,
                examTitle: exam?.title || data.examId,
                classId: classInfo?.classId || '',
                className: classInfo?.className || '',
                score: data.score || 0,
                totalQuestions: data.totalQuestions || 0,
                percentage,
                letterGrade: calculateLetterGrade(percentage),
                status: 'submitted',
                scannedAt: toISOString(data.scannedAt),
              });
            });
          } catch (err) {
            console.error('Error fetching scannedResults batch:', err);
          }
        }

        // 2) Fetch from studentGrades per class
        for (const cls of userClasses) {
          try {
            const q = query(collection(db, 'studentGrades'), where('class_id', '==', cls.id));
            const snap = await getDocs(q);
            snap.forEach(docSnap => {
              const data = docSnap.data();
              const key = `${data.student_id}_${data.exam_id}`;
              if (processedKeys.has(key)) return;
              processedKeys.add(key);

              const exam = userExams.find(e => e.id === data.exam_id);
              const percentage = data.percentage ||
                (data.max_score > 0 ? Math.round((data.score / data.max_score) * 100) : 0);

              allGrades.push({
                id: docSnap.id,
                studentId: data.student_id,
                studentName: studentNameMap.get(data.student_id) || data.student_id,
                examId: data.exam_id,
                examTitle: exam?.title || data.exam_id || 'Unknown Exam',
                classId: cls.id,
                className: cls.class_name,
                score: data.score || 0,
                totalQuestions: data.max_score || 0,
                percentage,
                letterGrade: data.letter_grade || calculateLetterGrade(percentage),
                status: data.status || 'submitted',
                scannedAt: toISOString(data.graded_at),
              });
            });
          } catch (err) {
            console.error('Error fetching grades for class:', cls.id, err);
          }
        }

        setGrades(allGrades);
      } catch (error) {
        console.error('Error fetching report data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, [user?.id]);

  // ── Computed data ──

  const filteredExams = useMemo(() => {
    if (selectedClassId === 'all') return exams;
    const cls = classes.find(c => c.id === selectedClassId);
    if (!cls) return exams;
    return exams.filter(
      e => e.className === cls.class_name || (e as any).classId === cls.id
    );
  }, [selectedClassId, exams, classes]);

  const filteredGrades = useMemo(() => {
    let result = [...grades];
    if (selectedClassId !== 'all') {
      result = result.filter(g => g.classId === selectedClassId);
    }
    if (selectedExamId) {
      result = result.filter(g => g.examId === selectedExamId);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        g => g.studentName.toLowerCase().includes(q) || g.studentId.includes(q)
      );
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.studentName.localeCompare(b.studentName);
      else if (sortField === 'percentage') cmp = a.percentage - b.percentage;
      else cmp = (a.scannedAt || '').localeCompare(b.scannedAt || '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [grades, selectedClassId, selectedExamId, searchQuery, sortField, sortDir]);

  const summary = useMemo(() => {
    const uniqueExams = new Set(grades.map(g => g.examId));
    const uniqueStudents = new Set(grades.map(g => g.studentId));
    const uniqueClasses = new Set(grades.map(g => g.classId).filter(Boolean));
    const avg = grades.length > 0
      ? Math.round(grades.reduce((s, g) => s + g.percentage, 0) / grades.length * 10) / 10
      : 0;
    const passed = grades.filter(g => g.percentage >= 60).length;
    const passRate = grades.length > 0 ? Math.round((passed / grades.length) * 1000) / 10 : 0;

    const now = new Date();
    const thisMonth = grades.filter(g => {
      const d = new Date(g.scannedAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const examsThisMonth = new Set(thisMonth.map(g => g.examId)).size;

    return {
      totalExams: uniqueExams.size,
      totalStudents: uniqueStudents.size,
      totalClasses: uniqueClasses.size,
      overallAverage: avg,
      passRate,
      totalGrades: grades.length,
      examsThisMonth,
    };
  }, [grades]);

  const allExamStats = useMemo(() => {
    const examIds = [...new Set(grades.map(g => g.examId))];
    return examIds.map(eid => {
      const examGrades = grades.filter(g => g.examId === eid);
      const exam = exams.find(e => e.id === eid);
      return computeExamStatistics(
        examGrades,
        exam?.title || eid,
        examGrades[0]?.className || '',
        exam?.created_at || examGrades[0]?.scannedAt || '',
        eid,
      );
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [grades, exams]);

  const trendData = useMemo(() => {
    return [...allExamStats]
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .map(es => ({
        exam: es.examTitle.length > 20 ? es.examTitle.slice(0, 18) + '...' : es.examTitle,
        className: es.className,
        average: es.averagePercentage,
      }));
  }, [allExamStats]);

  const currentExamStats = useMemo(() => {
    if (!selectedExamId) return null;
    return allExamStats.find(es => es.examId === selectedExamId) || null;
  }, [selectedExamId, allExamStats]);

  const gradeDistribution = useMemo(() => {
    const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const g of filteredGrades) {
      const base = g.letterGrade[0];
      if (base in dist) dist[base]++;
    }
    return Object.entries(dist).map(([grade, count]) => ({
      grade,
      count,
      percentage: filteredGrades.length > 0 ? Math.round((count / filteredGrades.length) * 1000) / 10 : 0,
      fill: GRADE_COLORS[grade],
    }));
  }, [filteredGrades]);

  const scoreRangeData = useMemo(() => {
    const ranges = [
      { range: '0-19', min: 0, max: 19, count: 0 },
      { range: '20-39', min: 20, max: 39, count: 0 },
      { range: '40-59', min: 40, max: 59, count: 0 },
      { range: '60-79', min: 60, max: 79, count: 0 },
      { range: '80-100', min: 80, max: 100, count: 0 },
    ];
    for (const g of filteredGrades) {
      const r = ranges.find(rng => g.percentage >= rng.min && g.percentage <= rng.max);
      if (r) r.count++;
    }
    return ranges;
  }, [filteredGrades]);

  // ── Callbacks ──

  const instructorName = user?.displayName || 'Instructor';

  const handleExport = useCallback((format: 'csv' | 'excel' | 'pdf') => {
    const options = {
      title: selectedExamId
        ? `${currentExamStats?.examTitle || 'Exam'} Results`
        : selectedClassId !== 'all'
          ? `${classes.find(c => c.id === selectedClassId)?.class_name || 'Class'} Grades`
          : 'All Grades Report',
      instructorName,
      institutionName: 'Gordon College',
      includeTimestamp: true,
      includeStatistics: true,
    };

    if (format === 'csv') exportGradesToCSV(filteredGrades, options);
    else if (format === 'excel') exportGradesToExcel(filteredGrades, options);
    else exportGradesToPDF(filteredGrades, options);
    setExportModalOpen(false);
  }, [filteredGrades, selectedExamId, selectedClassId, currentExamStats, classes, instructorName]);

  const handlePrintClassSummary = useCallback((classId: string) => {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;

    const classGrades = grades.filter(g => g.classId === classId);
    const stats = computeClassStats(classGrades);
    if (!stats) return;

    const classExams = exams.filter(
      e => e.className === cls.class_name || (e as any).classId === cls.id
    );
    const examSummaries = classExams.map(exam => {
      const examGrades = classGrades.filter(g => g.examId === exam.id);
      const percentages = examGrades.map(g => g.percentage);
      const avg = percentages.length > 0
        ? Math.round(percentages.reduce((s, v) => s + v, 0) / percentages.length * 10) / 10
        : 0;
      const passed = examGrades.filter(g => g.percentage >= 60).length;
      return {
        title: exam.title,
        date: exam.created_at || '',
        totalStudents: examGrades.length,
        averagePercentage: avg,
        passRate: percentages.length > 0 ? Math.round((passed / percentages.length) * 1000) / 10 : 0,
        highestPercentage: percentages.length > 0 ? Math.max(...percentages) : 0,
      };
    });

    const summaryData: ClassSummaryData = {
      className: cls.class_name,
      schedule: cls.room || '',
      section: cls.section_block || '',
      totalStudents: stats.totalStudents,
      totalExams: stats.totalExams,
      overallAverage: stats.overallAverage,
      passRate: stats.passRate,
      exams: examSummaries,
      topPerformers: stats.topPerformers,
      atRisk: stats.atRisk,
    };

    printClassSummary(summaryData, {
      instructorName,
      institutionName: 'Gordon College',
    });
  }, [classes, grades, exams, instructorName]);

  const handlePrintStudentCard = useCallback((studentId: string) => {
    const studentGrades = grades.filter(g => g.studentId === studentId);
    if (studentGrades.length === 0) return;

    printStudentReportCard({
      studentId,
      studentName: studentGrades[0].studentName,
      grades: studentGrades,
    }, {
      instructorName,
      institutionName: 'Gordon College',
    });
  }, [grades, instructorName]);

  const toggleSort = useCallback((field: 'name' | 'percentage' | 'date') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }, [sortField]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-green-700" />
        <p className="text-muted-foreground text-sm">Loading report data...</p>
      </div>
    );
  }

  // ── Empty state ──
  if (grades.length === 0 && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive performance analytics, grade visualization, and export tools.
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-40" />
            <h2 className="text-xl font-semibold text-muted-foreground mb-2">No Data Yet</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              There are no scanned results or graded exams to display. Start by creating classes,
              adding students, creating exams, and scanning answer sheets.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive performance analytics, grade visualization, and export tools.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedClassId} onValueChange={(v) => { setSelectedClassId(v); setSelectedExamId(''); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.class_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Button
              variant="default"
              className="bg-green-800 hover:bg-green-900"
              onClick={() => setExportModalOpen(!exportModalOpen)}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
              <ChevronDown className="w-4 h-4 ml-1" />
            </Button>
            {exportModalOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border z-50 py-1">
                <button onClick={() => handleExport('excel')} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-gray-50 text-left">
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  <div>
                    <div className="font-medium">Excel (.xlsx)</div>
                    <div className="text-xs text-muted-foreground">Spreadsheet with statistics</div>
                  </div>
                </button>
                <button onClick={() => handleExport('csv')} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-gray-50 text-left">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="font-medium">CSV (.csv)</div>
                    <div className="text-xs text-muted-foreground">Comma-separated values</div>
                  </div>
                </button>
                <button onClick={() => handleExport('pdf')} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-gray-50 text-left">
                  <FileText className="w-4 h-4 text-red-600" />
                  <div>
                    <div className="font-medium">PDF Report</div>
                    <div className="text-xs text-muted-foreground">Branded report with logo</div>
                  </div>
                </button>
                <div className="border-t my-1" />
                {selectedClassId !== 'all' && (
                  <button onClick={() => handlePrintClassSummary(selectedClassId)} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-gray-50 text-left">
                    <Printer className="w-4 h-4 text-purple-600" />
                    <div>
                      <div className="font-medium">Print Class Summary</div>
                      <div className="text-xs text-muted-foreground">PDF for printing</div>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="exams">Exam Results</TabsTrigger>
          <TabsTrigger value="students">Student Grades</TabsTrigger>
          <TabsTrigger value="print">Print Reports</TabsTrigger>
        </TabsList>

        {/* ═══════ OVERVIEW TAB ═══════ */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-green-600">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Exams</p>
                    <p className="text-2xl font-bold mt-1">{summary.totalExams}</p>
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3" /> {summary.examsThisMonth} this month
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-green-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-600">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Students</p>
                    <p className="text-2xl font-bold mt-1">{summary.totalStudents}</p>
                    <p className="text-xs text-muted-foreground mt-1">{summary.totalClasses} classes</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Class Average</p>
                    <p className="text-2xl font-bold mt-1">{summary.overallAverage}%</p>
                    <p className="text-xs text-muted-foreground mt-1">{summary.totalGrades} records</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-amber-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-600">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pass Rate</p>
                    <p className="text-2xl font-bold mt-1">{summary.passRate}%</p>
                    <p className={`text-xs mt-1 flex items-center gap-1 ${summary.passRate >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                      {summary.passRate >= 70 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {summary.passRate >= 70 ? 'Above target' : 'Below target'}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-purple-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Grade Distribution Bar Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Grade Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gradeDistribution} barSize={40}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload?.[0]) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-white border rounded-lg shadow px-3 py-2 text-sm">
                                <div className="font-semibold">Grade {d.grade}</div>
                                <div>{d.count} students ({d.percentage}%)</div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {gradeDistribution.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Score Trend Area Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Score Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#166534" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#166534" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="exam" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload?.[0]) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-white border rounded-lg shadow px-3 py-2 text-sm">
                                <div className="font-semibold">{d.exam}</div>
                                <div className="text-muted-foreground">{d.className}</div>
                                <div className="text-green-700 font-medium">Average: {d.average}%</div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area type="monotone" dataKey="average" stroke="#166534" fill="url(#gradGreen)" strokeWidth={2} dot={{ r: 4, fill: '#166534' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Score Range + Pie Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Score Range Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scoreRangeData} barSize={36}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#166534" radius={[4, 4, 0, 0]} name="Students" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Pass / Fail Ratio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Passed', value: filteredGrades.filter(g => g.percentage >= 60).length },
                          { name: 'Failed', value: filteredGrades.filter(g => g.percentage < 60).length },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        <Cell fill="#166534" />
                        <Cell fill="#dc2626" />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Per-Exam Stats Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Exam Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left py-2.5 px-3 font-semibold">Exam</th>
                      <th className="text-left py-2.5 px-3 font-semibold">Class</th>
                      <th className="text-center py-2.5 px-3 font-semibold">Students</th>
                      <th className="text-center py-2.5 px-3 font-semibold">Average</th>
                      <th className="text-center py-2.5 px-3 font-semibold">Median</th>
                      <th className="text-center py-2.5 px-3 font-semibold">Std Dev</th>
                      <th className="text-center py-2.5 px-3 font-semibold">Pass Rate</th>
                      <th className="text-center py-2.5 px-3 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allExamStats.map((es, i) => (
                      <tr key={es.examId} className={`border-b hover:bg-muted/20 ${i % 2 === 0 ? 'bg-white' : 'bg-muted/10'}`}>
                        <td className="py-2 px-3 font-medium">{es.examTitle}</td>
                        <td className="py-2 px-3 text-muted-foreground">{es.className}</td>
                        <td className="py-2 px-3 text-center">{es.totalStudents}</td>
                        <td className="py-2 px-3 text-center font-medium">{es.averagePercentage}%</td>
                        <td className="py-2 px-3 text-center">{es.medianPercentage}%</td>
                        <td className="py-2 px-3 text-center">{es.stdDeviation}</td>
                        <td className="py-2 px-3 text-center">
                          <Badge variant="outline" className={es.passRate >= 70 ? 'text-green-700 border-green-200 bg-green-50' : 'text-red-700 border-red-200 bg-red-50'}>
                            {es.passRate}%
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-center text-muted-foreground">
                          {es.date ? new Date(es.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                        </td>
                      </tr>
                    ))}
                    {allExamStats.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-muted-foreground">No exam data available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════ EXAM RESULTS TAB ═══════ */}
        <TabsContent value="exams" className="space-y-6 mt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={selectedExamId} onValueChange={setSelectedExamId}>
              <SelectTrigger className="w-[320px]">
                <SelectValue placeholder="Select an exam..." />
              </SelectTrigger>
              <SelectContent>
                {filteredExams.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.title} ({e.className || 'No class'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedExamId && (
              <Button variant="outline" size="sm" onClick={() => setSelectedExamId('')}>
                Clear
              </Button>
            )}
          </div>

          {currentExamStats && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Students', value: String(currentExamStats.totalStudents), colorCls: 'text-blue-700' },
                  { label: 'Average', value: `${currentExamStats.averagePercentage}%`, colorCls: 'text-green-700' },
                  { label: 'Median', value: `${currentExamStats.medianPercentage}%`, colorCls: 'text-amber-700' },
                  { label: 'Highest', value: `${currentExamStats.highestPercentage}%`, colorCls: 'text-emerald-700' },
                  { label: 'Pass Rate', value: `${currentExamStats.passRate}%`, colorCls: currentExamStats.passRate >= 70 ? 'text-green-700' : 'text-red-700' },
                ].map(({ label, value, colorCls }) => (
                  <Card key={label} className="border">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className={`text-xl font-bold mt-1 ${colorCls}`}>{value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Grade Distribution — {currentExamStats.examTitle}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={Object.entries(currentExamStats.gradeDistribution).map(([grade, count]) => ({
                            grade, count, fill: GRADE_COLORS[grade],
                          }))}
                          barSize={36}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="grade" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {Object.entries(currentExamStats.gradeDistribution).map(([grade], i) => (
                              <Cell key={i} fill={GRADE_COLORS[grade]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Exam Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-muted-foreground">Exam</p>
                        <p className="font-semibold">{currentExamStats.examTitle}</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-muted-foreground">Class</p>
                        <p className="font-semibold">{currentExamStats.className}</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-muted-foreground">Date</p>
                        <p className="font-semibold">
                          {currentExamStats.date
                            ? new Date(currentExamStats.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                            : 'N/A'}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-muted-foreground">Std Deviation</p>
                        <p className="font-semibold">{currentExamStats.stdDeviation}</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-muted-foreground">Lowest Score</p>
                        <p className="font-semibold text-red-600">{currentExamStats.lowestPercentage}%</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-muted-foreground">Fail Rate</p>
                        <p className="font-semibold text-red-600">{currentExamStats.failRate}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {!selectedExamId && (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-lg font-medium text-muted-foreground">Select an exam above</p>
                <p className="text-sm text-muted-foreground mt-1">Choose an exam to view detailed results and statistics.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════ STUDENT GRADES TAB ═══════ */}
        <TabsContent value="students" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <Select value={selectedExamId || 'all-exams'} onValueChange={(v) => setSelectedExamId(v === 'all-exams' ? '' : v)}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="All Exams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-exams">All Exams</SelectItem>
                {filteredExams.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-muted-foreground">
              {filteredGrades.length} records
            </Badge>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left py-2.5 px-4 font-semibold w-8">#</th>
                      <th className="text-left py-2.5 px-3 font-semibold cursor-pointer hover:text-green-700" onClick={() => toggleSort('name')}>
                        Student {sortField === 'name' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />)}
                      </th>
                      <th className="text-left py-2.5 px-3 font-semibold">ID</th>
                      <th className="text-left py-2.5 px-3 font-semibold">Exam</th>
                      <th className="text-center py-2.5 px-3 font-semibold">Score</th>
                      <th className="text-center py-2.5 px-3 font-semibold cursor-pointer hover:text-green-700" onClick={() => toggleSort('percentage')}>
                        Percentage {sortField === 'percentage' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />)}
                      </th>
                      <th className="text-center py-2.5 px-3 font-semibold">Grade</th>
                      <th className="text-center py-2.5 px-3 font-semibold">Status</th>
                      <th className="text-center py-2.5 px-3 font-semibold cursor-pointer hover:text-green-700" onClick={() => toggleSort('date')}>
                        Date {sortField === 'date' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />)}
                      </th>
                      <th className="text-center py-2.5 px-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGrades.slice(0, 100).map((g, i) => (
                      <tr
                        key={g.id}
                        className={`border-b hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/5'}`}
                      >
                        <td className="py-2 px-4 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 px-3 font-medium">{g.studentName}</td>
                        <td className="py-2 px-3 text-muted-foreground font-mono text-xs">{g.studentId}</td>
                        <td className="py-2 px-3 text-muted-foreground">{g.examTitle.length > 30 ? g.examTitle.slice(0, 28) + '...' : g.examTitle}</td>
                        <td className="py-2 px-3 text-center">{g.score}/{g.totalQuestions}</td>
                        <td className="py-2 px-3 text-center font-medium">{g.percentage}%</td>
                        <td className="py-2 px-3 text-center">
                          <Badge variant="outline" className={`text-xs ${getGradeColor(g.letterGrade)}`}>
                            {g.letterGrade}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Badge variant="outline" className={`text-xs ${getStatusColor(g.status)}`}>
                            {g.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-center text-muted-foreground text-xs">
                          {g.scannedAt ? g.scannedAt.split('T')[0] : 'N/A'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="Print Report Card"
                            onClick={() => handlePrintStudentCard(g.studentId)}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredGrades.length > 100 && (
                  <div className="py-3 px-4 text-center text-sm text-muted-foreground border-t">
                    Showing first 100 of {filteredGrades.length} records. Use filters or export to view all.
                  </div>
                )}
                {filteredGrades.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground">
                    <Search className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p>No grades match your filters.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════ PRINT REPORTS TAB ═══════ */}
        <TabsContent value="print" className="space-y-6 mt-4">
          {/* Class Summaries */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Printer className="w-5 h-5" />
                Class Summary Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Generate printable class summary PDFs with exam breakdowns, grade distributions, top performers, and at-risk students.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classes.map(cls => {
                  const classGrades = grades.filter(g => g.classId === cls.id);
                  const stats = computeClassStats(classGrades);
                  return (
                    <div key={cls.id} className="border rounded-lg p-4 hover:border-green-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{cls.class_name}</h4>
                          <p className="text-xs text-muted-foreground">{cls.section_block || cls.room || 'No section'}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> {cls.students?.length || 0} students
                            </span>
                            {stats && (
                              <>
                                <span>Avg: <strong>{stats.overallAverage}%</strong></span>
                                <span>Pass: <strong>{stats.passRate}%</strong></span>
                              </>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePrintClassSummary(cls.id)}
                          disabled={classGrades.length === 0}
                        >
                          <Printer className="w-3.5 h-3.5 mr-1" />
                          Print
                        </Button>
                      </div>
                      {/* Mini grade distribution bar */}
                      {classGrades.length > 0 && (
                        <div className="mt-3 flex gap-0.5 h-2 rounded-full overflow-hidden">
                          {(() => {
                            const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
                            for (const g of classGrades) { const b = g.letterGrade[0]; if (b in dist) dist[b]++; }
                            const total = classGrades.length || 1;
                            return Object.entries(dist).map(([grade, count]) => (
                              <div
                                key={grade}
                                className="h-full"
                                style={{ width: `${(count / total) * 100}%`, backgroundColor: GRADE_COLORS[grade] }}
                                title={`Grade ${grade}: ${count} (${Math.round((count / total) * 100)}%)`}
                              />
                            ));
                          })()}
                        </div>
                      )}
                      {classGrades.length === 0 && (
                        <p className="mt-2 text-xs text-muted-foreground italic">No grades recorded yet</p>
                      )}
                    </div>
                  );
                })}
                {classes.length === 0 && (
                  <div className="col-span-2 py-8 text-center text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p>No classes found. Create a class to get started.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Individual Report Cards */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Individual Report Cards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Generate individual student report cards with all exam scores, overall average, and instructor signature lines.
              </p>

              <div className="flex items-center gap-3 mb-4">
                <Select value={selectedClassId} onValueChange={(v) => { setSelectedClassId(v); }}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.class_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search student..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {selectedClassId !== 'all' && (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {(() => {
                    const classGrades = grades.filter(g => g.classId === selectedClassId);
                    const studentMap = new Map<string, { name: string; grades: GradeRecord[] }>();
                    for (const g of classGrades) {
                      if (!studentMap.has(g.studentId)) studentMap.set(g.studentId, { name: g.studentName, grades: [] });
                      studentMap.get(g.studentId)!.grades.push(g);
                    }
                    let studentEntries = Array.from(studentMap.entries());
                    if (searchQuery) {
                      const q = searchQuery.toLowerCase();
                      studentEntries = studentEntries.filter(([id, s]) =>
                        s.name.toLowerCase().includes(q) || id.includes(q)
                      );
                    }
                    if (studentEntries.length === 0) {
                      return (
                        <div className="py-8 text-center text-muted-foreground">
                          <Search className="w-10 h-10 mx-auto mb-2 opacity-40" />
                          <p>No students with grades found in this class.</p>
                        </div>
                      );
                    }
                    return studentEntries.slice(0, 50).map(([studentId, student]) => {
                      const avg = Math.round(student.grades.reduce((s, g) => s + g.percentage, 0) / student.grades.length * 10) / 10;
                      return (
                        <div key={studentId} className="flex items-center justify-between p-3 border rounded-lg hover:border-green-300 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-800 text-xs font-bold">
                              {student.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{student.name}</p>
                              <p className="text-xs text-muted-foreground">{studentId} · {student.grades.length} exams · Avg: {avg}%</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={getGradeColor(letterGrade(avg))}>
                              {letterGrade(avg)}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePrintStudentCard(studentId)}
                            >
                              <Printer className="w-3.5 h-3.5 mr-1" />
                              Report Card
                            </Button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {selectedClassId === 'all' && (
                <div className="py-8 text-center text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p>Select a class above to view students.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export Band */}
          <Card className="bg-green-50 border-green-200">
            <CardContent className="py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-green-800">Bulk Export</h3>
                <p className="text-sm text-green-700">Download all grade data in your preferred format for institutional records.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="border-green-300 text-green-800 hover:bg-green-100" onClick={() => handleExport('excel')}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Excel
                </Button>
                <Button variant="outline" className="border-green-300 text-green-800 hover:bg-green-100" onClick={() => handleExport('csv')}>
                  <FileText className="w-4 h-4 mr-2" />
                  CSV
                </Button>
                <Button className="bg-green-800 hover:bg-green-900 text-white" onClick={() => handleExport('pdf')}>
                  <Download className="w-4 h-4 mr-2" />
                  PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Click-away overlay for export dropdown */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setExportModalOpen(false)} />
      )}
    </div>
  );
}
