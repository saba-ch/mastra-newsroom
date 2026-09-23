import { createScorer } from "@mastra/core/evals";
import type { Output } from "../types";

// Share of researched stories carried by 2+ outlets that made the lineup.
// Dropping an off-topic story is fine; dropping one that several outlets ran is a miss.
export const coverageScorer = createScorer<unknown, Output>({
  id: "coverage",
  description: "Share of multi-outlet researcher stories that appear in the lineup.",
})
  .analyze(({ run }) => {
    const inLineup = new Set(run.output.lineup.flatMap((story) => story.storyIds));
    const candidates = run.output.research
      .flatMap((r) => r.stories)
      .filter((story) => new Set(story.articles.map((a) => a.outlet)).size >= 2);
    return {
      candidates: candidates.length,
      missed: candidates.filter((story) => !inLineup.has(story.id)).map((story) => story.headline),
    };
  })
  .generateScore(({ results }) => {
    const { candidates, missed } = results.analyzeStepResult;
    return candidates === 0 ? 1 : 1 - missed.length / candidates;
  })
  .generateReason(({ results }) => {
    const { candidates, missed } = results.analyzeStepResult;
    if (candidates === 0) return "No researcher story had two or more outlets.";
    return missed.length === 0
      ? `All ${candidates} multi-outlet stories made the lineup.`
      : `${missed.length} of ${candidates} multi-outlet stories were dropped: ${missed.join("; ")}`;
  });
