import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  UploadCloud, 
  FileSpreadsheet, 
  GraduationCap,
  Layers
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  studentCount: number;
}

export default function Sidebar({ activeTab, setActiveTab, studentCount }: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Students Directory', icon: Users, badge: studentCount > 0 ? studentCount : undefined },
    { id: 'upload', label: 'Upload Center', icon: UploadCloud },
    { id: 'divisions', label: 'Student Divisions', icon: Layers },
    { id: 'reports', label: 'Reports & Exports', icon: FileSpreadsheet },
  ];

  return (
    <aside id="sidebar" className="w-64 bg-[#0F0F11] border-r border-[#1E1E21] flex flex-col h-screen sticky top-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-[#1E1E21] flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-xl text-white">
          <GraduationCap className="w-6 h-6 text-white stroke-[2]" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-wider uppercase text-left">Universal</h1>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] text-left">Result Analyzer</p>
        </div>
      </div>

      {/* Navigation list */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                isActive
                  ? 'bg-[#1A1A1D] border border-[#2A2A2D] text-blue-400'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-[#141416]/50 border border-transparent'
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'text-blue-400 scale-110' : 'text-gray-500'}`} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge !== undefined && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-[#141416] border border-[#1E1E21] text-gray-300 animate-pulse">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-6 border-t border-[#1E1E21]">
        <div className="p-4 bg-[#141416] border border-[#1E1E21] rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-gray-400">PARSING ENGINE</span>
            <span className="text-[10px] text-green-500 font-mono">OFFLINE</span>
          </div>
          <div className="w-full bg-black h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-600 h-full w-[100%] transition-all"></div>
          </div>
          <p className="text-[10px] text-gray-500 mt-2 text-left">Deterministic parser v2.4.1</p>
        </div>
      </div>
    </aside>
  );
}
