import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NewsNotification } from "@/components/news-notification";
import { newsStories } from "@/lib/news";
import {
  isStoryPage,
  NEWS_NOTIFICATION_DELAY_MS,
  NEWS_SEEN_KEY,
  shouldShowStory,
} from "@/lib/news-notification";

const pathname = vi.hoisted(() => ({ current: "/en-us/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

const story = {
  slug: "newest-story",
  href: "/en-us/news/newest-story",
  title: "The newest story",
  image: "/news/newest-story/cover.webp",
};
const labels = { eyebrow: "Latest news", read: "Read story", close: "Dismiss" };

describe("news notification rules", () => {
  it("shows a story the reader hasn't dismissed", () => {
    expect(shouldShowStory("b", null, "/en-us/", "/en-us/news/b")).toBe(true);
    expect(shouldShowStory("b", "a", "/en-us/", "/en-us/news/b")).toBe(true);
  });

  it("stays away after a dismissal, until a newer story comes", () => {
    expect(shouldShowStory("a", "a", "/en-us/", "/en-us/news/a")).toBe(false);
    expect(shouldShowStory("b", "a", "/en-us/", "/en-us/news/b")).toBe(true);
  });

  it("never announces the story on its own page", () => {
    expect(isStoryPage("/en-us/news/a/", "/en-us/news/a")).toBe(true);
    expect(shouldShowStory("a", null, "/en-us/news/a/", "/en-us/news/a")).toBe(false);
  });

  it("announces the story that is newest on the site", () => {
    const dates = newsStories.map((s) => s.date);
    expect(newsStories[0]!.date).toBe([...dates].sort().at(-1));
  });
});

describe("NewsNotification", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    pathname.current = "/en-us/";
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function advance() {
    act(() => {
      vi.advanceTimersByTime(NEWS_NOTIFICATION_DELAY_MS);
    });
  }

  it("appears after the delay and remembers a dismissal", () => {
    const { unmount } = render(<NewsNotification story={story} labels={labels} />);
    expect(screen.queryByText(story.title)).toBeNull();
    advance();
    expect(screen.getByText(story.title)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: labels.close }));
    expect(screen.queryByText(story.title)).toBeNull();
    expect(localStorage.getItem(NEWS_SEEN_KEY)).toBe(story.slug);
    unmount();

    render(<NewsNotification story={story} labels={labels} />);
    advance();
    expect(screen.queryByText(story.title)).toBeNull();
  });

  it("comes back when a newer story is published", () => {
    localStorage.setItem(NEWS_SEEN_KEY, "an-older-story");
    render(<NewsNotification story={story} labels={labels} />);
    advance();
    expect(screen.getByText(story.title)).toBeTruthy();
  });

  it("checks storage again before showing, so another tab's dismissal counts", () => {
    render(<NewsNotification story={story} labels={labels} />);
    localStorage.setItem(NEWS_SEEN_KEY, story.slug);
    advance();
    expect(screen.queryByText(story.title)).toBeNull();
  });

  it("marks the story seen when the reader opens it", () => {
    pathname.current = "/en-us/news/newest-story/";
    render(<NewsNotification story={story} labels={labels} />);
    advance();
    expect(screen.queryByText(story.title)).toBeNull();
    expect(localStorage.getItem(NEWS_SEEN_KEY)).toBe(story.slug);
  });
});
