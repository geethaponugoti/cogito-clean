import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TopNav } from "@/components/TopNav";
import { ownedSupabase, ownerHeaders } from "@/integrations/supabase/owned";
import { getOwnerToken } from "@/lib/ownerToken";
import { useAnalysisStore, type AnalysisJson } from "@/store";
import { useCountUp } from "@/hooks/useCountUp";
import { ChatPanel } from "@/components/ChatPanel";
import { ShareDialog } from "@/components/ShareDialog";
import { SimilarDatasets } from "@/components/SimilarDatasets";
import { CommentThread } from "@/components/CommentThread";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const SEV_COLORS: Record<string, string> = {
  high: "bg-destructive/15 text-destructive border-destructive/40",
  medium: "bg-warning/15 text-warning border-warning/40",
  low: "bg-muted text-muted-foreground border-border",
};

type ColumnStatsMap = Record<string, Record<string, unknown> & { type: string }>;

type DatasetRecord = {
  filename: string;
  row_count: number;
  col_count: number;
  sample_rows_json: Record<string, unknown>[];
  column_stats_json: ColumnStatsMap | null;
};

function QualityGauge({ score }: { score: number }) {
  const v = useCountUp(score, 1200);
  const r = 56;
  const c = 2 * Math.PI * r;
  const off = c - (v / 100) * c;
  const color =
    score >= 80
      ? "hsl(var(--success))"
      : score >= 60
        ? "hsl(var(--warning))"
        : "hsl(var(--destructive))";

  return (
    <div className="card-surface p-5 flex items-center gap-5">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="10"
        />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dashoffset 0.6s" }}
        />
        <text
          x="70"
          y="70"
          textAnchor="middle"
          dominantBaseline="middle"
          className="font-mono-data fill-foreground"
          fontSize="28"
          fontWeight="600"
        >
          {Math.round(v)}
        </text>
        <text
          x="70"
          y="92"
          textAnchor="middle"
          className="fill-muted-foreground font-mono"
          fontSize="10"
        >
          /100
        </text>
      </svg>
      <div>
        <div className="section-label">Data quality</div>
        <div className="font-display font-semibold text-lg">
          {score >= 80
            ? "Excellent"
            : score >= 60
              ? "Acceptable"
              : "Needs attention"}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ m }: { m: AnalysisJson["key_metrics"][number] }) {
  const arrow =
    m.trend === "up"
      ? "↑"
      : m.trend === "down"
        ? "↓"
        : m.trend === "flat"
          ? "→"
          : "·";

  const color =
    m.trend === "up"
      ? "border-l-success"
      : m.trend === "down"
        ? "border-l-destructive"
        : m.trend === "flat"
          ? "border-l-warning"
          : "border-l-border";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card-surface p-5 border-l-2 ${color} hover:border-white/20`}
    >
      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider truncate">
        {m.label}
      </div>
      <div className="mt-2 flex items-start gap-2">
        <span className="metric-value">{m.value}</span>
        <span className="text-xs text-slate-400 mt-3">{m.unit}</span>
        <span className="ml-auto text-lg text-slate-300">{arrow}</span>
      </div>
      <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
        {m.insight}
      </div>
    </motion.div>
  );
}

function CorrelationsHeatmap({
  correlations,
}: {
  correlations: AnalysisJson["correlations"];
}) {
  if (correlations.length === 0) return null;

  return (
    <div className="card-surface p-5">
      <div className="section-label">Correlations</div>
      <div className="space-y-1.5">
        {correlations.map((c, i) => {
          const v = Math.max(-1, Math.min(1, c.strength));
          const hue = v >= 0 ? 217 : 0;
          const opacity = Math.abs(v);

          return (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="font-mono text-xs truncate w-32">{c.col_a}</span>
              <span className="text-muted-foreground">×</span>
              <span className="font-mono text-xs truncate w-32">{c.col_b}</span>
              <div className="flex-1 h-6 relative bg-muted rounded-sm overflow-hidden">
                <div
                  className="absolute inset-y-0"
                  style={{
                    background: `hsl(${hue} 91% 60% / ${opacity})`,
                    width: `${Math.abs(v) * 100}%`,
                    left: v >= 0 ? "50%" : `${50 - Math.abs(v) * 50}%`,
                  }}
                />
                <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
              </div>
              <span className="font-mono-data text-xs w-12 text-right">
                {v.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChartCard({
  chart,
  sample,
}: {
  chart: AnalysisJson["suggested_charts"][number];
  sample: Record<string, unknown>[];
}) {
  const data = sample.slice(0, 60).map((r) => ({
    x: r[chart.x_column] as string | number,
    y: Number(r[chart.y_column]) || 0,
  }));

  return (
    <div className="card-surface p-5 hero-glow">
      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">
        {chart.chart_type}
      </div>
      <div className="font-display font-medium mb-3">{chart.title}</div>

      <div className="chart-wrap p-3 mt-3">
        <ResponsiveContainer width="100%" height={220}>
          {chart.chart_type === "line" ? (
            <LineChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="x"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                }}
              />
              <Line
                type="monotone"
                dataKey="y"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          ) : chart.chart_type === "scatter" ? (
            <ScatterChart>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="x"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
              />
              <YAxis
                dataKey="y"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                }}
              />
              <Scatter data={data} fill="hsl(var(--primary))" />
            </ScatterChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="x"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                }}
              />
              <Bar dataKey="y" fill="hsl(var(--primary))" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-xs text-muted-foreground italic">
        {chart.rationale}
      </div>
    </div>
  );
}

function isNumericColumn(rows: Record<string, unknown>[], key: string) {
  const values = rows
    .map((row) => row[key])
    .filter((v) => v !== null && v !== undefined && v !== "");

  if (values.length === 0) return false;

  const numericCount = values.filter((v) => !Number.isNaN(Number(v))).length;
  return numericCount / values.length >= 0.8;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function numAt(stats: ColumnStatsMap, col: string, key: string): number | undefined {
  const v = stats[col]?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Pearson correlation coefficient between two equal-length numeric arrays. */
function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const meanX = average(xs);
  const meanY = average(ys);
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

function pairedNumericValues(
  rows: Record<string, unknown>[],
  colA: string,
  colB: string,
): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const row of rows) {
    if (row[colA] === null || row[colA] === undefined || row[colA] === "") continue;
    if (row[colB] === null || row[colB] === undefined || row[colB] === "") continue;
    const x = Number(row[colA]);
    const y = Number(row[colB]);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      xs.push(x);
      ys.push(y);
    }
  }
  return { xs, ys };
}

/** Computes real Pearson correlations across every pair of numeric columns, strongest first. */
function computeCorrelations(
  sample: Record<string, unknown>[],
  numericColumns: string[],
): AnalysisJson["correlations"] {
  const results: AnalysisJson["correlations"] = [];
  for (let i = 0; i < numericColumns.length; i++) {
    for (let j = i + 1; j < numericColumns.length; j++) {
      const { xs, ys } = pairedNumericValues(sample, numericColumns[i], numericColumns[j]);
      if (xs.length < 5) continue;
      const strength = pearsonCorrelation(xs, ys);
      if (Number.isFinite(strength)) {
        results.push({
          col_a: numericColumns[i],
          col_b: numericColumns[j],
          strength,
          direction: strength >= 0 ? "positive" : "negative",
          business_meaning:
            Math.abs(strength) >= 0.5
              ? `${numericColumns[i]} and ${numericColumns[j]} move together in the sampled rows — worth checking whether one drives the other.`
              : `${numericColumns[i]} and ${numericColumns[j]} show only a weak relationship in the sampled rows.`,
        } as AnalysisJson["correlations"][number]);
      }
    }
  }
  return results.sort((a, b) => Math.abs(b.strength) - Math.abs(a.strength)).slice(0, 5);
}

/** Flags values outside the 1.5x-IQR fence (computed from the full-file column stats) among the sampled rows. */
function computeAnomalies(dataset: DatasetRecord, numericColumns: string[]): AnalysisJson["anomalies"] {
  const sample = dataset.sample_rows_json ?? [];
  const stats = dataset.column_stats_json ?? {};
  const anomalies: AnalysisJson["anomalies"] = [];

  for (const col of numericColumns) {
    const p25 = numAt(stats, col, "p25");
    const p75 = numAt(stats, col, "p75");
    if (p25 === undefined || p75 === undefined) continue;

    const iqr = p75 - p25;
    if (iqr <= 0) continue;
    const lower = p25 - 1.5 * iqr;
    const upper = p75 + 1.5 * iqr;

    const outliers = sample
      .map((row) => Number(row[col]))
      .filter((v) => Number.isFinite(v) && (v < lower || v > upper));
    if (outliers.length === 0) continue;

    const farthest = Math.max(...outliers.map((v) => Math.max(v - upper, lower - v)));
    const severity: "low" | "medium" | "high" =
      farthest > iqr * 3 ? "high" : farthest > iqr * 1.5 ? "medium" : "low";

    anomalies.push({
      severity,
      column: col,
      description: `${outliers.length} value(s) fall outside the typical ${p25.toFixed(1)}–${p75.toFixed(1)} range (1.5× IQR fence: ${lower.toFixed(1)} to ${upper.toFixed(1)}) among the sampled rows.`,
      example_values: outliers.slice(0, 3).map(String),
      count: outliers.length,
    });
  }

  return anomalies.sort((a, b) => b.count - a.count).slice(0, 5);
}

/** Data quality score derived from real null-rate stats, penalized by detected anomalies. */
function computeDataQuality(
  dataset: DatasetRecord,
  anomalyCount: number,
): AnalysisJson["data_quality"] {
  const stats = dataset.column_stats_json ?? {};
  const columns = Object.keys(stats);

  const nullPcts = columns.map((c) => numAt(stats, c, "null_pct") ?? 0);
  const avgNullPct = nullPcts.length ? average(nullPcts) : 0;
  const overall_score = Math.max(0, Math.min(100, Math.round(100 - avgNullPct - anomalyCount * 2)));

  const issues = columns
    .map((col) => ({ col, null_pct: numAt(stats, col, "null_pct") ?? 0, null_count: numAt(stats, col, "null_count") ?? 0 }))
    .filter((c) => c.null_pct > 5)
    .sort((a, b) => b.null_pct - a.null_pct)
    .slice(0, 5)
    .map((c) => ({
      column: c.col,
      issue: `${c.null_pct.toFixed(1)}% missing values`,
      severity: (c.null_pct > 30 ? "high" : c.null_pct > 10 ? "medium" : "low") as "low" | "medium" | "high",
      rows_affected: Math.round(c.null_count),
    }));

  return { overall_score, issues };
}

function buildAnalysis(dataset: DatasetRecord): AnalysisJson {
  const sample = dataset.sample_rows_json ?? [];
  const columns = sample.length > 0 ? Object.keys(sample[0]) : [];
  const statsColumns = dataset.column_stats_json ? Object.keys(dataset.column_stats_json) : [];

  const numericColumns =
    statsColumns.length > 0
      ? statsColumns.filter((c) => dataset.column_stats_json?.[c]?.type === "numeric")
      : columns.filter((col) => isNumericColumn(sample, col));

  const revenueCol =
    numericColumns.find((c) => c.toLowerCase().includes("revenue")) ??
    numericColumns[0] ??
    columns[0] ??
    "value";
  const categoryCol =
    columns.find((c) =>
      ["category", "segment", "type", "group"].some((x) =>
        c.toLowerCase().includes(x),
      ),
    ) ?? columns.find((c) => !numericColumns.includes(c)) ?? columns[0] ?? "label";
  const compareCol = numericColumns.find((c) => c !== revenueCol) ?? revenueCol;

  const avgRevenue = numAt(dataset.column_stats_json ?? {}, revenueCol, "mean");
  const maxRevenue = numAt(dataset.column_stats_json ?? {}, revenueCol, "max");
  const revenueValuesFallback = sample.map((row) => Number(row[revenueCol])).filter((v) => !Number.isNaN(v));

  const uniqueCategories = new Set(
    sample
      .map((row) => row[categoryCol])
      .filter((v) => v !== null && v !== undefined && v !== ""),
  );

  const correlations = computeCorrelations(sample, numericColumns);
  const anomalies = computeAnomalies(dataset, numericColumns);
  const data_quality = computeDataQuality(dataset, anomalies.length);
  const topCorrelation = correlations[0];

  const recommendations: AnalysisJson["recommendations"] = [];
  const worstIssue = data_quality.issues[0];
  if (worstIssue) {
    recommendations.push({
      priority: 1,
      category: "data_quality",
      action: `Investigate missing values in ${worstIssue.column} (${worstIssue.issue}) before building final dashboards.`,
      expected_impact: "Reduces the chance of misleading KPI interpretation.",
    });
  } else {
    recommendations.push({
      priority: 1,
      category: "data_quality",
      action: "No significant missing-value issues were detected — data looks ready for downstream use.",
      expected_impact: "Confirms the dataset is safe to build dashboards on directly.",
    });
  }
  if (topCorrelation && Math.abs(topCorrelation.strength) >= 0.5) {
    recommendations.push({
      priority: 2,
      category: "investigation",
      action: `Investigate the relationship between ${topCorrelation.col_a} and ${topCorrelation.col_b} (r = ${topCorrelation.strength.toFixed(2)}) before treating it as causal.`,
      expected_impact: "Avoids acting on a correlation that may be coincidental or confounded.",
    });
  }
  recommendations.push({
    priority: recommendations.length + 1,
    category: "business",
    action: `Segment results by ${String(categoryCol)} and compare patterns across ${uniqueCategories.size || 1} groups.`,
    expected_impact: "Surfaces performance differences that may be hidden in aggregate metrics.",
  });

  const summaryCorrelationPart = topCorrelation
    ? `The strongest relationship found is between ${topCorrelation.col_a} and ${topCorrelation.col_b} (r = ${topCorrelation.strength.toFixed(2)}).`
    : `No strong correlations were detected among the numeric columns.`;

  return {
    executive_summary: `This dataset includes ${dataset.row_count.toLocaleString()} rows across ${dataset.col_count} columns. ${summaryCorrelationPart} Data quality scored ${data_quality.overall_score}/100 based on missing-value rates${anomalies.length ? ` and ${anomalies.length} flagged outlier column(s)` : ""}.`,
    data_quality,
    key_metrics: [
      {
        label: "Rows",
        value: dataset.row_count.toLocaleString(),
        unit: "records",
        trend: "flat",
        insight: "The uploaded dataset was successfully profiled and row volume is sufficient for a first-pass summary.",
      },
      {
        label: "Columns",
        value: String(dataset.col_count),
        unit: "fields",
        trend: "flat",
        insight: "The schema was detected correctly and can support dashboard-style analysis.",
      },
      {
        label: `Avg ${revenueCol}`,
        value: (avgRevenue ?? average(revenueValuesFallback)).toFixed(1),
        unit: "",
        trend: "flat",
        insight: `Mean of ${revenueCol} computed across the full parsed dataset.`,
      },
      {
        label: `Max ${revenueCol}`,
        value: (maxRevenue ?? Math.max(0, ...revenueValuesFallback)).toFixed(0),
        unit: "",
        trend: "flat",
        insight: `Maximum observed value of ${revenueCol}, indicating spread in the data.`,
      },
    ],
    correlations,
    suggested_charts: [
      {
        chart_type: "bar",
        title: `${revenueCol} by ${categoryCol}`,
        x_column: categoryCol,
        y_column: revenueCol,
        rationale: `Useful for comparing ${revenueCol} across ${String(categoryCol)} groups.`,
      },
      {
        chart_type:
          revenueCol !== compareCol && numericColumns.length >= 2
            ? "scatter"
            : "line",
        title:
          revenueCol !== compareCol && numericColumns.length >= 2
            ? `${revenueCol} vs ${compareCol}`
            : `${revenueCol} trend preview`,
        x_column:
          revenueCol !== compareCol && numericColumns.length >= 2
            ? compareCol
            : categoryCol,
        y_column: revenueCol,
        rationale:
          revenueCol !== compareCol && numericColumns.length >= 2
            ? `Helps inspect the relationship between ${revenueCol} and ${compareCol}.`
            : `Provides a compact first look at how ${revenueCol} varies across the sample.`,
      },
    ],
    anomalies,
    recommendations,
  } as AnalysisJson;
}

const Analyze = () => {
  const { id } = useParams<{ id: string }>();
  const {
    status,
    streamingText,
    analysis,
    toolCallLog,
    error,
    reset,
    setStatus,
    appendStream,
    setAnalysis,
    addToolCall,
    setError,
  } = useAnalysisStore();

  const [dataset, setDataset] = useState<DatasetRecord | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!id) return;

    void (async () => {
      const { data } = await ownedSupabase
        .from("datasets")
        .select("filename,row_count,col_count,sample_rows_json,column_stats_json")
        .eq("id", id)
        .maybeSingle();

      if (data) {
        setDataset(data as DatasetRecord);
      }
    })();

    return () => reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const runAnalysis = async () => {
    if (!id || startedRef.current || !dataset) return;

    startedRef.current = true;
    reset();
    setStatus("running");

    try {
      addToolCall({
        id: crypto.randomUUID(),
        tool_name: "local_analysis",
        input: {
          dataset_id: id,
          filename: dataset.filename,
          row_count: dataset.row_count,
          col_count: dataset.col_count,
        },
        result: "Computed correlations, anomalies, and data quality score from parsed column stats",
        duration_ms: 320,
        called_at: new Date().toISOString(),
      });

      appendStream("Profiling dataset schema and generating executive summary...");

      await new Promise((resolve) => setTimeout(resolve, 500));

      const demoAnalysis = buildAnalysis(dataset);
      let demoAnalysisId = crypto.randomUUID();

      const { data: saved, error: saveError } = await ownedSupabase
        .from("analyses")
        .insert([
          {
            dataset_id: id,
            filename: dataset.filename,
            executive_summary: demoAnalysis.executive_summary,
            analysis_json: demoAnalysis as never,
            owner_token: getOwnerToken(),
          },
        ])
        .select()
        .single();

      if (!saveError && saved) {
        demoAnalysisId = saved.id;
        void fetch(`${SUPABASE_URL}/functions/v1/embed-content`, {
          method: "POST",
          headers: ownerHeaders({
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_KEY}`,
          }),
          body: JSON.stringify({ kind: "analysis", id: demoAnalysisId }),
        }).catch(() => {/* embedding is best-effort */});
      }

      setAnalysisId(demoAnalysisId);
      setAnalysis(demoAnalysis);
      setStatus("complete");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStatus("failed");
    }
  };

  useEffect(() => {
    if (dataset && status === "idle") {
      void runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset]);

  return (
    <div className="min-h-screen">
      <TopNav />

      <main className="page-shell">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <Link
              to="/dashboard"
              className="text-xs font-mono text-slate-400 hover:text-white"
            >
              ← all datasets
            </Link>
            <h1 className="font-display font-bold text-4xl tracking-tight mt-2 text-white">
              {dataset?.filename ?? "Loading…"}
            </h1>
            {dataset && (
              <div className="text-sm text-slate-400 mt-2">
                {dataset.row_count.toLocaleString()} rows · {dataset.col_count} columns
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {analysisId && status === "complete" && (
              <button
                onClick={() => setShareOpen(true)}
                className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 text-sm"
              >
                ↗ Share
              </button>
            )}

            {status === "running" && (
              <div className="text-sm font-mono text-blue-400 streaming-cursor">
                agent_thinking
              </div>
            )}
          </div>
        </div>

        {toolCallLog.length > 0 && (
          <div className="card-surface p-4 mb-6">
            <div className="section-label">Agent trace</div>
            <div className="space-y-1 font-mono text-xs max-h-32 overflow-auto">
              {toolCallLog.map((t) => (
                <div key={t.id} className="flex gap-2">
                  <span className="text-primary">→</span>
                  <span className="text-foreground">{t.tool_name}</span>
                  <span className="text-muted-foreground truncate">
                    ({JSON.stringify(t.input).slice(0, 80)})
                  </span>
                  <span className="ml-auto text-success">{t.duration_ms}ms</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="card-surface p-4 mb-6 border-destructive/50 text-destructive text-sm">
            {error}
          </div>
        )}

        {(status === "running" || analysis) && (
          <div className="grid lg:grid-cols-12 gap-4">
            <div className="lg:col-span-9 space-y-4">
              <div className="grid lg:grid-cols-12 gap-4">
                <div className="lg:col-span-4">
                  {analysis ? (
                    <QualityGauge score={analysis.data_quality.overall_score} />
                  ) : (
                    <div className="card-surface h-[140px] shimmer" />
                  )}
                </div>

                <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {analysis
                    ? analysis.key_metrics
                        .slice(0, 4)
                        .map((m, i) => <MetricCard key={i} m={m} />)
                    : [0, 1, 2, 3].map((i) => (
                        <div key={i} className="card-surface h-[112px] shimmer" />
                      ))}
                </div>
              </div>

              <div className="card-surface p-5">
                <div className="section-label">Executive summary</div>
                <div
                  className={`text-sm leading-relaxed ${status === "running" && !analysis ? "streaming-cursor" : ""}`}
                >
                  {analysis?.executive_summary ??
                    streamingText ??
                    "Waiting for the agent…"}
                </div>
                {analysisId && analysis && (
                  <CommentThread
                    analysisId={analysisId}
                    insightRef="executive_summary"
                  />
                )}
              </div>

              {analysis && (
                <>
                  <div className="grid lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-6">
                      <CorrelationsHeatmap correlations={analysis.correlations} />
                    </div>
                    <div className="lg:col-span-6 grid gap-3">
                      {analysis.suggested_charts.slice(0, 2).map((c, i) => (
                        <ChartCard
                          key={i}
                          chart={c}
                          sample={dataset?.sample_rows_json ?? []}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="card-surface p-5">
                    <div className="section-label">Anomalies</div>
                    <div className="space-y-2">
                      {analysis.anomalies.map((a, i) => (
                        <div
                          key={i}
                          className="py-2 border-b border-border last:border-0"
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.5 border uppercase rounded-sm ${SEV_COLORS[a.severity]}`}
                            >
                              {a.severity}
                            </span>
                            <div className="flex-1">
                              <div className="text-sm">
                                <span className="font-mono text-primary">
                                  {a.column}
                                </span>{" "}
                                · {a.description}
                              </div>
                              {a.example_values.length > 0 && (
                                <div className="text-xs text-muted-foreground font-mono mt-1">
                                  examples:{" "}
                                  {a.example_values
                                    .slice(0, 5)
                                    .map(String)
                                    .join(", ")}
                                </div>
                              )}
                            </div>
                            <span className="text-xs font-mono-data text-muted-foreground">
                              {a.count} rows
                            </span>
                          </div>
                          {analysisId && (
                            <CommentThread
                              analysisId={analysisId}
                              insightRef={`anomaly_${i}`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card-surface p-5">
                    <div className="section-label">Recommendations</div>
                    <div className="space-y-2">
                      {analysis.recommendations
                        .sort((a, b) => a.priority - b.priority)
                        .map((r, i) => (
                          <div
                            key={i}
                            className="py-2 border-b border-border last:border-0"
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-primary/15 text-primary border border-primary/40 rounded-sm">
                                P{r.priority}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 border border-border rounded-sm uppercase text-muted-foreground">
                                {r.category}
                              </span>
                              <div className="flex-1">
                                <div className="text-sm">{r.action}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {r.expected_impact}
                                </div>
                              </div>
                            </div>
                            {analysisId && (
                              <CommentThread
                                analysisId={analysisId}
                                insightRef={`recommendation_${i}`}
                              />
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <aside className="lg:col-span-3 space-y-4">
              {id && <SimilarDatasets datasetId={id} />}
            </aside>
          </div>
        )}
      </main>

      {dataset && id && <ChatPanel datasetId={id} />}
      {analysisId && (
        <ShareDialog
          analysisId={analysisId}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
};

export default Analyze;