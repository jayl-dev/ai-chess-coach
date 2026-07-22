import { mockPosition } from "./mockPosition";
import type { AnalysisResult, AppError } from "../types/app";

export type MockCaptureOutcome = "success" | "error";

export const MOCK_ANALYSIS_RESULT: AnalysisResult = {
  fen: "r1b2rk1/pp3ppp/2p1p3/8/5Np1/8/PPP2PP1/R5KR w - - 0 1",
  board: mockPosition,
  orientation: "white",
  sideToMove: "white",
  bestMove: {
    uci: "e2f4",
    san: "Nxf4",
    from: "e2",
    to: "f4",
  },
  evaluation: {
    kind: "centipawn",
    value: 120,
    display: "+1.2",
    label: "Winning",
  },
  explanation:
    "Your knight grabs the f4 pawn. If they take back with the pawn, you reply with d5 to challenge the center. You're up material and have a better position!",
  principalVariation: [
    "1. Nxf4 gxf4",
    "2. d5! challenging the center",
    "3. Bxd7+ followed by Qxd7",
  ],
  confidence: "high",
  notes: "",
  timings: {
    captureMs: 180,
    visionMs: 820,
    engineMs: 460,
    explanationMs: 510,
    totalMs: 1970,
  },
};

export const MOCK_ANALYSIS_ERROR: AppError = {
  code: "analysis-failed",
  title: "Couldn’t read the board",
  message: "Make sure the full board is visible and well lit, then try capturing it again.",
  retryable: true,
  settingsAction: false,
};
