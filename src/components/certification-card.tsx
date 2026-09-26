import Image from "next/image";
import { ExternalLinkIcon } from "@/components/icons";
import type { Certification } from "@/lib/author";
import { mediaUrl } from "@/lib/media";

function formatMonth(yyyyMm: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${yyyyMm}-01T00:00:00Z`));
}

export function CertificationCard({ cert }: { cert: Certification }) {
  return (
    <a
      href={cert.verifyUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`${cert.name} (${cert.exam}): verify on Microsoft Learn`}
      className="group relative block rounded-2xl bg-border/70 p-px transition-[transform,box-shadow] duration-300 hover:shadow-[0_0_40px_-12px_rgb(94_234_212/0.45)] focus-visible:shadow-[0_0_40px_-12px_rgb(94_234_212/0.45)] focus-visible:outline-none motion-safe:hover:-translate-y-1"
    >
      {/* Gradient border as its own layer: gradients can't transition, but
          this layer's opacity can, so the border fades in smoothly. */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent via-border to-[#a78bfa] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
      />

      <div className="relative flex h-full flex-col items-center rounded-[calc(1rem-1px)] bg-surface p-6 text-center">
        <Image
          src={mediaUrl(cert.badge)}
          alt={`Microsoft Certified ${cert.level} badge`}
          width={112}
          height={112}
          className="h-28 w-28 transition-transform duration-300 motion-safe:group-hover:scale-105"
        />

        <span className="mt-4 rounded-full border border-border px-2.5 py-0.5 font-mono text-xs text-accent">
          {cert.exam}
        </span>
        <h3 className="mt-3 text-lg font-semibold leading-snug text-foreground">
          {cert.name}
        </h3>
        <p className="mb-5 mt-1 text-sm text-muted">Microsoft Certified</p>

        {/* mt-auto pins the details to the bottom, so they line up across
            cards whether the title takes one line or two. */}
        <dl className="mt-auto w-full space-y-1.5 border-t border-border/60 pt-4 text-left text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Issued</dt>
            <dd className="text-foreground/90">{formatMonth(cert.issued)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Valid until</dt>
            <dd className="text-foreground/90">{formatMonth(cert.expires)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Credential ID</dt>
            <dd className="font-mono text-foreground/90">{cert.credentialId}</dd>
          </div>
        </dl>

        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors group-hover:text-accent">
          Verify on Microsoft Learn
          <ExternalLinkIcon />
        </span>
      </div>
    </a>
  );
}
