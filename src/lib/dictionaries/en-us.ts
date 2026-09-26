// Source of truth for UI copy. Every other locale must provide exactly these
// keys (enforced by the `Dictionary` type). Placeholders like {minutes} are
// filled by `format()` in lib/dictionaries/index.ts.
export const enUs = {
  site: {
    title: "gsantana.dev | AI, programming & technology",
    description:
      "Gabriel Santana writes about applied AI, software engineering, and technology.",
    feedDescription: "AI, programming, and technology notes from Gabriel Santana.",
    rights: "All rights reserved.",
  },
  nav: {
    home: "Home",
    blog: "Blog",
    news: "News",
    certifications: "Certifications",
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
      "I'm Gabriel Santana. I write about applied AI, systems engineering, and the tools shaping how we build software. Notes from the field, not just theory.",
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
  news: {
    title: "News",
    description: "The stories moving AI and software engineering forward.",
    metaDescription: "Recent AI, programming, and software engineering news, curated with original summaries and links to primary sources.",
    issue: "The briefing",
    asOf: "Updated September 26, 2026",
    lead: "The lead",
    latest: "Latest stories",
    source: "Sources and further reading",
    readStory: "Read story",
    readSource: "Original publication",
    back: "Back to news",
    waferAlt: "Editorial illustration of a silicon wafer",
    codeAlt: "Editorial illustration of a code review on a laptop",
    categories: {
      ai: "Artificial intelligence",
      engineering: "Engineering",
      security: "Security",
    },
  },
  certifications: {
    eyebrow: "Study notes",
    title: "Certifications",
    description: "Exam questions, training notes, and architecture decisions explained from first principles.",
    metaDescription: "Technology certification study notes, exam question walkthroughs, and practical Azure architecture guidance by Gabriel Santana.",
    readArticle: "Read article",
    breadcrumb: "Breadcrumb",
    videoTitle: "Gabriel Santana explains an AZ-305 SQL Server migration question",
    openVideo: "Player blocked? Watch on LinkedIn",
    kinds: {
      question: "Exam walkthrough",
      training: "Training",
      guide: "Study guide",
    },
  },
  article: {
    readingTime: "{minutes} min read",
    percentRead: "{percent}% read",
    read: "Read",
    readingProgress: "Reading progress",
    onThisPage: "On this page",
    backToTop: "Back to top ↑",
    tldr: "TL;DR",
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
      "Gabriel Santana, AI Solutions Architect and Microsoft Certified Azure Solutions Architect Expert.",
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
    eyebrow: "Error 404",
    title: "This page got lost in the dungeon.",
    description:
      "The page you asked for is hidden in one of the chests below. Fight your way through, open them one by one and find it.",
    backHome: "← Take me home",
    game: {
      start: "Press Enter or tap to explore",
      hint: "Open the chests to find your lost page.",
      controls: "Move: WASD / arrows · Attack or open: J / Space · Shield: K / Shift",
      attack: "Attack / open",
      shield: "Shield",
      mimic: "It was a mimic! Run!",
      winTitle: "You found {path}!",
      winBody: "It doesn't exist. You're off to notify the master.",
      gameOver: "You fainted in the dungeon.",
      playAgain: "Play again",
      credit: "Art: Tiny Dungeon by Kenney (CC0)",
      chestTitle: "You opened a chest!",
      mimicTitle: "Uh-oh!",
      continue: "Press Space or tap to continue",
      mute: "Mute sound",
      unmute: "Turn sound on",
      // What the wrong chests contain, picked at random. Keep the same count
      // in every locale.
      chests: [
        "/about? No, that one exists. Keep looking.",
        "/wp-admin? Nice try. This isn't WordPress.",
        "/.env? Absolutely not.",
        "/index.php? Wrong decade.",
        "A rubber duck. It asks what your bug is.",
        "/node_modules? You'd need a much bigger chest.",
        "/admin? Access denied. Obviously.",
        "An old CSS hack. It still works in IE6.",
        "/login? It wants a password you don't have.",
        "A semicolon; someone was looking for it.",
      ],
    },
  },
};

export type Dictionary = typeof enUs;
