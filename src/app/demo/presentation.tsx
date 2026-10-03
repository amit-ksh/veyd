"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Expand, List, Minimize } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { demoSlides } from "./slides";
import styles from "./demo.module.css";

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
      // Navigation remains usable when browser storage is unavailable.
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
      // Local position is optional, never an access requirement.
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
      const next = event.key === "ArrowRight" ? index + 1
        : event.key === "ArrowLeft" ? index - 1
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
      if (document.fullscreenElement === rootRef.current) await document.exitFullscreen();
      else if (rootRef.current?.requestFullscreen) await rootRef.current.requestFullscreen();
      else setFullscreenMessage("Fullscreen is unavailable in this browser. You can still use every slide control.");
    } catch {
      setFullscreenMessage("Fullscreen could not open. You can still use every slide control.");
    }
  }

  return (
    <main className={styles.presentation} ref={rootRef}>
      <a className={styles.skipLink} href="#demo-slide">Skip to the slide</a>
      <header className={styles.header}>
        <Link href="/demo#what-is-veyd" className={styles.wordmark} onClick={(event) => {
          event.preventDefault();
          goTo(0, true);
        }} aria-label="Veyd — first presentation slide">Veyd</Link>
        <a className={styles.challengeBrand} href={CHALLENGE_URL} target="_blank" rel="noopener noreferrer" aria-label="DEV × Sanity Challenge — opens in a new tab">
          <span className={styles.devWordmark}>DEV</span>
          <span className={styles.brandCross} aria-hidden="true">×</span>
          <span className={styles.sanityWordmark}>Sanity</span>
        </a>
        <button className={styles.control} onClick={toggleFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
          {fullscreen ? <Minimize size={18} aria-hidden="true" /> : <Expand size={18} aria-hidden="true" />}
          <span className={styles.fullscreenLabel}>{fullscreen ? "Exit fullscreen" : "Present"}</span>
        </button>
      </header>

      <section className={styles.desk} aria-label="Veyd demo presentation">
        <article id="demo-slide" className={`${styles.slide} ${slide.cover ? styles.cover : ""}`} aria-labelledby="slide-question" aria-roledescription="slide">
          <div className={styles.slideContent}>
            <h1 id="slide-question" ref={headingRef} tabIndex={-1} className={styles.question}>{slide.question}</h1>
            <p className={styles.answer}>{slide.answer}</p>

            {slide.flow && (
              <ol className={styles.flow} aria-label="Workflow">
                {slide.flow.map((step, stepIndex) => (
                  <li key={step.title}>
                    <span className={styles.stepNumber}>{stepIndex + 1}</span>
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

            {slide.closing && <Link href="/chat" className={styles.openApp}>Open Veyd <ArrowRight size={20} aria-hidden="true" /></Link>}
            {slide.note && <p className={styles.note}>{slide.note}</p>}
          </div>
          <div className={styles.slideFoot} aria-hidden="true">
            <span>{slide.cover ? "Source → review → reuse" : "Veyd"}</span>
            <span>{String(index + 1).padStart(2, "0")} / {demoSlides.length}</span>
          </div>
        </article>
      </section>

      <nav className={styles.navigation} aria-label="Presentation navigation">
        <div className={styles.contentsWrap}>
          <button ref={contentsButtonRef} className={styles.control} onClick={() => setContentsOpen(!contentsOpen)} aria-expanded={contentsOpen} aria-controls="demo-contents">
            <List size={18} aria-hidden="true" /> Contents
          </button>
            <div id="demo-contents" className={styles.contents} hidden={!contentsOpen}>
              <div className={styles.contentsHeading}><h2>Jump to a question</h2><button onClick={() => { setContentsOpen(false); contentsButtonRef.current?.focus(); }}>Close</button></div>
              <ol>
                {demoSlides.map((item, itemIndex) => (
                  <li key={item.id}>
                    <button onClick={() => goTo(itemIndex, true)} aria-current={itemIndex === index ? "step" : undefined}>
                      <span className={styles.contentsNumber}>{String(itemIndex + 1).padStart(2, "0")}</span>
                      <span>{item.question}</span>
                      {itemIndex === index && <Check size={16} aria-hidden="true" />}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
        </div>
        <div className={styles.slidePicker}>
          <label htmlFor="demo-slide-picker">Slide</label>
          <select id="demo-slide-picker" value={index} onChange={(event) => goTo(Number(event.target.value))}>
            {demoSlides.map((item, itemIndex) => <option key={item.id} value={itemIndex}>{itemIndex + 1}. {item.question}</option>)}
          </select>
        </div>
        <div className={styles.paging}>
          <button className={styles.control} onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous slide"><ArrowLeft size={18} aria-hidden="true" /><span>Previous</span></button>
          <button className={`${styles.control} ${styles.next}`} onClick={() => goTo(index + 1)} disabled={index === demoSlides.length - 1} aria-label="Next slide"><span>Next</span><ArrowRight size={18} aria-hidden="true" /></button>
        </div>
      </nav>
      <div className={styles.statusLine}>
        <p className={styles.keyHint}>Use ← → to navigate. Home / End to jump.</p>
        <p role="status" className={styles.srOnly}>{ready ? `Slide ${index + 1} of ${demoSlides.length}: ${slide.question}` : ""}</p>
        {fullscreenMessage && <p role="status" className={styles.fullscreenMessage}>{fullscreenMessage}</p>}
      </div>
    </main>
  );
}
