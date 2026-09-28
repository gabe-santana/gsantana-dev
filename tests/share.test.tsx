import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareBar } from "@/components/share-bar";
import { getDictionary } from "@/lib/dictionaries";
import { SHARE_NETWORKS, shareHref, taggedUrl } from "@/lib/share";

const URL_ = "https://gsantana.dev/pt-br/blog/laya-email-security-screener/";
const TITLE = "laya-classifier: um filtro & tanto";
const labels = (() => {
  const s = getDictionary("en-us").article.share;
  return { heading: s.post, shareOn: s.shareOn, copyLink: s.copyLink, copied: s.copied, more: s.more };
})();

afterEach(cleanup);

describe("share links", () => {
  it("tags every shared URL with its network", () => {
    expect(taggedUrl(URL_, "linkedin")).toBe(`${URL_}?utm_source=linkedin&utm_medium=share`);
    for (const network of SHARE_NETWORKS) {
      const href = decodeURIComponent(shareHref(network, URL_, TITLE));
      expect(href).toContain(`utm_source=${network}&utm_medium=share`);
    }
  });

  it("encodes the title", () => {
    expect(shareHref("x", URL_, TITLE)).toContain("text=laya-classifier%3A%20um%20filtro%20%26%20tanto");
    expect(shareHref("linkedin", URL_, TITLE)).toMatch(/^https:\/\/www\.linkedin\.com\/sharing\/share-offsite\/\?url=https%3A/);
  });

  it("labels news as news and everything else as a post, in both languages", () => {
    expect(getDictionary("en-us").article.share).toMatchObject({ post: "Share this post", news: "Share this news" });
    expect(getDictionary("pt-br").article.share).toMatchObject({
      post: "Compartilhe este post",
      news: "Compartilhe esta notícia",
    });
  });
});

describe("ShareBar", () => {
  it("renders a link per network and copies a tagged URL", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ShareBar url={URL_} title={TITLE} labels={labels} placement="bottom" />);

    expect(screen.getByRole("heading", { name: "Share this post" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Share on LinkedIn" }).getAttribute("href")).toBe(
      shareHref("linkedin", URL_, TITLE)
    );
    expect(screen.getAllByRole("link")).toHaveLength(SHARE_NETWORKS.length);

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));
    await screen.findByText("Link copied");
    expect(writeText).toHaveBeenCalledWith(`${URL_}?utm_source=copied_link&utm_medium=share`);
  });

  it("has a compact top placement with icon-only buttons", () => {
    render(<ShareBar url={URL_} title={TITLE} labels={labels} placement="top" />);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByRole("region", { name: "Share this post" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy link" }).textContent).toBe("");
  });
});
