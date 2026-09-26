export const author = {
  name: "Gabriel Santana",
  role: "AI Solutions Architect",
  email: "contact@gsantana.dev",
  bio: "AI Solutions Architect designing systems where applied AI meets production. I write about what I'm building, breaking, and learning.",
  // Small pre-cropped avatar on the media CDN; the original photo is far
  // too heavy (12 MB) to ship for an 80px image.
  avatar: "/author/me-avatar.webp",
  portrait: "/author/me-portrait.webp",
  github: "https://github.com/gabe-santana",
  linkedin: "https://www.linkedin.com/in/gsantana-s/",
  youtube: "https://www.youtube.com/channel/UCfVbIg4I9g0KdCtMP82bj4w",
};

export interface Certification {
  name: string;
  exam: string;
  level: "Expert" | "Associate";
  badge: string;
  /** YYYY-MM */
  issued: string;
  /** YYYY-MM */
  expires: string;
  credentialId: string;
  /** Microsoft Learn credential page. */
  verifyUrl: string;
}

export const certifications: Certification[] = [
  {
    name: "Azure Solutions Architect Expert",
    exam: "AZ-305",
    level: "Expert",
    badge: "/author/certifications/azure-expert-badge.svg",
    issued: "2024-12",
    expires: "2026-12",
    credentialId: "A43BBC264A6C62C7",
    verifyUrl: "https://learn.microsoft.com/en-us/users/gsantana/credentials/a43bbc264a6c62c7",
  },
  {
    name: "Azure Developer Associate",
    exam: "AZ-204",
    level: "Associate",
    badge: "/author/certifications/azure-associate-badge.svg",
    issued: "2025-02",
    expires: "2027-02",
    credentialId: "E5F31124BB3ADBF9",
    verifyUrl: "https://learn.microsoft.com/en-us/users/gsantana/credentials/e5f31124bb3adbf9",
  },
  {
    name: "Azure Administrator Associate",
    exam: "AZ-104",
    level: "Associate",
    badge: "/author/certifications/azure-associate-badge.svg",
    issued: "2024-11",
    expires: "2026-11",
    credentialId: "49BF17BCE4622EAB",
    verifyUrl: "https://learn.microsoft.com/en-us/users/gsantana/credentials/49bf17bce4622eab",
  },
];
