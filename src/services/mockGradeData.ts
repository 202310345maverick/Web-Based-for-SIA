// ─── Mock Grade Data Service ───
// Generates realistic sample data for the Results, Reporting & Export subsystem.
// No real database calls — all data is deterministic and in-memory.

export interface MockStudent {
  id: string;
  studentId: string;
  name: string;
  email: string;
  section: string;
}

export interface MockExam {
  id: string;
  title: string;
  subject: string;
  classId: string;
  className: string;
  totalQuestions: number;
  date: string;
  createdBy: string;
}

export interface MockGrade {
  id: string;
  studentId: string;
  studentName: string;
  examId: string;
  examTitle: string;
  classId: string;
  className: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  letterGrade: string;
  status: 'submitted' | 'approved' | 'reviewed';
  scannedAt: string;
}

export interface MockClass {
  id: string;
  name: string;
  section: string;
  schedule: string;
  studentCount: number;
}

// ── Deterministic seed-based random ──
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Grade calculation ──
export function calculateLetterGrade(percentage: number): string {
  if (percentage >= 97) return 'A+';
  if (percentage >= 93) return 'A';
  if (percentage >= 90) return 'A-';
  if (percentage >= 87) return 'B+';
  if (percentage >= 83) return 'B';
  if (percentage >= 80) return 'B-';
  if (percentage >= 77) return 'C+';
  if (percentage >= 73) return 'C';
  if (percentage >= 70) return 'C-';
  if (percentage >= 67) return 'D+';
  if (percentage >= 63) return 'D';
  if (percentage >= 60) return 'D-';
  return 'F';
}

export function getGradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-green-700 bg-green-100 border-green-200';
  if (grade.startsWith('B')) return 'text-blue-700 bg-blue-100 border-blue-200';
  if (grade.startsWith('C')) return 'text-yellow-700 bg-yellow-100 border-yellow-200';
  if (grade.startsWith('D')) return 'text-orange-700 bg-orange-100 border-orange-200';
  return 'text-red-700 bg-red-100 border-red-200';
}

export function getStatusColor(status: string): string {
  if (status === 'approved') return 'text-green-700 bg-green-50';
  if (status === 'reviewed') return 'text-blue-700 bg-blue-50';
  return 'text-gray-700 bg-gray-50';
}

// ── First/Last name pools ──
const FIRST_NAMES = [
  'Maria', 'Juan', 'Ana', 'Carlos', 'Sofia', 'Miguel', 'Isabella', 'Jose',
  'Daniela', 'Angelo', 'Patricia', 'Marco', 'Angelica', 'Rafael', 'Cristina',
  'Gabriel', 'Jasmine', 'Antonio', 'Nicole', 'Emmanuel', 'Bianca', 'Luis',
  'Samantha', 'Roberto', 'Katherine', 'Diego', 'Veronica', 'Eduardo', 'Rachel',
  'Fernando', 'Andrea', 'Ricardo', 'Monica', 'Alejandro', 'Teresa', 'Santiago',
  'Camille', 'Vincent', 'Beatrice', 'Dominic', 'Clarissa', 'Christian', 'Denise',
  'Patrick', 'Erica', 'Jerome', 'Frances', 'Kenneth', 'Gabrielle', 'Lawrence',
];

const LAST_NAMES = [
  'Dela Cruz', 'Santos', 'Reyes', 'Garcia', 'Mendoza', 'Rivera', 'Torres',
  'Flores', 'Cruz', 'Lopez', 'Martinez', 'Gonzalez', 'Hernandez', 'Perez',
  'Rodriguez', 'Ramos', 'Villanueva', 'Aquino', 'Bautista', 'Castillo',
  'De Leon', 'Dizon', 'Evangelista', 'Francisco', 'Gutierrez', 'Ignacio',
  'Jimenez', 'Lim', 'Manalo', 'Navarro', 'Ocampo', 'Padilla', 'Quinto',
  'Rosario', 'Salvador', 'Tan', 'Uy', 'Valencia', 'Yap', 'Zamora',
  'Aguilar', 'Basilio', 'Corpuz', 'Dimaculangan', 'Enriquez', 'Fajardo',
  'Galang', 'Hidalgo', 'Ilagan', 'Jacinto',
];

const SUBJECTS = [
  'General Mathematics', 'Statistics & Probability', 'Earth Science',
  'Physical Science', 'Biology', 'Chemistry', 'Physics',
  'English 101', 'Filipino 101', 'Introduction to Computing',
];

// Sections used by class definitions above

// ── Generate all mock data ──
function generateMockData() {
  const rand = seededRandom(42);

  // Generate classes
  const classes: MockClass[] = [
    { id: 'cls-001', name: 'STEM 11-A', section: 'A', schedule: 'MWF 8:00-9:30 AM', studentCount: 35 },
    { id: 'cls-002', name: 'STEM 11-B', section: 'B', schedule: 'TTh 10:00-11:30 AM', studentCount: 32 },
    { id: 'cls-003', name: 'ABM 11-A', section: 'A', schedule: 'MWF 1:00-2:30 PM', studentCount: 30 },
    { id: 'cls-004', name: 'HUMSS 11-A', section: 'A', schedule: 'TTh 2:00-3:30 PM', studentCount: 28 },
  ];

  // Generate students
  const students: MockStudent[] = [];
  let studentCounter = 0;
  for (const cls of classes) {
    for (let i = 0; i < cls.studentCount; i++) {
      const firstName = FIRST_NAMES[studentCounter % FIRST_NAMES.length];
      const lastName = LAST_NAMES[studentCounter % LAST_NAMES.length];
      const idNum = String(2024000100 + studentCounter).padStart(10, '0');
      students.push({
        id: `stu-${String(studentCounter + 1).padStart(3, '0')}`,
        studentId: idNum,
        name: `${lastName}, ${firstName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s/g, '')}@gordoncollege.edu.ph`,
        section: cls.section,
      });
      studentCounter++;
    }
  }

  // Generate exams (2-3 per class)
  const exams: MockExam[] = [];
  const examDates = [
    '2026-01-15', '2026-01-28', '2026-02-05',
    '2026-02-12', '2026-02-19', '2026-02-24',
  ];
  let examCounter = 0;
  for (const cls of classes) {
    const numExams = 2 + Math.floor(rand() * 2); // 2-3 exams
    for (let e = 0; e < numExams; e++) {
      const subject = SUBJECTS[examCounter % SUBJECTS.length];
      const totalQ = [20, 30, 50][Math.floor(rand() * 3)];
      exams.push({
        id: `exam-${String(examCounter + 1).padStart(3, '0')}`,
        title: `${subject} - ${e === 0 ? 'Prelim' : e === 1 ? 'Midterm' : 'Final'} Exam`,
        subject,
        classId: cls.id,
        className: cls.name,
        totalQuestions: totalQ,
        date: examDates[examCounter % examDates.length],
        createdBy: 'instructor-001',
      });
      examCounter++;
    }
  }

  // Generate grades — score distribution centered around 75% with stddev ~15%
  const grades: MockGrade[] = [];
  let gradeCounter = 0;
  let studentOffset = 0;

  for (const cls of classes) {
    const classStudents = students.slice(studentOffset, studentOffset + cls.studentCount);
    const classExams = exams.filter(e => e.classId === cls.id);

    for (const exam of classExams) {
      for (const student of classStudents) {
        // Normal-ish distribution: Box-Muller
        const u1 = rand();
        const u2 = rand();
        const z = Math.sqrt(-2 * Math.log(Math.max(u1, 0.0001))) * Math.cos(2 * Math.PI * u2);
        const rawPct = 75 + z * 15;
        const pct = Math.max(10, Math.min(100, Math.round(rawPct)));
        const score = Math.round((pct / 100) * exam.totalQuestions);
        const actualPct = Math.round((score / exam.totalQuestions) * 100);

        const statuses: Array<'submitted' | 'approved' | 'reviewed'> = ['submitted', 'approved', 'reviewed'];
        const status = statuses[Math.floor(rand() * 3)];

        grades.push({
          id: `grade-${String(gradeCounter + 1).padStart(4, '0')}`,
          studentId: student.studentId,
          studentName: student.name,
          examId: exam.id,
          examTitle: exam.title,
          classId: cls.id,
          className: cls.name,
          score,
          totalQuestions: exam.totalQuestions,
          percentage: actualPct,
          letterGrade: calculateLetterGrade(actualPct),
          status,
          scannedAt: exam.date + `T${8 + Math.floor(rand() * 8)}:${String(Math.floor(rand() * 60)).padStart(2, '0')}:00`,
        });
        gradeCounter++;
      }
    }
    studentOffset += cls.studentCount;
  }

  return { classes, students, exams, grades };
}

// Singleton cache
let _cache: ReturnType<typeof generateMockData> | null = null;
function getData() {
  if (!_cache) _cache = generateMockData();
  return _cache;
}

// ── Public API ──

export function getMockClasses(): MockClass[] {
  return getData().classes;
}

export function getMockStudents(classId?: string): MockStudent[] {
  const { students, classes } = getData();
  if (!classId) return students;
  // Map classId to student range
  let offset = 0;
  for (const cls of classes) {
    if (cls.id === classId) return students.slice(offset, offset + cls.studentCount);
    offset += cls.studentCount;
  }
  return [];
}

export function getMockExams(classId?: string): MockExam[] {
  const { exams } = getData();
  if (!classId) return exams;
  return exams.filter(e => e.classId === classId);
}

export function getMockGrades(filters?: {
  classId?: string;
  examId?: string;
  studentId?: string;
}): MockGrade[] {
  let { grades } = getData();
  if (filters?.classId) grades = grades.filter(g => g.classId === filters.classId);
  if (filters?.examId) grades = grades.filter(g => g.examId === filters.examId);
  if (filters?.studentId) grades = grades.filter(g => g.studentId === filters.studentId);
  return grades;
}

/** Check if a grade already exists (duplicate prevention demo) */
export function gradeExists(studentId: string, examId: string): boolean {
  return getData().grades.some(g => g.studentId === studentId && g.examId === examId);
}

/** Simulate storing a new grade (with duplicate check) */
export function storeGrade(grade: Omit<MockGrade, 'id'>): { success: boolean; message: string; id?: string } {
  if (gradeExists(grade.studentId, grade.examId)) {
    return { success: false, message: `Duplicate entry: Student ${grade.studentId} already has a grade for exam ${grade.examId}` };
  }
  const data = getData();
  const newGrade: MockGrade = { ...grade, id: `grade-${String(data.grades.length + 1).padStart(4, '0')}` };
  data.grades.push(newGrade);
  return { success: true, message: 'Grade stored successfully', id: newGrade.id };
}

// ── Statistics helpers ──

export interface ExamStatistics {
  examId: string;
  examTitle: string;
  className: string;
  date: string;
  totalStudents: number;
  averageScore: number;
  averagePercentage: number;
  medianPercentage: number;
  highestPercentage: number;
  lowestPercentage: number;
  stdDeviation: number;
  passRate: number;
  failRate: number;
  gradeDistribution: Record<string, number>;
}

export interface ClassStatistics {
  classId: string;
  className: string;
  totalStudents: number;
  totalExams: number;
  overallAverage: number;
  passRate: number;
  topPerformers: { name: string; avg: number }[];
  atRisk: { name: string; avg: number }[];
}

export function getExamStatistics(examId: string): ExamStatistics | null {
  const grades = getMockGrades({ examId });
  if (grades.length === 0) return null;
  const exam = getMockExams().find(e => e.id === examId);
  if (!exam) return null;

  const pcts = grades.map(g => g.percentage);
  pcts.sort((a, b) => a - b);

  const avg = pcts.reduce((s, v) => s + v, 0) / pcts.length;
  const median = pcts.length % 2 === 0
    ? (pcts[pcts.length / 2 - 1] + pcts[pcts.length / 2]) / 2
    : pcts[Math.floor(pcts.length / 2)];
  const variance = pcts.reduce((s, v) => s + (v - avg) ** 2, 0) / pcts.length;

  const passing = pcts.filter(p => p >= 60).length;
  const dist: Record<string, number> = { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };
  for (const g of grades) {
    const base = g.letterGrade[0];
    if (base in dist) dist[base]++;
  }

  return {
    examId,
    examTitle: exam.title,
    className: exam.className,
    date: exam.date,
    totalStudents: grades.length,
    averageScore: Math.round(grades.reduce((s, g) => s + g.score, 0) / grades.length * 10) / 10,
    averagePercentage: Math.round(avg * 10) / 10,
    medianPercentage: Math.round(median * 10) / 10,
    highestPercentage: pcts[pcts.length - 1],
    lowestPercentage: pcts[0],
    stdDeviation: Math.round(Math.sqrt(variance) * 10) / 10,
    passRate: Math.round((passing / pcts.length) * 1000) / 10,
    failRate: Math.round(((pcts.length - passing) / pcts.length) * 1000) / 10,
    gradeDistribution: dist,
  };
}

export function getClassStatistics(classId: string): ClassStatistics | null {
  const cls = getMockClasses().find(c => c.id === classId);
  if (!cls) return null;
  const grades = getMockGrades({ classId });
  const classExams = getMockExams(classId);
  if (grades.length === 0) return null;

  const avgPct = grades.reduce((s, g) => s + g.percentage, 0) / grades.length;
  const passing = grades.filter(g => g.percentage >= 60).length;

  // Per-student averages
  const studentAvgs = new Map<string, { name: string; total: number; count: number }>();
  for (const g of grades) {
    const entry = studentAvgs.get(g.studentId) || { name: g.studentName, total: 0, count: 0 };
    entry.total += g.percentage;
    entry.count++;
    studentAvgs.set(g.studentId, entry);
  }
  const ranked = Array.from(studentAvgs.entries())
    .map(([, v]) => ({ name: v.name, avg: Math.round((v.total / v.count) * 10) / 10 }))
    .sort((a, b) => b.avg - a.avg);

  return {
    classId,
    className: cls.name,
    totalStudents: cls.studentCount,
    totalExams: classExams.length,
    overallAverage: Math.round(avgPct * 10) / 10,
    passRate: Math.round((passing / grades.length) * 1000) / 10,
    topPerformers: ranked.slice(0, 5),
    atRisk: ranked.filter(r => r.avg < 60).slice(-5).reverse(),
  };
}

/** All exam stats across all classes (for overview charts) */
export function getAllExamStatistics(): ExamStatistics[] {
  return getMockExams().map(e => getExamStatistics(e.id)).filter(Boolean) as ExamStatistics[];
}

/** Score trend data: average percentage per exam chronologically */
export function getScoreTrendData(): { exam: string; date: string; average: number; className: string }[] {
  return getAllExamStatistics()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => ({
      exam: s.examTitle.length > 20 ? s.examTitle.slice(0, 18) + '…' : s.examTitle,
      date: s.date,
      average: s.averagePercentage,
      className: s.className,
    }));
}

/** Overall summary stats */
export function getOverallSummary() {
  const grades = getMockGrades();
  const exams = getMockExams();
  const classes = getMockClasses();

  const avgPct = grades.length > 0
    ? Math.round((grades.reduce((s, g) => s + g.percentage, 0) / grades.length) * 10) / 10
    : 0;
  const passCount = grades.filter(g => g.percentage >= 60).length;

  return {
    totalExams: exams.length,
    totalStudents: classes.reduce((s, c) => s + c.studentCount, 0),
    totalClasses: classes.length,
    totalGrades: grades.length,
    overallAverage: avgPct,
    passRate: grades.length > 0 ? Math.round((passCount / grades.length) * 1000) / 10 : 0,
    examsThisMonth: exams.filter(e => e.date.startsWith('2026-02')).length,
  };
}
