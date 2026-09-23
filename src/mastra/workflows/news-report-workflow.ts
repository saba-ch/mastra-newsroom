import { createStep, createWorkflow } from "@mastra/core/workflows";
import { RequestContext } from "@mastra/core/request-context";
import type { MastraScorers } from "@mastra/core/evals";
import { z } from "zod";
import { angleSchema, deskSchema, inputSchema, lineupSchema, outputSchema, planSchema, researchSchema, type Article, type Output, type Plan } from "../types";
import { citationFidelityScorer } from "../scorers/citation-fidelity";
import { researchRedundancyScorer } from "../scorers/research-redundancy";
import { coverageScorer } from "../scorers/coverage";

const MAX_ANGLES = 5;
const RESEARCH_CONCURRENCY = MAX_ANGLES;
const RESEARCH_MAX_STEPS = 6;
const REPORTER_MAX_STEPS = 8;

// Researcher output lives in desk state: combine looks stories up by id, write puts it in Output.
const deskStateSchema = z.object({ research: z.array(researchSchema).default([]) });

// A typed const rather than an inline object: createStep's overloads fail to resolve otherwise. No sampling = every run.
const reportScorers: MastraScorers = {
  citationFidelity: { scorer: citationFidelityScorer },
  researchRedundancy: { scorer: researchRedundancyScorer },
  coverage: { scorer: coverageScorer },
};

// ---- plan: Input -> Plan ----------------------------------------------------

const plan = createStep({
  id: "plan",
  description: "Planner decides if the topic is a story and splits it into research angles.",
  inputSchema,
  outputSchema: planSchema,
  execute: async ({ inputData, mastra }) => {
    const date = inputData.date ?? new Date().toISOString().slice(0, 10);
    const response = await mastra.getAgent("planner").generate(`Desk date: ${date}.\nTopic: "${inputData.topic}".`, {
      structuredOutput: { schema: planSchema.pick({ isStory: true, reason: true, angles: true }) },
    });
    const { isStory, reason, angles } = response.object;
    return { topic: inputData.topic, date, isStory: isStory && angles.length > 0, reason, angles: angles.slice(0, MAX_ANGLES) };
  },
});

// ---- research: one per angle ------------------------------------------------

const research = createStep({
  id: "research",
  description: "Researcher searches the day's news for one angle and groups hits into stories.",
  inputSchema: planSchema.pick({ topic: true, date: true }).extend({ angle: angleSchema, angleIndex: z.number() }),
  outputSchema: researchSchema,
  execute: async ({ inputData: { topic, date, angle, angleIndex }, mastra }) => {
    const response = await mastra.getAgent("researcher").generate(
      [
        `Desk date: ${date}.`,
        `Topic: "${topic}".`,
        `Your angle: ${angle.question}`,
        `Suggested queries:\n${angle.queries.map((q) => `- ${q}`).join("\n")}`,
      ].join("\n\n"),
      {
        requestContext: new RequestContext([["date", date]]),
        maxSteps: RESEARCH_MAX_STEPS,
        structuredOutput: { schema: z.object({ stories: z.array(z.object({ headline: z.string(), articleIds: z.array(z.string()) })) }) },
      },
    );
    // Everything the tool returned during this run, keyed by id. The model only ever cites ids from here.
    const fetched = new Map<string, Article>();
    for (const chunk of response.toolResults) {
      const result = chunk.payload.result as { results?: Article[] } | undefined;
      for (const article of result?.results ?? []) fetched.set(article.id, article);
    }
    const stories = response.object.stories
      .map((story, n) => ({
        id: `a${angleIndex + 1}-s${n + 1}`,
        headline: story.headline,
        articles: story.articleIds.flatMap((id) => fetched.get(id) ?? []),
      }))
      .filter((story) => story.articles.length > 0);
    return { question: angle.question, stories };
  },
});

// ---- edit: Research[] -> Desk ----------------------------------------------

const edit = createStep({
  id: "edit",
  description: "News editor groups the researchers' stories by event and decides cover, brief or drop.",
  inputSchema: z.array(researchSchema),
  outputSchema: deskSchema,
  stateSchema: deskStateSchema,
  execute: async ({ inputData, mastra, getInitData, setState }) => {
    await setState({ research: inputData });
    const { topic, date } = getInitData<Plan>();
    const stories = inputData.flatMap((r) =>
      r.stories.map((story) => [
        `[${story.id}] ${story.headline}`,
        `  angle: ${r.question}`,
        `  outlets: ${[...new Set(story.articles.map((a) => a.outlet))].join(", ")}`,
        ...story.articles.slice(0, 2).map((a) => `  - ${a.title}: ${a.highlights[0] ?? ""}`),
      ].join("\n")),
    );
    if (stories.length === 0) return { groups: [] };
    const response = await mastra.getAgent("newsEditor").generate(
      `Desk date: ${date}. Topic: "${topic}".\n\nStories from the researchers:\n\n${stories.join("\n\n")}`,
      { structuredOutput: { schema: deskSchema } },
    );
    return response.object;
  },
});

// ---- combine (code): Desk -> Lineup -----------------------------------------

const combine = createStep({
  id: "combine",
  description: "Resolves the editor's groups to articles, dedupes, and orders the lineup.",
  inputSchema: deskSchema,
  outputSchema: lineupSchema,
  stateSchema: deskStateSchema,
  execute: async ({ inputData, state }) => {
    const byId = new Map(state.research.flatMap((r) => r.stories.map((s) => [s.id, s] as const)));
    // No groups at all means the editor did not do its job: run the researcher stories as they are.
    const lineup = inputData.groups.length > 0
      ? inputData.groups.flatMap(({ headline, decision, storyIds }) => {
          const found = storyIds.flatMap((id) => byId.get(id) ?? []);
          const articles = [...new Map(found.flatMap((s) => s.articles).map((a) => [a.id, a])).values()];
          return decision === "drop" || articles.length === 0 ? [] : [{ headline, decision, storyIds: found.map((s) => s.id), articles }];
        })
      : [...byId.values()].map((story) => ({
          headline: story.headline,
          decision: new Set(story.articles.map((a) => a.outlet)).size >= 2 ? ("cover" as const) : ("brief" as const),
          storyIds: [story.id],
          articles: story.articles,
        }));
    return lineup.sort((a, b) =>
      a.decision !== b.decision
        ? (a.decision === "cover" ? -1 : 1)
        : new Set(b.articles.map((x) => x.outlet)).size - new Set(a.articles.map((x) => x.outlet)).size,
    );
  },
});

// ---- write: Lineup -> Output -------------------------------------------------

const write = createStep({
  id: "write",
  description: "Reporter writes the report from the lineup, opening key articles in full. Scored here.",
  inputSchema: lineupSchema,
  outputSchema,
  stateSchema: deskStateSchema,
  scorers: reportScorers,
  execute: async ({ inputData: lineup, mastra, getInitData, state: { research } }): Promise<Output> => {
    const { topic, date } = getInitData<Plan>();
    if (lineup.length === 0) {
      return { topic, date, status: "no-coverage", report: `No on-topic coverage found on ${date} for "${topic}".`, sources: [], lineup, research };
    }
    const sources = [...new Map(lineup.flatMap((s) => s.articles).map((a) => [a.id, a])).values()];
    const number = new Map(sources.map((a, i) => [a.id, i + 1]));
    const prompt = lineup.map((story, i) => [
      `=== ${story.decision.toUpperCase()}${i === 0 ? " (LEAD)" : ""}: ${story.headline} — ${new Set(story.articles.map((a) => a.outlet)).size} outlet(s) ===`,
      ...story.articles.map((a) => `[${number.get(a.id)}] id=${a.id} | ${a.outlet} | ${a.title}\n    ${a.highlights.join(" … ")}`),
    ].join("\n")).join("\n\n");
    const response = await mastra.getAgent("reporter").generate(
      `Desk date: ${date}. Topic: "${topic}".\n\nLineup in running order:\n\n${prompt}`,
      {
        requestContext: new RequestContext([["articles", Object.fromEntries(sources.map((a) => [a.id, a]))]]),
        maxSteps: REPORTER_MAX_STEPS,
      },
    );
    // [n] -> [n](url); unknown n stays as-is for the citation scorer to catch. Sources list makes the markdown standalone.
    const body = response.text.replace(/\[(\d+)\](?!\()/g, (match, n) => (sources[Number(n) - 1] ? `[${n}](${sources[Number(n) - 1].url})` : match));
    const report = `${body}\n\n## Sources\n${sources.map((a, i) => `${i + 1}. [${a.title}](${a.url}) — ${a.outlet}`).join("\n")}`;
    return { topic, date, status: "ok", report, sources, lineup, research };
  },
});

// ---- the desk: Plan -> Output, one researcher per angle ---------------------

export const newsroomDesk = createWorkflow({
  id: "newsroom-desk",
  description: "Research every angle in parallel, edit into a lineup, write the report.",
  inputSchema: planSchema,
  outputSchema,
  stateSchema: deskStateSchema,
})
  .map(async ({ inputData: { topic, date, angles } }) => angles.map((angle, angleIndex) => ({ topic, date, angle, angleIndex })))
  .foreach(research, { concurrency: RESEARCH_CONCURRENCY })
  .then(edit)
  .then(combine)
  .then(write)
  .commit();

// ---- abstain: Plan -> Output (invalid topic) --------------------------------

const abstain = createStep({
  id: "abstain",
  description: "The planner said this is not a story; return without researching.",
  inputSchema: planSchema,
  outputSchema,
  execute: async ({ inputData: { topic, date, reason } }): Promise<Output> => ({
    topic, date, status: "invalid-topic", report: reason, sources: [], lineup: [], research: [],
  }),
});

// ---- merge: whichever branch ran (branch output is keyed by step id) --------

const merge = createStep({
  id: "merge",
  description: "Pass through whichever branch produced the report.",
  inputSchema: z.object({ [newsroomDesk.id]: outputSchema.optional(), [abstain.id]: outputSchema.optional() }),
  outputSchema,
  execute: async ({ inputData }) => outputSchema.parse(inputData[newsroomDesk.id] ?? inputData[abstain.id]),
});

export const newsReport = createWorkflow({
  id: "news-report",
  description: "Topic + date -> the day's sourced news report.",
  inputSchema,
  outputSchema,
})
  .then(plan)
  .branch(
    [
      [{ predicate: { op: "truthy", value: { path: "inputData.isStory" } } }, newsroomDesk],
      [{ predicate: { op: "falsy", value: { path: "inputData.isStory" } } }, abstain],
    ],
    { id: "is-it-a-story", description: "Research it, or abstain." },
  )
  .then(merge)
  .commit();
