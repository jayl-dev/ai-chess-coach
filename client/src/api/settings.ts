import type { ConnectionTestResponse, ModelListResponse, VisionModel, VisionProviderId } from "../types/app";
import { loadApiKey, loadLocalApiKey } from "../state/settings";

type ApiErrorBody = { error?: { message?: unknown } };

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const CURATED_MODEL_IDS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-3-flash-preview",
  "openai/gpt-4o-mini",
  "anthropic/claude-sonnet-5",
] as const;

type OpenRouterModel = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  context_length?: unknown;
  architecture?: { input_modalities?: unknown; output_modalities?: unknown };
  pricing?: { prompt?: unknown; completion?: unknown; image?: unknown; request?: unknown };
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function requestOpenRouter<T>(path: string, apiKey?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${OPENROUTER_BASE_URL}${path}`, {
      headers: {
        Accept: "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        "X-OpenRouter-Title": "Chess Coach Client",
      },
    });
  } catch (error) {
    throw new ApiError(
      error instanceof Error
        ? `Could not reach OpenRouter from this browser: ${error.message}`
        : "Could not reach OpenRouter from this browser.",
      0,
    );
  }

  if (!response.ok) {
    let message = `OpenRouter returned status ${response.status}.`;
    try {
      const body = (await response.json()) as ApiErrorBody;
      if (typeof body.error?.message === "string") message = body.error.message;
    } catch {
      // Keep the HTTP status fallback.
    }
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}

function hasZeroPrice(value: unknown): boolean {
  return (
    value === undefined ||
    ((typeof value === "string" || typeof value === "number") && Number(value) === 0)
  );
}

function isFreeModel(model: OpenRouterModel): boolean {
  if (typeof model.id === "string" && model.id.endsWith(":free")) return true;
  return Boolean(
    model.pricing &&
    hasZeroPrice(model.pricing.prompt) &&
    hasZeroPrice(model.pricing.completion) &&
    hasZeroPrice(model.pricing.image) &&
    hasZeroPrice(model.pricing.request),
  );
}

async function fetchDirectVisionModels(): Promise<ModelListResponse> {
  const apiKey = loadLocalApiKey(window.localStorage);
  const body = await requestOpenRouter<{ data?: unknown }>(
    "/models?input_modalities=image&output_modalities=text",
    apiKey || undefined,
  );
  if (!Array.isArray(body.data))
    throw new ApiError("OpenRouter returned an invalid model list.", 502);

  const curatedOrder = new Map(CURATED_MODEL_IDS.map((id, index) => [id, index]));
  const models = (body.data as OpenRouterModel[])
    .filter((model) => {
      const inputs = model.architecture?.input_modalities;
      const outputs = model.architecture?.output_modalities;
      return (
        typeof model.id === "string" &&
        Array.isArray(inputs) &&
        inputs.includes("image") &&
        (!Array.isArray(outputs) || outputs.includes("text"))
      );
    })
    .map((model) => ({
      id: model.id as string,
      name: typeof model.name === "string" && model.name ? model.name : (model.id as string),
      description:
        typeof model.description === "string"
          ? model.description
          : "Image-capable OpenRouter model.",
      contextLength: typeof model.context_length === "number" ? model.context_length : null,
      isCurated: curatedOrder.has(model.id as (typeof CURATED_MODEL_IDS)[number]),
      isFree: isFreeModel(model),
    }))
    .sort((left, right) => {
      const leftOrder = curatedOrder.get(left.id as (typeof CURATED_MODEL_IDS)[number]);
      const rightOrder = curatedOrder.get(right.id as (typeof CURATED_MODEL_IDS)[number]);
      if (leftOrder !== undefined || rightOrder !== undefined) {
        return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER);
      }
      return left.name.localeCompare(right.name);
    });

  return { models };
}

const FALLBACK_OPENAI_MODELS: VisionModel[] = [
  {
    id: "livechess2fen",
    name: "livechess2fen",
    description: "LiveChess2FEN Image-to-FEN Model",
    contextLength: null,
    isCurated: true,
    isFree: true,
  },
  {
    id: "gpt-4-vision-preview",
    name: "gpt-4-vision-preview",
    description: "OpenAI GPT-4 Vision Model",
    contextLength: null,
    isCurated: true,
    isFree: false,
  },
];

function getOpenAiModelsEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) throw new ApiError("Enter an OpenAI Base URL first.", 400);
  if (trimmed.endsWith("/models")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/models`;
  return `${trimmed}/v1/models`;
}

export async function fetchOpenAiModels(
  baseUrl: string,
  apiKey?: string,
): Promise<ModelListResponse> {
  if (!baseUrl.trim()) return { models: FALLBACK_OPENAI_MODELS };
  const endpoint = getOpenAiModelsEndpoint(baseUrl);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
    });
  } catch {
    return { models: FALLBACK_OPENAI_MODELS };
  }

  if (!response.ok) {
    return { models: FALLBACK_OPENAI_MODELS };
  }

  let body: { data?: unknown[]; models?: unknown[] };
  try {
    body = (await response.json()) as { data?: unknown[]; models?: unknown[] };
  } catch {
    return { models: FALLBACK_OPENAI_MODELS };
  }

  const modelList = Array.isArray(body?.data)
    ? body.data
    : Array.isArray(body?.models)
      ? body.models
      : [];
  if (!modelList.length) {
    return { models: FALLBACK_OPENAI_MODELS };
  }

  const models: VisionModel[] = (modelList as Array<Record<string, unknown>>).map((m) => {
    const id =
      typeof m.id === "string"
        ? m.id
        : typeof m.name === "string"
          ? m.name
          : "livechess2fen";
    return {
      id,
      name: id,
      description: "OpenAI-compatible model.",
      contextLength: typeof m.context_length === "number" ? m.context_length : null,
      isCurated: id === "livechess2fen" || id === "gpt-4-vision-preview",
      isFree: id === "livechess2fen",
    };
  });

  return { models };
}

export function fetchVisionModels(
  provider: VisionProviderId,
  apiKey?: string,
  baseUrl?: string,
): Promise<ModelListResponse> {
  if (provider === "gemini") {
    return fetchGeminiModels(apiKey || loadApiKey("gemini", window.localStorage));
  }
  if (provider === "openai") {
    if (!baseUrl?.trim()) return Promise.resolve({ models: FALLBACK_OPENAI_MODELS });
    return fetchOpenAiModels(
      baseUrl.trim(),
      apiKey || loadApiKey("openai", window.localStorage),
    );
  }
  return fetchDirectVisionModels();
}

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const CURATED_GEMINI_MODEL_IDS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"];
const FREE_GEMINI_MODEL_IDS = new Set(CURATED_GEMINI_MODEL_IDS);

type GeminiModel = {
  name?: unknown;
  displayName?: unknown;
  description?: unknown;
  supportedGenerationMethods?: unknown;
  inputTokenLimit?: unknown;
};

type GeminiModelsResponse = { models?: unknown };

type GeminiErrorBody = { error?: { message?: unknown } };

async function readGeminiError(response: Response): Promise<string> {
  let message = `Gemini returned status ${response.status}.`;
  try {
    const body = (await response.json()) as GeminiErrorBody;
    if (typeof body.error?.message === "string") message = body.error.message;
  } catch {
    // Keep the HTTP status fallback.
  }
  return message;
}

export async function fetchGeminiModels(apiKey: string): Promise<ModelListResponse> {
  const key = apiKey.trim();
  if (!key) throw new ApiError("Enter a Google Gemini API key first.", 400);
  let response: Response;
  try {
    response = await fetch(`${GEMINI_BASE_URL}/models`, {
      headers: { Accept: "application/json", "x-goog-api-key": key },
    });
  } catch (error) {
    throw new ApiError(
      error instanceof Error
        ? `Could not reach Google Gemini: ${error.message}`
        : "Could not reach Google Gemini.",
      0,
    );
  }
  if (!response.ok) throw new ApiError(await readGeminiError(response), response.status);

  const body = (await response.json()) as GeminiModelsResponse;
  if (!Array.isArray(body.models))
    throw new ApiError("Gemini returned an invalid model list.", 502);

  const curatedOrder = new Map(CURATED_GEMINI_MODEL_IDS.map((id, index) => [id, index]));
  const models = (body.models as GeminiModel[])
    .filter((model) => {
      const name = typeof model.name === "string" ? model.name.replace(/^models\//, "") : "";
      const methods = model.supportedGenerationMethods;
      return (
        name.startsWith("gemini-") &&
        !name.includes("embedding") &&
        !name.includes("aqa") &&
        !/(?:image|tts|audio|live|robotics|computer-use)/i.test(name) &&
        Array.isArray(methods) &&
        methods.includes("generateContent")
      );
    })
    .map((model) => {
      const id = typeof model.name === "string" ? model.name.replace(/^models\//, "") : "";
      return {
        id,
        name: typeof model.displayName === "string" && model.displayName ? model.displayName : id,
        description:
          typeof model.description === "string" && model.description
            ? model.description
            : "Image-capable Google Gemini model.",
        contextLength: typeof model.inputTokenLimit === "number" ? model.inputTokenLimit : null,
        isCurated: curatedOrder.has(id),
        isFree: FREE_GEMINI_MODEL_IDS.has(id),
      };
    })
    .sort((left, right) => {
      const leftOrder = curatedOrder.get(left.id);
      const rightOrder = curatedOrder.get(right.id);
      if (leftOrder !== undefined || rightOrder !== undefined) {
        return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER);
      }
      return left.name.localeCompare(right.name);
    });

  return { models };
}

export async function testOpenAiConnection(
  baseUrl: string,
  apiKey?: string,
): Promise<ConnectionTestResponse> {
  const endpoint = getOpenAiModelsEndpoint(baseUrl);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
    });
  } catch (error) {
    throw new ApiError(
      error instanceof Error
        ? `Could not reach OpenAI server: ${error.message}`
        : "Could not reach OpenAI server.",
      0,
    );
  }

  if (!response.ok) {
    let message = `OpenAI endpoint returned status ${response.status}.`;
    try {
      const errJson = (await response.json()) as { error?: { message?: unknown } };
      if (typeof errJson?.error?.message === "string") message = errJson.error.message;
    } catch {
      // Keep default message
    }
    throw new ApiError(message, response.status);
  }

  let hostLabel = "OpenAI Compatible";
  try {
    hostLabel = new URL(endpoint).host;
  } catch {
    // Keep default hostLabel
  }

  return {
    ok: true as const,
    label: hostLabel,
    isFreeTier: null,
    limitRemaining: null,
  };
}

export function testVisionConnection(
  provider: VisionProviderId,
  apiKey?: string,
  baseUrl?: string,
): Promise<ConnectionTestResponse> {
  const effectiveApiKey =
    apiKey?.trim() || loadApiKey(provider, window.localStorage) || undefined;

  if (provider === "gemini") return testGeminiConnection(effectiveApiKey);
  if (provider === "openai") {
    if (!baseUrl?.trim()) return Promise.reject(new ApiError("Enter an OpenAI Base URL first.", 400));
    return testOpenAiConnection(baseUrl.trim(), effectiveApiKey);
  }
  return testOpenRouterConnection(effectiveApiKey);
}

export async function testGeminiConnection(apiKey?: string): Promise<ConnectionTestResponse> {
  const key = apiKey?.trim() || loadApiKey("gemini", window.localStorage);
  if (!key) return Promise.reject(new ApiError("Enter a Google Gemini API key first.", 400));
  let response: Response;
  try {
    response = await fetch(`${GEMINI_BASE_URL}/models`, {
      headers: { Accept: "application/json", "x-goog-api-key": key },
    });
  } catch (error) {
    throw new ApiError(
      error instanceof Error
        ? `Could not reach Google Gemini: ${error.message}`
        : "Could not reach Google Gemini.",
      0,
    );
  }
  if (!response.ok) throw new ApiError(await readGeminiError(response), response.status);
  return { ok: true as const, label: null, isFreeTier: true, limitRemaining: null };
}

export function testOpenRouterConnection(apiKey?: string): Promise<ConnectionTestResponse> {
  const key = apiKey?.trim() || loadLocalApiKey(window.localStorage);
  if (!key) return Promise.reject(new ApiError("Enter an OpenRouter API key first.", 400));
  return requestOpenRouter<{
    data?: { label?: unknown; is_free_tier?: unknown; limit_remaining?: unknown };
  }>("/key", key).then((body) => ({
    ok: true as const,
    label: typeof body.data?.label === "string" ? body.data.label : null,
    isFreeTier: typeof body.data?.is_free_tier === "boolean" ? body.data.is_free_tier : null,
    limitRemaining:
      typeof body.data?.limit_remaining === "number" ? body.data.limit_remaining : null,
  }));
}
