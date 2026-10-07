import React, { useCallback, useEffect, useState } from 'react';
import { 
  FileSpreadsheet, 
  FileText, 
  Code, 
  TrendingUp, 
  Download, 
  HelpCircle,
  Share2,
  Building2
} from 'lucide-react';
import { Analytics } from '../types';

interface ReportsViewProps {
  analytics: Analytics;
}

type ExportItem = {
  title: string;
  description: string;
  format: string;
  color: string;
  icon: React.ElementType;
  url: string;
  downloadName: string;
  supportsCollegeFilter?: boolean;
};

interface College {
  code: string;
  name: string;
}

export default function ReportsView({ analytics }: ReportsViewProps) {
  const [colleges, setColleges] = useState<College[]>([]);
  const [selectedCollege, setSelectedCollege] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/colleges');
        const resData = await response.json();
        if (resData.success) {
          setColleges(resData.colleges);
        }
      } catch (err) {
        console.error('Error fetching colleges list:', err);
      }
    })();
  }, []);

  const handleDownload = useCallback(async (item: ExportItem) => {
    try {
      const url = item.supportsCollegeFilter && selectedCollege
        ? `${item.url}?collegeCode=${encodeURIComponent(selectedCollege)}`
        : item.url;

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
      });

      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const suffix = item.supportsCollegeFilter && selectedCollege ? `_${selectedCollege}` : '';
      const extIdx = item.downloadName.lastIndexOf('.');
      link.download = extIdx >= 0
        ? `${item.downloadName.slice(0, extIdx)}${suffix}${item.downloadName.slice(extIdx)}`
        : `${item.downloadName}${suffix}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Export download failed:', err);
      window.alert('Export download failed. Please try again.');
    }
  }, [selectedCollege]);
  if (analytics.totalStudents === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-[#141416] border border-[#1E1E21] flex items-center justify-center mb-4">
          <FileSpreadsheet className="w-8 h-8 text-gray-550" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1">No Active Datasets</h3>
        <p className="text-xs text-gray-400 max-w-sm leading-relaxed mb-4">
          Reports and exports require records to exist in the database. Please head to the Upload Center and add result registers first.
        </p>
      </div>
    );
  }

  const exportItems: ExportItem[] = [
    {
      title: 'Detailed Excel Workbook',
      description: 'Comprehensive multi-sheet spreadsheet workbook compiling a complete Student Summary, Subject Statistics, Backlogs lists, and Class KPI cards. Ideal for administrative archives and auditing.',
      format: 'XLSX',
      color: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-950/20',
      icon: FileSpreadsheet,
      url: '/api/export/excel',
      downloadName: 'universal_result_analysis.xlsx',
      supportsCollegeFilter: true,
    },
    {
      title: 'Fast CSV Student List',
      description: 'A clean, comma-separated values document featuring flattened student meta-information and scores. Perfect for quick copy-pasting, custom Python analysis, or import into school ERP systems.',
      format: 'CSV',
      color: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-950/20',
      icon: FileText,
      url: '/api/export/csv',
      downloadName: 'students_list.csv',
      supportsCollegeFilter: true,
    },
    {
      title: 'Nested JSON Database',
      description: 'Fully structured, hierarchical nested database format. Groups each student’s metadata with their course-wise exam scores array. Ideal for frontend development and backup restorations.',
      format: 'JSON',
      color: 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-950/20',
      icon: Code,
      url: '/api/export/json',
      downloadName: 'students_nested_records.json'
    },
    {
      title: 'Landscape Class Registry PDF',
      description: 'A beautiful, landscape-oriented PDF document formatted using ReportLab grid-rules. Compiles a complete class registrar sorting student ranks, branches, semesters, SGPAs, CGPAs, and backlogs.',
      format: 'PDF',
      color: 'bg-[#0A0A0B] border border-[#1E1E21] text-white hover:bg-[#1A1A1D] hover:border-gray-700 shadow-black/40',
      icon: FileText,
      url: '/api/export/pdf/class',
      downloadName: 'complete_class_registry.pdf'
    },
    {
      title: 'Individual Report Cards (ZIP)',
      description: 'One professionally formatted PDF report card per student - ranking, SGPA/CGPA, subject-wise marks, and personalized recommendations - bundled into a single downloadable ZIP archive.',
      format: 'ZIP',
      color: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-950/20',
      icon: FileText,
      url: '/api/export/pdf/individual-all',
      downloadName: 'individual_report_cards.zip',
      supportsCollegeFilter: true,
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in p-6">
      {/* Top Header */}
      <div>
        <h2 className="text-xl font-bold text-white text-left">Academic Reports & Bulk Exports</h2>
        <p className="text-xs text-gray-500 mt-0.5 text-left">Download full-scale academic registers and diagnostic databases locally. Works completely offline.</p>
      </div>

      {/* College filter */}
      {colleges.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#141416] border border-[#1E1E21] flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-2 text-blue-400 shrink-0">
            <Building2 className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Filter by College</span>
          </div>
          <select
            value={selectedCollege}
            onChange={(e) => setSelectedCollege(e.target.value)}
            className="bg-[#0A0A0B] text-slate-200 border border-[#1E1E21] rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 flex-1"
          >
            <option value="">All Colleges (no filter)</option>
            {colleges.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
          {selectedCollege && (
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10 shrink-0">
              Excel & CSV will only include {selectedCollege}
            </span>
          )}
        </div>
      )}

      {/* Grid of exports */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {exportItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="p-6 rounded-2xl bg-[#141416] border border-[#1E1E21] flex flex-col justify-between gap-6 group hover:border-[#2A2A2D] transition-colors duration-200">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#0A0A0B] border border-[#1E1E21] flex items-center justify-center text-blue-400 shrink-0">
                    <Icon className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="px-2 py-0.5 text-[9px] font-bold rounded-lg bg-[#0A0A0B] border border-[#1E1E21] font-mono text-gray-500 tracking-wider">
                    {item.format} FORMAT
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors text-left">{item.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed font-semibold text-left">{item.description}</p>
                {item.supportsCollegeFilter && selectedCollege && (
                  <p className="text-[10px] text-emerald-400 font-mono">Filtered to {selectedCollege}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleDownload(item)}
                className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-300 shadow-md ${item.color} cursor-pointer`}
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                Download bulk register
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
