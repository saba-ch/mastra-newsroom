import type { GetWorkflowRunByIdResponse, StreamVNextChunkType } from "@mastra/client-js";
import type { WorkflowRunStatus } from "@mastra/core/workflows";
import type { Input, Output, Plan } from "../../src/mastra/types";

// One view model for a run, built either from live stream chunks or from the stored run.
// Everything is keyed by step id, so replayed chunks (observe() re-sends history) are harmless.

/** Studio polls at this interval too. */
export const POLL_MS = 3000;

export const ACTIVE = new Set<string>(["pending", "running", "waiting", "paused"]);

/** Successful runs that produced no report. */
export const NO_REPORT: Record<Exclude<Output["status"], "ok">, { label: string; title: string }> = {
  "invalid-topic": { label: "not a story", title: "Not a story" },
  "no-coverage": { label: "no coverage", title: "No coverage that day" },
};

export interface StepState {
  status: string;
  startedAt?: number;
  endedAt?: number;
  /** foreach progress (research angles) */
  done?: number;
  total?: number;
  doneIndexes?: number[];
}

export interface RunState {
  runId: string;
  status: WorkflowRunStatus;
  input?: Input;
  steps: Record<string, StepState>;
  /** Angle questions from the planner, once plan has finished. */
  angles?: string[];
  result?: Output;
  error?: string;
}

function errorMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error) return String(error.message);
  return JSON.stringify(error);
}

export function applyChunk(state: RunState, chunk: StreamVNextChunkType): RunState {
  const p = chunk.payload ?? {};
  const prev: StepState = state.steps[p.id] ?? { status: "idle" };
  switch (chunk.type) {
    case "workflow-start":
      return { ...state, status: "running" };
    case "workflow-step-start":
      return {
        ...state,
        status: "running",
        steps: { ...state.steps, [p.id]: { ...prev, status: "running", startedAt: p.startedAt ?? prev.startedAt } },
      };
    case "workflow-step-progress": {
      const doneIndexes = p.iterationStatus === "success"
        ? [...new Set([...(prev.doneIndexes ?? []), p.currentIndex])]
        : prev.doneIndexes;
      return {
        ...state,
        steps: { ...state.steps, [p.id]: { ...prev, done: p.completedCount, total: p.totalCount, doneIndexes } },
      };
    }
    case "workflow-step-result": {
      const angles = p.id === "plan" && p.status === "success"
        ? (p.output as Plan).angles.map((a) => a.question)
        : state.angles;
      return {
        ...state,
        angles,
        steps: { ...state.steps, [p.id]: { ...prev, status: p.status, endedAt: p.endedAt ?? prev.endedAt } },
      };
    }
    case "workflow-finish":
      return {
        ...state,
        status: p.workflowStatus,
        result: p.workflowStatus === "success" ? p.finalWorkflowResult : state.result,
        error: state.error ?? errorMessage(p.error),
      };
    case "workflow-canceled":
      return { ...state, status: "canceled" };
    default:
      return state;
  }
}

export function fromStoredRun(run: GetWorkflowRunByIdResponse): RunState {
  const stored = (run.steps ?? {}) as Record<string, { status: string; startedAt?: number; endedAt?: number; output?: unknown; error?: unknown }>;
  const plan = stored.plan?.status === "success" ? (stored.plan.output as Plan) : undefined;
  const steps: Record<string, StepState> = {};
  for (const [id, step] of Object.entries(stored)) {
    steps[id] = { status: step.status, startedAt: step.startedAt, endedAt: step.endedAt };
  }
  const research = steps["newsroom-desk.research"];
  if (research?.status === "success" && plan) {
    research.done = research.total = plan.angles.length;
    research.doneIndexes = plan.angles.map((_, i) => i);
  }
  // The run-level error is set on failure; fall back to the first failed step's error.
  const stepError = Object.values(stored).find((s) => s.status === "failed" && s.error)?.error;
  const input = run.payload as Input | undefined;
  return {
    runId: run.runId,
    status: run.status,
    // The planner fills in today's date when the input had none.
    input: input && { ...input, date: input.date ?? plan?.date },
    steps,
    angles: plan?.angles.map((a) => a.question),
    result: run.status === "success" ? (run.result as Output) : undefined,
    error: errorMessage(run.error) ?? errorMessage(stepError),
  };
}
