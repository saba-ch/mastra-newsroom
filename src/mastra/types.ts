import { z } from "zod";

// Root contract. Every step, tool, agent prompt and scorer derives from these.

export const inputSchema = z.object({
  topic: z.string().min(1).describe("What to report on, e.g. 'AI regulation'"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
    .optional()
    .describe("Desk date (YYYY-MM-DD). Defaults to today. Only that day is reported."),
});

export const angleSchema = z.object({
  question: z.string().describe("The question this angle answers"),
  queries: z.array(z.string()).describe("1-3 plain-language searches, no operators"),
});

export const planSchema = z.object({
  topic: z.string(),
  date: z.string(),
  isStory: z.boolean(),
  reason: z.string(),
  angles: z.array(angleSchema),
});

export const articleSchema = z.object({
  id: z.string().describe("Stable id. Cite and open articles by id, never by url."),
  title: z.string(),
  url: z.string(),
  outlet: z.string().describe("Hostname without www"),
  publishedDate: z.string().optional(),
  highlights: z.array(z.string()),
});

export const storySchema = z.object({
  id: z.string().describe("'a<angle>-s<n>', assigned by code"),
  headline: z.string(),
  articles: z.array(articleSchema),
});

export const researchSchema = z.object({
  question: z.string(),
  stories: z.array(storySchema),
});

export const decisionSchema = z.enum(["cover", "brief"]);

export const deskSchema = z.object({
  groups: z.array(
    z.object({
      storyIds: z.array(z.string()).describe("Researcher story ids, exactly as given"),
      headline: z.string(),
      decision: decisionSchema.or(z.literal("drop")),
    }),
  ),
});

export const lineupStorySchema = z.object({
  headline: z.string(),
  decision: decisionSchema,
  storyIds: z.array(z.string()),
  articles: z.array(articleSchema),
});

export const lineupSchema = z.array(lineupStorySchema);

export const outputSchema = z.object({
  topic: z.string(),
  date: z.string(),
  status: z.enum(["ok", "invalid-topic", "no-coverage"]),
  report: z.string().describe("Markdown with [Title](url) links"),
  sources: z.array(articleSchema),
  lineup: lineupSchema,
  research: z.array(researchSchema),
});

export type Input = z.infer<typeof inputSchema>;
export type Plan = z.infer<typeof planSchema>;
export type Article = z.infer<typeof articleSchema>;
export type Research = z.infer<typeof researchSchema>;
export type Output = z.infer<typeof outputSchema>;

