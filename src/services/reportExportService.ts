// ─── Report Export Service ───
// Provides Excel (.xlsx), CSV, and PDF export functionality
// with institution branding, instructor info, and exam details.
// Uses real Firestore data — no mock data.

import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

// ── Types ──

export interface GradeRecord {
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
  status: string;
  scannedAt: string;
}

export interface ExportOptions {
  title?: string;
  instructorName?: string;
  institutionName?: string;
  includeTimestamp?: boolean;
  includeStatistics?: boolean;
}

export interface ClassSummaryData {
  className: string;
  schedule: string;
  section: string;
  totalStudents: number;
  totalExams: number;
  overallAverage: number;
  passRate: number;
  exams: Array<{
    title: string;
    date: string;
    totalStudents: number;
    averagePercentage: number;
    passRate: number;
    highestPercentage: number;
  }>;
  topPerformers: Array<{ name: string; avg: number }>;
  atRisk: Array<{ name: string; avg: number }>;
}

export interface StudentReportData {
  studentId: string;
  studentName: string;
  grades: GradeRecord[];
}

interface TableColumn {
  header: string;
  key: string;
  width?: number;
}

// ── Helpers ──

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

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function timestamp(): string {
  return new Date().toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function computeBasicStats(grades: GradeRecord[]) {
  const percentages = grades.map(g => g.percentage);
  const n = percentages.length;
  if (n === 0) return { avg: 0, median: 0, highest: 0, lowest: 0, stdDev: 0, passRate: 0 };
  const sorted = [...percentages].sort((a, b) => a - b);
  const avg = Math.round(sorted.reduce((s, v) => s + v, 0) / n * 10) / 10;
  const median = n % 2 === 0
    ? Math.round((sorted[n / 2 - 1] + sorted[n / 2]) / 2 * 10) / 10
    : sorted[Math.floor(n / 2)];
  const variance = sorted.reduce((s, v) => s + (v - avg) ** 2, 0) / n;
  const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;
  const passed = grades.filter(g => g.percentage >= 60).length;
  return {
    avg,
    median,
    highest: Math.max(...percentages),
    lowest: Math.min(...percentages),
    stdDev,
    passRate: Math.round((passed / n) * 1000) / 10,
  };
}

// ── CSV Export ──

export function exportGradesToCSV(
  grades: GradeRecord[],
  options: ExportOptions = {},
): void {
  const title = options.title || 'Grade Report';
  const rows: string[] = [];

  rows.push(`"${options.institutionName || 'Gordon College'}"`);
  rows.push(`"${title}"`);
  if (options.instructorName) rows.push(`"Instructor: ${options.instructorName}"`);
  if (options.includeTimestamp) rows.push(`"Generated: ${timestamp()}"`);
  rows.push('');

  rows.push('#,Student ID,Student Name,Exam,Score,Total,Percentage,Grade,Status,Date Scanned');

  grades.forEach((g, i) => {
    rows.push([
      i + 1,
      g.studentId,
      `"${g.studentName}"`,
      `"${g.examTitle}"`,
      g.score,
      g.totalQuestions,
      `${g.percentage}%`,
      g.letterGrade,
      g.status,
      g.scannedAt ? g.scannedAt.split('T')[0] : 'N/A',
    ].join(','));
  });

  if (options.includeStatistics && grades.length > 0) {
    const { avg, passRate, highest, lowest } = computeBasicStats(grades);
    rows.push('');
    rows.push(`"Summary Statistics"`);
    rows.push(`"Total Records",${grades.length}`);
    rows.push(`"Average Percentage",${avg}%`);
    rows.push(`"Pass Rate",${passRate}%`);
    rows.push(`"Highest",${highest}%`);
    rows.push(`"Lowest",${lowest}%`);
  }

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${sanitizeFilename(title)}.csv`);
}

// ── Excel Export ──

export function exportGradesToExcel(
  grades: GradeRecord[],
  options: ExportOptions = {},
): void {
  const title = options.title || 'Grade Report';
  const wb = XLSX.utils.book_new();

  // Sheet 1: Grades
  const headerRows: (string | number)[][] = [
    [options.institutionName || 'Gordon College'],
    [title],
  ];
  if (options.instructorName) headerRows.push([`Instructor: ${options.instructorName}`]);
  if (options.includeTimestamp) headerRows.push([`Generated: ${timestamp()}`]);
  headerRows.push([]);

  const columns = ['#', 'Student ID', 'Student Name', 'Exam', 'Score', 'Total', 'Percentage', 'Grade', 'Status', 'Date'];
  headerRows.push(columns);

  const dataRows = grades.map((g, i) => [
    i + 1,
    g.studentId,
    g.studentName,
    g.examTitle,
    g.score,
    g.totalQuestions,
    g.percentage,
    g.letterGrade,
    g.status,
    g.scannedAt ? g.scannedAt.split('T')[0] : 'N/A',
  ]);

  const wsData = [...headerRows, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 5 }, { wch: 14 }, { wch: 25 }, { wch: 35 },
    { wch: 7 }, { wch: 7 }, { wch: 12 }, { wch: 7 },
    { wch: 10 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Grades');

  // Sheet 2: Statistics
  if (options.includeStatistics && grades.length > 0) {
    const examIds = [...new Set(grades.map(g => g.examId))];
    const statsRows: (string | number)[][] = [
      ['Exam Statistics Summary'],
      [],
      ['Exam', 'Class', 'Students', 'Avg %', 'Median %', 'Highest', 'Lowest', 'Std Dev', 'Pass Rate'],
    ];

    for (const eid of examIds) {
      const examGrades = grades.filter(g => g.examId === eid);
      const { avg, median, highest, lowest, stdDev, passRate } = computeBasicStats(examGrades);
      statsRows.push([
        examGrades[0]?.examTitle || eid,
        examGrades[0]?.className || '',
        examGrades.length,
        avg,
        median,
        highest,
        lowest,
        stdDev,
        `${passRate}%`,
      ]);
    }

    // Grade distribution
    statsRows.push([]);
    statsRows.push(['Grade Distribution']);
    statsRows.push(['Grade', 'Count', 'Percentage']);
    const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const g of grades) {
      const base = g.letterGrade[0];
      if (base in dist) dist[base]++;
    }
    for (const [grade, count] of Object.entries(dist)) {
      statsRows.push([grade, count, `${Math.round((count / grades.length) * 1000) / 10}%`]);
    }

    const ws2 = XLSX.utils.aoa_to_sheet(statsRows);
    ws2['!cols'] = [
      { wch: 35 }, { wch: 14 }, { wch: 10 }, { wch: 8 },
      { wch: 10 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, 'Statistics');
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `${sanitizeFilename(title)}.xlsx`);
}

// ── PDF Export ──

export function exportGradesToPDF(
  grades: GradeRecord[],
  options: ExportOptions = {},
): void {
  const title = options.title || 'Grade Report';
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  function addHeader() {
    doc.setFillColor(22, 101, 52);
    doc.rect(0, 0, pageW, 2, 'F');
    y = 12;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52);
    doc.text(options.institutionName || 'Gordon College', margin, y);
    y += 7;
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text(title, margin, y);
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    if (options.instructorName) {
      doc.text(`Instructor: ${options.instructorName}`, pageW - margin, 12, { align: 'right' });
    }
    doc.text(`Generated: ${timestamp()}`, pageW - margin, 18, { align: 'right' });
    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
  }

  function addFooter(pageNum: number) {
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${pageNum}`, pageW / 2, pageH - 8, { align: 'center' });
    doc.text('Confidential - For Academic Use Only', margin, pageH - 8);
  }

  const cols: TableColumn[] = [
    { header: '#', key: 'num', width: 10 },
    { header: 'Student ID', key: 'studentId', width: 28 },
    { header: 'Student Name', key: 'studentName', width: 50 },
    { header: 'Exam', key: 'examTitle', width: 65 },
    { header: 'Score', key: 'score', width: 18 },
    { header: 'Percentage', key: 'percentage', width: 24 },
    { header: 'Grade', key: 'letterGrade', width: 16 },
    { header: 'Status', key: 'status', width: 20 },
    { header: 'Date', key: 'date', width: 26 },
  ];

  let pageNum = 1;
  addHeader();

  function drawTableHeader() {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(22, 101, 52);
    doc.rect(margin, y - 4, pageW - margin * 2, 7, 'F');
    let x = margin + 2;
    for (const col of cols) {
      doc.text(col.header, x, y, { align: 'left' });
      x += (col.width || 25);
    }
    y += 6;
  }

  drawTableHeader();

  doc.setFont('helvetica', 'normal');
  for (let i = 0; i < grades.length; i++) {
    if (y > pageH - 20) {
      addFooter(pageNum);
      doc.addPage();
      pageNum++;
      y = margin;
      addHeader();
      drawTableHeader();
    }

    const g = grades[i];
    const rowData: Record<string, string> = {
      num: String(i + 1),
      studentId: g.studentId,
      studentName: g.studentName.length > 28 ? g.studentName.slice(0, 26) + '...' : g.studentName,
      examTitle: g.examTitle.length > 35 ? g.examTitle.slice(0, 33) + '...' : g.examTitle,
      score: `${g.score}/${g.totalQuestions}`,
      percentage: `${g.percentage}%`,
      letterGrade: g.letterGrade,
      status: g.status,
      date: g.scannedAt ? g.scannedAt.split('T')[0] : 'N/A',
    };

    if (i % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y - 3.5, pageW - margin * 2, 5.5, 'F');
    }

    doc.setFontSize(7.5);
    doc.setTextColor(50, 50, 50);

    let x = margin + 2;
    for (const col of cols) {
      const val = rowData[col.key] || '';
      if (col.key === 'letterGrade') {
        const pct = g.percentage;
        if (pct >= 80) doc.setTextColor(22, 101, 52);
        else if (pct >= 60) doc.setTextColor(180, 140, 0);
        else doc.setTextColor(200, 40, 40);
        doc.setFont('helvetica', 'bold');
      }
      doc.text(val, x, y);
      if (col.key === 'letterGrade') {
        doc.setTextColor(50, 50, 50);
        doc.setFont('helvetica', 'normal');
      }
      x += (col.width || 25);
    }
    y += 5.5;
  }

  if (options.includeStatistics && grades.length > 0) {
    if (y > pageH - 40) {
      addFooter(pageNum);
      doc.addPage();
      pageNum++;
      y = margin + 10;
    }
    y += 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    const { avg, passRate, highest, lowest } = computeBasicStats(grades);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52);
    doc.text('Summary Statistics', margin, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);

    const stats = [
      ['Total Students:', String(grades.length)],
      ['Average:', `${avg}%`],
      ['Pass Rate:', `${passRate}%`],
      ['Highest:', `${highest}%`],
      ['Lowest:', `${lowest}%`],
    ];
    for (const [label, val] of stats) {
      doc.setFont('helvetica', 'bold');
      doc.text(label, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(val, margin + 35, y);
      y += 5;
    }
  }

  addFooter(pageNum);
  doc.save(`${sanitizeFilename(title)}.pdf`);
}

// ── Class Summary PDF (for printing) ──

export function printClassSummary(data: ClassSummaryData, options: ExportOptions = {}): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // Green accent
  doc.setFillColor(22, 101, 52);
  doc.rect(0, 0, pageW, 3, 'F');

  y = 18;
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text(options.institutionName || 'Gordon College', margin, y);

  y += 8;
  doc.setFontSize(14);
  doc.setTextColor(40, 40, 40);
  doc.text(`Class Summary: ${data.className}`, margin, y);

  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Section: ${data.section || 'N/A'} | Room: ${data.schedule || 'N/A'}`, margin, y);
  if (options.instructorName) {
    doc.text(`Instructor: ${options.instructorName}`, pageW - margin, y, { align: 'right' });
  }

  y += 3;
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Key metrics boxes
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const metrics = [
    { label: 'Students', value: String(data.totalStudents) },
    { label: 'Exams', value: String(data.totalExams) },
    { label: 'Class Average', value: `${data.overallAverage}%` },
    { label: 'Pass Rate', value: `${data.passRate}%` },
  ];
  const boxW = (pageW - margin * 2 - 15) / 4;
  metrics.forEach((m, i) => {
    const bx = margin + i * (boxW + 5);
    doc.setFillColor(240, 249, 244);
    doc.roundedRect(bx, y, boxW, 18, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(22, 101, 52);
    doc.text(m.value, bx + boxW / 2, y + 8, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(m.label, bx + boxW / 2, y + 14, { align: 'center' });
  });
  y += 26;

  // Exam breakdown table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Exam Breakdown', margin, y);
  y += 6;

  doc.setFillColor(22, 101, 52);
  doc.rect(margin, y - 3.5, pageW - margin * 2, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  const examCols = [
    { label: 'Exam', x: margin + 2 },
    { label: 'Date', x: margin + 72 },
    { label: 'Students', x: margin + 100 },
    { label: 'Average', x: margin + 118 },
    { label: 'Pass Rate', x: margin + 138 },
    { label: 'Highest', x: margin + 158 },
  ];
  for (const c of examCols) doc.text(c.label, c.x, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  for (let i = 0; i < data.exams.length; i++) {
    const ex = data.exams[i];
    if (i % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(margin, y - 3.5, pageW - margin * 2, 5.5, 'F');
    }
    doc.setFontSize(7.5);
    const tTitle = ex.title.length > 38 ? ex.title.slice(0, 36) + '...' : ex.title;
    doc.text(tTitle, examCols[0].x, y);
    doc.text(formatDate(ex.date), examCols[1].x, y);
    doc.text(String(ex.totalStudents), examCols[2].x, y);
    doc.text(`${ex.averagePercentage}%`, examCols[3].x, y);
    doc.text(`${ex.passRate}%`, examCols[4].x, y);
    doc.text(`${ex.highestPercentage}%`, examCols[5].x, y);
    y += 5.5;
  }

  // Top performers
  y += 8;
  if (data.topPerformers.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52);
    doc.text('Top Performers', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    for (const tp of data.topPerformers) {
      doc.text(`- ${tp.name}`, margin + 2, y);
      doc.text(`${tp.avg}%`, margin + 80, y);
      y += 5;
    }
  }

  // At-risk students
  if (data.atRisk.length > 0) {
    y += 5;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 50, 50);
    doc.text('At-Risk Students', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    for (const ar of data.atRisk) {
      doc.text(`- ${ar.name}`, margin + 2, y);
      doc.text(`${ar.avg}%`, margin + 80, y);
      y += 5;
    }
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  const ph = doc.internal.pageSize.getHeight();
  doc.text('Confidential - For Academic Use Only', margin, ph - 8);
  doc.text(`Generated: ${timestamp()}`, pageW - margin, ph - 8, { align: 'right' });

  doc.save(`${sanitizeFilename(data.className)}_Summary.pdf`);
}

// ── Individual Student Report Card PDF ──

export function printStudentReportCard(
  data: StudentReportData,
  options: ExportOptions = {},
): void {
  const { studentId, studentName, grades } = data;
  if (grades.length === 0) return;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  doc.setFillColor(22, 101, 52);
  doc.rect(0, 0, pageW, 3, 'F');

  y = 18;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text(options.institutionName || 'Gordon College', margin, y);

  y += 8;
  doc.setFontSize(13);
  doc.setTextColor(40, 40, 40);
  doc.text('Student Report Card', margin, y);

  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(`Student: ${studentName}`, margin, y);
  doc.text(`ID: ${studentId}`, pageW - margin, y, { align: 'right' });

  y += 4;
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Summary stats
  const avg = Math.round(grades.reduce((s, g) => s + g.percentage, 0) / grades.length * 10) / 10;
  const overallGrade = calculateLetterGrade(avg);
  const passed = grades.filter(g => g.percentage >= 60).length;

  const summaryW = (pageW - margin * 2 - 10) / 3;
  [
    { label: 'Overall Average', value: `${avg}%` },
    { label: 'Overall Grade', value: overallGrade },
    { label: 'Exams Passed', value: `${passed}/${grades.length}` },
  ].forEach((m, i) => {
    const bx = margin + i * (summaryW + 5);
    doc.setFillColor(240, 249, 244);
    doc.roundedRect(bx, y, summaryW, 18, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(22, 101, 52);
    doc.text(m.value, bx + summaryW / 2, y + 8, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(m.label, bx + summaryW / 2, y + 14, { align: 'center' });
  });
  y += 26;

  // Grades table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Exam Results', margin, y);
  y += 6;

  doc.setFillColor(22, 101, 52);
  doc.rect(margin, y - 3.5, pageW - margin * 2, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  const cX = [margin + 2, margin + 70, margin + 100, margin + 118, margin + 138, margin + 158];
  ['Exam', 'Class', 'Score', 'Percentage', 'Grade', 'Date'].forEach((h, i) => {
    doc.text(h, cX[i], y);
  });
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  const sorted = [...grades].sort((a, b) => (a.scannedAt || '').localeCompare(b.scannedAt || ''));
  for (let i = 0; i < sorted.length; i++) {
    const g = sorted[i];
    if (i % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(margin, y - 3.5, pageW - margin * 2, 5.5, 'F');
    }
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    const tTitle = g.examTitle.length > 36 ? g.examTitle.slice(0, 34) + '...' : g.examTitle;
    doc.text(tTitle, cX[0], y);
    doc.text(g.className || '', cX[1], y);
    doc.text(`${g.score}/${g.totalQuestions}`, cX[2], y);
    doc.text(`${g.percentage}%`, cX[3], y);
    if (g.percentage >= 80) doc.setTextColor(22, 101, 52);
    else if (g.percentage >= 60) doc.setTextColor(180, 140, 0);
    else doc.setTextColor(200, 40, 40);
    doc.setFont('helvetica', 'bold');
    doc.text(g.letterGrade, cX[4], y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.text(g.scannedAt ? g.scannedAt.split('T')[0] : 'N/A', cX[5], y);
    y += 5.5;
  }

  // Footer with signature lines
  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (options.instructorName) {
    doc.text(`Instructor: ${options.instructorName}`, margin, y);
  }
  doc.text(`Date: ${timestamp()}`, pageW - margin, y, { align: 'right' });

  y += 20;
  doc.text('_________________________', margin, y);
  doc.text('_________________________', pageW - margin - 50, y);
  y += 5;
  doc.setFontSize(8);
  doc.text("Instructor's Signature", margin, y);
  doc.text("Student's Signature", pageW - margin - 50, y);

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  const ph = doc.internal.pageSize.getHeight();
  doc.text('Confidential - For Academic Use Only', margin, ph - 8);

  doc.save(`ReportCard_${sanitizeFilename(studentName)}.pdf`);
}
