export interface Student {
  seatNo: string;
  uploadId: string;
  rollNo: string;
  name: string;
  motherName: string;
  enrollmentNo: string;
  branch: string;
  semester: string;
  collegeCode: string;
  collegeName: string;
  division?: string;
  sgpa: number;
  cgpa: number;
  credits: number;
  resultStatus: 'Pass' | 'Fail' | 'KT';
  ktCount: number;
  subjects?: SubjectMark[];
}

export interface SubjectMark {
  id?: string;
  seatNo: string;
  uploadId: string;
  subjectCode: string;
  subjectName: string;
  internalMarks: number;
  externalMarks: number;
  practicalMarks: number;
  termWork: number;
  oral: number;
  totalMarks: number;
  credits: number;
  grade: string;
  status: 'Pass' | 'Fail' | 'Absent';
}

export interface Upload {
  id: string;
  filename: string;
  uploadDate: string;
  studentCount: number;
  status: 'Processing' | 'Completed' | 'Failed';
}

export interface GradeCount {
  grade: string;
  count: number;
}

export interface SubjectStats {
  subjectCode: string;
  subjectName: string;
  average: number;
  highest: number;
  lowest: number;
  passCount: number;
  failCount: number;
  totalStudents: number;
}

export interface BranchStats {
  branch: string;
  studentCount: number;
  averageSgpa: number;
  passPercentage: number;
}

export interface Analytics {
  totalStudents: number;
  passCount: number;
  failCount: number;
  ktCount: number;
  passPercentage: number;
  failPercentage: number;
  ktPercentage: number;
  highestSgpa: number;
  lowestSgpa: number;
  averageSgpa: number;
  medianSgpa: number;
  gradeDistribution: GradeCount[];
  creditDistribution: { credits: number; count: number }[];
  performanceDistribution: { level: string; count: number }[];
  subjectStats: SubjectStats[];
  branchStats: BranchStats[];
  topStudents: Student[];
  bottomStudents: Student[];
}

export interface StudentAnalysis {
  seatNo: string;
  rank: number;
  percentile: number;
  topperDifference: number;
  classAverageDifference: number;
  performanceLevel: 'Outstanding' | 'Excellent' | 'Very Good' | 'Good' | 'Average' | 'Needs Improvement';
  strongSubjects: string[];
  weakSubjects: string[];
  creditsEarned: number;
  creditsRemaining: number;
  recommendations: string[];
}
