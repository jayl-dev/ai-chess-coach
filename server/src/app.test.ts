import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("GET /api/health", () => {
  it("returns server readiness and an ISO timestamp", async () => {
    const runtime = await createApp();
    const response = await request(runtime.app).get("/api/health").expect(200);

    expect(response.body).toEqual({
      ok: true,
      time: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(response.body.time))).toBe(false);
    await runtime.close();
  });
});
