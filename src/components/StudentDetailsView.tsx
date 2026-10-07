import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Download, 
  User, 
  FileText, 
  TrendingUp, 
  Sparkles, 
  Award, 
  AlertCircle,
  CheckCircle,
  Lightbulb,
  Bookmark,
  Edit3,
  Plus
} from 'lucide-react';
import { Student, SubjectMark, StudentAnalysis } from '../types';
import SubjectAllocationModal from './SubjectAllocationModal';

interface StudentDetailsViewProps {
  seatNo: string;
  onBack: () => void;
}

export default function StudentDetailsView({ seatNo, onBack }: StudentDetailsViewProps) {
  const [data, setData] = useState<{ student: Student; subjects: SubjectMark[]; analysis: StudentAnalysis } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);

  const fetchStudentDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/students/${seatNo}`);
      const resData = await response.json();
      if (resData.success) {
        setData({
          student: resData.student,
          subjects: resData.subjects,
          analysis: resData.analysis
        });
      }
    } catch (err) {
      console.error('Error fetching student detail cards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentDetails();
  }, [seatNo]);

  if (loading) {
    return (
      <div className="p-20 text-center space-y-4 animate-fade-in">
        <div className="w-10 h-10 rounded-full border-4 border-[#1E1E21] border-t-blue-500 animate-spin mx-auto" />
        <p className="text-xs text-gray-500 font-medium font-mono">Opening student diagnostic ledger...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-16 text-center space-y-4">
        <Bookmark className="w-10 h-10 text-rose-500 mx-auto" />
        <p className="text-sm font-bold text-white">Student Details Not Found</p>
        <button onClick={onBack} className="text-xs text-blue-400 font-bold uppercase tracking-wider flex items-center gap-1 mx-auto hover:underline">
          <ArrowLeft className="w-4 h-4" /> Go back
        </button>
      </div>
    );
  }

  const { student, subjects, analysis } = data;

  const getPerformanceBadgeColor = (level: string) => {
    switch (level) {
      case 'Outstanding': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'Excellent': return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'Very Good': return 'bg-violet-500/10 border-violet-500/20 text-violet-400';
      case 'Good': return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
      case 'Average': return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      default: return 'bg-rose-500/10 border-rose-500/20 text-rose-400 animate-pulse';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in p-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <button 
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-[#141416] border border-[#1E1E21] text-gray-400 hover:text-white hover:bg-[#1A1A1D] transition-all flex items-center gap-2 text-xs font-semibold cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Directory
        </button>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAllocationModalOpen(true)}
            className="bg-[#1A1A1D] hover:bg-[#252529] text-blue-400 hover:text-blue-300 font-bold text-xs px-4 py-2.5 rounded-xl border border-blue-500/30 transition-all flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Edit3 className="w-4 h-4" />
            Allocate & Edit Subject Marks
          </button>

          <a 
            href={`/api/export/pdf/student/${student.seatNo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-md shadow-blue-500/5 border border-blue-500/50"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            Download Individual PDF
          </a>
        </div>
      </div>

      {/* Main Student Header Box */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#141416] via-[#141416] to-[#0A0A0B] border border-[#1E1E21] flex flex-col lg:flex-row justify-between gap-6">
        <div className="space-y-4 flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#0A0A0B] border border-[#1E1E21] flex items-center justify-center">
              <User className="w-6 h-6 text-gray-500" />
            </div>
            <div className="text-left">
              <h2 className="text-xl font-black text-white tracking-wide uppercase">{student.name}</h2>
              <p className="text-xs text-gray-550 font-semibold uppercase tracking-wider">{student.branch}</p>
            </div>
          </div>
          
          {/* Metadata profiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs border-t border-[#1E1E21]/60 text-left">
            <div>
              <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Seat Number</span>
              <span className="font-mono text-slate-200 mt-1 block font-semibold">{student.seatNo}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Semester</span>
              <span className="text-slate-200 mt-1 block font-semibold">{student.semester || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Big performance tag box */}
        <div className="lg:w-64 bg-[#0A0A0B]/40 p-4 rounded-xl border border-[#1E1E21] flex flex-col justify-center text-center">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Diagnosed Performance Level</p>
          <span className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border ${getPerformanceBadgeColor(analysis.performanceLevel)}`}>
            {analysis.performanceLevel}
          </span>
        </div>
      </div>

      {/* KPI stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI: SGPA */}
        <div className="p-5 rounded-xl bg-[#141416] border border-[#1E1E21] flex items-center justify-between">
          <div className="text-left">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Semester SGPA</p>
            <h3 className="text-2xl font-black text-white mt-1">{student.sgpa.toFixed(2)}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-400 font-bold font-mono">
            GPA
          </div>
        </div>

        {/* KPI: CGPA */}
        <div className="p-5 rounded-xl bg-[#141416] border border-[#1E1E21] flex items-center justify-between">
          <div className="text-left">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Cumulative CGPA</p>
            <h3 className="text-2xl font-black text-white mt-1">{student.cgpa.toFixed(2)}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold font-mono">
            CGP
          </div>
        </div>

        {/* KPI: Class Rank */}
        <div className="p-5 rounded-xl bg-[#141416] border border-[#1E1E21] flex items-center justify-between">
          <div className="text-left">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Class Rank Position</p>
            <h3 className="text-2xl font-black text-emerald-400 mt-1">#{analysis.rank}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Award className="w-5 h-5" />
          </div>
        </div>

        {/* KPI: Percentile */}
        <div className="p-5 rounded-xl bg-[#141416] border border-[#1E1E21] flex items-center justify-between">
          <div className="text-left">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Student Percentile</p>
            <h3 className="text-2xl font-black text-purple-400 mt-1">{analysis.percentile}%</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold font-mono">
            PRC
          </div>
        </div>
      </div>

      {/* Comparisons and diagnostic sliders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Comparator meters */}
        <div className="p-5 rounded-2xl bg-[#141416] border border-[#1E1E21] space-y-4">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest text-left">Class Standings Comparison</h4>
          
          {/* Standing vs Topper */}
          <div className="space-y-1.5 text-left">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 font-medium">Topper Difference Gap</span>
              <span className="font-mono font-bold text-amber-500">-{analysis.topperDifference.toFixed(2)} SGPA</span>
            </div>
            <div className="h-2.5 bg-[#0A0A0B] border border-[#1E1E21] rounded-full overflow-hidden relative">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full" 
                style={{ width: `${Math.max(0, 100 - (analysis.topperDifference * 15))}%` }} 
              />
            </div>
            <p className="text-[10px] text-gray-500">Topper score is evaluated dynamically across all parsed student rows.</p>
          </div>

          {/* Standing vs Class Average */}
          <div className="space-y-1.5 pt-2 border-t border-[#1E1E21]/60 text-left">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 font-medium">Standing vs Class Average</span>
              {analysis.classAverageDifference >= 0 ? (
                <span className="font-mono font-bold text-emerald-400">+{analysis.classAverageDifference.toFixed(2)} ABOVE</span>
              ) : (
                <span className="font-mono font-bold text-rose-400">{analysis.classAverageDifference.toFixed(2)} BELOW</span>
              )}
            </div>
            <div className="h-2.5 bg-[#0A0A0B] border border-[#1E1E21] rounded-full overflow-hidden relative">
              <div 
                className={`h-full rounded-full ${analysis.classAverageDifference >= 0 ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-gradient-to-r from-rose-500 to-rose-600'}`} 
                style={{ width: `${Math.min(100, Math.max(0, 50 + (analysis.classAverageDifference * 10)))}%` }} 
              />
            </div>
            <p className="text-[10px] text-gray-500">Class Average score is calculated mathematically from active student indices.</p>
          </div>
        </div>

        {/* Strengths and Backlog summary */}
        <div className="p-5 rounded-2xl bg-[#141416] border border-[#1E1E21]/80 grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          <div>
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
              <CheckCircle className="w-4 h-4" />
              Course Strengths
            </div>
            {analysis.strongSubjects.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No distinct outstanding subject scores logged.</p>
            ) : (
              <ul className="space-y-1 text-xs text-slate-300">
                {analysis.strongSubjects.map((sub, sIdx) => (
                  <li key={sIdx} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {sub}
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <div>
            <div className="flex items-center gap-1.5 text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
              <AlertCircle className="w-4 h-4" />
              Academic Backlogs
            </div>
            {analysis.weakSubjects.length === 0 ? (
              <p className="text-xs text-emerald-400 italic">Excellent! Clear of backlog papers and weak metrics.</p>
            ) : (
              <ul className="space-y-1 text-xs text-slate-300">
                {analysis.weakSubjects.map((sub, wIdx) => (
                  <li key={wIdx} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    {sub}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Course Detailed breakdown Table */}
      <div className="bg-[#141416] border border-[#1E1E21] rounded-2xl shadow-xl overflow-hidden">
        <div className="p-5 border-b border-[#1E1E21] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Course-wise Examination Marks Record</h4>
          </div>
          <button
            onClick={() => setIsAllocationModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold text-xs flex items-center gap-1.5 transition-all"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Allocate & Edit Marks
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0A0A0B] text-gray-400 font-bold uppercase tracking-wider border-b border-[#1E1E21]">
              <tr>
                <th className="p-4">Subject Code</th>
                <th className="p-4">Subject Title</th>
                <th className="p-4">Internal</th>
                <th className="p-4">External</th>
                <th className="p-4">Total Marks</th>
                <th className="p-4">Credits</th>
                <th className="p-4">Grade</th>
                <th className="p-4 rounded-r-xl">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E1E21]/50 text-slate-300">
              {subjects.map((sub) => (
                <tr key={sub.subjectCode} className="hover:bg-[#1A1A1D]/25 transition-all">
                  <td className="p-4 font-mono font-bold text-blue-400">{sub.subjectCode}</td>
                  <td className="p-4 font-semibold text-white text-left">{sub.subjectName}</td>
                  <td className="p-4 font-mono text-gray-500">{sub.internalMarks ?? '-'}</td>
                  <td className="p-4 font-mono text-gray-500">{sub.externalMarks ?? '-'}</td>
                  <td className="p-4 font-mono font-bold text-slate-200">{sub.totalMarks ?? '-'}</td>
                  <td className="p-4 font-mono text-gray-500">{sub.credits}</td>
                  <td className="p-4 font-mono font-black text-purple-400">{sub.grade}</td>
                  <td className="p-4 text-left">
                    {sub.status === 'Pass' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase tracking-wider">
                        Pass
                      </span>
                    ) : sub.status === 'Absent' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 uppercase tracking-wider animate-pulse">
                        Absent
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400 uppercase tracking-wider">
                        Fail
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deterministic Diagnosis rules and Roadmap */}
      <div className="p-6 rounded-2xl bg-[#141416] border border-[#1E1E21] shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-blue-400 border-b border-[#1E1E21] pb-3">
          <Lightbulb className="w-5 h-5" />
          <h4 className="text-xs font-bold text-white uppercase tracking-widest">Remedial roadmap diagnosis recommendations</h4>
        </div>
        <div className="space-y-3">
          {analysis.recommendations.map((rec, rIdx) => (
            <div key={rIdx} className="p-3.5 rounded-xl bg-[#0A0A0B]/40 border border-[#1E1E21] flex items-start gap-3 text-left">
              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1.5" />
              <p className="text-xs text-gray-400 leading-relaxed font-semibold">{rec}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Subject Allocation & Editing Modal */}
      <SubjectAllocationModal
        isOpen={isAllocationModalOpen}
        onClose={() => setIsAllocationModalOpen(false)}
        student={student}
        initialSubjects={subjects}
        onSaveSuccess={fetchStudentDetails}
      />
    </div>
  );
}
