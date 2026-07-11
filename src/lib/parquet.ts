/**
 * Parquet parsing in the browser using hyparquet (pure JS, no WASM).
 * Returns rows as Record<string, unknown>[] like the other parsers.
 */
import { parquetReadObjects } from "hyparquet";

export async function parseParquet(file: File, maxRows: number): Promise<{
  rows: Record<string, unknown>[];
  truncated: boolean;
}> {
  const buf = await file.arrayBuffer();
  const rows = (await parquetReadObjects({ file: buf, rowFormat: "object" })) as Record<string, unknown>[];
  const truncated = rows.length > maxRows;
  return { rows: truncated ? rows.slice(0, maxRows) : rows, truncated };
}
