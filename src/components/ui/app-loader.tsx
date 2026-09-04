import React from "react";
import { Sparkles, Activity, ShieldCheck, Zap } from "lucide-react";
import { useTheme } from "@/lib/theme";

interface AppLoaderProps {
  text?: string;
  subtext?: string;
  fullScreen?: boolean;
  size?: "sm" | "md" | "lg";
}

export function AppLoader({
  text = "Loading Zexpand Workspace...",
  subtext = "Syncing performance analytics, channels & team data",
  fullScreen = true,
  size = "md",
}: AppLoaderProps) {
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? "/logo-dark.png" : "/logo-light.png";

  const sizeClasses = {
    sm: "h-12 w-12",
    md: "h-20 w-20",
    lg: "h-28 w-28",
  }[size];

  const ringSizes = {
    sm: "h-16 w-16",
    md: "h-28 w-28",
    lg: "h-36 w-36",
  }[size];

  const content = (
    <div className="relative flex flex-col items-center justify-center p-6 text-center select-none">
      {/* Outer Radiating Pulse Waves */}
      <div className="relative flex items-center justify-center">
        <span className={`absolute ${ringSizes} rounded-full bg-primary/20 animate-ping duration-1000 opacity-75`} />
        <span className={`absolute ${ringSizes} rounded-full bg-indigo-500/10 animate-pulse duration-700`} />

        {/* Counter-Rotating Dual Glow Rings */}
        <div
          className={`absolute ${ringSizes} rounded-full border-2 border-transparent border-t-primary border-r-sky-400 animate-spin duration-700 shadow-[0_0_25px_rgba(79,70,229,0.35)]`}
        />
        <div
          className={`absolute ${ringSizes} rounded-full border-2 border-transparent border-b-emerald-400 border-l-purple-500 animate-[spin_1.5s_linear_infinite_reverse] opacity-80`}
        />

        {/* Core Glowing Brand Container */}
        <div className={`relative ${sizeClasses} grid place-items-center rounded-2xl bg-card/90 border border-border/80 shadow-2xl backdrop-blur-xl transition-all`}>
          <img
            src={logoSrc}
            alt="Zexpand"
            className="h-10 w-auto object-contain animate-pulse drop-shadow-[0_0_12px_rgba(79,70,229,0.5)]"
            onError={(e) => {
              // Fallback to Icon mark if image fails
              (e.target as HTMLElement).style.display = "none";
              const fallback = document.getElementById("zexpand-loader-fallback");
              if (fallback) fallback.style.display = "flex";
            }}
          />
          <div id="zexpand-loader-fallback" className="hidden items-center justify-center text-primary">
            <Zap className="h-8 w-8 animate-bounce text-primary fill-primary/20" />
          </div>

          {/* Floating Sparkle Badge */}
          <div className="absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-md animate-bounce">
            <Sparkles className="h-3 w-3" />
          </div>
        </div>
      </div>

      {/* Loading Text & Animated Gradient Progress Line */}
      <div className="mt-8 space-y-2">
        <div className="flex items-center justify-center gap-2 text-sm font-bold text-foreground tracking-tight">
          <Activity className="h-4 w-4 text-primary animate-spin" />
          <span>{text}</span>
        </div>

        {subtext && (
          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
            {subtext}
          </p>
        )}

        {/* Traveling Light Bar Progress Shimmer */}
        <div className="mx-auto mt-4 h-1.5 w-44 overflow-hidden rounded-full bg-muted/60 p-0.5 border border-border/40">
          <div className="h-full w-full rounded-full bg-gradient-to-r from-primary via-emerald-400 to-indigo-500 animate-[shimmer_1.5s_infinite] [background-size:200%_100%]" />
        </div>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex min-h-screen w-full items-center justify-center bg-background/95 backdrop-blur-md transition-all">
        {content}
      </div>
    );
  }

  return content;
}
