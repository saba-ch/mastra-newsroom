"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { CalendarDays, ChevronDown } from "lucide-react";
import { daysAgo, fromIso } from "@/lib/time";
import { Chip, inputClass } from "./ui";

// Desk date picker: a trigger that reads like a sentence ("Today · Wed, Sep 23"), quick picks for the
// days people actually use, and a calendar styled with Studio tokens. Value is "YYYY-MM-DD" in local time.

function relativeLabel(value: string): string | undefined {
  if (value === daysAgo(0).toLocaleDateString("en-CA")) return "Today";
  if (value === daysAgo(1).toLocaleDateString("en-CA")) return "Yesterday";
  return undefined;
}

const NAV_BUTTON =
  "inline-flex size-8 items-center justify-center rounded-full hover:bg-surface5 disabled:pointer-events-none disabled:opacity-30 aria-disabled:pointer-events-none aria-disabled:opacity-30";

const QUICK = [
  { label: "Today", days: 0 },
  { label: "Yesterday", days: 1 },
  { label: "2 days ago", days: 2 },
  { label: "A week ago", days: 7 },
];

export function DatePicker({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = value ? fromIso(value) : undefined;
  const rel = value ? relativeLabel(value) : undefined;
  const today = daysAgo(0);
  const pick = (d: Date) => {
    onChange(d.toLocaleDateString("en-CA"));
    setOpen(false);
  };

  return (
    <div ref={root} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={clsx(inputClass, "flex items-center gap-2 text-left", open && "border-neutral5/50")}
      >
        <CalendarDays className="size-4 shrink-0 text-neutral3" />
        {selected ? (
          <span className="min-w-0 flex-1 truncate">
            {rel && <span className="text-neutral6">{rel} · </span>}
            <span className={rel ? "text-neutral3" : "text-neutral6"}>
              {selected.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </span>
          </span>
        ) : (
          <span className="flex-1 text-neutral2">Pick a day</span>
        )}
        <ChevronDown className={clsx("size-3.5 shrink-0 text-neutral2 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose desk date"
          className="absolute right-0 z-20 mt-2 w-max rounded-xl border border-border2 bg-surface3 p-3 shadow-[0_1px_2px_-1px_rgb(0_0_0/.12),0_16px_40px_-20px_rgb(0_0_0/.5)]"
        >
          <div className="mb-3 flex flex-wrap gap-1.5 border-b border-border1 pb-3">
            {QUICK.map((q) => {
              const d = daysAgo(q.days);
              return (
                <Chip key={q.label} active={value === d.toLocaleDateString("en-CA")} onClick={() => pick(d)}>
                  {q.label}
                </Chip>
              );
            })}
          </div>
          <DayPicker
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => d && pick(d)}
            disabled={{ after: today }}
            endMonth={today}
            weekStartsOn={1}
            showOutsideDays
            classNames={{
              root: "text-ui-sm",
              months: "relative",
              month_caption: "flex h-8 items-center pl-2 text-ui-md font-medium text-neutral6",
              nav: "absolute right-0 top-0 z-10 flex gap-0.5",
              button_previous: NAV_BUTTON,
              button_next: NAV_BUTTON,
              chevron: "size-4 fill-neutral3",
              month_grid: "mt-1 w-full border-collapse",
              weekday: "size-9 text-ui-xs font-normal uppercase text-neutral2",
              day: "p-0 text-center",
              day_button:
                "size-9 rounded-full font-mono text-ui-sm text-neutral5 transition-colors hover:bg-surface5 hover:text-neutral6 disabled:cursor-not-allowed disabled:hover:bg-transparent",
              today: "[&>button]:font-bold [&>button]:text-accent1",
              selected: "[&>button]:!bg-neutral6 [&>button]:!text-surface1",
              outside: "[&>button]:text-neutral2/60",
              disabled: "[&>button]:!text-neutral1",
            }}
          />
        </div>
      )}
    </div>
  );
}
