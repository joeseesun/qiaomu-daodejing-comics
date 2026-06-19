import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const DEFAULT_DIR = path.join("public", "comics");

function parseArgs(argv) {
  const options = {
    maxEdge: 1280,
    targets: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--max-edge") options.maxEdge = Number(argv[++index]);
    else options.targets.push(arg);
  }

  if (!Number.isFinite(options.maxEdge) || options.maxEdge < 1) {
    throw new Error("--max-edge must be a positive number");
  }
  return options;
}

async function collectPngs(targets) {
  const files = [];

  async function visit(target) {
    const info = await stat(target);
    if (info.isDirectory()) {
      const entries = await readdir(target);
      await Promise.all(entries.map((entry) => visit(path.join(target, entry))));
      return;
    }
    if (/\.png$/i.test(target)) files.push(target);
  }

  for (const target of targets.length ? targets : [DEFAULT_DIR]) {
    await visit(target);
  }
  return files;
}

function sipsResize(file, maxEdge) {
  const tempFile = `${file}.resized.png`;
  const args = ["-Z", String(maxEdge), file, "--out", tempFile];

  return new Promise((resolve, reject) => {
    const child = spawn("sips", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`sips resize failed for ${file}: ${stderr.trim()}`));
        return;
      }
      resolve(tempFile);
    });
  });
}

function pngquant(file) {
  const tempFile = `${file}.compressed.png`;
  const args = ["--quality=68-88", "--speed=1", "--strip", "--force", "--output", tempFile, file];

  return new Promise((resolve, reject) => {
    const child = spawn("pngquant", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(`pngquant failed for ${file}: ${stderr.trim()}`));
        return;
      }
      resolve(tempFile);
    });
  });
}

async function fileSize(file) {
  return (await stat(file)).size;
}

async function replaceFile(source, target) {
  const { rename } = await import("node:fs/promises");
  await rename(source, target);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = await collectPngs(options.targets);
  if (!files.length) throw new Error("No PNG files found.");

  let beforeTotal = 0;
  let afterTotal = 0;
  for (const file of files) {
    const before = await fileSize(file);
    const resized = await sipsResize(file, options.maxEdge);
    const compressed = await pngquant(resized);
    const after = await fileSize(compressed);
    if (after < before) {
      await replaceFile(compressed, file);
      beforeTotal += before;
      afterTotal += after;
      console.log(`${file}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`);
    } else {
      const { rm } = await import("node:fs/promises");
      await rm(compressed, { force: true });
      beforeTotal += before;
      afterTotal += before;
      console.log(`${file}: kept original ${(before / 1024).toFixed(0)}KB`);
    }
    const { rm } = await import("node:fs/promises");
    await rm(resized, { force: true });
  }

  const saved = beforeTotal - afterTotal;
  console.log(`Compressed ${files.length} file(s), saved ${(saved / 1024 / 1024).toFixed(2)}MB.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
