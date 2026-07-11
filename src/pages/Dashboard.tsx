import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TopNav } from "@/components/TopNav";
import { ownedSupabase } from "@/integrations/supabase/owned";

interface DatasetRow {
  id: string;
  filename: string;
  row_count: number;
  col_count: number;
  file_size: number;
  created_at: string;
  last_analyzed_at: string | null;
}

const Dashboard = () => {
  const [datasets, setDatasets] = useState<DatasetRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await ownedSupabase
        .from("datasets")
        .select("id,filename,row_count,col_count,file_size,created_at,last_analyzed_at")
        .order("created_at", { ascending: false });
      setDatasets((data as DatasetRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="container py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="text-xs font-mono text-muted-foreground mb-1">/datasets</div>
            <h1 className="font-display font-bold text-3xl tracking-tight">Your datasets</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Anonymous browser session — clearing site data will hide your datasets.
            </p>
          </div>
          <Link
            to="/upload"
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:shadow-glow transition-shadow rounded-sm"
          >
            + Upload
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 shimmer rounded-sm" />
            ))}
          </div>
        ) : datasets.length === 0 ? (
          <div className="card-surface p-12 text-center">
            <div className="font-mono text-xs text-muted-foreground mb-3">EMPTY_LIBRARY</div>
            <p className="text-muted-foreground mb-6">No datasets yet. Upload your first file to get started.</p>
            <Link
              to="/upload"
              className="inline-block px-5 py-2.5 bg-primary text-primary-foreground font-medium rounded-sm hover:shadow-glow"
            >
              Upload a dataset
            </Link>
          </div>
        ) : (
          <div className="card-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Filename</th>
                  <th className="text-right px-4 py-3 font-medium font-mono">Rows</th>
                  <th className="text-right px-4 py-3 font-medium font-mono">Cols</th>
                  <th className="text-right px-4 py-3 font-medium font-mono">Size</th>
                  <th className="text-right px-4 py-3 font-medium">Uploaded</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody>
                {datasets.map((d) => (
                  <tr key={d.id} className="data-table-row border-t border-border">
                    <td className="px-4 py-3 font-medium">{d.filename}</td>
                    <td className="px-4 py-3 text-right font-mono-data">{d.row_count.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono-data">{d.col_count}</td>
                    <td className="px-4 py-3 text-right font-mono-data text-muted-foreground">
                      {(d.file_size / 1024).toFixed(1)} KB
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                      {new Date(d.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/analyze/${d.id}`}
                        className="text-primary hover:text-primary-glow text-sm font-medium"
                      >
                        Analyze →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
