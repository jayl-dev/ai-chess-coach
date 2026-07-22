import type { PairedHost } from "../state/host";

const DEFAULT_HOST_PORT = 5174;
type LocalAddressSpace = "local" | "loopback";
type LocalNetworkRequestInit = RequestInit & { targetAddressSpace?: LocalAddressSpace };

export type HostInfo = {
  id: string;
  name: string;
  platform: string;
  service: "chess-coach-host";
  version: number;
  requiresPairing: boolean;
  baseUrl: string;
};

export class HostRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "HostRequestError";
  }
}

class LocalNetworkAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalNetworkAccessError";
  }
}

function ipv4AddressSpace(hostname: string): LocalAddressSpace | null {
  const parts = hostname.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return null;
  }
  if (parts[0] === 127) return "loopback";
  if (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 169 && parts[1] === 254)
  ) {
    return "local";
  }
  return null;
}

function addressSpaceForHostname(hostname: string): LocalAddressSpace | null {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized === "::1") {
    return "loopback";
  }
  const ipv4Space = ipv4AddressSpace(normalized);
  if (ipv4Space) return ipv4Space;
  if (
    normalized.endsWith(".local") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized)
  ) {
    return "local";
  }
  return null;
}

function hostnameFromInput(value: string): string {
  try {
    const parseable = /^https?:\/\//i.test(value) ? value : `http://${value}`;
    return new URL(parseable).hostname;
  } catch {
    return "";
  }
}

async function permissionDenied(addressSpace: LocalAddressSpace): Promise<boolean> {
  if (!navigator.permissions?.query) return false;
  const permissionName = addressSpace === "loopback" ? "loopback-network" : "local-network";
  try {
    const permission = await navigator.permissions.query({
      name: permissionName as PermissionName,
    });
    return permission.state === "denied";
  } catch {
    return false;
  }
}

export async function fetchWithLocalNetworkAccess(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const addressSpace = addressSpaceForHostname(new URL(input).hostname);
  const requestInit: LocalNetworkRequestInit = addressSpace
    ? { ...init, targetAddressSpace: addressSpace }
    : init;
  try {
    return await fetch(input, requestInit);
  } catch (error) {
    if (addressSpace && (await permissionDenied(addressSpace))) {
      throw new LocalNetworkAccessError(
        'Local network access is blocked. Allow "Local network access" in this site\'s browser permissions, then scan again.',
      );
    }
    throw error;
  }
}

export function normalizeHostUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  const inputAddressSpace = addressSpaceForHostname(hostnameFromInput(trimmed));
  const defaultProtocol = inputAddressSpace
    ? "http:"
    : window.location.protocol === "https:"
      ? "https:"
      : "http:";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `${defaultProtocol}//${trimmed}`;
  const url = new URL(withProtocol);
  const addressSpace = addressSpaceForHostname(url.hostname);
  if (window.location.protocol === "https:" && url.protocol !== "https:" && !addressSpace) {
    throw new HostRequestError("An HTTPS app can only connect to a public host over HTTPS.", 0);
  }
  return url.origin;
}

async function readHostError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    if (typeof body.error?.message === "string") return body.error.message;
  } catch {
    // Use status fallback.
  }
  return `Host returned status ${response.status}.`;
}

export async function probeHost(value: string, timeoutMs = 2200): Promise<HostInfo> {
  const baseUrl = normalizeHostUrl(value);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchWithLocalNetworkAccess(`${baseUrl}/api/host/info`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { "X-Chess-Coach-Request": "discovery" },
    });
    if (!response.ok) throw new HostRequestError(await readHostError(response), response.status);
    const info = (await response.json()) as Omit<HostInfo, "baseUrl">;
    if (info.service !== "chess-coach-host" || typeof info.id !== "string") {
      throw new HostRequestError("That address is not a Chess Coach host.", 0);
    }
    return { ...info, baseUrl };
  } catch (error) {
    if (error instanceof HostRequestError) throw error;
    if (error instanceof LocalNetworkAccessError) {
      throw new HostRequestError(error.message, 0);
    }
    throw new HostRequestError(
      error instanceof DOMException && error.name === "AbortError"
        ? "The host did not respond in time."
        : "Could not reach a Chess Coach host at that address.",
      0,
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function scanForHosts(savedBaseUrl?: string): Promise<HostInfo[]> {
  const candidates = new Set<string>();
  if (savedBaseUrl) candidates.add(savedBaseUrl);
  if (/^https?:$/.test(window.location.protocol)) {
    candidates.add(window.location.origin);
    const pageHost = new URL(window.location.origin);
    if (addressSpaceForHostname(pageHost.hostname)) {
      pageHost.protocol = "http:";
      pageHost.port = String(DEFAULT_HOST_PORT);
      candidates.add(pageHost.origin);
    }
  }
  candidates.add(`http://localhost:${DEFAULT_HOST_PORT}`);
  candidates.add(`http://127.0.0.1:${DEFAULT_HOST_PORT}`);
  candidates.add(`http://chess-coach.local:${DEFAULT_HOST_PORT}`);

  const failures: unknown[] = [];
  for (const candidate of candidates) {
    try {
      return [await probeHost(candidate)];
    } catch (error) {
      failures.push(error);
    }
  }
  const permissionFailure = failures.find(
    (error) =>
      error instanceof HostRequestError && /local network access is blocked/i.test(error.message),
  );
  if (permissionFailure) throw permissionFailure;
  return [];
}

export async function pairHost(info: HostInfo, code: string): Promise<PairedHost> {
  const response = await fetchWithLocalNetworkAccess(`${info.baseUrl}/api/host/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Chess-Coach-Request": "pair" },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) throw new HostRequestError(await readHostError(response), response.status);
  const paired = (await response.json()) as {
    id: string;
    name: string;
    platform: string;
    token: string;
  };
  return { ...paired, baseUrl: info.baseUrl };
}
