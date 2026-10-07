import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStudentBlock } from './parser';

test('parses subject-wise mark table layout', () => {
  const block = [
    '1234567 AARAV SHARMA Regular FEMALE MU1234567890123456',
    'Subject TW TH IAT OR/PR Total',
    'Applied Mathematics-II 18 33 26 - 77',
    'Engineering Graphics - 27 19 - 46',
    'Data Structure - 49 17 - 66',
    'Engineering Graphics Lab 21 - - 23 44',
    'Data Structure Lab 21 - - 15 36',
    'Social Science & Community Services 24 - - - 24',
    'Indian Knowledge System 24 - - - 24',
    'Engineering Workshop-II 22 - - - 22',
    'Python Programming 22 - - 17 39',
    'Semiconductor Physics - 34 22 - 56',
    'Semiconductor Physics Lab 21 - - - 21',
    'Environmental Chemistry & Non-conventional Energy Sources - 32 24 - 56',
    'Environmental Chemistry & Non-conventional Energy Sources Lab 21 - - - 21',
    'SGPA 8.5',
    'CGPA 8.7'
  ].join('\n');

  const result = parseStudentBlock(block, 'upload-1');

  assert.ok(result, 'expected parser to return a result');

  const maths = result?.subjects.find(subject => subject.subjectCode === '10521');
  assert.ok(maths, 'expected Applied Mathematics-II to be parsed');
  assert.equal(maths?.internalMarks, 26);
  assert.equal(maths?.externalMarks, 33);
  assert.equal(maths?.termWork, 18);
  assert.equal(maths?.totalMarks, 77);

  const graphicsLab = result?.subjects.find(subject => subject.subjectCode === '10532');
  assert.ok(graphicsLab, 'expected Engineering Graphics Lab to be parsed');
  assert.equal(graphicsLab?.termWork, 21);
  assert.equal(graphicsLab?.practicalMarks, 23);
  assert.equal(graphicsLab?.totalMarks, 44);
});

test('parses labeled component marks with T1/E1/I1/O1 prefixes', () => {
  const block = [
    '1113523 SACHIN SINGH CHADHA Regular MALE MU0341120250244274',
    'Subject TW TH IAT OR/PR Total',
    'Applied Mathematics-II T1 18 E1 33 I1 26 77',
    'Engineering Graphics E1 27 I1 19 46',
    'Data Structure E1 49 I1 17 66',
    'Engineering Graphics Lab T1 21 O1 23 44',
    'Data Structure Lab T1 21 O1 15 36',
    'Social Science & Community Services T1 24 24',
    'Indian Knowledge System T1 24 24',
    'Engineering Workshop-II T1 22 22',
    'Python Programming T1 22 O1 17 39',
    'Semiconductor Physics E1 34 I1 22 56',
    'Semiconductor Physics Lab T1 21 21',
    'Environmental Chemistry & Non-conventional Energy Sources E1 32 I1 24 56',
    'Environmental Chemistry & Non-conventional Energy Sources Lab T1 21 21'
  ].join('\n');

  const result = parseStudentBlock(block, 'upload-2');
  assert.ok(result, 'expected parser to return a result');

  const maths = result?.subjects.find(subject => subject.subjectCode === '10521');
  assert.ok(maths, 'expected Applied Mathematics-II to be parsed');
  assert.equal(maths?.internalMarks, 26);
  assert.equal(maths?.externalMarks, 33);
  assert.equal(maths?.termWork, 18);
  assert.equal(maths?.totalMarks, 77);

  const physics = result?.subjects.find(subject => subject.subjectCode === '10552');
  assert.ok(physics, 'expected Semiconductor Physics to be parsed');
  assert.equal(physics?.internalMarks, 22);
  assert.equal(physics?.externalMarks, 34);
  assert.equal(physics?.totalMarks, 56);

  const egLab = result?.subjects.find(subject => subject.subjectCode === '10532');
  assert.ok(egLab, 'expected Engineering Graphics Lab to be parsed');
  assert.equal(egLab?.termWork, 21);
  assert.equal(egLab?.practicalMarks, 23);
  assert.equal(egLab?.totalMarks, 44);
});
