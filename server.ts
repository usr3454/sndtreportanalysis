import express from 'express';
import fs from 'fs';
import archiver from 'archiver';
import { createServer as createHttpServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { initDatabase, saveParsedData, allQuery, getQuery, deleteUpload, updateStudentSubjects, updateStudentDivisions, clearStudentDivisions } from './server/database';
import { parsePdfResult } from './server/parser';
import { parseDivisionsWorkbook } from './server/divisionsParser';
import { calculateAnalytics, calculateStudentAnalysis } from './server/analytics';
import { generateSamplePdf } from './server/sampleGenerator';
import { exportToExcel, exportToCsv } from './server/export';
import { generateIndividualReportPdf, generateClassPdf } from './server/pdfReport';
import { Student, SubjectMark, Upload } from './src/types';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

function listenWithFallback(app: express.Express, host: string, startPort: number) {
  const tryListen = (port: number) => {
    const server = createHttpServer(app);

    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE' && port < startPort + 10) {
        console.warn(`Port ${port} is busy. Trying ${port + 1} instead.`);
        server.close();
        tryListen(port + 1);
        return;
      }

      console.error(`Failed to start server on ${host}:${port}`, error);
      process.exit(1);
    });

    server.listen(port, host, () => {
      console.log(`Server successfully started on http://${host}:${port}`);
    });
  };

  tryListen(startPort);
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT ?? '3000', 10);

  // Initialize SQLite database tables
  try {
    await initDatabase();
  } catch (err) {
    console.error('CRITICAL: Failed to initialize SQLite database:', err);
  }

  // Middleware
  app.use(express.json({ limit: '50mb' }));

  // --- API ROUTES FIRST ---

  // 1. Get parsed uploads
  app.get('/api/uploads', async (req, res) => {
    try {
      const uploads = await allQuery<Upload>('SELECT * FROM uploads ORDER BY upload_date DESC');
      res.json({ success: true, uploads });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Delete a parsed upload
  app.delete('/api/uploads/:id', async (req, res) => {
    try {
      const uploadId = req.params.id;
      await deleteUpload(uploadId);
      res.json({ success: true, message: 'Upload successfully deleted.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Upload a PDF or Result Sheet file (Offline Engine)
  app.post(
    '/api/upload-pdf',
    express.raw({ type: ['application/pdf', 'image/*', 'application/octet-stream'], limit: '50mb' }),
    async (req, res) => {
      try {
        const buffer = req.body;
        const filename = (req.headers['x-filename'] as string) || `result_${Date.now()}.pdf`;

        if (!buffer || buffer.length === 0) {
          return res.status(400).json({ success: false, error: 'Empty file buffer received.' });
        }

        console.log(`Processing offline file upload: ${filename} (${buffer.length} bytes)`);

        const parseResult = await parsePdfResult(buffer, filename);

        if (parseResult.students.length > 0) {
          console.log(`Saving offline parsed dataset: ${parseResult.students.length} students to SQLite.`);
          await saveParsedData(parseResult.upload, parseResult.students, parseResult.subjects);

          res.json({
            success: true,
            upload: parseResult.upload,
            studentCount: parseResult.students.length,
            errors: parseResult.errors,
          });
          return;
        }

        // Nothing was parsed - this almost always means the file's layout
        // doesn't match the register format this parser understands (e.g.
        // a different university's column structure). Report this as a
        // genuine failure rather than a hollow "success" - previously this
        // still returned success: true with studentCount: 0, which showed
        // a misleading green checkmark in the UI while quietly leaving
        // whatever dataset was already in the database untouched, making
        // it look like the new file's data had silently "become" the old
        // export.
        console.warn(`No students could be parsed from: ${filename}`);
        res.status(422).json({
          success: false,
          error:
            'No students could be parsed from this file. The register format was not recognized (this parser supports Mumbai University office registers and SNDT Women\'s University result ledgers; other layouts are not supported yet). Any previously uploaded dataset has been left untouched.',
          errors: parseResult.errors,
        });
      } catch (err: any) {
        console.error('Offline PDF parsing/upload error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    }
  );

  // 3.4 List distinct colleges present in the current dataset, for filtering exports
  app.get('/api/colleges', async (req, res) => {
    try {
      const colleges = await allQuery<{ college_code: string; college_name: string }>(
        `SELECT DISTINCT college_code, college_name FROM students WHERE college_code IS NOT NULL AND college_code != '' ORDER BY college_code ASC`
      );
      res.json({
        success: true,
        colleges: colleges.map(c => ({ code: c.college_code, name: c.college_name })),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3.4.1 Upload a student-to-division mapping (e.g. Sec-A/Sec-B/Sec-C), so
  // exports can be split into one sheet per division.
  app.post(
    '/api/upload-divisions',
    express.raw({
      type: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream',
      ],
      limit: '10mb',
    }),
    async (req, res) => {
      try {
        const buffer = req.body;
        if (!buffer || buffer.length === 0) {
          return res.status(400).json({ success: false, error: 'Empty file buffer received.' });
        }

        const studentCountRow = await getQuery<{ count: number }>('SELECT COUNT(*) as count FROM students');
        if (!studentCountRow || studentCountRow.count === 0) {
          return res.status(400).json({
            success: false,
            error: 'Upload a result PDF first - there are no students to assign divisions to yet.',
          });
        }

        const { assignments, divisionNames } = parseDivisionsWorkbook(Buffer.from(buffer));
        if (assignments.length === 0) {
          return res.status(422).json({
            success: false,
            error:
              "Couldn't detect any seat number / division pairs in this file. Supported formats: one sheet per division (sheet name = division, seat numbers listed below), a two-column sheet (Seat No, Division), or one column per division with seat numbers listed underneath each division's header.",
          });
        }

        const { matched, unmatched } = await updateStudentDivisions(assignments);

        res.json({
          success: true,
          divisionsFound: divisionNames,
          matchedCount: matched.length,
          unmatchedCount: unmatched.length,
          unmatchedSeatNos: unmatched.slice(0, 50),
        });
      } catch (err: any) {
        console.error('Divisions upload error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    }
  );

  // 3.4.2 Current division assignment summary
  app.get('/api/divisions', async (req, res) => {
    try {
      const rows = await allQuery<{ division: string | null; count: number }>(
        `SELECT division, COUNT(*) as count FROM students GROUP BY division`
      );
      const divisions = rows
        .filter(r => r.division && r.division.trim() !== '')
        .map(r => ({ name: r.division as string, count: r.count }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const unassignedRow = rows.find(r => !r.division || r.division.trim() === '');

      res.json({
        success: true,
        divisions,
        unassignedCount: unassignedRow?.count ?? 0,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3.4.3 Clear all division assignments
  app.delete('/api/divisions', async (req, res) => {
    try {
      await clearStudentDivisions();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3.5 Update / Allocate subject marks for a student directly
  app.put('/api/students/:seatNo/subjects', async (req, res) => {
    try {
      const seatNo = req.params.seatNo;
      const { subjects } = req.body as { subjects: SubjectMark[] };

      if (!Array.isArray(subjects)) {
        return res.status(400).json({ success: false, error: 'Invalid subjects payload format.' });
      }

      await updateStudentSubjects(seatNo, subjects);
      res.json({ success: true, message: 'Student subject marks successfully updated.' });
    } catch (err: any) {
      console.error('Error updating student subjects:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });


  // 4. Download a pre-formatted mock result register PDF
  app.get('/api/sample-pdf', (req, res) => {
    try {
      const count = parseInt(req.query.count as string, 10) || 50;
      console.log(`Generating mock register for: ${count} students`);
      const buffer = generateSamplePdf(count);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="sample_results_${count}_students.pdf"`);
      res.end(buffer);
    } catch (err: any) {
      console.error('Sample generation error:', err);
      res.status(500).send(`Error generating sample: ${err.message}`);
    }
  });

  // 5. Query and filter student registers
  app.get('/api/students', async (req, res) => {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const search = (req.query.search as string || '').trim();
      const branch = req.query.branch as string || '';
      const semester = req.query.semester as string || '';
      const status = req.query.status as string || ''; // Pass, Fail, KT
      const sgpaMin = parseFloat(req.query.sgpaMin as string) || 0;
      const sgpaMax = parseFloat(req.query.sgpaMax as string) || 10;
      const sortBy = req.query.sortBy as string || 'sgpa';
      const sortOrder = req.query.sortOrder as string || 'DESC';

      const whereClauses = ['1=1'];
      const params: any[] = [];

      if (search) {
        whereClauses.push('(name LIKE ? OR seat_no LIKE ? OR roll_no LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }
      if (branch) {
        whereClauses.push('branch = ?');
        params.push(branch);
      }
      if (semester) {
        whereClauses.push('semester = ?');
        params.push(semester);
      }
      if (status) {
        whereClauses.push('result_status = ?');
        params.push(status);
      }
      if (sgpaMin > 0 || sgpaMax < 10) {
        whereClauses.push('sgpa >= ? AND sgpa <= ?');
        params.push(sgpaMin, sgpaMax);
      }

      // Security sanitization for ORDER BY parameters
      const allowedFields = ['seat_no', 'roll_no', 'name', 'sgpa', 'cgpa', 'credits', 'result_status'];
      const cleanSortBy = allowedFields.includes(sortBy) ? sortBy : 'sgpa';
      const cleanSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      const offset = (page - 1) * limit;
      const whereSql = whereClauses.join(' AND ');

      // Total count
      const totalCountRow = await getQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM students WHERE ${whereSql}`,
        params
      );
      const total = totalCountRow?.count || 0;

      // Paginated result
      const students = await allQuery<any>(
        `SELECT * FROM students WHERE ${whereSql} ORDER BY ${cleanSortBy} ${cleanSortOrder} LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      const camelStudents = students.map(s => ({
        seatNo: s.seat_no,
        uploadId: s.upload_id,
        rollNo: s.roll_no,
        name: s.name,
        motherName: s.mother_name,
        enrollmentNo: s.enrollment_no,
        branch: s.branch,
        semester: s.semester,
        collegeCode: s.college_code,
        collegeName: s.college_name,
        division: s.division || undefined,
        sgpa: s.sgpa,
        cgpa: s.cgpa,
        credits: s.credits,
        resultStatus: s.result_status,
        ktCount: s.kt_count,
        subjects: [] as SubjectMark[]
      }));

      if (camelStudents.length > 0) {
        const seatNumbers = camelStudents.map(s => s.seatNo);
        const placeholders = seatNumbers.map(() => '?').join(',');
        const dbSubjects = await allQuery<any>(
          `SELECT * FROM student_subjects WHERE seat_no IN (${placeholders})`,
          seatNumbers
        );

        const subjectsMap: { [seatNo: string]: SubjectMark[] } = {};
        dbSubjects.forEach(sub => {
          if (!subjectsMap[sub.seat_no]) {
            subjectsMap[sub.seat_no] = [];
          }
          subjectsMap[sub.seat_no].push({
            seatNo: sub.seat_no,
            uploadId: sub.upload_id,
            subjectCode: sub.subject_code,
            subjectName: sub.subject_name,
            internalMarks: sub.internal_marks,
            externalMarks: sub.external_marks,
            practicalMarks: sub.practical_marks,
            termWork: sub.term_work,
            oral: sub.oral,
            totalMarks: sub.total_marks,
            credits: sub.credits,
            grade: sub.grade,
            status: sub.status
          });
        });

        camelStudents.forEach(student => {
          student.subjects = subjectsMap[student.seatNo] || [];
        });
      }

      res.json({
        success: true,
        students: camelStudents,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6. Get aggregate dashboard analytics
  app.get('/api/analytics', async (req, res) => {
    try {
      const students = await allQuery<any>('SELECT * FROM students');
      const subjects = await allQuery<any>('SELECT * FROM student_subjects');

      const formattedStudents: Student[] = students.map(s => ({
        seatNo: s.seat_no,
        uploadId: s.upload_id,
        rollNo: s.roll_no,
        name: s.name,
        motherName: s.mother_name,
        enrollmentNo: s.enrollment_no,
        branch: s.branch,
        semester: s.semester,
        collegeCode: s.college_code,
        collegeName: s.college_name,
        division: s.division || undefined,
        sgpa: s.sgpa,
        cgpa: s.cgpa,
        credits: s.credits,
        resultStatus: s.result_status,
        ktCount: s.kt_count
      }));

      const formattedSubjects: SubjectMark[] = subjects.map(sub => ({
        seatNo: sub.seat_no,
        uploadId: sub.upload_id,
        subjectCode: sub.subject_code,
        subjectName: sub.subject_name,
        internalMarks: sub.internal_marks,
        externalMarks: sub.external_marks,
        practicalMarks: sub.practical_marks,
        termWork: sub.term_work,
        oral: sub.oral,
        totalMarks: sub.total_marks,
        credits: sub.credits,
        grade: sub.grade,
        status: sub.status
      }));

      const analytics = calculateAnalytics(formattedStudents, formattedSubjects);
      res.json({ success: true, analytics });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 7. Get details of a single student with marks and diagnostics
  app.get('/api/students/:seatNo', async (req, res) => {
    try {
      const seatNo = req.params.seatNo;
      const s = await getQuery<any>('SELECT * FROM students WHERE seat_no = ?', [seatNo]);
      if (!s) {
        return res.status(404).json({ success: false, error: 'Student record not found.' });
      }

      const subjects = await allQuery<any>('SELECT * FROM student_subjects WHERE seat_no = ?', [seatNo]);
      const allStudents = await allQuery<any>('SELECT sgpa, seat_no FROM students');

      const studentObj: Student = {
        seatNo: s.seat_no,
        uploadId: s.upload_id,
        rollNo: s.roll_no,
        name: s.name,
        motherName: s.mother_name,
        enrollmentNo: s.enrollment_no,
        branch: s.branch,
        semester: s.semester,
        collegeCode: s.college_code,
        collegeName: s.college_name,
        division: s.division || undefined,
        sgpa: s.sgpa,
        cgpa: s.cgpa,
        credits: s.credits,
        resultStatus: s.result_status,
        ktCount: s.kt_count
      };

      const subjectsObj: SubjectMark[] = subjects.map(sub => ({
        seatNo: sub.seat_no,
        uploadId: sub.upload_id,
        subjectCode: sub.subject_code,
        subjectName: sub.subject_name,
        internalMarks: sub.internal_marks,
        externalMarks: sub.external_marks,
        practicalMarks: sub.practical_marks,
        termWork: sub.term_work,
        oral: sub.oral,
        totalMarks: sub.total_marks,
        credits: sub.credits,
        grade: sub.grade,
        status: sub.status
      }));

      const allStudentsObj: Student[] = allStudents.map(stud => ({
        seatNo: stud.seat_no,
        uploadId: '',
        rollNo: '',
        name: '',
        motherName: '',
        enrollmentNo: '',
        branch: '',
        semester: '',
        collegeCode: '',
        collegeName: '',
        sgpa: stud.sgpa,
        cgpa: 0,
        credits: 0,
        resultStatus: 'Pass',
        ktCount: 0
      }));

      const analysis = calculateStudentAnalysis(studentObj, allStudentsObj, subjectsObj);

      res.json({
        success: true,
        student: studentObj,
        subjects: subjectsObj,
        analysis
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 8. Export records database to Excel
  app.get('/api/export/excel', async (req, res) => {
    try {
      const collegeCode = (req.query.collegeCode as string || '').trim();
      const students = collegeCode
        ? await allQuery<any>('SELECT * FROM students WHERE college_code = ?', [collegeCode])
        : await allQuery<any>('SELECT * FROM students');

      const seatNos = students.map(s => s.seat_no);
      const subjects = seatNos.length > 0
        ? await allQuery<any>(
            `SELECT * FROM student_subjects WHERE seat_no IN (${seatNos.map(() => '?').join(',')})`,
            seatNos
          )
        : [];

      const formattedStudents: Student[] = students.map(s => ({
        seatNo: s.seat_no,
        uploadId: s.upload_id,
        rollNo: s.roll_no,
        name: s.name,
        motherName: s.mother_name,
        enrollmentNo: s.enrollment_no,
        branch: s.branch,
        semester: s.semester,
        collegeCode: s.college_code,
        collegeName: s.college_name,
        division: s.division || undefined,
        sgpa: s.sgpa,
        cgpa: s.cgpa,
        credits: s.credits,
        resultStatus: s.result_status,
        ktCount: s.kt_count
      }));

      const formattedSubjects: SubjectMark[] = subjects.map(sub => ({
        seatNo: sub.seat_no,
        uploadId: sub.upload_id,
        subjectCode: sub.subject_code,
        subjectName: sub.subject_name,
        internalMarks: sub.internal_marks,
        externalMarks: sub.external_marks,
        practicalMarks: sub.practical_marks,
        termWork: sub.term_work,
        oral: sub.oral,
        totalMarks: sub.total_marks,
        credits: sub.credits,
        grade: sub.grade,
        status: sub.status
      }));

      const analytics = calculateAnalytics(formattedStudents, formattedSubjects);
      const buffer = exportToExcel(formattedStudents, formattedSubjects, analytics);

      const filenameSuffix = collegeCode ? `_${collegeCode.replace(/[^A-Za-z0-9-]/g, '')}` : '';
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="universal_result_analysis${filenameSuffix}.xlsx"`);
      res.end(buffer);
    } catch (err: any) {
      res.status(500).send(`Error exporting to Excel: ${err.message}`);
    }
  });

  // 9. Export records database to CSV
  app.get('/api/export/csv', async (req, res) => {
    try {
      const collegeCode = (req.query.collegeCode as string || '').trim();
      const students = collegeCode
        ? await allQuery<any>('SELECT * FROM students WHERE college_code = ?', [collegeCode])
        : await allQuery<any>('SELECT * FROM students');

      const formattedStudents: Student[] = students.map(s => ({
        seatNo: s.seat_no,
        uploadId: s.upload_id,
        rollNo: s.roll_no,
        name: s.name,
        motherName: s.mother_name,
        enrollmentNo: s.enrollment_no,
        branch: s.branch,
        semester: s.semester,
        collegeCode: s.college_code,
        collegeName: s.college_name,
        division: s.division || undefined,
        sgpa: s.sgpa,
        cgpa: s.cgpa,
        credits: s.credits,
        resultStatus: s.result_status,
        ktCount: s.kt_count
      }));

      const csv = exportToCsv(formattedStudents);
      const filenameSuffix = collegeCode ? `_${collegeCode.replace(/[^A-Za-z0-9-]/g, '')}` : '';
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="students_list${filenameSuffix}.csv"`);
      res.end(csv);
    } catch (err: any) {
      res.status(500).send(`Error exporting to CSV: ${err.message}`);
    }
  });

  // 10. Export records database to nested JSON
  app.get('/api/export/json', async (req, res) => {
    try {
      const students = await allQuery<any>('SELECT * FROM students');
      const subjects = await allQuery<any>('SELECT * FROM student_subjects');

      const nestedStudents = students.map(s => {
        const subList = subjects.filter(sub => sub.seat_no === s.seat_no).map(sub => ({
          subjectCode: sub.subject_code,
          subjectName: sub.subject_name,
          internalMarks: sub.internal_marks,
          externalMarks: sub.external_marks,
          totalMarks: sub.total_marks,
          credits: sub.credits,
          grade: sub.grade,
          status: sub.status
        }));

        return {
          seatNo: s.seat_no,
          rollNo: s.roll_no,
          name: s.name,
          motherName: s.mother_name,
          enrollmentNo: s.enrollment_no,
          branch: s.branch,
          semester: s.semester,
        collegeCode: s.college_code,
        collegeName: s.college_name,
        division: s.division || undefined,
          sgpa: s.sgpa,
          cgpa: s.cgpa,
          credits: s.credits,
          resultStatus: s.result_status,
          ktCount: s.kt_count,
          subjects: subList
        };
      });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="students_nested_records.json"');
      res.end(JSON.stringify(nestedStudents, null, 2));
    } catch (err: any) {
      res.status(500).send(`Error exporting to JSON: ${err.message}`);
    }
  });

  // 11. Export complete class list to PDF
  app.get('/api/export/pdf/class', async (req, res) => {
    try {
      const students = await allQuery<any>('SELECT * FROM students ORDER BY sgpa DESC');
      const subjects = await allQuery<any>('SELECT * FROM student_subjects');

      const formattedStudents: Student[] = students.map(s => ({
        seatNo: s.seat_no,
        uploadId: s.upload_id,
        rollNo: s.roll_no,
        name: s.name,
        motherName: s.mother_name,
        enrollmentNo: s.enrollment_no,
        branch: s.branch,
        semester: s.semester,
        collegeCode: s.college_code,
        collegeName: s.college_name,
        division: s.division || undefined,
        sgpa: s.sgpa,
        cgpa: s.cgpa,
        credits: s.credits,
        resultStatus: s.result_status,
        ktCount: s.kt_count
      }));

      const formattedSubjects: SubjectMark[] = subjects.map(sub => ({
        seatNo: sub.seat_no,
        uploadId: sub.upload_id,
        subjectCode: sub.subject_code,
        subjectName: sub.subject_name,
        internalMarks: sub.internal_marks,
        externalMarks: sub.external_marks,
        practicalMarks: sub.practical_marks,
        termWork: sub.term_work,
        oral: sub.oral,
        totalMarks: sub.total_marks,
        credits: sub.credits,
        grade: sub.grade,
        status: sub.status
      }));

      const analytics = calculateAnalytics(formattedStudents, formattedSubjects);
      const buffer = generateClassPdf(formattedStudents, analytics);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="complete_class_registry.pdf"');
      res.end(buffer);
    } catch (err: any) {
      res.status(500).send(`Error generating class PDF: ${err.message}`);
    }
  });

  // 11.5 Bulk-generate every student's individual report card PDF, zipped
  app.get('/api/export/pdf/individual-all', async (req, res) => {
    try {
      const collegeCode = (req.query.collegeCode as string || '').trim();
      const students = collegeCode
        ? await allQuery<any>('SELECT * FROM students WHERE college_code = ?', [collegeCode])
        : await allQuery<any>('SELECT * FROM students');

      if (students.length === 0) {
        return res.status(404).json({ success: false, error: 'No students found for the requested filter.' });
      }

      const allSgpaRows = await allQuery<{ sgpa: number; seat_no: string }>('SELECT sgpa, seat_no FROM students');
      const allStudentsForRanking: Student[] = allSgpaRows.map(stud => ({
        seatNo: stud.seat_no,
        uploadId: '',
        rollNo: '',
        name: '',
        motherName: '',
        enrollmentNo: '',
        branch: '',
        semester: '',
        collegeCode: '',
        collegeName: '',
        sgpa: stud.sgpa,
        cgpa: 0,
        credits: 0,
        resultStatus: 'Pass',
        ktCount: 0
      }));

      const filenameSuffix = collegeCode ? `_${collegeCode.replace(/[^A-Za-z0-9-]/g, '')}` : '';
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="individual_report_cards${filenameSuffix}.zip"`);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (err) => {
        console.error('Archive error during bulk PDF export:', err);
        res.status(500).end();
      });
      archive.pipe(res);

      const usedFilenames = new Set<string>();

      for (const s of students) {
        const subjectsRaw = await allQuery<any>('SELECT * FROM student_subjects WHERE seat_no = ?', [s.seat_no]);
        const formattedSubjects: SubjectMark[] = subjectsRaw.map(sub => ({
          seatNo: sub.seat_no,
          uploadId: sub.upload_id,
          subjectCode: sub.subject_code,
          subjectName: sub.subject_name,
          internalMarks: sub.internal_marks,
          externalMarks: sub.external_marks,
          practicalMarks: sub.practical_marks,
          termWork: sub.term_work,
          oral: sub.oral,
          totalMarks: sub.total_marks,
          credits: sub.credits,
          grade: sub.grade,
          status: sub.status
        }));

        const formattedStudent: Student = {
          seatNo: s.seat_no,
          uploadId: s.upload_id,
          rollNo: s.roll_no,
          name: s.name,
          motherName: s.mother_name,
          enrollmentNo: s.enrollment_no,
          branch: s.branch,
          semester: s.semester,
          collegeCode: s.college_code,
          collegeName: s.college_name,
          division: s.division || undefined,
          sgpa: s.sgpa,
          cgpa: s.cgpa,
          credits: s.credits,
          resultStatus: s.result_status,
          ktCount: s.kt_count
        };

        const analysis = calculateStudentAnalysis(formattedStudent, allStudentsForRanking, formattedSubjects);
        const pdfBuffer = generateIndividualReportPdf(formattedStudent, formattedSubjects, analysis);

        // Guard against duplicate/unsafe filenames within the zip.
        const safeSeat = String(s.seat_no).replace(/[^A-Za-z0-9_-]/g, '') || 'unknown';
        let entryName = `report_card_${safeSeat}.pdf`;
        let dedupeIndex = 2;
        while (usedFilenames.has(entryName)) {
          entryName = `report_card_${safeSeat}_${dedupeIndex}.pdf`;
          dedupeIndex += 1;
        }
        usedFilenames.add(entryName);

        archive.append(pdfBuffer, { name: entryName });
      }

      await archive.finalize();
    } catch (err: any) {
      console.error('Bulk individual PDF export error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: `Error generating bulk individual PDFs: ${err.message}` });
      } else {
        res.end();
      }
    }
  });

  // 12. Export individual student report card to PDF
  app.get('/api/export/pdf/student/:seatNo', async (req, res) => {
    try {
      const seatNo = req.params.seatNo;
      const s = await getQuery<any>('SELECT * FROM students WHERE seat_no = ?', [seatNo]);
      if (!s) {
        return res.status(404).send('Student not found.');
      }

      const subjects = await allQuery<any>('SELECT * FROM student_subjects WHERE seat_no = ?', [seatNo]);
      const allStudents = await allQuery<any>('SELECT sgpa, seat_no FROM students');

      const formattedStudent: Student = {
        seatNo: s.seat_no,
        uploadId: s.upload_id,
        rollNo: s.roll_no,
        name: s.name,
        motherName: s.mother_name,
        enrollmentNo: s.enrollment_no,
        branch: s.branch,
        semester: s.semester,
        collegeCode: s.college_code,
        collegeName: s.college_name,
        division: s.division || undefined,
        sgpa: s.sgpa,
        cgpa: s.cgpa,
        credits: s.credits,
        resultStatus: s.result_status,
        ktCount: s.kt_count
      };

      const formattedSubjects: SubjectMark[] = subjects.map(sub => ({
        seatNo: sub.seat_no,
        uploadId: sub.upload_id,
        subjectCode: sub.subject_code,
        subjectName: sub.subject_name,
        internalMarks: sub.internal_marks,
        externalMarks: sub.external_marks,
        practicalMarks: sub.practical_marks,
        termWork: sub.term_work,
        oral: sub.oral,
        totalMarks: sub.total_marks,
        credits: sub.credits,
        grade: sub.grade,
        status: sub.status
      }));

      const formattedAllStudents: Student[] = allStudents.map(stud => ({
        seatNo: stud.seat_no,
        uploadId: '',
        rollNo: '',
        name: '',
        motherName: '',
        enrollmentNo: '',
        branch: '',
        semester: '',
        collegeCode: '',
        collegeName: '',
        sgpa: stud.sgpa,
        cgpa: 0,
        credits: 0,
        resultStatus: 'Pass',
        ktCount: 0
      }));

      const analysis = calculateStudentAnalysis(formattedStudent, formattedAllStudents, formattedSubjects);
      const buffer = generateIndividualReportPdf(formattedStudent, formattedSubjects, analysis);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="report_card_${seatNo}.pdf"`);
      res.end(buffer);
    } catch (err: any) {
      res.status(500).send(`Error generating individual PDF: ${err.message}`);
    }
  });


 // --- VITE DEV MIDDLEWARE AND STATIC SERVING ---

const distPath = path.join(process.cwd(), 'dist');

if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
  root: ROOT_DIR,
    server: {
      middlewareMode: true,
      host: '0.0.0.0',
      hmr: false,
      watch: null,
    },
    appType: 'spa',
  });

  app.use(vite.middlewares);

 app.use('*', async (req, res, next) => {
  try {
    const url = req.originalUrl;

    let template = await fs.promises.readFile(
      path.join(ROOT_DIR, 'index.html'),
      'utf-8'
    );

    template = await vite.transformIndexHtml(url, template);

    res.status(200)
      .set({ 'Content-Type': 'text/html' })
      .end(template);

  } catch (e) {
    vite.ssrFixStacktrace(e as Error);
    next(e);
  }
});

  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  listenWithFallback(app, '0.0.0.0', PORT);
}

startServer();
