import type { OnboardFormData } from "./types";

const STORAGE_KEY = "moi-onboard-draft";

interface DraftState {
  data: Partial<OnboardFormData>;
  step: number;
  updatedAt: string;
}

export function saveDraft(data: Partial<OnboardFormData>, step: number): void {
  try {
    const draft: DraftState = {
      data,
      step,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // localStorage unavailable or full — silent fail
  }
}

export function loadDraft(): DraftState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftState;
    if (!parsed.data || typeof parsed.step !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silent fail
  }
}

export function hasDraft(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
