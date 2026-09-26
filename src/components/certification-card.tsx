import Image from "next/image";
import { ExternalLinkIcon } from "@/components/icons";
import type { Certification } from "@/lib/author";
import { format, type Dictionary } from "@/lib/dictionaries";
import { formatMonth } from "@/lib/format-date";
import type { Locale } from "@/lib/i18n";
import { mediaUrl } from "@/lib/media";

export function CertificationCard({
  cert,
  locale,
  labels,
}: {
  cert: Certification;
  locale: Locale;
  labels: Dictionary["certification"];
}) {
  return (
    <a
      href={cert.verifyUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={format(labels.verifyLabel, {
        name: cert.name,
        exam: cert.exam,
      })}
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
          alt={format(labels.badgeAlt, { level: cert.level })}
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
        <p className="mb-5 mt-1 text-sm text-muted">
          {labels.microsoftCertified}
        </p>

        {/* mt-auto pins the details to the bottom, so they line up across
            cards whether the title takes one line or two. */}
        <dl className="mt-auto w-full space-y-1.5 border-t border-border/60 pt-4 text-left text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{labels.issued}</dt>
            <dd className="text-foreground/90">
              {formatMonth(cert.issued, locale)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{labels.validUntil}</dt>
            <dd className="text-foreground/90">
              {formatMonth(cert.expires, locale)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{labels.credentialId}</dt>
            <dd className="font-mono text-foreground/90">
              {cert.credentialId}
            </dd>
          </div>
        </dl>

        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors group-hover:text-accent">
          {labels.verify}
          <ExternalLinkIcon />
        </span>
      </div>
    </a>
  );
}
