import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListenToArticle } from "@/components/listen-to-article";
import { getDictionary } from "@/lib/dictionaries";
import { locales } from "@/lib/i18n";
import { getAllPostSummaries } from "@/lib/posts";

describe("narrated posts", () => {
  it.each(locales)("gives every narrated post in %s a length and an audio file in its own folder", (locale) => {
    for (const post of getAllPostSummaries(locale).filter((p) => p.audio)) {
      expect(post.audioSeconds, post.slug).toBeGreaterThan(0);
      expect(new URL(post.audio!, "https://gsantana.dev").pathname, post.slug).toMatch(
        new RegExp(`^/posts/${post.slug}/[\\w-]+\\.mp3$`),
      );
    }
  });

  it("only narrates the English PageIndex benchmark for now", () => {
    const narrated = locales.flatMap((locale) =>
      getAllPostSummaries(locale)
        .filter((p) => p.audio)
        .map((p) => `${locale}/${p.slug}`),
    );
    expect(narrated).toEqual(["en-us/pageindex-vs-vector-rag-benchmark"]);
  });
});

describe("ListenToArticle", () => {
  afterEach(cleanup);
  const labels = getDictionary("en-us").article.listen;
  const renderPlayer = () =>
    render(
      <ListenToArticle
        src="https://cdn.example.com/a.mp3"
        seconds={947}
        articleKey="post"
        title="Post"
        labels={labels}
      />,
    );

  it("shows the length before any audio loads and fetches nothing until play", () => {
    const { container } = renderPlayer();
    expect(screen.getByText("16 min · AI-narrated")).toBeTruthy();
    expect(container.querySelector("audio")?.getAttribute("preload")).toBe("none");
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });

  it("cycles the playback speed", () => {
    renderPlayer();
    const speed = screen.getByRole("button", { name: "Playback speed" });
    expect(speed.textContent).toBe("1×");
    fireEvent.click(speed);
    expect(speed.textContent).toBe("1.25×");
  });
});

describe("ListenToArticle docked bar", () => {
  type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;
  let fire: Callback = () => {};

  beforeEach(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: Callback) {
          fire = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const labels = getDictionary("en-us").article.listen;
  const scrolled = (past: boolean) =>
    act(() =>
      fire([{ isIntersecting: !past, boundingClientRect: { top: past ? -200 : 300 } as DOMRectReadOnly }]),
    );
  const dock = () => document.querySelector<HTMLElement>(".listen-dock");

  it("docks at the bottom only after playback started and the card left through the top", async () => {
    render(<ListenToArticle src="a.mp3" seconds={947} articleKey="dock" title="Post title" labels={labels} />);
    scrolled(true);
    expect(dock()).toBeNull();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play" })));
    expect(dock()?.dataset.docked).toBe("true");
    expect(document.documentElement.style.getPropertyValue("--listen-dock-offset")).not.toBe("");

    scrolled(false);
    expect(dock()?.dataset.docked).toBe("false");
    expect(dock()?.hasAttribute("inert")).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--listen-dock-offset")).toBe("");
  });

  it("closing the bar pauses and keeps it away until playback starts again", async () => {
    render(<ListenToArticle src="a.mp3" seconds={947} articleKey="dock" title="Post title" labels={labels} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play" })));
    scrolled(true);
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Close player" }));
    expect(pause).toHaveBeenCalled();
    expect(dock()?.dataset.docked).toBe("false");
  });
});
