import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ExternalLink,
  Gift,
  Github,
  HeartHandshake,
  X,
  MessageCircle
} from "lucide-react";
import data from "./data/daodejing.generated.json";

const SOCIAL_LINKS = {
  github: "https://github.com/joeseesun/",
  x: "https://x.com/vista8",
  tuijian: "https://tuijian.qiaomu.ai/"
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getChapterByNumber(number) {
  return data.chapters.find((chapter) => chapter.chapter === number) ?? data.chapters[0];
}

function getSlide(chapterNumber, sentenceIndex) {
  const chapter = getChapterByNumber(chapterNumber);
  return {
    chapter,
    card: chapter.sentences[sentenceIndex],
    sentenceIndex
  };
}

function SupportModal({ modal, onClose }) {
  useEffect(() => {
    if (!modal) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal, onClose]);

  if (!modal) return null;

  const isReward = modal === "reward";

  return (
    <div className="modalBackdrop" onMouseDown={onClose} role="presentation">
      <section
        className="modalPanel"
        role="dialog"
        aria-modal="true"
        aria-label={isReward ? "打赏支持" : "关注向阳乔木推荐看"}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="iconButton modalClose" type="button" onClick={onClose} aria-label="关闭">
          <X size={18} />
        </button>
        <div className="modalHeader">
          <span className="modalIcon">{isReward ? <Gift size={22} /> : <MessageCircle size={22} />}</span>
          <div>
            <h2>{isReward ? "打赏支持" : "向阳乔木推荐看"}</h2>
            <p>{isReward ? "谢谢你支持继续做这类 AI 阅读作品。" : "扫码关注公众号，也可以去 GitHub / X 找到我。"}</p>
          </div>
        </div>
        <img
          className="qrImage"
          src={isReward ? "/qiaomu/qiaomu_reward_qr.png" : "/qiaomu/qiaomu_wechat_public_account_qr.jpg"}
          alt={isReward ? "打赏二维码" : "向阳乔木推荐看公众号二维码"}
        />
        {!isReward && (
          <div className="modalLinks">
            <a href={SOCIAL_LINKS.github} target="_blank" rel="noreferrer">
              GitHub <ExternalLink size={14} />
            </a>
            <a href={SOCIAL_LINKS.x} target="_blank" rel="noreferrer">
              X <ExternalLink size={14} />
            </a>
          </div>
        )}
      </section>
    </div>
  );
}

function ImagePanel({ card, index, chapter, onOpen }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <button className="comicFrameButton" type="button" onClick={onOpen} aria-label={`打开第${chapter.chapter}章第${index + 1}句漫画`}>
        <div className={`comicFallback fallback${index % 5}`} aria-label={card.imagePrompt}>
          <div className="fallbackScene">
            <span className="sunDisc" />
            <span className="inkMountain one" />
            <span className="inkMountain two" />
            <span className="riverLine" />
            <span className="tinyFigure" />
          </div>
          <div className="fallbackLabel">
            <span>漫画提示词已生成</span>
            <strong>{chapter.chapter}.{index + 1}</strong>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button className="comicFrameButton" type="button" onClick={onOpen} aria-label={`打开第${chapter.chapter}章第${index + 1}句漫画`}>
      <img
        className="comicImage"
        src={card.image}
        alt={`第${chapter.chapter}章第${index + 1}句漫画：${card.sentence}`}
        loading={index < 2 ? "eager" : "lazy"}
        onError={() => setFailed(true)}
      />
    </button>
  );
}

function LightboxImage({ card, index, chapter }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`lightboxFallback fallback${index % 5}`} aria-label={card.imagePrompt}>
        <div className="fallbackScene">
          <span className="sunDisc" />
          <span className="inkMountain one" />
          <span className="inkMountain two" />
          <span className="riverLine" />
          <span className="tinyFigure" />
        </div>
        <div className="fallbackLabel">
          <span>漫画提示词已生成</span>
          <strong>{chapter.chapter}.{index + 1}</strong>
        </div>
      </div>
    );
  }

  return (
    <img
      className="lightboxImage"
      src={card.image}
      alt={`第${chapter.chapter}章第${index + 1}句漫画：${card.sentence}`}
      onError={() => setFailed(true)}
    />
  );
}

function MangaCard({ card, chapter, index, onOpen }) {
  return (
    <article className="mangaCard" id={card.id}>
      <div className="panelMeta">
        <span>第 {chapter.chapter} 章</span>
        <strong>{String(index + 1).padStart(2, "0")}</strong>
      </div>
      <ImagePanel card={card} index={index} chapter={chapter} onOpen={onOpen} />
      <div className="dialogue">
        <p className="original">{card.sentence}</p>
        <p className="plain">{card.plain}</p>
      </div>
    </article>
  );
}

function ComicLightbox({ slide, onClose, onMove }) {
  const { chapter, card, sentenceIndex } = getSlide(slide.chapter, slide.index);
  const isFirst = chapter.chapter === 1 && sentenceIndex === 0;
  const isLast = chapter.chapter === data.chapters.length && sentenceIndex === chapter.sentences.length - 1;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onMove(-1);
      if (event.key === "ArrowRight") onMove(1);
    };
    document.body.classList.add("lightboxOpen");
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("lightboxOpen");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, onMove]);

  return (
    <div className="lightboxBackdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="lightboxPanel"
        role="dialog"
        aria-modal="true"
        aria-label={`第${chapter.chapter}章第${sentenceIndex + 1}句漫画阅读`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="lightboxTop">
          <span>
            第 {chapter.chapter} 章 · {sentenceIndex + 1}/{chapter.sentences.length}
          </span>
          <button className="iconButton" type="button" onClick={onClose} aria-label="关闭幻灯片" title="关闭">
            <X size={18} />
          </button>
        </div>
        <div className="lightboxStage">
          <button
            className="lightboxNav previous"
            type="button"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            aria-label="上一张"
            title="上一张"
          >
            <ArrowLeft size={24} />
          </button>
          <LightboxImage card={card} index={sentenceIndex} chapter={chapter} />
          <button
            className="lightboxNav next"
            type="button"
            onClick={() => onMove(1)}
            disabled={isLast}
            aria-label="下一张"
            title="下一张"
          >
            <ArrowRight size={24} />
          </button>
        </div>
        <div className="lightboxText">
          <p className="lightboxOriginal">{card.sentence}</p>
          <p className="lightboxPlain">{card.plain}</p>
        </div>
      </section>
    </div>
  );
}

function ChapterRail({ chapters, selectedChapter, onSelect }) {
  return (
    <aside className="chapterRail" aria-label="章节">
      <div className="railTitle">
        <BookOpen size={18} />
        <span>八十一章</span>
      </div>
      <div className="chapterList">
        {chapters.map((chapter) => (
          <button
            key={chapter.chapter}
            className={chapter.chapter === selectedChapter ? "chapterButton active" : "chapterButton"}
            type="button"
            onClick={() => onSelect(chapter.chapter)}
          >
            <span>{String(chapter.chapter).padStart(2, "0")}</span>
            <strong>{chapter.title}</strong>
          </button>
        ))}
      </div>
    </aside>
  );
}

function SiteActions({ onModal }) {
  return (
    <div className="siteActions" aria-label="站点链接">
      <button className="iconButton" type="button" onClick={() => onModal("reward")} title="打赏" aria-label="打赏">
        <Gift size={18} />
      </button>
      <button className="iconButton" type="button" onClick={() => onModal("follow")} title="关注" aria-label="关注">
        <HeartHandshake size={18} />
      </button>
      <a className="iconButton" href={SOCIAL_LINKS.github} target="_blank" rel="noreferrer" title="GitHub" aria-label="GitHub">
        <Github size={18} />
      </a>
      <a className="textLink" href={SOCIAL_LINKS.tuijian} target="_blank" rel="noreferrer">
        乔木推荐
      </a>
    </div>
  );
}

export default function App() {
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [modal, setModal] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  const chapter = getChapterByNumber(selectedChapter);

  function changeChapter(next) {
    const value = clamp(next, 1, data.chapters.length);
    setSelectedChapter(value);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  const moveLightbox = useCallback((delta) => {
    setLightbox((current) => {
      if (!current) return current;
      const currentChapter = getChapterByNumber(current.chapter);
      let nextChapterNumber = current.chapter;
      let nextIndex = current.index + delta;

      if (nextIndex < 0) {
        if (current.chapter === 1) return current;
        nextChapterNumber = current.chapter - 1;
        nextIndex = getChapterByNumber(nextChapterNumber).sentences.length - 1;
      } else if (nextIndex >= currentChapter.sentences.length) {
        if (current.chapter === data.chapters.length) return current;
        nextChapterNumber = current.chapter + 1;
        nextIndex = 0;
      }

      setSelectedChapter(nextChapterNumber);
      return { chapter: nextChapterNumber, index: nextIndex };
    });
  }, []);

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="brandMark" aria-hidden="true">
            <span className="brandGlyph">道</span>
            <span className="brandWave" />
          </span>
          <div>
            <h1>道德经配图版</h1>
            <p>逐句原文 · 白话解读 · 连环配图</p>
          </div>
        </div>
        <SiteActions onModal={setModal} />
      </header>

      <main className="readerShell">
        <ChapterRail chapters={data.chapters} selectedChapter={selectedChapter} onSelect={changeChapter} />

        <section className="readingPane" aria-live="polite">
          <div className="chapterHeader">
            <div className="chapterKicker">
              <span>第 {chapter.chapter} 章</span>
            </div>
            <div className="chapterTitleRow">
              <h2>{chapter.title}</h2>
              <div className="chapterStepper">
                <button
                  className="iconButton"
                  type="button"
                  onClick={() => changeChapter(selectedChapter - 1)}
                  disabled={selectedChapter === 1}
                  aria-label="上一章"
                  title="上一章"
                >
                  <ArrowLeft size={18} />
                </button>
                <select
                  value={selectedChapter}
                  onChange={(event) => changeChapter(Number(event.target.value))}
                  aria-label="选择章节"
                >
                  {data.chapters.map((item) => (
                    <option key={item.chapter} value={item.chapter}>
                      {String(item.chapter).padStart(2, "0")} {item.title}
                    </option>
                  ))}
                </select>
                <button
                  className="iconButton"
                  type="button"
                  onClick={() => changeChapter(selectedChapter + 1)}
                  disabled={selectedChapter === data.chapters.length}
                  aria-label="下一章"
                  title="下一章"
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
            <p className="chapterGist">{chapter.gist}</p>
            <p className="chapterText">{chapter.text}</p>
          </div>

          <div className="mangaGrid">
            {chapter.sentences.map((card) => {
              const sentenceIndex = chapter.sentences.findIndex((item) => item.id === card.id);
              return (
                <MangaCard
                  key={card.id}
                  card={card}
                  chapter={chapter}
                  index={sentenceIndex}
                  onOpen={() => setLightbox({ chapter: chapter.chapter, index: sentenceIndex })}
                />
              );
            })}
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>原文据中国哲学书电子化计划《道德经》简体页整理。</span>
        <a href={SOCIAL_LINKS.x} target="_blank" rel="noreferrer">
          X @vista8
        </a>
        <a href={SOCIAL_LINKS.github} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href={SOCIAL_LINKS.tuijian} target="_blank" rel="noreferrer">
          乔木推荐
        </a>
      </footer>

      <SupportModal modal={modal} onClose={() => setModal(null)} />
      {lightbox && <ComicLightbox slide={lightbox} onClose={() => setLightbox(null)} onMove={moveLightbox} />}
    </>
  );
}
