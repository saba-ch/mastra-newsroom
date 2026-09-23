# mastra-newsroom

Daily News Reporter built on Mastra primitives. Give it a topic and a date and it returns that day's sourced report, produced by a small newsroom of agents inside one workflow. The brief is in [task.md](task.md).

## Run

```bash
npm install
cp .env.example .env    # OPENAI_API_KEY and EXA_API_KEY
npm run seed            # creates the "Daily topics" dataset, once
npm run dev             # Studio at http://localhost:4111, web UI at http://localhost:3000
```

`npm run dev:mastra` starts Studio alone; `npm run dev:web` starts only the web UI against an already running `mastra dev`.

`npm run seed` goes through the Mastra SDK (`mastra.datasets.create`). Set `DATABASE_URL` in `.env` to an absolute `file:` path so the script and `mastra dev` open the same SQLite file; `mastra dev` resolves a relative path under `src/mastra/public/`.

A story run takes 85-105 s and costs about $0.05-0.10 on `openai/gpt-6-luna`.

## Where to click in Studio

- **Agents → Editor-in-chief**: chat, e.g. "what's happening with AI regulation?". It runs the `news-report` workflow as a tool and relays the report. The other four agents can be chatted with directly too.
- **Workflows → news-report**: run with `{ "topic": "AI regulation" }` (optional `"date": "YYYY-MM-DD"`). Every step's input, output and state is inspectable, including inside the nested `newsroom-desk`.
- **Scorers**: the three scorers run live on the `write` step of every story run and show up here per run.
- **Datasets → Daily topics → Run experiment**: target the `newsReport` workflow, pick all three scorers. Five items took about 3 minutes.
- **Observability**: agent calls, tool calls and workflow spans for every run.

## Web UI

`web/` is a small Next.js app (npm workspace) on top of the same Mastra server, styled with Studio's own tokens and fonts. It has no database of its own: it talks to `mastra dev` through `@mastra/client-js`, so the runs it shows are the ones Studio shows.

- **Run history**: `getWorkflow("newsReport").runs()`. That endpoint returns every run's full snapshot, so `web/app/api/runs` slims it to one line per run on the server.
- **New run**: `createRun()`, then `run.stream({ inputData })`. Step events drive the timeline. Nested desk steps stream with dotted ids (`newsroom-desk.research`), and the research `foreach` emits per-angle progress.
- **Refresh mid-run**: the page reattaches with `run.observe()`, which replays the run's cached events and then continues live. Closing the tab does not stop the run. If the event cache is gone (server restarted), it falls back to polling `runById` every 3s, as Studio does.
- **Result**: `runById(runId, { fields: ["result", "error", "payload", "steps"] })`. Markdown is rendered with `react-markdown` + `remark-gfm`, and sources are shown as cards numbered like the `[n]` citations. Failed runs show the stored error; `invalid-topic` and `no-coverage` show the planner's or workflow's message.

Set `NEXT_PUBLIC_MASTRA_URL` in `web/.env` if Mastra is not on `http://localhost:4111`.

## Who does what

| Step | Role | What it does |
|---|---|---|
| (chat) | editor-in-chief (agent, `workflows: { newsReport }`) | Turns a question into a 2-4 word topic, runs the workflow, relays the report verbatim or explains an abstain. |
| `plan` | planner (agent) | Is this a story a newsroom could report on that day? Splits it into 1-5 research angles, only where the topic has genuinely distinct threads. |
| `research` | researcher (agent + `exa-news-tool`) | One per angle, `foreach` with all angles in parallel. Searches the day's news, judges relevance from titles and highlights, groups hits into stories. Returns article ids only. |
| `edit` | news-editor (agent) | Sees a flat story list (id, headline, angle, outlets, two highlights). Merges the same event found by different angles; decides cover / brief / drop. |
| `combine` | code | Resolves groups to articles, dedupes by id, orders covers by distinct outlets, then briefs. If the editor returns no groups, researcher stories pass through (2+ outlets = cover). |
| `write` | reporter (agent + `read-article`) | Opens up to six articles in full by id. One paragraph per cover, one bullet per brief, cites `[n]`. Code turns `[n]` into `[n](url)` and appends a Sources list. Empty lineup returns `no-coverage` without a model call. |
| `abstain` | code | Planner said it is not a story. Returns `invalid-topic` with the planner's reason. |
| `merge` | code | Passes through whichever arm ran. |

All five agents use `openai/gpt-6-luna` (`src/mastra/model.ts`).

## Graph

```
news-report
  plan
   └─ branch "is-it-a-story"
        ├─ isStory truthy ─> newsroom-desk (nested workflow)
        │                      map (angles -> items)
        │                      foreach research   (all angles in parallel)
        │                      edit                (setState: research)
        │                      combine             (reads state)
        │                      write               (reads state, scorers attached)
        └─ isStory falsy ──> abstain
  merge  (keyed by arm id, outputSchema.parse)
```

## Output

Every route returns the same shape (`outputSchema` in `src/mastra/types.ts`):

```ts
{ topic, date, status: 'ok' | 'invalid-topic' | 'no-coverage', report, sources, lineup, research }
```

`report` is standalone markdown in daily-brief form (rules drawn from Axios Smart Brevity, Semafor Flagship and The Economist Espresso): a headline, a bold dateline built by code (`Nvidia desk · Wednesday, September 23, 2026`), a "Today in one line" summary, then one numbered `##` section per covered story with a bold opening fact and up to three fixed labels (Why it matters, By the numbers, What's next). Briefs follow as labelled bullets under "In brief", then "What to watch" and `## Sources`. Story 1 gets 80-120 words, the rest 50-80, the whole brief under 700. Citations are `[n](url)` links into the Sources list. `lineup` and `research` are the story data the scorers read.

## Scorers

Three code scorers, typed `createScorer<unknown, Output>`. They read only the workflow Output, so the same scorer runs live on `write` and on the final result in experiments. All are registered on the Mastra instance so experiments can pick them by id.

| Scorer | Reads | Score | Baseline |
|---|---|---|---|
| `citation-fidelity` | `report`, `sources` | 1 minus the share of citations in the body (links and unresolved `[n]`) that do not point at a fetched source. | 1.0 on every run |
| `research-redundancy` | `lineup[].storyIds` | 1 minus the share of lineup stories found by more than one angle. Story ids are `a<angle>-s<n>`, so the prefix gives the angle. Judges the planner's split. | 0.6-0.89 on real topics |
| `coverage` | `research`, `lineup` | Share of researcher stories with 2+ outlets that made the lineup. Dropping a multi-outlet story is a miss. | 0.91-1.0 |

## Dataset

"Daily topics" (`id: daily-topics`, `targetType: workflow`, `targetIds: ["newsReport"]`), 20 items: 14 real beats (broad ones like AI regulation and narrow ones like SpaceX, expected `ok`), 3 real subjects with no news that day (`no-coverage`), 3 non-subjects (`invalid-topic`). `groundTruth.expectedStatus` documents the expected route; no scorer reads it yet.

## Design notes

- **Root zod types.** `src/mastra/types.ts` holds the schemas. Steps, tools, structured output and scorers derive from them.
- **Ids, not urls.** Articles get an 8-character id from a sha1 of the url. Researchers pick by id, the reporter cites by number and opens by id, and code maps back to urls. Models were seen "completing" long urls in an earlier build.
- **The day is owned by the workflow.** Steps put the date in request context; `exa-news-tool` declares `requestContextSchema` and reads it. The tool also takes optional `startDate` / `endDate`, so a look-back window can be A/B tested as an experiment. `read-article` gets the lineup's article map the same way.
- **Branch, not `bail()`,** so both routes are visible in the Studio graph and each has a schema. Declarative predicates (`{ op: 'truthy', value: { path: 'inputData.isStory' } }`) show as readable conditions. `merge` is keyed by arm id, the idiom from Mastra's KYC template.
- **Workflow state** (`stateSchema`) carries the researchers' output from `edit` to `combine` and `write`, instead of re-reading a foreach result with a cast.
- **Caps in prompt plus code, not zod `.max()`.** A hard schema cap fails the whole step when a model over-picks by one. Angles are sliced to 5 in code; research and reporter runs have `maxSteps`.
- **No counters in data shapes.** Scorers derive what they need from Output.
- **Scorers on `write`, not `merge`.** Abstain routes would produce meaningless 1.0 rows.
- **Experiments target the workflow.** Mastra's examples target agents; here the report is the pipeline's output, so the workflow is what gets graded.

## Known limitations

- The date defaults to today in UTC. Early in the UTC day there is little news yet.
- Relevance and grouping are model judgement from titles and highlights. The "no-coverage" dataset item can turn `ok` if Exa returns something loosely related.
- Citation fidelity checks that a link points at a fetched source, not that the source supports the sentence.
- Research redundancy is still 0.6-0.89 on broad topics: the planner's angles overlap.
- The seed script creates a fixed dataset id; run it once per database.
- `groundTruth.expectedStatus` is documentation only.

## Roadmap

1. Tune the planner's catch-all angle, measured with `research-redundancy` as the first experiment.
2. A dateless look-back tool for the editor, so a thin day can be framed against last week.
3. Multi-day memory so tomorrow's report does not repeat today's stories.
4. An LLM judge scorer for "each claim is supported by the cited article".
5. Measure the effect of the 1000-character highlight cap and full research concurrency against the 5-item baseline.
