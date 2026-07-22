import { Router } from "express";
import { captureHostScreen, CaptureError } from "./capture.js";
import { hostIdentity, isValidHostToken, pairWithHost } from "./pairing.js";

export const captureRouter = Router();

captureRouter.get("/host/info", (_request, response) => {
  response.set("Cache-Control", "no-store").json({
    ...hostIdentity,
    service: "chess-coach-host",
    version: 1,
    requiresPairing: true,
  });
});

captureRouter.post("/host/pair", (request, response) => {
  const token = pairWithHost(request.body?.code);
  if (!token) {
    response.status(401).json({
      error: { code: "pairing-failed", message: "The pairing code is incorrect." },
    });
    return;
  }
  response.json({ ...hostIdentity, token });
});

captureRouter.post("/capture/screenshot", async (request, response, next) => {
  if (!isValidHostToken(request.header("Authorization"))) {
    response.status(401).json({
      error: {
        code: "host-not-paired",
        message: "Pair with this host before requesting a screenshot.",
      },
    });
    return;
  }

  try {
    const screenshot = await captureHostScreen();
    response.set({
      "Cache-Control": "no-store",
      "Content-Length": String(screenshot.byteLength),
      "Content-Type": "image/jpeg",
    });
    response.send(screenshot);
  } catch (error) {
    if (error instanceof CaptureError) {
      response.status(error.code === "capture-unsupported" ? 501 : 500).json({
        error: { code: error.code, message: error.message },
      });
      return;
    }
    next(error);
  }
});
