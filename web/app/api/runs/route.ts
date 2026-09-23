import { NextResponse, type NextRequest } from "next/server";
import type { WorkflowRunState, WorkflowRunStatus } from "@mastra/core/workflows";
import { newsReport } from "@/lib/mastra";
import type { RunSummary } from "@/lib/run-summary";
import type { Input, Output, Plan } from "../../../../src/mastra/types";

// Mastra's list endpoint returns every run's full snapshot (megabytes once a few reports exist).
// The sidebar only needs a line per run, so slim it here instead of shipping snapshots to the browser.
// ?status=running narrows the list (Mastra filters in storage), which is what the sidebar polls.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") as WorkflowRunStatus | null;
  try {
    const { runs } = await newsReport.runs({ perPage: 50, status: status ?? undefined });
    const summaries: RunSummary[] = runs.map((run) => {
      const snapshot = (typeof run.snapshot === "string" ? JSON.parse(run.snapshot) : run.snapshot) as WorkflowRunState;
      const input = snapshot.context?.input as Input | undefined;
      const plan = (snapshot.context?.plan as { output?: Plan } | undefined)?.output;
      const result = snapshot.result as Output | undefined;
      return {
        runId: run.runId,
        createdAt: String(run.createdAt),
        status: snapshot.status,
        topic: input?.topic,
        date: input?.date ?? plan?.date,
        outcome: result?.status,
        headline: result?.status === "ok" ? result.report.match(/^#\s+(.+)$/m)?.[1].trim() : undefined,
      };
    });
    return NextResponse.json({ runs: summaries });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
