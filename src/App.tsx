import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import StudentsView from './components/StudentsView';
import UploadPanel from './components/UploadPanel';
import StudentDetailsView from './components/StudentDetailsView';
import ReportsView from './components/ReportsView';
import DivisionsView from './components/DivisionsView';
import { Analytics } from './types';
import { Sparkles, HelpCircle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [selectedSeatNo, setSelectedSeatNo] = useState<string | null>(null);
  const [uploads, setUploads] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Fetch previous uploads list
  const fetchUploads = async () => {
    try {
      const response = await fetch('/api/uploads');
      const resData = await response.json();
      if (resData.success) {
        setUploads(resData.uploads);
      }
    } catch (err) {
      console.error('Error fetching uploads list:', err);
    }
  };

  // Fetch aggregate analytics
  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const response = await fetch('/api/analytics');
      const resData = await response.json();
      if (resData.success) {
        setAnalytics(resData.analytics);
      }
    } catch (err) {
      console.error('Error fetching dashboard analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // On page mount
  useEffect(() => {
    fetchUploads();
    fetchAnalytics();
  }, []);

  // When a student gets parsed/uploaded successfully
  const handleUploadSuccess = () => {
    fetchUploads();
    fetchAnalytics();
    setActiveTab('dashboard'); // Redirect to dashboard to review visual graphs!
  };

  // Deleting previous register uploads
  const handleDeleteUpload = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this PDF register? All student grades and analytics from this ledger will be removed.')) {
      return;
    }

    try {
      const response = await fetch(`/api/uploads/${id}`, {
        method: 'DELETE'
      });
      const resData = await response.json();
      if (resData.success) {
        fetchUploads();
        fetchAnalytics();
      }
    } catch (err) {
      console.error('Error deleting upload ledger:', err);
    }
  };

  // Trigger select student details
  const handleSelectStudent = (seatNo: string) => {
    setSelectedSeatNo(seatNo);
  };

  // Total student count in db
  const totalStudentCount = analytics ? analytics.totalStudents : 0;

  return (
    <div className="flex bg-[#0A0A0B] text-slate-100 min-h-screen font-sans">
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={selectedSeatNo ? 'students' : activeTab} 
        setActiveTab={(tab) => {
          setSelectedSeatNo(null); // Clear student detail overlays
          setActiveTab(tab);
        }} 
        studentCount={totalStudentCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Top Floating App Bar */}
        <header className="h-16 px-8 border-b border-[#1E1E21] bg-[#0A0A0B]/80 backdrop-blur sticky top-0 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-md shadow-blue-600/50" />
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">
              {selectedSeatNo 
                ? 'Directory / Student Diagnostic' 
                : activeTab === 'dashboard' ? 'Overview Analytics' 
                : activeTab === 'students' ? 'Students Directory'
                : activeTab === 'upload' ? 'Upload Registers'
                : activeTab === 'divisions' ? 'Student Divisions'
                : 'Bulk Reports'
              }
            </h2>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141416] border border-[#1E1E21] text-slate-400 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Academic Session May 2026</span>
            </div>
          </div>
        </header>

        {/* Dynamic Tab Body */}
        <div className="flex-1 max-w-7xl w-full mx-auto pb-12">
          {selectedSeatNo ? (
            <StudentDetailsView 
              seatNo={selectedSeatNo} 
              onBack={() => setSelectedSeatNo(null)} 
            />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView 
                  analytics={analytics!} 
                  onViewStudents={() => setActiveTab('upload')} 
                />
              )}
              {activeTab === 'students' && (
                <StudentsView onSelectStudent={handleSelectStudent} />
              )}
              {activeTab === 'upload' && (
                <UploadPanel 
                  uploads={uploads} 
                  onUploadSuccess={handleUploadSuccess} 
                  onDeleteUpload={handleDeleteUpload} 
                />
              )}
              {activeTab === 'divisions' && (
                <DivisionsView />
              )}
              {activeTab === 'reports' && (
                <ReportsView analytics={analytics!} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
