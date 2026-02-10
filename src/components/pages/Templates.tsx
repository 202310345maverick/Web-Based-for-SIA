'use client';

import { Card } from '@/components/ui/card';
import { FileText, Download, Edit, Plus } from 'lucide-react';

interface Template {
  id: number;
  name: string;
  description: string;
  type: string;
  lastModified: string;
}

export default function Templates() {
  const templates: Template[] = [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Templates</h1>
        <p className="text-muted-foreground mt-1">Create and manage exam templates for consistent formatting.</p>
      </div>

      {/* Create Template Button */}
      <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold flex items-center gap-2 hover:bg-primary/90">
        <Plus className="w-4 h-4" />
        Create New Template
      </button>

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <Card className="p-8 border text-center">
          <p className="text-muted-foreground">No templates created yet. Click "Create New Template" to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <Card key={template.id} className="p-6 border hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <span className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-semibold">
                  {template.type}
                </span>
              </div>
              
              <h3 className="font-semibold text-foreground mb-2">{template.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{template.description}</p>
              
              <p className="text-xs text-muted-foreground mb-4">Modified: {template.lastModified}</p>
              
              <div className="flex gap-2">
                <button className="flex-1 px-3 py-2 border rounded-md text-sm font-semibold hover:bg-muted/30 flex items-center justify-center gap-1">
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 flex items-center justify-center gap-1">
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Template Guidelines */}
      <Card className="p-6 border">
        <h3 className="font-semibold text-foreground mb-4">Template Guidelines</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <span className="text-primary font-bold">•</span>
            <span>Ensure all templates are properly formatted for printing and scanning</span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary font-bold">•</span>
            <span>Use standard page sizes (Letter or A4) for compatibility</span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary font-bold">•</span>
            <span>Maintain consistent spacing and margins for accurate scanning</span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary font-bold">•</span>
            <span>Test templates thoroughly before using them in production exams</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
