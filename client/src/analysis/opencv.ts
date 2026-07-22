type OpenCv = typeof import("@techstark/opencv-js");

let openCvPromise: Promise<OpenCv> | null = null;

function isPromise(value: unknown): value is Promise<unknown> {
  return Boolean(value) && typeof (value as { then?: unknown }).then === "function";
}

export function initializeOpenCv(): Promise<OpenCv> {
  if (!openCvPromise) {
    openCvPromise = import("@techstark/opencv-js").then(async (module) => {
      let runtime: unknown = (module as { default?: unknown }).default ?? module;
      if (isPromise(runtime)) runtime = await runtime;

      const candidate = runtime as Partial<OpenCv> & { onRuntimeInitialized?: () => void };
      if (candidate.Mat) return candidate as OpenCv;

      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(
          () => reject(new Error("OpenCV.js initialization timed out.")),
          20_000,
        );
        candidate.onRuntimeInitialized = () => {
          window.clearTimeout(timeout);
          resolve();
        };
      });

      if (!candidate.Mat) throw new Error("OpenCV.js loaded without its image-processing runtime.");
      return candidate as OpenCv;
    });
  }
  return openCvPromise;
}
