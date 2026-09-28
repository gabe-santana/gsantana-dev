// Share links for articles. Every shared URL carries utm_source=<network> and
// utm_medium=share, so access insights (page_views.source / utm_medium) can
// tell a share-bar visit from any other: apps like LinkedIn's often send no
// referrer at all.

export const SHARE_NETWORKS = ["linkedin", "whatsapp", "x", "bluesky", "reddit", "telegram", "facebook", "email"] as const;

export type ShareNetwork = (typeof SHARE_NETWORKS)[number];

/** How a copied link or the device's share sheet tags the URL. */
export const COPY_SOURCE = "copied_link";
export const NATIVE_SOURCE = "share_sheet";

export const NETWORK_NAMES: Record<ShareNetwork, string> = {
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  x: "X",
  bluesky: "Bluesky",
  reddit: "Reddit",
  telegram: "Telegram",
  facebook: "Facebook",
  email: "Email",
};

export function taggedUrl(url: string, source: string): string {
  const tagged = new URL(url);
  tagged.searchParams.set("utm_source", source);
  tagged.searchParams.set("utm_medium", "share");
  return tagged.toString();
}

export function shareHref(network: ShareNetwork, url: string, title: string): string {
  const link = encodeURIComponent(taggedUrl(url, network));
  const text = encodeURIComponent(title);
  switch (network) {
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${link}`;
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(`${title} ${taggedUrl(url, network)}`)}`;
    case "x":
      return `https://x.com/intent/post?text=${text}&url=${link}`;
    case "bluesky":
      return `https://bsky.app/intent/compose?text=${encodeURIComponent(`${title} ${taggedUrl(url, network)}`)}`;
    case "reddit":
      return `https://www.reddit.com/submit?url=${link}&title=${text}`;
    case "telegram":
      return `https://t.me/share/url?url=${link}&text=${text}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${link}`;
    case "email":
      return `mailto:?subject=${text}&body=${link}`;
  }
}
