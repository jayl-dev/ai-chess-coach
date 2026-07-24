import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  defaultModelFor,
  loadApiKey,
  loadSettings,
  saveApiKey,
  saveSettings,
} from "./settings";

describe("settings persistence", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips valid settings", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      depth: 16,
      accentTheme: "coral" as const,
      showArrow: false,
    };

    saveSettings(settings, window.localStorage);

    expect(loadSettings(window.localStorage)).toEqual(settings);
  });

  it("falls back safely for invalid persisted values", () => {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ depth: 40, accentTheme: "unknown", showHighlights: false }),
    );

    expect(loadSettings(window.localStorage)).toEqual({
      ...DEFAULT_SETTINGS,
      showHighlights: false,
    });
  });

  it("stores provider API keys independently", () => {
    expect(saveApiKey("openrouter", "openrouter-key", window.localStorage)).toBe(true);
    expect(saveApiKey("gemini", "gemini-key", window.localStorage)).toBe(true);
    expect(saveApiKey("openai", "openai-key", window.localStorage)).toBe(true);

    expect(loadApiKey("openrouter", window.localStorage)).toBe("openrouter-key");
    expect(loadApiKey("gemini", window.localStorage)).toBe("gemini-key");
    expect(loadApiKey("openai", window.localStorage)).toBe("openai-key");

    expect(saveApiKey("gemini", null, window.localStorage)).toBe(true);
    expect(loadApiKey("openrouter", window.localStorage)).toBe("openrouter-key");
    expect(loadApiKey("openai", window.localStorage)).toBe("openai-key");
    expect(loadApiKey("gemini", window.localStorage)).toBe("");
  });

  it("uses provider-compatible default models", () => {
    expect(defaultModelFor("openrouter")).toBe("~openai/gpt-mini-latest");
    expect(defaultModelFor("gemini")).toBe("gemini-flash-latest");
    expect(defaultModelFor("openai")).toBe("gpt-4o-mini");
  });

  it("persists openaiBaseUrl, openaiPromptStyle, and openaiA1Pos", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      provider: "openai" as const,
      openaiBaseUrl: "http://localhost:8080/v1",
      openaiPromptStyle: "livechess2fen" as const,
      openaiA1Pos: "TR" as const,
    };

    saveSettings(settings, window.localStorage);
    expect(loadSettings(window.localStorage)).toEqual(settings);
  });
});
