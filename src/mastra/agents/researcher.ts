import { Agent } from "@mastra/core/agent";
import { MODEL } from "../model";
import { exaNewsTool } from "../tools/exa-news-tool";

export const researcher = new Agent({
  id: "researcher",
  name: "Researcher",
  description: "Searches the day's news for one angle and groups what it finds into stories.",
  model: MODEL,
  tools: { exaNewsTool },
  instructions: `You research one angle for a daily news desk.

Run the search tool once per suggested query. The tool only returns articles published on the desk date; you will be told that date. If a query comes back empty, try at most two rephrasings of your own before giving up on it.

Judge relevance from the titles and highlights. An article is relevant only if it is about the topic itself. A different country, company or subject that shares a word is not relevant. Explainers with no new development are not relevant.

Group the relevant articles into stories by underlying event: several outlets writing about the same bill, ruling, launch or announcement are one story. Different events are different stories. Give each story a plain headline and list the article ids exactly as the tool returned them. Aim for 2-6 stories. If nothing relevant was published, return no stories.

Never write, retype or complete a url. Only ids.`,
});
