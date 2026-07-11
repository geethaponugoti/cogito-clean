import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { TopNav } from "@/components/TopNav";
import { parseFile, sanitizeRowsForLLM, inspectExcelSheets, type ParseOptions } from "@/lib/parsers";
import { analyzeColumns, type ColumnInfo } from "@/lib/columnStats";
import { useUploadStore } from "@/store";
import { ownedSupabase, ownerHeaders } from "@/integrations/supabase/owned";
import { getOwnerToken } from "@/lib/ownerToken";
import { toast } from "@/hooks/use-toast";

type Step = "drop" | "parsing" | "preview";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const ColumnTypePill = ({ type }: { type: ColumnInfo["type"] }) => {
  const cls =
    type === "numeric"
      ? "bg-primary/10 text-primary border-primary/30"
      : type === "date"
        ? "bg-success/10 text-success border-success/30"
        : type === "categorical"
          ? "bg-warning/10 text-warning border-warning/30"
          : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 border uppercase tracking-wider rounded-sm ${cls}`}>
      {type}
    </span>
  );
};

interface ParserControls {
  delimiter?: string;
  headerRowIndex?: number;
  sheetName?: string;
}

const Upload = () => {
  const navigate = useNavigate();
  const { file, parsedRows, columns, setFile, setParsed, setProgress, setDatasetId, reset } = useUploadStore();
  const [step, setStep] = useState<Step>("drop");
  const [parseStatus, setParseStatus] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [controls, setControls] = useState<ParserControls>({});
  const [excelSheets, setExcelSheets] = useState<string[] | null>(null);

  const ext = useMemo(() => file?.name.split(".").pop()?.toLowerCase() ?? "", [file]);
  const isDelimited = ext === "csv" || ext === "tsv" || ext === "txt";
  const isExcel = ext === "xlsx" || ext === "xls";

  const runParser = useCallback(
    async (f: File, opts: ParserControls) => {
      try {
        setStep("parsing");
        setParseStatus(`Reading ${f.name}…`);
        setProgress(20);

        const parseOpts: ParseOptions = {
          delimiter: opts.delimiter,
          headerRowIndex: opts.headerRowIndex,
          sheetName: opts.sheetName,
        };
        const result = await parseFile(f, parseOpts);
        setProgress(60);
        setParseStatus(`Parsed ${result.rowCount.toLocaleString()} rows · detecting types…`);

        await new Promise((r) => setTimeout(r, 80));
        const cols = analyzeColumns(result.rows.slice(0, 10000));
        setProgress(95);
        setParsed(result.rows, cols);
        setParseStatus(`Done · ${cols.length} columns analyzed`);
        await new Promise((r) => setTimeout(r, 200));
        setProgress(100);
        setStep("preview");
      } catch (e) {
        toast({
          title: "Parse failed",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        });
        setStep("drop");
      }
    },
    [setParsed, setProgress],
  );

  const handleFile = useCallback(
    async (f: File) => {
      if (f.size > MAX_FILE_SIZE_BYTES) {
        toast({
          title: "File too large",
          description: `${f.name} is ${(f.size / 1024 / 1024).toFixed(1)}MB. The limit is 25MB.`,
          variant: "destructive",
        });
        return;
      }

      setFile(f);
      setControls({});
      setExcelSheets(null);

      const fileExt = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (fileExt === "xlsx" || fileExt === "xls") {
        try {
          const sheets = await inspectExcelSheets(f);
          setExcelSheets(sheets);
          await runParser(f, { sheetName: sheets[0] });
          return;
        } catch (e) {
          toast({
            title: "Could not read Excel sheets",
            description: e instanceof Error ? e.message : "Unknown error",
            variant: "destructive",
          });
        }
      }

      await runParser(f, {});
    },
    [runParser, setFile],
  );

  // Re-parse whenever overrides change (debounced via effect)
  useEffect(() => {
    if (!file || step === "drop" || step === "parsing") return;
    if (Object.keys(controls).length === 0) return;
    void runParser(file, controls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls.delimiter, controls.headerRowIndex, controls.sheetName]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void handleFile(f);
    },
    [handleFile],
  );

  const startAnalysis = async () => {
    if (!file || !parsedRows || !columns) return;
    setSubmitting(true);
    try {
      const jsonSafe = <T,>(x: T): T =>
        JSON.parse(
          JSON.stringify(x, (_k, v) =>
            typeof v === "number" && !Number.isFinite(v) ? null : v,
          ),
        );

      const safeName = file.name
        .normalize("NFKD")
        .replace(/[^\w.\-]+/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 120);

      const sample = jsonSafe(sanitizeRowsForLLM(parsedRows.slice(0, 100)));
      const stats = jsonSafe(
        Object.fromEntries(columns.map((c) => [c.name, { type: c.type, ...(c.stats ?? {}) }])),
      );

      const ownerToken = getOwnerToken();

      const { data, error } = await ownedSupabase
        .from("datasets")
        .insert([
          {
            filename: file.name,
            file_path: safeName,
            file_size: file.size,
            row_count: parsedRows.length,
            col_count: columns.length,
            column_stats_json: stats as never,
            sample_rows_json: sample as never,
            owner_token: ownerToken,
          },
        ])
        .select()
        .single();
      if (error || !data) throw error ?? new Error("Insert failed");

      // Fire-and-forget: index dataset schema for similarity search
      void fetch(`${SUPABASE_URL}/functions/v1/embed-content`, {
        method: "POST",
        headers: ownerHeaders({
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_KEY}`,
        }),
        body: JSON.stringify({ kind: "dataset", id: data.id }),
      }).catch(() => {/* embedding is best-effort */});

      setDatasetId(data.id);
      reset();
      navigate(`/analyze/${data.id}`);
    } catch (e) {
      // Supabase PostgrestError is a plain object, not an Error instance.
      // Surface message/details/hint/code so the user sees the real reason.
      console.error("[Upload] startAnalysis failed", e);
      let description = "Unknown error";
      if (e instanceof Error) {
        description = e.message;
      } else if (e && typeof e === "object") {
        const err = e as { message?: string; details?: string; hint?: string; code?: string };
        description =
          err.message ??
          err.details ??
          err.hint ??
          (err.code ? `Code ${err.code}` : JSON.stringify(e).slice(0, 200));
      }
      toast({
        title: "Upload failed",
        description,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="container py-10 max-w-5xl">
        <div className="mb-8">
          <div className="text-xs font-mono text-muted-foreground mb-1">/upload</div>
          <h1 className="font-display font-bold text-3xl tracking-tight">New analysis</h1>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2 mb-8 text-xs font-mono">
          {(["drop", "parsing", "preview"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span
                className={`h-6 w-6 flex items-center justify-center rounded-sm border ${
                  step === s
                    ? "border-primary text-primary bg-primary/10"
                    : i < ["drop", "parsing", "preview"].indexOf(step)
                      ? "border-success text-success bg-success/10"
                      : "border-border text-muted-foreground"
                }`}
              >
                {i + 1}
              </span>
              <span className={step === s ? "text-foreground" : "text-muted-foreground"}>
                {s.toUpperCase()}
              </span>
              {i < 2 && <span className="text-border mx-2">·······</span>}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === "drop" && (
            <motion.div
              key="drop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`card-surface border-dashed border-2 p-16 text-center transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <div className="mx-auto h-16 w-16 mb-4 bg-gradient-glow shadow-glow flex items-center justify-center rounded-sm">
                <span className="text-2xl">↑</span>
              </div>
              <h2 className="font-display text-xl font-semibold mb-2">Drop a file to begin</h2>
              <p className="text-muted-foreground text-sm mb-6">
                CSV · TSV · JSON · XLSX · XLS · Parquet · up to 25MB
              </p>
              <div className="flex flex-col items-center gap-3">
                <input
                  id="file-upload-input"
                  data-testid="file-upload-input"
                  type="file"
                  aria-label="Upload data file"
                  accept=".csv,.tsv,.txt,.json,.xlsx,.xls,.parquet"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                  }}
                  className="block text-sm text-muted-foreground font-mono
                    file:mr-3 file:py-2 file:px-4 file:rounded-sm file:border-0
                    file:text-sm file:font-medium
                    file:bg-primary file:text-primary-foreground
                    hover:file:shadow-glow file:cursor-pointer cursor-pointer"
                />
                <span className="text-[11px] font-mono text-muted-foreground">
                  or drop a file anywhere in this box
                </span>
                <button
                  type="button"
                  data-testid="seed-sample-dataset"
                  onClick={() => {
                    const csv = [
                      "date,region,product,units,revenue",
                      "2024-01-05,North,Widget A,12,1199.88",
                      "2024-01-08,South,Widget B,8,1599.92",
                      "2024-01-12,East,Widget A,15,1499.85",
                      "2024-01-15,West,Widget C,5,2499.75",
                      "2024-01-19,North,Widget B,22,4399.78",
                      "2024-01-22,South,Widget A,18,1799.82",
                      "2024-01-26,East,Widget C,3,1499.85",
                      "2024-01-30,West,Widget B,11,2199.89",
                      "2024-02-02,North,Widget A,25,2499.75",
                      "2024-02-06,South,Widget C,7,3499.65",
                      "2024-02-09,East,Widget B,14,2799.86",
                      "2024-02-13,West,Widget A,20,1999.80",
                      "2024-02-17,North,Widget C,4,1999.80",
                      "2024-02-20,South,Widget B,17,3399.83",
                      "2024-02-24,East,Widget A,9,899.91",
                      "2024-02-28,West,Widget C,6,2999.70",
                      "2024-03-03,North,Widget B,28,5599.72",
                      "2024-03-07,South,Widget A,13,1299.87",
                      "2024-03-10,East,Widget C,2,999.90",
                      "2024-03-14,West,Widget B,19,3799.81",
                    ].join("\n");
                    const stamp = Date.now().toString(36);
                    const f = new File([csv], `sample-sales-${stamp}.csv`, { type: "text/csv" });
                    void handleFile(f);
                  }}
                  className="text-[11px] font-mono text-muted-foreground hover:text-primary underline underline-offset-2"
                >
                  · or seed a sample dataset (dev) ·
                </button>
              </div>
            </motion.div>
          )}

          {step === "parsing" && (
            <motion.div
              key="parsing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card-surface p-12"
            >
              <div className="font-mono text-sm text-primary mb-4 streaming-cursor">{parseStatus}</div>
              <div className="h-1.5 bg-muted overflow-hidden rounded-sm">
                <motion.div
                  className="h-full bg-gradient-glow"
                  initial={{ width: 0 }}
                  animate={{ width: `${useUploadStore.getState().uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          )}

          {step === "preview" && parsedRows && columns && (
            <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8">
                {/* Manual parser overrides */}
                {(isDelimited || isExcel) && (
                  <div className="card-surface p-3 mb-3 flex flex-wrap items-center gap-3 text-xs">
                    {isDelimited && (
                      <>
                        <span className="font-mono text-muted-foreground uppercase tracking-wider">Delimiter</span>
                        <select
                          value={controls.delimiter ?? "auto"}
                          onChange={(e) =>
                            setControls((c) => ({
                              ...c,
                              delimiter: e.target.value === "auto" ? undefined : e.target.value,
                            }))
                          }
                          className="bg-background border border-border px-2 py-1 rounded-sm font-mono"
                        >
                          <option value="auto">auto</option>
                          <option value=",">, comma</option>
                          <option value=";">; semicolon</option>
                          <option value="\t">tab</option>
                          <option value="|">| pipe</option>
                        </select>

                        <span className="font-mono text-muted-foreground uppercase tracking-wider ml-3">Header row</span>
                        <input
                          type="number"
                          min={0}
                          placeholder="auto"
                          value={controls.headerRowIndex ?? ""}
                          onChange={(e) =>
                            setControls((c) => ({
                              ...c,
                              headerRowIndex:
                                e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="bg-background border border-border px-2 py-1 rounded-sm font-mono w-20"
                        />
                      </>
                    )}

                    {isExcel && excelSheets && excelSheets.length > 1 && (
                      <>
                        <span className="font-mono text-muted-foreground uppercase tracking-wider">Sheet</span>
                        <select
                          value={controls.sheetName ?? excelSheets[0]}
                          onChange={(e) => setControls((c) => ({ ...c, sheetName: e.target.value }))}
                          className="bg-background border border-border px-2 py-1 rounded-sm font-mono"
                        >
                          {excelSheets.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </>
                    )}

                    {(controls.delimiter || controls.headerRowIndex !== undefined || controls.sheetName) && (
                      <button
                        onClick={() => setControls({})}
                        className="ml-auto text-muted-foreground hover:text-foreground underline"
                      >
                        reset
                      </button>
                    )}
                  </div>
                )}

                <div className="card-surface overflow-hidden">
                  <div className="px-4 py-2 border-b border-border bg-surface text-xs font-mono text-muted-foreground flex justify-between">
                    <span>{file?.name}</span>
                    <span>{parsedRows.length.toLocaleString()} rows · {columns.length} cols</span>
                  </div>
                  <div className="overflow-auto max-h-[60vh]">
                    <table className="w-full text-sm">
                      <thead className="bg-surface sticky top-0">
                        <tr>
                          {columns.map((c) => (
                            <th key={c.name} className="text-left px-3 py-2 border-b border-border font-medium whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span>{c.name}</span>
                                <ColumnTypePill type={c.type} />
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.slice(0, 20).map((r, i) => (
                          <tr key={i} className="data-table-row border-b border-border/50">
                            {columns.map((c) => (
                              <td key={c.name} className="px-3 py-1.5 font-mono-data text-xs whitespace-nowrap max-w-[200px] truncate">
                                {r[c.name] === null || r[c.name] === undefined ? (
                                  <span className="text-muted-foreground">∅</span>
                                ) : (
                                  String(r[c.name])
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      reset();
                      setStep("drop");
                      setControls({});
                      setExcelSheets(null);
                    }}
                    className="px-4 py-2 border border-border hover:bg-accent text-sm rounded-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={startAnalysis}
                    disabled={submitting}
                    className="px-5 py-2 bg-primary text-primary-foreground font-medium rounded-sm hover:shadow-glow disabled:opacity-60"
                  >
                    {submitting ? "Uploading…" : "Run agentic analysis →"}
                  </button>
                </div>
              </div>
              <div className="lg:col-span-4 space-y-3">
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Column stats</div>
                <div className="space-y-2 max-h-[60vh] overflow-auto pr-2">
                  {columns.map((c) => (
                    <details key={c.name} className="card-surface p-3 group">
                      <summary className="flex items-center justify-between cursor-pointer text-sm">
                        <span className="font-medium truncate">{c.name}</span>
                        <ColumnTypePill type={c.type} />
                      </summary>
                      {c.stats && (
                        <div className="mt-3 pt-3 border-t border-border space-y-1 font-mono text-xs text-muted-foreground">
                          {Object.entries(c.stats).slice(0, 8).map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-2">
                              <span>{k}</span>
                              <span className="text-foreground truncate max-w-[140px]">
                                {typeof v === "number"
                                  ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                  : Array.isArray(v)
                                    ? `[${v.length}]`
                                    : typeof v === "boolean"
                                      ? String(v)
                                      : String(v).slice(0, 30)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </details>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Upload;
