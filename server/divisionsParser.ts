import * as XLSX from 'xlsx';

export interface DivisionAssignment {
  seatNo: string;
  division: string;
}

export interface ParsedDivisions {
  assignments: DivisionAssignment[];
  divisionNames: string[];
}

function normalizeSeatNo(value: unknown): string {
  return String(value ?? '').trim();
}

function looksLikeHeaderCell(value: unknown): boolean {
  const text = String(value ?? '').trim().toLowerCase();
  return /^(seat|roll|division|section|sec\b|name|student)/i.test(text);
}

function sheetHasContent(rows: unknown[][]): boolean {
  return rows.some(row => row.some(cell => String(cell ?? '').trim().length > 0));
}

/**
 * Parses a student-division mapping workbook. People naturally build this
 * kind of sheet in one of a few different shapes, so all of these are
 * auto-detected rather than requiring one exact format:
 *
 *  A) One sheet per division - sheet is named "Sec-A"/"Sec B"/etc, and the
 *     first column lists that division's seat numbers.
 *  B) One sheet, two columns - a "Seat No" column and a "Division" column.
 *  C) One sheet, one column per division - each column is headed with a
 *     division name ("Sec-A", "Sec-B", ...) and seat numbers are listed
 *     downward beneath it.
 */
export function parseDivisionsWorkbook(buffer: Buffer): ParsedDivisions {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const assignments: DivisionAssignment[] = [];
  const divisionNamesSeen = new Set<string>();

  const nonEmptySheetNames = workbook.SheetNames.filter(name => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1 });
    return sheetHasContent(rows);
  });

  if (nonEmptySheetNames.length === 0) {
    return { assignments: [], divisionNames: [] };
  }

  // Strategy A: multiple sheets, each sheet is one division.
  if (nonEmptySheetNames.length > 1) {
    for (const sheetName of nonEmptySheetNames) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1 });
      const divisionName = sheetName.trim();
      let addedAny = false;

      for (const row of rows) {
        const cell = row[0];
        if (cell === undefined || cell === null || String(cell).trim() === '') continue;
        if (looksLikeHeaderCell(cell)) continue;
        const seatNo = normalizeSeatNo(cell);
        if (!/\d/.test(seatNo)) continue;
        assignments.push({ seatNo, division: divisionName });
        addedAny = true;
      }

      if (addedAny) divisionNamesSeen.add(divisionName);
    }

    if (assignments.length > 0) {
      return { assignments, divisionNames: [...divisionNamesSeen] };
    }
    // Fall through to single-sheet strategies if none of the sheets actually
    // yielded seat numbers (e.g. it was a single real sheet plus some blank
    // template sheets that just happened to have stray content).
  }

  const primarySheetName = nonEmptySheetNames[0];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[primarySheetName], { header: 1 });
  if (rows.length === 0) return { assignments: [], divisionNames: [] };

  const headerRow = (rows[0] as unknown[]).map(cell => String(cell ?? '').trim());
  const seatColIndex = headerRow.findIndex(h => /seat|roll/i.test(h));
  const divisionColIndex = headerRow.findIndex(h => /division|section|\bsec\b/i.test(h));

  // Strategy B: two-column format (Seat No, Division).
  if (seatColIndex >= 0 && divisionColIndex >= 0) {
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i] as unknown[];
      const seatNo = normalizeSeatNo(row[seatColIndex]);
      const division = String(row[divisionColIndex] ?? '').trim();
      if (!seatNo || !division) continue;
      assignments.push({ seatNo, division });
      divisionNamesSeen.add(division);
    }
    return { assignments, divisionNames: [...divisionNamesSeen] };
  }

  // Strategy C: each column is its own division.
  const candidateColumns = headerRow
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => header.length > 0 && !/seat|roll|name|student/i.test(header));

  for (const { header, index } of candidateColumns) {
    let addedAny = false;
    for (let r = 1; r < rows.length; r += 1) {
      const cell = (rows[r] as unknown[])[index];
      if (cell === undefined || cell === null || String(cell).trim() === '') continue;
      const seatNo = normalizeSeatNo(cell);
      if (!/\d/.test(seatNo)) continue;
      assignments.push({ seatNo, division: header });
      addedAny = true;
    }
    if (addedAny) divisionNamesSeen.add(header);
  }

  return { assignments, divisionNames: [...divisionNamesSeen] };
}
