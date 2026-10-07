import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line
} from 'recharts';
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Zap, 
  TrendingUp, 
  ChevronRight,
  Bookmark
} from 'lucide-react';
import { Analytics } from '../types';

interface DashboardViewProps {
  analytics: Analytics;
  onViewStudents: () => void;
}

export default function DashboardView({ analytics, onViewStudents }: DashboardViewProps) {
  if (analytics.totalStudents === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-[#141416] border border-[#1E1E21] flex items-center justify-center mb-4">
          <Bookmark className="w-8 h-8 text-slate-500" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1">No Active Result Dataset</h3>
        <p className="text-xs text-gray-400 max-w-sm leading-relaxed mb-6">
          The analytics dashboard requires academic records in the database. Head to the Upload Center to add a result register PDF.
        </p>
        <button 
          onClick={onViewStudents} 
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all duration-300"
        >
          Go to Upload Center
        </button>
      </div>
    );
  }

  // Color configurations for charts
  const COLORS_PIE = ['#2563eb', '#ef4444', '#f59e0b']; // Pass (Blue), Fail (Rose), KT (Amber)
  
  // Data prep for Pass vs Fail vs KT
  const statusPieData = [
    { name: 'Passed', value: analytics.passCount },
    { name: 'Failed', value: analytics.failCount },
    { name: 'KT backlogs', value: analytics.ktCount }
  ].filter(item => item.value > 0);

  // Data prep for SGPA Histogram / Performance Levels
  const perfData = analytics.performanceDistribution;

  // Grade breakdown
  const gradeData = analytics.gradeDistribution;

  // Subject Stats for averages
  const subAvgData = analytics.subjectStats.map(s => ({
    subject: s.subjectCode,
    'Average Marks': s.average,
    'Highest Marks': s.highest
  }));

  // Branch statistics
  const branchChartData = analytics.branchStats;

  return (
    <div className="space-y-8 animate-fade-in p-6">
      {/* 4 KPI Top Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI: Total Students */}
        <div className="p-5 rounded-2xl bg-[#141416] border border-[#1E1E21] shadow-md relative overflow-hidden flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-left">Total Students</p>
            <h3 className="text-2xl font-bold text-white mt-1 text-left">{analytics.totalStudents}</h3>
          </div>
        </div>

        {/* KPI: Pass Percentage */}
        <div className="p-5 rounded-2xl bg-[#141416] border border-[#1E1E21] shadow-md relative overflow-hidden flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-left">Pass Percentage</p>
            <h3 className="text-2xl font-bold text-white mt-1 text-left">{analytics.passPercentage}%</h3>
          </div>
        </div>

        {/* KPI: Highest SGPA */}
        <div className="p-5 rounded-2xl bg-[#141416] border border-[#1E1E21] shadow-md relative overflow-hidden flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-left">Highest SGPA</p>
            <h3 className="text-2xl font-bold text-white mt-1 text-left">{analytics.highestSgpa.toFixed(2)}</h3>
          </div>
        </div>

        {/* KPI: Backlogs / Fail */}
        <div className="p-5 rounded-2xl bg-[#141416] border border-[#1E1E21] shadow-md relative overflow-hidden flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-left">Backlogs / Failures</p>
            <h3 className="text-2xl font-bold text-white mt-1 text-left">
              {analytics.failCount + analytics.ktCount} <span className="text-xs text-gray-500 font-medium">students</span>
            </h3>
          </div>
        </div>
      </div>

      {/* Main Charts Bento Grid Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pass vs Fail vs KT Pie */}
        <div className="p-5 rounded-2xl bg-[#141416] border border-[#1E1E21] shadow-md flex flex-col justify-between">
          <div className="mb-4 text-left">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Pass vs Fail vs KT</h4>
            <p className="text-[11px] text-gray-500 leading-relaxed">Percentage split of academic progress and backlogs.</p>
          </div>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#141416', border: '1px solid #1E1E21', borderRadius: '12px' }}
                  itemStyle={{ color: '#f8fafc', fontSize: '11px' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  align="center"
                  iconSize={8}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '11px', color: '#94a3b8', paddingTop: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SGPA Performance Histogram */}
        <div className="p-5 rounded-2xl bg-[#141416] border border-[#1E1E21] shadow-md lg:col-span-2 flex flex-col justify-between">
          <div className="mb-4 text-left">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">SGPA Distribution</h4>
            <p className="text-[11px] text-gray-500 leading-relaxed">Density of student population grouped by performance categories.</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perfData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E1E21" />
                <XAxis dataKey="level" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#141416', border: '1px solid #1E1E21', borderRadius: '12px' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold', fontSize: '11px' }}
                  itemStyle={{ color: '#60a5fa', fontSize: '11px' }}
                />
                <Bar dataKey="count" fill="url(#colorSgpa)" radius={[4, 4, 0, 0]}>
                  {perfData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.level === 'Needs Improvement' ? '#f43f5e' : entry.level === 'Outstanding' ? '#2563eb' : '#3b82f6'} />
                  ))}
                </Bar>
                <defs>
                  <linearGradient id="colorSgpa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Charts Bento Grid Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject-wise averages comparison */}
        <div className="p-5 rounded-2xl bg-[#141416] border border-[#1E1E21] shadow-md flex flex-col justify-between">
          <div className="mb-4 text-left">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Subject Performance Comparison</h4>
            <p className="text-[11px] text-gray-500 leading-relaxed">Comparison of class average marks and absolute highest scores per course.</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subAvgData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E1E21" />
                <XAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#141416', border: '1px solid #1E1E21', borderRadius: '12px' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold', fontSize: '11px' }}
                  itemStyle={{ fontSize: '11px' }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="Average Marks" fill="#2563eb" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Highest Marks" fill="#10b981" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Grade letters distribution */}
        <div className="p-5 rounded-2xl bg-[#141416] border border-[#1E1E21] shadow-md flex flex-col justify-between">
          <div className="mb-4 text-left">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Letter Grade Counts</h4>
            <p className="text-[11px] text-gray-500 leading-relaxed">Total volume of grades achieved across all course exams.</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={gradeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E1E21" />
                <XAxis dataKey="grade" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#141416', border: '1px solid #1E1E21', borderRadius: '12px' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold', fontSize: '11px' }}
                  itemStyle={{ color: '#3b82f6', fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="count" stroke="#2563eb" fill="url(#colorGrade)" strokeWidth={2} />
                <defs>
                  <linearGradient id="colorGrade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Branch Breakdown Comparison and Top lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Branch breakdown table */}
        <div className="p-5 rounded-2xl bg-[#141416] border border-[#1E1E21] shadow-md lg:col-span-2">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 text-left">Branch / Department Diagnostics</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0A0A0B] text-gray-450 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3 rounded-l-xl">Branch Name</th>
                  <th className="p-3">Students</th>
                  <th className="p-3">Avg SGPA</th>
                  <th className="p-3 rounded-r-xl">Pass Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E1E21]/60 text-slate-300">
                {branchChartData.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-[#1A1A1D]/30 transition-colors">
                    <td className="p-3 font-semibold text-white">{row.branch}</td>
                    <td className="p-3">{row.studentCount}</td>
                    <td className="p-3 font-mono">{row.averageSgpa.toFixed(2)}</td>
                    <td className="p-3 font-semibold text-emerald-400">{row.passPercentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mini Topper List Widget */}
        <div className="p-5 rounded-2xl bg-[#141416] border border-[#1E1E21] shadow-md flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 text-left">Top 3 Class Rankers</h4>
            <div className="space-y-3">
              {analytics.topStudents.slice(0, 3).map((topper, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-xl bg-[#0A0A0B]/40 border border-[#1E1E21]">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                    idx === 0 ? 'bg-amber-500/10 text-amber-400' :
                    idx === 1 ? 'bg-slate-300/10 text-slate-300' :
                    'bg-amber-700/10 text-amber-600'
                  }`}>
                    #{idx + 1}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-bold text-white truncate">{topper.name}</p>
                    <p className="text-[10px] text-gray-500 font-mono">Seat: {topper.seatNo}</p>
                  </div>
                  <div className="text-xs font-bold font-mono text-emerald-400 bg-[#0A0A0B] border border-emerald-500/10 px-2 py-1 rounded-lg">
                    {topper.sgpa.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <button 
            onClick={onViewStudents}
            className="w-full mt-4 flex items-center justify-center gap-1 bg-[#1A1A1D] hover:bg-[#1A1A1D]/85 border border-[#1E1E21] py-2.5 rounded-xl text-[11px] font-semibold text-gray-400 hover:text-white transition-all"
          >
            Open Students Directory
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
