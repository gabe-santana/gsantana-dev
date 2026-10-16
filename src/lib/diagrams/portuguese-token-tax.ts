import { defineDiagram, e, n } from "@/lib/diagrams/define";

// content/posts/*/portuguese-token-tax.md
const pipeline = defineDiagram((t) => ({
  title: t("TOKENIZATION", "TOKENIZAÇÃO"),
  heading: t("THE VOCABULARY DECIDES THE BILL", "O VOCABULÁRIO DECIDE A CONTA"),
  accessible: t(
    "How text becomes tokens. Raw text, such as the word configuração, goes through a pre-tokenizer that splits it on spaces and punctuation. Each piece is then turned into tokens by byte pair encoding merges, which replace runs of bytes with the longest pieces the vocabulary knows. The result is a list of token ids, and that count is what you pay for and what fills the context window. The vocabulary itself was learned once, before the model was trained, from a sample of training data, so the share of Portuguese in that sample decides how many whole Portuguese words and endings became single tokens. The word configuração is one token in OpenAI's o200k vocabulary and three in the older cl100k.",
    "Como um texto vira tokens. O texto cru, como a palavra configuração, passa por um pré-tokenizador que o divide em espaços e pontuação. Cada pedaço vira tokens pelos merges do byte pair encoding, que trocam sequências de bytes pelos maiores pedaços que o vocabulário conhece. O resultado é uma lista de ids de token, e essa contagem é o que você paga e o que ocupa a janela de contexto. O vocabulário foi aprendido uma vez, antes do treino do modelo, a partir de uma amostra de dados, então a fatia de português nessa amostra decide quantas palavras e terminações em português viraram um token só. A palavra configuração é um token no vocabulário o200k da OpenAI e três no cl100k, mais antigo."
  ),
  desktop: {
    cols: 4,
    rows: 2,
    gapX: 40,
    nodes: [
      n("text", 0, 0, "muted", t("Raw text", "Texto cru"), '" configuração"'),
      n("pre", 1, 0, "violet", t("Pre-tokenizer", "Pré-tokenizador"), t("splits on spaces, punctuation", "divide em espaços, pontuação")),
      n("bpe", 2, 0, "accent", t("BPE merges", "Merges do BPE"), t("bytes to known pieces", "bytes viram pedaços")),
      n("ids", 3, 0, "blue", t("Token ids", "Ids de token"), [t("o200k: 1 token", "o200k: 1 token"), t("cl100k: 3 tokens", "cl100k: 3 tokens")]),
      n("data", 1, 1, "muted", t("Tokenizer training mix", "Amostra de treino"), t("how much Portuguese", "quanto português havia")),
      n("vocab", 2, 1, "amber", t("Vocabulary", "Vocabulário"), [t("learned once, frozen", "aprendido uma vez"), t("100k to 262k pieces", "de 100k a 262k pedaços")]),
    ],
    edges: [
      e("text", "pre", { tone: "muted" }),
      e("pre", "bpe", { tone: "violet" }),
      e("bpe", "ids", { tone: "blue" }),
      e("data", "vocab", { tone: "muted", dashed: true }),
      e("vocab", "bpe", { tone: "amber" }),
    ],
  },
  mobile: {
    cols: 2,
    rows: 3,
    nodes: [
      n("text", 0, 0, "muted", t("Raw text", "Texto cru"), '" configuração"'),
      n("pre", 1, 0, "violet", t("Pre-tokenizer", "Pré-tokenizador"), t("spaces, punctuation", "espaços, pontuação")),
      n("bpe", 1, 1, "accent", t("BPE merges", "Merges do BPE"), t("bytes to pieces", "bytes viram pedaços")),
      n("ids", 0, 1, "blue", t("Token ids", "Ids de token"), t("o200k 1, cl100k 3", "o200k 1, cl100k 3")),
      n("data", 0, 2, "muted", t("Training mix", "Amostra de treino"), t("how much Portuguese", "quanto português")),
      n("vocab", 1, 2, "amber", t("Vocabulary", "Vocabulário"), t("100k to 262k", "100k a 262k")),
    ],
    edges: [
      e("text", "pre", { tone: "muted" }),
      e("pre", "bpe", { tone: "violet" }),
      e("bpe", "ids", { tone: "blue" }),
      e("data", "vocab", { tone: "muted", dashed: true }),
      e("vocab", "bpe", { tone: "amber" }),
    ],
  },
}));

export const tokenTaxDiagrams: Record<string, ReturnType<typeof defineDiagram>> = {
  "token-tax-pipeline": pipeline,
};
