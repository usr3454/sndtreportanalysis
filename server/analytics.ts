import { Student, SubjectMark, Analytics, StudentAnalysis, GradeCount, SubjectStats, BranchStats } from '../src/types';

/**
 * Calculates median of an array of numbers.
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[half];
  }
  return parseFloat(((sorted[half - 1] + sorted[half]) / 2.0).toFixed(2));
}

/**
 * Generates comprehensive mathematical analytics for a set of students and their subjects.
 */
export function calculateAnalytics(students: Student[], subjects: SubjectMark[]): Analytics {
  const totalStudents = students.length;
  if (totalStudents === 0) {
    return {
      totalStudents: 0,
      passCount: 0,
      failCount: 0,
      ktCount: 0,
      passPercentage: 0,
      failPercentage: 0,
      ktPercentage: 0,
      highestSgpa: 0,
      lowestSgpa: 0,
      averageSgpa: 0,
      medianSgpa: 0,
      gradeDistribution: [],
      creditDistribution: [],
      performanceDistribution: [],
      subjectStats: [],
      branchStats: [],
      topStudents: [],
      bottomStudents: []
    };
  }

  // Pass, Fail, KT counts
  const passCount = students.filter(s => s.resultStatus === 'Pass').length;
  const failCount = students.filter(s => s.resultStatus === 'Fail').length;
  const ktCount = students.filter(s => s.resultStatus === 'KT').length;

  const passPercentage = parseFloat(((passCount / totalStudents) * 100).toFixed(2));
  const failPercentage = parseFloat(((failCount / totalStudents) * 100).toFixed(2));
  const ktPercentage = parseFloat(((ktCount / totalStudents) * 100).toFixed(2));

  // SGPA Stats
  const sgpas = students.map(s => s.sgpa).filter(val => val > 0);
  const highestSgpa = sgpas.length > 0 ? Math.max(...sgpas) : 0;
  const lowestSgpa = sgpas.length > 0 ? Math.min(...sgpas) : 0;
  const averageSgpa = sgpas.length > 0 ? parseFloat((sgpas.reduce((a, b) => a + b, 0) / sgpas.length).toFixed(2)) : 0;
  const medianSgpa = calculateMedian(sgpas);

  // Grade Distribution
  const gradeCounts: { [key: string]: number } = {};
  for (const sub of subjects) {
    gradeCounts[sub.grade] = (gradeCounts[sub.grade] || 0) + 1;
  }
  const gradeDistribution: GradeCount[] = Object.keys(gradeCounts)
    .map(grade => ({ grade, count: gradeCounts[grade] }))
    .sort((a, b) => b.count - a.count);

  // Credit Distribution
  const creditCounts: { [key: number]: number } = {};
  for (const s of students) {
    const cred = s.credits || 18;
    creditCounts[cred] = (creditCounts[cred] || 0) + 1;
  }
  const creditDistribution = Object.keys(creditCounts)
    .map(c => ({ credits: parseInt(c, 10), count: creditCounts[parseInt(c, 10)] }))
    .sort((a, b) => a.credits - b.credits);

  // Performance Distribution using prompt rules
  // Outstanding (>=9), Excellent (8-9), Very Good (7-8), Good (6-7), Average (5-6), Needs Improvement (<5)
  let outstanding = 0;
  let excellent = 0;
  let veryGood = 0;
  let good = 0;
  let average = 0;
  let needsImprovement = 0;

  for (const s of students) {
    const sgpa = s.sgpa;
    if (sgpa >= 9) outstanding++;
    else if (sgpa >= 8) excellent++;
    else if (sgpa >= 7) veryGood++;
    else if (sgpa >= 6) good++;
    else if (sgpa >= 5) average++;
    else needsImprovement++;
  }

  const performanceDistribution = [
    { level: 'Outstanding', count: outstanding },
    { level: 'Excellent', count: excellent },
    { level: 'Very Good', count: veryGood },
    { level: 'Good', count: good },
    { level: 'Average', count: average },
    { level: 'Needs Improvement', count: needsImprovement }
  ];

  // Subject Stats
  const subjectGroups: { [key: string]: { name: string; marks: number[]; pass: number; fail: number } } = {};
  for (const sub of subjects) {
    if (!subjectGroups[sub.subjectCode]) {
      subjectGroups[sub.subjectCode] = { name: sub.subjectName, marks: [], pass: 0, fail: 0 };
    }
    subjectGroups[sub.subjectCode].marks.push(sub.totalMarks);
    if (sub.status === 'Pass') {
      subjectGroups[sub.subjectCode].pass++;
    } else {
      subjectGroups[sub.subjectCode].fail++;
    }
  }

  const subjectStats: SubjectStats[] = Object.keys(subjectGroups).map(code => {
    const group = subjectGroups[code];
    const totalMarksList = group.marks;
    const avg = totalMarksList.length > 0 ? parseFloat((totalMarksList.reduce((a, b) => a + b, 0) / totalMarksList.length).toFixed(2)) : 0;
    const high = totalMarksList.length > 0 ? Math.max(...totalMarksList) : 0;
    const low = totalMarksList.length > 0 ? Math.min(...totalMarksList) : 0;

    return {
      subjectCode: code,
      subjectName: group.name,
      average: avg,
      highest: high,
      lowest: low,
      passCount: group.pass,
      failCount: group.fail,
      totalStudents: totalMarksList.length
    };
  });

  // Branch-wise stats
  const branchGroups: { [key: string]: { students: Student[] } } = {};
  for (const s of students) {
    if (!branchGroups[s.branch]) {
      branchGroups[s.branch] = { students: [] };
    }
    branchGroups[s.branch].students.push(s);
  }

  const branchStats: BranchStats[] = Object.keys(branchGroups).map(brName => {
    const brStudents = branchGroups[brName].students;
    const totalBr = brStudents.length;
    const passBr = brStudents.filter(s => s.resultStatus === 'Pass').length;
    const branchSgpas = brStudents.map(s => s.sgpa).filter(v => v > 0);
    const avgBrSgpa = branchSgpas.length > 0 ? parseFloat((branchSgpas.reduce((a, b) => a + b, 0) / branchSgpas.length).toFixed(2)) : 0;
    const passBrPerc = totalBr > 0 ? parseFloat(((passBr / totalBr) * 100).toFixed(2)) : 0;

    return {
      branch: brName,
      studentCount: totalBr,
      averageSgpa: avgBrSgpa,
      passPercentage: passBrPerc
    };
  });

  // Top 10 and Bottom 10
  const sortedStudentsBySgpa = [...students].sort((a, b) => b.sgpa - a.sgpa);
  const topStudents = sortedStudentsBySgpa.slice(0, 10);
  const bottomStudents = sortedStudentsBySgpa.slice(-10).reverse();

  return {
    totalStudents,
    passCount,
    failCount,
    ktCount,
    passPercentage,
    failPercentage,
    ktPercentage,
    highestSgpa,
    lowestSgpa,
    averageSgpa,
    medianSgpa,
    gradeDistribution,
    creditDistribution,
    performanceDistribution,
    subjectStats,
    branchStats,
    topStudents,
    bottomStudents
  };
}

/**
 * Calculates the ranks and returns individual reports for students.
 */
export function calculateStudentAnalysis(
  student: Student,
  allStudents: Student[],
  studentSubjects: SubjectMark[]
): StudentAnalysis {
  // Sort all students in descending order of SGPA to assign rank
  const sortedStudents = [...allStudents].sort((a, b) => b.sgpa - a.sgpa);
  
  // Find rank (1-indexed, handle duplicates gracefully by giving same rank)
  let rank = 1;
  for (let i = 0; i < sortedStudents.length; i++) {
    if (sortedStudents[i].sgpa > student.sgpa) {
      rank++;
    }
  }

  // Calculate percentile
  // Percentile = ((Total Students - Rank) / Total Students) * 100
  const totalCount = allStudents.length;
  const percentile = totalCount > 1 
    ? parseFloat((((totalCount - rank) / (totalCount - 1)) * 100).toFixed(2)) 
    : 100;

  const topperSgpa = sortedStudents[0]?.sgpa || 10;
  const averageSgpa = totalCount > 0 
    ? parseFloat((allStudents.reduce((sum, s) => sum + s.sgpa, 0) / totalCount).toFixed(2)) 
    : 0;

  const topperDifference = parseFloat((topperSgpa - student.sgpa).toFixed(2));
  const classAverageDifference = parseFloat((student.sgpa - averageSgpa).toFixed(2));

  // Determine Performance Level
  let performanceLevel: StudentAnalysis['performanceLevel'] = 'Needs Improvement';
  if (student.sgpa >= 9) performanceLevel = 'Outstanding';
  else if (student.sgpa >= 8) performanceLevel = 'Excellent';
  else if (student.sgpa >= 7) performanceLevel = 'Very Good';
  else if (student.sgpa >= 6) performanceLevel = 'Good';
  else if (student.sgpa >= 5) performanceLevel = 'Average';

  // Identify Strong and Weak Subjects
  const strongSubjects: string[] = [];
  const weakSubjects: string[] = [];
  let creditsEarned = 0;
  let creditsRemaining = 0;

  for (const sub of studentSubjects) {
    if (sub.grade === 'F' || sub.grade === 'F*' || sub.grade === 'AB') {
      weakSubjects.push(sub.subjectName);
      creditsRemaining += sub.credits;
    } else {
      creditsEarned += sub.credits;
      if (['O', 'A', 'B'].includes(sub.grade.toUpperCase())) {
        strongSubjects.push(sub.subjectName);
      } else if (sub.totalMarks < 45 || ['D', 'E', 'P'].includes(sub.grade.toUpperCase())) {
        weakSubjects.push(sub.subjectName);
      }
    }
  }

  // Deterministic rule-based recommendations
  const recommendations: string[] = [];

  if (student.sgpa >= 9) {
    recommendations.push('Maintain your outstanding performance! Consider participating in advanced research projects, paper publications, or specialized technical hackathons.');
    recommendations.push('Apply for high-tier academic fellowships or industrial internship opportunities.');
  } else if (student.sgpa >= 8) {
    recommendations.push('Excellent academic score! Keep up the fine momentum. Focus on building real-world software architectures or hands-on full-stack system structures.');
    recommendations.push('Review minor errors in exam papers to target an Outstanding GPA of 9.0+ next semester.');
  } else if (student.sgpa >= 7) {
    recommendations.push('Very good performance. Strengthening mathematical foundation concepts can help boost your scores further.');
    recommendations.push('Consider creating peer-learning groups or allocating structured hours daily for coding practice.');
  } else if (student.sgpa >= 5) {
    recommendations.push('Average grade performance. Needs focused action plan. Revise fundamental engineering concepts daily.');
    recommendations.push('Solve and practice previous 5-year university exam registers to boost confidence.');
  } else {
    recommendations.push('Urgent improvement needed. Meet with your academic counselor immediately to lay down a daily learning itinerary.');
    recommendations.push('Resolve all KT backlog papers on high priority before starting new semester coursework.');
  }

  // Specific subject checks
  for (const sub of studentSubjects) {
    const isMath = sub.subjectName.toLowerCase().includes('mathematics') || sub.subjectCode.toLowerCase().includes('mat') || sub.subjectCode.startsWith('FEC101');
    if (isMath && sub.totalMarks < 40) {
      recommendations.push(`Score in ${sub.subjectName} is below 40. Recommended to spend 1.5 hours daily on additional engineering Mathematics practice, differential equations, and calculus formulas.`);
    } else if (sub.grade === 'F') {
      recommendations.push(`Subject backlog in ${sub.subjectName}: Solve previous years KT papers and seek assistance from department peer mentors.`);
    } else if (sub.grade === 'AB') {
      recommendations.push(`Marked Absent in ${sub.subjectName}: Ensure medical certificate or necessary documentation is submitted to the controller of examinations.`);
    }
  }

  return {
    seatNo: student.seatNo,
    rank,
    percentile,
    topperDifference,
    classAverageDifference,
    performanceLevel,
    strongSubjects,
    weakSubjects,
    creditsEarned,
    creditsRemaining,
    recommendations
  };
}
