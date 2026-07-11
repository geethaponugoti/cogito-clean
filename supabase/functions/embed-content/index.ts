import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function embed(text: string): Promise<number[]> {
  const model = new Supabase.ai.Session("gte-small");
  const result = (await model.run(text, { mean_pool: true, normalize: true })) as number[];
  return result;
}

function datasetText(row: {
  filename: string;
  column_stats_json: Record<string, { type: string }> | null;
  sample_rows_json: Record<string, unknown>[] | null;
}): string {
  const columns = Object.entries(row.column_stats_json ?? {})
    .map(([name, stats]) => `${name} (${stats.type})`)
    .join(", ");
  const sample = (row.sample_rows_json ?? []).slice(0, 3).map((r) => JSON.stringify(r)).join("\n");
  return `Dataset: ${row.filename}\nColumns: ${columns}\nSample rows:\n${sample}`;
}

async function embedDataset(id: string) {
  const { data, error } = await supabase
    .from("datasets")
    .select("filename,column_stats_json,sample_rows_json")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Dataset not found");

  const embedding = await embed(datasetText(data));
  const { error: updateError } = await supabase.from("datasets").update({ embedding }).eq("id", id);
  if (updateError) throw new Error(updateError.message);
  return embedding;
}

async function embedAnalysis(id: string) {
  const { data, error } = await supabase
    .from("analyses")
    .select("filename,executive_summary")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Analysis not found");

  const embedding = await embed(`${data.filename ?? ""}\n${data.executive_summary}`);
  const { error: updateError } = await supabase.from("analyses").update({ embedding }).eq("id", id);
  if (updateError) throw new Error(updateError.message);
  return embedding;
}

async function getOrCreateDatasetEmbedding(id: string): Promise<number[]> {
  const { data, error } = await supabase.from("datasets").select("embedding").eq("id", id).single();
  if (error || !data) throw new Error(error?.message ?? "Dataset not found");
  if (data.embedding) return data.embedding as unknown as number[];
  return await embedDataset(id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { kind, id, limit } = await req.json();
    if (!kind || !id) {
      return new Response(JSON.stringify({ error: "kind and id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (kind === "dataset") {
      await embedDataset(id);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (kind === "analysis") {
      await embedAnalysis(id);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (kind === "similar_datasets") {
      const queryEmbedding = await getOrCreateDatasetEmbedding(id);
      const { data, error } = await supabase.rpc("match_similar_datasets", {
        query_embedding: queryEmbedding,
        match_count: limit ?? 5,
        exclude_id: id,
      });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ matches: data ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown kind: ${kind}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
