import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface MemoryItem {
  analysis_id: string;
  dataset_id: string;
  similarity: number;
  snippet: string;
  filename?: string;
  created_at?: string;
}

interface AnalysisJson {
  executive_summary: string;
  key_metrics: { label: string; value: string; unit: string; trend: string; insight: string }[];
  correlations: { col_a: string; col_b: string; strength: number }[];
  anomalies: { column: string; description: string; severity: string; count: number; example_values: unknown[] }[];
  recommendations: { priority: number; category: string; action: string; expected_impact: string }[];
}

async function embed(text: string): Promise<number[]> {
  const model = new Supabase.ai.Session("gte-small");
  return (await model.run(text, { mean_pool: true, normalize: true })) as number[];
}

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Rule-based answer generator — no external LLM, no API key required.
 * Mirrors the same "computed, not guessed" approach the client-side demo
 * analysis already uses, so the chat feature works with only a Supabase project.
 */
function heuristicAnswer(
  message: string,
  dataset: { filename: string; row_count: number; col_count: number },
  analysis: AnalysisJson | null,
): string {
  const q = message.toLowerCase();

  if (!analysis) {
    return `I don't have a saved analysis for **${dataset.filename}** yet (${dataset.row_count.toLocaleString()} rows, ${dataset.col_count} columns). Run "Run agentic analysis" on this dataset first, then ask again — I answer from the computed stats, not guesses.`;
  }

  if (/strongest signal|most informative|important column|which column/.test(q)) {
    const top = [...analysis.correlations].sort((a, b) => Math.abs(b.strength) - Math.abs(a.strength))[0];
    if (top) {
      return `The strongest relationship is between **${top.col_a}** and **${top.col_b}** (r = ${top.strength.toFixed(2)}). ${
        Math.abs(top.strength) >= 0.5 ? "That's a meaningfully strong correlation" : "That's a fairly weak correlation"
      } — worth investigating further before treating it as causal.`;
    }
    return `No strong correlations were detected across the numeric columns in this sample.`;
  }

  if (/outlier|anomal/.test(q)) {
    if (analysis.anomalies.length === 0) return "No anomalies were flagged in the last analysis.";
    return analysis.anomalies
      .map((a) => `**${a.column}** (${a.severity}): ${a.description} — ${a.count} row(s), e.g. ${a.example_values.slice(0, 3).join(", ")}`)
      .join("\n");
  }

  if (/correlat/.test(q)) {
    if (analysis.correlations.length === 0) return "No correlations were computed for this dataset.";
    return analysis.correlations
      .map((c) => `**${c.col_a}** × **${c.col_b}**: r = ${c.strength.toFixed(2)}`)
      .join("\n");
  }

  if (/recommend/.test(q)) {
    return analysis.recommendations
      .sort((a, b) => a.priority - b.priority)
      .map((r) => `P${r.priority} (${r.category}): ${r.action} — ${r.expected_impact}`)
      .join("\n");
  }

  if (/trend|growth|up|down/.test(q)) {
    const trending = analysis.key_metrics.filter((m) => m.trend === "up" || m.trend === "down");
    if (trending.length === 0) return "No clear up/down trends were flagged among the key metrics.";
    return trending.map((m) => `**${m.label}**: ${m.value}${m.unit} (${m.trend}) — ${m.insight}`).join("\n");
  }

  return `${analysis.executive_summary}\n\nKey metrics: ${analysis.key_metrics
    .map((m) => `${m.label} = ${m.value}${m.unit}`)
    .join(", ")}.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ownerToken = req.headers.get("x-owner-token") ?? "";
  const { dataset_id, session_id, message } = await req.json();

  if (!dataset_id || !message) {
    return new Response(JSON.stringify({ error: "dataset_id and message are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sessionId = session_id ?? crypto.randomUUID();

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(sse(event, data)));

      try {
        send("session", { session_id: sessionId });

        const { data: dataset, error: datasetError } = await supabase
          .from("datasets")
          .select("filename,row_count,col_count")
          .eq("id", dataset_id)
          .single();
        if (datasetError || !dataset) throw new Error(datasetError?.message ?? "Dataset not found");

        const { data: latestAnalysis } = await supabase
          .from("analyses")
          .select("analysis_json")
          .eq("dataset_id", dataset_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let memory: MemoryItem[] = [];
        try {
          const queryEmbedding = await embed(message);
          const { data: matches } = await supabase.rpc("match_analyses", {
            query_embedding: queryEmbedding,
            match_count: 3,
            owner_token_filter: ownerToken,
          });
          memory = (matches ?? []) as MemoryItem[];
        } catch {
          // memory retrieval is best-effort
        }
        if (memory.length > 0) send("memory", { items: memory });

        const answer = heuristicAnswer(
          message,
          dataset,
          (latestAnalysis?.analysis_json as AnalysisJson | undefined) ?? null,
        );

        for (const word of answer.split(/(\s+)/)) {
          send("text", { chunk: word });
          await new Promise((r) => setTimeout(r, 12));
        }
      } catch (e) {
        send("error", { message: e instanceof Error ? e.message : "Unknown error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
