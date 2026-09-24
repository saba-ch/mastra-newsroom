import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Input, Output } from "../src/mastra/types";

// `mastra dev` runs the server from src/mastra/public, so its `file:./mastra.db` lives there. Run from the same
// place so Studio sees what this script writes. Stop `npm run dev` first: both open the same database files.
const publicDir = fileURLToPath(new URL("../src/mastra/public/", import.meta.url));
mkdirSync(publicDir, { recursive: true });
process.chdir(publicDir);
const { mastra } = await import("../src/mastra");

// One dataset per question under test. Every item in a dataset has the same ground-truth shape,
// so every scorer attached to the dataset applies to every item.

// Does the planner route a topic correctly? Junk topics stop at the planner, so this one is cheap.
// Every item is dated so a rerun searches the same day's news.
const routing: { input: Input; groundTruth: { expectedStatus: Output["status"] } }[] = [
  // Real, busy beats: should report.
  { input: { topic: "AI regulation", date: "2026-09-10" }, groundTruth: { expectedStatus: "ok" } },
  { input: { topic: "Nvidia", date: "2026-09-17" }, groundTruth: { expectedStatus: "ok" } },
  // Real subjects with no news on the day (Exa returns only off-topic hits): the desk should say so, not pad.
  { input: { topic: "Tuvalu library budget", date: "2026-09-08" }, groundTruth: { expectedStatus: "no-coverage" } },
  { input: { topic: "Faroe Islands ferry timetable", date: "2026-09-14" }, groundTruth: { expectedStatus: "no-coverage" } },
  { input: { topic: "Antarctic postal service", date: "2026-09-21" }, groundTruth: { expectedStatus: "no-coverage" } },
  // Not a news subject at all: the planner should abstain before any search.
  { input: { topic: "asdf qwer zxcv", date: "2026-09-02" }, groundTruth: { expectedStatus: "invalid-topic" } },
  { input: { topic: "my neighbour's dog", date: "2026-09-11" }, groundTruth: { expectedStatus: "invalid-topic" } },
  { input: { topic: "lorem ipsum dolor sit amet", date: "2026-09-18" }, groundTruth: { expectedStatus: "invalid-topic" } },
];

// On a day with a known big story, does the brief carry it? Topics are deliberately broad:
// the desk has to find the story, not be handed its name.
// Dates are the UTC day most coverage is published: a US afternoon or evening launch lands on the next day.
const launchDays: { input: Input; groundTruth: { must: string[]; mustNot: string[] } }[] = [
  {
    // Apple event, 10am PT. Morning pieces the same day still say "expected to unveil".
    input: { topic: "phone", date: "2026-09-09" },
    groundTruth: {
      must: ["Leads with Apple unveiling the iPhone Duo, its first foldable iPhone"],
      mustNot: ["Describes the iPhone Duo as rumoured or not yet announced"],
    },
  },
  {
    // TypeSafe announced Sep 15 US time; the press wave is dated Sep 16 UTC. Competes with Gemini 3.8 Live and Salesforce Koa.
    input: { topic: "new AI models", date: "2026-09-16" },
    groundTruth: {
      must: ["Covers TypeSafe AI's launch of Jev, a model that returns typed decisions instead of text"],
      mustNot: [],
    },
  },
  {
    // Meta Connect keynote, 4pm PT Sep 23 = 23:00 UTC. Sep 23 is almost all meta.com posts; press lands on the 24th.
    input: { topic: "smart glasses", date: "2026-09-24" },
    groundTruth: {
      must: ["Leads with Meta's Connect 2026 announcements, such as the camera-free Ray-Ban Meta Audio glasses or the $1,299 Meta VR Glasses"],
      mustNot: ["Describes the Connect announcements as upcoming or expected"],
    },
  },
  {
    input: { topic: "new AI models", date: "2026-09-03" },
    groundTruth: {
      must: ["Leads with OpenAI's launch of GPT-6 Astra"],
      mustNot: [],
    },
  },
  {
    input: { topic: "Android", date: "2026-09-01" },
    groundTruth: {
      must: ["Covers Google's September Android Drop, such as Find Hub remembering where items are or on-screen motion-sickness cues"],
      mustNot: [],
    },
  },
];

const datasets = [
  {
    id: "routing",
    name: "Routing",
    description: "Does the planner send each topic down the right route? groundTruth.expectedStatus.",
    scorerIds: ["status"],
    items: routing,
  },
  {
    id: "launch-days",
    name: "Launch days",
    description: "Broad topics on days with a known big launch. groundTruth.must / mustNot say what the brief has to carry.",
    scorerIds: ["brief-correctness", "citation-fidelity", "coverage", "research-redundancy"],
    items: launchDays,
  },
];

for (const { items, ...config } of datasets) {
  await mastra.datasets.delete({ id: config.id }); // reseeding replaces the dataset and its past experiments
  const dataset = await mastra.datasets.create({ ...config, targetType: "workflow", targetIds: ["newsReport"] });
  await dataset.addItems({ items });
  console.log(`Dataset "${dataset.id}" seeded with ${items.length} items, scorers: ${config.scorerIds.join(", ")}.`);
}
