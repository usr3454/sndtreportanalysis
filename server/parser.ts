import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Student, SubjectMark, Upload } from '../src/types.ts';
import { isSndtLedgerText, parseSndtLedgerText } from './sndtParser.ts';

function hasLikelyRegisterText(text: string): boolean {
  return (
    (/OFFICE REGISTER/i.test(text) && /SEAT NO NAME STATUS GENDER ERN COLLEGE/i.test(text)) ||
    isSndtLedgerText(text)
  );
}

function extractTextWithPython(buffer: Buffer): string | null {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reportanalysis-'));
  const tempPdfPath = path.join(tempDir, 'result.pdf');

  try {
    fs.writeFileSync(tempPdfPath, buffer);

    const pythonCandidates = [
      process.env.PYTHON,
      process.env.PYTHON3,
      'python',
      'python3',
      'py',
    ].filter((candidate): candidate is string => Boolean(candidate));

    const script = [
      'import sys',
      'from pathlib import Path',
      'from pypdf import PdfReader',
      'pdf_path = Path(sys.argv[1])',
      'reader = PdfReader(str(pdf_path))',
      'text = "\\n".join(page.extract_text() or "" for page in reader.pages)',
      'sys.stdout.write(text)',
    ].join(';');

    for (const candidate of pythonCandidates) {
      const args = candidate.toLowerCase() === 'py' ? ['-3', '-c', script, tempPdfPath] : ['-c', script, tempPdfPath];
      const result = spawnSync(candidate, args, { encoding: 'utf8' });

      if (result.status === 0 && result.stdout && hasLikelyRegisterText(result.stdout)) {
        return result.stdout;
      }
    }
  } catch {
    // Ignore and fall back to the built-in extractor.
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  return null;
}

async function extractTextWithPdfJs(buffer: Buffer): Promise<string | null> {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
      verbosity: 0,
    });
    const doc = await loadingTask.promise;

    const allLines: string[] = [];
    const yTolerance = 2;

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();

      let currentLine = '';
      let lastY: number | null = null;

      for (const item of content.items as any[]) {
        if (typeof item.str !== 'string' || !Array.isArray(item.transform)) continue;
        const y = item.transform[5];
        if (lastY !== null && Math.abs(y - lastY) > yTolerance) {
          if (currentLine.trim()) allLines.push(currentLine.trim());
          currentLine = '';
        }
        currentLine += item.str;
        lastY = y;
      }
      if (currentLine.trim()) allLines.push(currentLine.trim());

      // Release page resources as we go - important for documents with
      // thousands of pages, otherwise memory use grows unbounded.
      page.cleanup();
    }

    await doc.destroy();
    return allLines.join('\n');
  } catch {
    return null;
  }
}

async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  // pdfjs-dist is a pure-JS, cross-platform PDF parser (no external binary
  // or Python install required) and is both fast and reliable even on
  // large, multi-thousand-page registers. It's tried first.
  const pdfJsText = await extractTextWithPdfJs(buffer);
  if (pdfJsText && hasLikelyRegisterText(pdfJsText)) {
    return pdfJsText;
  }

  // Fallback for the rare case pdfjs-dist can't parse a particular file:
  // if the machine happens to have Python + pypdf available, try that too.
  const pythonText = extractTextWithPython(buffer);
  if (pythonText && hasLikelyRegisterText(pythonText)) {
    return pythonText;
  }

  return pdfJsText || pythonText || '';
}

interface SubjectComponentDefinition {
  tw?: boolean;
  or?: boolean;
  ext?: boolean;
  int?: boolean;
}

interface SubjectDefinition {
  code: string;
  name: string;
  components: SubjectComponentDefinition;
}

export interface ExamMetadata {
  branch: string;
  semester: string;
}

type ComponentRowLabel = 'T1' | 'O1' | 'E1' | 'I1';

const KNOWN_SUBJECT_COMPONENTS: Record<string, SubjectComponentDefinition> = {
  '10521': { tw: true, ext: true, int: true },
  '10522': { ext: true, int: true },
  '10523': { ext: true, int: true },
  '10532': { tw: true, or: true },
  '10533': { tw: true, or: true },
  '10542': { tw: true },
  '10543': { tw: true },
  '10544': { tw: true },
  '10545': { tw: true, or: true },
  '10552': { ext: true, int: true },
  '10555': { tw: true },
  '10558': { ext: true, int: true },
  '10561': { tw: true },
};

const KNOWN_SUBJECT_NAMES: Record<string, string> = {
  '10521': 'Applied Mathematics-II',
  '10522': 'Engineering Graphics',
  '10523': 'Data Structure',
  '10532': 'Engineering Graphics Lab',
  '10533': 'Data Structure Lab',
  '10542': 'Social Science & Community Services',
  '10543': 'Indian Knowledge System',
  '10544': 'Engineering Workshop-II',
  '10545': 'Python Programming',
  '10552': 'Semiconductor Physics',
  '10555': 'Semiconductor Physics Lab',
  '10558': 'Environmental Chemistry & Non-conventional Energy Sources',
  '10561': 'Environmental Chemistry & Non-conventional Energy Sources Lab',
};

const DEFAULT_SUBJECT_DEFINITIONS: SubjectDefinition[] = Object.keys(KNOWN_SUBJECT_COMPONENTS).map(code => ({
  code,
  name: KNOWN_SUBJECT_NAMES[code] || `Subject ${code}`,
  components: KNOWN_SUBJECT_COMPONENTS[code],
}));

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeForParsing(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s*:\s*/g, ':')
    .trim();
}

function asNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function cleanSubjectName(rawName: string, code: string): string {
  const withoutComponentText = rawName
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(?:TERM WORK|EXTERNAL|INTERNAL|ORAL|THEORY|TOTAL|RESULT|REMARK|COLLEGE|STATUS|GENDER|ERN)\b[\s\S]*$/i, ' ');

  return normalizeWhitespace(withoutComponentText) || KNOWN_SUBJECT_NAMES[code] || `Subject ${code}`;
}

function inferComponentsFromHeader(rawHeader: string, code: string): SubjectComponentDefinition {
  const knownComponents = KNOWN_SUBJECT_COMPONENTS[code];
  if (knownComponents) return knownComponents;

  const upperHeader = rawHeader.toUpperCase();
  return {
    tw: /TERM\s*WORK|\bTW\b/.test(upperHeader),
    or: /\bORAL\b|OR\/PR|PRACTICAL/.test(upperHeader),
    ext: /\bTHEORY\b|\bEXTERNAL\b|\bTH\b/.test(upperHeader),
    int: /\bINTERNAL\b|\bIAT\b/.test(upperHeader),
  };
}

// A far more reliable source for which components (I1/E1/T1/O1) apply to a
// subject than sniffing keywords out of the subject-name box, which was
// confirmed to vary in format across sections of the same document (some
// sections omit the "(THEORY)"/"(TERM WORK)" hint entirely, silently
// producing a subject with no components at all). Every page instead
// prints a structured Min/Max marks table with one row per subject, e.g.
// "10521 Applied Mathematics- II 3.00 16.00 40.00 24.00 60.00 10.00 25.00
// ... ... 50.00 125.00" - five min/max pairs in a fixed order (I1, E1, T1,
// O1, Total), where "..." marks a component that doesn't apply.
const MIN_MAX_TABLE_ROW_REGEX =
  /^(\d{5})\s+(.+?)\s+(\d+\.\d{2})\s+((?:\d+\.\d{2}|\.\.\.)(?:\s+(?:\d+\.\d{2}|\.\.\.)){9})\s*$/gm;

function extractComponentsFromMinMaxTable(text: string): Map<string, SubjectComponentDefinition> {
  const result = new Map<string, SubjectComponentDefinition>();

  for (const match of text.matchAll(MIN_MAX_TABLE_ROW_REGEX)) {
    const code = match[1];
    const pairTokens = match[4].split(/\s+/);
    // Pairs are [I1 min, I1 max, E1 min, E1 max, T1 min, T1 max, O1 min,
    // O1 max, Total min, Total max]; a component applies if its pair isn't
    // "...".
    result.set(code, {
      int: pairTokens[0] !== '...',
      ext: pairTokens[2] !== '...',
      tw: pairTokens[4] !== '...',
      or: pairTokens[6] !== '...',
    });
  }

  return result;
}

function extractSubjectDefinitionsFromText(
  text: string,
  globalComponents?: Map<string, SubjectComponentDefinition>
): SubjectDefinition[] {
  const matches = Array.from(
    text.matchAll(
      /\b(\d{5})\s*:\s*([\s\S]*?)(?=\b\d{5}\s*:|\n\s*(?:TERM WORK|External|Internal|TOT\s+GP|SEAT NO|T1\b|O1\b|E1\b|I1\b)|$)/gi
    )
  );

  // The Min/Max table doesn't necessarily repeat on every single page (a
  // given subject code might only get printed there once across the whole
  // document), so a page-scoped table lookup alone can miss it. Prefer a
  // document-wide table (passed in by the caller) first, then fall back to
  // whatever this specific scope of text has, then finally the fragile
  // keyword-based inference.
  const localComponentsFromTable = extractComponentsFromMinMaxTable(text);

  const seen = new Set<string>();
  const definitions: SubjectDefinition[] = [];

  for (const [, code, rawHeader] of matches) {
    if (seen.has(code)) continue;
    seen.add(code);

    definitions.push({
      code,
      name: cleanSubjectName(rawHeader, code),
      components:
        globalComponents?.get(code) ??
        localComponentsFromTable.get(code) ??
        inferComponentsFromHeader(rawHeader, code),
    });
  }

  return definitions;
}

function extractSubjectDefinitions(
  text: string,
  globalComponents?: Map<string, SubjectComponentDefinition>
): SubjectDefinition[] {
  const definitions = extractSubjectDefinitionsFromText(text, globalComponents ?? extractComponentsFromMinMaxTable(text));
  return definitions.length > 0 ? definitions : DEFAULT_SUBJECT_DEFINITIONS;
}

function rowLabelToComponent(label: ComponentRowLabel): keyof SubjectComponentDefinition {
  switch (label) {
    case 'T1':
      return 'tw';
    case 'O1':
      return 'or';
    case 'E1':
      return 'ext';
    case 'I1':
      return 'int';
    default:
      return 'tw';
  }
}

function extractComponentRowValues(line: string, label: ComponentRowLabel, expectedCount: number): number[] {
  const withoutLabel = line.replace(new RegExp(`^\\s*${label}\\b`, 'i'), ' ');
  const tokens = withoutLabel.split(/\s+/).filter(Boolean);
  const values: number[] = [];
  let i = 0;

  const isAbsentMarker = (token: string) => /^(?:ABS|AA)$/i.test(token);
  const isNumericToken = (token: string) => /^\d+(?:\.\d+)?[+#@*~$]*$/.test(token);
  const toNumber = (token: string) => Number(token.replace(/[+#@*~$]+$/, ''));
  // Real academic grade letters, distinct from the plain "P" pass flag, so
  // there's no ambiguity between the two token patterns below.
  const isGradeLetter = (token: string) => /^(?:O|A\+|A|B\+|B|C|D|E|F|FF|U)$/i.test(token);
  // Grace-mark ordinance markers (e.g. "@1", "*6" per the register's own
  // legend: "@:O.5042A...", "*:O.5045A..."). These add bonus marks to the
  // value just before them (e.g. "17 @1 P" means 17 + 1 grace mark = 18),
  // and the TOT summary row's total already includes that bonus - so
  // without applying it here, the component breakdown silently undercounts
  // by exactly the marker's digit.
  const graceMarkerMatch = (token: string) => token.match(/^[@*#~]([0-9]+)$/);

  while (i < tokens.length && values.length < expectedCount) {
    const token = tokens[i];

    // A subject can be marked absent for just one component with no
    // number at all (e.g. "...29 + P ABS 25 + P..."). It still occupies
    // that subject's slot - skipping it outright would shift every later
    // subject's value in the row by one.
    if (isAbsentMarker(token)) {
      values.push(0);
      i += 1;
      continue;
    }

    if (!isNumericToken(token)) {
      i += 1;
      continue;
    }

    // This numeric token is the next subject's mark for this component.
    values.push(toNumber(token));
    i += 1;

    // A grace-mark bonus token immediately follows the value it applies to.
    const grace = i < tokens.length ? graceMarkerMatch(tokens[i]) : null;
    if (grace) {
      values[values.length - 1] += Number(grace[1]);
      i += 1;
    }

    // A passed component is followed by marker/flag token(s) - either a
    // single joined token ("63+") or, depending on how the PDF text
    // extracted, separate space-separated tokens ("29 + P"). A FAILED
    // component instead prints the grade breakdown inline, normally as
    // <gradePoints> <gradeLetter> <gradeProduct> (e.g. "23 0 F 0.0") - but
    // when the raw score is literally 0, the grade-points token coincides
    // with it and only <gradeLetter> <gradeProduct> follows (e.g. "0 F
    // 0.0" is the whole thing). Left unhandled, any of these silently
    // shifts every subsequent subject's value in the row, which is
    // exactly what was corrupting totals for any student with a failure.
    if (
      i < tokens.length &&
      /^\d/.test(tokens[i]) &&
      i + 1 < tokens.length &&
      isGradeLetter(tokens[i + 1])
    ) {
      i += 1; // grade points
      i += 1; // grade letter
      if (i < tokens.length && /^\d+(?:\.\d+)?$/.test(tokens[i])) i += 1; // grade product
    } else if (i < tokens.length && isGradeLetter(tokens[i])) {
      i += 1; // grade letter (grade points coincided with the value above)
      if (i < tokens.length && /^\d+(?:\.\d+)?$/.test(tokens[i])) i += 1; // grade product
    } else {
      while (i < tokens.length && !isAbsentMarker(tokens[i]) && /^[A-Za-z#@*~$+]+$/.test(tokens[i])) {
        i += 1;
      }
    }
  }

  return values;
}

function findComponentRow(lines: string[], label: ComponentRowLabel): string | undefined {
  return lines.find(line => new RegExp(`^\\s*${label}\\b`, 'i').test(line));
}

function setSubjectComponentMark(
  subject: SubjectMark,
  label: ComponentRowLabel,
  value: number
): void {
  switch (label) {
    case 'T1':
      subject.termWork = value;
      break;
    case 'O1':
      subject.practicalMarks = value;
      subject.oral = value;
      break;
    case 'E1':
      subject.externalMarks = value;
      break;
    case 'I1':
      subject.internalMarks = value;
      break;
  }
}

function getSubjectTotal(subject: SubjectMark): number {
  return (
    asNumber(subject.termWork) +
    asNumber(subject.externalMarks) +
    asNumber(subject.internalMarks) +
    asNumber(subject.practicalMarks)
  );
}

function parseStudentHeader(lines: string[]): {
  seatNo: string;
  name: string;
  gender: string;
  rawHeader: string;
} | null {
  const rawHeader = lines.find(line => /\b\d{6,}\b/.test(line) && /[A-Z]/i.test(line));
  if (!rawHeader) return null;

  const match = rawHeader.match(/^(\d{6,})\s+(.+)$/);
  if (!match) {
    const fallback = rawHeader.match(/(\d{6,})/);
    if (!fallback) return null;
    return {
      seatNo: fallback[1],
      name: normalizeWhitespace(rawHeader.replace(fallback[0], '').replace(/^[^A-Z0-9]+/i, '')),
      gender: '',
      rawHeader,
    };
  }

  const [, seatNo, rest] = match;
  const genderMatch = rest.match(/\b(MALE|FEMALE|OTHER)\b/i);
  const statusMatch = rest.match(/\b(Regular|Repeater|Ex-student|Ex Student)\b/i);
  const stopIndexCandidates = [statusMatch?.index, genderMatch?.index].filter(
    (index): index is number => typeof index === 'number' && index >= 0
  );
  const nameEnd = stopIndexCandidates.length > 0 ? Math.min(...stopIndexCandidates) : rest.length;

  return {
    seatNo,
    name: normalizeWhitespace(rest.slice(0, nameEnd)),
    gender: genderMatch?.[1]?.toUpperCase() || '',
    rawHeader,
  };
}

function extractCollegeInfo(block: string): { collegeCode: string; collegeName: string } {
  // Register sheets print a college line like "MU-0689: Excelsior
  // Education Societys K C College of Engineering". The letters-dash-digits
  // code shape keeps this from colliding with all-digit subject code lines
  // ("10521 : Applied Mathematics-II").
  const match = block.match(/\b([A-Z]{2,6}-\d{2,6})\s*:\s*([^\n]+)/);
  if (!match) return { collegeCode: '', collegeName: '' };

  const collegeCode = match[1].trim();
  const collegeName = normalizeWhitespace(match[2]).replace(/[).]+$/, '').trim();
  return { collegeCode, collegeName };
}

function parseResultStatus(block: string): Student['resultStatus'] {
  const upperBlock = block.toUpperCase();
  if (/\bATKT\b/.test(upperBlock)) return 'KT';
  if (/\bABSENT\b/.test(upperBlock)) return 'Fail';
  if (/\bFAIL(?:ED)?\b/.test(upperBlock)) return 'Fail';
  return 'Pass';
}

function extractDecimalAfterLabel(block: string, label: 'SGPA' | 'CGPA'): number {
  const match = block.match(new RegExp(`\\b${label}\\s*:?\\s*(\\d+(?:\\.\\d+)?)`, 'i'));
  return match ? Number(match[1]) : 0;
}

function normalizeExamValue(value: string): string {
  return normalizeWhitespace(value.replace(/\s+/g, ' ').replace(/\s*\(.*\)$/, ''));
}

export function extractExamMetadata(text: string, filename: string): ExamMetadata {
  const source = `${text}\n${filename}`;

  const branchMatch = source.match(/Bachelor\s+of\s+Engineering\s*\(\s*([^\)\n]+?)\s*\)/i);
  const semesterMatch = source.match(/Semester\s*-\s*([A-Za-z0-9]+(?:\s*[A-Za-z0-9]+)*)/i);

  return {
    branch: branchMatch ? normalizeExamValue(branchMatch[1]) : 'Unknown',
    semester: semesterMatch ? normalizeExamValue(semesterMatch[1]) : 'Unknown',
  };
}

function extractSgpaFromBlock(block: string): number {
  const explicitMatch = block.match(/\bSGPA\b\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  if (explicitMatch) return Number(explicitMatch[1]);

  const lines = block.split(/\r?\n/);
  const totIndex = lines.findIndex(line => /^\s*TOT\b/i.test(line));
  if (totIndex >= 0) {
    // The trailing SGPA can be split across a page break onto its own
    // line(s) - e.g. "...22 123.5" ends one page and "0.0000" then a bare
    // "0" continue on the next, which together are really "0.00000".
    // Left unhandled, the TOT line's last token becomes "123.5" (the
    // credit-points sum, not the SGPA), which then falls through to a
    // much less reliable full-block scan that can latch onto an unrelated
    // number elsewhere (e.g. a subject's grade-points-times-credits
    // value) and report a wildly wrong SGPA.
    let sgpaFragment = '';
    for (let offset = 1; offset <= 2; offset += 1) {
      const candidate = lines[totIndex + offset]?.trim();
      if (!candidate) break;
      if (!sgpaFragment && /^\d+\.\d+$/.test(candidate)) {
        sgpaFragment = candidate;
        continue;
      }
      if (sgpaFragment && /^\d{1,3}$/.test(candidate)) {
        sgpaFragment += candidate;
        continue;
      }
      break;
    }

    const summaryLine = sgpaFragment ? `${lines[totIndex]} ${sgpaFragment}` : lines[totIndex];
    const tokens = summaryLine.split(/\s+/).filter(Boolean);
    const totTokenIndex = tokens.findIndex(token => /^TOT$/i.test(token));
    if (totTokenIndex >= 0) {
      const numericTokens = tokens.slice(totTokenIndex + 1).filter(token => /^\d+(?:\.\d+)?$/.test(token));
      const lastToken = numericTokens[numericTokens.length - 1];
      if (lastToken) {
        const value = Number(lastToken);
        if (Number.isFinite(value) && value <= 10) return value;
      }
    }
  }

  // Last resort: scan the whole block for a plausible SGPA-shaped decimal.
  // Prefer the LAST such match over the first, since the real SGPA/CGPA is
  // always near the end of a student's data (after all subject grade
  // breakdowns), whereas an early match is far more likely to be an
  // unrelated grade-points value that happens to also be <= 10.
  const decimals = [...block.matchAll(/\b(\d+(?:\.\d+))\b/g)].map(match => Number(match[1]));
  for (let i = decimals.length - 1; i >= 0; i -= 1) {
    if (decimals[i] > 0 && decimals[i] <= 10) return decimals[i];
  }
  return 0;
}

function extractCgpaFromBlock(block: string): number {
  const explicitMatch = block.match(/\bCGPA\b\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  if (explicitMatch) return Number(explicitMatch[1]);

  return extractSgpaFromBlock(block);
}

// Letter grades that indicate a subject was NOT cleared, across common Indian
// university grading schemes (Mumbai University and others). Kept generic so
// this works for any college's marksheet, not just one specific format.
const FAILING_GRADE_LETTERS = new Set(['F', 'FF', 'U', 'AB', 'ABS', 'FAIL', 'NULL', 'RR']);

function isFailingGrade(grade: string, gradePoints: number): boolean {
  const normalized = grade.trim().toUpperCase();
  if (FAILING_GRADE_LETTERS.has(normalized)) return true;
  // A grade point of 0 against a real (non-empty) letter grade is the most
  // university-agnostic signal that the subject was not cleared.
  if (normalized && gradePoints === 0) return true;
  return false;
}

// Register sheets mark certain values with trailing symbols per a legend
// (e.g. "+: MARKS CARRIED FORWARD", "$: GRADE CARRIED FORWARD", commonly
// seen for repeat/ATKT students). Strip those before treating a token as
// numeric, otherwise a token like "63+" silently breaks summary parsing for
// that entire student - which happens most often for exactly the students
// with backlogs, undermining the KT count we're trying to calculate.
function stripCarryForwardMarker(token: string): string {
  return token.replace(/[+#@*~$]+$/, '');
}

// Real academic grade letters, distinct from the plain "P" pass flag, used
// to detect where one subject's summary group ends and the next begins.
const GRADE_LETTER_PATTERN = /^(?:O|A\+|A|B\+|B|C|D|E|F|FF|U)$/i;

function parseSubjectSummaries(
  lines: string[],
  subjectDefinitions: SubjectDefinition[]
): Array<{ totalMarks: number; grade: string; gradePoints: number; credits: number; failed: boolean }> {
  const summaryLine = lines.find(line => /^\s*TOT\b/i.test(line));
  if (!summaryLine) return [];

  const tokens = summaryLine.split(/\s+/).filter(Boolean);
  const totIndex = tokens.findIndex(token => /^TOT$/i.test(token));
  if (totIndex < 0) return [];

  const isNumeric = (token: string) => /^\d+(?:\.\d+)?$/.test(stripCarryForwardMarker(token));
  const isGradeLetter = (token: string) => GRADE_LETTER_PATTERN.test(stripCarryForwardMarker(token));

  const summaries: Array<{ totalMarks: number; grade: string; gradePoints: number; credits: number; failed: boolean }> = [];
  let i = totIndex + 1;

  while (summaries.length < subjectDefinitions.length && i < tokens.length) {
    const totalToken = stripCarryForwardMarker(tokens[i]);
    if (!isNumeric(totalToken)) break;
    const totalMarks = Number(totalToken);
    i += 1;

    let gradePoints: number;
    let grade: string;

    if (i < tokens.length && isGradeLetter(tokens[i])) {
      // A raw score of 0 collapses the token stream: the grade-points
      // token (also 0) is omitted entirely, so the group is only
      // <total> <gradeLetter> <credits> <gradeProduct> (e.g. "0 F 3
      // 0.0") instead of the usual 5 tokens. Missing this meant every
      // subject after a genuinely-zero score in the row got silently
      // dropped, which happens most for students absent the whole exam.
      gradePoints = 0;
      grade = stripCarryForwardMarker(tokens[i]);
      i += 1;
    } else if (i < tokens.length && isNumeric(tokens[i]) && i + 1 < tokens.length && isGradeLetter(tokens[i + 1])) {
      gradePoints = Number(stripCarryForwardMarker(tokens[i]));
      grade = stripCarryForwardMarker(tokens[i + 1]);
      i += 2;
    } else {
      // Doesn't match either known group shape - likely the trailing
      // credits-earned/SGPA summary at the end of the line, not another
      // subject. Stop rather than misinterpret it.
      break;
    }

    if (i >= tokens.length || !isNumeric(tokens[i])) break;
    const credits = Number(stripCarryForwardMarker(tokens[i]));
    i += 1;

    if (i >= tokens.length || !isNumeric(tokens[i])) break;
    i += 1; // grade product - not currently stored, just consumed

    summaries.push({
      totalMarks,
      grade,
      gradePoints,
      credits,
      failed: isFailingGrade(grade, gradePoints),
    });
  }

  return summaries;
}

function createEmptySubjectMark(
  definition: SubjectDefinition,
  seatNo: string,
  uploadId: string
): SubjectMark {
  return {
    seatNo,
    uploadId,
    subjectCode: definition.code,
    subjectName: definition.name,
    internalMarks: 0,
    externalMarks: 0,
    practicalMarks: 0,
    termWork: 0,
    oral: 0,
    totalMarks: 0,
    credits: 1,
    grade: '',
    status: 'Pass',
  };
}

export interface ParsedStudentBlockResult {
  student: Student;
  subjects: SubjectMark[];
}

export interface ParsedPdfResult {
  upload: Upload;
  students: Student[];
  subjects: SubjectMark[];
  errors: string[];
}

function findSubjectLineRemainder(lines: string[], subjectName: string): string[] | undefined {
  const normalizedTarget = normalizeWhitespace(subjectName).toLowerCase();
  if (!normalizedTarget) return undefined;

  for (const line of lines) {
    const normalizedLine = normalizeWhitespace(line);
    const lower = normalizedLine.toLowerCase();
    if (lower.startsWith(`${normalizedTarget} `)) {
      const remainder = normalizedLine.slice(normalizedTarget.length).trim();
      if (!remainder) continue;
      return remainder.split(/\s+/).filter(Boolean);
    }
  }
  return undefined;
}

function applyLabeledInlineTokens(subject: SubjectMark, tokens: string[]): void {
  let i = 0;
  let total: number | undefined;

  while (i < tokens.length) {
    const token = tokens[i];
    if (/^(T1|E1|I1|O1)$/i.test(token)) {
      const label = token.toUpperCase() as ComponentRowLabel;
      const valueToken = tokens[i + 1];
      if (valueToken && /^\d+(?:\.\d+)?$/.test(valueToken)) {
        setSubjectComponentMark(subject, label, Number(valueToken));
      }
      i += 2;
    } else if (/^\d+(?:\.\d+)?$/.test(token)) {
      // A bare trailing number (not preceded by a component label) is the
      // subject's overall total for the row.
      total = Number(token);
      i += 1;
    } else {
      i += 1;
    }
  }

  if (total !== undefined) {
    subject.totalMarks = total;
  }
}

function applyPositionalTokens(subject: SubjectMark, tokens: string[]): void {
  // Expects the standard "Subject TW TH IAT OR/PR Total" column order that
  // many register formats use for a plain one-row-per-subject table, with
  // "-" marking a column that doesn't apply to that subject.
  if (tokens.length < 5) return;

  const [twTok, thTok, iatTok, orTok, totalTok] = tokens.slice(-5);
  const parseVal = (t: string) => (/^\d+(?:\.\d+)?$/.test(t) ? Number(t) : undefined);

  const tw = parseVal(twTok);
  const th = parseVal(thTok);
  const iat = parseVal(iatTok);
  const orpr = parseVal(orTok);
  const total = parseVal(totalTok);

  if (tw !== undefined) subject.termWork = tw;
  if (th !== undefined) subject.externalMarks = th;
  if (iat !== undefined) subject.internalMarks = iat;
  if (orpr !== undefined) {
    subject.practicalMarks = orpr;
    subject.oral = orpr;
  }
  if (total !== undefined) subject.totalMarks = total;
}

// Fallback for register formats that don't use the Mumbai University style
// of one row per component spanning every subject (T1/O1/E1/I1 + a TOT
// summary line). Instead these print one row per SUBJECT, either with the
// marks in fixed columns ("Subject TW TH IAT OR/PR Total") or with inline
// component labels ("Subject T1 18 E1 33 I1 26 77"). Only used when the
// primary row-based layout finds nothing, so it can't interfere with the
// Mumbai University format.
function applyPerSubjectLineLayout(
  lines: string[],
  subjectDefinitions: SubjectDefinition[],
  subjectsByCode: Map<string, SubjectMark>
): void {
  for (const definition of subjectDefinitions) {
    const subject = subjectsByCode.get(definition.code);
    if (!subject) continue;

    const remainder = findSubjectLineRemainder(lines, definition.name);
    if (!remainder || remainder.length === 0) continue;

    const hasInlineLabels = remainder.some(token => /^(T1|E1|I1|O1)$/i.test(token));
    if (hasInlineLabels) {
      applyLabeledInlineTokens(subject, remainder);
    } else {
      applyPositionalTokens(subject, remainder);
    }
  }
}

export function parseStudentBlock(
  block: string,
  uploadId: string,
  subjectDefinitions: SubjectDefinition[] = DEFAULT_SUBJECT_DEFINITIONS,
  examMetadata: ExamMetadata = { branch: 'Unknown', semester: 'Unknown' }
): ParsedStudentBlockResult | null {
  const lines = block
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const header = parseStudentHeader(lines);
  if (!header) return null;

  const subjects = subjectDefinitions.map(definition =>
    createEmptySubjectMark(definition, header.seatNo, uploadId)
  );

  const subjectsByCode = new Map(subjects.map(subject => [subject.subjectCode, subject]));
  const rowLabels: ComponentRowLabel[] = ['T1', 'O1', 'E1', 'I1'];

  let foundAnyComponentRow = false;
  for (const label of rowLabels) {
    const row = findComponentRow(lines, label);
    if (!row) continue;
    foundAnyComponentRow = true;

    const componentKey = rowLabelToComponent(label);
    const eligibleSubjects = subjectDefinitions.filter(definition => definition.components[componentKey]);
    const values = extractComponentRowValues(row, label, eligibleSubjects.length);

    eligibleSubjects.forEach((definition, index) => {
      const value = values[index];
      const subject = subjectsByCode.get(definition.code);
      if (subject && value !== undefined) {
        setSubjectComponentMark(subject, label, value);
      }
    });
  }

  // This PDF doesn't use the Mumbai University row-per-component layout at
  // all - try the one-row-per-subject fallback instead of giving up.
  if (!foundAnyComponentRow) {
    applyPerSubjectLineLayout(lines, subjectDefinitions, subjectsByCode);
  }

  const summaryRows = parseSubjectSummaries(lines, subjectDefinitions);
  const enrolledSubjectCodes = new Set<string>();
  if (summaryRows.length > 0) {
    summaryRows.forEach((summary, index) => {
      const definition = subjectDefinitions[index];
      if (!definition) return;
      const subject = subjectsByCode.get(definition.code);
      if (!subject) return;

      // A subject having a TOT summary entry at all - even a 0-mark one -
      // means the student was genuinely enrolled/evaluated in it (e.g. a
      // student absent for the entire exam legitimately shows 0 in every
      // subject). This is tracked separately from totalMarks so such
      // students aren't mistaken for "not enrolled" and dropped entirely.
      enrolledSubjectCodes.add(definition.code);

      if (summary.totalMarks > 0) {
        subject.totalMarks = summary.totalMarks;
      }
      if (summary.grade) {
        subject.grade = summary.grade;
      }
      if (summary.credits > 0) {
        subject.credits = summary.credits;
      }
      // This is the actual source of truth for whether a subject was
      // cleared or not - previously this was never set, so every subject
      // stayed at its 'Pass' default regardless of the parsed grade.
      subject.status = summary.failed ? 'Fail' : 'Pass';
      if (subject.totalMarks === 0) {
        subject.totalMarks = getSubjectTotal(subject);
      }
    });
  } else {
    subjects.forEach(subject => {
      // Don't clobber a total the per-subject-line fallback already parsed
      // directly from the register (e.g. an explicit "...Total 77" column).
      if (subject.totalMarks === 0) {
        subject.totalMarks = getSubjectTotal(subject);
      }
    });
  }

  const parsedSubjects = subjects.filter(
    subject => subject.totalMarks > 0 || enrolledSubjectCodes.has(subject.subjectCode)
  );
  if (parsedSubjects.length === 0) return null;

  // KT (backlog) count = number of subjects the student actually failed,
  // derived directly from each subject's parsed grade/status rather than a
  // hardcoded value.
  const ktCount = parsedSubjects.filter(subject => subject.status === 'Fail').length;
  const { collegeCode, collegeName } = extractCollegeInfo(block);

  // "KT" (backlog) implies passing some subjects while owing a re-attempt on
  // others. A student who failed every single evaluated subject - most
  // commonly someone absent for the whole exam - is a complete failure, not
  // a partial one, so that case is reported as 'Fail' rather than 'KT'.
  const resultStatus: Student['resultStatus'] =
    ktCount === 0
      ? parseResultStatus(block)
      : ktCount === parsedSubjects.length
        ? 'Fail'
        : 'KT';

  const student: Student = {
    seatNo: header.seatNo,
    uploadId,
    rollNo: header.seatNo,
    name: header.name,
    motherName: '',
    enrollmentNo: '',
    branch: examMetadata.branch,
    semester: examMetadata.semester,
    collegeCode,
    collegeName,
    sgpa: extractSgpaFromBlock(block),
    cgpa: extractCgpaFromBlock(block),
    credits: 0,
    resultStatus,
    ktCount,
  };

  return { student, subjects: parsedSubjects };
}

function isPageBoilerplateStart(line: string): boolean {
  // Each new page in these register-style PDFs repeats a page header, exam
  // title, grading legend, and the subject/column header block before the
  // next student's row resumes. Left unfiltered, this text bleeds into
  // whichever student happens to be last on a page (e.g. the legend line
  // "AA/ABS: ABSENT" was being read as that student's own result status).
  return (
    /^PAGE\s*:/i.test(line) ||
    /^OFFICE REGISTER FOR/i.test(line) ||
    /^SEAT NO NAME STATUS GENDER ERN COLLEGE$/i.test(line)
  );
}

interface StudentBlockWithSubjects {
  block: string;
  subjectDefinitions: SubjectDefinition[];
}

function splitStudentBlocks(
  text: string,
  fallbackSubjectDefinitions: SubjectDefinition[],
  globalComponents: Map<string, SubjectComponentDefinition>
): StudentBlockWithSubjects[] {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const blocks: StudentBlockWithSubjects[] = [];
  let currentBlock: string[] = [];
  let skippingBoilerplate = false;
  let boilerplateBuffer: string[] = [];
  // Each page reprints its own subject list, and different colleges/
  // sections within the same document can have different elective
  // subjects (confirmed on a real 1540-page, 22-college register: two
  // subjects differed between colleges). Using one subject list for the
  // whole document silently misaligned marks for every student in a
  // section whose subjects didn't match the first section seen. Instead,
  // each page's own boilerplate is scanned for its subject list, and that
  // becomes the active list for students appearing after it.
  let currentSubjectDefinitions = fallbackSubjectDefinitions;

  const flushBoilerplateSubjects = () => {
    if (boilerplateBuffer.length === 0) return;
    const detected = extractSubjectDefinitionsFromText(boilerplateBuffer.join('\n'), globalComponents);
    if (detected.length > 0) {
      currentSubjectDefinitions = detected;
    }
    boilerplateBuffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const looksLikeStudentHeader = /^\s*\d{6,}\b/.test(trimmed) && /[A-Z]/i.test(trimmed);
    if (looksLikeStudentHeader) {
      if (skippingBoilerplate) {
        flushBoilerplateSubjects();
        skippingBoilerplate = false;
      }
      if (currentBlock.length > 0) {
        blocks.push({ block: currentBlock.join('\n'), subjectDefinitions: currentSubjectDefinitions });
      }
      currentBlock = [trimmed];
      continue;
    }

    if (isPageBoilerplateStart(trimmed)) {
      skippingBoilerplate = true;
      boilerplateBuffer.push(trimmed);
      continue;
    }

    if (skippingBoilerplate) {
      boilerplateBuffer.push(trimmed);
      continue;
    }

    if (currentBlock.length > 0) {
      currentBlock.push(trimmed);
    }
  }

  if (skippingBoilerplate) {
    flushBoilerplateSubjects();
  }

  if (currentBlock.length > 0) {
    blocks.push({ block: currentBlock.join('\n'), subjectDefinitions: currentSubjectDefinitions });
  }

  return blocks;
}

export async function parsePdfResult(
  buffer: Buffer | Uint8Array,
  filename: string
): Promise<ParsedPdfResult> {
  const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const upload: Upload = {
    id: uploadId,
    filename,
    uploadDate: new Date().toISOString(),
    studentCount: 0,
    status: 'Completed',
  };

  try {
    const text = await extractTextFromPdfBuffer(Buffer.from(buffer));

    // SNDT Women's University result ledgers use a completely different
    // layout (one ledger per student, one row per course) from the Mumbai
    // University office register handled below, so they get their own parser.
    if (isSndtLedgerText(text)) {
      const sndt = parseSndtLedgerText(text, uploadId);
      if (sndt.students.length === 0) {
        sndt.errors.push('SNDT ledger detected, but no student ledgers could be parsed.');
      }
      upload.studentCount = sndt.students.length;
      return { upload, students: sndt.students, subjects: sndt.subjects, errors: sndt.errors };
    }

    // Computed once from the whole document: the Min/Max marks table is a
    // far more reliable source of which components (I1/E1/T1/O1) apply to
    // a subject code than the subject-name box text, and unlike that box,
    // a given code's row there doesn't need to repeat on every page to be
    // useful here - seeing it once anywhere in the document is enough.
    const globalComponents = extractComponentsFromMinMaxTable(text);
    // A document-wide fallback list, used only if a student appears before
    // any page-level subject list has been detected yet (e.g. a malformed
    // or unusual first page).
    const fallbackSubjectDefinitions = extractSubjectDefinitions(text, globalComponents);
    const examMetadata = extractExamMetadata(text, filename);
    const blocks = splitStudentBlocks(text, fallbackSubjectDefinitions, globalComponents);
    const students: Student[] = [];
    const subjects: SubjectMark[] = [];
    const errors: string[] = [];

    for (const { block, subjectDefinitions } of blocks) {
      const parsed = parseStudentBlock(block, uploadId, subjectDefinitions, examMetadata);
      if (!parsed) continue;

      students.push(parsed.student);
      subjects.push(...parsed.subjects);
    }

    if (students.length === 0 && /sample\.pdf|mock|sample/i.test(filename)) {
      const sampleStudents = Array.from({ length: 5 }, (_, index) => {
        const seatNo = `${5001000 + index + 1}`;
        const resultStatus = index % 4 === 0 ? 'KT' : index % 5 === 1 ? 'Fail' : 'Pass';
        const sgpa = index % 4 === 0 ? 6.4 : index % 5 === 1 ? 4.8 : 8.7 + (index % 3) * 0.2;
        const student: Student = {
          seatNo,
          uploadId,
          rollNo: seatNo,
          name: `Sample Student ${index + 1}`,
          motherName: 'Sample Mother',
          enrollmentNo: `ENR${seatNo}`,
          branch: 'Computer Engineering',
          semester: 'VII',
          collegeCode: 'SAMPLE-001',
          collegeName: 'Sample Institute of Technology',
          sgpa,
          cgpa: Number((sgpa + 0.2).toFixed(2)),
          credits: 18,
          resultStatus,
          ktCount: resultStatus === 'KT' ? 1 : 0,
        };

        const studentSubjects: SubjectMark[] = [
          { seatNo, uploadId, subjectCode: '10521', subjectName: 'Applied Mathematics-II', internalMarks: 18, externalMarks: 62, practicalMarks: 0, termWork: 0, oral: 0, totalMarks: 80, credits: 4, grade: 'A', status: 'Pass' },
          { seatNo, uploadId, subjectCode: '10522', subjectName: 'Engineering Graphics', internalMarks: 17, externalMarks: 58, practicalMarks: 0, termWork: 0, oral: 0, totalMarks: 75, credits: 3, grade: 'B', status: 'Pass' },
          { seatNo, uploadId, subjectCode: '10523', subjectName: 'Data Structure', internalMarks: 16, externalMarks: 54, practicalMarks: 0, termWork: 0, oral: 0, totalMarks: 70, credits: 4, grade: 'C', status: resultStatus === 'Fail' ? 'Fail' : 'Pass' },
        ];

        return { student, subjects: studentSubjects };
      });

      students.push(...sampleStudents.map(item => item.student));
      subjects.push(...sampleStudents.flatMap(item => item.subjects));
      errors.push('Using built-in sample dataset because the uploaded PDF could not be parsed reliably.');
    }

    if (students.length === 0) {
      errors.push('No student result rows were parsed. If this PDF is scanned, run OCR before parsing.');
    }

    upload.studentCount = students.length;
    return { upload, students, subjects, errors };
  } catch (error: any) {
    return {
      upload,
      students: [],
      subjects: [],
      errors: [error?.message || 'Failed to parse PDF content.'],
    };
  }
}
