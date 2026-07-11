import Papa from "papaparse";
import * as XLSX from "xlsx";
import { parseParquet } from "./parquet";

export interface ParseResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  colCount: number;
  truncated: boolean;
}

export interface ParseOptions {
  /** Force a delimiter for csv/tsv/txt files. */
  delimiter?: string;
  /** Force the header row index (0-based, in the raw row stream). */
  headerRowIndex?: number;
  /** For Excel: pick a specific sheet by name. Defaults to the first sheet. */
  sheetName?: string;
}

const MAX_ROWS = 500_000;
const PREVIEW_ROWS = 50;
const DELIMITER_CANDIDATES = [";", ",", "\t", "|"] as const;

export async function parseFile(file: File, options?: ParseOptions): Promise<ParseResult> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "csv" || ext === "tsv" || ext === "txt") {
    const fallback = ext === "tsv" ? "\t" : undefined;
    return parseDelimited(file, options?.delimiter ?? fallback, options?.headerRowIndex);
  }
  if (ext === "json") {
    return parseJson(file);
  }
  if (ext === "xlsx" || ext === "xls") {
    return parseExcel(file, options?.sheetName);
  }
  if (ext === "parquet") {
    const { rows, truncated } = await parseParquet(file, MAX_ROWS);
    const colCount = rows[0] ? Object.keys(rows[0]).length : 0;
    return { rows, rowCount: rows.length, colCount, truncated };
  }
  throw new Error(`Unsupported file type: .${ext}`);
}

/** Inspect an Excel file and return the list of sheet names without parsing data. */
export async function inspectExcelSheets(file: File): Promise<string[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", bookSheets: true });
  return wb.SheetNames;
}

async function parseDelimited(
  file: File,
  preferredDelimiter?: string,
  forcedHeaderIndex?: number,
): Promise<ParseResult> {
  const text = await file.text();
  const delimiter = preferredDelimiter ?? detectDelimiter(text);
  const rawRows = await parseDelimitedRows(text, delimiter);

  if (rawRows.length === 0) {
    return { rows: [], rowCount: 0, colCount: 0, truncated: false };
  }

  const previewRows = rawRows.slice(0, PREVIEW_ROWS);
  const headerIndex =
    forcedHeaderIndex !== undefined && forcedHeaderIndex >= 0 && forcedHeaderIndex < rawRows.length
      ? forcedHeaderIndex
      : detectHeaderRowIndex(previewRows);
  const dataStartIndex = findDataStartIndex(rawRows, headerIndex + 1);
  const headerRows = collectHeaderRows(rawRows, headerIndex, dataStartIndex);
  const width = Math.max(
    1,
    ...headerRows.map((row) => row.length),
    ...rawRows.slice(dataStartIndex, dataStartIndex + 5).map((row) => row.length),
  );
  const headers = buildHeaders(headerRows, width);

  const rows: Record<string, unknown>[] = [];
  for (let i = dataStartIndex; i < rawRows.length; i++) {
    if (rows.length >= MAX_ROWS) break;
    const row = rawRows[i];
    if (isSeparatorRow(row) || countMeaningfulCells(row) === 0) continue;
    rows.push(rowToObject(row, headers));
  }

  const remainingDataRows = rawRows.slice(dataStartIndex).filter(
    (row) => !isSeparatorRow(row) && countMeaningfulCells(row) > 0,
  ).length;

  return {
    rows,
    rowCount: rows.length,
    colCount: headers.length,
    truncated: remainingDataRows > MAX_ROWS,
  };
}

function parseDelimitedRows(text: string, delimiter: string): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(text, {
      delimiter,
      skipEmptyLines: "greedy",
      error: (err) => reject(err),
      complete: (result) => {
        resolve(
          (result.data as string[][])
            .map((row) => row.map((cell) => normalizeCell(cell)))
            .filter((row) => row.some((cell) => cell !== "")),
        );
      },
    });
  });
}

function detectDelimiter(text: string): string {
  const lines = text
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 30);

  const scored = DELIMITER_CANDIDATES.map((candidate) => {
    const counts = lines.map((line) => countDelimiter(line, candidate));
    const active = counts.filter((count) => count > 0);
    const average = active.length ? active.reduce((sum, count) => sum + count, 0) / active.length : 0;
    return {
      candidate,
      score: active.length * 3 + average,
    };
  }).sort((a, b) => b.score - a.score);

  return scored[0]?.score ? scored[0].candidate : ",";
}

function countDelimiter(line: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && char === delimiter) count++;
  }

  return count;
}

function detectHeaderRowIndex(rows: string[][]): number {
  const firstDataIndex = rows.findIndex((row) => isDataLikeRow(row));
  const searchStart = firstDataIndex > 0 ? Math.max(0, firstDataIndex - 6) : 0;
  const searchEnd = firstDataIndex > 0 ? firstDataIndex : Math.min(rows.length, 20);

  let bestIndex = 0;
  let bestScore = -Infinity;

  for (let i = searchStart; i < searchEnd; i++) {
    const row = rows[i];
    if (isSeparatorRow(row)) continue;

    const meaningful = countMeaningfulCells(row);
    if (meaningful < 2) continue;

    const cells = row.filter((cell) => isMeaningfulCell(cell));
    const uniqueRatio = cells.length ? new Set(cells.map((cell) => cell.toLowerCase())).size / cells.length : 0;
    const textRatio = cells.length ? cells.filter((cell) => !looksDataLike(cell)).length / cells.length : 0;
    const lookahead = rows.slice(i + 1, i + 7).filter((nextRow) => isDataLikeRow(nextRow)).length;
    const score = meaningful * 5 + uniqueRatio * 2 + textRatio * 3 + lookahead * 4;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function findDataStartIndex(rows: string[][], startIndex: number): number {
  for (let i = startIndex; i < rows.length; i++) {
    if (isDataLikeRow(rows[i])) return i;
  }

  for (let i = startIndex; i < rows.length; i++) {
    if (!isSeparatorRow(rows[i]) && countMeaningfulCells(rows[i]) > 0) return i;
  }

  return Math.min(startIndex, rows.length);
}

function collectHeaderRows(rows: string[][], headerIndex: number, dataStartIndex: number): string[][] {
  const collected: string[][] = [];

  for (let i = headerIndex; i < Math.min(dataStartIndex, headerIndex + 4); i++) {
    const row = rows[i];
    if (isSeparatorRow(row) || countMeaningfulCells(row) === 0) continue;
    collected.push(row);
  }

  return collected.length ? collected : [rows[headerIndex] ?? []];
}

function buildHeaders(headerRows: string[][], width: number): string[] {
  const normalizedRows = headerRows.map((row) => normalizeHeaderRow(row, width));
  const headers = Array.from({ length: width }, (_, index) => {
    const parts = normalizedRows
      .map((row) => row[index])
      .filter((cell, cellIndex, array) => isMeaningfulCell(cell) && array.indexOf(cell) === cellIndex);

    return parts.length ? parts.join(" · ") : `column_${index + 1}`;
  });

  return dedupeHeaders(headers);
}

function normalizeHeaderRow(row: string[], width: number): string[] {
  const normalized = Array.from({ length: width }, (_, index) => normalizeCell(row[index]));
  const nonEmptyCount = normalized.filter(Boolean).length;

  if (nonEmptyCount === 0 || nonEmptyCount / width >= 0.75) {
    return normalized;
  }

  let active = "";
  return normalized.map((cell) => {
    if (cell) {
      active = cell;
      return cell;
    }
    return active;
  });
}

function dedupeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();

  return headers.map((header, index) => {
    const clean = header.replace(/\s+/g, " ").trim() || `column_${index + 1}`;
    const key = clean.toLowerCase();
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    return count === 0 ? clean : `${clean}_${count + 1}`;
  });
}

function rowToObject(row: string[], headers: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  headers.forEach((header, index) => {
    out[header] = coerceDelimitedValue(row[index]);
  });

  return out;
}

function coerceDelimitedValue(value: string | undefined): unknown {
  const cell = normalizeCell(value);
  if (cell === "") return null;
  if (/^(true|false)$/i.test(cell)) return cell.toLowerCase() === "true";

  const numeric = cell.replace(/,/g, "");
  if (/^[-+]?\d*\.?\d+$/.test(numeric)) {
    const parsed = Number(numeric);
    if (Number.isFinite(parsed)) return parsed;
  }

  return cell;
}

function normalizeCell(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function isMeaningfulCell(cell: string): boolean {
  return cell !== "" && !isPunctuationOnly(cell);
}

function countMeaningfulCells(row: string[]): number {
  return row.filter((cell) => isMeaningfulCell(cell)).length;
}

function isSeparatorRow(row: string[]): boolean {
  const nonEmpty = row.filter((cell) => cell !== "");
  return nonEmpty.length > 0 && nonEmpty.every((cell) => isPunctuationOnly(cell));
}

function isPunctuationOnly(cell: string): boolean {
  return /^[^\p{L}\p{N}]+$/u.test(cell);
}

function isDataLikeRow(row: string[]): boolean {
  const meaningful = row.filter((cell) => isMeaningfulCell(cell));
  if (meaningful.length < 2) return false;

  const hits = meaningful.filter((cell) => looksDataLike(cell)).length;
  const ratio = hits / meaningful.length;

  return ratio >= 0.4 || (looksNumeric(meaningful[0]) && looksIdentifier(meaningful[1] ?? ""));
}

function looksDataLike(cell: string): boolean {
  return looksNumeric(cell) || looksBoolean(cell) || looksDate(cell) || looksIdentifier(cell);
}

function looksNumeric(cell: string): boolean {
  return /^[-+]?\d[\d,.]*$/.test(cell);
}

function looksBoolean(cell: string): boolean {
  return /^(true|false|yes|no|y|n)$/i.test(cell);
}

function looksDate(cell: string): boolean {
  return /^(\d{1,4}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}[./-][a-z]{3}[./-]\d{2,4})$/i.test(cell);
}

function looksIdentifier(cell: string): boolean {
  return /^[a-z]{0,5}\d+(?:[-_][a-z0-9]+)+$/i.test(cell);
}

async function parseJson(file: File): Promise<ParseResult> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  let rows: Record<string, unknown>[];
  if (Array.isArray(parsed)) {
    rows = parsed as Record<string, unknown>[];
  } else if (parsed && typeof parsed === "object") {
    const arrayProp = Object.values(parsed).find(Array.isArray) as Record<string, unknown>[] | undefined;
    if (!arrayProp) throw new Error("JSON must be an array of objects or contain an array property.");
    rows = arrayProp;
  } else {
    throw new Error("JSON must be an array of objects.");
  }
  const truncated = rows.length > MAX_ROWS;
  if (truncated) rows = rows.slice(0, MAX_ROWS);
  const colCount = rows[0] ? Object.keys(rows[0]).length : 0;
  return { rows, rowCount: rows.length, colCount, truncated };
}

async function parseExcel(file: File, sheetName?: string): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const targetSheet = sheetName && wb.Sheets[sheetName] ? sheetName : wb.SheetNames[0];
  const ws = wb.Sheets[targetSheet];
  let rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  const truncated = rows.length > MAX_ROWS;
  if (truncated) rows = rows.slice(0, MAX_ROWS);
  const colCount = rows[0] ? Object.keys(rows[0]).length : 0;
  return { rows, rowCount: rows.length, colCount, truncated };
}

export function sanitizeRowsForLLM(rows: Record<string, unknown>[], maxCellLen = 500): Record<string, unknown>[] {
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      const safeKey = k.slice(0, 100);
      if (typeof v === "string") {
        let s = v;
        if (/^[=+\-@]/.test(s)) s = "'" + s;
        if (s.length > maxCellLen) s = s.slice(0, maxCellLen) + "…";
        out[safeKey] = s;
      } else {
        out[safeKey] = v;
      }
    }
    return out;
  });
}
