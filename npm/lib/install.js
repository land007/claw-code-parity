const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const https = require("https");
const tar = require("tar");

const VERSION = "v0.1.4";
const REPO = process.env.CLAW_REPO || "land007/claw-code-parity";

function platformSlug() {
  switch (process.platform) {
    case "linux":
      return "linux";
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

function archSlug() {
  switch (process.arch) {
    case "x64":
      return "x86_64";
    case "arm64":
      return "arm64";
    default:
      throw new Error(`Unsupported architecture: ${process.arch}`);
  }
}

function assetName() {
  const osSlug = platformSlug();
  const cpuSlug = archSlug();
  if (osSlug === "windows") {
    return `claw-${VERSION}-windows-${cpuSlug}.zip`;
  }
  return `claw-${VERSION}-${osSlug}-${cpuSlug}.tar.gz`;
}

function binaryName() {
  return process.platform === "win32" ? "claw.exe" : "claw";
}

function cacheDir() {
  return path.join(os.homedir(), ".cache", "claw", VERSION, `${platformSlug()}-${archSlug()}`);
}

function binaryPath() {
  return path.join(cacheDir(), binaryName());
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          fs.rmSync(dest, { force: true });
          return resolve(download(response.headers.location, dest));
        }
        if (response.statusCode !== 200) {
          file.close();
          fs.rmSync(dest, { force: true });
          return reject(new Error(`Download failed: ${response.statusCode} ${response.statusMessage}`));
        }
        response.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", (error) => {
        file.close();
        fs.rmSync(dest, { force: true });
        reject(error);
      });
  });
}

async function ensureInstalled() {
  const bin = binaryPath();
  if (fs.existsSync(bin)) return bin;

  const dir = cacheDir();
  fs.mkdirSync(dir, { recursive: true });
  const asset = assetName();
  const url = `https://github.com/${REPO}/releases/download/${VERSION}/${asset}`;
  const archivePath = path.join(dir, asset);

  await download(url, archivePath);

  if (archivePath.endsWith(".tar.gz")) {
    await tar.x({ file: archivePath, cwd: dir });
  } else {
    const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", `Expand-Archive -Path "${archivePath}" -DestinationPath "${dir}" -Force`], {
      stdio: "inherit"
    });
    if (result.status !== 0) {
      throw new Error("Failed to extract Windows archive");
    }
  }

  const extractedDir = fs
    .readdirSync(dir, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name.startsWith("claw-"));
  if (!extractedDir) {
    throw new Error("Downloaded archive did not contain an extracted bundle directory");
  }
  const extractedBinary = path.join(dir, extractedDir.name, binaryName());
  if (!fs.existsSync(extractedBinary)) {
    throw new Error("Downloaded archive did not contain the claw binary");
  }
  fs.copyFileSync(extractedBinary, bin);
  if (process.platform !== "win32") {
    fs.chmodSync(bin, 0o755);
  }
  return bin;
}

async function installAndRun(args) {
  const bin = await ensureInstalled();
  const result = spawnSync(bin, args, { stdio: "inherit" });
  process.exit(result.status === null ? 1 : result.status);
}

module.exports = { installAndRun };
