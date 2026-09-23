import { NewRunForm } from "@/components/new-run-form";

export default function Home() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="font-mono text-ui-xs uppercase tracking-wider text-neutral2">news-report workflow</p>
      <h1 className="mt-2 text-header-xl font-semibold tracking-tight">Daily News Reporter</h1>
      <p className="mt-2 text-ui-md text-neutral3">
        Pick a topic and a day. A planner splits it into angles, researchers search that day&rsquo;s news in parallel,
        an editor builds the lineup and a reporter writes a sourced report. About a minute and a half per run.
      </p>
      <NewRunForm />
    </div>
  );
}
