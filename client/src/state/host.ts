export const PAIRED_HOST_STORAGE_KEY = "chesscoach.pairedHost.v1";

export type PairedHost = {
  id: string;
  name: string;
  platform: string;
  baseUrl: string;
  token: string;
};

export function loadPairedHost(
  storage: Pick<Storage, "getItem"> = window.localStorage,
): PairedHost | null {
  try {
    const value = JSON.parse(
      storage.getItem(PAIRED_HOST_STORAGE_KEY) ?? "null",
    ) as Partial<PairedHost> | null;
    if (
      value &&
      typeof value.id === "string" &&
      typeof value.name === "string" &&
      typeof value.platform === "string" &&
      typeof value.baseUrl === "string" &&
      typeof value.token === "string"
    ) {
      return value as PairedHost;
    }
  } catch {
    // Ignore stale or malformed host data.
  }
  return null;
}

export function savePairedHost(
  host: PairedHost | null,
  storage: Pick<Storage, "setItem" | "removeItem"> = window.localStorage,
) {
  try {
    if (host) storage.setItem(PAIRED_HOST_STORAGE_KEY, JSON.stringify(host));
    else storage.removeItem(PAIRED_HOST_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
