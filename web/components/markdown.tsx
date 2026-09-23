import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children, size = "md" }: { children: string; size?: "md" | "lg" }) {
  return (
    <div
      className={clsx(
        "prose prose-mastra max-w-none prose-headings:tracking-tight prose-h1:font-semibold prose-a:underline-offset-2 prose-a:decoration-neutral1 hover:prose-a:decoration-neutral6",
        size === "md" && "text-ui-lg prose-h1:text-header-xl prose-h2:text-header-lg",
        // Reading view: the headline leads the page, body a notch above UI text.
        size === "lg" && "text-[1.0625rem] leading-[1.7] prose-h1:mb-3 prose-h1:text-[2.25rem] prose-h1:leading-[1.15] prose-h2:mt-10 prose-h2:text-[1.375rem]",
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, children, ...props }) =>
            // The workflow writes citations as [n](url): show them as small numbered chips matching the source cards.
            typeof children === "string" && /^\d+$/.test(children) ? (
              <a
                {...props}
                target="_blank"
                rel="noreferrer"
                className="mx-0.5 inline-flex h-4 min-w-4 -translate-y-px items-center justify-center rounded-sm bg-surface5 px-1 align-middle font-mono text-ui-xs font-normal text-neutral3 no-underline transition-colors hover:bg-surface6 hover:text-neutral6"
              >
                {children}
              </a>
            ) : (
              <a {...props} target="_blank" rel="noreferrer">{children}</a>
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
