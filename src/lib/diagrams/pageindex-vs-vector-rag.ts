import { defineDiagram, e, n } from "@/lib/diagrams/define";

// content/posts/*/pageindex-vs-vector-rag-benchmark.md
export const pageindexVsRagPipelines = defineDiagram((t) => {
  const indexTime = t("INDEX TIME", "INDEXAÇÃO");
  const queryTime = t("QUERY TIME", "CONSULTA");
  return {
    title: t("TWO WAYS TO RETRIEVE", "DUAS FORMAS DE RECUPERAR"),
    heading: t("SIMILARITY OR NAVIGATION", "SIMILARIDADE OU NAVEGAÇÃO"),
    accessible: t(
      "Vector RAG, at index time, cuts the page text into chunks and embeds each one into a vector index. At query time it embeds the question, takes the top-k most similar chunks and hands them to the LLM in one call. PageIndex, at index time, detects the document's outline from the layout without an LLM, then asks an LLM for a summary of every node, which gives a tree of titles, page ranges and summaries. At query time an LLM agent reads that tree, picks the sections that should hold the answer, reads their pages with a tool, and repeats until it can answer.",
      "O RAG vetorial, na indexação, corta o texto das páginas em chunks e transforma cada um em embedding num índice vetorial. Na consulta, gera o embedding da pergunta, pega os top-k chunks mais parecidos e entrega tudo ao LLM numa chamada. O PageIndex, na indexação, detecta o sumário do documento pelo layout sem LLM e depois pede a um LLM o resumo de cada nó, o que gera uma árvore de títulos, faixas de páginas e resumos. Na consulta, um agente LLM lê essa árvore, escolhe as seções que devem ter a resposta, lê as páginas delas com uma ferramenta e repete até conseguir responder."
    ),
    desktop: {
      cols: 4,
      rows: 4,
      zones: [
        { col: 0, row: 0, span: 4, rowSpan: 2, tone: "violet", dashed: true, label: t("VECTOR RAG", "RAG VETORIAL") },
        { col: 0, row: 2, span: 4, rowSpan: 2, tone: "accent", dashed: true, label: "PAGEINDEX" },
      ],
      nodes: [
        n("v-pages", 0, 0, "muted", t("Page text", "Texto das páginas"), indexTime),
        n("v-chunks", 1, 0, "violet", "Chunks", t("300 words each", "300 palavras cada")),
        n("v-embed", 2, 0, "violet", t("Embed", "Embedding"), t("one vector per chunk", "um vetor por chunk")),
        n("v-index", 3, 0, "violet", t("Vector index", "Índice vetorial")),
        n("v-q", 0, 1, "muted", t("Question", "Pergunta"), queryTime),
        n("v-topk", 1.5, 1, "violet", t("Top-k similar chunks", "Top-k chunks parecidos"), t("one shot, no second look", "uma tacada, sem segunda olhada"), { span: 1.4 }),
        n("v-llm", 3, 1, "blue", t("LLM answers", "LLM responde"), t("1 call", "1 chamada")),
        n("p-pages", 0, 2, "muted", "PDF", indexTime),
        n("p-outline", 1, 2, "accent", t("Layout outline", "Sumário pelo layout"), t("no LLM", "sem LLM")),
        n("p-summ", 2, 2, "accent", t("Node summaries", "Resumos dos nós"), t("LLM, per node", "LLM, por nó")),
        n("p-tree", 3, 2, "amber", t("Tree index", "Índice em árvore"), t("titles, pages, summaries", "títulos, páginas, resumos")),
        n("p-q", 0, 3, "muted", t("Question", "Pergunta"), queryTime),
        n("p-agent", 1.5, 3, "amber", t("Agent reads the tree", "Agente lê a árvore"), t("picks sections, reads pages", "escolhe seções, lê páginas"), { span: 1.4 }),
        n("p-llm", 3, 3, "blue", t("Answer", "Resposta"), t("3 to 10 calls", "3 a 10 chamadas")),
      ],
      edges: [
        e("v-pages", "v-chunks", { tone: "violet" }),
        e("v-chunks", "v-embed", { tone: "violet" }),
        e("v-embed", "v-index", { tone: "violet" }),
        e("v-q", "v-topk", { tone: "violet" }),
        e("v-topk", "v-llm", { tone: "blue" }),
        e("v-index", "v-topk", { tone: "violet", dashed: true }),
        e("p-pages", "p-outline", { tone: "accent" }),
        e("p-outline", "p-summ", { tone: "accent" }),
        e("p-summ", "p-tree", { tone: "accent" }),
        e("p-q", "p-agent", { tone: "amber" }),
        e("p-agent", "p-llm", { tone: "blue" }),
        e("p-tree", "p-agent", { tone: "amber", dashed: true }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 8,
      zones: [
        { col: 0, row: 0, span: 2, rowSpan: 4, tone: "violet", dashed: true, label: t("VECTOR RAG", "RAG VETORIAL") },
        { col: 0, row: 4, span: 2, rowSpan: 4, tone: "accent", dashed: true, label: "PAGEINDEX" },
      ],
      nodes: [
        n("v-pages", 0, 0, "muted", t("Page text", "Texto das páginas"), indexTime),
        n("v-chunks", 1, 0, "violet", "Chunks", t("300 words", "300 palavras")),
        n("v-index", 1, 1, "violet", t("Vector index", "Índice vetorial"), t("embeddings", "embeddings")),
        n("v-q", 0, 2, "muted", t("Question", "Pergunta"), queryTime),
        n("v-topk", 1, 2, "violet", t("Top-k chunks", "Top-k chunks"), t("most similar", "mais parecidos")),
        n("v-llm", 1, 3, "blue", t("LLM answers", "LLM responde"), t("1 call", "1 chamada")),
        n("p-pages", 0, 4, "muted", "PDF", indexTime),
        n("p-outline", 1, 4, "accent", t("Layout outline", "Sumário pelo layout"), t("no LLM", "sem LLM")),
        n("p-tree", 1, 5, "amber", t("Tree index", "Árvore"), t("+ LLM summaries", "+ resumos do LLM")),
        n("p-q", 0, 6, "muted", t("Question", "Pergunta"), queryTime),
        n("p-agent", 1, 6, "amber", t("Agent", "Agente"), t("reads tree, pages", "lê árvore, páginas")),
        n("p-llm", 1, 7, "blue", t("Answer", "Resposta"), t("3 to 10 calls", "3 a 10 chamadas")),
      ],
      edges: [
        e("v-pages", "v-chunks", { tone: "violet" }),
        e("v-chunks", "v-index", { tone: "violet" }),
        e("v-index", "v-topk", { tone: "violet", dashed: true }),
        e("v-q", "v-topk", { tone: "violet" }),
        e("v-topk", "v-llm", { tone: "blue" }),
        e("p-pages", "p-outline", { tone: "accent" }),
        e("p-outline", "p-tree", { tone: "accent" }),
        e("p-tree", "p-agent", { tone: "amber", dashed: true }),
        e("p-q", "p-agent", { tone: "amber" }),
        e("p-agent", "p-llm", { tone: "blue" }),
      ],
    },
  };
});

export const pageindexAgentLoop = defineDiagram((t) => ({
  title: t("PAGEINDEX RETRIEVAL", "RECUPERAÇÃO NO PAGEINDEX"),
  heading: t("THE AGENT LOOP", "O LOOP DO AGENTE"),
  accessible: t(
    "The question goes to an LLM agent that has two tools. It first calls get_document_structure and gets the tree: node titles, the page each node starts on and a summary. It reasons over the tree, picks the nodes that should hold the answer and calls get_page_content with a tight page range. If what it read answers the question, it writes the answer, with page citations. If not, it goes back to the tree and picks other nodes, until it answers or runs out of turns.",
    "A pergunta vai para um agente LLM que tem duas ferramentas. Ele chama primeiro get_document_structure e recebe a árvore: títulos dos nós, a página onde cada nó começa e um resumo. Ele raciocina sobre a árvore, escolhe os nós que devem ter a resposta e chama get_page_content com uma faixa curta de páginas. Se o que leu responde a pergunta, escreve a resposta com citação de páginas. Se não, volta à árvore e escolhe outros nós, até responder ou acabar o limite de turnos."
  ),
  desktop: {
    cols: 4,
    rows: 2,
    nodes: [
      n("q", 0, 0, "muted", t("Question", "Pergunta"), t("+ document id", "+ id do documento")),
      n("struct", 1, 0, "amber", "get_document_structure", t("titles, pages, summaries", "títulos, páginas, resumos")),
      n("pick", 2, 0, "accent", t("Reason over the tree", "Raciocina na árvore"), t("which nodes hold it?", "quais nós têm isso?")),
      n("read", 3, 0, "amber", "get_page_content", t("tight page range", "faixa curta de páginas")),
      n("enough", 2, 1, "violet", t("Enough to answer?", "Dá para responder?")),
      n("answer", 0.5, 1, "blue", t("Answer with page citations", "Resposta com páginas citadas"), undefined, { span: 1.4 }),
    ],
    edges: [
      e("q", "struct", { tone: "amber" }),
      e("struct", "pick", { tone: "accent" }),
      e("pick", "read", { tone: "amber" }),
      e("read", "enough", { tone: "violet", route: "vh" }),
      e("enough", "answer", { tone: "blue", label: t("yes", "sim") }),
      e("enough", "pick", { tone: "accent", dashed: true, label: t("no, look elsewhere", "não, procura em outro lugar"), labelSide: "right" }),
    ],
  },
  mobile: {
    cols: 2,
    rows: 4,
    nodes: [
      n("q", 0, 0, "muted", t("Question", "Pergunta"), t("+ document id", "+ id do documento")),
      n("struct", 1, 0, "amber", "get_document_structure", t("the tree", "a árvore")),
      n("pick", 1, 1, "accent", t("Reason over tree", "Raciocina na árvore"), t("pick nodes", "escolhe nós")),
      n("read", 1, 2, "amber", "get_page_content", t("tight page range", "faixa curta")),
      n("enough", 0, 2, "violet", t("Enough?", "Dá para responder?")),
      n("answer", 0, 3, "blue", t("Answer", "Resposta"), t("with page citations", "com páginas citadas")),
    ],
    edges: [
      e("q", "struct", { tone: "amber" }),
      e("struct", "pick", { tone: "accent" }),
      e("pick", "read", { tone: "amber" }),
      e("read", "enough", { tone: "violet" }),
      e("enough", "answer", { tone: "blue", label: t("yes", "sim") }),
      e("enough", "pick", { tone: "accent", dashed: true, route: "vh", label: t("no", "não") }),
    ],
  },
}));

export const pageindexBenchmarkHarness = defineDiagram((t) => ({
  title: t("THE BENCHMARK", "O BENCHMARK"),
  heading: t("SAME TEXT, SAME MODEL, DIFFERENT RETRIEVAL", "MESMO TEXTO, MESMO MODELO, OUTRA RECUPERAÇÃO"),
  accessible: t(
    "FinanceBench supplies the questions, with the gold answer and the page the evidence came from; 46 questions over 11 filings were answered. The same PyPDF2 page text feeds three systems: vector RAG with dense retrieval only, vector RAG with BM25 plus embeddings, rank fusion and a reranker, and PageIndex. All three answer with the same gpt-4.1 model and the same instructions. The answers, with the pages each system read, go to an LLM judge whose every verdict is then reviewed, and to a page check that asks whether the system read the gold evidence page. A report adds up accuracy, evidence page hits, tokens, cost and time.",
    "O FinanceBench fornece as perguntas, com a resposta de referência e a página de onde veio a evidência; foram respondidas 46 perguntas sobre 11 documentos. O mesmo texto de página do PyPDF2 alimenta três sistemas: RAG vetorial só com busca densa, RAG vetorial com BM25 mais embeddings, fusão de rankings e reranker, e o PageIndex. Os três respondem com o mesmo gpt-4.1 e as mesmas instruções. As respostas, com as páginas que cada sistema leu, vão para um LLM juiz, com cada veredito revisado depois, e para uma checagem de página que pergunta se o sistema leu a página da evidência. Um relatório soma acurácia, acertos de página, tokens, custo e tempo."
  ),
  desktop: {
    cols: 5,
    rows: 3,
    zones: [{ col: 1, row: 0, span: 1, rowSpan: 3, tone: "muted", dashed: true, label: t("SAME GPT-4.1", "MESMO GPT-4.1") }],
    nodes: [
      n("fb", 0, 0.5, "muted", "FinanceBench", t("46 questions", "46 perguntas")),
      n("text", 0, 1.5, "muted", t("Page text", "Texto"), t("one extraction", "uma extração")),
      n("dense", 1, 0, "violet", "rag-dense", t("dense, top 8", "denso, top 8")),
      n("hybrid", 1, 1, "violet", "rag-hybrid", t("BM25 + dense, rerank", "BM25 + denso, rerank")),
      n("pi", 1, 2, "amber", "pageindex", t("tree + agent", "árvore + agente")),
      n("answers", 2, 1, "blue", t("Answers", "Respostas"), t("+ pages read", "+ páginas lidas")),
      n("judge", 3, 0.5, "blue", t("LLM judge", "LLM juiz"), t("then reviewed", "depois revisado")),
      n("pagecheck", 3, 1.5, "accent", t("Page check", "Página certa?"), t("gold page read?", "leu a de referência?")),
      n("report", 4, 1, "blue", t("Report", "Relatório"), t("accuracy, cost", "acurácia, custo")),
    ],
    edges: [
      e("fb", "text", { tone: "muted" }),
      e("text", "dense", { route: "hvh", tone: "violet" }),
      e("text", "hybrid", { route: "hvh", tone: "violet" }),
      e("text", "pi", { route: "hvh", tone: "amber" }),
      e("dense", "answers", { route: "hvh", tone: "violet" }),
      e("hybrid", "answers", { tone: "violet" }),
      e("pi", "answers", { route: "hvh", tone: "amber" }),
      e("answers", "judge", { route: "hvh", tone: "blue" }),
      e("answers", "pagecheck", { route: "hvh", tone: "accent" }),
      e("judge", "report", { route: "hvh", tone: "blue" }),
      e("pagecheck", "report", { route: "hvh", tone: "blue" }),
    ],
  },
  mobile: {
    cols: 3,
    rows: 6,
    nodes: [
      n("fb", 0.5, 0, "muted", "FinanceBench", t("46 questions", "46 perguntas")),
      n("text", 1.5, 0, "muted", t("Page text", "Texto"), t("one extraction", "uma extração")),
      n("dense", 0, 1.2, "violet", "rag-dense"),
      n("hybrid", 1, 1.2, "violet", "rag-hybrid"),
      n("pi", 2, 1.2, "amber", "pageindex"),
      n("answers", 1, 2.4, "blue", t("Answers", "Respostas"), t("+ pages read", "+ páginas")),
      n("judge", 0.5, 3.6, "blue", t("LLM judge", "LLM juiz"), t("reviewed", "revisado")),
      n("pagecheck", 1.5, 3.6, "accent", t("Page check", "Página certa?")),
      n("report", 1, 4.8, "blue", t("Report", "Relatório")),
    ],
    edges: [
      e("fb", "text", { tone: "muted" }),
      e("text", "dense", { tone: "violet" }),
      e("text", "hybrid", { tone: "violet" }),
      e("text", "pi", { tone: "amber" }),
      e("dense", "answers", { tone: "violet" }),
      e("hybrid", "answers", { tone: "violet" }),
      e("pi", "answers", { tone: "amber" }),
      e("answers", "judge", { tone: "blue" }),
      e("answers", "pagecheck", { tone: "accent" }),
      e("judge", "report", { tone: "blue" }),
      e("pagecheck", "report", { tone: "blue" }),
    ],
  },
}));
