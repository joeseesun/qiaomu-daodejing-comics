import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_URL = "https://ctext.org/dao-de-jing/zhs";
const OUTPUT_FILE = path.join("src", "data", "daodejing.generated.json");
const PROMPT_PLAN_FILE = path.join("src", "data", "comic-prompts.json");
const INTERPRETATIONS_DIR = path.join("src", "data", "interpretations");
const PLAIN_REVIEWED_FILE = path.join("src", "data", "plain-reviewed.generated.json");
const PLAIN_OVERRIDES_FILE = path.join("src", "data", "plain-overrides.generated.json");
const SENTENCE_RE = /[^。；！？]+[。；！？]/g;

const sceneRules = [
  [/水|柔|弱|婴儿|赤子|谷|溪/, "clear water moving around dark rocks, a small figure choosing the lower path"],
  [/兵|战|杀|勇|甲|师|敌/, "a battlefield after rain, discarded weapons, people choosing restraint over triumph"],
  [/民|国|王|侯|治|税|法令/, "a quiet town market, a ruler listening from the edge rather than commanding"],
  [/名|言|辩|信|知/, "paper labels peeling away from a wooden sign, the real landscape behind them"],
  [/欲|货|金玉|贵|富|宠|辱/, "heavy treasure bags set down beside a simple meal and a calm lamp"],
  [/身|生|死|寿|气|腹|骨/, "a traveler breathing under a pine tree, body and shadow settling into stillness"],
  [/无为|不争|功成|不恃|不居|自然/, "a quiet guide opening a gate while others pass naturally"],
  [/有无|难易|长短|高下|前后|祸福/, "opposite panels of light and shade fitting into one continuous scroll"],
  [/道|玄|妙|天地|万物|母|始/, "an old thinker on a mountain path, mist revealing and hiding the valley"]
];

async function loadPromptOverrides() {
  try {
    const raw = await readFile(PROMPT_PLAN_FILE, "utf8");
    const plans = JSON.parse(raw);
    const overrides = new Map();
    for (const chapter of plans.chapters || []) {
      for (const panel of chapter.panels || []) {
        if (panel.id && (panel.dreaminaPrompt || panel.prompt)) overrides.set(panel.id, panel.dreaminaPrompt || panel.prompt);
      }
    }
    return overrides;
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw error;
  }
}

async function loadInterpretationOverrides() {
  const overrides = new Map();
  try {
    const files = (await readdir(INTERPRETATIONS_DIR)).filter((file) => file.endsWith(".json"));
    for (const file of files) {
      const raw = await readFile(path.join(INTERPRETATIONS_DIR, file), "utf8");
      const review = JSON.parse(raw);
      for (const entry of review.entries || []) {
        if (!entry.id) continue;
        overrides.set(entry.id, {
          chapter: review.chapter,
          title: review.title,
          sources: review.sources || [],
          evidence: entry.evidence || [],
          decision: entry.decision || "",
          plain: entry.plain || "",
          imageSemantics: entry.imageSemantics || {}
        });
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return overrides;
}

async function loadPlainOverrides() {
  try {
    const raw = await readFile(PLAIN_OVERRIDES_FILE, "utf8");
    const data = JSON.parse(raw);
    const overrides = new Map();
    for (const entry of data.entries || []) {
      if (entry.id && entry.plain) overrides.set(entry.id, entry);
    }
    return overrides;
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw error;
  }
}

async function loadPlainReviewed() {
  try {
    const raw = await readFile(PLAIN_REVIEWED_FILE, "utf8");
    const data = JSON.parse(raw);
    const reviewed = new Map();
    for (const entry of data.entries || []) {
      if (entry.id && entry.plain) reviewed.set(entry.id, entry);
    }
    return reviewed;
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw error;
  }
}

const promptOverrides = await loadPromptOverrides();
const interpretationOverrides = await loadInterpretationOverrides();
const plainReviewed = await loadPlainReviewed();
const plainOverrides = await loadPlainOverrides();

const exactVisuals = new Map([
  [
    "道可道，非常道。",
    {
      scene:
        "a lone sage pauses before a mountain path that quietly splits and dissolves into mist, measuring cords and rigid tools lying unused beside the road",
      meaning:
        "spoken formulas and fixed methods cannot capture the living path itself",
      composition:
        "wide open mountain vista, sage on the left third, path changing shape toward the horizon"
    }
  ],
  [
    "名可名，非常名。",
    {
      scene:
        "a quiet hall of blank masks and empty picture frames gently drifting apart, revealing real flowers, stones, water, and people behind them",
      meaning:
        "names are only temporary frames, not the living things they point to",
      composition:
        "interior-to-exterior reveal, frames in the foreground, vivid natural world visible through the gaps"
    }
  ],
  [
    "无名天地之始；",
    {
      scene:
        "before names exist, a dark blue primordial silence opens into the first thin dawn, with mountains, clouds, and water only beginning to take shape",
      meaning:
        "the unnamed beginning before forms and categories appear",
      composition:
        "large quiet negative space, first light emerging from the center, no human figures"
    }
  ],
  [
    "有名万物之母。",
    {
      scene:
        "a warm valley nursery where countless distinct plants, birds, insects, and small houses emerge from one glowing earth mound",
      meaning:
        "once forms appear, the named world gives birth to countless things",
      composition:
        "abundant life across the frame, one shared source in the lower center, lively but uncluttered"
    }
  ],
  [
    "故常无欲，以观其妙；",
    {
      scene:
        "a person leaves a coin purse and food bowl outside a simple hut, then kneels quietly to observe a tiny sprout breaking through dew-covered soil",
      meaning:
        "letting go of grasping reveals subtle beginnings",
      composition:
        "intimate close scene, sprout and dew as the visual focus, possessions pushed to the edge"
    }
  ],
  [
    "常有欲，以观其徼。",
    {
      scene:
        "a careful traveler with a lantern studies where a river meets a field wall and a village gate, noticing edges, limits, and destinations",
      meaning:
        "practical desire reveals boundaries, endpoints, and consequences",
      composition:
        "clear diagonal river boundary, lantern glow on the right, village gate in the distance"
    }
  ],
  [
    "此两者，同出而异名，同谓之玄。",
    {
      scene:
        "two streams, one bright and one dark, flow from the same hidden spring under a deep cave and then curve in different directions",
      meaning:
        "being and nonbeing arise from one source even when they receive different names",
      composition:
        "symmetrical source in the center, two contrasting streams moving outward, mysterious cave depth"
    }
  ],
  [
    "玄之又玄，众妙之门。",
    {
      scene:
        "nested circular moon gates recede into a star-filled garden, each gate revealing a different tiny wonder: rain, seed, bird, cloud, child, old tree",
      meaning:
        "deeper mystery opens the doorway to many subtle transformations",
      composition:
        "strong tunnel perspective, repeated gates but varied worlds inside each opening, luminous final doorway"
    }
  ]
]);

function htmlDecode(input) {
  return input
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(input) {
  return htmlDecode(
    input
      .replace(/<div[^>]*><\/div>/g, "")
      .replace(/<sup[^>]*>[\s\S]*?<\/sup>/g, "")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\s+/g, "")
    .replace(/\^\{\d+\}/g, "")
    .trim();
}

function normalizeSourceText(text) {
  return text.replace(/衆/g, "众").replace(/眾/g, "众");
}

function splitSentences(text) {
  return Array.from(text.matchAll(SENTENCE_RE)).map((match) => match[0].trim());
}

function normalizeText(text) {
  return normalizeSourceText(text).replace(/[。；！？：，、\s]/g, "");
}

const titleTopics = [
  {
    id: "dao",
    keywords: ["道", "玄", "妙", "谷神", "天地根", "混成", "自然", "万物"],
    gist: "这一章把视线拉回事物背后的根本规律：少下定义，多观察万物怎样自己运行。"
  },
  {
    id: "language",
    keywords: ["名", "言", "辩", "信言", "美言", "知者不言", "言者不知", "知不知"],
    gist: "这一章提醒人不要被语言、标签和自以为懂困住，要回到真实经验。"
  },
  {
    id: "wuwei",
    keywords: ["无为", "不争", "不恃", "不处", "弗居", "功成", "不言", "自然"],
    gist: "这一章讲顺势而为：做成事情，但不抢功、不硬推、不把自己放到中心。"
  },
  {
    id: "softness",
    keywords: ["水", "柔", "弱", "柔弱", "婴儿", "赤子", "雌", "溪", "谷"],
    gist: "这一章讲柔软的力量：能承受、能流动、能处下，反而更长久。"
  },
  {
    id: "desire",
    keywords: ["欲", "知足", "祸", "咎", "贵", "货", "金玉", "多藏", "甚爱"],
    gist: "这一章讲节制欲望：懂得够了，人才不会被外物拖着走。"
  },
  {
    id: "governance",
    keywords: ["圣人", "治", "民", "百姓", "天下", "国", "王", "侯", "兵", "战", "税", "法令"],
    gist: "这一章讲治理与处世：少折腾、少炫耀，让人和事自然安定。"
  },
  {
    id: "opposites",
    keywords: ["有无", "难易", "长短", "高下", "前后", "大小", "多少", "轻重", "祸福"],
    gist: "这一章讲对立相生：很多答案不在某一边，而在两边的关系里。"
  },
  {
    id: "life",
    keywords: ["身", "生", "死", "寿", "久", "养", "腹", "骨", "精", "气"],
    gist: "这一章讲保全生命：少耗散、守住根本，身心才有余地。"
  },
  {
    id: "virtue",
    keywords: ["德", "善", "仁", "慈", "俭", "爱", "恩", "怨", "契"],
    gist: "这一章讲德行不是姿态，而是在关系里少伤人、多成全、守分寸。"
  }
];

function splitClauses(text) {
  return text
    .split(/[。；！？：，、]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function cleanTitleCandidate(value) {
  return value
    .replace(/^天下皆知/, "")
    .replace(/^(故|夫|是以|若使|虽有|此|彼|而|则|之)+/, "")
    .replace(/[者也矣焉兮乎哉]+$/g, "")
    .replace(/[^一-龥]/g, "")
    .trim();
}

function titleScore(candidate, chapterText) {
  const { title, index, kind } = candidate;
  let score = 100 - index * 12;
  if (index === 0) score += 45;
  const length = title.length;
  if (length === 4) score += 45;
  if (length === 3 || length === 5 || length === 6) score += 30;
  if (length === 7 || length === 8) score += 4;
  if (kind === "clause" && length >= 3 && length <= 8) score += 48;
  if (kind === "chunk") score -= 24;
  if (length < 3 || length > 9) score -= 80;
  if (/道|德|圣人|天下|无为|不争|知足|柔弱|上善|自然|小国|信言|天道/.test(title)) score += 8;
  if (/^不|^无|^有|^知|^为|^上|^大|^小|^天|^道|^圣/.test(title)) score += 4;
  if (/^[之其此彼吾我夫]/.test(title)) score -= 28;
  if (/而|以|于|之/.test(title) && length >= 7) score -= 16;
  if (/^[之其此彼吾我民人夫]$/.test(title)) score -= 100;
  if ((chapterText.match(new RegExp(title, "g")) || []).length > 1) score += 12;
  return score;
}

function titleVariants(clean, index) {
  const variants = [{ title: clean, kind: "clause" }];
  if (clean.length > 8) variants.push({ title: clean.slice(0, 6), kind: "chunk" }, { title: clean.slice(-4), kind: "chunk" });
  for (let start = 0; start <= clean.length - 4; start += 1) {
    variants.push({ title: clean.slice(start, start + 4), kind: "chunk" });
  }
  return variants
    .map((item) => ({ title: cleanTitleCandidate(item.title), kind: item.kind, index }))
    .map((item) => ({ ...item, title: normalizeSourceText(item.title) }))
    .filter((item) => item.title.length >= 3);
}

function topicScore(text, topic) {
  return topic.keywords.reduce((score, keyword) => {
    const count = (text.match(new RegExp(keyword, "g")) || []).length;
    return score + count * Math.max(2, keyword.length);
  }, 0);
}

function chapterGist(text) {
  const ranked = titleTopics
    .map((topic) => ({ topic, score: topicScore(text, topic) }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.score > 0
    ? ranked[0].topic.gist
    : "这一章把复杂道理落回日常经验：少一点执拗，多一点观察，很多事会自己露出方向。";
}

function chapterTitleAndGist(text) {
  const clauses = splitClauses(text);
  const candidates = clauses
    .slice(0, 10)
    .flatMap((clause, index) => titleVariants(cleanTitleCandidate(clause), index));

  const seen = new Set();
  const ranked = candidates
    .filter(({ title }) => {
      if (seen.has(title)) return false;
      seen.add(title);
      return true;
    })
    .sort((a, b) => titleScore(b, text) - titleScore(a, text));

  const title = ranked[0]?.title || cleanTitleCandidate(clauses[0] || "道德经").slice(0, 8);

  return {
    title,
    gist: chapterGist(text)
  };
}

const exactParaphraseEntries = [
  ["道可道，非常道。", "能被说出口、被规定成方法的“道”，已经不是恒常不变的道。"],
  ["名可名，非常名。", "能被叫出来、固定成概念的“名”，也不是恒常不变的名。"],
  ["无名天地之始；", "还没有名称和形状时，它是天地万物的开端。"],
  ["有名万物之母。", "一旦有了形状和名称，它又像母体一样生养万物。"],
  ["故常无欲，以观其妙；", "所以放下占有和目的心，才能看见事物刚要发生时的微妙。"],
  ["常有欲，以观其徼。", "带着具体需求去看，则能看见事物成形之后的边界和归宿。"],
  ["此两者，同出而异名，同谓之玄。", "“无”和“有”其实同出一源，只是作用不同，所以都叫作幽深难尽。"],
  ["玄之又玄，众妙之门。", "越往深处看，越会发现所有微妙变化都从这里打开。"],
  ["天下皆知美之为美，斯恶已。", "天下人一旦把某种样子定为“美”，相反的“丑”也就跟着出现。"],
  ["皆知善之为善，斯不善已。", "大家把某种行为标成“善”，另一面“不善”的分别也就被制造出来。"],
  ["故有无相生，难易相成，长短相较，高下相倾，音声相和，前后相随。", "有和无、难和易、长和短、高和下、声和音、前和后，都是互相映照才成立的。"],
  ["是以圣人处无为之事，行不言之教；", "所以圣人处理事情时少用强制，教化别人时少靠口号。"],
  ["万物作焉而不辞，生而不有。", "万物自然生长，他不拒绝、不占有。"],
  ["为而不恃，功成而弗居。", "事情做成了，也不把功劳抓在自己手里。"],
  ["夫唯弗居，是以不去。", "正因为不把功劳据为己有，这份作用反而不会消失。"],
  ["不尚贤，使民不争；", "不把“贤能”炒成人人争抢的名位，百姓就少一些攀比争斗。"],
  ["不贵难得之货，使民不为盗；", "不把稀有货物捧得过高，人们就少一些偷夺的念头。"],
  ["不见可欲，使心不乱。", "不故意展示诱人的东西，人心就不容易被撩乱。"],
  ["为无为，则无不治。", "用少干预、顺其性的方式治理，反而没有什么不能安定。"],
  ["道冲而用之或不盈。", "道像一个深而空的器皿，越使用越不会被耗尽。"],
  ["渊兮似万物之宗。", "它深得像万物共同的源头，所有变化都从那里流出来。"],
  ["挫其锐，解其纷，和其光，同其尘。", "它磨去锋芒，化开纠缠，把光芒放柔，也愿意混在尘世之中。"],
  ["湛兮似或存。", "它安静深沉，好像看不见，却又确实在那里发生作用。"],
  ["吾不知谁之子，象帝之先。", "我不知道它从哪里来，只觉得它比一切主宰和秩序都更早。"],
  ["天地不仁，以万物为刍狗；", "天地没有偏爱的私心，任万物按自己的规律生灭。"],
  ["天地之间，其犹橐龠乎？", "天地之间像一个大风箱，里面空着，反而能不断生出气息。"],
  ["虚而不屈，动而愈出。", "越保持空虚，越不会枯竭；一动起来，反而生发得更多。"],
  ["多言数穷，不如守中。", "话说得越满，越容易走到尽头；不如守住中间那份虚静。"],
  ["谷神不死，是谓玄牝。", "像山谷一样空而能生的力量不会断绝，这就是幽深的母性源头。"],
  ["玄牝之门，是谓天地根。", "这个幽深母体的入口，就是天地万物生出来的根。"],
  ["绵绵若存，用之不勤。", "它若有若无地延续着，使用起来却从不费力、不枯竭。"],
  ["天长地久。", "天地能够长久存在。"],
  ["天地所以能长且久者，以其不自生，故能长生。", "天地之所以长久，是因为它们不只为自己活，而是任万物自然生长。"],
  ["外其身而身存。", "把自身利益放到外面，反而能保全自己。"],
  ["非以其无私耶？", "这不正是因为他少了私心吗？"],
  ["故能成其私。", "正因为无私，最后反而成全了真正的自己。"],
  ["上善若水。", "最高明的善，像水一样。"],
  ["水善利万物而不争，处众人之所恶，故几于道。", "水滋养万物而不争功，又愿意停在众人嫌低的地方，所以最接近“道”。"],
  ["居善地，心善渊，与善仁，言善信，正善治，事善能，动善时。", "安身要像水一样处在合适的位置，心要沉静深厚，待人要仁厚，说话要可信，治理要有条理，做事要发挥所长，行动要懂时机。"],
  ["夫唯不争，故无尤。", "正因为不争，所以少有怨尤和过失。"],
  ["持而盈之，不如其已；", "一味把东西捧到满，不如及时停手。"],
  ["揣而锐之，不可长保。", "把刀磨得太锋利，锋芒也难以长久保存。"],
  ["金玉满堂，莫之能守；", "金玉堆满屋子，也没有人能永远守住。"],
  ["富贵而骄，自遗其咎。", "富贵之后还骄横，就是自己给自己留下祸患。"],
  ["功遂身退，天之道。", "事情完成后懂得退开，这是顺应自然的做法。"],
  ["功遂身退天之道。", "事情完成后懂得退开，这是顺应自然的做法。"],
  ["载营魄抱一，能无离乎？", "让身体、精神和内在主心骨合在一起，能不让它们散乱分离吗？"],
  ["专气致柔，能婴儿乎？", "把气息收拢到柔和纯净，能像婴儿那样松软自然吗？"],
  ["涤除玄览，能无疵乎？", "把心里的杂念洗干净，再照见自己深处，能做到没有偏差和污点吗？"],
  ["爱民治国，能无知乎？", "爱护百姓、治理国家，能不能少用机巧算计，顺着事情本身来办？"],
  ["天门开阖，能为雌乎？", "感官和外界不断开合接触时，能不能保持柔静、接纳，而不逞强抢先？"],
  ["明白四达，能无知乎？", "看得很明白、通达四方时，能不能仍然不自作聪明？"],
  ["生之、畜之。", "让万物生长，也养护它们。"],
  ["生而不有，为而不恃，长而不宰。", "生养它们却不占有，做了事却不仗恃，扶持它们成长却不控制它们。"],
  ["是谓玄德。", "这就叫幽深而不张扬的德。"],
  ["生之、畜之，生而不有，为而不恃，长而不宰，是谓玄德。", "让万物生长、养护万物，却不占有它们；做了事不把功劳抓在手里，扶持它们成长也不去主宰它们。这就是幽深而不张扬的德。"],
  ["三十辐，共一毂，当其无，有车之用。", "三十根车辐汇到车毂，中间正因为是空的，车才转得起来。"],
  ["埏埴以为器，当其无，有器之用。", "揉土做成器皿，正因为里面空着，器皿才能盛东西。"],
  ["凿户牖以为室，当其无，有室之用。", "开门窗建房子，正因为屋里有空处，人才能住进去。"],
  ["故有之以为利，无之以为用。", "有形的东西带来便利，真正发挥作用的，常常是其中的空处。"],
  ["五色令人目盲。", "色彩太繁，会让人的眼睛失去真正的分辨力。"],
  ["五色令人目盲；", "色彩太繁，会让人的眼睛失去真正的分辨力。"],
  ["五音令人耳聋。", "声音太杂，会让人的耳朵听不见真正该听的东西。"],
  ["五音令人耳聋；", "声音太杂，会让人的耳朵听不见真正该听的东西。"],
  ["五味令人口爽。", "味道太浓太多，会让人的口味失去平衡。"],
  ["五味令人口爽；", "味道太浓太多，会让人的口味失去平衡。"],
  ["驰骋畋猎，令人心发狂。", "纵情打猎追逐，会让人的心变得躁动发狂。"],
  ["驰骋田猎，令人心发狂；", "纵情奔跑打猎，会让人的心变得躁动发狂。"],
  ["难得之货，令人行妨。", "稀罕贵重的东西，会诱使人的行为走偏。"],
  ["是以圣人为腹不为目，故去彼取此。", "所以圣人重视基本生活和内在安顿，不追逐眼前刺激；舍掉外物诱惑，守住真正需要的东西。"],
  ["宠辱若惊，贵大患若身。", "得宠和受辱都让人心惊，是因为人把外界评价和自身安危看得太重。"],
  ["何谓宠辱若惊？", "什么叫“得宠受辱都会心惊”？"],
  ["宠为下，得之若惊，失之若惊，是谓宠辱若惊。", "得宠本来就是把自己放在被人摆布的位置；得到它会惊慌，失去它也会惊慌，这就是被宠辱牵着走。"],
  ["何谓贵大患若身？", "什么叫“把大患看得像身体一样要紧”？"],
  ["吾所以有大患者，为吾有身，及吾无身，吾有何患？", "我之所以会有大患，是因为总把这个身体和自我看得太重；如果不执着这个“我”，还有什么患得患失呢？"],
  ["故贵以身为天下，若可寄天下；", "能像爱惜自己身体一样谨慎对待天下的人，才可以把天下托付给他。"],
  ["爱以身为天下，若可托天下。", "能把天下当成自己生命来爱护的人，才可以承担天下。"],
  ["视之不见，名曰夷；", "看它却看不见，勉强叫它“夷”，意思是无形而平远。"],
  ["听之不闻，名曰希；", "听它却听不到，勉强叫它“希”，意思是细微到近乎无声。"],
  ["搏之不得，名曰微。", "伸手去摸也摸不着，勉强叫它“微”，意思是幽隐到不可把握。"],
  ["此三者不可致诘，故混而为一。", "这三种感受追问到底都说不清，最后只能合起来看成同一个东西。"],
  ["其上不皦，其下不昧。", "它向上看不显得明亮，向下看也不显得昏暗。"],
  ["绳绳不可名，复归于无物。", "它绵延不断，却无法命名；追到最后，又像回到没有具体形体的状态。"],
  ["是谓无状之状，无物之象，是谓惚恍。", "这就是没有形状的形状、没有实体的景象，只能说是恍惚难定。"],
  ["迎之不见其首，随之不见其后。", "迎上去看不见它的开端，跟在后面也看不见它的尽头。"],
  ["执古之道，以御今之有。", "抓住古来不变的道理，才能驾驭今天纷繁的现实。"],
  ["能知古始，是谓道纪。", "能懂得万物最初的源头，就抓住了道的纲纪。"],
  ["古之善为士者，微妙玄通，深不可识。", "古代真正善于行道的人，细微、深远、通达，不是浅眼一看就能看透的。"],
  ["夫唯不可识，故强为之容。", "正因为难以看透，只能勉强描摹他们的样子。"],
  ["豫兮若冬涉川；", "他们谨慎迟疑，好像冬天踩着冰河过水。"],
  ["犹兮若畏四邻；", "他们警觉克制，好像四周邻里都在注视。"],
  ["俨兮其若容；", "他们庄重端正，好像在正式做客。"],
  ["涣兮若冰之将释；", "他们舒展开来，好像冰块将要融化。"],
  ["敦兮其若朴；", "他们厚道朴实，好像未经雕琢的木头。"],
  ["旷兮其若谷；", "他们开阔虚怀，好像空旷的山谷。"],
  ["混兮其若浊；", "他们不急着显得清白分明，好像浑水一样包容复杂。"],
  ["孰能浊以静之徐清？", "谁能在混浊中安静下来，让它慢慢澄清？"],
  ["孰能安以久动之徐生？", "谁能在沉寂中耐心等待，让新的生机慢慢发生？"],
  ["保此道者，不欲盈。", "守住这种道的人，不追求把自己填满、撑满。"],
  ["夫唯不盈，故能蔽不新成。", "正因为不求满，才不会僵死在旧样子里，反而能不断更新。"],
  ["致虚极，守静笃。", "把心里的空明推到极致，把内在的安静守得很稳。"],
  ["万物并作，吾以观复。", "万物一起生长变化，我借此观察它们怎样循环回到根本。"],
  ["夫物芸芸，各复归其根。", "万物纷纷繁繁，最后都会回到各自的根源。"],
  ["归根曰静，是谓复命。", "回到根源就叫安静，这也叫回到生命本来的状态。"],
  ["复命曰常，知常曰明。", "懂得这种循环恒常，才算真正明白。"],
  ["不知常，妄作凶。", "不懂恒常规律就乱来，往往会招来祸患。"],
  ["知常容，容乃公，公乃王，王乃天，天乃道，道乃久，没身不殆。", "懂得恒常，心量就能包容；能包容就公正，公正就周全，周全就合于天地，合于天地就接近道，接近道才能长久，一生也少有危险。"],
  ["太上，下知有之；", "最好的治理，百姓只是隐约知道有这个人在，却不觉得被他摆布。"],
  ["其次，亲而誉之；", "差一等的治理，百姓亲近他、称赞他。"],
  ["其次，畏之；", "再差一等，百姓害怕他。"],
  ["其次，侮之。", "最差的治理，百姓看不起他、反过来轻慢他。"],
  ["信不足，焉有不信焉。", "上面没有足够诚信，下面自然不会相信。"],
  ["悠兮，其贵言。", "真正高明的人很从容，也很珍惜发号施令。"],
  ["功成事遂，百姓皆谓我自然。", "事情做成了，百姓还觉得这是他们自己本来就会成的样子。"],
  ["大道废，有仁义；", "大道不再自然运行，才需要特别拿仁义出来补救。"],
  ["智慧出，有大伪；", "机巧聪明被过度推崇，虚伪也会跟着变多。"],
  ["六亲不和，有孝慈；", "亲人关系坏了，才会特别标榜孝顺和慈爱。"],
  ["国家昏乱，有忠臣。", "国家乱到失序，才显出谁是忠臣。"],
  ["绝圣弃智，民利百倍；", "放下那些被包装成高明的机巧，百姓反而得到更多实利。"],
  ["绝仁弃义，民复孝慈；", "不把仁义变成外在招牌，人和人之间的亲厚反而能回来。"],
  ["绝巧弃利，盗贼无有。", "少些投机取巧和逐利诱惑，盗贼也就少了根源。"],
  ["此三者以为文不足。", "只靠这些漂亮名目来治理，并不足以让人真正安定。"],
  ["故令有所属：见素抱朴，少私寡欲。", "所以要让心有归处：看见素净，抱住朴实，少一点私心和贪欲。"],
  ["绝学无忧，唯之与阿，相去几何？", "把争名逐巧的学问放下，才少些忧虑；恭敬应声和随口敷衍，其实差得有多远呢？"],
  ["善之与恶，相去若何？", "被人称作善和被人称作恶，很多时候又差得了多少呢？"],
  ["人之所畏，不可不畏。", "众人都畏惧的东西，我也不能完全不放在心上。"],
  ["荒兮其未央哉！", "这种风气漫无边际，好像没有尽头。"],
  ["众人熙熙，如享太牢，如春登台。", "众人兴高采烈，像参加盛宴，又像春天登台看景。"],
  ["我独怕兮其未兆；", "只有我淡淡的，好像还没有被什么念头牵动。"],
  ["如婴儿之未孩；", "像婴儿还不会笑闹那样朴素未分。"],
  ["儽儽兮若无所归。", "疲惫散漫，好像没有地方可以归去。"],
  ["众人皆有馀，而我独若遗。", "众人都显得绰绰有余，只有我像漏掉了什么。"],
  ["我愚人之心也哉！", "我这颗心，简直像愚人一样迟钝。"],
  ["沌沌兮，俗人昭昭，我独若昏。", "我混沌不分；世人都显得明亮精细，只有我像昏昏然。"],
  ["俗人察察，我独闷闷。", "世人都精明审察，只有我显得迟缓沉默。"],
  ["澹兮其若海，飂兮若无止，众人皆有以，而我独顽似鄙。", "我的心像大海一样空阔，又像风一样没有定处；众人都有一套本事，只有我像顽钝粗鄙。"],
  ["我独异于人，而贵食母。", "我和众人不同，只是更看重养育万物的根本。"],
  ["孔德之容，唯道是从。", "大德呈现出来的样子，完全顺着道而来。"],
  ["道之为物，唯恍唯惚。", "道作为一种存在，恍惚难定，不能像器物那样抓住。"],
  ["忽兮恍兮，其中有象；", "它恍恍惚惚，其中却隐约有形象。"],
  ["恍兮忽兮，其中有物。", "它忽明忽暗，其中却隐约有真实的东西。"],
  ["窈兮冥兮，其中有精；", "它深远幽暗，其中却有生命的精微。"],
  ["其精甚真，其中有信。", "这种精微非常真实，里面有可以验证的力量。"],
  ["自古及今，其名不去，以阅众甫。", "从古到今，道这个名字没有消失，因为人们总能借它观察万物的开端。"],
  ["吾何以知众甫之状哉？", "我凭什么知道万物初生时的样子呢？"],
  ["以此。", "就是凭这个道来体会。"],
  ["曲则全，枉则直，洼则盈，弊则新，少则得，多则惑。", "能委曲反而保全，能弯下反而伸直；低洼才会被注满，旧了才会更新；少取反而有所得，贪多反而迷惑。"],
  ["不自见，故明；", "不急着表现自己，反而看得更明白。"],
  ["不自是，故彰；", "不总觉得自己对，真正的是非反而更清楚。"],
  ["不自伐，故有功；", "不自我夸耀，功劳反而站得住。"],
  ["不自矜，故长。", "不端着自我优越，反而能长久。"],
  ["夫唯不争，故天下莫能与之争。", "正因为不把一切变成争夺，天下也就没有什么能和他争。"],
  ["古之所谓曲则全者，岂虚言哉！", "古人说委曲才能保全，哪里是空话呢？"],
  ["诚全而归之。", "真正能保全的人，最后自然会回到完整。"],
  ["希言自然，故飘风不终朝，骤雨不终日。", "少说强硬的话，才合乎自然；狂风刮不了一早上，暴雨也下不了一整天。"],
  ["孰为此者？", "是谁让它们这样不能长久呢？"],
  ["天地。", "是天地本身。"],
  ["天地尚不能久，而况于人乎？", "天地的猛烈变化都不能持久，何况人强作出来的东西呢？"],
  ["故从事于道者，道者，同于道；", "所以按道行事的人，会让自己和道同频。"],
  ["德者，同于德；", "按德行事的人，会和德相应。"],
  ["失者，同于失。", "总在失落和偏离里行动的人，也会和失落相应。"],
  ["同于道者，道亦乐得之；", "和道相应的人，道也自然接纳他。"],
  ["同于德者，德亦乐得之；", "和德相应的人，德也自然接纳他。"],
  ["同于失者，失亦乐得之。", "和失落相应的人，失落也会把他带走。"],
  ["企者不立；", "踮起脚想站得更高，反而站不稳。"],
  ["跨者不行；", "迈得过大想走得更快，反而走不远。"],
  ["自见者不明；", "总急着显摆自己的人，反而看不清。"],
  ["自是者不彰；", "总认定自己正确的人，反而不能把道理说明白。"],
  ["自伐者无功；", "总夸耀自己的人，反而立不起真正的功劳。"],
  ["自矜者不长。", "总端着自己的人，反而不能长久。"],
  ["其在道也，曰：馀食赘行。", "从道的角度看，这些都像剩饭和多余的赘疣。"],
  ["物或恶之，故有道者不处。", "这些东西人人都会厌烦，所以有道的人不会停留在这种姿态里。"],
  ["有物混成，先天地生。", "有一种浑然成形的东西，在天地出现以前就已经存在。"],
  ["寂兮寥兮，独立不改，周行而不殆，可以为天下母。", "它寂静空阔，独立存在而不改变，循环运行而不衰竭，可以说是天下万物的母体。"],
  ["吾不知其名，字之曰道，强为之名曰大。", "我不知道它真正的名字，只好叫它“道”，又勉强称它为“大”。"],
  ["大曰逝，逝曰远，远曰反。", "大就会运行，运行就会伸展到远处，远到极处又会返回根本。"],
  ["故道大，天大，地大，王亦大。", "所以道大，天大，地大，能守住大道的王也大。"],
  ["域中有四大，而王居其一焉。", "天地之间有四种“大”，人间的治理者也是其中之一。"],
  ["人法地，地法天，天法道，道法自然。", "人取法于地，地取法于天，天取法于道，道则顺着万物自己的自然。"],
  ["重为轻根，静为躁君。", "厚重是轻率的根，安静是躁动的主心骨。"],
  ["虽有荣观，燕处超然。", "即使眼前有华丽享乐，也能安然处之，不被它牵走。"],
  ["奈何万乘之主，而以身轻天下？", "身负天下的人，怎么可以轻率地拿自身和天下冒险呢？"],
  ["轻则失本，躁则失君。", "轻率就会失去根本，急躁就会失去主导。"],
  ["善行无辙迹，善言无瑕讁；", "真正会走路的人不留下刻意痕迹，真正会说话的人不留下可挑剔的破绽。"],
  ["善数不用筹策；", "真正会计算的人，不必总靠筹码工具。"],
  ["善闭无关楗而不可开，善结无绳约而不可解。", "真正善于关闭，不靠门闩也没人能开；真正善于联结，不靠绳结也没人能解。"],
  ["常善救物，故无弃物。", "也总能成全万物，所以没有什么被随便丢弃。"],
  ["是谓袭明。", "这叫承接并运用真正的明智。"],
  ["故善人者，不善人之师；", "善良成熟的人，可以成为不成熟之人的老师。"],
  ["不善人者，善人之资。", "不成熟的人，也能成为善者反观和成就自己的材料。"],
  ["不贵其师，不爱其资，虽智大迷，是谓要妙。", "不尊重老师，也不珍惜可借鉴的材料，就算自以为聪明，也会陷入大迷糊；这正是微妙关键。"],
  ["知其雄，守其雌，为天下溪。", "知道强健的一面，却守住柔顺的位置，就能像天下溪流那样容纳万物。"],
  ["为天下溪，常德不离，复归于婴儿。", "能做天下溪流，恒常之德就不会离开，人也会回到婴儿般的纯和。"],
  ["知其白，守其黑，为天下式。", "知道明亮的一面，却守住幽暗低处，就能成为天下的范式。"],
  ["为天下式，常德不忒，复归于无极。", "能成为天下范式，恒常之德就不偏离，人也会回到无边无极。"],
  ["知其荣，守其辱，为天下谷。", "知道荣耀是什么，却守得住卑下受辱的位置，就能像山谷一样承接天下。"],
  ["为天下谷，常德乃足，复归于朴。", "能做天下山谷，恒常之德才会充足，人也会回到朴素完整。"],
  ["将欲取天下而为之，吾见其不得已。", "想把天下抓到手里强行改造，我看这件事根本做不成。"],
  ["天下神器，不可为也，为者败之，执者失之。", "天下像一件神圣的器物，不能硬造硬控；越强行摆弄越会败坏，越想抓住越会失去。"],
  ["故物或行或随；", "所以万物有的走在前面，有的跟在后面。"],
  ["或歔或吹；", "有的缓缓吸气，有的急急吹气。"],
  ["或强或羸；", "有的强健，有的柔弱。"],
  ["或挫或隳。", "有的被挫折，有的会崩落。"],
  ["以道佐人主者，不以兵强天下。", "用道辅佐君主的人，不会靠武力在天下逞强。"],
  ["其事好还。", "战争这种事，往往会反过来报应自身。"],
  ["师之所处，荆棘生焉。", "军队驻扎过的地方，常常只剩荆棘荒凉。"],
  ["大军之后，必有凶年。", "大战之后，往往接着荒年和苦日子。"],
  ["善有果而已，不敢以取强。", "善于用兵的人只是达到必要结果，不敢借胜利逞强。"],
  ["果而勿矜，果而勿伐，果而勿骄。", "达成结果也不自矜、不夸耀、不骄横。"],
  ["果而不得已，果而勿强。", "即使成功，也要知道这是不得已而为，不要继续强硬推进。"],
  ["物壮则老，是谓不道，不道早已。", "事物强盛到过头就会衰老；这叫偏离道，偏离道就会很快结束。"],
  ["夫佳兵者，不祥之器，物或恶之，故有道者不处。", "再好的兵器也是不祥之物，万物都厌恶它，所以有道的人不会安居其中。"],
  ["君子居则贵左，用兵则贵右。", "平常礼仪以左为尊，用兵丧礼则以右为尊。"],
  ["兵者不祥之器，非君子之器，不得已而用之，恬淡为上。", "兵器是不祥之物，不是君子愿意依靠的东西；不得已使用时，也要以冷静淡泊为上。"],
  ["夫乐杀人者，则不可以得志于天下矣。", "喜欢杀人的人，不可能真正实现治理天下的志向。"],
  ["吉事尚左，凶事尚右。", "吉庆之事崇尚左边，凶丧之事崇尚右边。"],
  ["偏将军居左，上将军居右，言以丧礼处之。", "副将居左，主将居右，是说战争应当按丧礼的心情来对待。"],
  ["杀人之众，以哀悲泣之，战胜以丧礼处之。", "杀伤众多生命，要用哀痛悲泣的心面对；即使战胜，也要像办丧事那样处理。"],
  ["道常无名。", "道本来没有固定名字。"],
  ["朴虽小，天下莫能臣也。", "朴素的道看似微小，天下却没有谁能支配它。"],
  ["侯王若能守之，万物将自宾。", "侯王若能守住这种朴素，万物自然会归附。"],
  ["天地相合，以降甘露，民莫之令而自均。", "天地之气相合，就会降下甘露；没有人命令，万物也会自然均衡。"],
  ["始制有名，名亦既有，夫亦将知止，知止所以不殆。", "制度一建立，名分也就出现；有了名分就要知道停止，懂得停止才不会危险。"],
  ["譬道之在天下，犹川谷之与江海。", "道在天下，就像溪谷自然流向江海。"],
  ["胜人者有力，自胜者强。", "能胜过别人是有力量，能胜过自己才是真强大。"],
  ["知足者富。", "知道满足的人，才是真正富有。"],
  ["强行者有志。", "能坚持向前的人，说明内心有志向。"],
  ["不失其所者久。", "不离开自己根本位置的人，才能长久。"],
  ["死而不亡者寿。", "身体会死而精神影响不消失，这才叫真正长寿。"],
  ["大道泛兮，其可左右。", "大道广泛流动，左右万方都能到达。"],
  ["万物恃之而生而不辞，功成不名有。", "万物依靠它生长，它却不推辞；功业成了，也不说这是自己所有。"],
  ["衣养万物而不为主，常无欲，可名于小；", "它养护万物却不做主宰，常常没有占有欲，所以可以说很细微。"],
  ["万物归焉，而不为主，可名为大。", "万物都归向它，它却不自居为主，所以又可以说很伟大。"],
  ["以其终不自为大，故能成其大。", "正因为它始终不自称伟大，才成就了真正的伟大。"],
  ["执大象，天下往。", "抓住大道的整体方向，天下自然会归往。"],
  ["往而不害，安平大。", "人们归往而不受伤害，就能安定、平和、宽广。"],
  ["乐与饵，过客止。", "音乐和美食能让过路人停下。"],
  ["道之出口，淡乎其无味，视之不足见，听之不足闻，用之不足既。", "道说出口时平淡得像没有味道，看它不够显眼，听它不够动听，但用起来却无穷无尽。"],
  ["将欲歙之，必固张之；", "想让它收缩，往往先让它扩张。"],
  ["将欲弱之，必固强之；", "想让它变弱，往往先让它逞强。"],
  ["将欲废之，必固兴之；", "想让它废落，往往先让它兴盛。"],
  ["将欲夺之，必固与之。", "想要夺取，往往先给出去。"],
  ["是谓微明。", "这叫看见细微处的明白。"],
  ["鱼不可脱于渊，国之利器不可以示人。", "鱼不能离开深渊，国家真正锋利的工具也不该轻易示人。"],
  ["道常无为而无不为。", "道总是不强作，却没有什么不是由它成就。"],
  ["侯王若能守之，万物将自化。", "侯王若能守住这一点，万物就会自然变化生长。"],
  ["化而欲作，吾将镇之以无名之朴。", "变化中若又起了躁动欲望，我就用无名的朴素来安定它。"],
  ["无名之朴，夫亦将无欲。", "回到这种无名的朴素，也就会少了贪欲。"],
  ["不欲以静，天下将自定。", "少了贪欲而安静下来，天下自然会安定。"],
  ["上德不德，是以有德；", "最高的德不刻意表现自己有德，所以反而真的有德。"],
  ["下德不失德，是以无德。", "低一层的德总怕失去德名，所以反而没有真正的德。"],
  ["上德无为而无以为；", "最高的德顺其自然地做事，并不带着私心目的。"],
  ["下德为之而有以为。", "低一层的德刻意去做，而且总有所图。"],
  ["上仁为之而无以为；", "最高的仁会主动成全别人，但不带私心盘算。"],
  ["上义为之而有以为。", "最高的义会有所作为，但已经带着判断和目的。"],
  ["上礼为之而莫之应，则攘臂而扔之。", "礼一旦变成外在动作，别人不响应，就会挽起袖子强迫人服从。"],
  ["故失道而后德，失德而后仁，失仁而后义，失义而后礼。", "所以失去道才强调德，失去德才强调仁，失去仁才强调义，失去义才只剩礼。"],
  ["夫礼者，忠信之薄，而乱之首。", "礼法常常是忠信变薄后的补丁，也可能成为混乱的开端。"],
  ["前识者，道之华，而愚之始。", "自以为能预先看透一切，只是道的浮华，也可能是愚昧的开始。"],
  ["是以大丈夫处其厚，不居其薄；", "所以真正成熟的人选择厚实，不停留在浅薄。"],
  ["处其实，不居其华。", "选择真实，不停留在虚华。"],
  ["昔之得一者：天得一以清；", "古来守住这个“一”的：天因它而清明。"],
  ["地得一以宁；", "地因它而安宁。"],
  ["神得一以灵；", "神妙之物因它而灵动。"],
  ["谷得一以盈；", "山谷因它而充盈。"],
  ["万物得一以生；", "万物因它而生长。"],
  ["侯王得一以为天下贞。", "侯王因它而能成为天下的正定根基。"],
  ["其致之，天无以清，将恐裂；", "推到反面看，天若不能清明，恐怕就会崩裂。"],
  ["地无以宁，将恐发；", "地若不能安宁，恐怕就会震动翻覆。"],
  ["神无以灵，将恐歇；", "神妙之物若不能灵动，恐怕就会停息。"],
  ["谷无以盈，将恐竭；", "山谷若不能充盈，恐怕就会枯竭。"],
  ["万物无以生，将恐灭；", "万物若不能生长，恐怕就会灭绝。"],
  ["侯王无以贵高将恐蹶。", "侯王若只知道追求尊贵高位，恐怕就会跌倒。"],
  ["故贵以贱为本，高以下为基。", "所以尊贵以卑贱为根本，高处以下方为基础。"],
  ["是以侯王自称孤、寡、不谷。", "因此侯王常自称孤、寡、不谷，是用低位来提醒自己。"],
  ["此非以贱为本耶？", "这不正是把低下当作根本吗？"],
  ["非乎？", "难道不是吗？"],
  ["故致数誉无誉。", "追求过多赞誉，最后反而没有真正的荣誉。"],
  ["不欲琭琭如玉，珞珞如石。", "不必追求像美玉那样耀眼，也不必像硬石那样棱角逼人。"],
  ["反者道之动；", "道的运动常常是返回和反转。"],
  ["弱者道之用。", "道发挥作用时，常常表现为柔弱。"],
  ["天下万物生于有，有生于无。", "天下万物从“有”中生出，而“有”又从“无”中生出。"],
  ["天长地久。", "天地看起来能够长久存在，是因为它不围着自己的私利打转。"],
  ["天地。", "答案就在天地本身：连风雨都不能一直猛烈，强作更不会持久。"],
  ["柔弱胜刚强。", "真正能穿透强硬的，常常是柔弱而持续的力量。"],
  ["故去彼取此。", "所以要舍掉浮华浅薄的那一边，选择厚实真实的这一边。"],
  ["地得一以宁；", "大地守住这个根本，才得以安宁，能够承载万物。"],
  ["谷得一以盈；", "山谷守住这个根本，保持空处，才会被水气充满。"],
  ["万物得一以生；", "万物守住这个根本，才会获得生生不息的力量。"],
  ["非乎？", "难道这还不是在说明：低处和卑下才是根本吗？"],
  ["下士闻道，大笑之。", "浅薄的人听到道，只会觉得可笑，因为它不合他们熟悉的成功套路。"],
  ["不笑不足以为道。", "如果从不让浅薄的人发笑，它反倒不像真正的道。"],
  ["进道若退；", "真正向道靠近，有时看起来像是在后退。"],
  ["夷道若纇；", "平坦的大道，有时看起来反而像崎岖不平。"],
  ["上德若谷；", "最高的德像山谷一样低下空阔，能容纳万物。"],
  ["太白若辱；", "最纯净的白，反而像含着污痕，不急着显摆洁白。"],
  ["广德若不足；", "广大的德行，反而像还不够满，不自我夸张。"],
  ["建德若偷；", "扎实建立起来的德，反而像不显山露水。"],
  ["质真若渝；", "最真实的质地，外表反而像会变化、不固定。"],
  ["大方无隅；", "真正大的方正，不会露出尖锐的棱角。"],
  ["大器晚成；", "真正能承载大用的器物，往往成得慢。"],
  ["大音希声；", "真正宏大的声音，反而近乎听不见。"],
  ["大象无形；", "真正宏大的形象，反而不局限在一个固定形体里。"],
  ["名与身孰亲？", "名声和生命相比，哪一个更亲近、更重要？"],
  ["身与货孰多？", "身体生命和财货相比，哪一个更值得珍惜？"],
  ["得与亡孰病？", "得到外物和失去根本相比，哪一个才是真正的祸患？"],
  ["是故甚爱必大费；", "所以过分贪爱某样东西，必然付出很大的代价。"],
  ["多藏必厚亡。", "积藏越多，失去时也越沉重。"],
  ["躁胜寒静胜热。", "躁动可以驱寒，清静可以消热；两者都有适用的位置。"],
  ["清静为天下正。", "真正能让天下回到正轨的，是清静克制而不是躁动折腾。"],
  ["不出户知天下；", "不必跑遍天下，也能从身边规律看见天下的道理。"],
  ["不闚牖见天道。", "不必趴在窗前张望，也能体会自然运行的法则。"],
  ["善者，吾善之；", "善良的人，我以善意对待他。"],
  ["德善。", "这样一来，善意本身就会被成全和扩展。"],
  ["信者，吾信之；", "可信的人，我以信任回应他。"],
  ["德信。", "这样一来，信任本身就会被成全和扩展。"],
  ["出生入死。", "人从出生走向死亡，生命本来就在这条路上移动。"],
  ["生之徒，十有三；", "偏向保全生命的人，大约占一部分。"],
  ["死之徒，十有三；", "偏向伤害生命、走向死亡的人，也占一部分。"],
  ["夫何故？", "为什么会这样呢？关键还在于人怎样对待生命。"],
  ["以其生，生之厚。", "因为人太贪恋生命享受，反而把生命耗得太厚太重。"],
  ["以其无死地。", "因为他不把自己推到死亡的险地里。"],
  ["道之尊，德之贵，夫莫之命常自然。", "道之所以尊贵、德之所以可贵，并不是谁命令出来的，而是万物自然如此。"],
  ["长之育之；", "让万物成长，也养育它们。"],
  ["亭之毒之；", "让万物安定成形，也经历成熟变化。"],
  ["养之覆之。", "养护它们，也覆盖保护它们。"],
  ["是为习常。", "这就叫熟悉并守住恒常之道。"],
  ["是谓盗夸。", "这就叫盗贼式的炫耀，靠掠夺来装体面。"],
  ["非道也哉！", "这当然不是合乎道的做法。"],
  ["骨弱筋柔而握固。", "婴儿筋骨柔弱，握拳却很有力量，说明生命力正充足。"],
  ["心使气曰强。", "用意志硬逼气息运行，就叫逞强。"],
  ["故为天下贵。", "所以这种境界才会被天下看重。"],
  ["吾何以知其然哉？", "我凭什么知道事情是这样呢？"],
  ["孰知其极？", "谁又能知道变化最终会走到哪里呢？"],
  ["其无正。", "很多事情没有一个永远固定不变的正面。"],
  ["人之迷，其日固久。", "人们在这种反复里迷失，已经不是一天两天了。"],
  ["早服谓之重积德；", "早早顺服并守住节制，就叫不断积累德。"],
  ["重积德则无不克；", "德积得深了，就没有什么不能承受、不能克服。"],
  ["治大国若烹小鲜。", "治理大国像煎小鱼，少翻少折腾，才不至于弄碎。"],
  ["无执故无失。", "不死死抓住，就不容易失去。"],
  ["若肖久矣。", "如果道变得像某个具体东西，它早就变小、变普通了。"],
  ["其细也夫！", "那样一来，它就太细小有限了。"],
  ["慈故能勇；", "因为有慈爱，勇敢才不会变成鲁莽。"],
  ["俭故能广；", "因为懂节俭，力量才可以铺得更广。"],
  ["今舍慈且勇；", "现在若丢掉慈爱，只想逞勇。"],
  ["舍俭且广；", "丢掉节制，只想铺张扩大。"],
  ["舍后且先；", "丢掉退让，只想抢在前面。"],
  ["死矣！", "这样走下去，就离失败和死亡不远了。"],
  ["善为士者，不武；", "真正善于带兵的人，不靠逞武好斗来显本事。"],
  ["善战者，不怒；", "真正善战的人，不靠愤怒驱动自己。"],
  ["善胜敌者，不与；", "真正善于胜敌的人，不和对方陷入硬碰硬的争斗。"],
  ["不敢进寸，而退尺。", "不敢贪进一寸，宁可先退一尺。"],
  ["是谓行无行；", "这叫行动时不露出强行进逼的姿态。"],
  ["攘无臂；", "这叫举臂时像没有举臂那样不显攻击。"],
  ["扔无敌；", "这叫交锋时不把对方推成死敌。"],
  ["执无兵。", "这叫握有兵器却不依赖兵器逞强。"],
  ["言有宗，事有君。", "话有根源，事情有主旨，并不是随口乱说。"],
  ["知不知上；", "知道自己还有不知道的东西，这是上等的明白。"],
  ["不知知病。", "不知道却以为自己知道，这就是毛病。"],
  ["自爱不自贵。", "他爱惜自己，但不把自己摆得高高在上。"],
  ["天之道，不争而善胜，不言而善应，不召而自来，繟然而善谋。", "天道不争却善于取胜，不说话却能回应，不召唤也会到来，宽缓从容却安排得很周到。"],
  ["常有司杀者杀。", "生死自有主宰杀伐的规律，不该由人随意代替。"],
  ["天之道，其犹张弓与？", "天道像拉弓一样，会把高处压低，把低处抬起。"],
  ["天之道，损有馀而补不足。", "天道会削减多余的，补给不足的。"],
  ["人之道，则不然，损不足以奉有馀。", "人的做法常常相反，削减不足者，去供养有余者。"],
  ["正言若反。", "真正正直的话，听起来常常像是反着说。"],
  ["和大怨，必有馀怨；", "调和很深的怨恨，往往还会留下余怨。"],
  ["安可以为善？", "这样怎么能算真正妥善呢？"],
  ["上士闻道，勤而行之；", "上等根器的人听到道，会认真去实行。"],
  ["中士闻道，若存若亡；", "中等根器的人听到道，半信半疑，时而记得时而忘记。"],
  ["人之所教，我亦教之。", "别人用来教人的道理，我也会拿来反省和教人。"],
  ["不言之教，无为之益，天下希及之。", "不用言语的教化、顺势而为的好处，天下很少有人真正赶得上。"],
  ["不善者，吾亦善之；", "不够善良的人，我也用善意对待他，让善意有机会扩散。"],
  ["不信者，吾亦信之；", "不够守信的人，我也先以信任相待，让信任有机会被唤回。"],
  ["道生之，德畜之，物形之，势成之。", "道让万物发生，德养护万物，具体事物给它形体，环境条件促成它成熟。"],
  ["故道生之，德畜之；", "所以说道使万物发生，德使万物得到养护。"],
  ["为者败之，执者失之。", "越想强行摆弄，越容易败坏；越想死死抓住，越容易失去。"],
  ["民之从事，常于几成而败之。", "人们做事，常常是在快要成功的时候松劲或躁进，结果败掉。"],
  ["江海所以能为百谷王者，以其善下之，故能为百谷王。", "江海能成为百川归往之处，是因为它善于处在低下的位置。"],
  ["欲先民，必以身后之。", "想走在百姓前面，就要先把自己的身段放到后面。"],
  ["我有三宝，持而保之。", "我有三件宝贝，一直守着并珍惜它们。"],
  ["天将救之，以慈卫之。", "天若要护佑一个人，也会用慈爱来守护他。"],
  ["夫唯病病，是以不病。", "正因为能把这种毛病当成毛病，才不会被它困住。"],
  ["民不畏死，奈何以死惧之？", "百姓已经不怕死了，还用死亡去恐吓他们，又有什么用呢？"],
  ["若使民常畏死，而为奇者，吾得执而杀之，孰敢？", "如果百姓真的常常畏惧死亡，那么抓住作乱的人处置，谁还敢乱来呢？"],
  ["高者抑之，下者举之；", "高的要压低，低的要抬起，让两边回到平衡。"],
  ["有馀者损之，不足者补之。", "多余的要减少，不足的要补上，这才是自然的均衡。"],
  ["虽有舟舆，无所乘之，虽有甲兵，无所陈之。", "即使有车船，也没有必要频繁乘坐远行；即使有兵器，也没有必要摆出来炫耀。"],
  ["使民复结绳而用之，甘其食，美其服，安其居，乐其俗。", "让人回到朴素生活，吃得甘美，穿得舒适，住得安稳，也喜欢自己的风俗。"],
  ["人之所恶，唯孤、寡、不谷，而王公以为称。", "人们厌恶孤、寡、不谷这些低微称呼，王公却用它们自称，提醒自己别忘了低处。"],
  ["祸兮福之所倚，福兮祸之所伏。", "祸里面可能伏着福，福里面也可能藏着祸，事情常会互相转化。"],
  ["是谓深根固柢，长生久视之道。", "这叫把根扎深、把本固住，是让生命和事业长久的路。"],
  ["善人之宝，不善人之所保。", "道是善良者珍贵的宝物，也是不够善良者可以依靠的保护。"],
  ["古之所以贵此道者何？", "古人为什么如此看重这个道呢？"],
  ["学不学，复众人之所过，以辅万物之自然，而不敢为。", "学习那种不执着于学问名相的学问，修复众人走偏的地方，辅助万物回到自然，而不敢强行摆布。"],
  ["天之所恶，孰知其故？", "天道厌恶什么、为什么厌恶，谁又能完全说清呢？"],
  ["使有什伯之器而不用；", "即使有各种成倍提高效率的器具，也不必被工具牵着走。"],
  ["知足不辱，知止不殆。", "知道满足就不容易受辱，知道停下就不容易陷入危险。"],
  ["知者不言，言者不知。", "真正懂的人不急着卖弄；急着说满的人，往往还没有真懂。"],
  ["小国寡民。", "理想的共同体很小，人也不多。"],
  ["信言不美，美言不信。", "可靠的话常常不漂亮，漂亮的话未必可靠。"],
  ["圣人之道，为而不争。", "圣人的做法是把事情做成，却不拿它来争名夺利。"],
  ["是以圣人之治，虚其心，实其腹，弱其志，强其骨。", "所以理想的治理，是让人少些机巧躁动，先安顿吃饭生活，减少逞强争胜，保住身体和根基。"],
  ["常使民无知无欲。", "让人少被机巧和欲望牵着走，回到朴素安稳的状态。"],
  ["使夫知者不敢为也。", "即使有聪明机巧的人，也不敢拿这些东西去妄作妄为。"],
  ["圣人不仁，以百姓为刍狗。", "圣人也不靠私情偏爱治理百姓，而是让人各按其性自然安顿。"],
  ["是以圣人后其身而身先；", "所以圣人把自己放在后面，反而被众人推到前面。"],
  ["爱民治国，能无知乎？", "爱护百姓、治理国家，能不能少用机巧算计？"],
  ["明白四达，能无知乎？", "明白通达四方，还能不能保持不自作聪明？"],
  ["是以圣人为腹不为目，故去彼取此。", "所以圣人重视养护根本生活，不追逐眼目的刺激，舍掉外诱，守住内在。"],
  ["是以圣人抱一为天下式。", "所以圣人守住这个“一”，成为天下可效法的样子。"],
  ["是以圣人终日行不离辎重。", "所以圣人整天行走，也不离开承载根本的重车。"],
  ["是以圣人常善救人，故无弃人；", "所以圣人总是善于救人，不轻易把任何人当成废弃之人。"],
  ["朴散则为器，圣人用之，则为官长，故大制不割。", "朴素的整体分散后成为各种器用，圣人顺着这些器用安排职分，但大的治理不切割万物。"],
  ["是以圣人去甚，去奢，去泰。", "所以圣人去掉过分、奢侈和骄泰，保留适度。"],
  ["胜而不美，而美之者，是乐杀人。", "即使打胜了也不该觉得光彩；把胜利当美事，就是在喜欢杀人。"],
  ["知人者智，自知者明。", "了解别人是聪明，了解自己才是明白。"],
  ["是以圣人不行而知，不见而名，不为而成。", "所以圣人不必到处奔走也能知道，不必亲眼占有也能明白，不强作也能成事。"],
  ["圣人无常心，以百姓心为心。", "圣人没有固定私心，而是把百姓的心当作自己的心。"],
  ["圣人在天下，歙歙为天下浑其心，百姓皆注其耳目，圣人皆孩之。", "圣人在天下收敛自己的锋芒，使人心归于浑朴；百姓张着耳目追逐外物，圣人则像照看孩子一样安顿他们。"],
  ["未知牝牡之合而全作，精之至也。", "还不懂男女交合，却自然完整地发动生命力，这是精气充足到极点的表现。"],
  ["故圣人云：我无为，而民自化；", "所以圣人说：我不强行干预，百姓自己会变化成长。"],
  ["是以圣人方而不割，廉而不刿，直而不肆，光而不耀。", "所以圣人方正却不割伤人，清廉却不刺人，正直却不放肆，有光却不炫耀。"],
  ["非其神不伤人，圣人亦不伤人。", "不是鬼神不伤人，而是圣人也不以权力伤人。"],
  ["夫两不相伤，故德交归焉。", "双方都不相互伤害，德就会在彼此之间汇聚。"],
  ["图难于其易，为大于其细；", "处理难事，要从它还容易的时候开始；成就大事，要从细小处下手。"],
  ["天下难事，必作于易，天下大事，必作于细。", "天下的难事一定从容易处开始，天下的大事一定从细小处开始。"],
  ["是以圣人终不为大，故能成其大。", "所以圣人始终不自称伟大，反而能成就真正的大。"],
  ["夫轻诺必寡信，多易必多难。", "轻易许诺的人往往信用少，把事情看得太容易，困难就会变多。"],
  ["是以圣人犹难之，故终无难矣。", "所以圣人把事情看得谨慎艰难，最后反而没有大难。"],
  ["是以圣人无为故无败；", "所以圣人不强行把控，便少有失败。"],
  ["慎终如始，则无败事，是以圣人欲不欲，不贵难得之货；", "结尾像开头一样谨慎，就不会败事；所以圣人把“不被欲望牵动”当作欲望，不看重难得之货。"],
  ["古之善为道者，非以明民，将以愚之。", "古代善于行道的人，不是让百姓变得机巧逞智，而是让他们回到朴素少诈。"],
  ["是以圣人欲上民，必以言下之；", "所以圣人想站在人民之上，必须先在言语上把自己放低。"],
  ["是以圣人处上而民不重，处前而民不害。", "所以圣人处在上位，百姓不觉得沉重；走在前面，百姓也不觉得受害。"],
  ["夫唯无知，是以不我知。", "正因为世人不了解这个根本，所以也不了解我。"],
  ["知我者希，则我者贵。", "真正懂我的人很少，能效法我的人也就更可贵。"],
  ["是以圣人被褐怀玉。", "所以圣人外表穿着粗布，内里却怀着美玉。"],
  ["圣人不病，以其病病，是以不病。", "圣人没有这种毛病，因为他把这种毛病当作毛病，所以不会陷进去。"],
  ["是以圣人自知不自见；", "所以圣人了解自己，却不故意表现自己。"],
  ["是以圣人犹难之。", "所以圣人面对这种事也保持谨慎，不轻易断言。"],
  ["是以圣人云：受国之垢，是谓社稷主；", "所以圣人说：能承受国家的污垢和难处，才配做社稷之主。"],
  ["是以圣人执左契，而不责于人。", "所以圣人拿着契约中自己该守的一半，却不急着责逼别人。"],
  ["善者不辩，辩者不善。", "真正善于此道的人不靠争辩取胜，爱争辩的人反而离它远。"],
  ["知者不博，博者不知。", "真正知道根本的人不靠杂多炫耀，追逐博杂的人反而未必知道根本。"],
  ["圣人不积，既以为人己愈有，既以与人己愈多。", "圣人不囤积；越是帮助别人，自己越充实；越是给予别人，自己越丰足。"],
  ["天之道，利而不害；", "天道是让万物得其利，而不是伤害万物。"]
];

const exactParaphrases = new Map();
for (const [sentence, paraphrase] of exactParaphraseEntries) {
  exactParaphrases.set(normalizeSourceText(sentence), paraphrase);
}

const contextualParaphrases = new Map([
  ["c17-s05", "治理者自己不够诚信，百姓自然不会把信任交出来。"],
  ["c23-s11", "说话和承诺的分量不够，别人不相信也是自然结果。"],
  ["c38-s13", "所以要舍掉浮薄礼饰，选择厚实真实的德。"],
  ["c41-s17", "道隐藏在万物运行之中，不会固定成一个响亮的名字。"],
  ["c50-s05", "为什么会这样？关键在于人怎样看待生命。"],
  ["c50-s09", "为什么能避开死地？因为他不把自己推向危险。"],
  ["c51-s08", "生养万物而不占有，做成事情而不仗恃，扶持成长而不主宰，这就叫深厚的德。"],
  ["c54-s09", "从个人、家庭、乡里、国家到天下，都可以用这个道来检验。"],
  ["c56-s06", "能把锋芒收住、和尘世相处，这样的人才被天下看重。"],
  ["c57-s10", "我减少贪欲，百姓也会自然回到朴素。"],
  ["c62-s08", "正因为道能保护和成全人，所以被天下看重。"],
  ["c72-s06", "所以要舍掉自贵自大的姿态，选择自知自爱的分寸。"],
  ["c77-s07", "所以圣人做事不仗恃，成事不占功，也不故意显出自己的贤能。"]
]);

const phraseGlosses = [
  [/^不尚贤/, "不把贤能包装成争名的对象"],
  [/^不贵难得之货/, "不抬高稀有财物的诱惑"],
  [/^不见可欲/, "不把欲望摆到人眼前刺激"],
  [/^虚其心/, "让心思少一点机巧和躁动"],
  [/^实其腹/, "先让基本生活得到安顿"],
  [/^弱其志/, "削弱逞强争胜的意志"],
  [/^强其骨/, "保住身体和生活的底子"],
  [/有无相生/, "有和无彼此生成"],
  [/难易相成/, "难和易互相成就"],
  [/长短相较/, "长和短靠比较才成立"],
  [/高下相倾/, "高和下彼此依存"],
  [/音声相和/, "音声相互配合才成和谐"],
  [/前后相随/, "前后也是互相跟随的关系"],
  [/功成身退/, "事情做成后及时退开"],
  [/为而不恃/, "做了事却不凭它自夸"],
  [/生而不有/, "生养万物却不占为己有"],
  [/道常无为/, "道总是不强作"],
  [/而无不为/, "却没有什么不是由它成就"],
  [/柔弱胜刚强/, "柔弱能胜过刚强"],
  [/天下莫柔弱于水/, "天下没有比水更柔弱的东西"],
  [/天之道/, "自然的运行方式"],
  [/人之道/, "人的惯常做法"],
  [/小国寡民/, "小而安定的共同体"],
  [/信言不美/, "可信的话不靠漂亮包装"],
  [/美言不信/, "漂亮话常常不可靠"]
];

function modernizeText(text) {
  let result = normalizeSourceText(text.trim());
  for (const [pattern, replacement] of phraseGlosses) {
    if (pattern.test(result)) return replacement;
  }
  result = result
    .replace(/天下/g, "世间")
    .replace(/皆/g, "都")
    .replace(/斯/g, "这就")
    .replace(/故/g, "所以")
    .replace(/是以/g, "因此")
    .replace(/夫唯/g, "正因为")
    .replace(/莫/g, "没有谁")
    .replace(/弗/g, "不")
    .replace(/不欲/g, "不被欲望牵着走")
    .replace(/无为/g, "不强行干预")
    .replace(/不争/g, "不争夺")
    .replace(/不恃/g, "不仗恃")
    .replace(/不居/g, "不占功")
    .replace(/无名/g, "还没有名称")
    .replace(/有名/g, "已经有名称")
    .replace(/万物/g, "万事万物")
    .replace(/圣人/g, "理想的治理者")
    .replace(/百姓/g, "人们")
    .replace(/民/g, "人们")
    .replace(/侯王/g, "掌权者")
    .replace(/贵/g, "看重")
    .replace(/欲/g, "欲望")
    .replace(/知/g, "知道")
    .replace(/德/g, "德行")
    .replace(/道/g, "道")
    .replace(/矣/g, "了")
    .replace(/乎/g, "吗")
    .replace(/者/g, "的人")
    .replace(/之/g, "的");

  return result;
}

function sceneFor(sentence) {
  const exact = exactVisuals.get(normalizeSourceText(sentence));
  if (exact) return exact.scene;
  const rule = sceneRules.find(([pattern]) => pattern.test(sentence));
  return rule?.[1] || "a plain village road after rain, footprints leading toward morning light";
}

function visualMeaningFor(sentence) {
  const exact = exactVisuals.get(normalizeSourceText(sentence));
  if (exact) return exact.meaning;
  if (/不争|不恃|不居|功成|无为/.test(sentence)) {
    return "effortless action, quiet leadership, letting things complete without taking credit";
  }
  if (/欲|货|金玉|宠|辱|知足|知止/.test(sentence)) {
    return "restraint before temptation, choosing enough over restless possession";
  }
  if (/水|柔|弱|谷|溪|婴儿|赤子/.test(sentence)) {
    return "softness, humility, low places, and resilient life";
  }
  if (/民|国|王|侯|兵|战|治/.test(sentence)) {
    return "governance through restraint, a quiet ruler listening instead of forcing";
  }
  if (/名|言|辩|知/.test(sentence)) {
    return "names and labels falling away so the living world can be seen directly";
  }
  if (/有无|难易|长短|高下|前后|祸福/.test(sentence)) {
    return "opposites arising together, light and shadow defining each other";
  }
  if (/身|生|死|寿|气|腹|骨/.test(sentence)) {
    return "protecting the root of life, breath settling into the body";
  }
  return "a person seeing the hidden pattern beneath ordinary life";
}

function compositionFor(sentence) {
  const exact = exactVisuals.get(normalizeSourceText(sentence));
  return exact?.composition || "cinematic 16:9 composition with a clear focal action and no repeated decorative motif";
}

function explainSentence(sentence, chapter, index, total, summary) {
  const normalizedSentence = normalizeSourceText(sentence);
  const id = `c${String(chapter).padStart(2, "0")}-s${String(index + 1).padStart(2, "0")}`;
  const plainReview = plainReviewed.get(id);
  const reviewed = interpretationOverrides.get(id);
  if (reviewed?.plain) {
    const mustShow = reviewed.imageSemantics?.mustShow || [];
    return {
      plain: plainReview?.plain || reviewed.plain,
      visualSeed: mustShow.length ? mustShow.join("; ") : sceneFor(sentence),
      visualMeaning: reviewed.decision || visualMeaningFor(normalizedSentence),
      interpretation: {
        ...reviewed,
        plain: plainReview?.plain || reviewed.plain,
        plainReview
      },
      chapterMood:
        chapter <= 20
          ? "opening chapters, mysterious but friendly"
          : chapter <= 44
            ? "middle chapters, social life and self-cultivation"
            : chapter <= 66
              ? "later chapters, governance, humility and restraint"
        : "closing chapters, distilled life wisdom"
    };
  }
  if (plainReview?.plain) {
    return {
      plain: plainReview.plain,
      visualSeed: sceneFor(sentence),
      visualMeaning: visualMeaningFor(normalizedSentence),
      interpretation: { plainReview },
      chapterMood:
        chapter <= 20
          ? "opening chapters, mysterious but friendly"
          : chapter <= 44
            ? "middle chapters, social life and self-cultivation"
            : chapter <= 66
              ? "later chapters, governance, humility and restraint"
              : "closing chapters, distilled life wisdom"
    };
  }
  const plainOverride = plainOverrides.get(id);
  if (plainOverride?.plain) {
    return {
      plain: plainOverride.plain,
      visualSeed: sceneFor(sentence),
      visualMeaning: visualMeaningFor(normalizedSentence),
      chapterMood:
        chapter <= 20
          ? "opening chapters, mysterious but friendly"
          : chapter <= 44
            ? "middle chapters, social life and self-cultivation"
            : chapter <= 66
              ? "later chapters, governance, humility and restraint"
              : "closing chapters, distilled life wisdom"
    };
  }
  const hasExact = exactParaphrases.has(normalizedSentence);
  const direct = contextualParaphrases.get(id) || exactParaphrases.get(normalizedSentence) || modernizeText(normalizedSentence);
  const directText = direct.replace(/[。；！？]$/, "");
  const plain = `${directText}。`;

  return {
    plain,
    visualSeed: sceneFor(sentence),
    visualMeaning: visualMeaningFor(normalizedSentence),
    chapterMood:
      chapter <= 20
        ? "opening chapters, mysterious but friendly"
        : chapter <= 44
          ? "middle chapters, social life and self-cultivation"
          : chapter <= 66
            ? "later chapters, governance, humility and restraint"
            : "closing chapters, distilled life wisdom"
  };
}

function makePrompt(sentence, explanation, chapter, sentenceIndex) {
  const normalizedSentence = normalizeSourceText(sentence);
  return [
    "16:9 cinematic comic panel for a Chinese classics reading website.",
    `Original sentence: ${normalizedSentence}`,
    `Scene: ${explanation.visualSeed}.`,
    `Meaning to express: ${explanation.visualMeaning || visualMeaningFor(normalizedSentence)}.`,
    `Composition: ${compositionFor(normalizedSentence)}.`,
    `Chapter ${chapter}, panel ${sentenceIndex + 1}, ${explanation.chapterMood}.`,
    "Style: consistent warm ink-and-watercolor comic, clean expressive line art, subtle rice paper texture, soft mineral colors, same book illustration style across panels, readable emotion. Make this panel visually distinct from the previous and next panel: use a different main subject, setting, action, and foreground object. Fill the entire 16:9 frame with artwork. Strict negative instruction: no text, no letters, no Chinese characters, no calligraphy, no writing marks, no symbols, no captions, no seal, no stamp, no signature, no logo, no watermark, no border, no matte, no frame, no empty side margins, no distorted hands."
  ].join(" ");
}

function buildChapter({ chapter, node, text, sourceUrl }) {
  const summary = chapterTitleAndGist(text);
  const rawSentences = splitSentences(text);
  const sentences = rawSentences.map((sentence, index) => {
    const explanation = explainSentence(sentence, chapter, index, rawSentences.length, summary);
    const id = `c${String(chapter).padStart(2, "0")}-s${String(index + 1).padStart(2, "0")}`;
    return {
      id,
      sentence,
      plain: explanation.plain,
      interpretation: explanation.interpretation,
      image: `/comics/${id}-wide.png`,
      imagePrompt: promptOverrides.get(id) || makePrompt(sentence, explanation, chapter, index)
    };
  });

  return {
    chapter,
    node,
    title: summary.title,
    gist: summary.gist,
    text,
    sourceUrl,
    sentences
  };
}

async function loadCachedChapters() {
  const cached = JSON.parse(await readFile(OUTPUT_FILE, "utf8"));
  return cached.chapters.map((chapter) =>
    buildChapter({
      chapter: chapter.chapter,
      node: chapter.node,
      text: normalizeSourceText(chapter.text),
      sourceUrl: chapter.sourceUrl || `${SOURCE_URL}#n${chapter.node}`
    })
  );
}

async function main() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${SOURCE_URL}: ${response.status}`);
  }

  const html = await response.text();
  const isHumanCheck = /confirm that you are human|認證圖案|unban\.pl/i.test(html);
  const rowRe = /<tr id="n(\d+)">([\s\S]*?)<\/tr>/g;
  const chapters = [];
  let match;

  while ((match = rowRe.exec(html))) {
    const [, node, row] = match;
    if (!row.includes('class="ctext opt"') || !row.includes("道德经:")) continue;

    const textMatch = row.match(/<td class="ctext">([\s\S]*?)<\/td>/);
    if (!textMatch) continue;

    const text = normalizeSourceText(stripHtml(textMatch[1]));
    if (!text) continue;

    const chapter = chapters.length + 1;
    chapters.push(
      buildChapter({
      chapter,
      node,
      text,
      sourceUrl: `${SOURCE_URL}#n${node}`
      })
    );
  }

  if (chapters.length !== 81) {
    if (isHumanCheck || chapters.length === 0) {
      console.warn(`Fetched ${chapters.length} chapter(s) from ${SOURCE_URL}; using cached source text from ${OUTPUT_FILE}.`);
      chapters.splice(0, chapters.length, ...(await loadCachedChapters()));
    }
  }

  if (chapters.length !== 81) {
    throw new Error(`Expected 81 chapters, got ${chapters.length}`);
  }

  const payload = {
    source: {
      title: "《道德经》",
      url: SOURCE_URL,
      baseText: "中国哲学书电子化计划《道德经》简体原文",
      fetchedAt: new Date().toISOString(),
      sentenceRule: "Split on Chinese sentence-ending punctuation: 。；！？"
    },
    stats: {
      chapters: chapters.length,
      sentences: chapters.reduce((total, chapter) => total + chapter.sentences.length, 0)
    },
    chapters
  };

  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${OUTPUT_FILE}`);
  console.log(`Chapters: ${payload.stats.chapters}`);
  console.log(`Sentences: ${payload.stats.sentences}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
