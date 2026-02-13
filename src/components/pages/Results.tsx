'use client';

import { Card } from '@/components/ui/card';
import { Download, FileText, Search } from 'lucide-react';

export default function Results() {
  const results: { id: number; exam: string; student: string; score: number; total: number; date: string }[] = [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Results</h1>
        <p className="text-muted-foreground mt-1">View and manage all graded exam results.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search by student name or exam..." 
            className="w-full pl-10 pr-4 py-2 border rounded-md bg-background"
          />
        </div>
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold flex items-center gap-2 hover:bg-primary/90">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Results Table */}
      <Card className="border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Exam</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Student</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Score</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Percentage</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No results found yet. Scan answer sheets to generate grades.</p>
                  </td>
                </tr>
              ) : (
                results.map((result) => {
                  const percentage = Math.round((result.score / result.total) * 100);
                  return (
                    <tr key={result.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">{result.exam}</td>
                      <td className="px-6 py-4 text-muted-foreground">{result.student}</td>
                      <td className="px-6 py-4 font-medium text-foreground">{result.score}/{result.total}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          percentage >= 80 ? 'bg-green-100 text-green-800' : 
                          percentage >= 60 ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'
                        }`}>
                          {percentage}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{result.date}</td>
                      <td className="px-6 py-4">
                        <button className="text-primary hover:underline text-sm font-medium">View</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 border">
          <p className="text-sm text-muted-foreground">Total Grades</p>
          <p className="text-3xl font-bold text-foreground mt-2">0</p>
        </Card>
        <Card className="p-6 border">
          <p className="text-sm text-muted-foreground">Average Score</p>
          <p className="text-3xl font-bold text-foreground mt-2">0%</p>
        </Card>
        <Card className="p-6 border">
          <p className="text-sm text-muted-foreground">Pass Rate</p>
          <p className="text-3xl font-bold text-foreground mt-2">0%</p>
        </Card>
      </div>
    </div>
  );
}
