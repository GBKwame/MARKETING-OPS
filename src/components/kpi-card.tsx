import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

export function KpiCard({
  label,
  value,
  hint,
  to,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  to: string;
  icon: ReactNode;
  tone?: "default" | "primary" | "success" | "warning" | "purple" | "teal";
}) {
  const toneMap = {
    default: "bg-muted/80 text-foreground border-border/50",
    primary: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    success: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    teal: "bg-teal-500/10 text-teal-500 border-teal-500/20",
  } as const;

  return (
    <Link
      to={to}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-primary/40"
    >
      <div className="flex items-center justify-between">
        <div className={cn("grid h-10 w-10 place-items-center rounded-xl border transition-transform group-hover:scale-105", toneMap[tone])}>
          {icon}
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground/60 opacity-0 transition-all group-hover:opacity-100 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
      <div className="mt-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold tracking-tight text-foreground">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground/80 font-medium">{hint}</div>}
      </div>
    </Link>
  );
}