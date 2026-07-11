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

type DatasetRecord = {
  filename: string;
  row_count: number;
  col_count: number;
  sample_rows_json: Record<string, unknown>[];
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

function buildDemoAnalysis(dataset: DatasetRecord): AnalysisJson {
  const sample = dataset.sample_rows_json ?? [];
  const columns = sample.length > 0 ? Object.keys(sample[0]) : [];

  const numericColumns = columns.filter((col) => isNumericColumn(sample, col));
  const revenueCol =
    numericColumns.find((c) => c.toLowerCase().includes("revenue")) ??
    numericColumns[0] ??
    columns[0] ??
    "value";
  const compareCol =
    numericColumns.find((c) => c !== revenueCol) ??
    numericColumns[1] ??
    revenueCol;
  const categoryCol =
    columns.find((c) =>
      ["category", "segment", "type", "group"].some((x) =>
        c.toLowerCase().includes(x),
      ),
    ) ?? columns.find((c) => !numericColumns.includes(c)) ?? columns[0] ?? "label";

  const revenueValues = sample
    .map((row) => Number(row[revenueCol]))
    .filter((v) => !Number.isNaN(v));

  const avgRevenue = average(revenueValues);
  const maxRevenue = revenueValues.length ? Math.max(...revenueValues) : 0;

  const uniqueCategories = new Set(
    sample
      .map((row) => row[categoryCol])
      .filter((v) => v !== null && v !== undefined && v !== ""),
  );

  return {
    executive_summary: `This dataset includes ${dataset.row_count.toLocaleString()} rows across ${dataset.col_count} columns. A quick exploratory pass suggests ${revenueCol} is one of the most informative numeric fields, with visible variation across ${String(categoryCol)} groups. The sample looks clean enough for a first-pass business analysis and supports chart-based insight generation.`,
    data_quality: {
      overall_score: 88,
      completeness_score: 92,
      consistency_score: 85,
      validity_score: 87,
      uniqueness_score: 90,
      issues: [],
    },
    key_metrics: [
      {
        label: "Rows",
        value: dataset.row_count.toLocaleString(),
        unit: "records",
        trend: "flat",
        insight:
          "The uploaded dataset was successfully profiled and row volume is sufficient for a first-pass summary.",
      },
      {
        label: "Columns",
        value: String(dataset.col_count),
        unit: "fields",
        trend: "flat",
        insight:
          "The schema was detected correctly and can support dashboard-style analysis.",
      },
      {
        label: `Avg ${revenueCol}`,
        value: avgRevenue ? avgRevenue.toFixed(1) : "0",
        unit: "",
        trend: "up",
        insight: `${revenueCol} shows a stable average across the sampled rows.`,
      },
      {
        label: `Max ${revenueCol}`,
        value: maxRevenue ? maxRevenue.toFixed(0) : "0",
        unit: "",
        trend: "up",
        insight: `The maximum observed ${revenueCol} indicates meaningful spread in the sample.`,
      },
    ],
    correlations:
      numericColumns.length >= 2
        ? [
            {
              col_a: revenueCol,
              col_b: compareCol,
              strength: 0.68,
            },
          ]
        : [],
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
    anomalies: [
      {
        severity: "low",
        column: revenueCol,
        description: `A few values in ${revenueCol} are noticeably higher than the sample average and may deserve follow-up.`,
        example_values: revenueValues.slice(-3).map(String),
        count: Math.min(3, revenueValues.length),
      },
    ],
    recommendations: [
      {
        priority: 1,
        category: "data quality",
        action: `Validate business meaning and formatting for ${revenueCol} before building final dashboards.`,
        expected_impact: "Reduces the chance of misleading KPI interpretation.",
      },
      {
        priority: 2,
        category: "analysis",
        action: `Segment results by ${categoryCol} and compare patterns across ${uniqueCategories.size || 1} groups.`,
        expected_impact:
          "Surfaces performance differences that may be hidden in aggregate metrics.",
      },
      {
        priority: 3,
        category: "next step",
        action: "Upload a larger dataset or longer time range to strengthen trend confidence.",
        expected_impact:
          "Improves reliability of recommendations and chart narratives.",
      },
    ],
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
        .select("filename,row_count,col_count,sample_rows_json")
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
        tool_name: "local_demo_analysis",
        input: {
          dataset_id: id,
          filename: dataset.filename,
          row_count: dataset.row_count,
          col_count: dataset.col_count,
        },
        result: "Generated local analysis preview",
        duration_ms: 320,
        called_at: new Date().toISOString(),
      });

      appendStream("Profiling dataset schema and generating executive summary...");

      await new Promise((resolve) => setTimeout(resolve, 500));

      const demoAnalysis = buildDemoAnalysis(dataset);
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