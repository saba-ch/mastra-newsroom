import { createScorer } from "@mastra/core/evals";
import type { Output } from "../types";

const LINK = /\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g;
const DANGLING = /\[(\d+)\](?!\()/g;

// Share of citations in the report that point at a fetched source.
// A link whose url is not in `sources`, or a [n] the code could not resolve, is a hallucinated citation.
export const citationFidelityScorer = createScorer<unknown, Output>({
  id: "citation-fidelity",
  description: "1 minus the share of report citations that do not resolve to a fetched source.",
})
  .analyze(({ run }) => {
    const known = new Set(run.output.sources.map((s) => s.url));
    const cut = run.output.report.lastIndexOf("\n## Sources\n"); // the appended list is not a citation
    const body = cut === -1 ? run.output.report : run.output.report.slice(0, cut);
    const links = [...body.matchAll(LINK)].map((m) => m[1]);
    const dangling = [...body.matchAll(DANGLING)].map((m) => m[0]);
    return {
      total: links.length + dangling.length,
      bad: [...links.filter((url) => !known.has(url)), ...dangling],
    };
  })
  .generateScore(({ results }) => {
    const { total, bad } = results.analyzeStepResult;
    return total === 0 ? 1 : 1 - bad.length / total;
  })
  .generateReason(({ results, score }) => {
    const { total, bad } = results.analyzeStepResult;
    if (total === 0) return "No citations in the report.";
    return bad.length === 0
      ? `All ${total} citations resolve to fetched sources.`
      : `${bad.length} of ${total} citations do not resolve (score ${score.toFixed(2)}): ${bad.join(", ")}`;
  });
