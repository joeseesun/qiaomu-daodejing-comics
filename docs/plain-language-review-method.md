# 《道德经配图版》白话三审三校流程

## 本轮完成范围

- 覆盖 81 章、573 条按句号/分号等切分的原文。
- 产物：`src/data/plain-reviewed.generated.json`。
- 页面构建优先使用这份全书审校白话。
- 读者 JSON：`src/data/daodejing.reader.draft.json`，已标记 573/573 reviewed。

## 已接入来源

1. CText《道德经》页面作为底本原文。
2. 维基文库《道德经（王弼本）》作为古注与异文参考。
3. 维基文库《老子河上公章句》作为古注参考。

本轮检索过 Legge/现代译文来源，但没有做逐句机器对齐，因此不把它们标成每条白话的正式审校来源。后续如果要再提高学术稳健度，应新增“现代译文/英译对齐层”，再整书重跑一次。

## 三审定义

每条白话都保存三个字段：

- `sourceCheck`：核对原句、章内上下文、古注证据，说明语义取舍。
- `plainnessCheck`：检查是否是真白话，避免半古半白、逐字搬运。
- `contextCheck`：检查这句在本章前后论证中的作用。

页面只展示 `plain`，审校字段保存在 JSON 里，供后续生成图片、抽查和再审使用。

## 自动门禁

```bash
npm run plain:validate
npm run data:build
npm run data:validate
npm run reader:build
npm run reader:validate
npm run check
```

门禁会检查：

- 573 条是否全覆盖。
- 每条是否有三审字段。
- 是否保留“兕、橐龠、司彻、什伯”等未解释古词。
- 是否逐字复制原文长片段。
- 是否出现“王弼注抓住的重点是”“这一句”等模板话。
- 是否出现重复白话。

## 继续优化方向

1. 接入 Legge/CText 英译与 1-2 个可靠现代白话本，做逐句对齐，不复制原文，只取语义共识。
2. 对 `plain-reviewed.generated.json` 做人工抽样批注，优先看第 3、12、41、50、65、71、80、81 章。
3. 用 `contextCheck` 和 `plain` 反向重写分镜，图片生成前先跑图文语义相似度/画面锚点审查。
