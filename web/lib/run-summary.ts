import type { WorkflowRunStatus } from "@mastra/core/workflows";
import type { Output } from "../../src/mastra/types";

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
