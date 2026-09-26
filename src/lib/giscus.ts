// Comments are GitHub Discussions in the site's own public repo, via giscus.
// These IDs are public (they're sent to the browser anyway), not secrets.
// Get them from https://giscus.app after enabling Discussions on the repo
// and installing the giscus GitHub app. The comments section stays hidden
// until both IDs are filled in.
export const giscusConfig = {
  repo: "gabe-santana/gsantana-dev",
  repoId: "R_kgDOUs2CSQ",
  category: "Announcements",
  categoryId: "DIC_kwDOUs2CSc4DGcji",
} as const;

export const isGiscusConfigured = Boolean(
  giscusConfig.repoId && giscusConfig.categoryId
);
