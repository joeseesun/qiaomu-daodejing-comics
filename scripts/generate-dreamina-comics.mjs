import { access, appendFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import data from "../src/data/daodejing.generated.json" with { type: "json" };

const OUT_DIR = "public/comics";
const LOG_FILE = path.join("public", "comics", "dreamina-generation.jsonl");

function parseArgs(argv) {
  const options = {
    chapter: null,
    start: 0,
    limit: 3,
    force: false,
    concurrency: 2,
    modelVersion: "5.0",
    ratio: "16:9",
    resolutionType: "2k",
    poll: 180,
    compress: true,
    maxEdge: 1280,
    continueOnError: false,
    idsFile: null,
    retries: 2,
    retryDelay: 10
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--chapter") options.chapter = Number(argv[++index]);
    else if (arg === "--start") options.start = Number(argv[++index]);
    else if (arg === "--limit") {
      const raw = argv[++index];
      options.limit = raw === "all" ? Infinity : Number(raw);
    } else if (arg === "--force") options.force = true;
    else if (arg === "--concurrency") options.concurrency = Number(argv[++index]);
    else if (arg === "--model_version") options.modelVersion = argv[++index];
    else if (arg === "--ratio") options.ratio = argv[++index];
    else if (arg === "--resolution_type") options.resolutionType = argv[++index];
    else if (arg === "--poll") options.poll = Number(argv[++index]);
    else if (arg === "--no-compress") options.compress = false;
    else if (arg === "--max-edge") options.maxEdge = Number(argv[++index]);
    else if (arg === "--continue-on-error") options.continueOnError = true;
    else if (arg === "--ids-file") options.idsFile = argv[++index];
    else if (arg === "--retries") options.retries = Number(argv[++index]);
    else if (arg === "--retry-delay") options.retryDelay = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(options.start) || options.start < 0) throw new Error("--start must be a non-negative number");
  if (options.limit !== Infinity && (!Number.isFinite(options.limit) || options.limit < 1)) {
    throw new Error("--limit must be a positive number or all");
  }
  if (!Number.isFinite(options.concurrency) || options.concurrency < 1) {
    throw new Error("--concurrency must be a positive number");
  }
  if (!Number.isFinite(options.maxEdge) || options.maxEdge < 1) {
    throw new Error("--max-edge must be a positive number");
  }
  if (!Number.isFinite(options.retries) || options.retries < 0) {
    throw new Error("--retries must be a non-negative number");
  }
  if (!Number.isFinite(options.retryDelay) || options.retryDelay < 0) {
    throw new Error("--retry-delay must be a non-negative number");
  }

  return options;
}

function allCards(chapterFilter) {
  return data.chapters
    .filter((chapter) => !chapterFilter || chapter.chapter === chapterFilter)
    .flatMap((chapter) =>
      chapter.sentences.map((sentence) => ({
        chapter: chapter.chapter,
        chapterTitle: chapter.title,
        ...sentence
      }))
    );
}

async function exists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function extractJson(output) {
  const trimmed = output.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON object found in Dreamina output: ${trimmed.slice(0, 400)}`);
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

function runDreamina(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("dreamina", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const output = `${stdout}\n${stderr}`;
      if (code === 0) resolve(output);
      else reject(new Error(`dreamina exited with code ${code}: ${output}`));
    });
  });
}

async function queryUntilDone(submitId, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const output = await runDreamina(["query_result", `--submit_id=${submitId}`]);
    const result = extractJson(output);
    if (result.gen_status === "success" || result.gen_status === "fail") return result;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`Timed out waiting for ${submitId}`);
}

async function downloadImage(url, imagePath) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(imagePath, bytes);
  } catch (error) {
    await runCommand("curl", [
      "--http1.1",
      "-L",
      "--fail",
      "--retry",
      "5",
      "--retry-all-errors",
      "--retry-delay",
      "3",
      "--connect-timeout",
      "20",
      "--max-time",
      "240",
      url,
      "-o",
      imagePath
    ]);
  }
}

async function appendLog(entry) {
  await appendFile(LOG_FILE, `${JSON.stringify({ time: new Date().toISOString(), ...entry })}\n`);
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

async function compressImage(imagePath, maxEdge) {
  const before = (await stat(imagePath)).size;
  const resizedPath = `${imagePath}.resized.png`;
  const compressedPath = `${imagePath}.compressed.png`;

  await runCommand("sips", ["-Z", String(maxEdge), imagePath, "--out", resizedPath]);
  try {
    await runCommand("pngquant", ["--quality=68-88", "--speed=1", "--strip", "--force", "--output", compressedPath, resizedPath]);
    const after = (await stat(compressedPath)).size;
    if (after < before) {
      await rename(compressedPath, imagePath);
      await rm(resizedPath, { force: true });
      return { before, after };
    }
    await rm(compressedPath, { force: true });
    await rename(resizedPath, imagePath);
    const resized = (await stat(imagePath)).size;
    return { before, after: resized };
  } catch (error) {
    await rm(compressedPath, { force: true });
    await rename(resizedPath, imagePath);
    const resized = (await stat(imagePath)).size;
    return { before, after: resized, warning: error.message };
  }
}

async function generateCard(card, options) {
  const imagePath = path.join("public", card.image.replace(/^\//, ""));
  if (!options.force && (await exists(imagePath))) {
    console.log(`skip ${card.id} existing ${imagePath}`);
    return { id: card.id, status: "skipped", imagePath };
  }

  console.log(`generate ${card.id} 第${card.chapter}章 ${card.sentence}`);
  const output = await runDreamina([
    "text2image",
    `--prompt=${card.imagePrompt}`,
    `--ratio=${options.ratio}`,
    `--model_version=${options.modelVersion}`,
    `--resolution_type=${options.resolutionType}`,
    `--poll=${options.poll}`
  ]);
  let result = extractJson(output);
  if (result.gen_status === "querying" && result.submit_id) result = await queryUntilDone(result.submit_id);
  if (result.gen_status !== "success") {
    throw new Error(`Dreamina failed for ${card.id}: ${result.fail_reason || JSON.stringify(result)}`);
  }

  const imageUrl = result.result_json?.images?.[0]?.image_url;
  if (!imageUrl) throw new Error(`Dreamina success without image_url for ${card.id}`);
  await downloadImage(imageUrl, imagePath);
  const compression = options.compress ? await compressImage(imagePath, options.maxEdge) : null;
  await appendLog({
    id: card.id,
    sentence: card.sentence,
    submit_id: result.submit_id,
    imagePath,
    width: result.result_json.images[0].width,
    height: result.result_json.images[0].height,
    compressed: Boolean(compression),
    compressedBytes: compression?.after,
    originalBytes: compression?.before,
    compressionWarning: compression?.warning
  });
  const compressionText = compression
    ? ` compressed ${(compression.before / 1024).toFixed(0)}KB -> ${(compression.after / 1024).toFixed(0)}KB`
    : "";
  console.log(`saved ${card.id} -> ${imagePath}${compressionText}`);
  return { id: card.id, status: "saved", imagePath };
}

function isRetryableError(error) {
  return /EOF|Client\.Timeout|context deadline exceeded|connection reset|SSL_ERROR|HTTP2|curl exited|final generation failed/i.test(error.message);
}

async function generateCardWithRetry(card, options) {
  let lastError;
  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    try {
      if (attempt > 0) console.log(`retry ${card.id} attempt ${attempt + 1}/${options.retries + 1}`);
      return await generateCard(card, options);
    } catch (error) {
      lastError = error;
      if (attempt >= options.retries || !isRetryableError(error)) break;
      await appendLog({ id: card.id, status: "retry", attempt: attempt + 1, error: error.message });
      await new Promise((resolve) => setTimeout(resolve, options.retryDelay * 1000));
    }
  }
  throw lastError;
}

async function runQueue(cards, options) {
  let cursor = 0;
  let saved = 0;
  let skipped = 0;
  let failed = 0;

  async function worker() {
    while (cursor < cards.length) {
      const card = cards[cursor];
      cursor += 1;
      try {
        const result = await generateCardWithRetry(card, options);
        if (result.status === "saved") saved += 1;
        if (result.status === "skipped") skipped += 1;
      } catch (error) {
        await appendLog({ id: card.id, status: "error", error: error.message });
        failed += 1;
        if (options.continueOnError) {
          console.error(`failed ${card.id}: ${error.message}`);
          continue;
        }
        throw error;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(options.concurrency, cards.length) }, () => worker()));
  return { saved, skipped, failed };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let cards = allCards(options.chapter);
  if (options.idsFile) {
    const ids = new Set(JSON.parse(await readFile(options.idsFile, "utf8")));
    cards = cards.filter((card) => ids.has(card.id));
  }
  cards = cards.slice(options.start, options.limit === Infinity ? undefined : options.start + options.limit);
  if (!cards.length) throw new Error("No cards selected.");

  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Selected ${cards.length} card(s), concurrency=${options.concurrency}, output=${OUT_DIR}`);
  const result = await runQueue(cards, options);
  console.log(`Done. saved=${result.saved}, skipped=${result.skipped}, failed=${result.failed}, log=${LOG_FILE}`);
  if (result.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
