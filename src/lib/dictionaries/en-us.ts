// Source of truth for UI copy. Every other locale must provide exactly these
// keys (enforced by the `Dictionary` type). Placeholders like {minutes} are
// filled by `format()` in lib/dictionaries/index.ts.
export const enUs = {
  site: {
    title: "gsantana.dev — AI, programming & technology",
    description:
      "Gabriel Santana writes about applied AI, software engineering, and technology.",
    feedDescription: "AI, programming, and technology notes from Gabriel Santana.",
    rights: "All rights reserved.",
  },
  nav: {
    home: "Home",
    blog: "Blog",
    principles: "Principles",
    about: "About",
    language: "Language",
    rss: "RSS feed",
  },
  hero: {
    eyebrow: "AI · Software Engineering · Technology",
    headline: "Building at the edge of",
    phrases: [
      "AI and software",
      "LLMs in production",
      "agents that ship",
      "systems that scale",
      "the modern web",
    ],
    intro:
      "I'm Gabriel Santana. I write about applied AI, systems engineering, and the tools shaping how we build software — notes from the field, not just theory.",
    readBlog: "Read the blog",
    aboutMe: "About me",
  },
  home: {
    principlesTitle: "Principles",
    principlesSubtitle: "The architecture principles behind my decisions.",
    allPrinciples: "All {count} →",
    latestPosts: "Latest posts",
    viewAll: "View all →",
  },
  blog: {
    title: "Blog",
    description: "Notes on applied AI, software engineering, and technology.",
    empty: "No posts yet. Check back soon.",
  },
  article: {
    readingTime: "{minutes} min read",
    percentRead: "{percent}% read",
    read: "Read",
    readingProgress: "Reading progress",
    onThisPage: "On this page",
    backToTop: "Back to top ↑",
  },
  principles: {
    eyebrow: "Principles",
    title: "How I design systems",
    intro:
      "The architecture principles behind my decisions, from the cloud workload up to the enterprise.",
    metaDescription: "The architecture principles that guide how I design systems.",
    written: "{written}/{total} written",
    badge: "Principle",
    comingSoon: "Coming soon",
    categories: {
      cloud: "Cloud Architecture",
      enterprise: "Enterprise Architecture",
      solution: "Solution Architecture",
    },
  },
  author: {
    role: "AI Solutions Architect",
    bio: "AI Solutions Architect designing systems where applied AI meets production. I write about what I'm building, breaking, and learning.",
    aboutTheAuthor: "About the author",
    writtenBy: "Written by",
    moreAboutMe: "More about me →",
  },
  comments: {
    title: "Comments",
    invitation:
      "Questions, corrections, or your own take are all welcome. Sign in with GitHub to join in.",
  },
  about: {
    eyebrow: "About",
    metaDescription:
      "Gabriel Santana — AI Solutions Architect, Microsoft Certified Azure Solutions Architect Expert.",
    introFocus:
      "I design and build cloud systems, lately with a focus on AI agents: distributed agent platforms, enterprise RAG, and the infrastructure that keeps them running across clouds.",
    introSiteBefore:
      "This site is where I write about it: hands-on posts on Azure and architecture, and the",
    introSiteLink: "Principles",
    introSiteAfter: "I rely on when making design decisions.",
    connectLinkedIn: "Connect on LinkedIn",
    certificationsTitle: "Certifications",
    certificationsSubtitle:
      "Microsoft Azure, from administration to solution architecture.",
    projectsTitle: "Selected projects",
    projectsSubtitle: "Open source, on GitHub.",
    projects: {
      "agentic-mesh": "Open-source distributed platform for AI agents and enterprise RAG.",
      sightline: "Autonomous video and audio intelligence platform for AI agents.",
      "hybrid-cloud-mcp-agentic-framework":
        "Reference architecture connecting Google Cloud Vertex AI and Oracle Cloud through the Model Context Protocol, with event-driven, highly available multi-cloud workflows.",
      "gabe-language": "An x86 compiler built from scratch to learn how compilers work.",
    },
  },
  certification: {
    microsoftCertified: "Microsoft Certified",
    badgeAlt: "Microsoft Certified {level} badge",
    issued: "Issued",
    validUntil: "Valid until",
    credentialId: "Credential ID",
    verify: "Verify on Microsoft Learn",
    verifyLabel: "{name} ({exam}): verify on Microsoft Learn",
  },
  notFound: {
    title: "Page not found",
    description: "The page you're looking for doesn't exist or was moved.",
    backHome: "← Back home",
  },
};

export type Dictionary = typeof enUs;
