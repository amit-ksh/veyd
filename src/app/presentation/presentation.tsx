"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Expand, List, Minimize } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { demoSlides } from "./slides";
import styles from "./presentation.module.css";

const STORAGE_KEY = "veyd:public-demo:slide:v1";
const CHALLENGE_URL = "https://dev.to/challenges/sanity-2026-09-16";

function findSlide(id: string | null): number {
  return demoSlides.findIndex((slide) => slide.id === id);
}

export function DemoPresentation() {
  const [index, setIndex] = useState(0);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenMessage, setFullscreenMessage] = useState("");
  const [ready, setReady] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contentsButtonRef = useRef<HTMLButtonElement>(null);
  const slide = demoSlides[index];

  const goTo = useCallback((next: number, focusHeading = false) => {
    const safeIndex = Math.max(0, Math.min(demoSlides.length - 1, next));
    setIndex(safeIndex);
    setContentsOpen(false);
    window.history.replaceState(null, "", `#${demoSlides[safeIndex].id}`);
    try {
      window.localStorage.setItem(STORAGE_KEY, demoSlides[safeIndex].id);
    } catch {
      // Local position is optional.
    }
    requestAnimationFrame(() => {
      if (focusHeading) headingRef.current?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 899px)").matches) window.scrollTo(0, 0);
    });
  }, []);

  useEffect(() => {
    const hashIndex = findSlide(window.location.hash.slice(1));
    let storedIndex = -1;
    try {
      storedIndex = findSlide(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      // The deck still works without storage.
    }
    setIndex(hashIndex >= 0 ? hashIndex : storedIndex >= 0 ? storedIndex : 0);
    setReady(true);
    const onHashChange = () => {
      const next = findSlide(window.location.hash.slice(1));
      if (next >= 0) goTo(next);
    };
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    window.addEventListener("hashchange", onHashChange);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [goTo]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, select, textarea, [contenteditable='true']")) return;
      if (contentsOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          setContentsOpen(false);
          contentsButtonRef.current?.focus();
        }
        return;
      }
      const next = event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown" ? index + 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp" ? index - 1
        : event.key === "Home" ? 0
        : event.key === "End" ? demoSlides.length - 1 : null;
      if (next !== null) {
        event.preventDefault();
        goTo(next);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [contentsOpen, goTo, index]);

  async function toggleFullscreen() {
    setFullscreenMessage("");
    try {
      if (document.fullscreenElement === rootRef.current) {
        await document.exitFullscreen();
      } else if (rootRef.current?.requestFullscreen) {
        await rootRef.current.requestFullscreen();
      } else {
        setFullscreenMessage("Fullscreen is unavailable in this browser. Slide controls still work.");
      }
    } catch {
      setFullscreenMessage("Fullscreen could not open. Slide controls still work.");
    }
  }

  return (
    <main className={styles.presentation} ref={rootRef}>
      <a className={styles.skipLink} href="#demo-slide">Skip to slide</a>
      <article id="demo-slide" className={styles.slide} aria-labelledby="slide-title" aria-roledescription="slide">
        <header className={styles.masthead}>
          <button className={styles.wordmark} type="button" onClick={() => goTo(0, true)} aria-label="Veyd, first slide">Veyd</button>
          <a className={styles.challengeBrand} href={CHALLENGE_URL} target="_blank" rel="noopener noreferrer" aria-label="DEV by Sanity challenge, opens in a new tab">
            <span className={styles.devWordmark}>DEV</span>
            <span className={styles.brandCross} aria-hidden="true">×</span>
            <span className={styles.sanityWordmark}>Sanity</span>
          </a>
        </header>

        <div className={styles.slideMain}>
          {slide.kind === "hero" ? (
            <div className={styles.heroBody}>
              <h1 id="slide-title" ref={headingRef} tabIndex={-1} className={styles.heroTitle}>{slide.title}</h1>
              <p className={styles.heroAnswer}>{slide.answer}</p>
              <p className={styles.heroLine}>Research. Learn. Reuse.</p>
            </div>
          ) : (
            <div className={styles.standardBody}>
              <h1 id="slide-title" ref={headingRef} tabIndex={-1} className={styles.title}>{slide.title}</h1>
              <p className={styles.answer}>{slide.answer}</p>

              {slide.kind === "architecture" && (
                <div className={styles.architecture} aria-label="Veyd application architecture">
                  {/* A code-authored diagram shared with the DEV.to post, not a system screenshot. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={styles.archDiagram} src="/presentation/architecture.svg" width={1200} height={340} alt="Veyd's Next.js app connects to Sanity Content Lake: original PDFs, extracted entries and Studio review. Published, project-scoped GROQ reads power cited chat, the handbook and read-only MCP. Gemini and Firecrawl handle AI and discovery; PostgreSQL stores app state, private Blob handles upload ingress, and Upstash supplies limits and locks." />
                </div>
              )}

              {slide.flow && (
                <ol className={styles.flow} aria-label="Workflow">
                  {slide.flow.map((step, stepIndex) => (
                    <li key={step.title}>
                      <span className={styles.stepNumber}>{String(stepIndex + 1).padStart(2, "0")}</span>
                      <h2>{step.title}</h2>
                      <p>{step.description}</p>
                    </li>
                  ))}
                </ol>
              )}

              {slide.points && (
                <dl className={`${styles.points} ${slide.points.length === 2 ? styles.twoPoints : ""}`}>
                  {slide.points.map((point) => (
                    <div key={point.title}>
                      <dt>{point.title}</dt>
                      <dd>{point.description}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {slide.kind === "closing" && (
                <div className={styles.launchActions}>
                  <Link href="/chat" className={styles.openApp}>Open Veyd <ArrowRight size={22} aria-hidden="true" /></Link>
                  <a className={styles.studioLink} href="https://sanity-zeta-six.vercel.app/" target="_blank" rel="noopener noreferrer">Open Sanity Studio<span className={styles.srOnly}> (opens in a new tab)</span></a>
                </div>
              )}
            </div>
          )}
        </div>

        <nav className={styles.toolbar} aria-label="Presentation navigation">
          <div className={styles.contentsWrap}>
            <button ref={contentsButtonRef} type="button" className={styles.toolButton} onClick={() => setContentsOpen(!contentsOpen)} aria-label="Contents" aria-expanded={contentsOpen} aria-controls="demo-contents">
              <List size={20} aria-hidden="true" /><span>Contents</span>
            </button>
            <div id="demo-contents" className={styles.contents} hidden={!contentsOpen}>
              <div className={styles.contentsHeading}>
                <h2>Choose a slide</h2>
                <button type="button" onClick={() => { setContentsOpen(false); contentsButtonRef.current?.focus(); }}>Close</button>
              </div>
              <ol>
                {demoSlides.map((item, itemIndex) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => goTo(itemIndex, true)} aria-current={itemIndex === index ? "step" : undefined}>
                      <span className={styles.contentsNumber}>{String(itemIndex + 1).padStart(2, "0")}</span>
                      <span>{item.title}</span>
                      {itemIndex === index && <Check size={17} aria-hidden="true" />}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className={styles.slidePicker}>
            <label htmlFor="demo-slide-picker">Slide {index + 1} / {demoSlides.length}</label>
            <select id="demo-slide-picker" value={index} onChange={(event) => goTo(Number(event.target.value))}>
              {demoSlides.map((item, itemIndex) => <option key={item.id} value={itemIndex}>{itemIndex + 1}. {item.title}</option>)}
            </select>
          </div>

          <div className={styles.toolbarActions}>
            <button type="button" className={styles.toolButton} onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous slide"><ArrowLeft size={21} aria-hidden="true" /><span className={styles.actionText}>Previous</span></button>
            <button type="button" className={`${styles.toolButton} ${styles.next}`} onClick={() => goTo(index + 1)} disabled={index === demoSlides.length - 1} aria-label="Next slide"><span className={styles.actionText}>Next</span><ArrowRight size={21} aria-hidden="true" /></button>
            <button type="button" className={styles.toolButton} onClick={toggleFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"} aria-pressed={fullscreen}>
              {fullscreen ? <Minimize size={20} aria-hidden="true" /> : <Expand size={20} aria-hidden="true" />}
              <span className={styles.presentText}>{fullscreen ? "Exit" : "Present"}</span>
            </button>
          </div>
        </nav>
      </article>
      <p role="status" className={styles.srOnly}>{ready ? `Slide ${index + 1} of ${demoSlides.length}: ${slide.title}` : ""}</p>
      {fullscreenMessage && <p role="status" className={styles.fullscreenMessage}>{fullscreenMessage}</p>}
    </main>
  );
}
