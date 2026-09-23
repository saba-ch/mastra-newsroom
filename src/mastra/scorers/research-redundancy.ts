import { createScorer } from "@mastra/core/evals";
import type { Output } from "../types";

// Share of lineup stories that more than one researcher found.
// Story ids are 'a<angle>-s<n>', so the prefix says which angle a story came from.
// A high overlap means the planner's angles were not distinct.
export const researchRedundancyScorer = createScorer<unknown, Output>({
  id: "research-redundancy",
  description: "1 minus the share of lineup stories that were found by more than one angle.",
})
  .analyze(({ run }) => ({
    total: run.output.lineup.length,
    overlapping: run.output.lineup
      .filter((story) => new Set(story.storyIds.map((id) => id.split("-")[0])).size > 1)
      .map((story) => story.headline),
  }))
  .generateScore(({ results }) => {
    const { total, overlapping } = results.analyzeStepResult;
    return total === 0 ? 1 : 1 - overlapping.length / total;
  })
  .generateReason(({ results }) => {
    const { total, overlapping } = results.analyzeStepResult;
    if (overlapping.length === 0) return `No overlap across ${total} lineup stories.`;
    return `${overlapping.length} of ${total} stories were found by more than one angle: ${overlapping.join("; ")}`;
  });
