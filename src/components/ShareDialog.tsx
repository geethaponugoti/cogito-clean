/**
 * Modal for sharing an analysis. Creates a `shared_analyses` row with a
 * random share token and copies the public link to the clipboard.
 */
import { useEffect, useState } from "react";
import { ownedSupabase } from "@/integrations/supabase/owned";
import { getOwnerToken } from "@/lib/ownerToken";
import { toast } from "@/hooks/use-toast";

interface ShareDialogProps {
  analysisId: string;
  open: boolean;
  onClose: () => void;
}

interface ExistingShare {
  id: string;
  share_token: string;
  view_count: number;
  created_at: string;
}

function buildShareUrl(token: string): string {
  return `${window.location.origin}/share/${token}`;
}

function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const ShareDialog = ({ analysisId, open, onClose }: ShareDialogProps) => {
  const [shares, setShares] = useState<ExistingShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    void loadShares();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, analysisId]);

  const loadShares = async () => {
    setLoading(true);
    const { data } = await ownedSupabase
      .from("shared_analyses")
      .select("id,share_token,view_count,created_at")
      .eq("analysis_id", analysisId)
      .order("created_at", { ascending: false });
    setShares((data as ExistingShare[]) ?? []);
    setLoading(false);
  };

  const create = async () => {
    setCreating(true);
    const token = randomToken();
    const { error } = await ownedSupabase.from("shared_analyses").insert({
      analysis_id: analysisId,
      share_token: token,
      is_public: true,
      owner_token: getOwnerToken(),
    });
    setCreating(false);
    if (error) {
      toast({ title: "Could not create share link", description: error.message, variant: "destructive" });
      return;
    }
    await loadShares();
    await navigator.clipboard.writeText(buildShareUrl(token)).catch(() => {/* noop */});
    toast({ title: "Share link copied", description: "Anyone with the link can view this analysis." });
  };

  const revoke = async (id: string) => {
    const { error } = await ownedSupabase.from("shared_analyses").delete().eq("id", id);
    if (error) {
      toast({ title: "Could not revoke", description: error.message, variant: "destructive" });
      return;
    }
    await loadShares();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="card-surface w-full max-w-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Share</div>
            <h3 className="font-display font-semibold text-lg">Public read-only link</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">
            ×
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Anyone with the link can view the insights, charts, and comments. They cannot run new analyses or see the
          underlying raw data.
        </p>

        <button
          onClick={create}
          disabled={creating}
          className="w-full px-4 py-2 bg-primary text-primary-foreground font-medium rounded-sm hover:shadow-glow disabled:opacity-60 mb-4"
        >
          {creating ? "Creating…" : "+ Create new share link"}
        </button>

        <div className="space-y-2">
          {loading ? (
            <div className="h-12 shimmer rounded-sm" />
          ) : shares.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4 font-mono">no_active_shares</div>
          ) : (
            shares.map((s) => {
              const url = buildShareUrl(s.share_token);
              return (
                <div key={s.id} className="border border-border rounded-sm p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate text-xs bg-background px-2 py-1 rounded-sm font-mono">
                      {url}
                    </code>
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(url);
                        toast({ title: "Copied", description: "Share link copied to clipboard." });
                      }}
                      className="px-2 py-1 text-xs border border-border hover:bg-accent rounded-sm"
                    >
                      copy
                    </button>
                    <button
                      onClick={() => void revoke(s.id)}
                      className="px-2 py-1 text-xs border border-destructive/40 text-destructive hover:bg-destructive/10 rounded-sm"
                    >
                      revoke
                    </button>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2 font-mono">
                    {s.view_count} views · {new Date(s.created_at).toLocaleDateString()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
