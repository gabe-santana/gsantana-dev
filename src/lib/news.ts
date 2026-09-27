import type { Locale } from "@/lib/i18n";

export type NewsCategory = "ai" | "engineering" | "security";

interface NewsCopy {
  title: string;
  summary: string;
  body: string[];
  analysis: string;
}

export interface NewsStory {
  slug: string;
  date: string;
  category: NewsCategory;
  publisher: string;
  sourceUrl: string;
  sources: { url: string; label: Record<Locale, string> }[];
  image: string;
  copy: Record<Locale, NewsCopy>;
}

// A dated editorial selection; the static export does not fetch news at request time.
export const newsStories: NewsStory[] = [
  {
    slug: "jev-vs-laya-decision-models",
    date: "2026-09-26",
    category: "ai",
    publisher: "",
    sourceUrl: "https://imasters.com.br/noticia/laya-chega-como-alternativa-open-source-ao-jev-da-typesafe-ai",
    sources: [
      { url: "https://typesafe.ai/blog/introducing-system-one-models-and-jev", label: { "en-us": "TypeSafe AI: Jev announcement and evaluation caveats", "pt-br": "TypeSafe AI: anúncio do Jev e ressalvas das avaliações" } },
      { url: "https://docs.typesafe.ai/", label: { "en-us": "TypeSafe AI: typed decisions and parallel questions", "pt-br": "TypeSafe AI: decisões tipadas e perguntas em paralelo" } },
      { url: "https://finance.yahoo.com/technology/ai/articles/jev-ai-model-t-chat-100610738.html", label: { "en-us": "Bloomberg via Yahoo Finance: the proposal behind Jev", "pt-br": "Bloomberg via Yahoo Finance: a proposta do Jev" } },
    ],
    image: "/news/jev-vs-laya-decision-models/cover.webp?v=46ad76f87359",
    copy: {
      "en-us": {
        title: "Jev vs. Laya: open weights enter the race for AI that decides instead of chatting",
        summary: "ConvAI Innovations positions Laya as an open alternative to TypeSafe AI's Jev. The comparison puts hosting, calibration and benchmark conditions in focus.",
        body: [
          "ConvAI Innovations has introduced Laya as an open alternative to Jev, TypeSafe AI's model for structured decisions inside software. A September 21 report describes a project under the Apache 2.0 license, with weights available for self-hosting and a focus on tasks such as routing support tickets, assessing urgency and screening suspicious emails.",
          "The announcement follows TypeSafe's September 15 introduction of Jev in early access. Both proposals target a narrower job than a chatbot: receive context, evaluate predefined questions and return values that an application can act on. The practical difference is who runs that decision layer: a hosted API with Jev, or infrastructure under the developer's control with Laya.",
          "Laya's reported speed gains draw attention, but the comparison is not a controlled head-to-head test. The report notes that the project's table combines its own Laya measurements with third-party and vendor results for Jev. That supports further testing, not a blanket declaration that one model has beaten the other.",
        ],
        analysis: `## A launch aimed at the automation workload

The [launch report](https://imasters.com.br/noticia/laya-chega-como-alternativa-open-source-ao-jev-da-typesafe-ai) puts Laya in a space TypeSafe is calling System One models: fast, bounded decisions consumed by software. Classification itself is not new. The product proposition is to package it behind typed questions and probabilities, without asking a generative model to write an answer first.

In its [launch announcement](https://typesafe.ai/blog/introducing-system-one-models-and-jev), TypeSafe presents Jev as a model built around parallel outputs and Reinforcement Learning for Calibrated Decisions. Its [documentation](https://docs.typesafe.ai/) defines three primitives: \`choice\` selects an option, \`score\` evaluates a rubric and \`noul\` estimates whether a statement is true. Multiple questions can be evaluated independently against the same state in one API request.

According to the report, Laya exposes the same three kinds of question through an encoder-based implementation and offers English, multilingual and specialized checkpoints. The report links the project's [code](https://github.com/NandhaKishorM/laya) and [model weights](https://huggingface.co/convaiinnovations/laya). Open distribution gives teams another deployment option; it does not establish that the two models behave identically.

## Where this fits in an application

A support operation is an easy example: determine the destination queue, assess urgency and flag a cancellation threat from the same ticket. These are possible integration patterns, not customer deployments verified for this article. Application code still decides what to do with the results, including when a person must review them.

Agent routing and preliminary content screening fit the same pattern. A generative model can still draft a reply or investigate a complex case afterward. There is no need to turn every stage into a competition between decision models and LLMs: one can select a route while the other handles work that actually needs language generation.

## The headline numbers need their conditions

The report cites roughly 33 ms for a Laya inference in the author's tests. That should not be read as an end-to-end service guarantee or compared directly with a remote API without accounting for hardware, network time, input size and batching. A serial sequence of Jev calls is also not equivalent to asking several questions in one request, which its documentation explicitly supports.

The same report records limitations that matter in production: weaker Laya results with large option sets, a recommendation to keep \`choice\` schemas below 20 alternatives or split them into stages, and dependence on fine-tuning and domain calibration for some reported results. Its multilingual evaluation also found cases where an unsuitable English checkpoint was confidently wrong on other scripts. A confidence score does not remove the need to test the language and domain you actually serve.

TypeSafe's numbers need context too. The company acknowledges that its largest workflow speedups are likely near the upper end of real-world gains and that its evaluation design can carry bias. Neither announcement supplies a universal winner for your workload.

## API pricing is not the same as operating cost

TypeSafe publishes a Jev input price of US$0.042 per million tokens in its announcement, with no output-token charge. Laya removes that vendor API bill when self-hosted, but compute, deployment, monitoring, tuning and maintenance remain. Open weights mean control over the deployment, not free infrastructure or automatic privacy compliance.

I would start with the same labeled tickets, languages and decision criteria for both models. Then measure latency, errors, calibration, review rate and total operating cost. A valid output type can still contain the wrong decision. The useful question is not which model wins the launch headline, but which one can handle your workflow with an error rate and an operating burden you can accept.`,
      },
      "pt-br": {
        title: "Jev vs. Laya: pesos abertos entram na disputa da IA que decide em vez de conversar",
        summary: "A ConvAI Innovations apresenta a Laya como alternativa aberta ao Jev, da TypeSafe AI. A comparação coloca hospedagem, calibração e condições dos benchmarks no centro da discussão.",
        body: [
          "A ConvAI Innovations apresentou a Laya como alternativa aberta ao Jev, modelo da TypeSafe AI voltado a decisões estruturadas dentro de software. Uma reportagem de 21 de setembro descreve um projeto sob licença Apache 2.0, com pesos disponíveis para hospedagem própria e foco em tarefas como encaminhar tickets, avaliar urgência e identificar e-mails suspeitos.",
          "A novidade sucede o anúncio do Jev, apresentado pela TypeSafe em acesso antecipado no dia 15 de setembro. As duas propostas miram uma tarefa mais delimitada que a de um chatbot: receber contexto, avaliar perguntas predefinidas e devolver valores que a aplicação possa usar. A diferença prática está em quem opera essa camada de decisão: uma API hospedada, no caso do Jev, ou uma infraestrutura sob controle do desenvolvedor, no caso da Laya.",
          "Os ganhos de velocidade divulgados pela Laya chamam atenção, mas a comparação não é um teste controlado entre os dois modelos. A reportagem ressalta que a tabela do projeto combina medições próprias da Laya com resultados de terceiros e do fornecedor sobre o Jev. É motivo para testar, não para decretar um vencedor.",
        ],
        analysis: `## Um lançamento voltado ao trabalho de automação

A [reportagem sobre o lançamento](https://imasters.com.br/noticia/laya-chega-como-alternativa-open-source-ao-jev-da-typesafe-ai) posiciona a Laya no espaço que a TypeSafe chama de modelos System One: decisões rápidas e delimitadas, consumidas por software. Classificação não nasceu agora. A proposta de produto é empacotar esse trabalho em perguntas tipadas e probabilidades, sem pedir a um modelo generativo que escreva uma resposta primeiro.

No [anúncio de lançamento](https://typesafe.ai/blog/introducing-system-one-models-and-jev), a TypeSafe apresenta o Jev como um modelo com saídas paralelas e treinamento chamado Reinforcement Learning for Calibrated Decisions. A [documentação](https://docs.typesafe.ai/) define três primitivas: \`choice\` escolhe uma opção, \`score\` avalia uma escala e \`noul\` estima se uma afirmação é verdadeira. Várias perguntas podem ser avaliadas de forma independente sobre o mesmo contexto em uma única chamada à API.

Segundo a reportagem, a Laya oferece os mesmos três tipos de pergunta por meio de uma implementação baseada em encoder, com checkpoints em inglês, multilíngue e especializado. A reportagem aponta para o [código do projeto](https://github.com/NandhaKishorM/laya) e os [pesos do modelo](https://huggingface.co/convaiinnovations/laya). A distribuição aberta acrescenta uma opção de implantação; não significa que os dois modelos tenham comportamento idêntico.

## Onde isso entra na aplicação

Uma operação de suporte dá um exemplo direto: identificar a fila de destino, avaliar a urgência e sinalizar uma ameaça de cancelamento no mesmo ticket. São possibilidades de integração, não casos de clientes verificados nesta notícia. O código da aplicação continua decidindo o que fazer com os resultados, inclusive quando encaminhar o caso para uma pessoa.

Roteamento de agentes e triagem inicial de conteúdo seguem a mesma lógica. Um modelo generativo ainda pode redigir a resposta ou investigar um caso complexo depois. Não precisa transformar cada etapa em uma disputa entre modelos de decisão e LLMs: um pode escolher o caminho enquanto o outro faz o trabalho que realmente exige geração de linguagem.

## Os números precisam vir com as condições

A reportagem relata cerca de 33 ms para uma inferência da Laya nos testes do autor. Isso não deve ser lido como garantia de tempo de resposta de um serviço completo, nem comparado diretamente a uma API remota sem considerar hardware, rede, tamanho da entrada e processamento em lote. Uma sequência de chamadas seriais ao Jev também não equivale a enviar várias perguntas na mesma requisição, recurso previsto na documentação.

A mesma reportagem registra limitações relevantes para produção: resultados piores da Laya com muitas opções, recomendação de manter esquemas \`choice\` abaixo de 20 alternativas ou dividir a decisão em etapas e dependência de fine-tuning e calibração no domínio para alguns resultados divulgados. A avaliação multilíngue também encontrou casos em que um checkpoint inadequado, voltado ao inglês, errava com confiança alta em outros alfabetos. Ter um score de confiança não dispensa testar o idioma e o domínio que você atende.

Os números da TypeSafe também precisam de contexto. A empresa reconhece que seus maiores ganhos de velocidade em workflows provavelmente estão perto do limite superior dos ganhos reais e que o desenho das avaliações pode carregar viés. Nenhum dos anúncios entrega um vencedor universal para a sua carga de trabalho.

## Preço de API não é custo de operação

A TypeSafe publica no anúncio o preço de US$ 0,042 por milhão de tokens de entrada do Jev, sem cobrança por tokens de saída. A Laya elimina essa conta de API do fornecedor quando hospedada pela própria equipe, mas continuam existindo computação, implantação, monitoramento, ajuste e manutenção. Pesos abertos dão controle sobre a implantação, não infraestrutura gratuita nem conformidade automática de privacidade.

Eu começaria pelos mesmos tickets rotulados, idiomas e critérios de decisão nos dois modelos. Depois mediria latência, erros, calibração, taxa de revisão e custo total de operação. Uma saída no tipo certo ainda pode trazer a decisão errada. A pergunta útil não é quem ganhou a manchete do lançamento, mas quem atende seu fluxo com uma taxa de erro e um trabalho de operação que você consegue aceitar.`,
      },
    },
  },
  {
    slug: "copilot-weekly-releases",
    date: "2026-09-25",
    category: "ai",
    publisher: "GitHub",
    sourceUrl: "https://github.blog/changelog/2026-09-25-github-copilot-weekly-releases-september-21/",
    sources: [
      { url: "https://github.blog/changelog/2026-09-23-local-sandboxing-in-the-github-copilot-app/", label: { "en-us": "GitHub: local sandboxing release", "pt-br": "GitHub: lançamento do sandbox local" } },
      { url: "https://docs.github.com/en/enterprise-cloud%40latest/copilot/how-tos/github-copilot-app/configure-local-sandboxing", label: { "en-us": "GitHub Docs: configuring local sandboxing", "pt-br": "GitHub Docs: configuração do sandbox local" } },
    ],
    image: "/news/copilot-weekly-releases/cover.webp",
    copy: {
      "en-us": {
        title: "GitHub Copilot adds new models and tighter agent controls",
        summary: "The latest release brings more model choice, local sandboxing, and updates across VS Code, JetBrains, Slack, and Teams.",
        body: [
          "GitHub's September 25 roundup puts several changes to Copilot in one place. Claude Opus 5.5, GPT-6 Sol and Luna, and Grok 4.7 have joined its model lineup, with availability varying by plan.",
          "For developers working with agents, the more consequential additions may be local sandboxing in the Copilot app and OpenTelemetry support for monitoring agent activity. The release also covers remote Dev Container support in VS Code and new controls in JetBrains and collaboration tools.",
        ],
        analysis: `## The changes behind the model menu

The [weekly release](https://github.blog/changelog/2026-09-25-github-copilot-weekly-releases-september-21/) is a bundle, so the model list should not swallow the engineering story. In JetBrains, an edited earlier message can rewind an agent session and its file changes before the replacement instruction is sent. VS Code 1.139 is gradually adding agent support in Dev Containers on SSH, Tunnel, and WSL hosts. These are workflow changes: where the agent runs and how much of its work you can steer.

GitHub's [sandbox announcement](https://github.blog/changelog/2026-09-23-local-sandboxing-in-the-github-copilot-app/) says the app can limit file, network, and credential access for local sessions. It is a public preview and is off by default. The [configuration guide](https://docs.github.com/en/enterprise-cloud%40latest/copilot/how-tos/github-copilot-app/configure-local-sandboxing) makes an important distinction: a working tree isolates branches and files between sessions; a sandbox restricts what commands can reach elsewhere on the machine.

## What I would check before rolling it out

Start with one repository and a realistic task. Check which model and plan actually expose the feature, whether your project needs outbound network or Git credentials, and whether an enterprise policy narrows the effective sandbox. Then inspect the resulting diff and the telemetry. More models are useful; knowing what an agent touched is useful on Monday morning after it has touched it.`,
      },
      "pt-br": {
        title: "GitHub Copilot ganha novos modelos e mais controle sobre agentes",
        summary: "A atualização traz mais opções de modelos, sandbox local e novidades no VS Code, JetBrains, Slack e Teams.",
        body: [
          "O resumo publicado pelo GitHub em 25 de setembro reúne várias mudanças no Copilot. Claude Opus 5.5, GPT-6 Sol e Luna e Grok 4.7 entraram na seleção de modelos, com disponibilidade que varia conforme o plano.",
          "Para quem trabalha com agentes, as novidades mais relevantes podem ser o sandbox local no aplicativo do Copilot e o suporte a OpenTelemetry para acompanhar a atividade dos agentes. A versão também inclui Dev Containers remotos no VS Code e novos controles no JetBrains e nas ferramentas de colaboração.",
        ],
        analysis: `## O que mudou além do menu de modelos

O [resumo semanal](https://github.blog/changelog/2026-09-25-github-copilot-weekly-releases-september-21/) reúne vários lançamentos, e a lista de modelos não deveria esconder a parte de engenharia. No JetBrains, editar uma mensagem anterior pode retroceder a sessão do agente e as alterações nos arquivos antes de enviar a nova instrução. O VS Code 1.139 está adicionando gradualmente suporte a agentes em Dev Containers acessados por SSH, Tunnel e WSL. Isso muda onde o agente executa e quanto do trabalho pode ser redirecionado.

O [anúncio do sandbox](https://github.blog/changelog/2026-09-23-local-sandboxing-in-the-github-copilot-app/) diz que o aplicativo pode limitar o acesso a arquivos, rede e credenciais nas sessões locais. É uma prévia pública, desativada por padrão. A [documentação de configuração](https://docs.github.com/en/enterprise-cloud%40latest/copilot/how-tos/github-copilot-app/configure-local-sandboxing) esclarece uma diferença importante: uma working tree separa branches e arquivos entre sessões; o sandbox limita o que os comandos podem alcançar fora dali.

## O que eu verificaria antes de adotar

Começaria com um repositório e uma tarefa realista. Conferiria quais modelos e planos liberam o recurso, se o projeto precisa de rede externa ou credenciais Git e se uma política corporativa restringe o sandbox efetivo. Depois, inspecionaria o diff e a telemetria. Mais modelos ajudam; saber o que um agente tocou ajuda ainda mais na segunda-feira seguinte.`,
      },
    },
  },
  {
    slug: "github-ships-more-css",
    image: "/news/github-ships-more-css/cover.webp",
    date: "2026-09-25",
    category: "engineering",
    publisher: "GitHub Engineering",
    sourceUrl: "https://github.blog/engineering/architecture-optimization/improving-site-performance-by-shipping-more-css/",
    sources: [
      { url: "https://github.com/primer/react", label: { "en-us": "Primer React source code", "pt-br": "Código-fonte do Primer React" } },
      { url: "https://primer.style/product/getting-started/react/", label: { "en-us": "Primer React usage guide", "pt-br": "Guia de uso do Primer React" } },
    ],
    copy: {
      "en-us": {
        title: "Why GitHub shipped more CSS to make its site faster",
        summary: "GitHub details its move away from CSS-in-JS and the performance tradeoffs behind the Primer migration.",
        body: [
          "GitHub's Primer team describes a full migration away from its previous CSS-in-JS approach. As component counts grew, client-side style initialization and server-side style collection became increasingly expensive.",
          "The engineering write-up explains why sending more static CSS can improve the overall experience. It is a useful reminder that the smallest stylesheet is not always the fastest page when runtime styling work is part of the bill.",
        ],
        analysis: `## What the numbers actually say

In the [engineering account](https://github.blog/engineering/architecture-optimization/improving-site-performance-by-shipping-more-css/), GitHub says Primer components had moved to CSS Modules by December 2024. A rotating group of eight engineers then migrated 6,419 props over six months. The reported server-rendering improvements ranged from about 1% to 22% on measured pages. Those are GitHub's own measurements on GitHub's own workload, not a universal CSS Modules benchmark.

The old approach did work at runtime: styles needed to be initialized in the browser and collected during server rendering. With more components per page, that cost grew. Static CSS shifts some of the work into the build and the browser's native stylesheet machinery. The tradeoff is that the CSS payload can get larger; the relevant metric is the full page experience, not the stylesheet byte count in isolation.

## The practical lesson

If your React app has a similar bottleneck, profile server render time and client initialization before rewriting a design system. GitHub's [Primer React code](https://github.com/primer/react) and [usage guide](https://primer.style/product/getting-started/react/) show the scale of the system they were migrating. The decision came from observed costs at that scale. Shipping more CSS sounds backwards until you measure how much JavaScript you stopped asking every request to execute.`,
      },
      "pt-br": {
        title: "Por que o GitHub enviou mais CSS para acelerar o site",
        summary: "O GitHub explica a saída do CSS-in-JS e os compromissos de desempenho na migração do Primer.",
        body: [
          "A equipe do Primer no GitHub descreve a migração completa da antiga abordagem de CSS-in-JS. Com o crescimento do número de componentes, a inicialização de estilos no cliente e a coleta de estilos no servidor ficaram cada vez mais caras.",
          "O relato técnico mostra por que enviar mais CSS estático pode melhorar a experiência geral. É um bom lembrete de que a menor folha de estilos nem sempre produz a página mais rápida quando o custo da estilização em tempo de execução entra na conta.",
        ],
        analysis: `## O que os números realmente mostram

No [relato de engenharia](https://github.blog/engineering/architecture-optimization/improving-site-performance-by-shipping-more-css/), o GitHub diz que os componentes do Primer tinham migrado para CSS Modules até dezembro de 2024. Depois, um grupo rotativo de oito engenheiros migrou 6.419 propriedades ao longo de seis meses. Os ganhos informados no tempo de renderização no servidor variaram de cerca de 1% a 22% nas páginas medidas. São medições do próprio GitHub em sua carga de trabalho, não um benchmark universal de CSS Modules.

A abordagem anterior trabalhava em tempo de execução: os estilos precisavam ser inicializados no navegador e coletados durante a renderização no servidor. Com mais componentes por página, esse custo cresceu. O CSS estático transfere parte do trabalho para o build e para o mecanismo nativo de estilos do navegador. Em compensação, o arquivo CSS pode ficar maior; a métrica relevante é a experiência completa da página, não só o tamanho da folha de estilos.

## A lição prática

Se sua aplicação React tem um gargalo parecido, meça o tempo de renderização no servidor e a inicialização no cliente antes de reescrever um design system. O [código do Primer React](https://github.com/primer/react) e o [guia de uso](https://primer.style/product/getting-started/react/) mostram a escala da migração. A decisão veio dos custos observados nessa escala. Enviar mais CSS parece contraditório até medir quanto JavaScript deixou de ser executado a cada requisição.`,
      },
    },
  },
  {
    slug: "agentic-autofix-copilot-memory",
    image: "/news/agentic-autofix-copilot-memory/cover.webp",
    date: "2026-09-25",
    category: "security",
    publisher: "GitHub",
    sourceUrl: "https://github.blog/changelog/2026-09-25-agentic-autofix-now-uses-copilot-memory/",
    sources: [
      { url: "https://docs.github.com/en/copilot/concepts/agents/copilot-memory", label: { "en-us": "GitHub Docs: Copilot Memory", "pt-br": "GitHub Docs: Copilot Memory" } },
      { url: "https://docs.github.com/en/code-security/concepts/code-scanning/autofix-for-code-scanning", label: { "en-us": "GitHub Docs: autofix for code scanning", "pt-br": "GitHub Docs: correção automática do code scanning" } },
    ],
    copy: {
      "en-us": {
        title: "Agentic autofix now learns from Copilot Memory",
        summary: "Security fixes can reuse repository context and save successful fix patterns for later alerts.",
        body: [
          "GitHub says agentic autofix can now read existing Copilot Memory entries when resolving security alerts, if the customer has enabled the feature. Once a fix is created, its pattern can be stored as a memory for future work.",
          "That context can help autofix with subsequent alerts and inform other Copilot features about a repository's secure development patterns. GitHub lists both agentic autofix and Copilot Memory as public previews.",
        ],
        analysis: `## Why repository memory matters

A code scanning alert identifies a risky path; it rarely contains the whole architecture. The [autofix documentation](https://docs.github.com/en/code-security/concepts/code-scanning/autofix-for-code-scanning) says an agentic session can inspect more of the repository, propose a fix, validate it and open a pull request. The new [Memory integration](https://github.blog/changelog/2026-09-25-agentic-autofix-now-uses-copilot-memory/) adds facts learned during earlier work, such as project-specific fix patterns.

GitHub's [Memory overview](https://docs.github.com/en/copilot/concepts/agents/copilot-memory) distinguishes repository-level facts from user preferences and says facts learned by one Copilot feature can be used by another. That is useful in a large codebase where the correct remediation depends on local conventions. It also means a bad memory could travel beyond the single alert that produced it, so review matters.

## The security caveat

This is still a proposal generator, not a security sign-off. GitHub lists agentic autofix as a public preview. A team should inspect the patch, rerun its security checks, and test behavior around the vulnerable path. If the agent remembers a pattern, verify that the pattern was actually the right fix before it becomes precedent.`,
      },
      "pt-br": {
        title: "Correção automática com agentes passa a usar o Copilot Memory",
        summary: "As correções de segurança podem reutilizar o contexto do repositório e guardar padrões para alertas futuros.",
        body: [
          "Segundo o GitHub, a correção automática com agentes agora pode consultar entradas existentes do Copilot Memory ao resolver alertas de segurança, quando o recurso está habilitado pelo cliente. Depois de criar uma correção, o padrão pode ser salvo para trabalhos futuros.",
          "Esse contexto pode ajudar em alertas posteriores e informar outros recursos do Copilot sobre os padrões de desenvolvimento seguro daquele repositório. O GitHub classifica tanto a correção com agentes quanto o Copilot Memory como prévias públicas.",
        ],
        analysis: `## Por que a memória do repositório importa

Um alerta de análise de código identifica um caminho arriscado, mas raramente traz toda a arquitetura. A [documentação de correção automática](https://docs.github.com/en/code-security/concepts/code-scanning/autofix-for-code-scanning) diz que uma sessão com agente pode investigar o repositório, propor uma correção, validá-la e abrir um pull request. A nova [integração com Memory](https://github.blog/changelog/2026-09-25-agentic-autofix-now-uses-copilot-memory/) acrescenta fatos aprendidos em trabalhos anteriores, como padrões de correção específicos do projeto.

A [visão geral do Memory](https://docs.github.com/en/copilot/concepts/agents/copilot-memory) diferencia fatos do repositório de preferências pessoais e diz que conhecimentos obtidos por um recurso do Copilot podem ser usados por outro. Isso é útil em bases grandes, nas quais a remediação correta depende das convenções locais. Também significa que uma memória ruim pode se espalhar além do alerta que a gerou; a revisão importa.

## A ressalva de segurança

Ainda é uma ferramenta para propor mudanças, não uma aprovação de segurança. O GitHub classifica a correção com agentes como prévia pública. A equipe deve inspecionar o patch, executar novamente suas verificações e testar o comportamento do caminho vulnerável. Se o agente guardar um padrão, confirme que ele foi de fato a correção certa antes de transformá-lo em precedente.`,
      },
    },
  },
  {
    slug: "codeql-2-27-1",
    image: "/news/codeql-2-27-1/cover.webp",
    date: "2026-09-25",
    category: "security",
    publisher: "GitHub",
    sourceUrl: "https://github.blog/changelog/2026-09-25-codeql-2-27-1-adds-c-and-c-query-and-kotlin-2-4-20-support/",
    sources: [
      { url: "https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-code-scanning", label: { "en-us": "GitHub Docs: CodeQL code scanning", "pt-br": "GitHub Docs: análise de código com CodeQL" } },
      { url: "https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-query-suites", label: { "en-us": "GitHub Docs: CodeQL query suites", "pt-br": "GitHub Docs: conjuntos de consultas CodeQL" } },
    ],
    copy: {
      "en-us": {
        title: "CodeQL 2.27.1 expands language and security coverage",
        summary: "New C/C++ and C# queries arrive alongside Kotlin 2.4.20 support and more accurate data-flow models.",
        body: [
          "GitHub's CodeQL 2.27.1 release adds queries for C/C++ and C#, support for Kotlin 2.4.20, and improvements to its analysis models. It also updates data-flow handling for newer Go standard-library APIs.",
          "For teams that rely on code scanning, the release is worth checking for both new findings and reduced false positives. GitHub deploys new CodeQL versions automatically to code scanning users on github.com.",
        ],
        analysis: `## What changed in the analyzer

The [release notes](https://github.blog/changelog/2026-09-25-codeql-2-27-1-adds-c-and-c-query-and-kotlin-2-4-20-support/) describe a new C/C++ query for assignments of comparison results that can be read ambiguously, plus a C# query for loops that could use \`FirstOrDefault\`. The update also adds library-flow models, updates the Rust extractor's rust-analyzer, and improves handling of some GitHub Actions references. Not every change is a new alert: better models and fewer false positives matter too.

The [CodeQL overview](https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-code-scanning) explains that findings appear as code scanning alerts, while [query suites](https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-query-suites) determine which checks run. A new query only affects your repository when it belongs to the suite you use. That detail is easy to miss when a release headline lists a long menu of languages.

## What to do with it

Check the next scan for changed findings and confirm the configured suite before treating a quiet scan as proof that every new query ran. If you pin a CodeQL CLI or bundle version outside GitHub's hosted scanning, plan an update instead of assuming you received the hosted rollout.`,
      },
      "pt-br": {
        title: "CodeQL 2.27.1 amplia a cobertura de linguagens e segurança",
        summary: "Novas consultas para C/C++ e C# chegam com suporte a Kotlin 2.4.20 e modelos de fluxo de dados mais precisos.",
        body: [
          "O CodeQL 2.27.1 do GitHub adiciona consultas para C/C++, C#, suporte a Kotlin 2.4.20 e melhorias nos modelos de análise. Também atualiza o tratamento do fluxo de dados para APIs mais recentes da biblioteca padrão do Go.",
          "Para equipes que usam análise de código, vale verificar tanto os novos achados quanto a redução de falsos positivos. O GitHub distribui automaticamente as novas versões do CodeQL para usuários do code scanning no github.com.",
        ],
        analysis: `## O que mudou no analisador

As [notas da versão](https://github.blog/changelog/2026-09-25-codeql-2-27-1-adds-c-and-c-query-and-kotlin-2-4-20-support/) descrevem uma nova consulta para C/C++ que detecta atribuições ambíguas de resultados de comparações e outra para C# sobre loops que poderiam usar \`FirstOrDefault\`. A atualização também adiciona modelos de fluxo em bibliotecas, atualiza o rust-analyzer do extrator Rust e melhora o tratamento de algumas referências no GitHub Actions. Nem toda mudança gera um novo alerta: modelos melhores e menos falsos positivos também importam.

A [visão geral do CodeQL](https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-code-scanning) explica que os resultados aparecem como alertas de análise de código, enquanto os [conjuntos de consultas](https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-query-suites) determinam quais verificações rodam. Uma consulta nova só afeta seu repositório quando faz parte do conjunto escolhido. É um detalhe fácil de perder diante de uma lista grande de linguagens no anúncio.

## O que fazer agora

Confira as mudanças nos resultados da próxima análise e confirme o conjunto configurado antes de interpretar uma execução sem alertas como prova de que todas as novas consultas rodaram. Se você fixa a versão do CLI ou do bundle CodeQL fora do serviço hospedado pelo GitHub, planeje a atualização em vez de presumir que recebeu a nova versão.`,
      },
    },
  },
  {
    slug: "copilot-custom-canvases",
    image: "/news/copilot-custom-canvases/cover.webp",
    date: "2026-09-25",
    category: "ai",
    publisher: "GitHub",
    sourceUrl: "https://github.blog/ai-and-ml/github-copilot/github-copilot-app-for-beginners-how-to-build-custom-workflows-with-canvases/",
    sources: [
      { url: "https://docs.github.com/en/enterprise-cloud%40latest/copilot/how-tos/github-copilot-app/working-with-canvas-extensions", label: { "en-us": "GitHub Docs: canvas extensions", "pt-br": "GitHub Docs: extensões de canvas" } },
      { url: "https://github.blog/ai-and-ml/github-copilot/when-chat-is-the-wrong-ui/", label: { "en-us": "GitHub: when chat is the wrong UI", "pt-br": "GitHub: quando chat não é a melhor interface" } },
    ],
    copy: {
      "en-us": {
        title: "Copilot canvases turn agent work into custom interfaces",
        summary: "GitHub shows how developers can build shared, interactive surfaces for planning and tracking work with agents.",
        body: [
          "GitHub's guide introduces canvases in the Copilot app as shared interfaces that both a developer and an agent can update. A canvas can take the shape of a board, checklist, dashboard, form, or spreadsheet.",
          "The point is practical: a workflow that needs status, controls, and structured information may work better in a purpose-built surface than in a long chat transcript. The article walks through creating one for a development task.",
        ],
        analysis: `## From conversation to working surface

The [tutorial](https://github.blog/ai-and-ml/github-copilot/github-copilot-app-for-beginners-how-to-build-custom-workflows-with-canvases/) shows a concrete example: ask Copilot to create a release-notes canvas that tracks work completed across sessions. A canvas is not just a prettier answer. The [documentation](https://docs.github.com/en/enterprise-cloud%40latest/copilot/how-tos/github-copilot-app/working-with-canvas-extensions) says the agent and user can both change the same interactive artifact, and that canvases can be packaged in plugins alongside other capabilities.

That changes the human review loop. Instead of searching a chat history for the current list of tasks, a developer can inspect the board or checklist as it evolves. GitHub's companion [essay about chat interfaces](https://github.blog/ai-and-ml/github-copilot/when-chat-is-the-wrong-ui/) argues for exactly this distinction between discussion and doing.

## The question for a team

Pick a workflow with real state: release preparation, incident triage, or code review. If a canvas makes status and next actions easier to verify, it earns its place. If it merely duplicates a chat transcript in boxes, it adds maintenance without clarity. The interesting part is not that an agent can generate UI; it is whether that UI helps a human remain in control of the work.`,
      },
      "pt-br": {
        title: "Canvases do Copilot transformam o trabalho dos agentes em interfaces",
        summary: "O GitHub mostra como criar superfícies interativas compartilhadas para planejar e acompanhar tarefas com agentes.",
        body: [
          "O guia do GitHub apresenta os canvases do aplicativo Copilot como interfaces compartilhadas que tanto a pessoa desenvolvedora quanto o agente podem atualizar. Um canvas pode ser um quadro, checklist, painel, formulário ou planilha.",
          "A proposta é prática: um fluxo que exige status, controles e informação estruturada pode funcionar melhor numa interface própria do que em uma longa conversa. O artigo mostra como criar uma dessas interfaces para uma tarefa de desenvolvimento.",
        ],
        analysis: `## Da conversa para a superfície de trabalho

O [tutorial](https://github.blog/ai-and-ml/github-copilot/github-copilot-app-for-beginners-how-to-build-custom-workflows-with-canvases/) traz um exemplo concreto: pedir ao Copilot um canvas de notas de versão que acompanhe entregas concluídas em várias sessões. O canvas não é só uma resposta mais bonita. A [documentação](https://docs.github.com/en/enterprise-cloud%40latest/copilot/how-tos/github-copilot-app/working-with-canvas-extensions) diz que agente e usuário podem alterar o mesmo artefato interativo, e que canvases podem ser distribuídos em plugins junto de outras capacidades.

Isso muda o ciclo de revisão humana. Em vez de procurar a lista atual de tarefas no histórico do chat, é possível inspecionar o quadro ou checklist enquanto ele evolui. O [ensaio do GitHub sobre interfaces de chat](https://github.blog/ai-and-ml/github-copilot/when-chat-is-the-wrong-ui/) defende justamente essa distinção entre conversar e executar.

## A pergunta para uma equipe

Escolha um fluxo com estado real: preparação de release, triagem de incidente ou revisão de código. Se o canvas torna o status e as próximas ações mais fáceis de conferir, ele merece existir. Se apenas replica a conversa em caixinhas, acrescenta manutenção sem clareza. O interessante não é o agente gerar uma interface; é ela ajudar uma pessoa a continuar no controle do trabalho.`,
      },
    },
  },
  {
    slug: "ai-powered-fuzzing-taskflow",
    image: "/news/ai-powered-fuzzing-taskflow/cover.webp",
    date: "2026-09-24",
    category: "security",
    publisher: "GitHub Security Lab",
    sourceUrl: "https://github.blog/security/application-security/ai-powered-fuzzing-with-the-github-security-lab-taskflow-agent/",
    sources: [
      { url: "https://github.com/GitHubSecurityLab/seclab-taskflows-fuzzing", label: { "en-us": "Security Lab fuzzing taskflow repository", "pt-br": "Repositório do fluxo de fuzzing do Security Lab" } },
      { url: "https://google.github.io/oss-fuzz/advanced-topics/code-coverage/", label: { "en-us": "OSS-Fuzz: measuring code coverage", "pt-br": "OSS-Fuzz: medição da cobertura de código" } },
    ],
    copy: {
      "en-us": {
        title: "GitHub explores AI agents for the hard parts of fuzzing",
        summary: "A Security Lab taskflow agent targets coverage gaps, new harnesses, and crash triage in continuous fuzzing.",
        body: [
          "Continuous fuzzing still needs people to watch coverage, write harnesses for untouched code, and investigate crashes. GitHub Security Lab describes a taskflow built on its agent framework to explore how much of that work an LLM agent can take on.",
          "The write-up is grounded in the day-to-day work behind fuzzing rather than treating an agent as a complete security solution. It is especially relevant to maintainers who already run fuzzers but struggle to keep improving their reach.",
        ],
        analysis: `## The work between running and finding

A fuzzer can run for weeks while barely reaching the code that matters. The [OSS-Fuzz coverage guide](https://google.github.io/oss-fuzz/advanced-topics/code-coverage/) recommends measuring which paths the targets actually exercise. That is the gap the [Security Lab report](https://github.blog/security/application-security/ai-powered-fuzzing-with-the-github-security-lab-taskflow-agent/) focuses on: coverage, harness creation, and crash triage require decisions, not just CPU time.

The [open repository](https://github.com/GitHubSecurityLab/seclab-taskflows-fuzzing) describes a pipeline for native C/C++ projects using AFL++, clang, coverage tooling, and a persistent corpus. Its documentation also lists limitations and setup requirements. The claim to test is not that an agent makes fuzzing automatic, but whether it can keep improving a campaign after the first harness is written.

## The responsible reading

Treat generated harnesses and vulnerability reports as leads. Check that the harness reaches meaningful paths, that a crash reproduces, and that the proposed fix closes the bug without changing intended behavior. Security automation earns trust through reproducible evidence; a confident summary alone is not evidence.`,
      },
      "pt-br": {
        title: "GitHub explora agentes de IA para as partes difíceis do fuzzing",
        summary: "Um agente do Security Lab mira lacunas de cobertura, novos harnesses e triagem de falhas no fuzzing contínuo.",
        body: [
          "O fuzzing contínuo ainda precisa de pessoas para acompanhar a cobertura, escrever harnesses para código não alcançado e investigar falhas. O GitHub Security Lab descreve um fluxo baseado em seu framework de agentes para explorar quanto desse trabalho pode ser assumido por um agente de linguagem.",
          "O relato parte das tarefas reais por trás do fuzzing, sem tratar o agente como solução completa de segurança. Ele é especialmente relevante para mantenedores que já executam fuzzers, mas têm dificuldade para ampliar a cobertura.",
        ],
        analysis: `## O trabalho entre executar e encontrar

Um fuzzer pode rodar por semanas e quase não alcançar o código que importa. O [guia de cobertura do OSS-Fuzz](https://google.github.io/oss-fuzz/advanced-topics/code-coverage/) recomenda medir quais caminhos os alvos realmente exercitam. Essa é a lacuna abordada pelo [relato do Security Lab](https://github.blog/security/application-security/ai-powered-fuzzing-with-the-github-security-lab-taskflow-agent/): cobertura, criação de harnesses e triagem de falhas exigem decisões, não apenas tempo de CPU.

O [repositório aberto](https://github.com/GitHubSecurityLab/seclab-taskflows-fuzzing) descreve um pipeline para projetos C/C++ nativos com AFL++, clang, ferramentas de cobertura e um corpus persistente. A documentação também apresenta limitações e requisitos de instalação. A hipótese a testar não é que o agente torna o fuzzing automático, mas se ele consegue melhorar uma campanha depois do primeiro harness.

## A leitura responsável

Trate harnesses gerados e relatórios de vulnerabilidade como pistas. Confira se o harness alcança caminhos relevantes, se a falha é reproduzível e se a correção proposta elimina o problema sem alterar o comportamento desejado. Automação de segurança conquista confiança com evidências reproduzíveis; um resumo confiante não basta.`,
      },
    },
  },
  {
    slug: "when-chat-is-the-wrong-ui",
    image: "/news/when-chat-is-the-wrong-ui/cover.webp",
    date: "2026-09-24",
    category: "ai",
    publisher: "GitHub",
    sourceUrl: "https://github.blog/ai-and-ml/github-copilot/when-chat-is-the-wrong-ui/",
    sources: [
      { url: "https://docs.github.com/en/enterprise-cloud%40latest/copilot/how-tos/github-copilot-app/working-with-canvas-extensions", label: { "en-us": "GitHub Docs: working with canvases", "pt-br": "GitHub Docs: trabalho com canvases" } },
      { url: "https://github.blog/ai-and-ml/github-copilot/github-copilot-app-for-beginners-how-to-build-custom-workflows-with-canvases/", label: { "en-us": "GitHub: building a custom canvas", "pt-br": "GitHub: criando um canvas personalizado" } },
    ],
    copy: {
      "en-us": {
        title: "When a chat box is the wrong interface for AI",
        summary: "GitHub makes the case for canvases: interfaces that give agent work more structure than a conversation can.",
        body: [
          "Chat remains the default interface for many AI tools, but GitHub argues that some tasks need a surface users can inspect and manipulate directly. Its essay points to canvases in the Copilot app as one way to move beyond a transcript.",
          "For builders, the design question is whether the task is primarily a conversation or an evolving artifact. Planning, triage, and review often benefit from visible state and controls that stay in place while the agent works.",
        ],
        analysis: `## The problem with a disappearing work surface

In GitHub's [essay](https://github.blog/ai-and-ml/github-copilot/when-chat-is-the-wrong-ui/), the complaint is familiar: chat is good at discussing a task, but the output of a task often belongs in a board, document, dashboard, or browser. An agent's latest answer can tell you what it did; it does not automatically give you a durable place to verify and change the result.

GitHub's [canvas documentation](https://docs.github.com/en/enterprise-cloud%40latest/copilot/how-tos/github-copilot-app/working-with-canvas-extensions) calls these surfaces bidirectional. The user can manipulate them while the agent updates them. Its [walkthrough](https://github.blog/ai-and-ml/github-copilot/github-copilot-app-for-beginners-how-to-build-custom-workflows-with-canvases/) gives a concrete release-notes example, where a structured view is easier to scan than a scrollback of messages.

## My design test

Ask three questions before giving every agent a canvas: Does the task have state that must remain visible? Can the user correct that state directly? Will the surface still be useful after the conversation ends? If the answer is no, chat may be enough. If it is yes, forcing the work into a transcript is like tracking an incident in a group chat: possible, but nobody enjoys finding the current truth.`,
      },
      "pt-br": {
        title: "Quando uma caixa de chat não é a melhor interface para IA",
        summary: "O GitHub defende os canvases: interfaces que dão ao trabalho dos agentes mais estrutura do que uma conversa.",
        body: [
          "O chat continua sendo a interface padrão de muitas ferramentas de IA, mas o GitHub argumenta que algumas tarefas precisam de uma superfície que o usuário possa inspecionar e manipular diretamente. O ensaio apresenta os canvases do aplicativo Copilot como uma forma de ir além do histórico de mensagens.",
          "Para quem constrói produtos, a pergunta de design é se a tarefa é principalmente uma conversa ou um artefato em evolução. Planejamento, triagem e revisão costumam se beneficiar de estados e controles visíveis enquanto o agente trabalha.",
        ],
        analysis: `## O problema da superfície de trabalho que desaparece

No [ensaio do GitHub](https://github.blog/ai-and-ml/github-copilot/when-chat-is-the-wrong-ui/), a queixa é conhecida: chat serve para discutir uma tarefa, mas o resultado dela muitas vezes pertence a um quadro, documento, painel ou navegador. A última resposta do agente pode dizer o que foi feito; ela não cria automaticamente um lugar durável para conferir e alterar o resultado.

A [documentação dos canvases](https://docs.github.com/en/enterprise-cloud%40latest/copilot/how-tos/github-copilot-app/working-with-canvas-extensions) chama essas superfícies de bidirecionais. O usuário pode manipulá-las enquanto o agente as atualiza. O [tutorial](https://github.blog/ai-and-ml/github-copilot/github-copilot-app-for-beginners-how-to-build-custom-workflows-with-canvases/) traz um exemplo de notas de versão no qual uma visão estruturada é mais fácil de ler do que o histórico de mensagens.

## Meu teste de design

Antes de dar um canvas a todo agente, faça três perguntas: a tarefa tem estado que precisa continuar visível? O usuário consegue corrigir esse estado diretamente? A superfície continua útil depois que a conversa termina? Se não, chat pode bastar. Se sim, forçar tudo para o histórico de mensagens é como gerenciar um incidente em um grupo de chat: dá para fazer, mas ninguém gosta de procurar a verdade atual ali.`,
      },
    },
  },
  {
    slug: "copilot-huge-pull-requests",
    image: "/news/copilot-huge-pull-requests/cover.webp",
    date: "2026-09-23",
    category: "engineering",
    publisher: "GitHub Engineering",
    sourceUrl: "https://github.blog/engineering/user-experience/rendering-huge-pull-requests-in-the-github-copilot-app/",
    sources: [
      { url: "https://docs.github.com/en/copilot/how-tos/github-copilot-app/managing-issues-and-pull-requests", label: { "en-us": "GitHub Docs: reviewing pull requests in the app", "pt-br": "GitHub Docs: revisão de pull requests no aplicativo" } },
      { url: "https://react.dev/reference/react/Profiler", label: { "en-us": "React: measuring render performance", "pt-br": "React: medição de desempenho de renderização" } },
    ],
    copy: {
      "en-us": {
        title: "Inside GitHub's million-line pull request renderer",
        summary: "The Copilot app team rebuilt its diff surface to keep enormous reviews responsive, even with hundreds of comments.",
        body: [
          "GitHub Engineering describes rebuilding the Copilot app's pull request view for unusually large changes. Their stress case contained 2,200 files, more than a million changed lines, and over 400 inline comments.",
          "The article follows the performance work behind a responsive diff: instrumenting renders, testing scrolling and resizing, and checking the experience in the actual desktop app. It is a concrete look at UI engineering under extreme data volume.",
        ],
        analysis: `## A real stress case

The [engineering post](https://github.blog/engineering/user-experience/rendering-huge-pull-requests-in-the-github-copilot-app/) uses an actual open-source pull request with 2,200 files, more than a million changed lines, and over 400 comments. That is far beyond the pull request most teams see, which makes it a useful test of assumptions about scrolling, expansion, and comment rendering. The product must support review in its [Files changed view](https://docs.github.com/en/copilot/how-tos/github-copilot-app/managing-issues-and-pull-requests), not merely load a summary page.

GitHub describes two validation lanes: a headless probe that tracks render counts, performance timing, and frame smoothness; and an automated run through the real desktop app with cold and warm comment states. The distinction matters. A synthetic benchmark can show regressions quickly, while the real workflow catches awkward interactions a number cannot describe.

## A useful pattern for any large UI

Measure the expensive state transitions, not just first paint. Open details, resize the window, move deep into a file list, then return to comments. React's [Profiler documentation](https://react.dev/reference/react/Profiler) explains how to count component render work; it is one instrument, not the whole performance story. The lesson here is to make the worst realistic user journey part of the test suite before someone arrives with the million-line PR.`,
      },
      "pt-br": {
        title: "Por dentro do renderizador de pull requests com um milhão de linhas",
        summary: "A equipe do aplicativo Copilot refez a visualização de diffs para manter revisões enormes responsivas, mesmo com centenas de comentários.",
        body: [
          "O GitHub Engineering descreve a reconstrução da visualização de pull requests do aplicativo Copilot para mudanças excepcionalmente grandes. O caso de teste tinha 2.200 arquivos, mais de um milhão de linhas alteradas e mais de 400 comentários em linha.",
          "O artigo acompanha o trabalho de desempenho por trás de um diff responsivo: instrumentação de renderizações, testes de rolagem e redimensionamento e validação no aplicativo de desktop. É um exemplo concreto de engenharia de interface sob um volume extremo de dados.",
        ],
        analysis: `## Um caso extremo de verdade

O [relato de engenharia](https://github.blog/engineering/user-experience/rendering-huge-pull-requests-in-the-github-copilot-app/) usa um pull request real de código aberto com 2.200 arquivos, mais de um milhão de linhas alteradas e mais de 400 comentários. Está muito além do que a maioria das equipes encontra, e por isso testa bem as suposições sobre rolagem, expansão e renderização de comentários. O produto precisa permitir a revisão na [visualização de arquivos alterados](https://docs.github.com/en/copilot/how-tos/github-copilot-app/managing-issues-and-pull-requests), não só carregar uma página de resumo.

O GitHub descreve duas frentes de validação: um teste automatizado que acompanha contagens de renderização, tempos e fluidez dos quadros; e uma execução no aplicativo real, com comentários ainda carregando e depois já carregados. Essa diferença importa. Um benchmark sintético encontra regressões rapidamente, enquanto o fluxo real revela interações incômodas que um número não descreve.

## Um padrão útil para qualquer interface grande

Meça as transições de estado caras, não apenas a primeira pintura. Abra detalhes, redimensione a janela, avance na lista de arquivos e volte aos comentários. A [documentação do Profiler do React](https://react.dev/reference/react/Profiler) mostra como medir o trabalho de renderização dos componentes; ele é um instrumento, não a história inteira. A lição é colocar a pior jornada realista na validação antes de alguém aparecer com o PR de um milhão de linhas.`,
      },
    },
  },
  {
    slug: "github-actions-node-24",
    image: "/news/github-actions-node-24/cover.webp",
    date: "2026-09-23",
    category: "engineering",
    publisher: "GitHub",
    sourceUrl: "https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/",
    sources: [
      { url: "https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/", label: { "en-us": "GitHub: Node 20 deprecation timeline", "pt-br": "GitHub: cronograma de descontinuação do Node 20" } },
      { url: "https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax", label: { "en-us": "GitHub Docs: action metadata syntax", "pt-br": "GitHub Docs: sintaxe dos metadados de actions" } },
    ],
    copy: {
      "en-us": {
        title: "GitHub Actions retires Node 20 for JavaScript actions",
        summary: "Runners now use Node 24, and maintainers of JavaScript actions need to update their action metadata.",
        body: [
          "GitHub says Node 20 is no longer available on Actions runners. JavaScript actions now run on Node 24, and the temporary opt-out for the older runtime has been removed.",
          "Action maintainers should update `runs.using` to `node24` and release a new version. Workflow owners should move to current action releases that support Node 24. GitHub also flags compatibility limits for older macOS and ARM32 self-hosted runners.",
        ],
        analysis: `## A migration with two owners

The [September 23 notice](https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/) closes the migration announced a year earlier. GitHub had already moved runners toward Node 24; now the \`ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION\` escape hatch is gone. The earlier [deprecation timeline](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/) explains how the default changed and when the temporary opt-out would disappear.

If you maintain a JavaScript action, the runtime is declared in its metadata, so update \`runs.using\` to \`node24\`, test it, and publish a release. GitHub's [metadata reference](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax) shows the syntax. If you only consume actions, inspect the versions pinned in your workflows and move to releases that support Node 24. Those are different jobs; upgrading the Node version inside your application does not update the runtime of an action you call.

## The infrastructure edge case

GitHub warns that Node 24 does not support macOS 13.4 and earlier in this runner context and has no official ARM32 support. Teams with self-hosted runners should check the runner OS and architecture before blaming a broken workflow on a JavaScript package. The less glamorous migration work is often in the machine that runs the action.`,
      },
      "pt-br": {
        title: "GitHub Actions aposenta o Node 20 para actions em JavaScript",
        summary: "Os runners agora usam Node 24, e mantenedores de actions em JavaScript precisam atualizar seus metadados.",
        body: [
          "Segundo o GitHub, o Node 20 não está mais disponível nos runners do Actions. As actions em JavaScript agora usam Node 24, e a opção temporária de continuar no runtime antigo foi removida.",
          "Mantenedores de actions devem atualizar `runs.using` para `node24` e publicar uma nova versão. Responsáveis por workflows devem usar versões atuais das actions compatíveis com Node 24. O GitHub também aponta limitações para runners próprios com macOS antigo e ARM32.",
        ],
        analysis: `## Uma migração com dois responsáveis

O [aviso de 23 de setembro](https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/) encerra a migração anunciada um ano antes. O GitHub já vinha direcionando os runners para o Node 24; agora a saída temporária \`ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION\` acabou. O [cronograma de descontinuação](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/) explica quando o padrão mudou e quando a exceção deixaria de funcionar.

Se você mantém uma action em JavaScript, o runtime é declarado nos metadados: atualize \`runs.using\` para \`node24\`, teste e publique uma versão. A [referência de metadados](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax) mostra a sintaxe. Se você apenas usa actions, confira as versões fixadas nos workflows e migre para versões compatíveis com Node 24. São tarefas distintas; atualizar o Node da sua aplicação não atualiza o runtime de uma action chamada por ela.

## O caso especial da infraestrutura

O GitHub alerta que o Node 24 não suporta macOS 13.4 ou anterior nesse contexto e não tem suporte oficial a ARM32. Equipes com runners próprios devem conferir sistema e arquitetura antes de culpar um pacote JavaScript por um workflow quebrado. O trabalho menos vistoso da migração muitas vezes está na máquina que executa a action.`,
      },
    },
  },
  {
    slug: "copilot-code-review-controls",
    image: "/news/copilot-code-review-controls/cover.webp",
    date: "2026-09-23",
    category: "ai",
    publisher: "GitHub",
    sourceUrl: "https://github.blog/changelog/2026-09-23-copilot-code-review-more-ways-to-request-and-configure-reviews/",
    sources: [
      { url: "https://docs.github.com/en/copilot/how-tos/copilot-on-github/set-up-copilot/configure-code-review", label: { "en-us": "GitHub Docs: configuring Copilot code review", "pt-br": "GitHub Docs: configuração da revisão do Copilot" } },
      { url: "https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/use-code-review", label: { "en-us": "GitHub Docs: requesting a Copilot review", "pt-br": "GitHub Docs: como solicitar uma revisão do Copilot" } },
    ],
    copy: {
      "en-us": {
        title: "Copilot code review gets finer personal and enterprise controls",
        summary: "Developers can tune automatic reviews and review effort; enterprises can set a default across repositories.",
        body: [
          "GitHub has expanded Copilot code review settings across its plans. Developers now get a dedicated page for automatic review preferences, including draft pull requests and new pushes, as well as a default effort level.",
          "Enterprise administrators can set a review effort default that flows to organization-owned repositories, while organizations and repositories can override it. The changes are generally available, according to GitHub.",
        ],
        analysis: `## The controls that actually changed

The [release](https://github.blog/changelog/2026-09-23-copilot-code-review-more-ways-to-request-and-configure-reviews/) separates several decisions that used to be easy to conflate. A developer can enable automatic reviews for their pull requests, decide whether draft pull requests and later pushes are included, and choose a default effort level. The enterprise can set a baseline, while organizations and repositories retain overrides.

GitHub's [configuration guide](https://docs.github.com/en/copilot/how-tos/copilot-on-github/set-up-copilot/configure-code-review) describes Lite and Balanced effort levels and how personal settings and repository rules interact. Its [review guide](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/use-code-review) covers manual requests. The operational detail is that an automatic review from one setting does not necessarily cancel a review requested by another rule; teams should understand which policy is triggering the work.

## A sensible rollout

Start where automated feedback is most useful: repositories with active review queues and clear ownership. Decide whether draft reviews help or merely produce noise before the code is ready. Measure useful findings and review time, not just the number of comments Copilot posted. Human reviewers still own architecture, behavior, and the final decision to merge.`,
      },
      "pt-br": {
        title: "Revisão de código do Copilot ganha controles pessoais e corporativos",
        summary: "É possível ajustar revisões automáticas e esforço de análise; empresas podem definir um padrão para seus repositórios.",
        body: [
          "O GitHub ampliou as configurações de revisão de código do Copilot entre seus planos. Pessoas desenvolvedoras agora têm uma página dedicada às preferências de revisão automática, incluindo pull requests em rascunho e novos pushes, além de um nível de esforço padrão.",
          "Administradores corporativos podem definir um esforço de revisão herdado pelos repositórios das organizações, que ainda podem substituí-lo. Segundo o GitHub, as mudanças já estão disponíveis de forma geral.",
        ],
        analysis: `## Os controles que realmente mudaram

O [lançamento](https://github.blog/changelog/2026-09-23-copilot-code-review-more-ways-to-request-and-configure-reviews/) separa decisões que antes eram fáceis de confundir. A pessoa desenvolvedora pode ativar revisões automáticas nos próprios pull requests, decidir se rascunhos e novos pushes entram nessa regra e escolher um nível de esforço padrão. A empresa define uma base, enquanto organizações e repositórios podem substituí-la.

O [guia de configuração](https://docs.github.com/en/copilot/how-tos/copilot-on-github/set-up-copilot/configure-code-review) descreve os níveis Lite e Balanced e como preferências pessoais e regras do repositório interagem. O [guia de revisão](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/use-code-review) cobre solicitações manuais. O detalhe operacional é que uma revisão automática disparada por uma configuração não necessariamente cancela outra solicitada por uma regra; a equipe deve entender qual política iniciou o trabalho.

## Uma adoção sensata

Comece onde o feedback automático é mais útil: repositórios com filas ativas de revisão e responsáveis bem definidos. Decida se revisar rascunhos ajuda ou só produz ruído antes de o código estar pronto. Meça achados úteis e tempo de revisão, não só o número de comentários do Copilot. Revisores humanos ainda respondem pela arquitetura, pelo comportamento e pela decisão final de merge.`,
      },
    },
  },
  {
    slug: "gpt-6-sol-luna",
    date: "2026-09-22",
    category: "ai",
    publisher: "OpenAI",
    sourceUrl: "https://openai.com/index/introducing-gpt-6-sol-and-luna/",
    sources: [
      { url: "https://developers.openai.com/api/docs/models/gpt-6-sol", label: { "en-us": "OpenAI API: GPT-6 Sol model details", "pt-br": "OpenAI API: detalhes do modelo GPT-6 Sol" } },
      { url: "https://developers.openai.com/api/docs/models/gpt-6-luna", label: { "en-us": "OpenAI API: GPT-6 Luna model details", "pt-br": "OpenAI API: detalhes do modelo GPT-6 Luna" } },
      { url: "https://developers.openai.com/api/docs/changelog", label: { "en-us": "OpenAI API changelog", "pt-br": "Histórico de alterações da API OpenAI" } },
    ],
    image: "/news/gpt-6-sol-luna/cover.webp",
    copy: {
      "en-us": {
        title: "OpenAI brings GPT-6 Sol and Luna to everyday AI work",
        summary: "The new models aim to make stronger coding and agent capabilities faster and more affordable across the API and Codex.",
        body: [
          "OpenAI has introduced GPT-6 Sol and GPT-6 Luna as faster, lower-cost additions to the GPT-6 family. The company says the models bring improvements in coding, computer use, factuality, and professional work to tasks that do not need the full depth of Astra.",
          "Both models are available through the API and Codex. OpenAI says their API prices are 50% lower than the promotional prices of their GPT-5.6 counterparts, while improved prompt caching can further reduce the cost of repeated context in long-running agents.",
        ],
        analysis: `## Two different jobs, one release

OpenAI positions [Sol](https://developers.openai.com/api/docs/models/gpt-6-sol) for complex coding and agent workflows and [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) for focused, high-volume work. The model pages list standard prices of $2 input and $10 output per million tokens for Sol, versus $0.10 input and $0.50 output for Luna. Both list a 1.05-million-token context window, but a larger window does not make a poorly scoped task cheaper or more reliable.

The [launch article](https://openai.com/index/introducing-gpt-6-sol-and-luna/) reports improvements on coding and agent evaluations and compares cost per task with rival models. Those benchmark comparisons come from OpenAI; they are useful directional evidence, not a substitute for testing your own prompts, tools, latency, and failure cases. The [API changelog](https://developers.openai.com/api/docs/changelog) confirms the model IDs and availability in the Responses and Chat Completions APIs.

## What I would benchmark

Run the same real task set through both models. Track finished-task quality, retries, tool calls, wall time, and total bill, not only token price. A cheap call that needs five retries can be the expensive choice. Sol may make sense for ambiguous, multi-step work; Luna may win when the task is narrow and repeated at scale. The right answer is in your workload, not in the model name.`,
      },
      "pt-br": {
        title: "OpenAI leva GPT-6 Sol e Luna ao trabalho cotidiano com IA",
        summary: "Os novos modelos buscam tornar programação e agentes mais rápidos e acessíveis na API e no Codex.",
        body: [
          "A OpenAI apresentou GPT-6 Sol e GPT-6 Luna como opções mais rápidas e econômicas da família GPT-6. Segundo a empresa, os modelos levam avanços em programação, uso de computadores, precisão factual e trabalho profissional a tarefas que não exigem toda a capacidade do Astra.",
          "Os dois modelos estão disponíveis na API e no Codex. A OpenAI informa que os preços da API são 50% menores que os preços promocionais dos equivalentes GPT-5.6, enquanto melhorias no cache de prompts podem reduzir ainda mais o custo do contexto repetido em agentes de longa duração.",
        ],
        analysis: `## Dois trabalhos diferentes, um lançamento

A OpenAI posiciona o [Sol](https://developers.openai.com/api/docs/models/gpt-6-sol) para programação complexa e fluxos com agentes e o [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) para tarefas focadas e de alto volume. As páginas dos modelos mostram preços padrão de US$ 2 por milhão de tokens de entrada e US$ 10 de saída para o Sol, contra US$ 0,10 e US$ 0,50 para o Luna. Ambos apresentam janela de contexto de 1,05 milhão de tokens, mas uma janela maior não torna uma tarefa mal definida mais barata ou confiável.

O [artigo de lançamento](https://openai.com/index/introducing-gpt-6-sol-and-luna/) relata avanços em avaliações de programação e agentes e compara o custo por tarefa com modelos rivais. Esses benchmarks vêm da própria OpenAI; ajudam a orientar, mas não substituem testes com seus prompts, ferramentas, latência e modos de falha. O [histórico da API](https://developers.openai.com/api/docs/changelog) confirma os IDs e a disponibilidade nas APIs Responses e Chat Completions.

## O que eu testaria

Execute o mesmo conjunto de tarefas reais nos dois modelos. Acompanhe qualidade da tarefa concluída, tentativas extras, chamadas de ferramentas, tempo total e custo final, não apenas preço por token. Uma chamada barata que exige cinco tentativas pode sair cara. Sol pode fazer sentido para trabalhos ambíguos e de várias etapas; Luna pode vencer quando a tarefa é estreita e repetida em escala. A resposta está na sua carga de trabalho, não no nome do modelo.`,
      },
    },
  },
  {
    slug: "gpt-6-prompt-caching",
    image: "/news/gpt-6-prompt-caching/cover.webp",
    date: "2026-09-22",
    category: "ai",
    publisher: "OpenAI",
    sourceUrl: "https://openai.com/index/better-prompt-caching-for-gpt-6/",
    sources: [
      { url: "https://developers.openai.com/api/docs/guides/prompt-caching", label: { "en-us": "OpenAI API: prompt caching guide", "pt-br": "OpenAI API: guia do cache de prompts" } },
      { url: "https://developers.openai.com/api/docs/guides/prompt-caching/diagnostics", label: { "en-us": "OpenAI API: cache diagnostics", "pt-br": "OpenAI API: diagnóstico do cache" } },
    ],
    copy: {
      "en-us": {
        title: "GPT-6 prompt caching gets diagnostics and explicit breakpoints",
        summary: "New tools help developers spot cache misses and control reused context in long-running agent workflows.",
        body: [
          "OpenAI has updated prompt caching for GPT-6 with higher default hit rates, a dashboard for monitoring reuse, and diagnostics that explain why a request missed the cache. Developers can also place explicit breakpoints in prompt prefixes.",
          "The changes target agents that make many related API calls and repeatedly send the same instructions, tools, and context. OpenAI says cached input can receive discounts of up to 90%, making cache behavior a meaningful part of production agent costs.",
        ],
        analysis: `## The part of an agent bill you can design

The [caching guide](https://developers.openai.com/api/docs/guides/prompt-caching) says reuse depends on an exact shared prefix and compatible request settings. For GPT-5.6 and later, at least 1,024 eligible input tokens are needed. A stable block of instructions and tool definitions can be cached; frequently changing context belongs after it. Explicit breakpoints let an application choose where a reusable prefix ends.

There is a cost tradeoff. OpenAI documents cache writes at 1.25 times the uncached input rate and reads at 0.1 times that rate for these models. If a prefix will only be used once, writing it is no bargain. Reused across a long agent session, it can be. The [diagnostics guide](https://developers.openai.com/api/docs/guides/prompt-caching/diagnostics) lets a developer compare requests and inspect reasons such as changed tools or settings when an expected hit fails.

## Measure before celebrating

The [announcement](https://openai.com/index/better-prompt-caching-for-gpt-6/) includes customer savings examples, but those are specific workloads. Track cache hit rate, cache-write tokens, latency, and total cost across representative conversations. A session ID by itself does not guarantee a hit. If the prompt structure changes every turn, the cache cannot rescue an unstable architecture.`,
      },
      "pt-br": {
        title: "Cache de prompts do GPT-6 ganha diagnósticos e pontos de controle",
        summary: "Novas ferramentas ajudam a encontrar falhas no cache e controlar o contexto reutilizado por agentes de longa duração.",
        body: [
          "A OpenAI atualizou o cache de prompts do GPT-6 com taxas de acerto maiores por padrão, um painel para acompanhar a reutilização e diagnósticos que explicam por que uma requisição não usou o cache. Também é possível definir pontos explícitos nos prefixos dos prompts.",
          "As mudanças são voltadas a agentes que fazem muitas chamadas relacionadas à API e enviam repetidamente as mesmas instruções, ferramentas e contexto. Segundo a OpenAI, entradas em cache podem receber descontos de até 90%, tornando o comportamento do cache relevante para o custo de agentes em produção.",
        ],
        analysis: `## A parte da conta de um agente que dá para projetar

O [guia de cache](https://developers.openai.com/api/docs/guides/prompt-caching) diz que a reutilização exige um prefixo compartilhado exatamente igual e configurações compatíveis. Para GPT-5.6 e posteriores, são necessários pelo menos 1.024 tokens de entrada elegíveis. Um bloco estável de instruções e definições de ferramentas pode ser armazenado; o contexto que muda com frequência deve vir depois. Pontos explícitos permitem escolher onde termina o prefixo reutilizável.

Há uma troca de custos. Para esses modelos, a OpenAI documenta a escrita em cache a 1,25 vez o preço da entrada sem cache e a leitura a 0,1 vez. Se o prefixo será usado uma vez só, gravá-lo não compensa. Reutilizado ao longo de uma sessão extensa, pode compensar. O [guia de diagnósticos](https://developers.openai.com/api/docs/guides/prompt-caching/diagnostics) permite comparar requisições e investigar diferenças nas ferramentas ou configurações quando um acerto esperado não acontece.

## Meça antes de comemorar

O [anúncio](https://openai.com/index/better-prompt-caching-for-gpt-6/) traz exemplos de economia de clientes, mas são cargas de trabalho específicas. Acompanhe taxa de acerto, tokens escritos no cache, latência e custo total em conversas representativas. Um ID de sessão sozinho não garante acerto. Se a estrutura do prompt muda a cada turno, o cache não salva uma arquitetura instável.`,
      },
    },
  },
];

export function getNewsStory(slug: string): NewsStory | undefined {
  return newsStories.find((story) => story.slug === slug);
}
