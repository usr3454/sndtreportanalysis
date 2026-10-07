import { jsPDF } from 'jspdf';

// Mock list of names to generate realistic student lists
const MOCK_NAMES = [
  'ADHIRE PRIYA SHIVAJI',
  'BANSAL RAHUL SUBHASH',
  'CHAVAN AMIT RAMESH',
  'DESHMUKH SANJANA SANJAY',
  'FERNANDES ALSTON JOHN',
  'GUPTA AYUSH SANDEEP',
  'IYER SHREYA VENKAT',
  'JOSHI PRANAV MILIND',
  'KULKARNI SAKSHI RAJIV',
  'MEHTA HARSH RAJESH',
  'NAIR ARJUN UNNIKRISHNAN',
  'PATIL SWAPNIL DNYANESHWAR',
  'QURESHI ARBAZ SALIM',
  'RANE TANVI ANANT',
  'SAWANT PRATHAMESH SUDHIR',
  'TRIPATHI ANANYA ASHOK',
  'VERMA RISHABH VIJAY',
  'YADAV RAHUL RAMESH',
  'DESHPANDE ADITYA ARVIND',
  'SHAH NIDHI JIGAR',
  'GAIKWAD OMKAR PRADIP',
  'THAKUR MANASI VINAYAK',
  'PANDYA HARDIK JAYESH',
  'SINGH PRIYANKA RAJENDRA',
  'SHARMA DEEPAK KAILASH',
  'MORE SNEHAL SUNIL',
  'KADAM TEJAS ANIL',
  'DSOUZA VIANNE FRANCIS',
  'MISHRA ADITI RAKESH',
  'CHOUDHARY AMAN DILIP'
];

const MOCK_MOTHERS = [
  'SAVITA', 'REKHA', 'SANGEETA', 'MANISHA', 'MARY', 'SEEMA', 'LALITHA', 'ANJALI', 'SUDHA', 'KIRAN',
  'BINDHU', 'SMITA', 'SULTANA', 'VASUDHA', 'SUREKHA', 'MEENA', 'SHOBHA', 'PUSHPA', 'NEETA', 'HEMA'
];

const BRANCHES = [
  { name: 'Computer Engineering', code: 'COMP' },
  { name: 'Information Technology', code: 'IT' },
  { name: 'Electronics & Telecom', code: 'EXTC' }
];

/**
 * Generates a realistic university result PDF.
 */
export function generateSamplePdf(studentCount: number = 50): Buffer {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });

  // Setup monospace font for layout integrity
  doc.setFont('Courier');
  doc.setFontSize(8);

  const linesPerPage = 38;
  let currentLine = 1;
  let page = 1;

  const addHeader = (branchName: string) => {
    doc.text(`OFFICE REGISTER FOR THE B.E. DEGREE (${branchName.toUpperCase()}) SEMESTER VII EXAMINATION HELD IN MAY 2026`, 10, 10);
    doc.text(`COLLEGE: 123 ENGINEERING COLLEGE`, 10, 14);
    doc.text('-'.repeat(110), 10, 18);
    doc.text('SEAT_NO  NAME OF CANDIDATE                              MOTHER_NAME', 10, 22);
    doc.text('         PRN NO.                COLLEGE', 10, 26);
    doc.text('         <-- Course I -->  <-- Course II -->  <-- Course III -->  <-- Course IV -->  <-- Course V -->', 10, 30);
    doc.text('         In Ex Tot Gr Cr   In Ex Tot Gr Cr    In Ex Tot Gr Cr     In Ex Tot Gr Cr    In Ex Tot Gr Cr', 10, 34);
    doc.text('-'.repeat(110), 10, 38);
    currentLine = 11; // Line number offset in mm
  };

  const selectedBranch = BRANCHES[0]; // Computer Engineering
  addHeader(selectedBranch.name);

  // Generate students
  for (let idx = 0; idx < studentCount; idx++) {
    const seatNo = (5012301 + idx).toString();
    const nameIndex = idx % MOCK_NAMES.length;
    const isFemale = nameIndex % 2 === 0;
    const studentName = (isFemale ? '/' : '') + MOCK_NAMES[nameIndex];
    const motherName = MOCK_MOTHERS[idx % MOCK_MOTHERS.length];
    const prn = `202101640123${(1000 + idx).toString()}`;
    const collegeCode = `123 ${selectedBranch.code}`;

    // Subject marks generator
    // Determine overall student quality
    const performanceSeed = idx % 5; // 0: Outstanding, 1: Excellent, 2: Pass/Good, 3: KT, 4: Fail
    let sgpa = 0;
    let cgpa = 0;
    let resultText = 'Result: PASS';

    const subsData: string[] = [];
    let backlogs = 0;
    let totalGradePoints = 0;
    let totalCredits = 18;

    const subjectsList = ['CSC701', 'CSC702', 'CSC703', 'FEC101', 'FEC102'];
    subjectsList.forEach((subCode, sIdx) => {
      let internal = 0;
      let external = 0;
      let total = 0;
      let grade = 'C';
      let subCredits = sIdx < 3 ? 4 : 3;
      let gradePoint = 7;

      if (performanceSeed === 0) { // Outstanding
        internal = Math.floor(Math.random() * 5) + 16; // 16 - 20
        external = Math.floor(Math.random() * 20) + 60; // 60 - 80
        total = internal + external;
        if (total >= 80) { grade = 'O'; gradePoint = 10; }
        else { grade = 'A'; gradePoint = 9; }
      } else if (performanceSeed === 1) { // Excellent
        internal = Math.floor(Math.random() * 5) + 14; // 14 - 18
        external = Math.floor(Math.random() * 20) + 50; // 50 - 70
        total = internal + external;
        if (total >= 70) { grade = 'A'; gradePoint = 9; }
        else { grade = 'B'; gradePoint = 8; }
      } else if (performanceSeed === 2) { // Good/Average
        internal = Math.floor(Math.random() * 6) + 10; // 10 - 15
        external = Math.floor(Math.random() * 20) + 32; // 32 - 52
        total = internal + external;
        if (total >= 60) { grade = 'B'; gradePoint = 8; }
        else if (total >= 50) { grade = 'C'; gradePoint = 7; }
        else { grade = 'D'; gradePoint = 6; }
      } else if (performanceSeed === 3) { // KT (1 backlog)
        if (sIdx === 0) {
          internal = 6;
          external = 18;
          total = 24;
          grade = 'F';
          gradePoint = 0;
          backlogs++;
        } else {
          internal = 12;
          external = 42;
          total = 54;
          grade = 'C';
          gradePoint = 7;
        }
      } else { // Fail (2 backlogs)
        if (sIdx < 2) {
          internal = 5;
          external = 15;
          total = 20;
          grade = 'F';
          gradePoint = 0;
          backlogs++;
        } else {
          internal = 11;
          external = 36;
          total = 47;
          grade = 'D';
          gradePoint = 6;
        }
      }

      totalGradePoints += gradePoint * subCredits;
      
      const inStr = internal.toString().padStart(2, '0');
      const exStr = external.toString().padStart(2, '0');
      const totStr = total.toString().padStart(2, '0');
      subsData.push(`${inStr} ${exStr}  ${totStr}  ${grade}  ${subCredits}`);
    });

    if (backlogs > 0) {
      sgpa = parseFloat((totalGradePoints / totalCredits).toFixed(2));
      cgpa = parseFloat((sgpa * 0.9 + 0.5).toFixed(2));
      resultText = `Result: KT (${backlogs})`;
    } else {
      sgpa = parseFloat((totalGradePoints / totalCredits).toFixed(2));
      cgpa = parseFloat((sgpa * 0.95 + 0.2).toFixed(2));
      resultText = 'Result: PASS';
    }

    // Check if new page is needed
    if (currentLine + 22 > 280) {
      doc.addPage();
      page++;
      addHeader(selectedBranch.name);
    }

    // Write student text block
    doc.text(`${seatNo.padEnd(9)} ${studentName.padEnd(46)} ${motherName}`, 10, currentLine + 32);
    doc.text(`         ${prn.padEnd(23)} ${collegeCode}`, 10, currentLine + 36);
    
    // Subjects row
    doc.text(`         ${subjectsList[0]}             ${subjectsList[1]}             ${subjectsList[2]}             ${subjectsList[3]}             ${subjectsList[4]}`, 10, currentLine + 40);
    doc.text(`         ${subsData[0]}   ${subsData[1]}   ${subsData[2]}   ${subsData[3]}   ${subsData[4]}`, 10, currentLine + 44);
    
    // Summary row
    doc.text(`         SGPA: ${sgpa.toFixed(2).padEnd(8)} CGPA: ${cgpa.toFixed(2).padEnd(8)} Total Credits: ${totalCredits.toString().padEnd(4)} ${resultText}`, 10, currentLine + 48);
    doc.text('-'.repeat(110), 10, currentLine + 52);

    currentLine += 24; // offset for next student block
  }

  return Buffer.from(doc.output('arraybuffer'));
}
