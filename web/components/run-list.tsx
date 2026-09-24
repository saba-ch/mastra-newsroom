"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { ACTIVE, NO_REPORT } from "@/lib/run-state";
import type { RunSummary } from "../../src/mastra/routes/run-summaries";
import { timeAgo } from "@/lib/time";
import { useRuns } from "./runs-context";
import { Dot, StatusIcon } from "./ui";

/** Second line: the headline for a report, otherwise what happened. */
function subtitle(run: RunSummary): string | undefined {
  if (run.headline) return run.headline;
  if (ACTIVE.has(run.status)) return "writing…";
  if (run.outcome && run.outcome !== "ok") return NO_REPORT[run.outcome].label;
  return run.status;
}

function RunRow({ run, active }: { run: RunSummary; active: boolean }) {
  const report = Boolean(run.headline);
  // A successful run that abstained is not an error, but it is not a report either: amber ring, muted.
  const abstained = run.status === "success" && run.outcome !== "ok";
  // The desk date only when it isn't the day the run was made; "8m ago" already says that.
  const deskDate = run.date && run.date !== run.createdAt.slice(0, 10) ? run.date : undefined;
  return (
    <Link
      href={`/runs/${run.runId}`}
      className={clsx("flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors", active ? "bg-surface4" : "hover:bg-overlay-soft")}
    >
      <span className="mt-0.5">
        {abstained ? <Dot className="size-2.5 border-2 border-accent6" /> : <StatusIcon status={run.status} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={clsx("truncate text-ui-md font-medium", report || ACTIVE.has(run.status) ? "text-neutral6" : "text-neutral3")}>
            {run.topic ?? "Untitled run"}
          </span>
          <span className="ml-auto shrink-0 text-ui-sm text-neutral2">{timeAgo(run.createdAt)}</span>
        </span>
        <span className="mt-0.5 line-clamp-2 text-ui-sm text-neutral3">
          {deskDate && <span className="font-mono text-neutral2">{deskDate} · </span>}
          {subtitle(run)}
        </span>
      </span>
    </Link>
  );
}

export function RunList() {
  const { runs, error } = useRuns();
  const pathname = usePathname();

  return (
    <aside className="flex h-dvh w-72 shrink-0 flex-col border-r border-border1 bg-surface2">
      <div className="flex h-12 items-center gap-2 border-b border-border1 px-4">
        <span className="size-2 rounded-full bg-accent1" />
        <span className="text-ui-md font-semibold tracking-tight">Newsroom</span>
        <span className="ml-auto font-mono text-ui-xs uppercase tracking-wider text-neutral2">mastra</span>
      </div>
      <div className="p-3">
        <Link
          href="/"
          className={clsx(
            "flex h-8 items-center justify-center gap-2 rounded-full border border-border1 text-ui-smd font-medium transition-colors hover:bg-surface6",
            pathname === "/" ? "bg-surface6" : "bg-surface5",
          )}
        >
          <Plus className="size-4" /> New report
        </Link>
      </div>
      <p className="px-4 pb-1 pt-2 font-mono text-ui-xs uppercase tracking-wider text-neutral2">History</p>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {error && <p className="px-2.5 py-2 text-ui-sm text-accent2">Can’t reach Mastra: {error}</p>}
        {!runs && !error && <p className="px-2.5 py-2 text-ui-sm text-neutral2">Loading…</p>}
        {runs?.length === 0 && <p className="px-2.5 py-2 text-ui-sm text-neutral2">No runs yet.</p>}
        {runs?.map((run) => <RunRow key={run.runId} run={run} active={pathname === `/runs/${run.runId}`} />)}
      </nav>
    </aside>
  );
}
