import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { MastraStorageExporter, Observability } from "@mastra/observability";
import { editorInChief } from "./agents/editor-in-chief";
import { planner } from "./agents/planner";
import { researcher } from "./agents/researcher";
import { newsEditor } from "./agents/news-editor";
import { reporter } from "./agents/reporter";
import { exaNewsTool } from "./tools/exa-news-tool";
import { readArticleTool } from "./tools/read-article-tool";
import { newsReport, newsroomDesk } from "./workflows/news-report-workflow";
import { citationFidelityScorer } from "./scorers/citation-fidelity";
import { researchRedundancyScorer } from "./scorers/research-redundancy";
import { coverageScorer } from "./scorers/coverage";
import { runSummariesRoute } from "./routes/run-summaries";
import { statusScorer } from "./scorers/status";
import { briefCorrectnessScorer } from "./scorers/brief-correctness";

export const mastra = new Mastra({
  agents: { editorInChief, planner, researcher, newsEditor, reporter },
  tools: { exaNewsTool, readArticleTool },
  workflows: { newsReport, newsroomDesk },
  // statusScorer and briefCorrectnessScorer need ground truth: registered for experiments, never attached to a step.
  scorers: { citationFidelityScorer, researchRedundancyScorer, coverageScorer, statusScorer, briefCorrectnessScorer },
  // One SQLite file for datasets, runs, scores and traces. DATABASE_URL is absolute so `npm run seed` and
  // `mastra dev` open the same file (dev resolves relative paths under src/mastra/public).
  storage: new LibSQLStore({ id: "libsql", url: process.env.DATABASE_URL ?? "file:./mastra.db" }),
  observability: new Observability({
    configs: { default: { serviceName: "mastra-newsroom", exporters: [new MastraStorageExporter()] } },
  }),
  server: { apiRoutes: [runSummariesRoute] },
});
