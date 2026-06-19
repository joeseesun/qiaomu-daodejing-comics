# 道德经配图版

> 把《道德经》拆成 573 张漫画式阅读卡：一句原文，一句大白话，一张 16:9 配图。
>
> A visual Dao De Jing reader with 573 comic-style cards: original text, plain-language interpretation, and one widescreen illustration per sentence.

[在线阅读](https://daodejing.qiaomu.ai/) · [方法文档](docs/plain-language-review-method.md) · [分镜流程](docs/comic-production-method.md) · [License](LICENSE)

**中文** | [English](#english)

![第 1 章配图示例](public/comics/c01-s01-wide.png)

## 这是什么

《道德经配图版》是一个面向普通读者的经典阅读实验：把《道德经》按句号、分号等自然停顿拆成 573 条，每条做成一张漫画书式卡片。

目标不是替代学术译注，而是降低第一次阅读《道德经》的门槛：先看图和白话进入语境，再回到原文慢慢读。

## 当前进度

- 81 章全部收录。
- 573 条逐句白话已做全书三审三校数据化处理。
- 573 张 16:9 漫画配图已生成并压缩。
- 网站已部署到 [daodejing.qiaomu.ai](https://daodejing.qiaomu.ai/)。
- 支持章节导航、卡片阅读、lightbox 式翻页。

## 必须坦诚的限制

这个项目还没有到“成品最终版”。

最主要的问题是：**不少配图和文字的关联度还不够高**。早期图片是在白话解释还不稳定时生成的，导致部分画面偏通用、元素重复，或者只贴近章节气质而没有准确表达当前句。后续需要用新的三审白话数据反向重写分镜，再重新生成图片。

另外：

- 白话解释是“读者版解释”，不是权威学术译本。
- 目前正式进入脚本上下文的来源是 CText 原文、王弼本、河上公章句；Legge/现代译本只做过检索确认，还没有完成逐句对齐。
- 生成图像里仍可能出现风格不一致、画面意象重复、局部文字痕迹等问题。
- 本仓库包含约 338MB 的漫画图片资源，克隆体积不小。

## 数据生产方法

本项目现在把“解释质量”当成生图上游，而不是只靠提示词补救。

白话数据在：

```text
src/data/plain-reviewed.generated.json
```

每一条都包含：

- `sourceCheck`：核对原文、古注和章内上下文后的语义取舍。
- `plainnessCheck`：检查是否真白话，避免逐字搬古文。
- `contextCheck`：检查该句在整章论证中的作用。

详见：[白话三审三校流程](docs/plain-language-review-method.md)。

## 快速开始

```bash
npm install
npm run data:build
npm run check
npm run dev -- --port 4173
```

打开：

```text
http://127.0.0.1:4173/
```

## 常用命令

```bash
# 重建站点数据
npm run data:build

# 校验 573 条白话是否都有三审字段
npm run plain:validate

# 校验站点数据、解释文件、分镜提示词，并构建生产包
npm run check

# 导出读者版 JSON
npm run reader:build
npm run reader:validate
```

## 生成图片

少量测试：

```bash
npm run comics:dreamina -- --limit 3 --model_version 5.0 --ratio 16:9 --resolution_type 2k --max-edge 1280
```

全量重生：

```bash
npm run comics:dreamina -- --limit all --force --model_version 5.0 --ratio 16:9 --resolution_type 2k --concurrency 2 --poll 180 --max-edge 1280 --continue-on-error
```

图片会写入：

```text
public/comics/cXX-sYY-wide.png
```

## 技术栈

- Vite
- React
- Lucide React
- 静态部署到 Nginx
- 图片生成：即梦 / Dreamina 工作流

## 已验证

当前版本已通过：

```bash
npm run plain:validate
npm run data:validate
npm run reader:validate
npm run check
```

线上验证：

- `https://daodejing.qiaomu.ai/` 返回 200。
- 线上包包含新版白话样句。
- 服务器保留 573 张漫画图片。

## 下一步

- 接入 Legge/CText 英译与 1-2 个可靠现代白话本，做逐句对齐。
- 用新版白话重写全部分镜 JSON。
- 对每张图做“原句-白话-画面锚点”自动检查。
- 重生关联度差的图片，优先处理第 12、41、50、65、71、80、81 章。
- 增加图片风格一致性评分和重复画面检测。

## 关于

项目由 [向阳乔木](https://x.com/vista8) 制作。更多 AI 工具和创作实验见：

- [qiaomu.ai](https://qiaomu.ai/)
- [blog.qiaomu.ai](https://blog.qiaomu.ai/)
- [乔木推荐](https://tuijian.qiaomu.ai/)
- [GitHub @joeseesun](https://github.com/joeseesun/)

---

<a name="english"></a>

# Dao De Jing Illustrated Reader

> A visual reading experiment for the Dao De Jing: 573 sentence-level cards, each with the original Chinese line, a plain-language explanation, and a 16:9 illustration.

[Live Demo](https://daodejing.qiaomu.ai/) · [Review Method](docs/plain-language-review-method.md) · [Comic Workflow](docs/comic-production-method.md) · [License](LICENSE)

## What It Is

This project turns the Dao De Jing into a comic-book-like reading experience. The text is split by natural punctuation into 573 cards across 81 chapters. Each card pairs the original line with a reader-friendly Chinese explanation and a generated illustration.

It is not a replacement for scholarly translations. It is meant to help general readers enter the text visually and then return to the original with more context.

## Honest Limitations

The current version is still a work in progress.

The biggest issue: **many illustrations do not yet match the text closely enough**. Some images were generated before the current source-backed plain-language review pass, so they may feel generic, repetitive, or only loosely related to the sentence.

Other limits:

- The Chinese explanations are reader-facing interpretations, not an authoritative academic translation.
- The current review pipeline uses CText, the Wang Bi edition, and Heshanggong commentary as primary references. Legge and modern translations have been researched but not fully aligned sentence-by-sentence yet.
- Generated images may still contain inconsistent style, repeated visual motifs, or occasional artifacts.
- The repository includes about 338MB of image assets.

## Quick Start

```bash
npm install
npm run data:build
npm run check
npm run dev -- --port 4173
```

Open:

```text
http://127.0.0.1:4173/
```

## Verified Commands

```bash
npm run plain:validate
npm run data:validate
npm run reader:validate
npm run check
```

## Roadmap

- Add sentence-level alignment with Legge/CText English and reliable modern Chinese explanations.
- Rewrite all comic prompts from the reviewed plain-language data.
- Add automated text-image relevance checks.
- Regenerate weak or generic panels.
- Improve style consistency and repeated-scene detection.

## Maintainer

Created by [向阳乔木 / Joe](https://x.com/vista8).

- [qiaomu.ai](https://qiaomu.ai/)
- [blog.qiaomu.ai](https://blog.qiaomu.ai/)
- [tuijian.qiaomu.ai](https://tuijian.qiaomu.ai/)
- [GitHub @joeseesun](https://github.com/joeseesun/)
