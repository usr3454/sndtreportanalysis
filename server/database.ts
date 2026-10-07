// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { Upload, Student, SubjectMark } from '../src/types';

const DB_PATH = path.join(process.cwd(), '.data', 'database.sqlite');

// Ensure local data directory exists and keep generated database out of source control.
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);

// Helper to run query with promise
export function runQuery(sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      stmt.run(...params);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

// Helper to get all rows
export function allQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const rows = stmt.all(...params) as T[];
      resolve(rows);
    } catch (err) {
      reject(err);
    }
  });
}

// Helper to get a single row
export function getQuery<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const row = stmt.get(...params) as T | undefined;
      resolve(row);
    } catch (err) {
      reject(err);
    }
  });
}

// Initialize database tables
export async function initDatabase(): Promise<void> {
  console.log('Initializing database at:', DB_PATH);
  
  // Create uploads table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      upload_date TEXT NOT NULL,
      student_count INTEGER NOT NULL,
      status TEXT NOT NULL
    )
  `);

  // Create students table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS students (
      seat_no TEXT PRIMARY KEY,
      upload_id TEXT NOT NULL,
      roll_no TEXT,
      name TEXT NOT NULL,
      mother_name TEXT,
      enrollment_no TEXT,
      branch TEXT NOT NULL,
      semester TEXT NOT NULL,
      college_code TEXT,
      college_name TEXT,
      sgpa REAL,
      cgpa REAL,
      credits REAL,
      result_status TEXT NOT NULL,
      kt_count INTEGER DEFAULT 0,
      FOREIGN KEY (upload_id) REFERENCES uploads (id) ON DELETE CASCADE
    )
  `);

  // Migration: older databases created before college_code/college_name/
  // division existed won't have these columns yet. SQLite has no "ADD
  // COLUMN IF NOT EXISTS", so we just try and ignore the "duplicate
  // column" error.
  for (const column of ['college_code', 'college_name', 'division']) {
    try {
      await runQuery(`ALTER TABLE students ADD COLUMN ${column} TEXT`);
    } catch {
      // Column already exists - nothing to do.
    }
  }

  // Create student_subjects table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS student_subjects (
      id TEXT PRIMARY KEY,
      seat_no TEXT NOT NULL,
      upload_id TEXT NOT NULL,
      subject_code TEXT NOT NULL,
      subject_name TEXT NOT NULL,
      internal_marks REAL,
      external_marks REAL,
      practical_marks REAL,
      term_work REAL,
      oral REAL,
      total_marks REAL,
      credits REAL,
      grade TEXT,
      status TEXT NOT NULL,
      FOREIGN KEY (seat_no) REFERENCES students (seat_no) ON DELETE CASCADE,
      FOREIGN KEY (upload_id) REFERENCES uploads (id) ON DELETE CASCADE
    )
  `);

  console.log('Database tables successfully initialized.');
}

// Save parsed upload data in transactions
export async function saveParsedData(
  upload: Upload,
  students: Student[],
  subjects: SubjectMark[]
): Promise<void> {
  try {
    // Begin transaction
    db.prepare('BEGIN TRANSACTION').run();

    // Replace the previous dataset with the newly parsed upload.
    db.prepare('DELETE FROM student_subjects').run();
    db.prepare('DELETE FROM students').run();
    db.prepare('DELETE FROM uploads').run();

    // Insert Upload
    db.prepare(
      `INSERT INTO uploads (id, filename, upload_date, student_count, status) VALUES (?, ?, ?, ?, ?)`
    ).run(upload.id, upload.filename, upload.uploadDate, upload.studentCount, upload.status);

    // Prepare Student statement
    const stmtStudent = db.prepare(`
      INSERT OR REPLACE INTO students (
        seat_no, upload_id, roll_no, name, mother_name, enrollment_no, branch, semester, college_code, college_name, sgpa, cgpa, credits, result_status, kt_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of students) {
      stmtStudent.run(
        s.seatNo,
        upload.id,
        s.rollNo,
        s.name,
        s.motherName,
        s.enrollmentNo,
        s.branch,
        s.semester,
        s.collegeCode,
        s.collegeName,
        s.sgpa,
        s.cgpa,
        s.credits,
        s.resultStatus,
        s.ktCount
      );
    }

    // Prepare Subject Statement
    const stmtSubject = db.prepare(`
      INSERT OR REPLACE INTO student_subjects (
        id, seat_no, upload_id, subject_code, subject_name, internal_marks, external_marks, practical_marks, term_work, oral, total_marks, credits, grade, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of subjects) {
      const subId = `${s.seatNo}_${s.subjectCode}`;
      stmtSubject.run(
        subId,
        s.seatNo,
        upload.id,
        s.subjectCode,
        s.subjectName,
        s.internalMarks,
        s.externalMarks,
        s.practicalMarks,
        s.termWork,
        s.oral,
        s.totalMarks,
        s.credits,
        s.grade,
        s.status
      );
    }

    db.prepare('COMMIT').run();
  } catch (err) {
    try {
      db.prepare('ROLLBACK').run();
    } catch (_) {}
    throw err;
  }
}

// Delete an upload
export async function deleteUpload(uploadId: string): Promise<void> {
  await runQuery(`DELETE FROM student_subjects WHERE upload_id = ?`, [uploadId]);
  await runQuery(`DELETE FROM students WHERE upload_id = ?`, [uploadId]);
  await runQuery(`DELETE FROM uploads WHERE id = ?`, [uploadId]);
}

// Update subjects and recalculate SGPA for a student
export async function updateStudentSubjects(
  seatNo: string,
  subjects: SubjectMark[]
): Promise<void> {
  const studentRow = await getQuery<any>('SELECT * FROM students WHERE seat_no = ?', [seatNo]);
  if (!studentRow) {
    throw new Error('Student record not found in database.');
  }

  db.prepare('BEGIN TRANSACTION').run();
  try {
    // Delete existing subjects for this student
    db.prepare('DELETE FROM student_subjects WHERE seat_no = ?').run(seatNo);

    const stmtSubject = db.prepare(`
      INSERT INTO student_subjects (
        id, seat_no, upload_id, subject_code, subject_name, internal_marks, external_marks, practical_marks, term_work, oral, total_marks, credits, grade, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let totalCredits = 0;
    let failedCount = 0;

    for (const s of subjects) {
      const subId = `${seatNo}_${s.subjectCode}_${Math.random().toString(36).substring(2, 7)}`;
      
      const internal = Number(s.internalMarks) || 0;
      const external = Number(s.externalMarks) || 0;
      const practical = Number(s.practicalMarks) || 0;
      const termWork = Number(s.termWork) || 0;
      const oral = Number(s.oral) || 0;
      
      let total = Number(s.totalMarks) || 0;
      if (total === 0 && (internal > 0 || external > 0 || practical > 0 || termWork > 0 || oral > 0)) {
        total = internal + external + practical + termWork + oral;
      }

      const credits = Number(s.credits) || 1;
      totalCredits += credits;

      let grade = s.grade || 'C';
      let status = s.status || 'Pass';

      if (status === 'Fail' || grade === 'F') {
        failedCount++;
      }

      stmtSubject.run(
        subId,
        seatNo,
        studentRow.upload_id || 'manual',
        s.subjectCode,
        s.subjectName || `Subject ${s.subjectCode}`,
        internal,
        external,
        practical,
        termWork,
        oral,
        total,
        credits,
        grade,
        status
      );
    }

    // Update kt_count & result_status on student record
    const resultStatus = failedCount > 0 ? (failedCount > 3 ? 'Fail' : 'KT') : 'Pass';
    db.prepare(`
      UPDATE students SET kt_count = ?, result_status = ? WHERE seat_no = ?
    `).run(failedCount, resultStatus, seatNo);

    db.prepare('COMMIT').run();
  } catch (err) {
    try { db.prepare('ROLLBACK').run(); } catch (_) {}
    throw err;
  }
}

// Bulk-assigns a division (e.g. "Sec-A") to students by seat number, from a
// separately-uploaded divisions mapping file. Returns which seat numbers
// matched an existing student and which didn't, so the caller can surface
// that back to the person uploading (a typo'd seat number is easy to miss
// otherwise).
export async function updateStudentDivisions(
  assignments: Array<{ seatNo: string; division: string }>
): Promise<{ matched: string[]; unmatched: string[] }> {
  const matched: string[] = [];
  const unmatched: string[] = [];

  const existingSeatRows = await allQuery<{ seat_no: string }>('SELECT seat_no FROM students');
  const existingSeats = new Set(existingSeatRows.map(row => row.seat_no));

  db.prepare('BEGIN TRANSACTION').run();
  try {
    const stmt = db.prepare('UPDATE students SET division = ? WHERE seat_no = ?');
    for (const { seatNo, division } of assignments) {
      if (!existingSeats.has(seatNo)) {
        unmatched.push(seatNo);
        continue;
      }
      stmt.run(division, seatNo);
      matched.push(seatNo);
    }
    db.prepare('COMMIT').run();
  } catch (err) {
    try { db.prepare('ROLLBACK').run(); } catch (_) {}
    throw err;
  }

  return { matched, unmatched };
}

// Clears all division assignments (used when the person wants to start the
// division mapping over from scratch).
export async function clearStudentDivisions(): Promise<void> {
  await runQuery('UPDATE students SET division = NULL');
}

