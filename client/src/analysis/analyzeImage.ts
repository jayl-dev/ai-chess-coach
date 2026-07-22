import { Chess } from "chess.js";
import { analyzeWithStockfish } from "./stockfish";
import { getVisionProvider, type VisionProvider } from "./visionProviders";
import { loadApiKey } from "../state/settings";
import type {
  AnalysisResult,
  AppSettings,
  Board,
  CastlingRights,
  Confidence,
  PieceType,
  ProgressStage,
  SideToMove,
  SquareName,
} from "../types/app";

type VisionPosition = {
  fen: string;
  orientation?: SideToMove;
  confidence?: Confidence;
  notes?: string;
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the captured image."));
    reader.readAsDataURL(blob);
  });
}

function parseJson<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned) as T;
}

function fenValidationError(
  fen: string,
  side: SideToMove,
  castlingRights: CastlingRights,
): string | null {
  const fields = fen.trim().split(/\s+/);
  if (fields.length !== 6) return "The position does not contain a six-field FEN.";
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch (error) {
    return error instanceof Error ? `The FEN is invalid: ${error.message}` : "The FEN is invalid.";
  }
  const expectedTurn = side === "white" ? "w" : "b";
  if (chess.turn() !== expectedTurn) return `FEN field 2 must be '${expectedTurn}'.`;
  if (fields[3] !== "-") return "FEN field 4 must be '-' because en passant is not tracked.";

  const kingSymbol = side === "white" ? "K" : "k";
  const queenSymbol = side === "white" ? "Q" : "q";
  const expectsKingSide = castlingRights === "king" || castlingRights === "both";
  const expectsQueenSide = castlingRights === "queen" || castlingRights === "both";
  if (
    fields[2].includes(kingSymbol) !== expectsKingSide ||
    fields[2].includes(queenSymbol) !== expectsQueenSide
  ) {
    return `FEN field 3 does not match the selected ${side} castling rights.`;
  }

  const king = chess.get(side === "white" ? "e1" : "e8");
  const kingSideRook = chess.get(side === "white" ? "h1" : "h8");
  const queenSideRook = chess.get(side === "white" ? "a1" : "a8");
  const color = side === "white" ? "w" : "b";
  if ((expectsKingSide || expectsQueenSide) && (king?.type !== "k" || king.color !== color)) {
    return `${side} cannot have castling rights without its king on the starting square.`;
  }
  if (expectsKingSide && (kingSideRook?.type !== "r" || kingSideRook.color !== color)) {
    return `${side} cannot castle king side without its rook on the starting square.`;
  }
  if (expectsQueenSide && (queenSideRook?.type !== "r" || queenSideRook.color !== color)) {
    return `${side} cannot castle queen side without its rook on the starting square.`;
  }
  return null;
}

function applyKnownPositionState(
  fen: string,
  side: SideToMove,
  castlingRights: CastlingRights,
): string {
  const fields = fen.trim().split(/\s+/);
  if (fields.length !== 6) return fen.trim();

  fields[1] = side === "white" ? "w" : "b";
  const rights = new Set(fields[2] === "-" ? [] : [...fields[2]]);
  const ownSymbols = side === "white" ? ["K", "Q"] : ["k", "q"];
  ownSymbols.forEach((symbol) => rights.delete(symbol));
  if (castlingRights === "king" || castlingRights === "both") rights.add(ownSymbols[0]);
  if (castlingRights === "queen" || castlingRights === "both") rights.add(ownSymbols[1]);
  fields[2] = ["K", "Q", "k", "q"].filter((symbol) => rights.has(symbol)).join("") || "-";
  fields[3] = "-";
  return fields.join(" ");
}

async function recognizePosition(
  image: Blob,
  model: string,
  side: SideToMove,
  provider: VisionProvider,
  castlingRights: CastlingRights,
  settings: AppSettings,
  onValidation?: () => void,
): Promise<VisionPosition> {
  const imageUrl = await blobToDataUrl(image);
  const orientationInstruction = settings.assumeSideToMoveAtBottom
    ? `The user confirms that ${side} is at the bottom of the image.`
    : "Do not assume which color is at the bottom. Determine orientation from visible coordinates or the board presentation, and mention uncertainty in notes.";
  const castlingDescription =
    castlingRights === "both"
      ? "both king-side and queen-side"
      : castlingRights === "king"
        ? "king-side only"
        : castlingRights === "queen"
          ? "queen-side only"
          : "no";
  const castlingInstruction = `The user confirms that ${side} has ${castlingDescription} castling rights. Set that side's symbols in FEN field 3 accordingly. Include opposing castling rights only when the position supports them and you are confident they remain available.`;
  const requestText = `Read all 64 squares of the complete chess board. ${side} moves next, so FEN field 2 must be '${side === "white" ? "w" : "b"}'. ${orientationInstruction} ${castlingInstruction} En passant is not tracked, so FEN field 4 must be '-'. Return a legal six-field FEN.`;
  const responseShape =
    "Return only JSON with fen, orientation (white or black, meaning the color at the bottom), confidence (high|medium|low), and notes. Never analyze the position or suggest a move.";
  const content = await provider.generateContent({
    model,
    temperature: 0,
    systemPrompt: `You read chess positions from images. ${responseShape}`,
    userParts: [
      { type: "text", text: requestText },
      { type: "image", dataUrl: imageUrl },
    ],
  });
  let position = parseJson<VisionPosition>(content);
  if (!position || typeof position.fen !== "string") {
    throw new Error("The vision model did not return a FEN position.");
  }
  position.fen = applyKnownPositionState(position.fen, side, castlingRights);

  if (settings.recognitionEffort === "high") {
    onValidation?.();
    let validationFeedback = fenValidationError(position.fen, side, castlingRights);
    for (let pass = 0; pass < 2; pass += 1) {
      const reviewContent = await provider.generateContent({
        model,
        temperature: 0,
        systemPrompt: `You independently verify chess-board image recognition. Inspect every square one by one, from a8 through h1. Do not accept a plausible or legal-looking position unless every piece matches the image. Correct any discrepancy. ${responseShape}`,
        userParts: [
          {
            type: "text",
            text: `${requestText} The current candidate is ${JSON.stringify(position)}.${validationFeedback ? ` Local validation found this problem: ${validationFeedback}` : ""} Return the corrected result, or return the candidate unchanged only after checking every square.`,
          },
          { type: "image", dataUrl: imageUrl },
        ],
      });
      const reviewed = parseJson<VisionPosition>(reviewContent);
      if (!reviewed || typeof reviewed.fen !== "string") {
        throw new Error("The vision model did not return a FEN during validation.");
      }
      reviewed.fen = applyKnownPositionState(reviewed.fen, side, castlingRights);
      const stable =
        reviewed.fen.trim() === position.fen.trim() &&
        (reviewed.orientation ?? position.orientation) === position.orientation;
      position = { ...position, ...reviewed };
      validationFeedback = fenValidationError(position.fen, side, castlingRights);
      if (stable && !validationFeedback) break;
    }
  }

  const validationError = fenValidationError(position.fen, side, castlingRights);
  if (validationError) throw new Error(validationError);
  return {
    ...position,
    fen: position.fen.trim(),
    orientation: settings.assumeSideToMoveAtBottom
      ? side
      : position.orientation === "black"
        ? "black"
        : position.orientation === "white"
          ? "white"
          : side,
  };
}

function boardFromChess(chess: Chess): Board {
  return chess.board().map((rank) =>
    rank.map((piece) =>
      piece
        ? {
            color: piece.color,
            type: piece.type.toUpperCase() as PieceType,
          }
        : null,
    ),
  );
}

function uciToMove(chess: Chess, uci: string) {
  const from = uci.slice(0, 2) as SquareName;
  const to = uci.slice(2, 4) as SquareName;
  const move = chess.move({ from, to, promotion: uci[4] || "q" });
  if (!move) throw new Error(`Stockfish returned an illegal move: ${uci}.`);
  return { uci, san: move.san, from, to };
}

function pvToSan(fen: string, variation: string[]): string[] {
  const chess = new Chess(fen);
  const lines: string[] = [];
  for (let index = 0; index < Math.min(variation.length, 8); index += 1) {
    const moveNumber = chess.moveNumber();
    const turn = chess.turn();
    const uci = variation[index];
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] || "q",
    });
    if (!move) break;
    lines.push(`${moveNumber}${turn === "w" ? "." : "…"} ${move.san}`);
  }
  return lines;
}

async function explainMove(
  provider: VisionProvider,
  model: string,
  fen: string,
  bestMove: string,
  evaluation: string,
  variation: string[],
): Promise<string> {
  try {
    return await provider.generateContent({
      model,
      temperature: 0.35,
      maxTokens: 150,
      timeoutMs: 20_000,
      systemPrompt:
        "You are a friendly chess coach. Explain the engine move accurately in one to three short sentences. Do not invent tactics not supported by the supplied line.",
      userParts: [
        {
          type: "text",
          text: `FEN: ${fen}\nBest move: ${bestMove}\nEvaluation: ${evaluation}\nEngine line: ${variation.join(" ")}`,
        },
      ],
    });
  } catch {
    return `${bestMove} is Stockfish's top choice for this position. Follow the suggested continuation while watching for your opponent's reply.`;
  }
}

export async function analyzeCapturedImage(
  image: Blob,
  settings: AppSettings,
  side: SideToMove,
  castlingRights: CastlingRights,
  modelOverride?: string,
  onStage?: (stage: ProgressStage) => void,
): Promise<AnalysisResult> {
  const apiKey = loadApiKey(settings.provider, window.localStorage);
  if (!apiKey) {
    const providerName = settings.provider === "gemini" ? "Google Gemini" : "OpenRouter";
    throw new Error(`Add an ${providerName} API key in Settings before analyzing a board.`);
  }
  const provider = getVisionProvider(settings.provider, apiKey);
  const model = modelOverride || settings.model;
  const startedAt = performance.now();

  onStage?.("reading-position");
  const visionStarted = performance.now();
  const vision = await recognizePosition(
    image,
    model,
    side,
    provider,
    castlingRights,
    settings,
    () => onStage?.("validating-position"),
  );
  const visionMs = Math.round(performance.now() - visionStarted);

  onStage?.("calculating-move");
  const engineStarted = performance.now();
  const engine = await analyzeWithStockfish(vision.fen, settings.depth);
  const engineMs = Math.round(performance.now() - engineStarted);

  const position = new Chess(vision.fen);
  const movePosition = new Chess(vision.fen);
  const bestMove = uciToMove(movePosition, engine.bestMove);
  const variation = pvToSan(vision.fen, engine.principalVariation);
  const evaluationDisplay =
    engine.score.kind === "mate"
      ? `${engine.score.value < 0 ? "-" : ""}M${Math.abs(engine.score.value)}`
      : `${engine.score.value >= 0 ? "+" : ""}${(engine.score.value / 100).toFixed(1)}`;

  onStage?.("preparing-explanation");
  const explanationStarted = performance.now();
  const explanation = await explainMove(
    provider,
    model,
    vision.fen,
    bestMove.san,
    evaluationDisplay,
    variation,
  );
  const explanationMs = Math.round(performance.now() - explanationStarted);

  return {
    fen: vision.fen,
    board: boardFromChess(position),
    orientation: vision.orientation ?? side,
    sideToMove: side,
    bestMove,
    evaluation: {
      kind: engine.score.kind,
      value: engine.score.value,
      display: evaluationDisplay,
      label:
        engine.score.kind === "mate"
          ? "Mate"
          : Math.abs(engine.score.value) < 50
            ? "Even"
            : engine.score.value > 0
              ? "Winning"
              : "Under pressure",
    },
    explanation,
    principalVariation: variation,
    confidence: vision.confidence ?? "medium",
    notes: vision.notes ?? "",
    timings: {
      captureMs: 0,
      visionMs,
      engineMs,
      explanationMs,
      totalMs: Math.round(performance.now() - startedAt),
    },
  };
}
