import express, { type ErrorRequestHandler, type Express, type RequestHandler } from "express";
import { existsSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { projectRoot, serverConfig } from "./config.js";
import { captureRouter } from "./captureRoutes.js";

const clientRoot = resolve(projectRoot, "client");
const clientDist = resolve(clientRoot, "dist");
const clientIndex = resolve(clientDist, "index.html");

const requestLogger: RequestHandler = (request, response, next) => {
  const startedAt = performance.now();

  response.once("finish", () => {
    const durationMs = Math.round(performance.now() - startedAt);
    console.info(`${request.method} ${request.originalUrl} ${response.statusCode} ${durationMs}ms`);
  });

  next();
};

const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  void _next;
  console.error(error);
  response.status(500).json({
    error: {
      code: "internal-error",
      message: "Something went wrong on the server.",
    },
  });
};

type AppRuntime = {
  app: Express;
  server: ReturnType<typeof createHttpServer> | ReturnType<typeof createHttpsServer>;
  close: () => Promise<void>;
};

export async function createApp(): Promise<AppRuntime> {
  const app = express();
  const server =
    serverConfig.httpsCertPath && serverConfig.httpsKeyPath
      ? createHttpsServer(
          {
            cert: await readFile(serverConfig.httpsCertPath),
            key: await readFile(serverConfig.httpsKeyPath),
          },
          app,
        )
      : createHttpServer(app);
  let closeDevelopmentServer: () => Promise<void> = async () => undefined;

  app.disable("x-powered-by");
  app.use(requestLogger);
  app.use((request, response, next) => {
    const origin = request.header("Origin");
    if (origin) {
      response.set("Access-Control-Allow-Origin", origin);
      response.set("Vary", "Origin");
    }
    response.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, X-Chess-Coach-Request",
    );
    response.set("Access-Control-Allow-Private-Network", "true");
    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true, time: new Date().toISOString() });
  });

  app.use("/api", captureRouter);

  app.use("/api", (_request, response) => {
    response.status(404).json({
      error: {
        code: "not-found",
        message: "API route not found.",
      },
    });
  });

  if (process.env.NODE_ENV === "development") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      root: clientRoot,
      configFile: resolve(clientRoot, "vite.config.ts"),
      server: {
        middlewareMode: true,
        hmr: { server },
      },
      appType: "spa",
    });

    app.use(vite.middlewares);
    closeDevelopmentServer = () => vite.close();
  } else if (existsSync(clientIndex)) {
    app.use(express.static(clientDist));
    app.use((request, response, next) => {
      if (request.method === "GET" && request.accepts("html")) {
        response.sendFile(clientIndex);
        return;
      }
      next();
    });
  }

  app.use(errorHandler);

  return { app, server, close: closeDevelopmentServer };
}
