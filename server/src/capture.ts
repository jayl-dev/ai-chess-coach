import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_CAPTURE_BYTES = 30 * 1024 * 1024;

export class CaptureError extends Error {
  constructor(
    message: string,
    public readonly code: "capture-failed" | "capture-unsupported",
  ) {
    super(message);
    this.name = "CaptureError";
  }
}

const windowsCaptureScript = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
  $graphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bounds.Size)
  $bitmap.Save($env:CHESS_COACH_CAPTURE_PATH, [System.Drawing.Imaging.ImageFormat]::Jpeg)
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}
`;

async function runPlatformCapture(outputPath: string): Promise<void> {
  const options = {
    timeout: 15_000,
    windowsHide: true,
    env: { ...process.env, CHESS_COACH_CAPTURE_PATH: outputPath },
  };

  if (process.platform === "win32") {
    await execFileAsync(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-WindowStyle",
        "Hidden",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        windowsCaptureScript,
      ],
      options,
    );
    return;
  }

  if (process.platform === "darwin") {
    await execFileAsync("screencapture", ["-x", "-t", "jpg", outputPath], options);
    return;
  }

  throw new CaptureError(
    "Host screenshots are currently supported on Windows and macOS.",
    "capture-unsupported",
  );
}

export async function captureHostScreen(): Promise<Buffer> {
  const captureDirectory = await mkdtemp(join(tmpdir(), "chess-coach-capture-"));
  const outputPath = join(captureDirectory, "screen.jpg");

  try {
    await runPlatformCapture(outputPath);
    const fileStats = await stat(outputPath);
    if (!fileStats.size || fileStats.size > MAX_CAPTURE_BYTES) {
      throw new CaptureError("The captured screenshot was empty or too large.", "capture-failed");
    }
    return await readFile(outputPath);
  } catch (error) {
    if (error instanceof CaptureError) throw error;
    const detail = error instanceof Error ? error.message : "Unknown capture error.";
    throw new CaptureError(`The host could not capture its screen. ${detail}`, "capture-failed");
  } finally {
    await rm(captureDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}
