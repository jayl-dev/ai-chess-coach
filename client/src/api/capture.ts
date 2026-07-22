import type { PairedHost } from "../state/host";
import { fetchWithLocalNetworkAccess } from "./host";

export type CapturedImage = {
  blob: Blob;
  width: number;
  height: number;
};

const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.86;

export class CaptureRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "CaptureRequestError";
  }
}

function scaledSize(width: number, height: number) {
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the captured image."))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

async function drawSource(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): Promise<CapturedImage> {
  const size = scaledSize(sourceWidth, sourceHeight);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot prepare the captured image.");
  context.drawImage(source, 0, 0, size.width, size.height);
  return { blob: await canvasToJpeg(canvas), ...size };
}

export async function normalizeImage(blob: Blob): Promise<CapturedImage> {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    try {
      return await drawSource(bitmap, bitmap.width, bitmap.height);
    } finally {
      bitmap.close();
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return await drawSource(image, image.naturalWidth, image.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function captureVideoFrame(video: HTMLVideoElement): Promise<CapturedImage> {
  if (
    !video.videoWidth ||
    !video.videoHeight ||
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
  ) {
    throw new Error("The camera is not ready yet.");
  }
  return drawSource(video, video.videoWidth, video.videoHeight);
}

export async function captureHostScreenshot(
  host: PairedHost,
  signal?: AbortSignal,
): Promise<CapturedImage> {
  const response = await fetchWithLocalNetworkAccess(`${host.baseUrl}/api/capture/screenshot`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${host.token}`,
      "X-Chess-Coach-Request": "capture",
    },
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    let message = `Screenshot capture failed with status ${response.status}.`;
    try {
      const body = (await response.json()) as { error?: { message?: unknown } };
      if (typeof body.error?.message === "string") message = body.error.message;
    } catch {
      // Keep the HTTP status fallback.
    }
    throw new CaptureRequestError(message, response.status);
  }
  return normalizeImage(await response.blob());
}
