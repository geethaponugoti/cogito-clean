import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { TopNav } from "@/components/TopNav";

const features = [
  {
    title: "Multi-step agentic loop",
    body: "The agent reasons, picks tools, runs computations, and self-corrects — never just one prompt.",
    glyph: "⟁",
  },
  {
    title: "Six computational tools",
    body: "Correlation, outliers, group stats, time trends, hypotheses, quality checks. Computed, not guessed.",
    glyph: "✶",
  },
  {
    title: "Streaming insights",
    body: "Watch tool calls and the executive summary stream in live as the agent thinks.",
    glyph: "↯",
  },
  {
    title: "Chat your data",
    body: "Ask follow-up questions. The agent calls tools again and cites real numbers.",
    glyph: "❍",
  },
  {
    title: "Smart ingestion",
    body: "CSV, TSV, JSON, Excel — parsed in your browser with full per-column statistics.",
    glyph: "▦",
  },
  {
    title: "Audit-ready",
    body: "Every tool call logged with inputs, outputs, and duration. Full traceability.",
    glyph: "◈",
  },
];

const fakeLines = [
  "→ check_data_quality(scope=dataset)",
  "  ↳ quality_score=87 issues=3",
  "→ compute_correlation(revenue, ad_spend)",
  "  ↳ r=0.74 p<0.001 strong positive",
  "→ find_time_trend(date, revenue)",
  "  ↳ trend=up growth_rate=23.4%",
  "→ detect_outliers(transaction_amt)",
  "  ↳ outliers=12 pct=0.4%",
  "→ submit_analysis(...)",
  "✔ analysis complete in 8.3s",
];

const Index = () => {
  // Subtle parallax tilt on hero scene following pointer
  const sceneRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(x * 8).toFixed(2)}deg`);
    };
    const onLeave = () => {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />

      {/* ============== HERO ============== */}
      <section className="relative overflow-hidden">
        {/* Floating orbs */}
        <div className="orb animate-float-slow" style={{ top: "-6rem", left: "-6rem", width: 480, height: 480, background: "hsl(var(--ember) / 0.55)" }} />
        <div className="orb animate-float-med" style={{ top: "10rem", right: "-4rem", width: 380, height: 380, background: "hsl(var(--accent) / 0.45)" }} />
        <div className="orb animate-float-fast" style={{ bottom: "-8rem", left: "30%", width: 420, height: 420, background: "hsl(var(--primary) / 0.4)" }} />

        {/* Faint grid */}
        <div className="absolute inset-0 terminal-grid opacity-30 pointer-events-none" />

        <div ref={sceneRef} className="container relative scene-3d py-20 md:py-28 grid lg:grid-cols-12 gap-12 items-center">
          {/* LEFT — copy */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="lg:col-span-7 preserve-3d"
            style={{ transform: "translateZ(40px)" }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-[11px] font-mono text-muted-foreground tracking-widest uppercase">
                agent_online · gemini-2.5-pro
              </span>
            </div>

            <h1 className="font-display font-extrabold text-5xl md:text-7xl leading-[0.98] tracking-tight">
              Your data,
              <br />
              <span className="text-molten animate-aurora bg-gradient-aurora">
                interrogated
              </span>{" "}
              <span className="inline-block">by an agent.</span>
            </h1>

            <p className="mt-7 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
              Luminary doesn't summarize your CSV — it{" "}
              <span className="text-foreground">runs analyses</span>, calls statistical tools, and cites real
              numbers. Watch it think, in real time.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <Link to="/upload" className="btn-molten">
                Start an analysis
                <span className="ml-2">→</span>
              </Link>
              <Link to="/dashboard" className="btn-aurora">
                View datasets
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
              {[
                { n: "6", l: "analysis tools" },
                { n: "8×", l: "avg iterations" },
                { n: "0", l: "hallucinated stats" },
              ].map((s) => (
                <div key={s.l} className="border-l border-primary/40 pl-3">
                  <div className="text-3xl font-bold font-mono-data text-foreground">{s.n}</div>
                  <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* RIGHT — 3D layered terminal scene */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.15 }}
            className="lg:col-span-5 relative h-[480px] preserve-3d"
            style={{
              transform: "rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))",
              transition: "transform 250ms ease-out",
            }}
          >
            {/* Glow halo */}
            <div className="absolute inset-10 rounded-[2rem] bg-gradient-aurora opacity-40 blur-3xl animate-glow-pulse" />

            {/* Back card — metric */}
            <div
              className="absolute top-2 right-0 w-56 glass-aurora rounded-2xl p-5 preserve-3d"
              style={{ transform: "translateZ(20px) rotate(6deg)" }}
            >
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                accuracy
              </div>
              <div className="font-mono-data font-bold text-4xl text-molten bg-gradient-aurora mt-1">
                92.5%
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full w-[92%] bg-gradient-aurora animate-aurora" />
              </div>
              <div className="text-[11px] text-muted-foreground mt-2">predictive model</div>
            </div>

            {/* Front card — terminal */}
            <div
              className="absolute bottom-0 left-0 right-8 glass-ember rounded-2xl overflow-hidden preserve-3d"
              style={{ transform: "translateZ(60px) rotate(-3deg)" }}
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-background/40">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-success/80" />
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">agent_loop.log</span>
                <span className="text-[10px] font-mono text-primary">● LIVE</span>
              </div>
              <div className="p-5 font-mono text-xs space-y-1.5 min-h-[300px]">
                {fakeLines.map((l, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.16 }}
                    className={
                      l.startsWith("✔")
                        ? "text-success"
                        : l.startsWith("→")
                          ? "text-primary"
                          : "text-muted-foreground"
                    }
                  >
                    {l}
                  </motion.div>
                ))}
                <div className="streaming-cursor inline-block text-primary" />
              </div>
            </div>

            {/* Tiny floating chip */}
            <div
              className="absolute -bottom-4 right-2 glass rounded-full px-4 py-2 preserve-3d animate-float-fast"
              style={{ transform: "translateZ(90px)" }}
            >
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                r = <span className="text-primary">0.74</span>
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============== TICKER BAR ============== */}
      <section className="border-y border-border/60 bg-card/30 backdrop-blur-xl overflow-hidden">
        <div className="flex gap-12 py-4 whitespace-nowrap animate-ticker font-mono text-xs text-muted-foreground">
          {Array.from({ length: 2 }).flatMap((_, k) =>
            [
              "PEARSON · SPEARMAN",
              "IQR OUTLIER DETECTION",
              "GROUP-BY AGGREGATIONS",
              "TIME-SERIES TRENDS",
              "HYPOTHESIS TESTING",
              "DATA QUALITY SCAN",
              "VECTOR SIMILARITY",
              "STREAMING TOOL CALLS",
            ].map((t, i) => (
              <span key={`${k}-${i}`} className="flex items-center gap-12">
                <span className="text-primary">◆</span>
                <span className="tracking-[0.3em] uppercase">{t}</span>
              </span>
            )),
          )}
        </div>
      </section>

      {/* ============== FEATURES — 3D grid ============== */}
      <section className="relative py-28">
        <div className="container">
          <div className="max-w-3xl mb-16">
            <div className="text-xs font-mono text-primary tracking-widest uppercase mb-4">
              /the runtime
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl tracking-tight leading-tight">
              Not a chat wrapper.
              <br />
              <span className="text-muted-foreground">A structured analysis runtime.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 perspective-1200">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20, rotateX: -8 }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.08, duration: 0.6 }}
                className="tilt-card glass rounded-2xl p-7 group"
              >
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center mb-5 text-2xl text-primary"
                  style={{ background: "hsl(var(--primary) / 0.1)", border: "1px solid hsl(var(--primary) / 0.3)" }}
                >
                  {f.glyph}
                </div>
                <div className="font-mono text-[10px] text-primary tracking-widest mb-2">
                  /{String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="font-display font-semibold text-xl mb-3">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== CTA — molten ============== */}
      <section className="relative py-28">
        <div className="container">
          <div className="relative overflow-hidden rounded-[2rem] glass-ember p-12 md:p-20 text-center noise">
            <div className="orb animate-float-slow" style={{ top: "-50%", left: "-10%", width: 500, height: 500, background: "hsl(var(--primary) / 0.5)" }} />
            <div className="orb animate-float-med" style={{ bottom: "-50%", right: "-10%", width: 500, height: 500, background: "hsl(var(--accent) / 0.4)" }} />

            <div className="relative z-10">
              <div className="text-xs font-mono text-primary tracking-widest uppercase mb-5">
                /ready when you are
              </div>
              <h2 className="font-display font-bold text-4xl md:text-6xl tracking-tight mb-5">
                Drop a file.{" "}
                <span className="text-molten bg-gradient-aurora">See the agent work.</span>
              </h2>
              <p className="text-muted-foreground mb-10 max-w-md mx-auto text-lg">
                No signup required for this preview.
              </p>
              <Link to="/upload" className="btn-molten text-base">
                Upload a dataset
                <span className="ml-2">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 mt-auto">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-mono text-muted-foreground">
          <span>© Luminary · molten core</span>
          <span>AI-powered dataset intelligence platform</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
