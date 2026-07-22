import { assetUrl } from "../config/runtime";

export type EngineScore = { kind: "centipawn"; value: number } | { kind: "mate"; value: number };

export type EngineResult = {
  bestMove: string;
  ponder: string | null;
  score: EngineScore;
  principalVariation: string[];
};

export class StockfishError extends Error {
  constructor(
    message: string,
    public readonly diagnostics: string[],
  ) {
    super(message);
    this.name = "StockfishError";
  }
}

function parseInfo(line: string): { score?: EngineScore; pv?: string[] } {
  const scoreMatch = line.match(/\bscore (cp|mate) (-?\d+)/);
  const pvMatch = line.match(/\bpv ((?:[a-h][1-8][a-h][1-8][qrbn]?\s*)+)/);
  const score = scoreMatch
    ? scoreMatch[1] === "mate"
      ? ({ kind: "mate", value: Number(scoreMatch[2]) } as const)
      : ({ kind: "centipawn", value: Number(scoreMatch[2]) } as const)
    : undefined;
  return { score, pv: pvMatch?.[1].trim().split(/\s+/) };
}

export function analyzeWithStockfish(
  fen: string,
  depth: number,
  timeoutMs = 45_000,
): Promise<EngineResult> {
  const scriptUrl = new URL(
    assetUrl("vendor/stockfish/stockfish-18-lite-single.js"),
    window.location.href,
  );
  const wasmUrl = new URL(
    assetUrl("vendor/stockfish/stockfish-18-lite-single.wasm"),
    window.location.href,
  );

  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const logLines: string[] = [];
    let phase = "creating-worker";
    let worker: Worker;
    let settled = false;
    let initialized = false;
    let lastScore: EngineScore = { kind: "centipawn", value: 0 };
    let principalVariation: string[] = [];

    const record = (message: string) => {
      logLines.push(`${Math.round(performance.now() - startedAt)}ms ${message}`);
      if (logLines.length > 24) logLines.shift();
    };

    const diagnostics = () => [
      `Stockfish phase: ${phase}`,
      `Requested depth: ${depth}`,
      `Elapsed: ${Math.round(performance.now() - startedAt)}ms`,
      `Worker: ${scriptUrl.href}`,
      `WASM: ${wasmUrl.href}`,
      `Recent worker messages:`,
      ...(logLines.length ? logLines : ["(none received)"]),
    ];

    try {
      worker = new Worker(scriptUrl.href);
      phase = "waiting-for-uciok";
      record("worker created");
    } catch (error) {
      reject(
        new StockfishError(
          error instanceof Error ? error.message : "Stockfish worker could not be created.",
          diagnostics(),
        ),
      );
      return;
    }

    let timeout = 0;

    const finish = () => {
      window.clearTimeout(timeout);
      worker.terminate();
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      const error = new StockfishError(message, diagnostics());
      finish();
      if (import.meta.env.DEV) console.error(error, error.diagnostics);
      reject(error);
    };

    timeout = window.setTimeout(() => {
      fail(`Stockfish timed out during ${phase}.`);
    }, timeoutMs);

    worker.onerror = (event) => {
      record(
        `worker error: ${event.message || "unknown error"} (${event.filename || "unknown file"}:${event.lineno || 0}:${event.colno || 0})`,
      );
      fail(event.message || "Stockfish could not start in this browser.");
    };

    worker.onmessageerror = () => {
      record("worker message could not be decoded");
      fail("Stockfish returned an unreadable worker message.");
    };

    const handleLine = (line: string) => {
      if (!line) return;
      if (!line.startsWith("option ")) record(`engine: ${line}`);
      if (line === "uciok") {
        phase = "waiting-for-readyok";
        worker.postMessage("setoption name Hash value 16");
        worker.postMessage("isready");
        return;
      }
      if (line === "readyok" && !initialized) {
        initialized = true;
        phase = "searching";
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go depth ${depth}`);
        return;
      }
      if (line.startsWith("info ")) {
        const parsed = parseInfo(line);
        if (parsed.score) lastScore = parsed.score;
        if (parsed.pv?.length) principalVariation = parsed.pv;
        return;
      }
      if (line.startsWith("bestmove ")) {
        const match = line.match(/^bestmove (\S+)(?: ponder (\S+))?/);
        if (!match || match[1] === "(none)") {
          fail("Stockfish did not return a legal move.");
          return;
        }
        if (settled) return;
        settled = true;
        phase = "complete";
        finish();
        resolve({
          bestMove: match[1],
          ponder: match[2] ?? null,
          score: lastScore,
          principalVariation,
        });
      }
    };

    worker.onmessage = (event: MessageEvent<string>) => {
      String(event.data)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .forEach(handleLine);
    };

    record("sending uci");
    worker.postMessage("uci");
  });
}
