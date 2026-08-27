import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const Ctx = createContext<{ theme: Theme; toggle: () => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    try {
      const stored = localStorage.getItem("mo-theme") as Theme | null;
      if (stored === "light" || stored === "dark") return stored;
    } catch { }
    return "dark"; // Default to dark mode ("black")
  });

  useEffect(() => {
    const root = document.documentElement;
    const fav = document.getElementById("favicon-link") as HTMLLinkElement | null;
    if (theme === "dark") {
      root.classList.add("dark");
      if (fav) fav.href = "/logo-dark.png";
    } else {
      root.classList.remove("dark");
      if (fav) fav.href = "/logo-light.png";
    }
    try {
      localStorage.setItem("mo-theme", theme);
    } catch { }
  }, [theme]);

  const toggle = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <Ctx.Provider value={{ theme, toggle }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used inside ThemeProvider");
  return v;
}