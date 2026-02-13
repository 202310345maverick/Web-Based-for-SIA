'use client';

import { Card } from '@/components/ui/card';
import { Archive as ArchiveIcon, Download, Search } from 'lucide-react';

export default function Archive() {
  const archivedExams: { id: number; title: string; subject: string; date: string; students: number }[] = [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Archive</h1>
        <p className="text-muted-foreground mt-1">Read-only historical records of past exams and grades.</p>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search archived exams..." 
            className="w-full pl-10 pr-4 py-2 border rounded-md bg-background"
          />
        </div>
      </div>

      {/* Archive Info */}
      <Card className="p-4 border-l-4 border-l-gray-500 bg-gray-50">
        <p className="text-sm text-gray-700">
          <strong>Note:</strong> Archived items are read-only. To restore or modify, contact your administrator.
        </p>
      </Card>

      {/* Archived Exams Table */}
      <Card className="border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Exam Title</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Subject</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Students</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Archive Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {archivedExams.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <ArchiveIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No archived exams yet.</p>
                  </td>
                </tr>
              ) : (
                archivedExams.map((exam) => (
                  <tr key={exam.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{exam.title}</td>
                    <td className="px-6 py-4 text-muted-foreground">{exam.subject}</td>
                    <td className="px-6 py-4 text-muted-foreground">{exam.students}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{exam.date}</td>
                    <td className="px-6 py-4 space-x-2">
                      <button className="text-primary hover:underline text-sm font-medium">View</button>
                      <button className="text-primary hover:underline text-sm font-medium inline-flex items-center gap-1">
                        <Download className="w-3 h-3" />
                        Export
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Archive Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 border">
          <p className="text-sm text-muted-foreground">Total Archived</p>
          <p className="text-3xl font-bold text-foreground mt-2">0</p>
        </Card>
        <Card className="p-6 border">
          <p className="text-sm text-muted-foreground">Total Grades</p>
          <p className="text-3xl font-bold text-foreground mt-2">0</p>
        </Card>
        <Card className="p-6 border">
          <p className="text-sm text-muted-foreground">Archive Size</p>
          <p className="text-3xl font-bold text-foreground mt-2">0 GB</p>
        </Card>
      </div>
    </div>
  );
}
