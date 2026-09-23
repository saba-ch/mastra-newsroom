"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { POLL_MS } from "@/lib/run-state";
import type { RunSummary } from "@/lib/run-summary";

// Run history for the sidebar, from Mastra's run storage via /api/runs. Pages call refresh() on start/finish.
// While runs are going, poll only the running ones (small) and refetch the full list when that set changes.

interface RunsValue {
  runs: RunSummary[] | undefined;
  error: string | undefined;
  refresh: () => void;
}

const RunsContext = createContext<RunsValue | null>(null);

async function fetchRuns(query = ""): Promise<RunSummary[]> {
  const res = await fetch(`/api/runs${query}`, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body.runs;
}

export function RunsProvider({ children }: { children: ReactNode }) {
  const [runs, setRuns] = useState<RunSummary[]>();
  const [error, setError] = useState<string>();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetchRuns()
      .then((next) => { if (!cancelled) { setRuns(next); setError(undefined); } })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [tick]);

  const running = runs?.filter((r) => r.status === "running").map((r) => r.runId).sort().join(",") ?? "";
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      fetchRuns("?status=running")
        .then((now) => { if (now.map((r) => r.runId).sort().join(",") !== running) refresh(); })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(id);
  }, [running, refresh]);

  return <RunsContext.Provider value={{ runs, error, refresh }}>{children}</RunsContext.Provider>;
}

export function useRuns(): RunsValue {
  const value = useContext(RunsContext);
  if (!value) throw new Error("useRuns must be used inside <RunsProvider>");
  return value;
}
