import type { VisionProviderId } from "../types/app";

export type ProviderContentPart =
  { type: "text"; text: string } | { type: "image"; dataUrl: string };

export type GenerateContentParams = {
  model: string;
  systemPrompt: string;
  userParts: ProviderContentPart[];
  temperature: number;
  maxTokens?: number;
  timeoutMs?: number;
};

export interface VisionProvider {
  generateContent(params: GenerateContentParams): Promise<string>;
}

function readMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        part && typeof part === "object" && "text" in part && typeof part.text === "string"
          ? part.text
          : "",
      )
      .join("");
  }
  return "";
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function rethrowTimeout(error: unknown, timeoutMs: number): never {
  if (error instanceof DOMException && error.name === "AbortError") {
    throw new Error(
      `The selected model did not respond within ${Math.round(timeoutMs / 1000)} seconds. Try again or choose another model.`,
    );
  }
  throw error;
}

type OpenRouterChatResponse = {
  error?: OpenRouterErrorBody;
  choices?: Array<{
    message?: { content?: unknown };
    error?: OpenRouterErrorBody;
    finish_reason?: unknown;
  }>;
  openrouter_metadata?: unknown;
};

type OpenRouterErrorBody = {
  code?: unknown;
  message?: unknown;
  metadata?: {
    error_type?: unknown;
    provider_code?: unknown;
    [key: string]: unknown;
  };
};

class OpenRouterCompletionError extends Error {
  readonly diagnostics: string[];

  constructor(error: OpenRouterErrorBody, status: number, model: string, routerMetadata?: unknown) {
    const errorCode =
      typeof error.code === "number"
        ? error.code
        : typeof error.code === "string" && /^\d+$/.test(error.code)
          ? Number(error.code)
          : status;
    const errorType =
      typeof error.metadata?.error_type === "string" ? error.metadata.error_type : "unknown";
    const providerCode =
      typeof error.metadata?.provider_code === "string" ? error.metadata.provider_code : "unknown";
    const providerMessage =
      typeof error.message === "string" && error.message.trim()
        ? error.message.trim()
        : `OpenRouter returned status ${status}.`;
    const friendlyMessage =
      errorType === "authentication"
        ? "OpenRouter rejected the saved API key. Save and test the key again in Settings."
        : errorType === "payment_required" || errorCode === 402
          ? "The OpenRouter account or BYOK provider does not have enough credit for this model. Choose a free model or add provider credit."
          : errorType === "rate_limit_exceeded"
            ? "The selected model is rate-limited right now. Try again shortly or select another model."
            : errorType === "provider_overloaded" || errorType === "provider_unavailable"
              ? "The selected model provider is temporarily unavailable. Try again or select another model."
              : providerMessage;

    super(friendlyMessage);
    this.name = "OpenRouterCompletionError";
    this.diagnostics = [
      `OpenRouter HTTP status: ${status}`,
      `Provider error code: ${errorCode}`,
      `Model: ${model}`,
      `Provider message: ${providerMessage}`,
      `Error type: ${errorType}`,
      `Provider code: ${providerCode}`,
      ...(routerMetadata === undefined
        ? []
        : [`Router metadata: ${JSON.stringify(routerMetadata, null, 2).slice(0, 5000)}`]),
    ];
  }
}

function toOpenRouterPart(part: ProviderContentPart) {
  if (part.type === "text") return { type: "text", text: part.text };
  return { type: "image_url", image_url: { url: part.dataUrl } };
}

function createOpenRouterProvider(apiKey: string): VisionProvider {
  return {
    async generateContent(params: GenerateContentParams): Promise<string> {
      const { model, systemPrompt, userParts, temperature, maxTokens, timeoutMs = 45_000 } = params;
      const body: Record<string, unknown> = {
        model,
        temperature,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userParts.map(toOpenRouterPart) },
        ],
      };
      if (maxTokens) body.max_tokens = maxTokens;
      try {
        const response = await fetchWithTimeout(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "X-OpenRouter-Title": "Chess Coach PWA",
            },
            body: JSON.stringify(body),
          },
          timeoutMs,
        );
        let payload: OpenRouterChatResponse;
        try {
          payload = (await response.json()) as OpenRouterChatResponse;
        } catch {
          throw new Error(
            `OpenRouter returned a non-JSON response with status ${response.status}.`,
          );
        }

        const completionError =
          payload.error ?? payload.choices?.find((choice) => choice.error)?.error;
        if (!response.ok || completionError) {
          throw new OpenRouterCompletionError(
            completionError ?? {
              code: response.status,
              message: `OpenRouter returned status ${response.status}.`,
            },
            response.status,
            model,
            payload.openrouter_metadata,
          );
        }

        const content = readMessageContent(payload.choices?.[0]?.message?.content);
        if (!content) {
          const finishReason = payload.choices?.[0]?.finish_reason;
          throw new Error(
            `The selected model returned no text${typeof finishReason === "string" ? ` (${finishReason})` : ""}. Try again or select another model.`,
          );
        }
        return content;
      } catch (error) {
        rethrowTimeout(error, timeoutMs);
      }
    },
  };
}

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: unknown }> };
    finishReason?: unknown;
  }>;
  promptFeedback?: { blockReason?: unknown };
  error?: GeminiErrorBody;
};

type GeminiErrorBody = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
};

class GeminiCompletionError extends Error {
  readonly diagnostics: string[];

  constructor(error: GeminiErrorBody, status: number, model: string) {
    const statusText =
      typeof error.status === "string"
        ? error.status
        : status === 401 || status === 403
          ? "PERMISSION_DENIED"
          : status === 429
            ? "RESOURCE_EXHAUSTED"
            : status === 400
              ? "INVALID_ARGUMENT"
              : status === 404
                ? "NOT_FOUND"
                : status === 500 || status === 503
                  ? "UNAVAILABLE"
                  : "unknown";
    const message =
      typeof error.message === "string" && error.message.trim()
        ? error.message.trim()
        : `Gemini returned status ${status}.`;
    const friendly =
      statusText === "PERMISSION_DENIED"
        ? "Gemini rejected the saved API key. Save and test the key again in Settings."
        : statusText === "RESOURCE_EXHAUSTED"
          ? "The Gemini free-tier limit for this model is reached right now. Try again shortly or select another model."
          : statusText === "INVALID_ARGUMENT"
            ? "Gemini rejected the request for the selected model. Choose another model in Settings."
            : statusText === "NOT_FOUND"
              ? "The selected Gemini model is unavailable. Choose another model in Settings."
              : statusText === "UNAVAILABLE"
                ? "Gemini is temporarily unavailable. Try again shortly or select another model."
                : message;

    super(friendly);
    this.name = "GeminiCompletionError";
    this.diagnostics = [
      `Gemini HTTP status: ${status}`,
      `Gemini status: ${statusText}`,
      `Model: ${model}`,
      `Gemini message: ${message}`,
    ];
  }
}

function dataUrlToInline(dataUrl: string): { mimeType: string; data: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) throw new Error("Could not encode the captured image for the model.");
  return { mimeType: match[1], data: match[2] };
}

function toGeminiPart(part: ProviderContentPart) {
  if (part.type === "text") return { text: part.text };
  const { mimeType, data } = dataUrlToInline(part.dataUrl);
  return { inlineData: { mimeType, data } };
}

function createGeminiProvider(apiKey: string): VisionProvider {
  return {
    async generateContent(params: GenerateContentParams): Promise<string> {
      const { model, systemPrompt, userParts, temperature, maxTokens, timeoutMs = 45_000 } = params;
      const generationConfig: Record<string, unknown> = { temperature };
      if (maxTokens) generationConfig.maxOutputTokens = maxTokens;
      const body: Record<string, unknown> = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: userParts.map(toGeminiPart) }],
        generationConfig,
      };
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      try {
        const response = await fetchWithTimeout(
          url,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify(body),
          },
          timeoutMs,
        );
        let payload: GeminiResponse;
        try {
          payload = (await response.json()) as GeminiResponse;
        } catch {
          throw new Error(`Gemini returned a non-JSON response with status ${response.status}.`);
        }

        if (!response.ok || payload.error) {
          throw new GeminiCompletionError(
            payload.error ?? {
              code: response.status,
              message: `Gemini returned status ${response.status}.`,
            },
            response.status,
            model,
          );
        }

        const candidate = payload.candidates?.[0];
        const parts = candidate?.content?.parts ?? [];
        const content = parts
          .map((part) => (part && typeof part.text === "string" ? part.text : ""))
          .join("");
        if (!content) {
          const finishReason = candidate?.finishReason;
          const blockReason = payload.promptFeedback?.blockReason;
          throw new Error(
            `The selected model returned no text${typeof finishReason === "string" ? ` (${finishReason})` : ""}${typeof blockReason === "string" ? ` (${blockReason})` : ""}. Try again or select another model.`,
          );
        }
        return content;
      } catch (error) {
        rethrowTimeout(error, timeoutMs);
      }
    },
  };
}

function toOpenAiPart(part: ProviderContentPart) {
  if (part.type === "text") return { type: "text", text: part.text };
  return { type: "image_url", image_url: { url: part.dataUrl } };
}

function getOpenAiChatEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("Enter an OpenAI Base URL in Settings.");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

function createOpenAiProvider(apiKey: string, baseUrl?: string): VisionProvider {
  return {
    async generateContent(params: GenerateContentParams): Promise<string> {
      const { model, systemPrompt, userParts, temperature, maxTokens, timeoutMs = 45_000 } = params;
      const endpoint = getOpenAiChatEndpoint(baseUrl || "");
      const messages: Array<{ role: string; content: unknown }> = [];
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: userParts.map(toOpenAiPart) });

      const body: Record<string, unknown> = {
        model,
        messages,
        temperature,
      };
      if (maxTokens) body.max_tokens = maxTokens;

      try {
        const response = await fetchWithTimeout(
          endpoint,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify(body),
          },
          timeoutMs,
        );

        let payload: any;
        try {
          payload = await response.json();
        } catch {
          throw new Error(`OpenAI endpoint returned non-JSON response with status ${response.status}.`);
        }

        if (!response.ok || payload.error) {
          const errMsg =
            payload?.error?.message ||
            `OpenAI endpoint returned status ${response.status}.`;
          throw new Error(errMsg);
        }

        const content = readMessageContent(payload.choices?.[0]?.message?.content);
        if (!content && content !== "0") {
          const finishReason = payload.choices?.[0]?.finish_reason;
          throw new Error(
            `The selected OpenAI model returned no text${typeof finishReason === "string" ? ` (${finishReason})` : ""}. Try again or choose another model.`,
          );
        }
        return content;
      } catch (error) {
        rethrowTimeout(error, timeoutMs);
      }
    },
  };
}

export function getVisionProvider(
  provider: VisionProviderId,
  apiKey: string,
  baseUrl?: string,
): VisionProvider {
  if (provider === "gemini") return createGeminiProvider(apiKey);
  if (provider === "openai") return createOpenAiProvider(apiKey, baseUrl);
  return createOpenRouterProvider(apiKey);
}
