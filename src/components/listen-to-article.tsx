"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from "@/components/icons";

export interface ListenLabels {
  title: string;
  /** "{minutes} min · AI-narrated" */
  meta: string;
  /** "Resume from {time}" */
  resume: string;
  play: string;
  pause: string;
  back: string;
  forward: string;
  seek: string;
  speed: string;
  close: string;
  showPlayer: string;
}

interface ListenToArticleProps {
  /** Absolute URL of the MP3 on the media CDN, which answers range requests. */
  src: string;
  /** Known length, so the player shows it before a single byte is loaded. */
  seconds: number;
  /** Locale-independent article key; the resume position is stored under it. */
  articleKey: string;
  title: string;
  artwork?: string;
  labels: ListenLabels;
}

const SKIP_SECONDS = 15;
const RATES = [1, 1.25, 1.5, 1.75, 2];
const RATE_KEY = "gsantana_listen_rate";
/** Other bottom-fixed UI (the news toast) lifts itself by this much while the bar is docked. */
const DOCK_OFFSET_VAR = "--listen-dock-offset";
const positionKey = (articleKey: string) => `gsantana_listen:${articleKey}`;

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private windows and blocked storage just lose the resume position.
  }
}

function clock(total: number): string {
  const s = Math.max(0, Math.floor(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className={className}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

/**
 * "Listen to this article" player. The <audio> element starts with
 * preload="none", so a page view downloads nothing; on play the browser
 * streams the MP3 from the CDN with range requests and starts as soon as
 * the first chunk arrives, and seeking fetches only the bytes around the
 * new position.
 *
 * Once playback has started, scrolling the inline card out through the top
 * of the screen slides a compact bar in at the bottom, like a music app's
 * mini player; scrolling back to the card slides it away. Both drive the
 * same <audio> element, so the sound never restarts.
 */
export function ListenToArticle({ src, seconds, articleKey, title, artwork, labels }: ListenToArticleProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const inlineRef = useRef<HTMLElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(seconds);
  const [rate, setRate] = useState(1);
  const [resumeAt, setResumeAt] = useState(0);
  const [pastInline, setPastInline] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lastSaved = useRef(0);

  useEffect(() => {
    setMounted(true);
    const saved = Number(readStorage(positionKey(articleKey)));
    if (saved > 0 && saved < seconds - 5) {
      setResumeAt(saved);
      setCurrent(saved);
    }
    const savedRate = Number(readStorage(RATE_KEY));
    if (RATES.includes(savedRate)) setRate(savedRate);
  }, [articleKey, seconds]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  // The card counts as gone once it slides under the sticky nav, whose
  // height changes when the nav wraps on small screens.
  useEffect(() => {
    const card = inlineRef.current;
    if (!card || typeof IntersectionObserver === "undefined") return;
    let observer: IntersectionObserver | undefined;
    const observe = () => {
      observer?.disconnect();
      const navHeight = document.querySelector<HTMLElement>("header.sticky")?.offsetHeight ?? 0;
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;
          // Only above the viewport: a card below it (before scrolling down) never docks.
          setPastInline(!entry.isIntersecting && entry.boundingClientRect.top < navHeight);
        },
        { rootMargin: `-${navHeight}px 0px 0px 0px` },
      );
      observer.observe(card);
    };
    observe();
    window.addEventListener("resize", observe);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", observe);
    };
  }, []);

  const docked = started && pastInline && !dismissed;

  useEffect(() => {
    const root = document.documentElement;
    // The bar's own height plus the gap below it and a little air above.
    if (docked && dockRef.current) root.style.setProperty(DOCK_OFFSET_VAR, `${dockRef.current.offsetHeight + 8}px`);
    else root.style.removeProperty(DOCK_OFFSET_VAR);
    return () => {
      root.style.removeProperty(DOCK_OFFSET_VAR);
    };
  }, [docked]);

  const savePosition = useCallback(
    (time: number) => {
      lastSaved.current = time;
      writeStorage(positionKey(articleKey), time > 0 ? String(Math.floor(time)) : null);
    },
    [articleKey],
  );

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (!started) {
      setStarted(true);
      // Seeking before play makes the first range request start at the saved offset.
      if (current > 0) audio.currentTime = current;
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist: "Gabriel Santana",
          album: "gsantana.dev",
          artwork: artwork ? [{ src: artwork, sizes: "1600x900", type: "image/webp" }] : [],
        });
      }
    }
    setBuffering(true);
    try {
      await audio.play();
    } catch {
      setBuffering(false);
    }
  };

  const seekTo = (time: number) => {
    const target = Math.min(Math.max(time, 0), duration);
    setCurrent(target);
    const audio = audioRef.current;
    if (audio && started) audio.currentTime = target;
    savePosition(target);
  };

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length] ?? 1;
    setRate(next);
    writeStorage(RATE_KEY, String(next));
  };

  const closeDock = () => {
    audioRef.current?.pause();
    setDismissed(true);
  };

  const scrollToCard = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    inlineRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  };

  useEffect(() => {
    if (!("mediaSession" in navigator) || !started) return;
    const audio = audioRef.current;
    if (!audio) return;
    navigator.mediaSession.setActionHandler("seekbackward", () => {
      audio.currentTime = Math.max(audio.currentTime - SKIP_SECONDS, 0);
    });
    navigator.mediaSession.setActionHandler("seekforward", () => {
      audio.currentTime = Math.min(audio.currentTime + SKIP_SECONDS, audio.duration || duration);
    });
    return () => {
      navigator.mediaSession.setActionHandler("seekbackward", null);
      navigator.mediaSession.setActionHandler("seekforward", null);
    };
  }, [started, duration]);

  const progress = duration > 0 ? (current / duration) * 100 : 0;
  const minutes = Math.max(1, Math.round(seconds / 60));
  const subtitle =
    !started && resumeAt > 0
      ? labels.resume.replace("{time}", clock(resumeAt))
      : labels.meta.replace("{minutes}", String(minutes));
  const timeText = started ? `${clock(current)} / ${clock(duration)}` : subtitle;

  const playButton = (size: "inline" | "dock") => (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? labels.pause : labels.play}
      className={`relative flex shrink-0 items-center justify-center rounded-full bg-accent text-background transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        size === "inline" ? "h-10 w-10" : "h-9 w-9"
      }`}
    >
      {playing ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="ml-0.5 h-4 w-4" />}
      {buffering ? (
        <span aria-hidden className="absolute -inset-1 animate-spin rounded-full border-2 border-accent/20 border-t-accent" />
      ) : null}
    </button>
  );

  const seekBar = (extra: string) => (
    <input
      type="range"
      min={0}
      max={Math.floor(duration)}
      step={1}
      value={Math.floor(current)}
      onChange={(e) => seekTo(Number(e.target.value))}
      aria-label={labels.seek}
      aria-valuetext={`${clock(current)} / ${clock(duration)}`}
      className={`listen-seek block h-1 w-full cursor-pointer appearance-none rounded-full ${extra}`}
      style={{
        background: `linear-gradient(to right, var(--color-accent) ${progress}%, var(--color-border) ${progress}%)`,
      }}
    />
  );

  const sideControls = (withClose: boolean) => (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        onClick={() => seekTo(current - SKIP_SECONDS)}
        aria-label={labels.back}
        className="hidden rounded-full p-1.5 text-muted transition hover:text-foreground sm:inline-flex"
      >
        <SkipBackIcon className="h-[18px] w-[18px]" />
      </button>
      <button
        type="button"
        onClick={() => seekTo(current + SKIP_SECONDS)}
        aria-label={labels.forward}
        className="hidden rounded-full p-1.5 text-muted transition hover:text-foreground sm:inline-flex"
      >
        <SkipForwardIcon className="h-[18px] w-[18px]" />
      </button>
      <button
        type="button"
        onClick={cycleRate}
        aria-label={labels.speed}
        className="ml-1 rounded-full border border-border/70 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-muted transition hover:border-accent/60 hover:text-foreground"
      >
        {rate}×
      </button>
      {withClose ? (
        <button
          type="button"
          onClick={closeDock}
          aria-label={labels.close}
          className="ml-1 rounded-full p-1.5 text-muted transition hover:text-foreground"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <section
        ref={inlineRef}
        data-pagefind-ignore
        aria-label={labels.title}
        className="mb-10 flex items-center gap-3 rounded-2xl border border-border/60 bg-[color-mix(in_srgb,var(--color-surface)_60%,transparent)] px-3 py-2.5 sm:gap-4 sm:px-4"
      >
        <audio
          ref={audioRef}
          src={src}
          preload="none"
          // "play" fires as soon as playback is requested, so the button turns
          // into pause at once; "playing" means audio actually started.
          onPlay={() => {
            setPlaying(true);
            setDismissed(false);
          }}
          onPlaying={() => setBuffering(false)}
          onPause={() => {
            setPlaying(false);
            setBuffering(false);
            savePosition(audioRef.current?.currentTime ?? 0);
          }}
          onWaiting={() => setBuffering(true)}
          onCanPlay={() => setBuffering(false)}
          onDurationChange={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setDuration(d);
          }}
          onTimeUpdate={(e) => {
            const time = e.currentTarget.currentTime;
            setCurrent(time);
            if (Math.abs(time - lastSaved.current) >= 5) savePosition(time);
          }}
          onEnded={() => {
            setPlaying(false);
            setCurrent(0);
            setResumeAt(0);
            savePosition(0);
          }}
        />

        {playButton("inline")}

        <div className="min-w-0 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <p className="truncate text-sm font-semibold text-foreground">{labels.title}</p>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted sm:text-xs">{timeText}</span>
          </div>
          {seekBar("mt-1.5 sm:mt-2")}
        </div>

        {sideControls(false)}
      </section>

      {mounted && started
        ? createPortal(
            // Portaled to <body> so no transformed ancestor can turn "fixed" into "absolute".
            <div
              className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-4 sm:pb-4"
              data-pagefind-ignore
            >
              <div
                ref={dockRef}
                role="region"
                aria-label={labels.title}
                aria-hidden={!docked}
                inert={!docked}
                className={`listen-dock w-full max-w-xl rounded-2xl border border-border bg-[color-mix(in_srgb,var(--color-surface)_94%,transparent)] px-3 py-2 shadow-[0_18px_48px_-12px_rgb(0_0_0/0.85)] backdrop-blur-md sm:px-4 ${
                  docked ? "pointer-events-auto" : ""
                }`}
                data-docked={docked}
              >
                <div className="flex items-center gap-3">
                  {playButton("dock")}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                      <button
                        type="button"
                        onClick={scrollToCard}
                        aria-label={labels.showPlayer}
                        className="min-w-0 truncate text-left text-sm font-semibold text-foreground transition hover:text-accent"
                      >
                        {title}
                      </button>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted">{timeText}</span>
                    </div>
                    {seekBar("mt-1.5")}
                  </div>
                  {sideControls(true)}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
