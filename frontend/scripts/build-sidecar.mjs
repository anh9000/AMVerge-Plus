import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";

const isWindows = process.platform === "win32";
const isMac = process.platform === "darwin";

function getTargetTriple() {
  const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
  if (isWindows) return `${arch}-pc-windows-msvc`;
  if (isMac) return `${arch}-apple-darwin`;
  return `${arch}-unknown-linux-gnu`;
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${cmd} exited with code ${result.status}`);
  }
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const frontendDir = path.resolve(scriptDir, "..");
  const repoRoot = path.resolve(frontendDir, "..");
  const backendDir = path.join(repoRoot, "backend");
  const targetTriple = getTargetTriple();

  const pythonExe = isWindows
    ? path.join(backendDir, "venv", "Scripts", "python.exe")
    : path.join(backendDir, "venv", "bin", "python");

  const ffmpegName = isWindows ? "ffmpeg.exe" : "ffmpeg";
  const ffprobeName = isWindows ? "ffprobe.exe" : "ffprobe";
  const binarySep = isWindows ? ";" : ":";
  const exeName = isWindows ? "backend_script.exe" : "backend_script";

  const distDir = path.join(backendDir, "dist", "backend_script");
  const tauriSidecarDir = path.join(
    frontendDir,
    "src-tauri",
    "bin",
    `backend_script-${targetTriple}`
  );

  await fs.rm(distDir, { recursive: true, force: true });

  run(
    pythonExe,
    [
      "-m",
      "PyInstaller",
      "app.py",
      "--onedir",
      "--noconsole",
      "--clean",
      "--noconfirm",
      "--name",
      "backend_script",
      "--add-binary",
      `bin/${ffmpegName}${binarySep}.`,
      "--add-binary",
      `bin/${ffprobeName}${binarySep}.`,
    ],
    { cwd: backendDir }
  );

  await fs.rm(tauriSidecarDir, { recursive: true, force: true });
  await fs.mkdir(tauriSidecarDir, { recursive: true });
  await fs.cp(distDir, tauriSidecarDir, { recursive: true });

  const exePath = path.join(tauriSidecarDir, exeName);
  const baseLib = path.join(tauriSidecarDir, "_internal", "base_library.zip");

  try {
    const exeStat = await fs.stat(exePath);
    if (!exeStat.isFile()) throw new Error(`${exeName} is not a file`);
    const baseStat = await fs.stat(baseLib);
    if (!baseStat.isFile()) throw new Error("base_library.zip is not a file");
  } catch {
    throw new Error(
      `Sidecar sync finished, but required files are missing. Expected ${exePath} and ${baseLib}.`
    );
  }

  console.log(`Sidecar built for ${targetTriple}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
