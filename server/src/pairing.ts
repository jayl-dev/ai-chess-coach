import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { hostname, platform } from "node:os";

const configuredCode = process.env.HOST_PAIRING_CODE?.trim();
export const pairingCode =
  configuredCode && /^\d{6}$/.test(configuredCode)
    ? configuredCode
    : String(randomInt(0, 1_000_000)).padStart(6, "0");

export const hostIdentity = {
  id: createHash("sha256").update(hostname()).digest("hex").slice(0, 16),
  name: process.env.HOST_NAME?.trim() || `${hostname()} Chess Host`,
  platform: platform(),
};

const activeTokens = new Set<string>();

function codeMatches(candidate: string): boolean {
  const expected = Buffer.from(pairingCode);
  const actual = Buffer.from(candidate);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function pairWithHost(candidateCode: unknown): string | null {
  if (typeof candidateCode !== "string" || !codeMatches(candidateCode.trim())) return null;
  const token = randomBytes(24).toString("base64url");
  activeTokens.add(token);
  return token;
}

export function isValidHostToken(authorization: string | undefined): boolean {
  if (!authorization?.startsWith("Bearer ")) return false;
  return activeTokens.has(authorization.slice("Bearer ".length));
}
