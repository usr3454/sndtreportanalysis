import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSndtMetadata, isSndtLedgerText, parseSndtLedgerText } from './sndtParser';

const here = path.dirname(fileURLToPath(import.meta.url));
const sample = fs.readFileSync(path.join(here, 'fixtures', 'sndt_sample.txt'), 'utf8');
const result = parseSndtLedgerText(sample, 'upload-sndt');

const student = (seat: string) => result.students.find(s => s.seatNo === seat)!;
const subject = (seat: string, code: string) =>
  result.subjects.find(s => s.seatNo === seat && s.subjectCode === code)!;

test('detects SNDT ledgers and reads program / semester', () => {
  assert.ok(isSndtLedgerText(sample));
  assert.ok(!isSndtLedgerText('OFFICE REGISTER FOR ... SEAT NO NAME STATUS GENDER ERN COLLEGE'));
  assert.deepEqual(extractSndtMetadata(sample), { branch: 'Bachelor of Arts (Music)', semester: 'II' });
});

test('skips the catalogue pages and parses every ledger without warnings', () => {
  assert.equal(result.students.length, 5);
  assert.deepEqual(result.errors, []);
});

test('regular passing student: header, college, semester and cumulative figures', () => {
  const s = student('281101');
  assert.equal(s.name, 'ASHA ANANDI RAO');
  assert.equal(s.enrollmentNo, '2025000000281101');
  assert.equal(s.collegeCode, '002');
  assert.match(s.collegeName, /S\.N\.D\.T\. College of Arts/);
  assert.equal(s.sgpa, 7.23);
  assert.equal(s.cgpa, 7.03);
  assert.equal(s.credits, 22);
  assert.equal(s.resultStatus, 'Pass');
  assert.equal(s.ktCount, 0);
  assert.equal(result.subjects.filter(x => x.seatNo === '281101').length, 9);
});

test('course rows: marks split, wrapped names and practical/viva courses', () => {
  const gayan = subject('281101', '20141121');
  assert.equal(gayan.internalMarks, 43);
  assert.equal(gayan.externalMarks, 35);
  assert.equal(gayan.totalMarks, 78);
  assert.equal(gayan.grade, 'A+');
  assert.equal(gayan.credits, 4);

  // Name wrapped over three lines in the PDF.
  const instrument = subject('281101', '20741101');
  assert.equal(instrument.subjectName, 'Basic skills of Playing any one instrument- Level 2(BA MUSIC)');
  assert.equal(instrument.internalMarks, 39);

  // PV course keeps its marks as practical/oral.
  const yoga = subject('281101', '21450323');
  assert.equal(yoga.practicalMarks, 23);
  assert.equal(yoga.oral, 23);
  assert.equal(yoga.totalMarks, 23);
});

test('ATKT student: backlog subjects are carried and RR / FF map to Fail', () => {
  const s = student('281102');
  assert.equal(s.resultStatus, 'KT');
  assert.equal(s.ktCount, 2);
  assert.equal(s.sgpa, 6.95); // current-semester SGPA is still issued
  assert.equal(s.cgpa, 0); // cumulative CGPA is "--"
  const backlogs = result.subjects.filter(x => x.seatNo === '281102' && /backlog/.test(x.subjectName));
  assert.equal(backlogs.length, 2);
  assert.ok(backlogs.every(x => x.status === 'Fail' && x.grade === 'F'));
  assert.ok(backlogs.some(x => x.totalMarks === 15)); // FF keeps the component marks
});

test('student absent for everything is a Fail with Absent subjects', () => {
  const s = student('281103');
  assert.equal(s.resultStatus, 'Fail');
  assert.equal(s.sgpa, 0);
  assert.equal(s.credits, 0);
  const subs = result.subjects.filter(x => x.seatNo === '281103');
  assert.equal(subs.length, 18);
  assert.ok(subs.every(x => x.status === 'Absent' && x.grade === 'AB' && x.totalMarks === 0));
});

test('grace marks column does not shift the remaining columns', () => {
  const raags = subject('281104', '20141112');
  assert.equal(raags.totalMarks, 20);
  assert.equal(raags.credits, 2);
  assert.equal(raags.grade, 'P');
  assert.equal(raags.status, 'Pass');
  assert.equal(student('281104').sgpa, 7.14);
});

test('partially absent component marks the whole course Absent', () => {
  const gayan1 = subject('281121', '10141121'); // INT 42, EXT absent
  assert.equal(gayan1.status, 'Absent');
  assert.equal(gayan1.totalMarks, 0);
  assert.equal(student('281121').resultStatus, 'Fail');
  assert.equal(student('281121').ktCount, 15);
});
