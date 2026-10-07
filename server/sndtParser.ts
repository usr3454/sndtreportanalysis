import type { Student, SubjectMark } from '../src/types.ts';

/**
 * Parser for SNDT Women's University "Result Ledger" PDFs (NEP / credit
 * pattern, e.g. "Bachelor of Arts (Music) - Semester II").
 *
 * Layout of one ledger (one student per page):
 *
 *   Full Name : <NAME> Mother Name : <MOTHER> Seat No : <n> Center : <c> PRN : <prn> Medium : <m>
 *   College : <code>: <college name>
 *   <course rows for the earlier semester, App flag "x">
 *   Semester I  Earned Credits: .. Total EGP: .. SGPA: .. Grade : .. Total: ../550 Percentage : ..
 *   <course rows for the current semester, App flag "c">
 *   Semester II Earned Credits: .. Total EGP: .. SGPA: .. Grade : .. Total: ../550 Percentage : ..
 *   Total Earned Credits: .. Total EGP: .. CGPA: .. Final Grade: ..
 *   Grand Total: ../1100 Equivalent Percentage: .. Result: Pass|ATKT|Fail|AB
 *
 * Course row columns:
 *   code, name (may wrap over several lines), AM, INT (min/max obt | "-- --"),
 *   EXT (min/max obt | "-- --"), course max, total obtained (number | FF | AB),
 *   [grace], total "x/max" ("--" for FF), credits, grade, grade point, EGP, App
 *
 * Special obtained-mark tokens: Ab = absent, NP = not permitted (because the
 * internal part was missed), RR = result reserved, FF = failed (marks hidden).
 */

export interface SndtMetadata {
  branch: string;
  semester: string;
}

export interface SndtParseResult {
  students: Student[];
  subjects: SubjectMark[];
  errors: string[];
}

export function isSndtLedgerText(text: string): boolean {
  return (
    /SNDT\s+WOMEN'?S\s+UNIVERSITY/i.test(text) &&
    /Full\s+Name\s*:/i.test(text) &&
    /Seat\s+No\s*:/i.test(text) &&
    /Earned\s+Credits\s*:/i.test(text)
  );
}

export function extractSndtMetadata(text: string): SndtMetadata {
  const match = text.match(/^\s*(Bachelor|Master|Post\s+Graduate)[^\n-]*?\s*-\s*Semester\s+([IVX]+|\d+)\b/im);
  if (!match) return { branch: 'Unknown', semester: 'Unknown' };
  const branch = match[0]
    .replace(/\s*-\s*Semester\s+([IVX]+|\d+)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { branch, semester: match[2].toUpperCase() };
}

// ---------------------------------------------------------------------------
// Row parsing
// ---------------------------------------------------------------------------

// One assessment component: "-- --" (not applicable) or "<min> / <max> <obt>".
const COMPONENT = String.raw`(?:--\s+--|\d+\s*/\s*\d+\s+(?:\d+|Ab|AB|NP|RR))`;

const COURSE_ROW_REGEX = new RegExp(
  String.raw`\b(\d{8})\s+` + // course code
    String.raw`((?:(?!\b\d{8}\b)[\s\S])+?)\s+` + // course name (never crosses into another course code)
    String.raw`(TH|PV|PR|TW|OR)\s+` + // assessment method
    String.raw`(${COMPONENT})\s+` + // INT
    String.raw`(${COMPONENT})\s+` + // EXT
    String.raw`(\d+)\s+` + // course max marks
    String.raw`(\d+|FF|AB)` + // total obtained
    String.raw`(?:\s+(\d+))?\s+` + // optional grace marks
    String.raw`((?:\d+|Ab|AB)\s*/\s*\d+|--)\s+` + // "obt/max" total
    String.raw`(\d+)\s+` + // credits
    String.raw`(O\+|O|A\+|A|B\+|B|C|P|F)\s+` + // grade
    String.raw`(\d+(?:\.\d+)?)\s+` + // grade point
    String.raw`(\d+(?:\.\d+)?)\s+` + // earned grade points
    String.raw`([xc])\b`, // past (x) / current (c) performance
  'g'
);

const SEMESTER_SUMMARY_REGEX =
  /Semester\s+([IVX]+|\d+)\s+Earned\s+Credits\s*:\s*(\d+)\s+Total\s+EGP\s*:\s*(--|\d+(?:\.\d+)?)\s+SGPA\s*:\s*(--|\d+(?:\.\d+)?)\s+Grade\s*:\s*(\S+)\s+Total\s*:\s*(--|\d+\s*\/\s*\d+)\s+Percentage\s*:\s*(--|\d+(?:\.\d+)?)/g;

const CUMULATIVE_REGEX =
  /Total\s+Earned\s+Credits\s*:\s*(\d+)\s+Total\s+EGP\s*:\s*(--|\d+(?:\.\d+)?)\s+CGPA\s*:\s*(--|\d+(?:\.\d+)?)\s+Final\s+Grade\s*:\s*(\S+)\s+(?:Cumulative\s+)?Grand\s+Total\s*:\s*(--|\d+\s*\/\s*\d+)\s+Equivalent\s+Percentage\s*:\s*(--|\d+(?:\.\d+)?)\s+Result\s*:\s*(\w+)/i;

const LEDGER_HEADER_REGEX =
  /Full\s+Name\s*:\s*(.+?)\s+Mother\s+Name\s*:\s*(.*?)\s+Seat\s+No\s*:\s*(\d+)\s+Center\s*:\s*(\S*)\s+PRN\s*:\s*(\d*)\s+Medium\s*:\s*(\S*)/i;

const COLLEGE_REGEX = /College\s*:\s*(\d+)\s*:\s*(.+?)(?=\s+INT\s+EXT\b|\s+Course\s+Code\b|$)/i;

// Page furniture that repeats on every ledger page. Dropping it keeps it from
// being glued onto the end of whatever follows it.
const BOILERPLATE_LINE_PATTERNS: RegExp[] = [
  /^SNDT\s+WOMEN'?S\s+UNIVERSITY/i,
  /^(Bachelor|Master|Post\s+Graduate)\b.*-\s*Semester\s+[IVX\d]+\s*$/i,
  /^\(.*PATTERN.*\)\s*EXAMINATION/i,
  /^Result\s+Date\s*:/i,
  /^DIRECTOR\s*$/i,
  /^PRINCIPAL\b.*Board\s+of\s+Examinations/i,
  /^INT\s+EXT\s+Total\s*$/i,
  /^Course\s+Code\s+Course\s+Name\s+AM\s*$/i,
  /^Min\/\s*Max\s+Obt\b/i,
  /^Grace\s*$/i,
  /^Total\s*$/i,
  /^\(100\)\s*$/i,
  /^Cr\s+Gr\s+GP\s+EGP\s+App\s*$/i,
];

type MarkToken = number | 'Ab' | 'NP' | 'RR' | null;

interface ParsedComponent {
  obtained: MarkToken; // null => component does not apply to this course
  max: number | null;
}

function parseComponent(raw: string): ParsedComponent {
  if (/^--/.test(raw.trim())) return { obtained: null, max: null };
  const match = raw.match(/(\d+)\s*\/\s*(\d+)\s+(\S+)/);
  if (!match) return { obtained: null, max: null };
  const token = match[3];
  let obtained: MarkToken;
  if (/^ab$/i.test(token)) obtained = 'Ab';
  else if (/^np$/i.test(token)) obtained = 'NP';
  else if (/^rr$/i.test(token)) obtained = 'RR';
  else obtained = Number(token);
  return { obtained, max: Number(match[2]) };
}

const numeric = (token: MarkToken): number => (typeof token === 'number' ? token : 0);

interface RawCourseRow {
  code: string;
  name: string;
  method: string;
  internal: ParsedComponent;
  external: ParsedComponent;
  courseMax: number;
  totalToken: string; // number | FF | AB
  grace: number;
  credits: number;
  grade: string;
  gradePoint: number;
  egp: number;
  app: 'x' | 'c';
  index: number; // position in the ledger text, used to assign the row to a semester
}

function cleanCourseName(raw: string): string {
  return raw.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
}

function toSubjectMark(row: RawCourseRow, seatNo: string, uploadId: string, nameSuffix: string): SubjectMark {
  const isPracticalOnly = row.method === 'PV' || row.method === 'PR' || row.method === 'OR';
  const components = [row.internal.obtained, row.external.obtained];

  const absent =
    row.totalToken === 'AB' || components.some(token => token === 'Ab' || token === 'NP');

  const componentSum = components.reduce<number>((sum, token) => sum + numeric(token), 0);
  const totalMarks = /^\d+$/.test(row.totalToken) ? Number(row.totalToken) : absent ? 0 : componentSum;

  // PV/PR courses are assessed as a practical/viva; the single marks column
  // they use is reported as practical/oral marks rather than internal/external.
  const internalMarks = isPracticalOnly ? 0 : numeric(row.internal.obtained);
  const externalMarks = isPracticalOnly ? 0 : numeric(row.external.obtained);
  const practicalMarks = isPracticalOnly ? componentSum : 0;

  const failed = row.grade === 'F';
  let status: SubjectMark['status'] = 'Pass';
  let grade = row.grade;
  if (absent) {
    status = 'Absent';
    grade = 'AB'; // matches the 'AB' handling already used by analytics
  } else if (failed) {
    status = 'Fail';
  }

  return {
    seatNo,
    uploadId,
    subjectCode: row.code,
    subjectName: `${row.name}${nameSuffix}`,
    internalMarks,
    externalMarks,
    practicalMarks,
    termWork: 0,
    oral: isPracticalOnly ? practicalMarks : 0,
    totalMarks,
    credits: row.credits,
    grade,
    status,
  };
}

// ---------------------------------------------------------------------------
// Ledger splitting
// ---------------------------------------------------------------------------

function splitLedgers(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const ledgers: string[][] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    if (/^Full\s+Name\s*:/i.test(line)) {
      current = [line];
      ledgers.push(current);
      continue;
    }
    if (!current) continue; // course catalogue / grading tables before the first student
    if (BOILERPLATE_LINE_PATTERNS.some(pattern => pattern.test(line))) continue;
    current.push(line);
  }

  return ledgers.map(ledger => ledger.join(' '));
}

// ---------------------------------------------------------------------------
// One ledger -> student + subjects
// ---------------------------------------------------------------------------

const toNumberOrZero = (value: string | undefined): number =>
  value && value !== '--' && Number.isFinite(Number(value)) ? Number(value) : 0;

function mapResult(result: string | undefined, rows: RawCourseRow[]): Student['resultStatus'] {
  switch ((result || '').toUpperCase()) {
    case 'PASS':
      return 'Pass';
    case 'ATKT':
      return 'KT';
    case 'FAIL':
    case 'AB':
      return 'Fail';
    default:
      // No printed result: derive it from the rows.
      return rows.some(row => row.grade === 'F') ? 'KT' : 'Pass';
  }
}

export function parseSndtLedger(
  ledgerText: string,
  uploadId: string,
  metadata: SndtMetadata
): { student: Student; subjects: SubjectMark[]; warnings: string[] } | null {
  const header = ledgerText.match(LEDGER_HEADER_REGEX);
  if (!header) return null;

  const [, rawName, rawMother, seatNo, , prn] = header;
  const warnings: string[] = [];

  const college = ledgerText.match(COLLEGE_REGEX);

  // Course rows
  const rows: RawCourseRow[] = [];
  for (const m of ledgerText.matchAll(COURSE_ROW_REGEX)) {
    rows.push({
      code: m[1],
      name: cleanCourseName(m[2]),
      method: m[3].toUpperCase(),
      internal: parseComponent(m[4]),
      external: parseComponent(m[5]),
      courseMax: Number(m[6]),
      totalToken: m[7].toUpperCase(),
      grace: m[8] ? Number(m[8]) : 0,
      credits: Number(m[10]),
      grade: m[11],
      gradePoint: Number(m[12]),
      egp: Number(m[13]),
      app: m[14] as 'x' | 'c',
      index: m.index ?? 0,
    });
  }

  // Every 8-digit course code in the ledger should have produced a row.
  const codesSeen = new Set(Array.from(ledgerText.matchAll(/\b\d{8}\b/g)).map(m => m[0]));
  const codesParsed = new Set(rows.map(row => row.code));
  const missing = [...codesSeen].filter(code => !codesParsed.has(code));
  if (missing.length > 0) {
    warnings.push(`Seat ${seatNo}: could not parse course row(s) ${missing.join(', ')}.`);
  }

  // Semester summaries delimit which rows belong to which semester.
  const summaries = Array.from(ledgerText.matchAll(SEMESTER_SUMMARY_REGEX)).map(m => ({
    index: m.index ?? 0,
    label: m[1].toUpperCase(),
    earnedCredits: Number(m[2]),
    sgpa: toNumberOrZero(m[4]),
  }));

  const semesterOfRow = (row: RawCourseRow): number => {
    const idx = summaries.findIndex(summary => row.index < summary.index);
    return idx === -1 ? Math.max(summaries.length - 1, 0) : idx;
  };
  const currentSemesterIndex = Math.max(summaries.length - 1, 0);
  const currentSummary = summaries[currentSemesterIndex];

  const cumulative = ledgerText.match(CUMULATIVE_REGEX);

  // Subjects: everything in the current semester, plus anything not passed
  // in earlier semesters (those are the student's carried-over backlogs).
  const subjects: SubjectMark[] = [];
  for (const row of rows) {
    const semIdx = semesterOfRow(row);
    if (semIdx === currentSemesterIndex) {
      subjects.push(toSubjectMark(row, seatNo, uploadId, ''));
    } else if (row.grade === 'F') {
      const label = summaries[semIdx]?.label ?? '';
      subjects.push(toSubjectMark(row, seatNo, uploadId, ` [Sem ${label} backlog]`));
    }
  }

  if (subjects.length === 0) return null;

  const backlogCount = rows.filter(row => row.grade === 'F').length;

  const resultStatus = mapResult(cumulative?.[7], rows);

  const student: Student = {
    seatNo,
    uploadId,
    rollNo: seatNo,
    name: rawName.replace(/\s+/g, ' ').trim(),
    motherName: rawMother.replace(/\s+/g, ' ').trim(),
    enrollmentNo: prn || '',
    branch: metadata.branch,
    semester: metadata.semester,
    collegeCode: college?.[1] ?? '',
    collegeName: college ? college[2].replace(/\s+/g, ' ').trim() : '',
    // SNDT prints "--" for SGPA/CGPA when a student has any failed course;
    // analytics already ignores 0 when averaging, so 0 means "not issued".
    sgpa: currentSummary?.sgpa ?? 0,
    cgpa: toNumberOrZero(cumulative?.[3]),
    credits: currentSummary?.earnedCredits ?? 0,
    resultStatus,
    ktCount: backlogCount,
  };

  return { student, subjects, warnings };
}

export function parseSndtLedgerText(text: string, uploadId: string): SndtParseResult {
  const metadata = extractSndtMetadata(text);
  const students: Student[] = [];
  const subjects: SubjectMark[] = [];
  const errors: string[] = [];

  for (const ledger of splitLedgers(text)) {
    const parsed = parseSndtLedger(ledger, uploadId, metadata);
    if (!parsed) {
      const seat = ledger.match(/Seat\s+No\s*:\s*(\d+)/i)?.[1];
      errors.push(`Could not parse ledger${seat ? ` for seat ${seat}` : ''}.`);
      continue;
    }
    students.push(parsed.student);
    subjects.push(...parsed.subjects);
    errors.push(...parsed.warnings);
  }

  return { students, subjects, errors };
}
