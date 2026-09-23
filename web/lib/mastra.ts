import { MastraClient } from "@mastra/client-js";

export const MASTRA_URL = process.env.NEXT_PUBLIC_MASTRA_URL ?? "http://localhost:4111";

// Registration key on the Mastra instance; the server also accepts the id "news-report".
export const WORKFLOW_KEY = "newsReport";

export const newsReport = new MastraClient({ baseUrl: MASTRA_URL }).getWorkflow(WORKFLOW_KEY);
