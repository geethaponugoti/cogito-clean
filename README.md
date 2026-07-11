# Luminary

Luminary is a data analysis dashboard: upload a CSV/Excel/Parquet file and get an
instant, computed profile of it — key metrics, correlations, anomalies, and
recommendations — plus a chat panel that answers questions about the dataset
from those computed stats, backed by a Supabase pgvector index of past
analyses for semantic recall.

## Features

- **Upload & parse** CSV, TSV, JSON, XLSX, XLS, and Parquet files client-side
- **Automatic profiling**: column types, key metrics, correlations, anomaly
  detection, and prioritized recommendations
- **Ask-the-data chat**: a side panel that answers questions from the computed
  analysis (streamed responses), with a "memory" of similar past analyses
  retrieved via pgvector similarity search
- **Dashboard** of all previously analyzed datasets
- **Public sharing**: generate a read-only share link for an analysis, with a
  comment thread on individual insights
- **Similar datasets**: sidebar widget surfacing related past uploads by
  schema similarity

## Tech stack

- React 19 + TypeScript + Vite
- Tailwind CSS, Radix UI, Framer Motion, Recharts
- Zustand for client state
- Supabase (Postgres + pgvector, Auth-less owner tokens, Edge Functions)
  - `chat-with-data` — streams SSE responses for the chat panel
  - `embed-content` — embeds datasets/analyses for similarity search

## Running locally

```bash
npm install
npm run dev
```

You'll need a Supabase project with the schema in `supabase/migrations` applied,
and a `.env` file in the project root:

```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Other scripts:

```bash
npm run build     # production build
npm run preview   # preview the production build
npm run lint       # eslint
```

## How it works

1. A file is parsed and profiled entirely in the browser (schema detection,
   column stats).
2. The dataset record and sample rows are saved to Supabase.
3. An analysis is computed (key metrics, correlations, anomalies, trends,
   recommendations) and saved alongside an embedding for similarity search.
4. The chat panel answers questions by pattern-matching the question against
   the computed analysis — not a hosted LLM — and pulls related past analyses
   from the pgvector index as supporting "memory."

## Author

Geetha Ponugoti — [GitHub](https://github.com/geethaponugoti)
