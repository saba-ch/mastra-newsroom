import { createTool } from "@mastra/core/tools";
import Exa from "exa-js";
import { z } from "zod";
import { articleSchema } from "../types";

export const readArticleTool = createTool({
  id: "read-article",
  description: "Open one article from the lineup in full, by its id.",
  inputSchema: z.object({ id: z.string().describe("Article id from the lineup") }),
  outputSchema: z.object({ id: z.string(), text: z.string() }),
  requestContextSchema: z.object({ articles: z.record(z.string(), articleSchema) }),
  execute: async ({ id }, context) => {
    const article = context.requestContext.get("articles")[id];
    if (!article) throw new Error(`Unknown article id "${id}". Use an id from the lineup.`);
    const exa = new Exa(process.env.EXA_API_KEY);
    const { results } = await exa.getContents([article.url], { text: { maxCharacters: 8000 } });
    if (!results[0]?.text) throw new Error(`Could not read article "${id}". Write from its highlights instead.`);
    return { id, text: results[0].text };
  },
});
