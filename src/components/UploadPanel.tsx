import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Trash2, 
  ArrowRight, 
  Sparkles, 
  Clock, 
  HelpCircle,
  TrendingUp,
  RotateCcw,
  Users,
  ShieldCheck
} from 'lucide-react';

interface UploadRecord {
  id: string;
  filename: string;
  uploadDate: string;
  studentCount: number;
  status: string;
}

interface UploadPanelProps {
  uploads: UploadRecord[];
  onUploadSuccess: () => void;
  onDeleteUpload: (id: string) => void;
}

export default function UploadPanel({ uploads, onUploadSuccess, onDeleteUpload }: UploadPanelProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successLogs, setSuccessLogs] = useState<{ studentCount: number; errors: string[] } | null>(null);
  const [sampleCount, setSampleCount] = useState(50);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
      if (validTypes.includes(file.type) || /\.(pdf|png|jpe?g|webp)$/i.test(file.name)) {
        uploadFile(file);
      } else {
        setErrorMsg("Invalid file format. Please upload a university result PDF or image document (PNG, JPG, WEBP).");
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setErrorMsg(null);
    setSuccessLogs(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const contentType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      
      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'X-Filename': file.name
        },
        body: arrayBuffer
      });

      const resData = await response.json();
      
      if (resData.success) {
        setSuccessLogs({
          studentCount: resData.studentCount,
          errors: resData.errors || []
        });
        onUploadSuccess();
      } else {
        setErrorMsg(resData.error || "An unknown parsing error occurred inside the parser engine.");
      }
    } catch (err: any) {
      setErrorMsg(`Server request failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const downloadSample = () => {
    window.open(`/api/sample-pdf?count=${sampleCount}`, '_blank');
  };

  return (
    <div className="space-y-8 animate-fade-in p-6">
      {/* Introduction Card */}
      <div className="bg-gradient-to-r from-[#141416] via-[#141416] to-[#0A0A0B] p-6 rounded-2xl border border-[#1E1E21] shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-blue-400">
            <Sparkles className="w-5 h-5" />
            <span className="text-xs font-bold tracking-wider uppercase">Parser Engine Center</span>
          </div>
          <h2 className="text-xl font-bold text-white">Upload University Result PDF Registers</h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            The analyzer parses raw PDF registers page-by-page. To try it instantly, download a deterministic mock engineering result PDF ledger with specified student count below, then drag it back into the uploader!
          </p>
        </div>
        
        {/* Mock PDF Downloader card */}
        <div className="bg-[#0A0A0B]/50 p-4 rounded-xl border border-[#1E1E21]/60 flex items-center gap-4 w-full md:w-auto">
          <div className="flex-1 md:flex-none">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Size of Mock Class</label>
            <select 
              value={sampleCount} 
              onChange={(e) => setSampleCount(parseInt(e.target.value, 10))}
              className="bg-[#0A0A0B] text-slate-200 border border-[#1E1E21] rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 w-full"
            >
              <option value="10">10 Students (Test Sheet)</option>
              <option value="50">50 Students (Medium Class)</option>
              <option value="250">250 Students (Large Department)</option>
              <option value="1000">1000 Students (Full Registry)</option>
            </select>
          </div>
          <button 
            onClick={downloadSample}
            className="h-[34px] self-end bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 rounded-lg flex items-center gap-1.5 transition-all duration-300 shadow-md shadow-blue-500/10 border border-blue-500/50"
          >
            Generate PDF
            <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Drag-Drop Box */}
        <div className="lg:col-span-2 space-y-6">
          <div 
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-12 text-center transition-all duration-300 min-h-[300px] cursor-pointer ${
              dragActive 
                ? 'border-blue-500 bg-blue-500/5 shadow-inner' 
                : 'border-[#1E1E21] hover:border-[#2A2A2D] bg-[#141416]/30'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".pdf, .png, .jpg, .jpeg, .webp"
              className="hidden" 
              onChange={handleFileSelect}
            />

            {uploading ? (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-full border-4 border-[#1E1E21] border-t-blue-500 animate-spin mx-auto" />
                <div>
                  <p className="text-sm font-bold text-white">OCR & Parser Engine Running...</p>
                  <p className="text-xs text-gray-500 mt-1">Analyzing marksheets and extracting subject marks. Do not navigate away.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-[#141416] border border-[#1E1E21] flex items-center justify-center mx-auto shadow-md">
                  <Upload className="w-8 h-8 text-gray-400 group-hover:text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Drag & Drop Result Sheet or PDF Registry</p>
                  <p className="text-xs text-gray-500 mt-1">Supports PDF registers & single result images (PNG, JPG, WEBP)</p>
                </div>

              </div>
            )}
          </div>

          {/* Feedback Blocks */}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-850/30 text-rose-300 flex items-start gap-3 animate-fade-in">
              <AlertCircle className="w-5 h-5 stroke-[2] flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-0.5">Parsing Failed</h4>
                <p className="text-xs leading-relaxed text-rose-400">{errorMsg}</p>
              </div>
            </div>
          )}

          {successLogs && (
            <div className="p-6 rounded-2xl bg-[#141416]/40 border border-[#1E1E21] space-y-4 animate-fade-in">
              <div className="flex items-center gap-3 text-emerald-400">
                <CheckCircle className="w-6 h-6 stroke-[2]" />
                <div>
                  <h4 className="text-sm font-bold">PDF Registry Parsed Successfully</h4>
                  <p className="text-xs text-gray-400 mt-0.5">Identified and indexed <span className="font-bold text-emerald-400">{successLogs.studentCount}</span> unique student profiles.</p>
                </div>
              </div>

              {/* Log Errors Block */}
              {successLogs.errors.length > 0 && (
                <div className="border-t border-[#1E1E21]/80 pt-4">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
                    <AlertCircle className="w-4 h-4" />
                    Non-Blocking Heuristic Logs ({successLogs.errors.length})
                  </div>
                  <div className="bg-[#0A0A0B] rounded-xl p-3 max-h-[140px] overflow-y-auto space-y-1 text-[11px] font-mono text-gray-400 border border-[#1E1E21]">
                    {successLogs.errors.map((err, eIdx) => (
                      <p key={eIdx} className="leading-relaxed border-b border-[#1E1E21] pb-1 last:border-0">{err}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Previous Uploads list */}
        <div className="space-y-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest text-left">Previous Registries</h3>
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {uploads.length === 0 ? (
              <div className="border border-[#1E1E21]/80 rounded-2xl p-8 text-center bg-[#0A0A0B]/20">
                <HelpCircle className="w-10 h-10 text-gray-750 mx-auto mb-3" />
                <p className="text-xs font-semibold text-gray-400">No active student registers in database.</p>
                <p className="text-[10px] text-gray-600 mt-1 leading-relaxed">Upload a university PDF document to begin calculations.</p>
              </div>
            ) : (
              uploads.map((rec) => (
                <div key={rec.id} className="p-4 rounded-xl bg-[#141416] border border-[#1E1E21] flex items-center justify-between gap-4 group transition-colors duration-200 hover:border-[#2A2A2D]">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                      <p className="text-xs font-bold text-slate-200 truncate pr-2 text-left">{rec.filename}</p>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-gray-500 font-medium">
                      <span className="flex items-center gap-1 shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(rec.uploadDate).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1 shrink-0 text-blue-400 font-mono bg-blue-500/5 px-1.5 py-0.5 rounded border border-blue-500/10">
                        <Users className="w-3 h-3" />
                        {rec.studentCount} Students
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => onDeleteUpload(rec.id)}
                    className="p-2 rounded-lg hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 text-gray-500 hover:text-rose-400 transition-all"
                    title="Remove Register"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
