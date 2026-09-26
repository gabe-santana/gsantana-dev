"use client";

import { useEffect, useRef, useState } from "react";
import { GitHubIcon } from "@/components/icons";
import { format } from "@/lib/dictionaries";
import type { Dictionary } from "@/lib/dictionaries";
import type { PublicUser } from "@/lib/user";
import { deleteAccount, loadUser, signInHref, signOut } from "@/lib/user-client";

type State = { status: "unknown" } | { status: "signedOut" } | { status: "signedIn"; user: PublicUser };

export function UserMenu({ labels }: { labels: Dictionary["auth"] }) {
  const [state, setState] = useState<State>({ status: "unknown" });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadUser().then((user) => {
      if (!cancelled) setState(user ? { status: "signedIn", user } : { status: "signedOut" });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Same footprint while the session is being checked, so the header doesn't jump.
  if (state.status === "unknown") return <span aria-hidden className="block h-7 w-7" />;

  if (state.status === "signedOut") {
    return (
      <a
        href={signInHref()}
        onClick={(event) => {
          event.currentTarget.href = signInHref();
        }}
        title={labels.signInHint}
        className="flex items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-accent/50 hover:text-foreground"
      >
        <GitHubIcon className="h-3.5 w-3.5" />
        <span>{labels.signIn}</span>
      </a>
    );
  }

  const { user } = state;
  const run = (action: () => Promise<void>) => {
    setBusy(true);
    void action();
  };

  return (
    <div ref={rootRef} data-clarity-mask="true" className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={format(labels.menuLabel, { login: user.login })}
        className="block h-7 w-7 overflow-hidden rounded-full border border-border/70 transition-colors hover:border-accent/60"
      >
        {user.avatarUrl ? (
          // Plain <img>: static export, and GitHub's avatar CDN already serves small sizes.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${user.avatarUrl}${user.avatarUrl.includes("?") ? "&" : "?"}s=56`} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-surface font-mono text-xs text-accent">
            {user.login.slice(0, 1).toUpperCase()}
          </span>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 border border-border bg-background p-2 text-sm shadow-2xl"
        >
          <p className="px-2 pb-2 pt-1 text-xs text-muted">
            {labels.signedInAs}{" "}
            <span className="font-mono text-foreground">@{user.login}</span>
          </p>
          <p className="border-t border-border/70 px-2 py-2 text-[11px] leading-relaxed text-muted">{labels.privacy}</p>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => run(signOut)}
            className="block w-full px-2 py-2 text-left text-foreground transition-colors hover:bg-accent/10 disabled:opacity-50"
          >
            {labels.signOut}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              dialogRef.current?.showModal();
            }}
            className="block w-full px-2 py-2 text-left text-red-400 transition-colors hover:bg-red-400/10 disabled:opacity-50"
          >
            {labels.deleteData}
          </button>
        </div>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-labelledby="delete-account-title"
        onClick={(event) => {
          if (event.target === dialogRef.current && !busy) dialogRef.current.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md overflow-hidden border border-border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        <div className="relative px-6 py-6">
          <div aria-hidden className="bg-grid bg-grid-fade pointer-events-none absolute inset-0 opacity-50" />
          <div className="relative">
            <p className="font-mono text-[11px] text-red-400">@{user.login}</p>
            <h2 id="delete-account-title" className="mt-2 text-2xl font-bold">
              {labels.deleteTitle}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{labels.deleteText}</p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                autoFocus
                disabled={busy}
                onClick={() => dialogRef.current?.close()}
                className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-accent/60 disabled:opacity-50"
              >
                {labels.deleteCancel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(deleteAccount)}
                className="rounded-full bg-red-500 px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
              >
                {busy ? labels.deleting : labels.deleteConfirm}
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
