export type VisionProviderId = "openrouter" | "gemini";
export type CaptureMode = "camera" | "monitor";
export type SideToMove = "white" | "black";
export type CastlingRights = "none" | "king" | "queen" | "both";
export type RecognitionEffort = "low" | "high";
export type AccentTheme = "mint" | "coral" | "lavender";
export type AppPhase = "ready" | "loading" | "captured" | "result" | "error";
export type ProgressStage =
  | "capturing"
  | "reading-position"
  | "validating-position"
  | "calculating-move"
  | "preparing-explanation";
export type Confidence = "high" | "medium" | "low";

export type PieceType = "K" | "Q" | "R" | "B" | "N" | "P";
export type PieceColor = "w" | "b";
export type Piece = { color: PieceColor; type: PieceType };
export type Square = Piece | null;
export type Board = Square[][];

export type BoardFile = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
export type BoardRank = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
export type SquareName = `${BoardFile}${BoardRank}`;

export type AppSettings = {
  model: string;
  provider: VisionProviderId;
  recognitionEffort: RecognitionEffort;
  assumeSideToMoveAtBottom: boolean;
  depth: number;
  autoCropBoard: boolean;
  liveBoardGuide: boolean;
  openingBook: boolean;
  endgameTablebases: boolean;
  accentTheme: AccentTheme;
  showArrow: boolean;
  showHighlights: boolean;
};

export type SettingsResponse = AppSettings & {
  hasApiKey: boolean;
};

export type VisionModel = {
  id: string;
  name: string;
  description: string;
  contextLength: number | null;
  isCurated: boolean;
  isFree: boolean;
};

export type ModelListResponse = {
  models: VisionModel[];
};

export type ConnectionTestResponse = {
  ok: true;
  label: string | null;
  isFreeTier: boolean | null;
  limitRemaining: number | null;
};

export type AsyncStatus = {
  phase: "idle" | "loading" | "success" | "error";
  message: string;
};

export type AnalysisTiming = {
  captureMs: number;
  visionMs: number;
  engineMs: number;
  explanationMs: number;
  totalMs: number;
};

export type AnalysisEvaluation = {
  kind: "centipawn" | "mate";
  value: number;
  display: string;
  label: string;
};

export type AnalysisMove = {
  uci: string;
  san: string;
  from: SquareName;
  to: SquareName;
};

export type AnalysisResult = {
  fen: string;
  board: Board;
  orientation: SideToMove;
  sideToMove: SideToMove;
  bestMove: AnalysisMove;
  evaluation: AnalysisEvaluation;
  explanation: string;
  principalVariation: string[];
  confidence: Confidence;
  notes: string;
  timings: AnalysisTiming;
};

export type AppErrorCode =
  "capture-failed" | "camera-permission" | "analysis-failed" | "invalid-position" | "network";

export type AppError = {
  code: AppErrorCode;
  title: string;
  message: string;
  retryable: boolean;
  settingsAction?: boolean;
  sourceUrl?: string;
  debugDetails?: string[];
};
