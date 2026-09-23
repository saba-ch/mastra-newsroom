"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { newsReport } from "@/lib/mastra";
import { PENDING_INPUT_PREFIX } from "@/lib/pending-input";
import { DatePicker } from "./date-picker";
import { useRuns } from "./runs-context";
import { Alert, Button, Chip, Label, inputClass } from "./ui";

const SUGGESTIONS = ["AI regulation", "climate tech", "SpaceX", "Federal Reserve"];


export function NewRunForm() {
  const router = useRouter();
  const { refresh } = useRuns();
  const [topic, setTopic] = useState("");
  const [date, setDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  // Set after mount: the server doesn't know the viewer's timezone.
  useEffect(() => {
    setDate(new Date().toLocaleDateString("en-CA")); // YYYY-MM-DD in the viewer's zone
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setSubmitting(true);
    setError(undefined);
    try {
      // Create the run here, start it on the run page so that page owns the stream.
      const run = await newsReport.createRun();
      sessionStorage.setItem(PENDING_INPUT_PREFIX + run.runId, JSON.stringify({ topic: topic.trim(), date: date || undefined }));
      refresh();
      router.push(`/runs/${run.runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5 rounded-xl border border-border1 bg-surface2 p-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <div>
          <Label htmlFor="topic">Topic</Label>
          <input
            id="topic"
            className={inputClass}
            placeholder="e.g. AI regulation"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div>
          <Label htmlFor="date">Desk date</Label>
          <DatePicker id="date" value={date} onChange={setDate} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-ui-sm text-neutral2">Try</span>
        {SUGGESTIONS.map((s) => (
          <Chip key={s} onClick={() => setTopic(s)}>
            {s}
          </Chip>
        ))}
      </div>

      {error && <Alert tone="error" title="Couldn’t start the run">{error}</Alert>}

      <div className="flex items-center justify-between border-t border-border1 pt-4">
        <p className="text-ui-sm text-neutral2">Only news from the chosen day is reported.</p>
        <Button type="submit" variant="primary" disabled={submitting || !topic.trim()}>
          {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          Run report
        </Button>
      </div>
    </form>
  );
}
