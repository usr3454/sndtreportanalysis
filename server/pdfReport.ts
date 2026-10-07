import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Student, SubjectMark, StudentAnalysis, Analytics } from '../src/types';

/**
 * Generates a clean, professional individual student report card PDF.
 */
export function generateIndividualReportPdf(
  student: Student,
  subjects: SubjectMark[],
  analysis: StudentAnalysis
): Buffer {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [30, 41, 59]; // Slate 800
  const accentColor = [14, 165, 233]; // Sky 500

  // 1. Header Banner
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('UNIVERSAL RESULT ANALYZER', 15, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(186, 230, 253);
  doc.text('ACADEMIC PERFORMANCE RECORD & DIAGNOSTIC CARD', 15, 26);
  doc.text(`SEMESTER: ${student.semester} | BRANCH: ${student.branch.toUpperCase()}`, 15, 32);

  // 2. Profile Summary Grid
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('STUDENT PROFILE', 15, 52);
  doc.setDrawColor(226, 232, 240);
  doc.line(15, 55, 195, 55);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  // Left column
  doc.setFont('helvetica', 'bold'); doc.text('Student Name:', 15, 63); doc.setFont('helvetica', 'normal'); doc.text(student.name, 45, 63);
  doc.setFont('helvetica', 'bold'); doc.text('Seat Number:', 15, 69); doc.setFont('helvetica', 'normal'); doc.text(student.seatNo, 45, 69);
  doc.setFont('helvetica', 'bold'); doc.text('Roll Number:', 15, 75); doc.setFont('helvetica', 'normal'); doc.text(student.rollNo || 'N/A', 45, 75);

  // Right column
  doc.setFont('helvetica', 'bold'); doc.text('Semester:', 115, 63); doc.setFont('helvetica', 'normal'); doc.text(student.semester, 145, 63);
  doc.setFont('helvetica', 'bold'); doc.text('Backlogs / KT:', 115, 69); doc.setFont('helvetica', 'normal'); doc.text(student.ktCount.toString(), 145, 69);

  // 3. Performance Metrics Callout Boxes
  // Box 1: SGPA
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, 83, 40, 24, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.text('SEMESTER SGPA', 20, 90);
  doc.setFontSize(18); doc.setTextColor(14, 165, 233); doc.text(student.sgpa.toFixed(2), 20, 101);

  // Box 2: CGPA
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(60, 83, 40, 24, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.text('CUMULATIVE CGPA', 65, 90);
  doc.setFontSize(18); doc.setTextColor(15, 23, 42); doc.text(student.cgpa.toFixed(2), 65, 101);

  // Box 3: Rank
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(105, 83, 40, 24, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.text('CLASS RANK', 110, 90);
  doc.setFontSize(18); doc.setTextColor(16, 185, 129); doc.text(`#${analysis.rank}`, 110, 101);

  // Box 4: Percentile
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(150, 83, 45, 24, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.text('PERCENTILE', 155, 90);
  doc.setFontSize(16); doc.setTextColor(15, 23, 42); doc.text(`${analysis.percentile}%`, 155, 101);

  // 4. Subject Marks Table
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('ACADEMIC COURSE DETAILED BREAKDOWN', 15, 120);

  const tableHeaders = [['Subject Code', 'Subject Name', 'Internal', 'External', 'Total Marks', 'Credits', 'Grade', 'Status']];
  const tableRows = subjects.map(sub => [
    sub.subjectCode,
    sub.subjectName,
    sub.internalMarks ?? '-',
    sub.externalMarks ?? '-',
    sub.totalMarks ?? '-',
    sub.credits,
    sub.grade,
    sub.status
  ]);

  autoTable(doc, {
    startY: 124,
    head: tableHeaders,
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8.5 },
    columnStyles: {
      1: { cellWidth: 55 }, // Limit subject name width
    },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 7) {
        if (data.cell.raw === 'Fail' || data.cell.raw === 'Absent') {
          data.cell.styles.textColor = [239, 68, 68]; // Red
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [16, 185, 129]; // Emerald
          data.cell.styles.fontStyle = 'bold';
        }
      }
    }
  });

  // 5. Diagnostic Recommendations & Analysis
  let nextY = (doc as any).lastAutoTable.finalY + 12;

  // Ensure there is enough vertical space for recommendations, otherwise make a new page
  if (nextY + 70 > 297) {
    doc.addPage();
    nextY = 20;
  }

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('DETERMINISTIC DIAGNOSIS & REMEDIAL ROADMAP', 15, nextY);
  doc.setDrawColor(226, 232, 240);
  doc.line(15, nextY + 3, 195, nextY + 3);

  // Recommendations
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);

  let recY = nextY + 10;
  analysis.recommendations.forEach((rec, rIdx) => {
    // Draw list bullet
    doc.setFillColor(14, 165, 233);
    doc.circle(18, recY - 1.2, 1, 'F');
    
    // Split recommendation to fit within lines
    const splitRec = doc.splitTextToSize(rec, 172);
    doc.text(splitRec, 23, recY);
    recY += (splitRec.length * 4.5) + 2.5;
  });

  // Footer metadata
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.text(`Report Generated: ${new Date().toLocaleDateString()} | System Ident: CLASS-REPORT-${student.seatNo}`, 15, 285);

  return Buffer.from(doc.output('arraybuffer'));
}

/**
 * Generates a clean, comprehensive PDF registrar for the complete class.
 */
export function generateClassPdf(students: Student[], analytics: Analytics): Buffer {
  const doc = new jsPDF({
    orientation: 'l', // Landscape
    unit: 'mm',
    format: 'a4'
  });

  // Title Page / Header
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 297, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('UNIVERSAL RESULT ANALYZER - COMPLETE CLASS REGISTRY', 15, 13);
  doc.setFontSize(9);
  doc.setTextColor(186, 230, 253);
  doc.text(`TOTAL CLASS SIZE: ${analytics.totalStudents} STUDENTS | PASS %: ${analytics.passPercentage}% | CLASS AVERAGE SGPA: ${analytics.averageSgpa}`, 15, 22);

  // Student listing table
  const tableHeaders = [['Rank', 'Seat No', 'Roll No', 'Name', 'Branch', 'Sem', 'SGPA', 'CGPA', 'Status', 'Backlogs']];
  const tableRows = students.map((s, idx) => [
    idx + 1,
    s.seatNo,
    s.rollNo || '-',
    s.name,
    s.branch,
    s.semester,
    s.sgpa.toFixed(2),
    s.cgpa.toFixed(2),
    s.resultStatus,
    s.ktCount
  ]);

  autoTable(doc, {
    startY: 38,
    head: tableHeaders,
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
    columnStyles: {
      3: { cellWidth: 60 }, // Name width
      4: { cellWidth: 50 }  // Branch width
    },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 9) {
        if (data.cell.raw === 'Fail' || data.cell.raw === 'KT') {
          data.cell.styles.textColor = [239, 68, 68];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [16, 185, 129];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    }
  });

  return Buffer.from(doc.output('arraybuffer'));
}
