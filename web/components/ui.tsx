import clsx from "clsx";
import { CircleCheck, CircleDashed, CircleMinus, CirclePause, CircleX, LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

// Small primitives with Mastra Studio's class recipes (pill buttons, rounded-xl inputs, tinted alerts).

/** Studio's pill button. */
export function Button({ variant, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant: "primary" | "ghost" }) {
  return (
    <button
      className={clsx(
        "inline-flex h-8 items-center justify-center gap-2 rounded-full px-4 text-ui-smd font-medium transition-all duration-150 ease-out-custom disabled:opacity-50",
        variant === "primary" && "bg-neutral6 text-surface1 hover:bg-neutral6/90",
        variant === "ghost" && "text-neutral4 hover:bg-neutral6/5 hover:text-neutral6",
        className,
      )}
      {...props}
    />
  );
}

/** Small outlined pill: suggestions, quick picks, the run chip. `active` fills it. */
export function Chip({ active, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={clsx(
        "inline-flex h-6 items-center gap-2 rounded-full border px-2.5 text-ui-sm transition-colors",
        active ? "border-transparent bg-neutral6 text-surface1" : "border-border1 text-neutral3 hover:border-border2 hover:text-neutral6",
        className,
      )}
      {...props}
    />
  );
}

export const inputClass =
  "h-9 w-full rounded-xl border border-border1 bg-overlay-soft px-3 text-ui-md text-neutral5 outline-none transition-colors placeholder:text-neutral2 hover:border-border2 focus-visible:border-neutral5/50";

export function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return <label htmlFor={htmlFor} className="block pb-1.5 text-ui-sm text-neutral3">{children}</label>;
}

type Tone = "success" | "error" | "warning" | "info" | "neutral";

export const toneClass: Record<Tone, { text: string; bg: string; border: string; dot: string }> = {
  success: { text: "text-accent1", bg: "bg-accent1-dark/60", border: "border-accent1/40", dot: "bg-accent1" },
  error: { text: "text-accent2", bg: "bg-accent2-dark/60", border: "border-accent2/40", dot: "bg-accent2" },
  warning: { text: "text-accent6", bg: "bg-accent6-dark/60", border: "border-accent6/40", dot: "bg-accent6" },
  info: { text: "text-accent3", bg: "bg-accent3-dark/60", border: "border-accent3/40", dot: "bg-accent3" },
  neutral: { text: "text-neutral3", bg: "bg-surface4", border: "border-border2", dot: "bg-neutral1" },
};

export function Badge({ tone, children, pulse }: { tone: Tone; children: ReactNode; pulse?: boolean }) {
  const t = toneClass[tone];
  return (
    <span className={clsx("inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-ui-sm font-medium", t.bg, t.text)}>
      <span className={clsx("size-1.5 rounded-full bg-current", pulse && "animate-pulse")} />
      {children}
    </span>
  );
}

export function Alert({ tone, title, children }: { tone: Tone; title: string; children?: ReactNode }) {
  const t = toneClass[tone];
  return (
    <div className={clsx("rounded-lg border px-4 py-3", t.border, t.bg)}>
      <p className={clsx("text-ui-md font-medium", t.text)}>{title}</p>
      {children && <div className="mt-1 text-ui-md text-neutral4">{children}</div>}
    </div>
  );
}

/** A dot in a 16px box, so it lines up with the status icons. */
export function Dot({ className }: { className: string }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center">
      <span className={clsx("rounded-full", className)} />
    </span>
  );
}

/** Run or step status -> Studio's colour. */
export function statusTone(status: string): Tone {
  if (status === "success") return "success";
  if (status === "failed" || status === "tripwire") return "error";
  if (status === "running" || status === "pending" || status === "waiting") return "warning";
  if (status === "suspended" || status === "paused") return "info";
  return "neutral";
}

/** Studio's step status icons: spinner amber, check green, x red. */
export function StatusIcon({ status, className }: { status: string; className?: string }) {
  const cls = clsx("size-4 shrink-0", className);
  switch (status) {
    case "running":
    case "pending":
    case "waiting":
      return <LoaderCircle className={clsx(cls, "animate-spin text-accent6")} />;
    case "success":
      return <CircleCheck className={clsx(cls, "text-accent1")} />;
    case "failed":
    case "tripwire":
      return <CircleX className={clsx(cls, "text-accent2")} />;
    case "suspended":
    case "paused":
      return <CirclePause className={clsx(cls, "text-accent3")} />;
    case "canceled":
    case "skipped":
      return <CircleMinus className={clsx(cls, "text-neutral2")} />;
    default:
      return <CircleDashed className={clsx(cls, "text-neutral1")} />;
  }
}
