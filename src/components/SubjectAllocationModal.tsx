import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Sparkles, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { Student, SubjectMark } from '../types';

interface SubjectAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  initialSubjects: SubjectMark[];
  onSaveSuccess: () => void;
}

export default function SubjectAllocationModal({
  isOpen,
  onClose,
  student,
  initialSubjects,
  onSaveSuccess
}: SubjectAllocationModalProps) {
  const [subjects, setSubjects] = useState<SubjectMark[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialSubjects && initialSubjects.length > 0) {
      setSubjects(initialSubjects.map(s => ({ ...s })));
    } else {
      // Default empty subject row if student has no subjects yet
      setSubjects([
        {
          seatNo: student.seatNo,
          uploadId: student.uploadId || 'manual',
          subjectCode: 'SUB101',
          subjectName: 'Course 1',
          internalMarks: 20,
          externalMarks: 60,
          practicalMarks: 0,
          termWork: 0,
          oral: 0,
          totalMarks: 80,
          credits: 4,
          grade: 'O',
          status: 'Pass'
        }
      ]);
    }
  }, [initialSubjects, student, isOpen]);

  if (!isOpen) return null;

  const handleFieldChange = (index: number, field: keyof SubjectMark, value: any) => {
    const updated = [...subjects];
    const item = { ...updated[index], [field]: value };

    // If changing internal, external, practical, term work, or oral, auto recalculate total if wanted
    if (['internalMarks', 'externalMarks', 'practicalMarks', 'termWork', 'oral'].includes(field)) {
      const intVal = Number(field === 'internalMarks' ? value : item.internalMarks) || 0;
      const extVal = Number(field === 'externalMarks' ? value : item.externalMarks) || 0;
      const prVal = Number(field === 'practicalMarks' ? value : item.practicalMarks) || 0;
      const twVal = Number(field === 'termWork' ? value : item.termWork) || 0;
      const oralVal = Number(field === 'oral' ? value : item.oral) || 0;
      item.totalMarks = intVal + extVal + prVal + twVal + oralVal;

      // Auto update grade based on total marks
      const total = item.totalMarks;
      if (total >= 80) item.grade = 'O';
      else if (total >= 70) item.grade = 'A';
      else if (total >= 60) item.grade = 'B';
      else if (total >= 50) item.grade = 'C';
      else if (total >= 40) item.grade = 'D';
      else item.grade = 'F';

      item.status = item.grade === 'F' ? 'Fail' : 'Pass';
    }

    updated[index] = item;
    setSubjects(updated);
  };

  const addSubjectRow = () => {
    const newCode = `SUB${101 + subjects.length}`;
    setSubjects([
      ...subjects,
      {
        seatNo: student.seatNo,
        uploadId: student.uploadId || 'manual',
        subjectCode: newCode,
        subjectName: `New Course ${subjects.length + 1}`,
        internalMarks: 20,
        externalMarks: 60,
        practicalMarks: 0,
        termWork: 0,
        oral: 0,
        totalMarks: 80,
        credits: 3,
        grade: 'O',
        status: 'Pass'
      }
    ]);
  };

  const removeSubjectRow = (index: number) => {
    if (subjects.length <= 1) {
      alert("At least one subject is required.");
      return;
    }
    setSubjects(subjects.filter((_, i) => i !== index));
  };

  const autoAllocate2080 = () => {
    const updated = subjects.map(s => {
      const total = Number(s.totalMarks) || 80;
      const intMarks = Math.round(total * 0.25);
      const extMarks = total - intMarks;
      return {
        ...s,
        internalMarks: intMarks,
        externalMarks: extMarks,
        totalMarks: total
      };
    });
    setSubjects(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/students/${student.seatNo}/subjects`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subjects })
      });

      const resData = await res.json();
      if (resData.success) {
        setSuccessMsg("Subject marks successfully allocated and saved!");
        setTimeout(() => {
          onSaveSuccess();
          onClose();
        }, 1200);
      } else {
        setErrorMsg(resData.error || "Failed to save subject marks.");
      }
    } catch (err: any) {
      setErrorMsg(`Server request error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div className="bg-[#141416] border border-[#1E1E21] rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-[#1E1E21] flex items-center justify-between bg-[#0A0A0B]/60">
          <div>
            <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Subject Marks Allocation Engine</span>
            </div>
            <h3 className="text-lg font-bold text-white uppercase tracking-wide">
              Allocate & Edit Marks for {student.name} ({student.seatNo})
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-[#1A1A1D] hover:bg-[#2A2A2D] text-gray-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Quick Actions Toolbar */}
        <div className="p-4 border-b border-[#1E1E21] bg-[#141416] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={addSubjectRow}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Subject Line
            </button>
            <button
              onClick={autoAllocate2080}
              className="px-3.5 py-1.5 rounded-lg bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/30 text-purple-400 font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Auto-Split 25% Internal / 75% External
            </button>
          </div>
          <p className="text-[11px] text-gray-500 font-medium">
            Editing subject codes, internal/external splits, credits, and totals updates analytics dynamically.
          </p>
        </div>

        {/* Status Alerts */}
        {errorMsg && (
          <div className="m-4 p-3 bg-rose-950/30 border border-rose-800/40 text-rose-300 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="m-4 p-3 bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Table Body */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0A0A0B] text-gray-400 font-bold uppercase tracking-wider border-b border-[#1E1E21] sticky top-0 z-10">
              <tr>
                <th className="p-3">Code</th>
                <th className="p-3 min-w-[160px]">Subject Title</th>
                <th className="p-3 w-20">Internal</th>
                <th className="p-3 w-20">External</th>
                <th className="p-3 w-20">Practical</th>
                <th className="p-3 w-20">Term Work</th>
                <th className="p-3 w-20 font-bold text-blue-400">Total</th>
                <th className="p-3 w-16">Credits</th>
                <th className="p-3 w-20">Grade</th>
                <th className="p-3 w-24">Status</th>
                <th className="p-3 w-12 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E1E21]/60 text-slate-200">
              {subjects.map((sub, idx) => (
                <tr key={idx} className="hover:bg-[#1A1A1D]/40 transition-colors">
                  <td className="p-2">
                    <input 
                      type="text" 
                      value={sub.subjectCode}
                      onChange={(e) => handleFieldChange(idx, 'subjectCode', e.target.value)}
                      className="w-full bg-[#0A0A0B] border border-[#1E1E21] rounded px-2 py-1 font-mono font-bold text-blue-400 focus:outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="p-2">
                    <input 
                      type="text" 
                      value={sub.subjectName}
                      onChange={(e) => handleFieldChange(idx, 'subjectName', e.target.value)}
                      className="w-full bg-[#0A0A0B] border border-[#1E1E21] rounded px-2 py-1 font-medium focus:outline-none focus:border-blue-500 text-white"
                    />
                  </td>
                  <td className="p-2">
                    <input 
                      type="number" 
                      value={sub.internalMarks}
                      onChange={(e) => handleFieldChange(idx, 'internalMarks', parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#0A0A0B] border border-[#1E1E21] rounded px-2 py-1 font-mono focus:outline-none focus:border-blue-500 text-gray-300"
                    />
                  </td>
                  <td className="p-2">
                    <input 
                      type="number" 
                      value={sub.externalMarks}
                      onChange={(e) => handleFieldChange(idx, 'externalMarks', parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#0A0A0B] border border-[#1E1E21] rounded px-2 py-1 font-mono focus:outline-none focus:border-blue-500 text-gray-300"
                    />
                  </td>
                  <td className="p-2">
                    <input 
                      type="number" 
                      value={sub.practicalMarks || 0}
                      onChange={(e) => handleFieldChange(idx, 'practicalMarks', parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#0A0A0B] border border-[#1E1E21] rounded px-2 py-1 font-mono focus:outline-none focus:border-blue-500 text-gray-300"
                    />
                  </td>
                  <td className="p-2">
                    <input 
                      type="number" 
                      value={sub.termWork || 0}
                      onChange={(e) => handleFieldChange(idx, 'termWork', parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#0A0A0B] border border-[#1E1E21] rounded px-2 py-1 font-mono focus:outline-none focus:border-blue-500 text-gray-300"
                    />
                  </td>
                  <td className="p-2">
                    <input 
                      type="number" 
                      value={sub.totalMarks}
                      onChange={(e) => handleFieldChange(idx, 'totalMarks', parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#0A0A0B] border border-blue-500/40 rounded px-2 py-1 font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="p-2">
                    <input 
                      type="number" 
                      step="0.5"
                      value={sub.credits}
                      onChange={(e) => handleFieldChange(idx, 'credits', parseFloat(e.target.value) || 1)}
                      className="w-full bg-[#0A0A0B] border border-[#1E1E21] rounded px-2 py-1 font-mono focus:outline-none focus:border-blue-500 text-gray-300"
                    />
                  </td>
                  <td className="p-2">
                    <input 
                      type="text" 
                      value={sub.grade}
                      onChange={(e) => handleFieldChange(idx, 'grade', e.target.value.toUpperCase())}
                      className="w-full bg-[#0A0A0B] border border-[#1E1E21] rounded px-2 py-1 font-mono font-bold text-purple-400 focus:outline-none focus:border-blue-500 uppercase"
                    />
                  </td>
                  <td className="p-2">
                    <select 
                      value={sub.status}
                      onChange={(e) => handleFieldChange(idx, 'status', e.target.value)}
                      className="w-full bg-[#0A0A0B] border border-[#1E1E21] rounded px-2 py-1 font-bold text-[11px] focus:outline-none focus:border-blue-500"
                    >
                      <option value="Pass">Pass</option>
                      <option value="Fail">Fail</option>
                      <option value="Absent">Absent</option>
                    </select>
                  </td>
                  <td className="p-2 text-center">
                    <button 
                      onClick={() => removeSubjectRow(idx)}
                      className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all"
                      title="Remove Row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-[#1E1E21] bg-[#0A0A0B]/60 flex items-center justify-between">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#1A1A1D] border border-[#2A2A2D] text-gray-300 font-bold text-xs hover:bg-[#252529] transition-all"
          >
            Cancel
          </button>

          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all duration-300 disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Saving Allocation...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save & Apply Subject Marks</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
