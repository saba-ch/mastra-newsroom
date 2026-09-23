"use client";

import { useEffect, useReducer, useState } from "react";
import type { GetWorkflowRunByIdResponse, StreamVNextChunkType } from "@mastra/client-js";
import type { WorkflowStateField } from "@mastra/core/workflows";
import clsx from "clsx";
import { Check, ChevronDown, ChevronRight, Copy, Download, ExternalLink } from "lucide-react";
import { MASTRA_URL, WORKFLOW_KEY, newsReport } from "@/lib/mastra";
import { PENDING_INPUT_PREFIX } from "@/lib/pending-input";
import { ACTIVE, NO_REPORT, POLL_MS, applyChunk, fromStoredRun, type RunState } from "@/lib/run-state";
import { formatDuration } from "@/lib/time";
import type { Input } from "../../src/mastra/types";
import { Markdown } from "./markdown";
import { useRuns } from "./runs-context";
import { Sources } from "./sources";
import { StepTimeline, visibleSteps } from "./step-timeline";
import { Alert, Badge, Button, Chip, statusTone, toneClass } from "./ui";

const FIELDS: WorkflowStateField[] = ["result", "error", "payload", "steps"];

type Action =
  | { type: "start"; input: Input }
  | { type: "chunk"; chunk: StreamVNextChunkType }
  | { type: "stored"; run: GetWorkflowRunByIdResponse }
  | { type: "error"; message: string };

function reducer(state: RunState, action: Action): RunState {
  switch (action.type) {
    case "start":
      return { ...state, input: action.input };
    case "chunk":
      return applyChunk(state, action.chunk);
    case "stored": {
      const stored = fromStoredRun(action.run);
      // Storage has no foreach progress: keep the live counts, let stored status and timings win.
      const steps = { ...state.steps };
      for (const [id, step] of Object.entries(stored.steps)) {
        const defined = Object.fromEntries(Object.entries(step).filter(([, v]) => v !== undefined));
        steps[id] = { ...state.steps[id], ...defined } as RunState["steps"][string];
      }
      return { ...stored, steps, input: stored.input ?? state.input, angles: stored.angles ?? state.angles };
    }
    case "error":
      return { ...state, status: "failed", error: action.message };
  }
}

export function RunView({ runId }: { runId: string }) {
  const { refresh } = useRuns();
  const [state, dispatch] = useReducer(reducer, { runId, status: "pending", steps: {} });

  useEffect(() => {
    let cancelled = false;
    let reader: ReadableStreamDefaultReader<StreamVNextChunkType> | undefined;

    /** Feeds chunks to the reducer; true if the stream carried a successful finish (the result is in hand). */
    async function consume(stream: ReadableStream<StreamVNextChunkType>): Promise<boolean> {
      reader = stream.getReader();
      if (cancelled) {
        reader.cancel().catch(() => {});
        return false;
      }
      let finished = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done || cancelled) return finished;
        finished ||= value.type === "workflow-finish" && value.payload?.workflowStatus === "success";
        dispatch({ type: "chunk", chunk: value });
      }
    }

    const load = () => newsReport.runById(runId, { fields: FIELDS });

    (async () => {
      const key = PENDING_INPUT_PREFIX + runId;
      const pending = sessionStorage.getItem(key);
      let finished: boolean;
      if (pending) {
        // Fresh run from the form: start it and follow the live stream. The key goes before the first await,
        // so React dev StrictMode's second effect pass takes the reattach path below instead of starting twice.
        sessionStorage.removeItem(key);
        const inputData = JSON.parse(pending) as Input;
        dispatch({ type: "start", input: inputData });
        const run = await newsReport.createRun({ runId });
        finished = await consume(await run.stream({ inputData }));
      } else {
        // Existing run: show what storage has. If it is still going, reattach: observe() replays the run's
        // cached events and then continues live.
        const stored = await load();
        if (cancelled) return;
        dispatch({ type: "stored", run: stored });
        if (!ACTIVE.has(stored.status)) return;
        const run = await newsReport.createRun({ runId }); // handle for an existing runId; does not reset it
        finished = await consume(await run.observe());
      }
      if (cancelled) return;
      if (!finished) {
        // No result from the stream (failed, or the event cache is gone after a server restart): storage is the
        // source of truth. Poll while it is still active, like Studio does.
        let stored = await load();
        while (!cancelled && ACTIVE.has(stored.status)) {
          dispatch({ type: "stored", run: stored });
          await new Promise((r) => setTimeout(r, POLL_MS));
          stored = await load();
        }
        if (cancelled) return;
        dispatch({ type: "stored", run: stored });
      }
      refresh();
    })().catch((error: unknown) => {
      if (!cancelled) dispatch({ type: "error", message: error instanceof Error ? error.message : String(error) });
    });

    return () => {
      cancelled = true;
      reader?.cancel().catch(() => {}); // the run keeps going server-side; only this tab stops listening
    };
  }, [runId, refresh]);

  const active = ACTIVE.has(state.status);
  const report = state.result?.status === "ok" ? state.result : undefined;

  // When the run finishes while you watch, the page turns into the report: start reading from the top.
  const hasReport = Boolean(report);
  useEffect(() => {
    if (hasReport) document.querySelector("main")?.scrollTo({ top: 0 });
  }, [hasReport]);

  if (report) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <Toolbar state={state} />
        {/* The report ends with its own "## Sources" list so it stands alone as markdown; the cards below replace it
            here. Cut at the last one, like the citation scorer does. */}
        <article className="mt-8">
          <Markdown size="lg">{withoutSources(report.report)}</Markdown>
        </article>
        <section className="mt-12">
          <Sources sources={report.sources} />
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <RunHeader state={state} />
      {active ? (
        <section className="mt-8">
          <StepTimeline state={state} />
        </section>
      ) : (
        <>
          <section className="mt-8">
            <Outcome state={state} />
          </section>
          <section className="mt-8">
            <HowItWasMade state={state} open={state.status === "failed"} />
          </section>
        </>
      )}
    </div>
  );
}

function withoutSources(report: string) {
  const cut = report.lastIndexOf("\n## Sources\n");
  return cut === -1 ? report : report.slice(0, cut);
}

function StatusBadge({ state }: { state: RunState }) {
  if (state.result && state.result.status !== "ok") return <Badge tone="warning">{NO_REPORT[state.result.status].label}</Badge>;
  return <Badge tone={statusTone(state.status)} pulse={ACTIVE.has(state.status)}>{state.status}</Badge>;
}

/** Running, failed and abstained runs: the run is the subject. */
function RunHeader({ state }: { state: RunState }) {
  // Nothing known yet: the stored run (or the form's input) hasn't arrived.
  const loading = !state.input && state.status === "pending" && !state.error;
  return (
    <header className="flex flex-wrap items-start gap-x-4 gap-y-2">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-ui-xs uppercase tracking-wider text-neutral2">{state.input?.date ?? (loading ? "\u00a0" : "today")}</p>
        <h1 className="mt-1 truncate text-header-xl font-semibold tracking-tight">{state.input?.topic ?? (loading ? "Loading…" : "Untitled run")}</h1>
      </div>
      <div className="flex items-center gap-3 pt-4">
        <Elapsed state={state} />
        <StatusBadge state={state} />
      </div>
    </header>
  );
}

/** Finished report: a slim bar, the report is the subject. */
function Toolbar({ state }: { state: RunState }) {
  const result = state.result!;
  const [copied, setCopied] = useState(false);
  const [showRun, setShowRun] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(result.report);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([result.report], { type: "text/markdown" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${result.date}-${result.topic.replace(/\W+/g, "-").toLowerCase()}.md` });
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="border-b border-border1 pb-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-mono text-ui-xs uppercase tracking-wider text-neutral2">
          {result.topic} · {result.date}
        </span>
        {/* The run behind the report, shrunk to a chip. */}
        <Chip
          onClick={() => setShowRun((v) => !v)}
          aria-expanded={showRun}
          className={clsx("font-mono text-ui-xs", showRun && "border-border2 bg-surface4")}
        >
          <StepDots state={state} />
          <RunStats state={state} />
          <ChevronDown className={clsx("size-3 transition-transform", showRun && "rotate-180")} />
        </Chip>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" className="h-7 px-3 text-ui-sm" onClick={copy}>
            {copied ? <Check className="size-3.5 text-accent1" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy markdown"}
          </Button>
          <Button variant="ghost" className="h-7 px-3 text-ui-sm" onClick={download}>
            <Download className="size-3.5" /> .md
          </Button>
        </div>
      </div>
      {showRun && <RunDetails state={state} className="mt-3" />}
    </div>
  );
}

/** One dot per shown step, Studio's status colours. */
function StepDots({ state }: { state: RunState }) {
  return (
    <span className="flex gap-0.5">
      {visibleSteps(state).map((def) => (
        <span key={def.id} className={clsx("size-1.5 rounded-full", toneClass[statusTone(state.steps[def.id]?.status ?? "idle")].dot)} />
      ))}
    </span>
  );
}

/** "53s · 5 angles · 32 sources" */
function RunStats({ state }: { state: RunState }) {
  return (
    <span>
      <Elapsed state={state} bare />
      {state.angles && ` · ${state.angles.length} angles`}
      {state.result?.sources.length ? ` · ${state.result.sources.length} sources` : null}
    </span>
  );
}

/** Timeline, run id and the Studio link. */
function RunDetails({ state, className }: { state: RunState; className?: string }) {
  return (
    <div className={clsx("space-y-2", className)}>
      <StepTimeline state={state} />
      <div className="flex items-center gap-3 font-mono text-ui-xs text-neutral2">
        <span>run {state.runId}</span>
        <a href={`${MASTRA_URL}/workflows/${WORKFLOW_KEY}/graph/${state.runId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-neutral5">
          View in Studio <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
}

/** The run behind the report, folded away: timeline, timing, Studio link. */
function HowItWasMade({ state, open }: { state: RunState; open?: boolean }) {
  return (
    <details open={open} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-ui-md text-neutral3 hover:text-neutral6 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
        <span className="font-medium">How this was made</span>
        <span className="font-mono text-ui-sm text-neutral2">
          <RunStats state={state} />
        </span>
      </summary>
      <RunDetails state={state} className="mt-4" />
    </details>
  );
}

function Elapsed({ state, bare }: { state: RunState; bare?: boolean }) {
  const active = ACTIVE.has(state.status);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const steps = Object.values(state.steps);
  const start = Math.min(...steps.map((s) => s.startedAt ?? Infinity));
  if (!Number.isFinite(start)) return null;
  const end = active ? now : Math.max(...steps.map((s) => s.endedAt ?? 0));
  const text = formatDuration(Math.max(0, end - start));
  return bare ? <>{text}</> : <span className="font-mono text-ui-sm text-neutral3">{text}</span>;
}

/** Everything that finished without a report. */
function Outcome({ state }: { state: RunState }) {
  if (state.status === "failed" || state.status === "tripwire") {
    return <Alert tone="error" title="The run failed">{state.error ?? "No error message was recorded."}</Alert>;
  }
  if (state.status === "canceled") return <Alert tone="neutral" title="The run was canceled" />;
  if (state.result && state.result.status !== "ok") {
    return <Alert tone="warning" title={NO_REPORT[state.result.status].title}>{state.result.report}</Alert>;
  }
  return null;
}
