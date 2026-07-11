/**
 * Per-column statistics computed client-side after parsing a file.
 * Sent to the agentic edge function as compact context for Claude/Gemini.
 */

export type ColumnType = "numeric" | "categorical" | "date" | "boolean" | "unknown";

export interface NumericStats {
  type: "numeric";
  mean: number;
  median: number;
  std_dev: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
  p95: number;
  null_count: number;
  null_pct: number;
  unique_count: number;
  zero_count: number;
  negative_count: number;
  is_monotonic_increasing: boolean;
  is_monotonic_decreasing: boolean;
  skewness: number;
  top_5_values: { value: number; count: number }[];
}

export interface CategoricalStats {
  type: "categorical";
  unique_count: number;
  top_10_values: { value: string; count: number }[];
  null_count: number;
  null_pct: number;
  avg_string_length: number;
  min_length: number;
  max_length: number;
  looks_like_email: boolean;
  looks_like_date: boolean;
  looks_like_id: boolean;
}

export interface DateStats {
  type: "date";
  min_date: string;
  max_date: string;
  date_range_days: number;
  most_common_weekday: string;
  has_gaps: boolean;
  frequency_mode: "day" | "week" | "month" | "irregular";
  null_count: number;
  null_pct: number;
}

export type ColumnStats = NumericStats | CategoricalStats | DateStats;

export interface ColumnInfo {
  name: string;
  type: ColumnType;
  stats: ColumnStats | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{2,4}/;
const ID_RE = /^[A-Z0-9_-]{6,}$/i;

function isNullish(v: unknown): boolean {
  return v === null || v === undefined || v === "" || (typeof v === "number" && Number.isNaN(v));
}

function toNumber(v: unknown): number | null {
  if (isNullish(v)) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/,/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  return sorted[base];
}

function inferType(values: unknown[]): ColumnType {
  const sample = values.filter((v) => !isNullish(v)).slice(0, 200);
  if (sample.length === 0) return "unknown";

  let numericHits = 0;
  let dateHits = 0;
  let boolHits = 0;
  for (const v of sample) {
    if (typeof v === "boolean") boolHits++;
    else if (toNumber(v) !== null) numericHits++;
    else if (typeof v === "string" && DATE_RE.test(v)) dateHits++;
    else if (v instanceof Date) dateHits++;
  }
  const total = sample.length;
  if (boolHits / total > 0.9) return "boolean";
  if (numericHits / total > 0.85) return "numeric";
  if (dateHits / total > 0.7) return "date";
  return "categorical";
}

function computeNumericStats(values: unknown[]): NumericStats {
  const nums: number[] = [];
  let nulls = 0;
  for (const v of values) {
    const n = toNumber(v);
    if (n === null) nulls++;
    else nums.push(n);
  }
  const sorted = [...nums].sort((a, b) => a - b);
  const n = nums.length;
  const mean = n ? nums.reduce((a, b) => a + b, 0) / n : 0;
  const median = quantile(sorted, 0.5);
  const variance = n ? nums.reduce((a, b) => a + (b - mean) ** 2, 0) / n : 0;
  const std_dev = Math.sqrt(variance);

  const freq = new Map<number, number>();
  for (const v of nums) freq.set(v, (freq.get(v) ?? 0) + 1);
  const top_5_values = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([value, count]) => ({ value, count }));

  let inc = true;
  let dec = true;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] < nums[i - 1]) inc = false;
    if (nums[i] > nums[i - 1]) dec = false;
  }

  const skewness = std_dev === 0 ? 0 : (3 * (mean - median)) / std_dev;

  return {
    type: "numeric",
    mean,
    median,
    std_dev,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
    p95: quantile(sorted, 0.95),
    null_count: nulls,
    null_pct: values.length ? (nulls / values.length) * 100 : 0,
    unique_count: freq.size,
    zero_count: nums.filter((v) => v === 0).length,
    negative_count: nums.filter((v) => v < 0).length,
    is_monotonic_increasing: inc && nums.length > 1,
    is_monotonic_decreasing: dec && nums.length > 1,
    skewness,
    top_5_values,
  };
}

function computeCategoricalStats(values: unknown[]): CategoricalStats {
  let nulls = 0;
  const strs: string[] = [];
  for (const v of values) {
    if (isNullish(v)) nulls++;
    else strs.push(String(v));
  }
  const freq = new Map<string, number>();
  for (const s of strs) freq.set(s, (freq.get(s) ?? 0) + 1);
  const top_10_values = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([value, count]) => ({ value, count }));

  const lens = strs.map((s) => s.length);
  const avgLen = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;

  const sample = strs.slice(0, 50);
  const looks_like_email = sample.length > 0 && sample.filter((s) => EMAIL_RE.test(s)).length / sample.length > 0.6;
  const looks_like_date = sample.length > 0 && sample.filter((s) => DATE_RE.test(s)).length / sample.length > 0.6;
  const looks_like_id = freq.size / Math.max(strs.length, 1) > 0.9 && sample.every((s) => ID_RE.test(s));

  return {
    type: "categorical",
    unique_count: freq.size,
    top_10_values,
    null_count: nulls,
    null_pct: values.length ? (nulls / values.length) * 100 : 0,
    avg_string_length: avgLen,
    min_length: lens.length ? Math.min(...lens) : 0,
    max_length: lens.length ? Math.max(...lens) : 0,
    looks_like_email,
    looks_like_date,
    looks_like_id,
  };
}

function computeDateStats(values: unknown[]): DateStats {
  let nulls = 0;
  const dates: Date[] = [];
  for (const v of values) {
    if (isNullish(v)) {
      nulls++;
      continue;
    }
    const d = v instanceof Date ? v : new Date(String(v));
    if (!Number.isNaN(d.getTime())) dates.push(d);
    else nulls++;
  }
  dates.sort((a, b) => a.getTime() - b.getTime());
  const min_date = dates[0]?.toISOString().slice(0, 10) ?? "";
  const max_date = dates[dates.length - 1]?.toISOString().slice(0, 10) ?? "";
  const date_range_days =
    dates.length >= 2 ? Math.round((dates[dates.length - 1].getTime() - dates[0].getTime()) / 86400000) : 0;

  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const wdCounts = new Map<string, number>();
  for (const d of dates) {
    const w = weekdayNames[d.getDay()];
    wdCounts.set(w, (wdCounts.get(w) ?? 0) + 1);
  }
  const most_common_weekday = [...wdCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  // Detect gaps & frequency mode (very rough)
  let frequency_mode: DateStats["frequency_mode"] = "irregular";
  let has_gaps = false;
  if (dates.length >= 3) {
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) gaps.push((dates[i].getTime() - dates[i - 1].getTime()) / 86400000);
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    if (avgGap < 2) frequency_mode = "day";
    else if (avgGap < 9) frequency_mode = "week";
    else if (avgGap < 35) frequency_mode = "month";
    has_gaps = gaps.some((g) => g > avgGap * 3);
  }

  return {
    type: "date",
    min_date,
    max_date,
    date_range_days,
    most_common_weekday,
    has_gaps,
    frequency_mode,
    null_count: nulls,
    null_pct: values.length ? (nulls / values.length) * 100 : 0,
  };
}

export function analyzeColumns(rows: Record<string, unknown>[]): ColumnInfo[] {
  if (rows.length === 0) return [];
  const colNames = Object.keys(rows[0]);
  return colNames.map((name) => {
    const values = rows.map((r) => r[name]);
    const type = inferType(values);
    let stats: ColumnStats | null = null;
    if (type === "numeric") stats = computeNumericStats(values);
    else if (type === "date") stats = computeDateStats(values);
    else if (type === "categorical" || type === "boolean") stats = computeCategoricalStats(values);
    return { name, type, stats };
  });
}
