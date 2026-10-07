import * as XLSX from 'xlsx';
import { Student, SubjectMark, Analytics } from '../src/types';

type ComponentKey = 'TW' | 'TH' | 'IAT' | 'OR/PR' | 'TOTAL';

interface SubjectComponent {
  key: ComponentKey;
  max?: number;
}

interface SubjectLayout {
  title: string;
  components: SubjectComponent[];
}

type CellValue = string | number | null;

const KNOWN_SUBJECT_LAYOUTS: Record<string, SubjectLayout> = {
  '10521': {
    title: 'Applied Mathematics-II',
    components: [
      { key: 'TW', max: 25 },
      { key: 'TH', max: 60 },
      { key: 'IAT', max: 40 },
      { key: 'TOTAL' },
    ],
  },
  '10522': {
    title: 'Engineering Graphics',
    components: [
      { key: 'TH', max: 60 },
      { key: 'IAT', max: 40 },
      { key: 'TOTAL' },
    ],
  },
  '10523': {
    title: 'Data Structure',
    components: [
      { key: 'TH', max: 60 },
      { key: 'IAT', max: 40 },
      { key: 'TOTAL' },
    ],
  },
  '10532': {
    title: 'Engineering Graphics Lab',
    components: [
      { key: 'TW', max: 25 },
      { key: 'OR/PR', max: 25 },
      { key: 'TOTAL' },
    ],
  },
  '10533': {
    title: 'Data Structure Lab',
    components: [
      { key: 'TW', max: 25 },
      { key: 'OR/PR', max: 25 },
      { key: 'TOTAL' },
    ],
  },
  '10542': {
    title: 'Social Science & Community Services',
    components: [
      { key: 'TW', max: 25 },
      { key: 'TOTAL' },
    ],
  },
  '10543': {
    title: 'Indian Knowledge System',
    components: [
      { key: 'TW', max: 25 },
      { key: 'TOTAL' },
    ],
  },
  '10544': {
    title: 'Engineering Workshop-II',
    components: [
      { key: 'TW', max: 25 },
      { key: 'TOTAL' },
    ],
  },
  '10545': {
    title: 'Python Programming',
    components: [
      { key: 'TW', max: 25 },
      { key: 'OR/PR', max: 25 },
      { key: 'TOTAL' },
    ],
  },
  '10552': {
    title: 'Semiconductor Physics',
    components: [
      { key: 'TH', max: 45 },
      { key: 'IAT', max: 30 },
      { key: 'TOTAL' },
    ],
  },
  '10555': {
    title: 'Semiconductor Physics Lab',
    components: [
      { key: 'TW', max: 25 },
      { key: 'TOTAL' },
    ],
  },
  '10558': {
    title: 'Environmental Chemistry & Non-conventional Energy Sources',
    components: [
      { key: 'TH', max: 45 },
      { key: 'IAT', max: 30 },
      { key: 'TOTAL' },
    ],
  },
  '10561': {
    title: 'Environmental Chemistry & Non-conventional Energy Sources Lab',
    components: [
      { key: 'TW', max: 25 },
      { key: 'TOTAL' },
    ],
  },
};

function asNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function hasPositiveMark(value: unknown): boolean {
  return asNumber(value) > 0;
}

function firstNonEmpty(values: Array<string | undefined | null>, fallback: string): string {
  return values.find(value => typeof value === 'string' && value.trim().length > 0)?.trim() || fallback;
}

function formatComponentLabel(component: SubjectComponent): string {
  return component.max ? `${component.key} (${component.max})` : component.key;
}

function getMarkValue(subject: SubjectMark | undefined, componentKey: ComponentKey): string | number {
  if (!subject) return '';

  switch (componentKey) {
    case 'TW':
      return subject.termWork ?? '';
    case 'TH':
      return subject.externalMarks ?? '';
    case 'IAT':
      return subject.internalMarks ?? '';
    case 'OR/PR':
      return subject.practicalMarks ?? subject.oral ?? '';
    case 'TOTAL':
      return subject.totalMarks ?? '';
    default:
      return '';
  }
}

function getSubjectCodesInParserOrder(subjects: SubjectMark[]): string[] {
  const seen = new Set<string>();
  const orderedCodes: string[] = [];

  for (const subject of subjects) {
    if (!subject.subjectCode || seen.has(subject.subjectCode)) continue;
    seen.add(subject.subjectCode);
    orderedCodes.push(subject.subjectCode);
  }

  return orderedCodes;
}

function inferComponentsForSubject(marks: SubjectMark[]): SubjectComponent[] {
  const components: SubjectComponent[] = [];

  if (marks.some(mark => hasPositiveMark(mark.termWork))) {
    components.push({ key: 'TW' });
  }
  if (marks.some(mark => hasPositiveMark(mark.externalMarks))) {
    components.push({ key: 'TH' });
  }
  if (marks.some(mark => hasPositiveMark(mark.internalMarks))) {
    components.push({ key: 'IAT' });
  }
  if (marks.some(mark => hasPositiveMark(mark.practicalMarks) || hasPositiveMark(mark.oral))) {
    components.push({ key: 'OR/PR' });
  }

  components.push({ key: 'TOTAL' });
  return components.length > 1
    ? components
    : [{ key: 'TW' }, { key: 'TH' }, { key: 'IAT' }, { key: 'OR/PR' }, { key: 'TOTAL' }];
}

function buildSubjectLayouts(subjects: SubjectMark[]): Array<SubjectLayout & { code: string }> {
  return getSubjectCodesInParserOrder(subjects).map(code => {
    const matchingMarks = subjects.filter(subject => subject.subjectCode === code);
    const knownLayout = KNOWN_SUBJECT_LAYOUTS[code];

    return {
      code,
      title: firstNonEmpty(
        [matchingMarks[0]?.subjectName, knownLayout?.title],
        `Subject ${code}`
      ),
      components: knownLayout?.components ?? inferComponentsForSubject(matchingMarks),
    };
  });
}

function getStudentTotalMarks(studentSubjects: SubjectMark[]): number {
  return studentSubjects.reduce((sum, subject) => sum + asNumber(subject.totalMarks), 0);
}

// Excel sheet names can't exceed 31 characters, can't contain \ / ? * [ ] :,
// and can't be blank or duplicate an existing sheet name in the workbook.
function sanitizeSheetName(rawName: string, usedNames: Set<string>): string {
  let name = rawName.replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 31) || 'Division';
  let candidate = name;
  let suffix = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    const suffixText = ` (${suffix})`;
    candidate = `${name.slice(0, 31 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function buildResultRegisterSheet(
  students: Student[],
  subjects: SubjectMark[],
  uniqueSubjects: Array<SubjectLayout & { code: string }>
): XLSX.WorkSheet {
  const baseHeaders = [
    'SR.NO',
    'SEAT NO',
    'NAME OF STUDENT',
    'BRANCH',
    'SGPA',
    'CGPA',
    'KT / BACKLOG COUNT',
    'TOTAL MARKS',
  ];

  const rows: CellValue[][] = [];
  const headerRow: CellValue[] = [...baseHeaders];
  const componentRow: CellValue[] = Array(baseHeaders.length).fill(null);

  uniqueSubjects.forEach(subject => {
    headerRow.push(subject.title);
    for (let i = 1; i < subject.components.length; i += 1) {
      headerRow.push(null);
    }
    subject.components.forEach(component => {
      componentRow.push(formatComponentLabel(component));
    });
  });

  rows.push(headerRow);
  rows.push(componentRow);

  students.forEach((student, index) => {
    const studentSubjects = subjects.filter(subject => subject.seatNo === student.seatNo);
    const row: CellValue[] = [
      index + 1,
      student.seatNo,
      student.name,
      student.branch,
      student.sgpa,
      student.cgpa,
      student.ktCount,
      getStudentTotalMarks(studentSubjects),
    ];

    uniqueSubjects.forEach(subject => {
      const subjectMark = studentSubjects.find(mark => mark.subjectCode === subject.code);
      subject.components.forEach(component => {
        row.push(getMarkValue(subjectMark, component.key));
      });
    });

    rows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> =
    baseHeaders.map((_, columnIndex) => ({
      s: { r: 0, c: columnIndex },
      e: { r: 1, c: columnIndex },
    }));

  let startCol = baseHeaders.length;
  uniqueSubjects.forEach(subject => {
    const span = subject.components.length;
    if (span > 1) {
      merges.push({ s: { r: 0, c: startCol }, e: { r: 0, c: startCol + span - 1 } });
    }
    startCol += span;
  });

  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 7 },
    { wch: 12 },
    { wch: 32 },
    { wch: 24 },
    { wch: 8 },
    { wch: 8 },
    { wch: 18 },
    { wch: 12 },
    ...uniqueSubjects.flatMap(subject =>
      subject.components.map(component => ({
        wch: component.key === 'OR/PR' ? 12 : component.key === 'TOTAL' ? 10 : 9,
      }))
    ),
  ];

  if (rows.length > 2 && rows[0].length > 0) {
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 1, c: 0 },
        e: { r: rows.length - 1, c: rows[0].length - 1 },
      }),
    };
  }

  return ws;
}

export function exportToExcel(students: Student[], subjects: SubjectMark[], analytics: Analytics): Buffer {
  const wb = XLSX.utils.book_new();
  const uniqueSubjects = buildSubjectLayouts(subjects);

  XLSX.utils.book_append_sheet(wb, buildResultRegisterSheet(students, subjects, uniqueSubjects), 'Result Register');

  // If a division mapping has been uploaded, add one additional sheet per
  // division (each with the same column layout as the main register), so
  // e.g. a class teacher for Sec-B can go straight to their own sheet
  // instead of filtering the full register by hand.
  const studentsWithDivision = students.filter(s => s.division && s.division.trim() !== '');
  if (studentsWithDivision.length > 0) {
    const divisionGroups = new Map<string, Student[]>();
    for (const student of students) {
      const key = student.division && student.division.trim() !== '' ? student.division.trim() : 'Unassigned';
      if (!divisionGroups.has(key)) divisionGroups.set(key, []);
      divisionGroups.get(key)!.push(student);
    }

    const usedSheetNames = new Set<string>(['result register', 'analytics']);
    const sortedDivisionNames = [...divisionGroups.keys()].sort((a, b) => {
      if (a === 'Unassigned') return 1;
      if (b === 'Unassigned') return -1;
      return a.localeCompare(b, undefined, { numeric: true });
    });

    for (const divisionName of sortedDivisionNames) {
      const divisionStudents = divisionGroups.get(divisionName)!;
      const sheetName = sanitizeSheetName(divisionName, usedSheetNames);
      XLSX.utils.book_append_sheet(
        wb,
        buildResultRegisterSheet(divisionStudents, subjects, uniqueSubjects),
        sheetName
      );
    }
  }

  const analyticsData = [
    ['Metric', 'Value'],
    ['Total Students', analytics.totalStudents],
    ['Pass Count', analytics.passCount],
    ['Fail Count', analytics.failCount],
    ['KT Count', analytics.ktCount],
    ['Pass Percentage', analytics.passPercentage],
    ['Fail Percentage', analytics.failPercentage],
    ['KT Percentage', analytics.ktPercentage],
    ['Highest SGPA', analytics.highestSgpa],
    ['Lowest SGPA', analytics.lowestSgpa],
    ['Average SGPA', analytics.averageSgpa],
    ['Median SGPA', analytics.medianSgpa],
  ];

  const wsAnalytics = XLSX.utils.aoa_to_sheet(analyticsData);
  wsAnalytics['!cols'] = [{ wch: 24 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsAnalytics, 'Analytics');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function exportToCsv(students: Student[], subjects: SubjectMark[] = []): string {
  const uniqueSubjects = buildSubjectLayouts(subjects);
  const baseHeader = [
    'Seat No',
    'Roll No',
    'Name',
    'Mother Name',
    'Enrollment No',
    'Branch',
    'Semester',
    'SGPA',
    'CGPA',
    'Credits',
    'KT Count',
    'Total Marks',
  ];

  const subjectHeader = uniqueSubjects.flatMap(subject =>
    subject.components.map(component => `${subject.code} ${component.key}`)
  );

  const rows = students.map(student => {
    const studentSubjects = subjects.filter(subject => subject.seatNo === student.seatNo);
    const studentRow: Array<string | number> = [
      student.seatNo,
      student.rollNo,
      student.name,
      student.motherName,
      student.enrollmentNo,
      student.branch,
      student.semester,
      student.sgpa,
      student.cgpa,
      student.credits,
      student.ktCount,
      getStudentTotalMarks(studentSubjects),
    ];

    uniqueSubjects.forEach(subject => {
      const subjectMark = studentSubjects.find(mark => mark.subjectCode === subject.code);
      subject.components.forEach(component => {
        studentRow.push(getMarkValue(subjectMark, component.key));
      });
    });

    return studentRow;
  });

  const escapeValue = (value: unknown) => {
    const stringValue = value === null || value === undefined ? '' : String(value);
    const needsQuotes = /[",\n]/.test(stringValue);
    const escapedValue = stringValue.replace(/"/g, '""');
    return needsQuotes ? `"${escapedValue}"` : escapedValue;
  };

  const csvRows = [[...baseHeader, ...subjectHeader], ...rows].map(row =>
    row.map(escapeValue).join(',')
  );
  return csvRows.join('\n');
}
