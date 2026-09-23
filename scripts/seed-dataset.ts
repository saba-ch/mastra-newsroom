import { mastra } from "../src/mastra";
import type { Input, Output } from "../src/mastra/types";

// Stop `npm run dev` first: both processes open the same database files.
const items: { input: Input; groundTruth: { expectedStatus: Output["status"] } }[] = [
  // Broad, busy beats: several angles, many outlets.
  { input: { topic: "AI regulation" }, groundTruth: { expectedStatus: "ok" } },
  { input: { topic: "climate tech" }, groundTruth: { expectedStatus: "ok" } },
  { input: { topic: "Federal Reserve" }, groundTruth: { expectedStatus: "ok" } },
  { input: { topic: "Ukraine war" }, groundTruth: { expectedStatus: "ok" } },
  { input: { topic: "UK politics" }, groundTruth: { expectedStatus: "ok" } },
  { input: { topic: "electric vehicles" }, groundTruth: { expectedStatus: "ok" } },
  { input: { topic: "Bitcoin" }, groundTruth: { expectedStatus: "ok" } },
  { input: { topic: "US Supreme Court" }, groundTruth: { expectedStatus: "ok" } },
  // Narrow beats: one company, one competition, one disease. Should get one or two angles.
  { input: { topic: "OpenAI" }, groundTruth: { expectedStatus: "ok" } },
  { input: { topic: "SpaceX" }, groundTruth: { expectedStatus: "ok" } },
  { input: { topic: "Nvidia" }, groundTruth: { expectedStatus: "ok" } },
  { input: { topic: "Premier League" }, groundTruth: { expectedStatus: "ok" } },
  { input: { topic: "bird flu" }, groundTruth: { expectedStatus: "ok" } },
  { input: { topic: "Taylor Swift" }, groundTruth: { expectedStatus: "ok" } },
  // Real subjects with no news on a given day: the desk should say so, not pad.
  { input: { topic: "Tuvalu library budget" }, groundTruth: { expectedStatus: "no-coverage" } },
  { input: { topic: "Faroe Islands ferry timetable" }, groundTruth: { expectedStatus: "no-coverage" } },
  { input: { topic: "Antarctic postal service" }, groundTruth: { expectedStatus: "no-coverage" } },
  // Not a news subject at all: the planner should abstain before any search.
  { input: { topic: "asdf qwer zxcv" }, groundTruth: { expectedStatus: "invalid-topic" } },
  { input: { topic: "my neighbour's dog" }, groundTruth: { expectedStatus: "invalid-topic" } },
  { input: { topic: "lorem ipsum dolor sit amet" }, groundTruth: { expectedStatus: "invalid-topic" } },
];

const dataset = await mastra.datasets.create({
  id: "daily-topics",
  name: "Daily topics",
  description: "Topics for the news-report workflow. expectedStatus documents which route each topic should take.",
  targetType: "workflow",
  targetIds: ["newsReport"],
});
await dataset.addItems({ items });
console.log(`Dataset "${dataset.id}" seeded with ${items.length} items.`);
