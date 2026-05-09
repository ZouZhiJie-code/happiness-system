import type { UserSettings } from "./types";

export async function fetchSettings(): Promise<UserSettings> {
  const response = await fetch("/api/settings");

  if (!response.ok) {
    throw new Error("Failed to fetch settings");
  }

  return response.json();
}

export async function updateSettings(data: Partial<UserSettings>): Promise<UserSettings> {
  const response = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error("Failed to update settings");
  }

  return response.json();
}
