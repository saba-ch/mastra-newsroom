import clsx from "clsx";
import { Check } from "lucide-react";
import { ACTIVE, type RunState, type StepState } from "@/lib/run-state";
import { formatDuration } from "@/lib/time";
import { Dot, StatusIcon } from "./ui";

// The news-report graph as a list. Nested newsroom-desk steps stream with dotted ids.
// The map step between plan and research is plumbing and not shown.

interface StepDef {
  id: string;
  label: string;
  who: string;
  doing: string;
}

const PLAN: StepDef = { id: "plan", label: "Plan", who: "planner", doing: "Deciding whether this is a story and splitting it into research angles" };
const DESK: StepDef[] = [
  { id: "newsroom-desk.research", label: "Research", who: "researcher × angle", doing: "Searching the day’s news, one researcher per angle" },
  { id: "newsroom-desk.edit", label: "Edit", who: "news-editor", doing: "Grouping stories by event and deciding cover, brief or drop" },
  { id: "newsroom-desk.combine", label: "Combine", who: "code", doing: "Resolving the lineup and ordering it" },
  { id: "newsroom-desk.write", label: "Write", who: "reporter", doing: "Opening key articles and writing the report" },
];
const ABSTAIN: StepDef = { id: "abstain", label: "Abstain", who: "code", doing: "Not a story: skipping research" };
const MERGE: StepDef = { id: "merge", label: "Merge", who: "code", doing: "Finishing up" };

function duration(step: StepState): string | undefined {
  if (!step.startedAt || !step.endedAt) return undefined;
  return formatDuration(step.endedAt - step.startedAt);
}

export function visibleSteps(state: RunState): StepDef[] {
  return [PLAN, ...("abstain" in state.steps ? [ABSTAIN] : DESK), MERGE];
}

export function StepTimeline({ state }: { state: RunState }) {
  const defs = visibleSteps(state);
  const runActive = ACTIVE.has(state.status);

  return (
    <ol className="overflow-hidden rounded-xl border border-border1 bg-surface2">
      {defs.map((def, i) => {
        const step = state.steps[def.id] ?? { status: "idle" };
        // A step that never ran in a finished run was skipped by a failure upstream.
        const status = step.status === "idle" && !runActive ? "skipped" : step.status;
        const running = status === "running";
        const isResearch = def.id === "newsroom-desk.research";
        return (
          <li key={def.id} className={clsx("px-4 py-3", i > 0 && "border-t border-border1", running && "bg-overlay-soft")}>
            <div className="flex items-center gap-3">
              <StatusIcon status={status} />
              <span className={clsx("text-ui-md font-medium", status === "idle" || status === "skipped" ? "text-neutral2" : "text-neutral6")}>
                {def.label}
              </span>
              <span className="font-mono text-ui-xs text-neutral2">{def.who}</span>
              <span className="ml-auto font-mono text-ui-sm text-neutral3">
                {[isResearch && step.total ? `${step.done ?? 0}/${step.total} angles` : undefined, duration(step)].filter(Boolean).join(" · ")}
              </span>
            </div>
            {running && <p className="mt-1 pl-7 text-ui-sm text-accent6">{def.doing}…</p>}
            {isResearch && state.angles && status !== "idle" && status !== "skipped" && (
              <ul className="mt-2 space-y-1 pl-7">
                {state.angles.map((q, n) => {
                  const done = step.doneIndexes?.includes(n) || status === "success";
                  return (
                    <li key={n} className="flex items-start gap-2 text-ui-sm">
                      {done ? (
                        <Check className="mt-px size-4 shrink-0 p-px text-accent1" />
                      ) : (
                        <span className="mt-px"><Dot className="size-2 animate-pulse bg-accent6" /></span>
                      )}
                      <span className={done ? "text-neutral3" : "text-neutral4"}>{q}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
