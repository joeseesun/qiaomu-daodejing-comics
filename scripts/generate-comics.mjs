import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import data from "../src/data/daodejing.generated.json" with { type: "json" };

const GENERATOR = "/Users/joe/.agents/skills/qiaomu-universal-image-prompts/scripts/generate_image.py";
const OUT_DIR = "public/comics";

function parseArgs(argv) {
  const options = {
    chapter: null,
    start: 0,
    limit: 3,
    force: false,
    dryRun: false,
    provider: "hiapi",
    model: process.env.HIAPI_IMAGE_MODEL || "gpt-image-2"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--chapter") options.chapter = Number(argv[++index]);
    else if (arg === "--start") options.start = Number(argv[++index]);
    else if (arg === "--limit") {
      const raw = argv[++index];
      options.limit = raw === "all" ? Infinity : Number(raw);
    } else if (arg === "--force") options.force = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--provider") options.provider = argv[++index];
    else if (arg === "--model") options.model = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(options.start) || options.start < 0) {
    throw new Error("--start must be a non-negative number");
  }
  if (options.limit !== Infinity && (!Number.isFinite(options.limit) || options.limit < 1)) {
    throw new Error("--limit must be a positive number or all");
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

function runGenerator(card, imagePath, options) {
  const args = [
    GENERATOR,
    "--provider",
    options.provider,
    "--model",
    options.model,
    "--ar",
    "16:9",
    "--quality",
    "medium",
    "--prompt",
    card.imagePrompt,
    "--image",
    imagePath
  ];

  console.log(`Using ${options.provider} / ${options.model}`);
  console.log(`Generating ${card.id}: ${card.sentence}`);

  return new Promise((resolve, reject) => {
    const child = spawn("python3", args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Generator exited with code ${code}`));
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cards = allCards(options.chapter).slice(options.start, options.limit === Infinity ? undefined : options.start + options.limit);

  if (!cards.length) {
    throw new Error("No cards selected.");
  }

  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Selected ${cards.length} card(s). Output: ${OUT_DIR}`);

  for (const card of cards) {
    const imagePath = path.join("public", card.image.replace(/^\//, ""));
    if (!options.force && (await exists(imagePath))) {
      console.log(`Skipping existing ${imagePath}`);
      continue;
    }
    if (options.dryRun) {
      console.log(`[dry-run] ${imagePath}\n${card.imagePrompt}\n`);
      continue;
    }
    await runGenerator(card, imagePath, options);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
