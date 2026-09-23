import { RunView } from "@/components/run-view";

export default async function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  // key: a fresh RunView (and stream) per run when navigating between runs.
  return <RunView key={runId} runId={runId} />;
}
