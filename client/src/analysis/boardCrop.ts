import type { CapturedImage } from "../api/capture";
import { initializeOpenCv } from "./opencv";

export type BoardCropResult = {
  image: CapturedImage;
  cropped: boolean;
  confidence: number;
};

type OpenCv = Awaited<ReturnType<typeof initializeOpenCv>>;
export type BoardPoint = { x: number; y: number };
export type BoardQuad = [BoardPoint, BoardPoint, BoardPoint, BoardPoint];
export type BoardDetection = {
  corners: BoardQuad;
  confidence: number;
  width: number;
  height: number;
};
type Point = BoardPoint;
type Quad = BoardQuad;
type DetectedBoard = { corners: Quad; confidence: number };
type LoadedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

const DETECTION_EDGE = 900;
const OUTPUT_EDGE = 1024;
const MIN_BOARD_AREA = 0.08;
const MIN_CONFIDENCE = 0.46;
const CROP_JPEG_QUALITY = 0.82;

async function loadImage(blob: Blob): Promise<LoadedImage> {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(blob);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  }

  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  };
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the board crop."))),
      "image/jpeg",
      CROP_JPEG_QUALITY,
    );
  });
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function orderCorners(points: Point[]): Quad | null {
  if (points.length !== 4) return null;
  const center = points.reduce(
    (sum, point) => ({ x: sum.x + point.x / 4, y: sum.y + point.y / 4 }),
    { x: 0, y: 0 },
  );
  const ordered = [...points].sort(
    (a, b) =>
      Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x),
  );
  const topLeft = ordered.reduce(
    (best, point, index) => (point.x + point.y < ordered[best].x + ordered[best].y ? index : best),
    0,
  );
  return [...ordered.slice(topLeft), ...ordered.slice(0, topLeft)] as Quad;
}

function sampleLuminance(pixels: ImageData, point: Point): number {
  const x = Math.max(0, Math.min(pixels.width - 1, Math.round(point.x)));
  const y = Math.max(0, Math.min(pixels.height - 1, Math.round(point.y)));
  const offset = (y * pixels.width + x) * 4;
  return (
    pixels.data[offset] * 0.299 + pixels.data[offset + 1] * 0.587 + pixels.data[offset + 2] * 0.114
  );
}

function pointInQuad(corners: Quad, u: number, v: number): Point {
  const top = {
    x: corners[0].x + (corners[1].x - corners[0].x) * u,
    y: corners[0].y + (corners[1].y - corners[0].y) * u,
  };
  const bottom = {
    x: corners[3].x + (corners[2].x - corners[3].x) * u,
    y: corners[3].y + (corners[2].y - corners[3].y) * u,
  };
  return {
    x: top.x + (bottom.x - top.x) * v,
    y: top.y + (bottom.y - top.y) * v,
  };
}

function checkerboardScore(pixels: ImageData, corners: Quad): number {
  const even: number[] = [];
  const odd: number[] = [];
  const offsets = [0.15, 0.85];

  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      let total = 0;
      for (const yOffset of offsets) {
        for (const xOffset of offsets) {
          total += sampleLuminance(
            pixels,
            pointInQuad(corners, (file + xOffset) / 8, (rank + yOffset) / 8),
          );
        }
      }
      ((rank + file) % 2 === 0 ? even : odd).push(total / 4);
    }
  }

  const evenMean = even.reduce((sum, value) => sum + value, 0) / even.length;
  const oddMean = odd.reduce((sum, value) => sum + value, 0) / odd.length;
  const contrast = Math.abs(evenMean - oddMean);
  if (contrast < 8) return 0;

  let matches = 0;
  for (const [index, value] of [...even, ...odd].entries()) {
    const expected = index < even.length ? evenMean : oddMean;
    const opposite = index < even.length ? oddMean : evenMean;
    if (Math.abs(value - expected) < Math.abs(value - opposite)) matches += 1;
  }

  return Math.min(1, contrast / 58) * 0.52 + (matches / 64) * 0.48;
}

function readQuad(approximation: InstanceType<OpenCv["Mat"]>): Quad | null {
  const values = approximation.data32S;
  const points: Point[] = [];
  for (let index = 0; index < values.length; index += 2) {
    points.push({ x: values[index], y: values[index + 1] });
  }
  return orderCorners(points);
}

function findBoardWithOpenCv(cv: OpenCv, canvas: HTMLCanvasElement): DetectedBoard | null {
  const source = cv.imread(canvas);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const closed = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
  const pixels = canvas
    .getContext("2d", { willReadFrequently: true })
    ?.getImageData(0, 0, canvas.width, canvas.height);

  try {
    if (!pixels) return null;
    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
    cv.Canny(blurred, edges, 40, 125);
    cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel);
    cv.dilate(closed, closed, kernel, new cv.Point(-1, -1), 1);
    cv.findContours(closed, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const imageArea = canvas.width * canvas.height;
    let best: DetectedBoard | null = null;

    for (let index = 0; index < contours.size(); index += 1) {
      const contour = contours.get(index);
      const approximation = new cv.Mat();
      try {
        const areaRatio = Math.abs(cv.contourArea(contour)) / imageArea;
        if (areaRatio < MIN_BOARD_AREA || areaRatio > 0.98) continue;
        const perimeter = cv.arcLength(contour, true);
        cv.approxPolyDP(contour, approximation, perimeter * 0.025, true);
        if (approximation.rows !== 4 || !cv.isContourConvex(approximation)) continue;

        const corners = readQuad(approximation);
        if (!corners) continue;
        const horizontal =
          (distance(corners[0], corners[1]) + distance(corners[3], corners[2])) / 2;
        const vertical = (distance(corners[0], corners[3]) + distance(corners[1], corners[2])) / 2;
        const ratio = horizontal / Math.max(1, vertical);
        if (ratio < 0.55 || ratio > 1.8) continue;

        const pattern = checkerboardScore(pixels, corners);
        const shapeScore = 1 - Math.min(1, Math.abs(Math.log(ratio)) / 0.6);
        const confidence = pattern * 0.78 + shapeScore * 0.12 + Math.min(1, areaRatio / 0.5) * 0.1;
        if (!best || confidence > best.confidence) best = { corners, confidence };
      } finally {
        approximation.delete();
        contour.delete();
      }
    }
    return best;
  } finally {
    kernel.delete();
    hierarchy.delete();
    contours.delete();
    closed.delete();
    edges.delete();
    blurred.delete();
    gray.delete();
    source.delete();
  }
}

export async function detectChessboardInCanvas(
  canvas: HTMLCanvasElement,
): Promise<BoardDetection | null> {
  const cv = await initializeOpenCv();
  const detected = findBoardWithOpenCv(cv, canvas);
  return detected
    ? {
        ...detected,
        width: canvas.width,
        height: canvas.height,
      }
    : null;
}

function scaleAndExpandQuad(corners: Quad, scale: number, width: number, height: number): Quad {
  const fullSize = corners.map((point) => ({ x: point.x / scale, y: point.y / scale })) as Quad;
  const center = fullSize.reduce(
    (sum, point) => ({ x: sum.x + point.x / 4, y: sum.y + point.y / 4 }),
    { x: 0, y: 0 },
  );
  return fullSize.map((point) => ({
    x: Math.max(0, Math.min(width - 1, center.x + (point.x - center.x) * 1.01)),
    y: Math.max(0, Math.min(height - 1, center.y + (point.y - center.y) * 1.01)),
  })) as Quad;
}

async function warpBoard(
  cv: OpenCv,
  loaded: LoadedImage,
  detectedCorners: Quad,
  detectionScale: number,
): Promise<CapturedImage> {
  const corners = scaleAndExpandQuad(detectedCorners, detectionScale, loaded.width, loaded.height);
  const longestSide = Math.max(
    distance(corners[0], corners[1]),
    distance(corners[1], corners[2]),
    distance(corners[2], corners[3]),
    distance(corners[3], corners[0]),
  );
  const outputSize = Math.min(OUTPUT_EDGE, Math.max(256, Math.round(longestSide)));

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = loaded.width;
  sourceCanvas.height = loaded.height;
  sourceCanvas.getContext("2d")?.drawImage(loaded.source, 0, 0, loaded.width, loaded.height);
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = outputSize;
  outputCanvas.height = outputSize;

  const source = cv.imread(sourceCanvas);
  const corrected = new cv.Mat();
  const sourcePoints = cv.matFromArray(
    4,
    1,
    cv.CV_32FC2,
    corners.flatMap((point) => [point.x, point.y]),
  );
  const destinationPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    outputSize - 1,
    0,
    outputSize - 1,
    outputSize - 1,
    0,
    outputSize - 1,
  ]);
  const transform = cv.getPerspectiveTransform(sourcePoints, destinationPoints);

  try {
    cv.warpPerspective(
      source,
      corrected,
      transform,
      new cv.Size(outputSize, outputSize),
      cv.INTER_LINEAR,
      cv.BORDER_REPLICATE,
    );
    cv.imshow(outputCanvas, corrected);
    return { blob: await canvasToJpeg(outputCanvas), width: outputSize, height: outputSize };
  } finally {
    transform.delete();
    destinationPoints.delete();
    sourcePoints.delete();
    corrected.delete();
    source.delete();
  }
}

export async function autoCropChessboard(image: CapturedImage): Promise<BoardCropResult> {
  const loaded = await loadImage(image.blob);
  try {
    const cv = await initializeOpenCv();
    const scale = Math.min(1, DETECTION_EDGE / Math.max(loaded.width, loaded.height));
    const detectionCanvas = document.createElement("canvas");
    detectionCanvas.width = Math.max(1, Math.round(loaded.width * scale));
    detectionCanvas.height = Math.max(1, Math.round(loaded.height * scale));
    const context = detectionCanvas.getContext("2d", { willReadFrequently: true });
    if (!context) return { image, cropped: false, confidence: 0 };
    context.drawImage(loaded.source, 0, 0, detectionCanvas.width, detectionCanvas.height);

    const detected = findBoardWithOpenCv(cv, detectionCanvas);
    if (!detected || detected.confidence < MIN_CONFIDENCE) {
      return { image, cropped: false, confidence: detected?.confidence ?? 0 };
    }

    return {
      image: await warpBoard(cv, loaded, detected.corners, scale),
      cropped: true,
      confidence: Math.min(1, detected.confidence),
    };
  } catch {
    return { image, cropped: false, confidence: 0 };
  } finally {
    loaded.release();
  }
}
