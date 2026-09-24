import { Mastra } from "@mastra/core";
import { MastraCompositeStore } from "@mastra/core/storage";
import { DuckDBStore } from "@mastra/duckdb";
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
import { isStory } from "./classifier/is-story";

export const mastra = new Mastra({
  agents: { editorInChief, planner, researcher, newsEditor, reporter },
  classifiers: { isStory },
  tools: { exaNewsTool, readArticleTool },
  workflows: { newsReport, newsroomDesk },
  // statusScorer and briefCorrectnessScorer need ground truth: registered for experiments, never attached to a step.
  scorers: { citationFidelityScorer, researchRedundancyScorer, coverageScorer, statusScorer, briefCorrectnessScorer },
  // SQLite for datasets, runs and scores; traces go to DuckDB because Studio's trace list uses advanced trace
  // queries, which LibSQL doesn't implement. Paths are relative to the process cwd: `mastra dev` runs the server
  // from src/mastra/public, so that is where the files live, and `npm run seed` runs from there too.
  storage: new MastraCompositeStore({
    id: "composite",
    default: new LibSQLStore({ id: "libsql", url: "file:./mastra.db" }),
    domains: { observability: new DuckDBStore({ path: "./mastra.duckdb" }).observability },
  }),
  observability: new Observability({
    configs: { default: { serviceName: "mastra-newsroom", exporters: [new MastraStorageExporter()] } },
  }),
  server: { apiRoutes: [runSummariesRoute] },
});
