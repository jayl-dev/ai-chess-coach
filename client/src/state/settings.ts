import type { AppSettings, VisionProviderId } from "../types/app";

export const SETTINGS_STORAGE_KEY = "chesscoach.settings.v1";
export const API_KEY_STORAGE_KEY = "chesscoach.openrouterApiKey.v1";
export const GEMINI_API_KEY_STORAGE_KEY = "chesscoach.geminiApiKey.v1";
export const OPENAI_API_KEY_STORAGE_KEY = "chesscoach.openaiApiKey.v1";

const DEFAULT_OPENROUTER_MODEL = "~openai/gpt-mini-latest";
const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export const DEFAULT_SETTINGS: AppSettings = {
  model: DEFAULT_OPENROUTER_MODEL,
  provider: "openrouter",
  openaiBaseUrl: "",
  openaiPromptStyle: "llm",
  openaiA1Pos: "BL",
  recognitionEffort: "low",
  assumeSideToMoveAtBottom: true,
  depth: 12,
  autoCropBoard: true,
  liveBoardGuide: true,
  openingBook: true,
  endgameTablebases: true,
  accentTheme: "mint",
  showArrow: true,
  showHighlights: true,
};

const THEMES = new Set(["mint", "coral", "lavender"]);
const DEVELOPMENT_API_KEY = import.meta.env.DEV
  ? import.meta.env.VITE_DEV_OPENROUTER_API_KEY?.trim() || ""
  : "";
const DEVELOPMENT_GEMINI_API_KEY = import.meta.env.DEV
  ? import.meta.env.VITE_DEV_GEMINI_API_KEY?.trim() || ""
  : "";
const DEVELOPMENT_OPENAI_API_KEY = import.meta.env.DEV
  ? import.meta.env.VITE_DEV_OPENAI_API_KEY?.trim() || ""
  : "";

export function defaultModelFor(provider: VisionProviderId): string {
  if (provider === "gemini") return DEFAULT_GEMINI_MODEL;
  if (provider === "openai") return DEFAULT_OPENAI_MODEL;
  return DEFAULT_OPENROUTER_MODEL;
}

export function loadSettings(storage?: Pick<Storage, "getItem">): AppSettings {
  if (!storage) return DEFAULT_SETTINGS;

  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const value = JSON.parse(raw) as Partial<AppSettings>;

    return {
      model: typeof value.model === "string" ? value.model : DEFAULT_SETTINGS.model,
      provider:
        value.provider === "gemini" || value.provider === "openrouter" || value.provider === "openai"
          ? value.provider
          : DEFAULT_SETTINGS.provider,
      openaiBaseUrl:
        typeof value.openaiBaseUrl === "string"
          ? value.openaiBaseUrl.trim()
          : DEFAULT_SETTINGS.openaiBaseUrl,
      openaiPromptStyle:
        value.openaiPromptStyle === "llm" || value.openaiPromptStyle === "livechess2fen"
          ? value.openaiPromptStyle
          : DEFAULT_SETTINGS.openaiPromptStyle,
      openaiA1Pos:
        value.openaiA1Pos === "BL" ||
        value.openaiA1Pos === "BR" ||
        value.openaiA1Pos === "TL" ||
        value.openaiA1Pos === "TR"
          ? value.openaiA1Pos
          : DEFAULT_SETTINGS.openaiA1Pos,
      recognitionEffort:
        value.recognitionEffort === "high" || value.recognitionEffort === "low"
          ? value.recognitionEffort
          : DEFAULT_SETTINGS.recognitionEffort,
      assumeSideToMoveAtBottom:
        typeof value.assumeSideToMoveAtBottom === "boolean"
          ? value.assumeSideToMoveAtBottom
          : DEFAULT_SETTINGS.assumeSideToMoveAtBottom,
      depth:
        typeof value.depth === "number" && value.depth >= 8 && value.depth <= 16
          ? value.depth
          : DEFAULT_SETTINGS.depth,
      autoCropBoard:
        typeof value.autoCropBoard === "boolean"
          ? value.autoCropBoard
          : DEFAULT_SETTINGS.autoCropBoard,
      liveBoardGuide:
        typeof value.liveBoardGuide === "boolean"
          ? value.liveBoardGuide
          : DEFAULT_SETTINGS.liveBoardGuide,
      openingBook:
        typeof value.openingBook === "boolean" ? value.openingBook : DEFAULT_SETTINGS.openingBook,
      endgameTablebases:
        typeof value.endgameTablebases === "boolean"
          ? value.endgameTablebases
          : DEFAULT_SETTINGS.endgameTablebases,
      accentTheme:
        typeof value.accentTheme === "string" && THEMES.has(value.accentTheme)
          ? (value.accentTheme as AppSettings["accentTheme"])
          : DEFAULT_SETTINGS.accentTheme,
      showArrow:
        typeof value.showArrow === "boolean" ? value.showArrow : DEFAULT_SETTINGS.showArrow,
      showHighlights:
        typeof value.showHighlights === "boolean"
          ? value.showHighlights
          : DEFAULT_SETTINGS.showHighlights,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings, storage?: Pick<Storage, "setItem">) {
  if (!storage) return false;
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function loadLocalApiKey(storage?: Pick<Storage, "getItem">): string {
  if (!storage) return DEVELOPMENT_API_KEY;
  try {
    return storage.getItem(API_KEY_STORAGE_KEY)?.trim() || DEVELOPMENT_API_KEY;
  } catch {
    return DEVELOPMENT_API_KEY;
  }
}

export function saveLocalApiKey(
  apiKey: string | null,
  storage?: Pick<Storage, "setItem" | "removeItem">,
) {
  if (!storage) return false;
  try {
    if (apiKey) storage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
    else storage.removeItem(API_KEY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function loadGeminiApiKey(storage?: Pick<Storage, "getItem">): string {
  if (!storage) return DEVELOPMENT_GEMINI_API_KEY;
  try {
    return storage.getItem(GEMINI_API_KEY_STORAGE_KEY)?.trim() || DEVELOPMENT_GEMINI_API_KEY;
  } catch {
    return DEVELOPMENT_GEMINI_API_KEY;
  }
}

export function saveGeminiApiKey(
  apiKey: string | null,
  storage?: Pick<Storage, "setItem" | "removeItem">,
) {
  if (!storage) return false;
  try {
    if (apiKey) storage.setItem(GEMINI_API_KEY_STORAGE_KEY, apiKey.trim());
    else storage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function loadOpenAiApiKey(storage?: Pick<Storage, "getItem">): string {
  if (!storage) return DEVELOPMENT_OPENAI_API_KEY;
  try {
    return storage.getItem(OPENAI_API_KEY_STORAGE_KEY)?.trim() || DEVELOPMENT_OPENAI_API_KEY;
  } catch {
    return DEVELOPMENT_OPENAI_API_KEY;
  }
}

export function saveOpenAiApiKey(
  apiKey: string | null,
  storage?: Pick<Storage, "setItem" | "removeItem">,
) {
  if (!storage) return false;
  try {
    if (apiKey) storage.setItem(OPENAI_API_KEY_STORAGE_KEY, apiKey.trim());
    else storage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function loadApiKey(provider: VisionProviderId, storage?: Pick<Storage, "getItem">): string {
  if (provider === "gemini") return loadGeminiApiKey(storage);
  if (provider === "openai") return loadOpenAiApiKey(storage);
  return loadLocalApiKey(storage);
}

export function saveApiKey(
  provider: VisionProviderId,
  apiKey: string | null,
  storage?: Pick<Storage, "setItem" | "removeItem">,
): boolean {
  if (provider === "gemini") return saveGeminiApiKey(apiKey, storage);
  if (provider === "openai") return saveOpenAiApiKey(apiKey, storage);
  return saveLocalApiKey(apiKey, storage);
}
