import { Link, useLocation } from "react-router-dom";

export function TopNav() {
  const location = useLocation();

  const linkClass = (path: string) =>
    `px-4 py-2 rounded-full text-sm font-medium transition ${
      location.pathname.startsWith(path)
        ? "bg-white/10 text-white border border-white/10 shadow-inner"
        : "text-slate-400 hover:text-white hover:bg-white/5"
    }`;

  return (
    <header className="glass-nav sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        
        {/* LEFT: Logo + Brand */}
        <Link to="/dashboard" className="flex items-center gap-3 group">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20 group-hover:scale-105 transition">
            L
          </div>

          <div>
            <div className="text-lg font-semibold tracking-tight text-white group-hover:text-blue-400 transition">
              Luminary
            </div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
              Data Intelligence
            </div>
          </div>
        </Link>

        {/* CENTER NAV */}
        <nav className="hidden md:flex items-center gap-2">
          <Link to="/dashboard" className={linkClass("/dashboard")}>
            Datasets
          </Link>

          <Link to="/upload" className={linkClass("/upload")}>
            Upload
          </Link>
        </nav>

        {/* RIGHT ACTION */}
        <div className="flex items-center gap-3">
          <Link
            to="/upload"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:scale-[1.03] transition"
          >
            + New Analysis
          </Link>
        </div>
      </div>

      {/* subtle divider glow */}
      <div className="h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </header>
  );
}