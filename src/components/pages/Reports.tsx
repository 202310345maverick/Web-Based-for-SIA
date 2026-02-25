'use client';

import { useState, useMemo, useCallback } from 'react';
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
import {
  getMockClasses,
  getMockExams,
  getMockGrades,
  getOverallSummary,
  getAllExamStatistics,
  getScoreTrendData,
  getExamStatistics,
  getClassStatistics,
  getGradeColor,
  getStatusColor,
  MockGrade,
} from '@/services/mockGradeData';
import {
  exportGradesToCSV,
  exportGradesToExcel,
  exportGradesToPDF,
  printClassSummary,
  printStudentReportCard,
} from '@/services/reportExportService';

// ── Chart color constants ──
const GRADE_COLORS: Record<string, string> = {
  A: '#166534',
  B: '#2563eb',
  C: '#B38B00',
  D: '#ea580c',
  F: '#dc2626',
};

// ── Main Component ──
export default function Reports() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'name' | 'percentage' | 'date'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // ── Data ──
  const classes = useMemo(() => getMockClasses(), []);
  const allExams = useMemo(() => getMockExams(), []);
  const summary = useMemo(() => getOverallSummary(), []);
  const allExamStats = useMemo(() => getAllExamStatistics(), []);
  const trendData = useMemo(() => getScoreTrendData(), []);

  const filteredExams = useMemo(() => {
    if (selectedClassId === 'all') return allExams;
    return allExams.filter(e => e.classId === selectedClassId);
  }, [selectedClassId, allExams]);

  const currentExamStats = useMemo(() => {
    if (!selectedExamId) return null;
    return getExamStatistics(selectedExamId);
  }, [selectedExamId]);

  const filteredGrades = useMemo(() => {
    let grades = getMockGrades({
      classId: selectedClassId === 'all' ? undefined : selectedClassId,
      examId: selectedExamId || undefined,
    });
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      grades = grades.filter(
        g => g.studentName.toLowerCase().includes(q) || g.studentId.includes(q)
      );
    }
    grades.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.studentName.localeCompare(b.studentName);
      else if (sortField === 'percentage') cmp = a.percentage - b.percentage;
      else cmp = a.scannedAt.localeCompare(b.scannedAt);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return grades;
  }, [selectedClassId, selectedExamId, searchQuery, sortField, sortDir]);

  // ── Grade distribution for charts ──
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
  const handleExport = useCallback((format: 'csv' | 'excel' | 'pdf') => {
    const options = {
      title: selectedExamId
        ? `${currentExamStats?.examTitle || 'Exam'} Results`
        : selectedClassId !== 'all'
          ? `${classes.find(c => c.id === selectedClassId)?.name || 'Class'} Grades`
          : 'All Grades Report',
      instructorName: 'Dr. Maria Santos',
      institutionName: 'Gordon College',
      includeTimestamp: true,
      includeStatistics: true,
    };

    if (format === 'csv') exportGradesToCSV(filteredGrades, options);
    else if (format === 'excel') exportGradesToExcel(filteredGrades, options);
    else exportGradesToPDF(filteredGrades, options);
    setExportModalOpen(false);
  }, [filteredGrades, selectedExamId, selectedClassId, currentExamStats, classes]);

  const handlePrintClassSummary = useCallback((classId: string) => {
    printClassSummary(classId, {
      instructorName: 'Dr. Maria Santos',
      institutionName: 'Gordon College',
    });
  }, []);

  const handlePrintStudentCard = useCallback((studentId: string) => {
    printStudentReportCard(studentId, {
      instructorName: 'Dr. Maria Santos',
      institutionName: 'Gordon College',
    });
  }, []);

  const toggleSort = useCallback((field: 'name' | 'percentage' | 'date') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }, [sortField]);

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
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
            {/* Score Range Histogram */}
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

            {/* Pass/Fail Pie */}
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
                        <td className="py-2 px-3 text-center text-muted-foreground">{es.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════ EXAM RESULTS TAB ═══════ */}
        <TabsContent value="exams" className="space-y-6 mt-4">
          {/* Exam Selector */}
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={selectedExamId} onValueChange={setSelectedExamId}>
              <SelectTrigger className="w-[320px]">
                <SelectValue placeholder="Select an exam..." />
              </SelectTrigger>
              <SelectContent>
                {filteredExams.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.title} ({e.className})
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

          {/* Exam Stats Cards */}
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

              {/* Grade distribution for selected exam */}
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

                {/* Exam details */}
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
                        <p className="text-muted-foreground">Date Administered</p>
                        <p className="font-semibold">{currentExamStats.date}</p>
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
          {/* Filters */}
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

          {/* Grades Table */}
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
                        <td className="py-2 px-3 text-muted-foreground">{g.examTitle.length > 30 ? g.examTitle.slice(0, 28) + '…' : g.examTitle}</td>
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
                        <td className="py-2 px-3 text-center text-muted-foreground text-xs">{g.scannedAt.split('T')[0]}</td>
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
                  const stats = getClassStatistics(cls.id);
                  return (
                    <div key={cls.id} className="border rounded-lg p-4 hover:border-green-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{cls.name}</h4>
                          <p className="text-xs text-muted-foreground">{cls.schedule}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> {cls.studentCount} students
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
                        >
                          <Printer className="w-3.5 h-3.5 mr-1" />
                          Print
                        </Button>
                      </div>
                      {/* Mini grade distribution bar */}
                      {stats && (
                        <div className="mt-3 flex gap-0.5 h-2 rounded-full overflow-hidden">
                          {(() => {
                            const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
                            const classGrades = getMockGrades({ classId: cls.id });
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
                    </div>
                  );
                })}
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

              {/* Class selector for individual cards */}
              <div className="flex items-center gap-3 mb-4">
                <Select value={selectedClassId} onValueChange={(v) => { setSelectedClassId(v); }}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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

              {/* Student list */}
              {selectedClassId !== 'all' && (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {(() => {
                    const classGrades = getMockGrades({ classId: selectedClassId });
                    const studentMap = new Map<string, { name: string; grades: MockGrade[] }>();
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

// Simple letter grade helper
function letterGrade(pct: number): string {
  if (pct >= 93) return 'A';
  if (pct >= 90) return 'A-';
  if (pct >= 87) return 'B+';
  if (pct >= 83) return 'B';
  if (pct >= 80) return 'B-';
  if (pct >= 77) return 'C+';
  if (pct >= 73) return 'C';
  if (pct >= 70) return 'C-';
  if (pct >= 60) return 'D';
  return 'F';
}
