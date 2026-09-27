"use client";

import { useEffect } from "react";

interface CodeBlocksProps {
  copyLabel: string;
  copiedLabel: string;
}

const ACTIVE = "is-active";
const COPIED_MS = 1800;

function lineText(line: Element): string {
  const text = line.textContent ?? "";
  // rehype-pretty-code fills empty lines with one space so they keep their height.
  return text === " " ? "" : text;
}

function blockLines(block: Element): Element[] {
  return Array.from(block.querySelectorAll("pre [data-line]"));
}

function clearActive(except?: Element) {
  for (const line of Array.from(document.querySelectorAll(`.code-window [data-line].${ACTIVE}`))) {
    if (line.closest(".code-window") !== except) line.classList.remove(ACTIVE);
  }
}

/**
 * Behavior for the editor-style code blocks built by lib/rehype-code-window.ts:
 * the copy button, and a VS Code style current line that follows clicks
 * (shift+click selects a range) and the arrow keys.
 */
export function CodeBlocks({ copyLabel, copiedLabel }: CodeBlocksProps) {
  useEffect(() => {
    const root = document.getElementById("post-content");
    if (!root) return;
    const timers = new Map<HTMLButtonElement, number>();
    const anchors = new WeakMap<Element, number>();

    for (const button of Array.from(root.querySelectorAll<HTMLButtonElement>(".code-copy"))) {
      button.hidden = false;
      button.setAttribute("aria-label", copyLabel);
      button.title = copyLabel;
    }

    function setActive(block: Element, from: number, to: number) {
      clearActive(block);
      const [start, end] = from <= to ? [from, to] : [to, from];
      blockLines(block).forEach((line, index) => {
        line.classList.toggle(ACTIVE, index >= start && index <= end);
      });
    }

    async function copy(button: HTMLButtonElement) {
      const block = button.closest(".code-window");
      if (!block) return;
      const text = blockLines(block).map(lineText).join("\n");
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        return;
      }
      const label = button.querySelector(".code-copy-label");
      button.dataset.copied = "";
      if (label) label.textContent = copiedLabel;
      button.setAttribute("aria-label", copiedLabel);
      window.clearTimeout(timers.get(button));
      timers.set(
        button,
        window.setTimeout(() => {
          delete button.dataset.copied;
          if (label) label.textContent = "";
          button.setAttribute("aria-label", copyLabel);
        }, COPIED_MS)
      );
    }

    function onClick(event: MouseEvent) {
      const target = event.target as Element;
      const button = target.closest<HTMLButtonElement>(".code-copy");
      if (button && root!.contains(button)) {
        void copy(button);
        return;
      }
      const line = target.closest(".code-window pre [data-line]");
      const block = line?.closest(".code-window");
      if (!line || !block) {
        clearActive();
        return;
      }
      const index = blockLines(block).indexOf(line);
      const anchor = anchors.get(block);
      if (event.shiftKey && anchor !== undefined) {
        setActive(block, anchor, index);
        return;
      }
      // Dragging to select text is a selection, not a click on a line.
      if (window.getSelection()?.toString()) return;
      anchors.set(block, index);
      setActive(block, index, index);
    }

    // Shift+click would otherwise extend a text selection from the caret.
    function onMouseDown(event: MouseEvent) {
      if (!event.shiftKey) return;
      const block = (event.target as Element).closest(".code-window pre [data-line]")?.closest(".code-window");
      if (block && anchors.has(block)) event.preventDefault();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        clearActive();
        return;
      }
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      const pre = (event.target as Element).closest?.(".code-window pre");
      const block = pre?.closest(".code-window");
      if (!pre || !block) return;
      const lines = blockLines(block);
      const current = lines.findIndex((line) => line.classList.contains(ACTIVE));
      if (current < 0) return;
      event.preventDefault();
      const next = Math.min(lines.length - 1, Math.max(0, current + (event.key === "ArrowUp" ? -1 : 1)));
      anchors.set(block, next);
      setActive(block, next, next);
      lines[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
      for (const timer of timers.values()) window.clearTimeout(timer);
    };
  }, [copyLabel, copiedLabel]);

  return null;
}
