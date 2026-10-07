import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Users,
  Sparkles,
  Trash2,
  Layers,
} from 'lucide-react';

interface DivisionSummary {
  name: string;
  count: number;
}

interface UploadResult {
  divisionsFound: string[];
  matchedCount: number;
  unmatchedCount: number;
  unmatchedSeatNos: string[];
}

export default function DivisionsView() {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [divisions, setDivisions] = useState<DivisionSummary[]>([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [clearing, setClearing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const response = await fetch('/api/divisions');
      const resData = await response.json();
      if (resData.success) {
        setDivisions(resData.divisions);
        setUnassignedCount(resData.unassignedCount);
      }
    } catch (err) {
      console.error('Error fetching divisions summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setErrorMsg(null);
    setUploadResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const response = await fetch('/api/upload-divisions', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-Filename': file.name,
        },
        body: arrayBuffer,
      });

      const resData = await response.json();

      if (resData.success) {
        setUploadResult({
          divisionsFound: resData.divisionsFound,
          matchedCount: resData.matchedCount,
          unmatchedCount: resData.unmatchedCount,
          unmatchedSeatNos: resData.unmatchedSeatNos || [],
        });
        fetchSummary();
      } else {
        setErrorMsg(resData.error || 'An unknown error occurred while parsing the divisions file.');
      }
    } catch (err: any) {
      setErrorMsg(`Server request failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        uploadFile(file);
      } else {
        setErrorMsg('Invalid file format. Please upload an Excel file (.xlsx or .xls).');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Remove all division assignments from every student? This does not delete any student records or results.')) {
      return;
    }
    setClearing(true);
    try {
      const response = await fetch('/api/divisions', { method: 'DELETE' });
      const resData = await response.json();
      if (resData.success) {
        setUploadResult(null);
        fetchSummary();
      }
    } catch (err) {
      console.error('Error clearing divisions:', err);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in p-6">
      {/* Introduction Card */}
      <div className="bg-gradient-to-r from-[#141416] via-[#141416] to-[#0A0A0B] p-6 rounded-2xl border border-[#1E1E21] shadow-2xl">
        <div className="flex items-center gap-2 text-blue-400 mb-2">
          <Layers className="w-5 h-5" />
          <span className="text-xs font-bold tracking-wider uppercase">Student Divisions</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Split results into Sec-A, Sec-B, Sec-C and more</h2>
        <p className="text-xs text-gray-400 leading-relaxed max-w-3xl">
          Upload a spreadsheet mapping each student's seat number to their division. Once assigned, the Excel export
          in Reports &amp; Exports will automatically include one extra sheet per division, alongside the full
          register - so a class teacher can jump straight to just their own section.
        </p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-gray-500">
          <div className="bg-[#0A0A0B]/50 p-3 rounded-xl border border-[#1E1E21]/60">
            <span className="text-gray-300 font-bold block mb-1">Format A</span>
            One sheet per division - name the sheet "Sec-A", "Sec-B", etc, and list that division's seat numbers down the first column.
          </div>
          <div className="bg-[#0A0A0B]/50 p-3 rounded-xl border border-[#1E1E21]/60">
            <span className="text-gray-300 font-bold block mb-1">Format B</span>
            One sheet, two columns - a "Seat No" column and a "Division" column, one row per student.
          </div>
          <div className="bg-[#0A0A0B]/50 p-3 rounded-xl border border-[#1E1E21]/60">
            <span className="text-gray-300 font-bold block mb-1">Format C</span>
            One sheet, one column per division - header each column "Sec-A", "Sec-B", etc, seat numbers listed underneath.
          </div>
        </div>
      </div>

      {/* Upload dropzone */}
      <div
        className={`relative rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
          dragActive ? 'border-blue-500 bg-blue-500/5' : 'border-[#1E1E21] bg-[#141416]'
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-[#0A0A0B] border border-[#1E1E21] flex items-center justify-center">
            {uploading ? (
              <Sparkles className="w-6 h-6 text-blue-400 animate-pulse" />
            ) : (
              <Upload className="w-6 h-6 text-blue-400" />
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              {uploading ? 'Parsing divisions file...' : 'Drag & drop your divisions Excel file here'}
            </p>
            <p className="text-xs text-gray-500 mt-1">or click below to browse (.xlsx / .xls)</p>
          </div>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Choose File
          </button>
        </div>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Upload result */}
      {uploadResult && (
        <div className="flex flex-col gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs">
          <div className="flex items-start gap-3 text-emerald-400">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Found {uploadResult.divisionsFound.length} division{uploadResult.divisionsFound.length === 1 ? '' : 's'}{' '}
              ({uploadResult.divisionsFound.join(', ')}). Matched {uploadResult.matchedCount} student
              {uploadResult.matchedCount === 1 ? '' : 's'} to their division.
            </span>
          </div>
          {uploadResult.unmatchedCount > 0 && (
            <div className="pl-7 text-amber-400">
              {uploadResult.unmatchedCount} seat number{uploadResult.unmatchedCount === 1 ? '' : 's'} in this file
              didn't match any uploaded student (typo, or from a different result set):{' '}
              <span className="font-mono text-[10px]">
                {uploadResult.unmatchedSeatNos.join(', ')}
                {uploadResult.unmatchedCount > uploadResult.unmatchedSeatNos.length ? ', ...' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Current division summary */}
      <div className="bg-[#141416] border border-[#1E1E21] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white">
            <Users className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold">Current Division Assignments</h3>
          </div>
          {divisions.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              disabled={clearing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A0A0B] border border-[#1E1E21] text-red-400 text-[11px] font-bold hover:border-red-500/40 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All Divisions
            </button>
          )}
        </div>

        {loadingSummary ? (
          <p className="text-xs text-gray-500">Loading...</p>
        ) : divisions.length === 0 ? (
          <p className="text-xs text-gray-500">
            No divisions assigned yet. Upload a divisions file above to get started.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {divisions.map(div => (
              <div key={div.name} className="bg-[#0A0A0B] border border-[#1E1E21] rounded-xl p-4">
                <div className="flex items-center gap-2 text-blue-400 mb-1">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold truncate">{div.name}</span>
                </div>
                <p className="text-2xl font-bold text-white">{div.count}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">students</p>
              </div>
            ))}
            {unassignedCount > 0 && (
              <div className="bg-[#0A0A0B] border border-[#1E1E21] rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold">Unassigned</span>
                </div>
                <p className="text-2xl font-bold text-white">{unassignedCount}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">students</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
