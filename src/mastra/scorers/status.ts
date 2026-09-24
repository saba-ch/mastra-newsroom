import { createScorer } from "@mastra/core/evals";
import { z } from "zod";
import { outputSchema, type Output } from "../types";

const groundTruthSchema = z.object({ expectedStatus: outputSchema.shape.status });

// Did the run take the route the dataset item expects? Needs ground truth, so experiments only.
export const statusScorer = createScorer<unknown, Output>({
  id: "status",
  description: "1 if the run's status matches groundTruth.expectedStatus, else 0.",
})
  .generateScore(({ run }) => (run.output.status === groundTruthSchema.parse(run.groundTruth).expectedStatus ? 1 : 0))
  .generateReason(({ run, score }) => {
    const { expectedStatus } = groundTruthSchema.parse(run.groundTruth);
    return score === 1 ? `Status "${expectedStatus}" as expected.` : `Expected "${expectedStatus}", got "${run.output.status}".`;
  });
