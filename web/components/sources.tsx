import { ArrowUpRight } from "lucide-react";
import type { Output } from "../../src/mastra/types";

// Numbered like the report's [n] citations (the workflow numbers sources in this order).
export function Sources({ sources }: { sources: Output["sources"] }) {
  if (sources.length === 0) return null;
  return (
    <div>
      <h2 className="mb-3 font-mono text-ui-xs uppercase tracking-wider text-neutral2">Sources · {sources.length}</h2>
      <ol className="grid gap-2 sm:grid-cols-2">
        {sources.map((source, i) => (
          <li key={source.id}>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="group flex h-full gap-3 rounded-lg border border-border1 bg-surface2 p-3 transition-colors hover:border-border2 hover:bg-surface3"
            >
              <span className="font-mono text-ui-sm text-neutral2">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-ui-md text-neutral5 group-hover:text-neutral6">{source.title}</span>
                <span className="mt-1 block truncate text-ui-sm text-neutral2">
                  {source.outlet}
                  {source.publishedDate && ` · ${source.publishedDate.slice(0, 10)}`}
                </span>
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-neutral2 group-hover:text-neutral5" />
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
