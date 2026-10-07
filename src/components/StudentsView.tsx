import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Eye, 
  HelpCircle,
  FolderOpen
} from 'lucide-react';
import { Student } from '../types';

interface StudentsViewProps {
  onSelectStudent: (seatNo: string) => void;
}

export default function StudentsView({ onSelectStudent }: StudentsViewProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('');
  const [status, setStatus] = useState('');
  const [sgpaPreset, setSgpaPreset] = useState(''); // 9+, 8-9, 7-8, 6-7, <6
  
  // Pagination & Sorting state
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [sortBy, setSortBy] = useState('sgpa');
  const [sortOrder, setSortOrder] = useState('DESC');

  // Load students from database
  const fetchStudents = async () => {
    setLoading(true);
    try {
      let sgpaMin = 0;
      let sgpaMax = 10;
      if (sgpaPreset === '9') { sgpaMin = 9; sgpaMax = 10; }
      else if (sgpaPreset === '8-9') { sgpaMin = 8; sgpaMax = 9; }
      else if (sgpaPreset === '7-8') { sgpaMin = 7; sgpaMax = 8; }
      else if (sgpaPreset === '6-7') { sgpaMin = 6; sgpaMax = 7; }
      else if (sgpaPreset === '<6') { sgpaMin = 0; sgpaMax = 6; }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search,
        branch,
        status,
        sortBy,
        sortOrder,
        sgpaMin: sgpaMin.toString(),
        sgpaMax: sgpaMax.toString()
      });

      const response = await fetch(`/api/students?${params.toString()}`);
      const resData = await response.json();
      if (resData.success) {
        setStudents(resData.students);
        setTotalPages(resData.pagination.totalPages);
        setTotalRecords(resData.pagination.total);
      }
    } catch (err) {
      console.error('Error fetching students list:', err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger load on change of filter states, search text, or page Index
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchStudents();
    }, search ? 300 : 0); // Debounce search changes

    return () => clearTimeout(delayDebounce);
  }, [search, branch, status, sgpaPreset, page, sortBy, sortOrder]);

  // Reset page to 1 when filters or search change
  useEffect(() => {
    setPage(1);
  }, [search, branch, status, sgpaPreset]);

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'DESC' ? 'ASC' : 'DESC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setBranch('');
    setStatus('');
    setSgpaPreset('');
  };

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white text-left">Students Register Directory</h2>
          <p className="text-xs text-gray-500 mt-0.5 text-left">Explore individual student registries, backlogs, grades, and deterministic diagnostic recommendations.</p>
        </div>
        <div className="text-xs text-gray-400 font-mono bg-[#141416] border border-[#1E1E21] px-3 py-1.5 rounded-lg">
          Records in db: <span className="text-blue-400 font-bold">{totalRecords}</span>
        </div>
      </div>

      {/* Filter and Search Bar Section */}
      <div className="p-5 rounded-2xl bg-[#141416] border border-[#1E1E21] space-y-4 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search Box */}
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search by student name or seat no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0A0A0B] border border-[#1E1E21] hover:border-[#2A2A2D] focus:border-blue-500 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-100 placeholder-gray-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Branch filter */}
          <div>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full bg-[#0A0A0B] border border-[#1E1E21] hover:border-[#2A2A2D] focus:border-blue-500 rounded-xl px-4 py-2 text-xs font-semibold text-gray-300 focus:outline-none transition-colors"
            >
              <option value="">All Branches</option>
              <option value="Computer Engineering">Computer Engineering</option>
              <option value="Information Technology">Information Technology</option>
              <option value="Electronics & Telecom">Electronics & Telecom</option>
              <option value="Mechanical Engineering">Mechanical Engineering</option>
            </select>
          </div>

          {/* Exam status filter */}
          <div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-[#0A0A0B] border border-[#1E1E21] hover:border-[#2A2A2D] focus:border-blue-500 rounded-xl px-4 py-2 text-xs font-semibold text-gray-300 focus:outline-none transition-colors"
            >
              <option value="">All Pass/KT/Fail</option>
              <option value="Pass">Pass Status</option>
              <option value="KT">KT Backlogs</option>
              <option value="Fail">Fail Status</option>
            </select>
          </div>
        </div>

        {/* Extended filtering tag selection */}
        <div className="flex flex-wrap items-center gap-3 border-t border-[#1E1E21]/60 pt-4">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Academic Category:
          </span>
          {[
            { id: '', label: 'All Grades' },
            { id: '9', label: 'Outstanding (SGPA >= 9)' },
            { id: '8-9', label: 'Excellent (SGPA 8-9)' },
            { id: '7-8', label: 'Very Good (SGPA 7-8)' },
            { id: '6-7', label: 'Good (SGPA 6-7)' },
            { id: '<6', label: 'Needs Improvement (<6)' }
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => setSgpaPreset(preset.id)}
              className={`px-3 py-1 rounded-lg text-[10px] font-semibold border transition-all duration-200 ${
                sgpaPreset === preset.id
                  ? 'bg-blue-600/10 border-blue-600/40 text-blue-400'
                  : 'bg-[#0A0A0B] border-[#1E1E21] text-gray-500 hover:text-gray-300 hover:border-[#2A2A2D]'
              }`}
            >
              {preset.label}
            </button>
          ))}

          {(search || branch || status || sgpaPreset) && (
            <button 
              onClick={clearFilters}
              className="ml-auto text-[10px] font-bold text-rose-400 hover:text-rose-300 transition-colors uppercase tracking-widest hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Student list Table */}
      <div className="bg-[#141416] border border-[#1E1E21] rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-20 text-center space-y-4">
            <div className="w-10 h-10 rounded-full border-4 border-[#1E1E21] border-t-blue-500 animate-spin mx-auto" />
            <p className="text-xs text-gray-500 font-medium">Querying database directory...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#0A0A0B] border border-[#1E1E21] flex items-center justify-center mx-auto shadow-inner text-gray-700">
              <FolderOpen className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-300">No Student Records Found</p>
              <p className="text-xs text-gray-500 mt-1">Try relaxing filters, adjusting search queries, or uploading result registers.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0A0A0B] text-gray-400 font-bold uppercase tracking-wider select-none border-b border-[#1E1E21]">
                <tr>
                  <th onClick={() => toggleSort('seat_no')} className="p-4 cursor-pointer hover:bg-[#0F0F11]/80 hover:text-white rounded-l-xl">
                    <div className="flex items-center gap-1.5">
                      Seat No
                      <ArrowUpDown className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  </th>
                  <th onClick={() => toggleSort('name')} className="p-4 cursor-pointer hover:bg-[#0F0F11]/80 hover:text-white">
                    <div className="flex items-center gap-1.5">
                      Student Name
                      <ArrowUpDown className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  </th>
                  <th className="p-4">Subjects & Marks</th>
                  <th className="p-4">Branch</th>
                  <th onClick={() => toggleSort('sgpa')} className="p-4 cursor-pointer hover:bg-[#0F0F11]/80 hover:text-white">
                    <div className="flex items-center gap-1.5">
                      SGPA
                      <ArrowUpDown className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  </th>
                  <th onClick={() => toggleSort('cgpa')} className="p-4 cursor-pointer hover:bg-[#0F0F11]/80 hover:text-white">
                    <div className="flex items-center gap-1.5">
                      CGPA
                      <ArrowUpDown className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  </th>
                  <th className="p-4">KT / Backlog</th>
                  <th className="p-4 text-center rounded-r-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E1E21]/50 text-slate-300">
                {students.map((student) => (
                  <tr key={student.seatNo} className="hover:bg-[#1A1A1D]/25 transition-all group duration-150">
                    <td className="p-4 font-mono font-bold text-slate-200">{student.seatNo}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#0A0A0B] border border-[#1E1E21] flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5 text-gray-550" />
                        </div>
                        <span className="font-semibold text-white truncate max-w-[180px] block text-left">{student.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5 max-w-[360px] text-left">
                        {student.subjects && student.subjects.length > 0 ? (
                          student.subjects.map(sub => {
                            const shortName = sub.subjectName
                              .replace('Applied Mathematics-II', 'Maths-II')
                              .replace('Applied Mathematics- II', 'Maths-II')
                              .replace('Engineering Graphics Lab', 'EG Lab')
                              .replace('Engineering Graphics', 'EG')
                              .replace('Data Structure Lab', 'DS Lab')
                              .replace('Data Structure', 'DS')
                              .replace('Social Science & Community Services', 'SSCS')
                              .replace('Indian Knowledge System', 'IKS')
                              .replace('Engineering Workshop-II', 'Workshop')
                              .replace('Python Programming', 'Python')
                              .replace('Semiconductor Physics Lab', 'Physics Lab')
                              .replace('Semiconductor Physics', 'Physics')
                              .replace('Environmental Chemistry & Non-conventional Energy Sources Lab', 'Env Lab')
                              .replace('Environmental Chemistry & Non-conventional Energy Sources', 'Env Sci')
                              .replace('Environmental Chemistry and Non conventional energy sources Lab', 'Env Lab')
                              .replace('Environmental Chemistry and Non conventional energy sources', 'Env Sci');
                            
                            const isFail = sub.status === 'Fail' || sub.status === 'Absent';
                            
                            return (
                              <span 
                                key={sub.subjectCode} 
                                title={`${sub.subjectName}: ${sub.totalMarks} (${sub.grade})`}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                                  isFail 
                                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 font-bold' 
                                    : 'bg-[#0A0A0B] border-[#1E1E21] text-gray-300'
                                }`}
                              >
                                <span className="text-gray-500">{shortName}:</span>
                                <span className={isFail ? 'text-rose-400 font-extrabold' : 'text-blue-400 font-bold'}>{sub.totalMarks}</span>
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-gray-500 italic text-[10px]">No subjects loaded</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-gray-450 font-medium truncate max-w-[150px] text-left">{student.branch}</td>
                    <td className="p-4 font-mono font-semibold text-blue-400 text-left">{student.sgpa.toFixed(2)}</td>
                    <td className="p-4 font-mono text-slate-300 text-left">{student.cgpa.toFixed(2)}</td>
                    <td className="p-4 text-left">
                      {student.ktCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono uppercase tracking-wide">
                          KT ({student.ktCount})
                        </span>
                      ) : student.resultStatus === 'Fail' || student.resultStatus === 'Absent' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono uppercase tracking-wide">
                          Backlog
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono uppercase tracking-wide">
                          Clear
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => onSelectStudent(student.seatNo)}
                        className="p-1.5 rounded-lg bg-[#0A0A0B] border border-[#1E1E21] text-gray-400 hover:text-white hover:bg-[#1A1A1D] transition-all flex items-center gap-1 mx-auto text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-400" />
                        Analyze
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginator Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[#1E1E21] bg-[#0A0A0B]/40 flex items-center justify-between gap-4">
            <span className="text-[11px] text-gray-500 font-medium">
              Showing page <span className="text-slate-300 font-bold">{page}</span> of <span className="text-slate-300 font-bold">{totalPages}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="p-2 rounded-lg border border-[#1E1E21] bg-[#141416] text-gray-400 hover:text-white hover:bg-[#1A1A1D] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="p-2 rounded-lg border border-[#1E1E21] bg-[#141416] text-gray-400 hover:text-white hover:bg-[#1A1A1D] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
