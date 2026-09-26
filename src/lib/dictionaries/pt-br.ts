import type { Dictionary } from "@/lib/dictionaries/en-us";

export const ptBr: Dictionary = {
  site: {
    title: "gsantana.dev — IA, programação e tecnologia",
    description:
      "Gabriel Santana escreve sobre IA aplicada, engenharia de software e tecnologia.",
    feedDescription: "Notas de Gabriel Santana sobre IA, programação e tecnologia.",
    rights: "Todos os direitos reservados.",
  },
  nav: {
    home: "Início",
    blog: "Blog",
    principles: "Princípios",
    about: "Sobre",
    language: "Idioma",
    rss: "Feed RSS",
  },
  hero: {
    eyebrow: "IA · Engenharia de Software · Tecnologia",
    headline: "Construindo na fronteira entre",
    phrases: [
      "IA e software",
      "LLMs em produção",
      "agentes que entregam",
      "sistemas que escalam",
      "a web moderna",
    ],
    intro:
      "Sou Gabriel Santana. Escrevo sobre IA aplicada, engenharia de sistemas e as ferramentas que estão mudando como construímos software — notas de quem está na prática, não só teoria.",
    readBlog: "Ler o blog",
    aboutMe: "Sobre mim",
  },
  home: {
    principlesTitle: "Princípios",
    principlesSubtitle: "Os princípios de arquitetura por trás das minhas decisões.",
    allPrinciples: "Todos os {count} →",
    latestPosts: "Posts recentes",
    viewAll: "Ver todos →",
  },
  blog: {
    title: "Blog",
    description: "Notas sobre IA aplicada, engenharia de software e tecnologia.",
    empty: "Nenhum post ainda. Volte em breve.",
  },
  article: {
    readingTime: "{minutes} min de leitura",
    percentRead: "{percent}% lido",
    read: "Lido",
    readingProgress: "Progresso de leitura",
    onThisPage: "Nesta página",
    backToTop: "Voltar ao topo ↑",
  },
  principles: {
    eyebrow: "Princípios",
    title: "Como eu projeto sistemas",
    intro:
      "Os princípios de arquitetura por trás das minhas decisões, do workload na nuvem até a empresa.",
    metaDescription: "Os princípios de arquitetura que guiam como eu projeto sistemas.",
    written: "{written}/{total} escritos",
    badge: "Princípio",
    comingSoon: "Em breve",
    categories: {
      cloud: "Arquitetura Cloud",
      enterprise: "Arquitetura Corporativa",
      solution: "Arquitetura de Soluções",
    },
  },
  author: {
    role: "Arquiteto de Soluções de IA",
    bio: "Arquiteto de Soluções de IA, projetando sistemas onde a IA aplicada encontra a produção. Escrevo sobre o que estou construindo, quebrando e aprendendo.",
    aboutTheAuthor: "Sobre o autor",
    writtenBy: "Escrito por",
    moreAboutMe: "Mais sobre mim →",
  },
  comments: {
    title: "Comentários",
    invitation:
      "Dúvidas, correções ou sua própria visão são todas bem-vindas. Entre com o GitHub para participar.",
  },
  about: {
    eyebrow: "Sobre",
    metaDescription:
      "Gabriel Santana — Arquiteto de Soluções de IA, Microsoft Certified Azure Solutions Architect Expert.",
    introFocus:
      "Projeto e construo sistemas em nuvem, ultimamente com foco em agentes de IA: plataformas distribuídas de agentes, RAG corporativo e a infraestrutura que os mantém rodando entre nuvens.",
    introSiteBefore:
      "Este site é onde escrevo sobre isso: posts práticos sobre Azure e arquitetura, e os",
    introSiteLink: "Princípios",
    introSiteAfter: "em que me apoio para tomar decisões de design.",
    connectLinkedIn: "Conectar no LinkedIn",
    certificationsTitle: "Certificações",
    certificationsSubtitle: "Microsoft Azure, da administração à arquitetura de soluções.",
    projectsTitle: "Projetos em destaque",
    projectsSubtitle: "Open source, no GitHub.",
    projects: {
      "agentic-mesh":
        "Plataforma open source distribuída para agentes de IA e RAG corporativo.",
      sightline: "Plataforma autônoma de inteligência de vídeo e áudio para agentes de IA.",
      "hybrid-cloud-mcp-agentic-framework":
        "Arquitetura de referência conectando o Google Cloud Vertex AI e a Oracle Cloud via Model Context Protocol, com workflows multi-cloud orientados a eventos e de alta disponibilidade.",
      "gabe-language": "Um compilador x86 feito do zero para aprender como compiladores funcionam.",
    },
  },
  certification: {
    microsoftCertified: "Microsoft Certified",
    badgeAlt: "Badge Microsoft Certified {level}",
    issued: "Emitida em",
    validUntil: "Válida até",
    credentialId: "ID da credencial",
    verify: "Verificar no Microsoft Learn",
    verifyLabel: "{name} ({exam}): verificar no Microsoft Learn",
  },
  notFound: {
    title: "Página não encontrada",
    description: "A página que você procura não existe ou foi movida.",
    backHome: "← Voltar ao início",
  },
};
