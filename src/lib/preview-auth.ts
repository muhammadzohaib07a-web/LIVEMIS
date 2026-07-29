export const PREVIEW_AUTH_KEY = "mis-support-preview";
export const PREVIEW_ROLE_KEY = "mis-support-preview-role";

export type PreviewRole = "employee" | "agent" | "admin";

export function isPreviewMode() {
  return typeof window !== "undefined" && sessionStorage.getItem(PREVIEW_AUTH_KEY) === "true";
}

export function enablePreviewMode(role: PreviewRole = "employee") {
  sessionStorage.setItem(PREVIEW_AUTH_KEY, "true");
  sessionStorage.setItem(PREVIEW_ROLE_KEY, role);
}

export function getPreviewRole(): PreviewRole {
  if (typeof window === "undefined") return "employee";
  const role = sessionStorage.getItem(PREVIEW_ROLE_KEY);
  if (role === "admin") return "admin";
  if (role === "agent") return "agent";
  return "employee";
}

export function disablePreviewMode() {
  sessionStorage.removeItem(PREVIEW_AUTH_KEY);
  sessionStorage.removeItem(PREVIEW_ROLE_KEY);
}
