# 《道德经配图版》源头解释与生图质检流程

这个站点的问题不能只靠重生图片解决。图片不贴文字，通常是上游解释不准、提示词没有画面锚点，或者没有自动审稿机制。

## 可靠解释的来源顺序

1. 原文底本
   以中国哲学书电子化计划《道德经》简体页为页面底本，同时记录异文，例如“田猎/畋猎”。

2. 古注对照
   优先看王弼本和河上公章句。古注不直接搬到页面，但用来判断一句话的核心方向。

3. 翻译/现代译解对照
   用公开译文和现代译解验证语义边界，只取共识，不复制长句。最终白话必须是本站自己的表达。

4. 我们的轻润色
   白话要短、准、能接上画面。不能出现“王弼注抓住的重点是”“这句是在说”“背后的生活智慧”这类模板话。

## 数据层

人工审定解释放在 `src/data/interpretations/chapter-XX.json`。

每句至少包含：

```json
{
  "id": "c12-s01",
  "sentence": "五色令人目盲；",
  "evidence": [
    { "source": "ctext-base", "note": "底本文字依据。" },
    { "source": "wikisource-wangbi", "note": "古注判断。" },
    { "source": "wikisource-heshanggong", "note": "古注判断。" }
  ],
  "decision": "解释取舍。",
  "plain": "页面使用的白话文。",
  "imageSemantics": {
    "mustShow": ["必须画出来的物件或动作"],
    "mustNotShow": ["容易跑偏的画面"],
    "visualTest": "不看文字时，图片是否还能猜出句意。"
  }
}
```

`scripts/build-data.mjs` 会优先使用这里的 `plain` 和视觉语义。没有审定文件时，才回到旧的硬编码解释。

## 自动检查

解释层：

```bash
npm run interpretations:validate
```

它会检查：

- 每句至少 3 条证据。
- 证据来源必须在本章 `sources` 里声明。
- 原句必须和当前生成数据一致。
- 白话不能是模板腔，长度不能过短。
- 每句必须有 `mustShow`、`mustNotShow`、`visualTest`。

数据与页面：

```bash
npm run data:build
npm run check
```

分镜层继续使用：

```bash
npm run prompts:validate
```

## 生产顺序

1. 联网查原文、古注和译解，写入 `src/data/interpretations/chapter-XX.json`。
2. 跑 `npm run interpretations:validate`。
3. 跑 `npm run data:build`，确认页面白话来自审定解释。
4. 根据 `imageSemantics` 重写本章 `comic-prompts.json`。
5. 跑 `npm run prompts:validate`。
6. 生成图片。
7. 做章节接触表，人工检查图文关联、风格一致、底部留白、文字污染。
8. 通过后再发布。

原则：解释不合格，不进入分镜；分镜不合格，不生图；图片不合格，不发布。
