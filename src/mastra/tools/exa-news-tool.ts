import { createHash } from "node:crypto";
import { createTool } from "@mastra/core/tools";
import Exa from "exa-js";
import { z } from "zod";
import { articleSchema } from "../types";

const DEFAULT_RESULTS = 8;

export const exaNewsTool = createTool({
  id: "exa-news-tool",
  description:
    "Search news articles with Exa. By default it only returns articles published on the desk date set by the workflow. Pass startDate/endDate only to override that window.",
  inputSchema: z.object({
    query: z.string().describe("Plain-language search, no operators"),
    numResults: z.number().int().min(1).max(20).optional().describe(`Default ${DEFAULT_RESULTS}`),
    startDate: z.string().optional().describe("Override only, YYYY-MM-DD"),
    endDate: z.string().optional().describe("Override only, YYYY-MM-DD"),
  }),
  outputSchema: z.object({ results: z.array(articleSchema) }),
  requestContextSchema: z.object({ date: z.string().optional() }),
  execute: async ({ query, numResults, startDate, endDate }, context) => {
    const date = context.requestContext.get("date") ?? new Date().toISOString().slice(0, 10);
    const exa = new Exa(process.env.EXA_API_KEY);
    const { results } = await exa.search(query, {
      type: "auto",
      category: "news",
      numResults: numResults ?? DEFAULT_RESULTS,
      startPublishedDate: `${startDate ?? date}T00:00:00.000Z`,
      endPublishedDate: `${endDate ?? date}T23:59:59.999Z`,
      contents: { highlights: { maxCharacters: 1000 } },
    });
    return {
      results: results.map((r) => ({
        id: createHash("sha1").update(r.url).digest("hex").slice(0, 8),
        title: r.title ?? r.url,
        url: r.url,
        outlet: new URL(r.url).hostname.replace(/^www\./, ""),
        publishedDate: r.publishedDate,
        highlights: r.highlights ?? [],
      })),
    };
  },
});
