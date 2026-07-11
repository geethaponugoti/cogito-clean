/**
 * Public, read-only viewer for a shared analysis.
 * No auth required — uses two SECURITY DEFINER RPCs:
 *   - get_shared_analysis(token)  → analysis payload
 *   - record_share_view(token)    → increments view counter
 *
 * Comments are visible (RLS allows reads when a public share exists for the
 * analysis) but only the owning browser can post.
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CommentThread } from "@/components/CommentThread";
import type { AnalysisJson } from "@/store";

interface SharedRow {
  analysis_id: string;
  dataset_id: string;
  filename: string;
  row_count: number;
  col_count: number;
  analysis_json: AnalysisJson | null;
  permissions_json: { level?: string };
  created_at: string;
}

const SharedView = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      const { data: rows } = await supabase.rpc("get_shared_analysis", { p_share_token: token });
      const row = (rows as unknown as SharedRow[] | null)?.[0] ?? null;
      if (!row) {
        setNotFound(true);
      } else {
        setData(row);
        await supabase.rpc("record_share_view", { p_share_token: token });
      }
      setLoading(false);
    })();
  }, [token]);

  if (loading) return <div className="container py-20 font-mono text-muted-foreground">loading_shared_analysis…</div>;

  if (notFound) {
    return (
      <div className="container py-20 text-center">
        <div className="font-mono text-xs text-muted-foreground mb-3">SHARE_NOT_FOUND</div>
        <h1 className="font-display font-semibold text-2xl mb-2">This share link is invalid or expired</h1>
        <Link to="/" className="text-primary underline text-sm">Go home →</Link>
      </div>
    );
  }

  const a = data?.analysis_json;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 bg-gradient-glow shadow-glow flex items-center justify-center rounded-sm">
              <span className="text-primary-foreground font-mono font-bold text-sm">L</span>
            </div>
            <span className="font-display font-bold tracking-tight text-lg">
              Luminary<span className="text-primary">.</span>
            </span>
          </Link>
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">SHARED_VIEW · read_only</span>
        </div>
      </header>

      <main className="container py-8 max-w-5xl">
        <div className="mb-6">
          <div className="text-xs font-mono text-muted-foreground">/share/{token?.slice(0, 8)}…</div>
          <h1 className="font-display font-bold text-2xl tracking-tight mt-1">{data?.filename}</h1>
          <div className="text-xs font-mono text-muted-foreground mt-1">
            {data?.row_count.toLocaleString()} rows · {data?.col_count} columns ·{" "}
            {data?.created_at ? new Date(data.created_at).toLocaleDateString() : ""}
          </div>
        </div>

        {!a ? (
          <div className="card-surface p-6 text-sm text-muted-foreground">No analysis payload available.</div>
        ) : (
          <>
            <div className="card-surface p-5 mb-4">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Executive summary</div>
              <div className="text-sm leading-relaxed">{a.executive_summary}</div>
              {data && <CommentThread analysisId={data.analysis_id} insightRef="executive_summary" readOnly />}
            </div>

            <div className="card-surface p-5 mb-4">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Key metrics</div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {a.key_metrics.map((m, i) => (
                  <div key={i} className="border border-border rounded-sm p-3">
                    <div className="text-xs font-mono text-muted-foreground uppercase truncate">{m.label}</div>
                    <div className="font-mono-data text-xl font-semibold mt-1">{m.value}</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.insight}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-surface p-5 mb-4">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Anomalies</div>
              <div className="space-y-2">
                {a.anomalies.map((an, i) => (
                  <div key={i} className="py-2 border-b border-border last:border-0">
                    <div className="text-sm">
                      <span className="font-mono text-primary">{an.column}</span> · {an.description}
                    </div>
                    {data && <CommentThread analysisId={data.analysis_id} insightRef={`anomaly_${i}`} readOnly />}
                  </div>
                ))}
              </div>
            </div>

            <div className="card-surface p-5">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Recommendations</div>
              <div className="space-y-2">
                {a.recommendations
                  .sort((x, y) => x.priority - y.priority)
                  .map((r, i) => (
                    <div key={i} className="py-2 border-b border-border last:border-0">
                      <div className="text-sm">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-primary/15 text-primary border border-primary/40 rounded-sm mr-2">
                          P{r.priority}
                        </span>
                        {r.action}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{r.expected_impact}</div>
                      {data && <CommentThread analysisId={data.analysis_id} insightRef={`recommendation_${i}`} readOnly />}
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default SharedView;
