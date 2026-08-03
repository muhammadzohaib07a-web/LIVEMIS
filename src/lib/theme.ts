export const THEME_STORAGE_KEY = "mis-support-theme";

export type AppTheme = "light" | "dark" | "green";

export function getPreferredTheme(): AppTheme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "green") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: AppTheme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("theme-green", theme === "green");
  document.documentElement.style.colorScheme = theme === "light" ? "light" : "dark";
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}
