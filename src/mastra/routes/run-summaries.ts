import { registerApiRoute } from "@mastra/core/server";
import type { WorkflowRunState, WorkflowRunStatus } from "@mastra/core/workflows";
import type { Input, Output, Plan } from "../types";

// Mastra's run list returns every run's full snapshot (megabytes once a few reports exist).
// The web sidebar only needs a line per run, so slim it here instead of shipping snapshots to the browser.
// ?status=running narrows the list (Mastra filters in storage), which is what the sidebar polls.

export interface RunSummary {
  runId: string;
  createdAt: string;
  status: WorkflowRunStatus;
  topic?: string;
  date?: string;
  outcome?: Output["status"];
  /** First "# " line of the report, for ok runs */
  headline?: string;
}

export const runSummariesRoute = registerApiRoute("/newsroom/runs", {
  method: "GET",
  handler: async (c) => {
    const status = c.req.query("status") as WorkflowRunStatus | undefined;
    const { runs } = await c.get("mastra").getWorkflow("newsReport").listWorkflowRuns({ perPage: 50, status });
    const summaries: RunSummary[] = runs.map((run) => {
      const snapshot = (typeof run.snapshot === "string" ? JSON.parse(run.snapshot) : run.snapshot) as WorkflowRunState;
      const input = snapshot.context?.input as Input | undefined;
      const plan = (snapshot.context?.plan as { output?: Plan } | undefined)?.output;
      const result = snapshot.result as Output | undefined;
      return {
        runId: run.runId,
        createdAt: new Date(run.createdAt).toISOString(),
        status: snapshot.status,
        topic: input?.topic,
        date: input?.date ?? plan?.date,
        outcome: result?.status,
        headline: result?.status === "ok" ? result.report.match(/^#\s+(.+)$/m)?.[1].trim() : undefined,
      };
    });
    return c.json({ runs: summaries });
  },
});
