/**
 * Inline comment thread for a single insight (correlation, anomaly, recommendation).
 * Comments are scoped by `(analysis_id, insight_ref)`. Owners can post; the public
 * share viewer can see them but not post.
 */
import { useEffect, useState } from "react";
import { ownedSupabase } from "@/integrations/supabase/owned";
import { supabase } from "@/integrations/supabase/client";
import { getOwnerToken } from "@/lib/ownerToken";
import { toast } from "@/hooks/use-toast";

interface CommentThreadProps {
  analysisId: string;
  insightRef: string;
  /** When true, render in read-only mode (used on public share viewer). */
  readOnly?: boolean;
}

interface CommentRow {
  id: string;
  content: string;
  created_at: string;
}

export const CommentThread = ({ analysisId, insightRef, readOnly }: CommentThreadProps) => {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, analysisId, insightRef]);

  const load = async () => {
    const client = readOnly ? supabase : ownedSupabase;
    const { data } = await client
      .from("comments")
      .select("id,content,created_at")
      .eq("analysis_id", analysisId)
      .eq("insight_ref", insightRef)
      .order("created_at", { ascending: true });
    setComments((data as CommentRow[]) ?? []);
  };

  const post = async () => {
    const content = draft.trim();
    if (!content) return;
    setSubmitting(true);
    const { error } = await ownedSupabase.from("comments").insert({
      analysis_id: analysisId,
      insight_ref: insightRef,
      content,
      owner_token: getOwnerToken(),
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Could not post", description: error.message, variant: "destructive" });
      return;
    }
    setDraft("");
    void load();
  };

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-primary"
      >
        {open ? "▾" : "▸"} comments {comments.length > 0 && <span className="text-primary">{comments.length}</span>}
      </button>

      {open && (
        <div className="mt-2 pl-3 border-l border-border space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="text-xs">
              <div className="text-foreground whitespace-pre-wrap">{c.content}</div>
              <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                {new Date(c.created_at).toLocaleString()}
              </div>
            </div>
          ))}

          {!readOnly && (
            <div className="flex gap-2 pt-1">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void post()}
                placeholder="Add a note…"
                className="flex-1 bg-background border border-border px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-primary"
              />
              <button
                onClick={() => void post()}
                disabled={submitting || !draft.trim()}
                className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded-sm disabled:opacity-50"
              >
                Post
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
