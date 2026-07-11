/**
 * Sidebar widget that surfaces the most similar past datasets via pgvector.
 * Hidden if there are fewer than 2 datasets indexed.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface SimilarDatasetsProps {
  datasetId: string;
}

interface Match {
  dataset_id: string;
  filename: string;
  row_count: number;
  col_count: number;
  similarity: number;
}

export const SimilarDatasets = ({ datasetId }: SimilarDatasetsProps) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        // Fetch matches via the embed-content edge function which knows how
        // to embed the seed dataset (or reuse an existing embedding).
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/embed-content`;
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ kind: "similar_datasets", id: datasetId, limit: 5 }),
        });
        if (!resp.ok) {
          setLoading(false);
          return;
        }
        const json = await resp.json();
        setMatches((json.matches as Match[]) ?? []);
      } catch {
        // best-effort
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId]);
  // We intentionally skip ownedSupabase and call the edge function instead so
  // the SECURITY DEFINER `match_similar_datasets` RPC can search across owners.

  if (loading) {
    return (
      <div className="card-surface p-4">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Similar datasets</div>
        <div className="h-12 shimmer rounded-sm" />
      </div>
    );
  }

  if (matches.length === 0) return null;

  return (
    <div className="card-surface p-4">
      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
        Similar datasets
      </div>
      <div className="space-y-2">
        {matches.map((m) => (
          <Link
            key={m.dataset_id}
            to={`/analyze/${m.dataset_id}`}
            className="block border border-border rounded-sm p-2 hover:bg-accent text-sm"
          >
            <div className="flex items-center justify-between">
              <span className="truncate font-medium">{m.filename}</span>
              <span className="text-[10px] font-mono text-primary ml-2">
                {(m.similarity * 100).toFixed(0)}%
              </span>
            </div>
            <div className="text-xs text-muted-foreground font-mono mt-0.5">
              {m.row_count.toLocaleString()} rows · {m.col_count} cols
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
