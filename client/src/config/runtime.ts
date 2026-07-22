export const SOURCE_CODE_URL = import.meta.env.VITE_SOURCE_CODE_URL?.trim() || undefined;

export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}
