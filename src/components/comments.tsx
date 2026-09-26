"use client";

import Giscus from "@giscus/react";
import { useEffect, useRef, useState } from "react";
import { giscusConfig } from "@/lib/giscus";

// After GitHub sign-in, giscus sends the reader back to the page with a
// `?giscus=<session>` param, so the page reloads at the top. The giscus
// element strips that param in its constructor — before any useEffect runs
// — so it has to be read during the first render instead.
function isReturningFromGiscusSignIn(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("giscus");
}

function useScrollBackAfterSignIn(target: React.RefObject<HTMLElement | null>) {
  const [returning] = useState(isReturningFromGiscusSignIn);

  useEffect(() => {
    if (!returning) return;
    const scroll = () => target.current?.scrollIntoView({ block: "start" });

    scroll();
    // Images above the comments (without fixed sizes) can still be loading
    // and push the section down; re-align once everything has loaded.
    if (document.readyState === "complete") return;
    window.addEventListener("load", scroll, { once: true });
    return () => window.removeEventListener("load", scroll);
  }, [returning, target]);
}

/**
 * `term` is a stable per-article key (e.g. "blog/my-post"), not the URL or
 * title, so a thread survives title edits, trailing-slash changes and a
 * domain move. `strict` stops giscus fuzzy-matching a different article's
 * thread with a similar key.
 */
export function Comments({ term }: { term: string }) {
  const sectionRef = useRef<HTMLElement>(null);
  useScrollBackAfterSignIn(sectionRef);

  return (
    <section
      ref={sectionRef}
      id="comments"
      aria-labelledby="comments-heading"
      className="mt-16 scroll-mt-24"
    >
      <h2 id="comments-heading" className="mb-2 text-xl font-semibold">
        Comments
      </h2>
      <p className="mb-8 text-sm text-muted">
        Questions, corrections, or your own take are all welcome. Sign in with
        GitHub to join in.
      </p>
      <Giscus
        repo={giscusConfig.repo}
        repoId={giscusConfig.repoId}
        category={giscusConfig.category}
        categoryId={giscusConfig.categoryId}
        mapping="specific"
        term={term}
        strict="1"
        reactionsEnabled="1"
        emitMetadata="0"
        inputPosition="top"
        theme="transparent_dark"
        lang="en"
        // The iframe only loads once the reader scrolls near it, so posts
        // pay nothing for comments until someone actually gets there.
        loading="lazy"
      />
    </section>
  );
}
