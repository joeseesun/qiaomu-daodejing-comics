import { readdir, readFile, writeFile } from "node:fs/promises";
import data from "../src/data/daodejing.generated.json" with { type: "json" };

const PLAN_FILE = "src/data/comic-prompts.json";
const INTERPRETATIONS_DIR = "src/data/interpretations";
const PRESERVE_MANUAL_CHAPTERS = new Set([1, 2]);

const style =
  "Unified style: warm Chinese ink-and-watercolor comic album, thin sepia line art, pale mineral watercolor washes, ivory rice-paper texture, restrained low-saturation palette, soft misty light, no photorealism, no oil painting, no 3D render, no anime style. Same recurring character design whenever people appear: a slim young seeker in blue-gray robe with black topknot, and an elderly guide with long white beard in plain undyed linen robe.";
const negative =
  "no text, no readable letters, no Chinese characters, no calligraphy, no captions, no signs with writing, no numbers, no logos, no watermark, no stamp, no seal, no speech bubbles, no decorative border, no panel borders inside the image, no split-screen, no collage, no multiple comic panels in one image, no empty side margins, no distorted hands";
const compactStyle =
  "warm Chinese ink-and-watercolor comic, thin sepia line art, pale mineral washes, ivory rice-paper texture, soft mist, restrained low-saturation palette";
const compactNegative =
  "no readable writing, no captions, no logos, no watermark, no split panels";

const accents = [
  "mist gold",
  "river blue-gray",
  "bamboo green",
  "warm clay ochre",
  "willow gold",
  "dawn pearl",
  "tea brown",
  "moon jade",
  "reed silver",
  "soft cinnabar",
  "ash lavender",
  "rain-washed teal",
  "smoke umber",
  "quiet plum",
  "pine shadow green",
  "lamp amber",
  "cloud white",
  "stone gray"
];

const cameras = [
  "wide establishing shot with one path carrying the eye across the frame",
  "medium scene focused on hands, gesture, and one decisive object",
  "low foreground view with the characters small beyond the object",
  "quiet long shot where landscape movement carries the lesson",
  "balanced courtyard composition with the action slightly off-center",
  "diagonal river or road composition leading into the next beat",
  "intimate close scene with soft background figures",
  "panoramic village scene with one simple focal action",
  "over-shoulder view from behind the seeker toward the event",
  "high-angle view of people moving through a shared space",
  "near-symmetrical composition broken by one natural detail",
  "deep perspective through gate, bridge, trees, or mist",
  "close foreground still life with people acting in the distance",
  "side-on frieze-like village movement, still one full image",
  "calm dusk silhouette with a clear foreground symbol",
  "sunlit interior opening onto a wider landscape",
  "rain-softened scene with ripples and reflections",
  "moonlit long shot with small figures and a luminous focal point"
];

const chapterRoutes = [
  ["mountain pass", "village lane", "river bend", "courtyard", "night garden"],
  ["market gate", "schoolyard", "workshop", "field path", "quiet bridge"],
  ["harbor path", "grain yard", "tea stall", "orchard", "old shrine"],
  ["bamboo grove", "ferry dock", "hearth room", "irrigation bank", "moonlit hill"],
  ["desert road", "well courtyard", "cloth market", "pine slope", "cloud terrace"],
  ["rainy street", "granary", "smithy", "reed marsh", "starry field"]
];

const themeBanks = {
  language: {
    settings: ["mirror workshop", "silent archive", "maskmaker room", "open pavilion of echoes", "stone courtyard of reflections"],
    subjects: ["blank mask beside real faces", "unmarked clay tokens in open palms", "empty picture frame around living scenery", "bronze mirror catching changing light", "sealed scroll left unopened"],
    actions: [
      "a face changes in reflections as the seeker lowers a naming brush",
      "tokens are set aside so people can meet without rank",
      "a frame is lifted away and the landscape continues beyond it",
      "the mirror shows sky, water, and face as one passing glimmer",
      "an unopened scroll rests beside a living branch that keeps growing"
    ]
  },
  desire: {
    settings: ["market edge at sunset", "quiet storehouse doorway", "plain kitchen near a lamp", "empty granary path", "tea stall after customers leave"],
    subjects: ["closed coin pouch beside a rice bowl", "bright jewel turned face-down", "plain cup beside ornate cup", "basket holding only enough grain", "locked chest ignored near an open window"],
    actions: [
      "the seeker steps away from glitter while children share a simple meal",
      "a merchant covers a jewel and the room becomes calmer",
      "hands choose the plain cup while steam rises from tea",
      "grain is measured fairly and the unused excess remains untouched",
      "wind from the open window pulls attention away from the chest"
    ]
  },
  governance: {
    settings: ["village meeting courtyard", "open town gate", "irrigation channel", "riverside ferry stop", "field boundary path"],
    subjects: ["open gate with people moving freely", "waterwheel turning without orders", "elder listening from the edge", "shared well used in quiet rhythm", "freshly cleared village path"],
    actions: [
      "people pass through a gate without ceremony while the guide stays aside",
      "water moves the wheel and villagers coordinate without shouting",
      "the seeker notices that listening changes the crowd more than commands",
      "neighbors draw water in turn beside an open path",
      "the road becomes passable because many small gestures align"
    ]
  },
  softness: {
    settings: ["reed riverbank", "bamboo grove after rain", "low valley stream", "snowmelt creek", "quiet marsh path"],
    subjects: ["water bending around a dark stone", "reeds bowing under wind", "soft rope lifting a heavy bucket", "valley receiving several streams", "new shoot rising through wet soil"],
    actions: [
      "water curves around resistance and keeps moving",
      "reeds bend together and stand again after the gust",
      "a loose rope carries weight because it does not become rigid",
      "streams enter the valley from different heights and gather peacefully",
      "a tender shoot pushes through a crack without breaking the stone"
    ]
  },
  life: {
    settings: ["pine shade resting place", "breathing pavilion", "home hearth at dawn", "mountain clinic garden", "old tree courtyard"],
    subjects: ["breath visible in cold air", "resting shadow under pine", "hearth warming a quiet room", "old tree carrying new buds", "traveler setting down a burden"],
    actions: [
      "the seeker pauses and breath returns visibly to the cold morning",
      "a long shadow cools the road while the body recovers",
      "the hearth keeps warmth by burning slowly, not fiercely",
      "new buds appear on an old branch above patient hands",
      "a load is placed on the ground and the path ahead becomes visible"
    ]
  },
  opposites: {
    settings: ["arched bridge market", "echo valley", "weaver courtyard", "two-level terrace", "scales beside a stream"],
    subjects: ["empty bowl beside full bowl", "short bamboo beside tall bamboo", "high step meeting low stone", "two musicians answering each other", "front and rear travelers on one road"],
    actions: [
      "the seeker sees each side make the other readable",
      "an echo answers only because the valley first grows quiet",
      "threads cross into cloth only by passing over and under",
      "people climb and descend the same terrace from different ends",
      "a scale balances after both sides are allowed to speak"
    ]
  },
  war: {
    settings: ["empty training ground after rain", "quiet border road", "campfire being put out", "field with tools replacing weapons", "watchtower at dusk"],
    subjects: ["covered old gear beside farming tools", "extinguished campfire smoke", "empty wooden stand", "lowered plain cloth without markings", "rainwater filling old footprints"],
    actions: [
      "cloth covers old gear while hoes are carried toward the field",
      "the fire is put out before celebration can begin",
      "wooden stands sit unused as villagers repair the road nearby",
      "a banner lowers and the crowd breathes rather than cheers",
      "rain softens old tracks until the road can be walked again"
    ]
  },
  dao: {
    settings: ["misty mountain pass", "hidden spring cave", "moon gate garden", "open plain under clouds", "stone path above clouds"],
    subjects: ["path disappearing into mist", "hidden spring dividing into streams", "round gate opening to landscape", "clouds revealing a valley", "stone basin reflecting sky"],
    actions: [
      "the path appears only a few steps ahead and still invites walking",
      "a spring emerges silently before becoming many currents",
      "a round gate frames a world that cannot be carried away",
      "clouds part just enough for the valley to be sensed",
      "the basin holds sky for a moment, then ripples release it"
    ]
  },
  virtue: {
    settings: ["neighbor doorway", "harvest courtyard", "medicine garden", "repair shed", "rain shelter"],
    subjects: ["shared umbrella between strangers", "mended bowl returned quietly", "medicine leaves placed by a bed", "two hands lifting one broken cart", "warm cloak left on a bench"],
    actions: [
      "help is given before anyone asks who deserves it",
      "a bowl returns to use with the mender already walking away",
      "leaves are prepared while the sick person sleeps undisturbed",
      "the cart rises because no hand tries to own the effort",
      "a cloak waits for the cold traveler with no giver in sight"
    ]
  },
  default: {
    settings: ["village road after rain", "small ferry crossing", "courtyard under a tree", "hill path near fields", "quiet workshop"],
    subjects: ["traveler at a forked path", "elder moving one small stone", "bridge over shallow water", "lantern beside a road", "doorway opening to fresh air"],
    actions: [
      "one small choice changes how everyone moves through the scene",
      "the stone shifts and the blocked path becomes simple",
      "the bridge is crossed slowly while reflections tremble below",
      "the lantern reveals enough ground without lighting the whole road",
      "the doorway opens and the room no longer feels closed"
    ]
  }
};

const chapterOpeners = [
  "The chapter opens with restraint rather than spectacle",
  "The travelers enter a new place and notice a quiet imbalance",
  "A simple public scene turns into a lesson about how people move",
  "The first beat sets a practical question in ordinary life",
  "The opening image asks the viewer to look before judging"
];

const chapterClosers = [
  "The chapter closes with the world calmer than it began",
  "The last beat leaves a clear path forward rather than a slogan",
  "The ending settles into quiet consequence",
  "The final image turns the lesson back into lived experience",
  "The close of the chapter keeps the mystery open but usable"
];

const bridgePhrases = [
  "This follows the previous tension by changing the scale of the scene",
  "The moment answers the previous image through action rather than explanation",
  "The camera moves to a different part of the same journey",
  "A new object carries the next turn of thought",
  "The scene shifts from outer event to inner consequence",
  "The visual rhythm changes so this panel does not repeat the last one",
  "What was abstract before becomes visible in a household detail",
  "The lesson moves from people to landscape without losing continuity"
];

function pick(list, chapter, index, salt = 0) {
  const multipliers = [37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79];
  const raw = chapter * 97 + index * multipliers[salt % multipliers.length] + salt * 53;
  return list[((raw % list.length) + list.length) % list.length];
}

async function loadReviewedEntries() {
  const entries = new Map();
  let files = [];
  try {
    files = (await readdir(INTERPRETATIONS_DIR)).filter((file) => file.endsWith(".json")).sort();
  } catch {
    return entries;
  }

  for (const file of files) {
    const chapterReview = JSON.parse(await readFile(`${INTERPRETATIONS_DIR}/${file}`, "utf8"));
    for (const entry of chapterReview.entries || []) {
      entries.set(entry.id, entry);
    }
  }
  return entries;
}

function classifyText(text) {
  if (/兵|战|杀|勇|敌|甲|师|军|刃/.test(text)) return "war";
  if (/水|柔|弱|谷|溪|婴儿|赤子|雌|牝|下流/.test(text)) return "softness";
  if (/德|善|仁|慈|俭|爱|恩|怨|契/.test(text)) return "virtue";
  if (/民|国|王|侯|治|圣人|百姓|天下|政|法|税/.test(text)) return "governance";
  if (/欲|货|金玉|贵|富|宠|辱|知足|知止|名与身|身与货/.test(text)) return "desire";
  if (/名|言|辩|信|知|学/.test(text)) return "language";
  if (/有无|难易|长短|高下|前后|大小|多少|轻重|祸福|反者|曲则全/.test(text)) return "opposites";
  if (/身|生|死|寿|久|气|腹|骨|精|养|根/.test(text)) return "life";
  if (/道|玄|妙|天地|万物|母|始|自然|朴|一/.test(text)) return "dao";
  return "default";
}

function themeFor(sentence, gist) {
  const sentenceTheme = classifyText(sentence);
  if (sentenceTheme !== "default") return sentenceTheme;
  return classifyText(gist);
}

function clauseNoun(sentence) {
  return sentence
    .replace(/[。；！？：，、]/g, "")
    .replace(/^(故|是以|夫|其|此|若|吾|而|以|则|为|有|无|不)+/, "")
    .slice(0, 10);
}

function makeStoryArc(chapter, themes) {
  const route = pick(chapterRoutes, chapter.chapter, chapter.sentences.length);
  const themeText = [...new Set(themes)].join(", ");
  return `${chapter.gist} The chapter is staged as one continuous journey through ${route.join(" -> ")}. Dominant visual themes: ${themeText}. Every panel shares the same two travelers and album style, but each sentence gets a different setting, focal object, action, camera distance, and emotional beat.`;
}

function makeReviewedPrompt({ chapter, sentence, index, total, reviewed }) {
  const mustShow = reviewed.imageSemantics?.mustShow || [];
  const mustNotShow = reviewed.imageSemantics?.mustNotShow || [];
  const anchorText = mustShow.join("; ");
  const avoidText = [
    ...mustNotShow,
    "readable text",
    "written labels",
    "calligraphy",
    "captions",
    "logos",
    "watermarks",
    "split panels"
  ].join("; ");
  const camera = `${pick(cameras, chapter.chapter, index)}, panel ${index + 1} of ${total}`;
  const accent = pick(accents, chapter.chapter, index);
  const route = pick(chapterRoutes, chapter.chapter, index, total);
  const setting = `${route[index % route.length]} scene`;
  const coreAnchor = mustShow[0] || clauseNoun(sentence.sentence);
  const supportingAnchors = mustShow.slice(1).join("; ");
  const scenePrompt = [
    `${setting}.`,
    `Core action around ${coreAnchor}.`,
    supportingAnchors ? `Supporting details: ${supportingAnchors}.` : "",
    `${pick(cameras, chapter.chapter, index)}.`,
    `Distinct prop and action for chapter ${chapter.chapter} panel ${index + 1}.`
  ].filter(Boolean).join(" ");
  const prompt = [
    "16:9 single full-frame comic illustration for one panel in a continuous Dao De Jing comic album.",
    `Original sentence: ${sentence.sentence}`,
    `Story beat: ${sentence.sentence} - ${reviewed.plain || sentence.plain}`,
    `Scene: ${scenePrompt}`,
    `Composition: ${camera}; color accent: ${accent}.`,
    `Must show: ${anchorText}.`,
    `Avoid: ${avoidText}.`,
    `Style: ${compactStyle}; same character design, same line weight, same paper texture across panels.`,
    "Strict negative instruction: no text, no readable letters, no Chinese characters, no calligraphy, no captions, no signs with writing, no logos, no watermark, no stamp, no speech bubbles, no split-screen, no collage, no inner panel borders."
  ].join(" ");
  const dreaminaPrompt = [
    "16:9 single full-frame ink-and-watercolor comic illustration, one coherent panel.",
    `Scene anchors: ${anchorText}.`,
    `Concrete scene: ${setting}, centered on ${coreAnchor}.`,
    "Make the anchors drive the action; avoid a generic landscape.",
    `Composition: ${camera}; color accent: ${accent}.`,
    "Characters when natural: young seeker in blue-gray robe; elder guide with long white beard.",
    `Style: ${compactStyle}.`,
    "No text, no readable letters, no calligraphy, no signs, no captions, no logo, no watermark, no speech bubbles, no split panels, no border, no empty side margins."
  ].join(" ");

  return {
    scenePrompt,
    prompt,
    dreaminaPrompt,
    camera,
    accent,
    primarySubject: mustShow[0] || clauseNoun(sentence.sentence),
    setting,
    action: mustShow[1] || reviewed.plain || sentence.plain,
    foregroundObject: mustShow[2] || mustShow[0] || clauseNoun(sentence.sentence),
    avoidRepeating: mustNotShow
  };
}

function makeScenePrompt({ chapter, sentence, index, total, previous, next, theme }) {
  const bank = themeBanks[theme] || themeBanks.default;
  const route = pick(chapterRoutes, chapter.chapter, index, total);
  const setting = `${pick(bank.settings, chapter.chapter, index)} near ${pick(route, chapter.chapter, index, 1)}`;
  const subject = pick(bank.subjects, chapter.chapter, index, 2);
  const action = pick(bank.actions, chapter.chapter, index, 3);
  const scale = [
    "wind moves cloth and leaves across the foreground",
    "water, dust, or lamp glow shows the consequence of the action",
    "background villagers continue ordinary life without posing",
    "the elder stays almost still while the seeker notices the change",
    "the focal object is large enough to read at thumbnail size",
    "the path of motion leads naturally toward the next panel"
  ][index % 6];
  const visualDetail = [
    "The seeker leans forward as if noticing the lesson for the first time",
    "The elder remains quiet, letting the object carry the meaning",
    "A few villagers pass through the background, unaware of the teaching",
    "The atmosphere is calm but the composition has a clear turning point",
    "The object, landscape, and human gesture form one readable triangle",
    "The scene feels like a single frame from a continuous travel story",
    "The foreground has tactile detail while the background opens outward",
    "The lighting shifts gently from the previous beat toward the next"
  ][(chapter.chapter + index) % 8];
  const sentenceAnchor = clauseNoun(sentence.sentence);

  const visualScene = `${setting}. Focus on ${subject}. ${action}. ${scale}. ${visualDetail}. Ancient Chinese world, no modern objects.`;

  return {
    setting,
    subject,
    action,
    visualDetail,
    dreaminaScenePrompt: visualScene.replace(/\s+/g, " "),
    scenePrompt: `${visualScene} Visual anchor from this sentence: ${sentenceAnchor}.`.replace(/\s+/g, " ")
  };
}

function makePanel(chapter, sentence, index, total, previous, next, reviewedEntries) {
  const reviewed = reviewedEntries.get(sentence.id);
  if (reviewed) {
    const reviewedPrompt = makeReviewedPrompt({ chapter, sentence, index, total, reviewed });
    return {
      id: sentence.id,
      sentence: sentence.sentence,
      beat: `Panel ${index + 1}: ${(reviewed.plain || sentence.plain).replace(/。$/, "")}`,
      currentMeaning: reviewed.plain || sentence.plain,
      primarySubject: `${reviewedPrompt.primarySubject} ${chapter.chapter}.${index + 1}`,
      setting: `${reviewedPrompt.setting} ${chapter.chapter}.${index + 1}`,
      action: `${reviewedPrompt.action} ${chapter.chapter}.${index + 1}`,
      foregroundObject: `${reviewedPrompt.foregroundObject} ${chapter.chapter}.${index + 1}`,
      camera: reviewedPrompt.camera,
      colorAccent: `${reviewedPrompt.accent} ${chapter.chapter}.${index + 1}`,
      avoidRepeating: reviewedPrompt.avoidRepeating,
      scenePrompt: reviewedPrompt.scenePrompt,
      prompt: reviewedPrompt.prompt,
      dreaminaPrompt: reviewedPrompt.dreaminaPrompt
    };
  }

  const theme = themeFor(sentence.sentence, chapter.gist);
  const { setting, subject, action, visualDetail, scenePrompt, dreaminaScenePrompt } = makeScenePrompt({
    chapter,
    sentence,
    index,
    total,
    previous,
    next,
    theme
  });
  const camera = `${pick(cameras, chapter.chapter, index)}, panel ${index + 1} of ${total}`;
  const accent = pick(accents, chapter.chapter, index);
  const foreground = `${subject}, with ${["mist", "rain ripples", "lamp glow", "fallen leaves", "dust motes", "stream light"][index % 6]} in front`;
  const beat = `Panel ${index + 1}: ${sentence.plain.replace(/。$/, "")}`;
  const prompt = [
    "16:9 Chinese ink-and-watercolor comic illustration.",
    `Original sentence: ${sentence.sentence}`,
    `Story beat: ${beat}`,
    `Meaning: ${sentence.plain}`,
    `Scene: ${scenePrompt}`,
    `Composition: ${camera}; focus: ${subject}; foreground: ${foreground}; accent: ${accent}.`,
    `Consistent style: ${compactStyle}.`,
    "Recurring characters: young seeker in blue-gray robe with topknot; elder guide with long white beard in plain linen robe.",
    "Single full-frame image; keep style consistent, but make this panel's setting, action, focal object, and camera clearly different from adjacent panels.",
    `Strict negative instruction: ${compactNegative}.`
  ].join(" ");
  const dreaminaPrompt = [
    "16:9 Chinese ink watercolor comic illustration.",
    `Scene: ${setting}. ${action}. ${visualDetail}.`,
    "Include the recurring young seeker in a blue-gray robe and the elder guide with a white beard when people fit naturally.",
    `Composition: ${camera}; main object: ${subject}; foreground detail: ${foreground}; color accent: ${accent}.`,
    `Style: ${compactStyle}.`,
    `Single full-frame image. Avoid: ${compactNegative}.`
  ].join(" ");

  return {
    id: sentence.id,
    sentence: sentence.sentence,
    beat,
    currentMeaning: sentence.plain,
    primarySubject: `${subject} ${chapter.chapter}.${index + 1}`,
    setting: `${setting} ${chapter.chapter}.${index + 1}`,
    action: `${action} ${chapter.chapter}.${index + 1}`,
    foregroundObject: `${foreground} ${chapter.chapter}.${index + 1}`,
    camera,
    colorAccent: `${accent} ${chapter.chapter}.${index + 1}`,
    avoidRepeating: [],
    scenePrompt,
    prompt,
    dreaminaPrompt
  };
}

const plan = JSON.parse(await readFile(PLAN_FILE, "utf8"));
const reviewedEntries = await loadReviewedEntries();
const preserved = (plan.chapters || []).filter((chapter) => PRESERVE_MANUAL_CHAPTERS.has(chapter.chapter));
const preservedNumbers = new Set(preserved.map((chapter) => chapter.chapter));
const generated = [];

for (const chapter of data.chapters) {
  if (preservedNumbers.has(chapter.chapter)) continue;
  const themes = chapter.sentences.map((sentence) => themeFor(sentence.sentence, chapter.gist));
  generated.push({
    chapter: chapter.chapter,
    title: chapter.title,
    storyArc: makeStoryArc(chapter, themes),
    recurringCharacters: [
      "young seeker in simple blue-gray robe with black topknot",
      "elder guide with long white beard in plain undyed robe"
    ],
    panels: chapter.sentences.map((sentence, index, sentences) =>
      makePanel(chapter, sentence, index, sentences.length, sentences[index - 1], sentences[index + 1], reviewedEntries)
    )
  });
}

plan.chapters = [...preserved, ...generated].sort((a, b) => a.chapter - b.chapter);
await writeFile(PLAN_FILE, `${JSON.stringify(plan, null, 2)}\n`);
console.log(`Wrote prompt plan for ${plan.chapters.length} chapters; preserved manual chapters ${[...preservedNumbers].join(", ")}.`);
