import { config as loadEnvironment } from "dotenv";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourceDirectory = dirname(fileURLToPath(import.meta.url));

export const projectRoot = resolve(sourceDirectory, "../..");

loadEnvironment({ path: resolve(projectRoot, ".env") });

function readPort(value: string | undefined): number {
  const port = Number(value ?? 5174);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : 5174;
}

function readPath(value: string | undefined): string | undefined {
  const path = value?.trim();
  if (!path) return undefined;
  return isAbsolute(path) ? path : resolve(projectRoot, path);
}

const httpsCertPath = readPath(process.env.HOST_HTTPS_CERT);
const httpsKeyPath = readPath(process.env.HOST_HTTPS_KEY);

export const serverConfig = {
  host: process.env.SERVER_HOST?.trim() || "0.0.0.0",
  port: readPort(process.env.SERVER_PORT),
  httpsCertPath,
  httpsKeyPath,
  protocol: httpsCertPath && httpsKeyPath ? "https" : "http",
};
