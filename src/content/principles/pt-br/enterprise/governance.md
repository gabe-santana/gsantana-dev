---
title: Governança
short: "Guardrails, não portões: governança que deixa os times acelerarem sem cair do penhasco. Afinal, quem quer esperar um mês por uma reunião pra ouvir um sim?"
category: enterprise
---

## Introdução

Fale a palavra "governança" numa sala cheia de engenheiros e repare nas caras. Alguém suspira, alguém olha pro teto e alguém abre discretamente uma aba nova pra atualizar o currículo. Pra muita gente, governança significa formulário, comitê, aprovação e aquela sensação de pedir licença pra fazer o próprio trabalho.

E sinceramente? Muitas vezes essas pessoas têm razão. Mas isso é governança mal feita, não governança em si.

A **meta** deste princípio é simples de dizer e difícil de fazer: garantir que as decisões importantes da organização sejam tomadas pelas pessoas certas, no nível certo, com as informações certas, e que as regras que saem dessas decisões sejam **aplicadas automaticamente**, sem transformar cada entrega numa gincana burocrática. Governança boa não atrasa os times. É ela que permite que uma empresa com cinquenta times ande rápido sem que cada um reinvente segurança, rede e *compliance* por conta própria (e erre em alguns deles).

Quando uma organização negligencia este princípio, ou implementa do jeito errado, os sintomas aparecem rapidinho:

- Cada time toma a mesma decisão crítica de um jeito diferente, e ninguém sabe qual é o "certo";
- Ninguém lembra **por que** aquele banco, aquela região ou aquele framework foi escolhido;
- A conformidade é verificada uma vez por ano, no desespero, na semana anterior à auditoria;
- Exceções concedidas "temporariamente" em 2019 continuam lá, firmes e fortes, em produção;
- Aprovações levam semanas, então os times aprendem a contornar o processo (o famoso *shadow IT*);
- As regras de segurança e custo vivem num PDF que ninguém abre desde que foi escrito;

Pois é, *é raro, mas acontece bastante*... Quem nunca viu?

### O comitê que se reunia uma vez por mês

Deixa eu contar uma história que, com pequenas variações, eu já vi em mais de uma empresa.

Existia um **Comitê de Arquitetura** (o tal do ARB, *Architecture Review Board*). Ele se reunia na primeira terça-feira de cada mês. Pra entrar na pauta, o time precisava enviar um documento de design com duas semanas de antecedência, seguindo um template de trinta páginas. O comitê era formado por sete pessoas seniores, todas muito ocupadas, que liam os documentos (quando liam) na noite anterior.

Um time queria usar uma fila de mensagens gerenciada. Enviou o pedido. A reunião acabou antes de chegar no item deles. Próximo mês. Na segunda tentativa, o comitê pediu "um comparativo com três alternativas". Próximo mês. Na terceira, a decisão foi aprovada com a condição de "revisar a topologia de rede com o time de infraestrutura", que tinha o seu próprio comitê. Total: quase quatro meses pra usar um serviço que o provedor de nuvem oferece em dois cliques.

O que aconteceu depois é o que sempre acontece: o time seguinte nem pediu. Criou a fila numa assinatura pessoal, no cartão de crédito, "só pra testar". O teste foi pra produção. Ninguém sabia que aquilo existia até a fatura chegar, junto com um apontamento de auditoria sobre dados fora da região aprovada.

<div class="callout warning" data-title="O paradoxo do portão lento">
  <p>Um processo de governança lento demais não gera mais controle. Gera <strong>menos</strong> controle, porque as pessoas começam a dar a volta nele. O comitê mais rígido do mundo não governa nada se as decisões estão sendo tomadas fora dele.</p>
</div>

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Então a solução é simples: acaba com o comitê e deixa cada time fazer o que quiser! Liberdade!"</span>
    </div>
  </div>
</div>

Calma aí, Júnior! Jogar a governança fora é o outro extremo, e termina tão mal quanto. Sem nenhuma regra compartilhada, você ganha quarenta jeitos de lidar com segredos, doze stacks de log, buckets públicos cheios de dados de clientes e ninguém capaz de responder a pergunta mais simples do auditor: "quem aprovou isso, e por quê?".

A resposta não é "mais controle" nem "menos controle". É **controle mais inteligente**: tirar as regras da sala de reunião e colocar dentro da plataforma, e guardar o julgamento humano para as decisões que realmente precisam dele.

## Guardrails, Não Portões

Essa é a ideia central da governança moderna, então vale explicar direitinho.

Um **portão** (*gate*) é um ponto de controle onde o trabalho para e espera a aprovação de alguém. É síncrono, manual e, por natureza, uma fila. Quanto mais times você tem, maior a fila.

Um **guardrail** é um limite embutido na estrada. Você dirige na velocidade que quiser, e o guardrail só se faz notar quando você está prestes a cair do penhasco. É automático, funciona o tempo todo e escala com o número de times sem ninguém precisar estar numa reunião.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 290" role="img" aria-labelledby="gov-d1-title gov-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="gov-d1-title">Modelo de portões versus modelo de guardrails</title>
<desc id="gov-d1-desc">No modelo de portões, o pedido do time espera um comitê mensal, muitas vezes volta para retrabalho e o deploy acontece semanas depois. No modelo de guardrails, o time parte de uma via pavimentada, checagens automáticas de policy rodam no pipeline e na plataforma, e o deploy acontece no mesmo dia.</desc>
<defs><marker id="gov-d1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="360" y="28" text-anchor="middle" class="d-label">PORTÕES: SEMANAS DE ESPERA</text>
<rect x="20" y="45" width="140" height="64" rx="10" class="d-box"/>
<text x="90" y="73" text-anchor="middle" class="d-title">Pedido do time</text>
<text x="90" y="95" text-anchor="middle" class="d-small">documento, slides</text>
<rect x="200" y="45" width="140" height="64" rx="10" class="d-box-danger"/>
<text x="270" y="73" text-anchor="middle" class="d-title">Comitê mensal</text>
<text x="270" y="95" text-anchor="middle" class="d-small">espera a reunião</text>
<rect x="380" y="45" width="140" height="64" rx="10" class="d-box-warn"/>
<text x="450" y="73" text-anchor="middle" class="d-title">Veredito</text>
<text x="450" y="95" text-anchor="middle" class="d-small">aprova ou refaz</text>
<rect x="560" y="45" width="140" height="64" rx="10" class="d-box-muted"/>
<text x="630" y="73" text-anchor="middle" class="d-title">Deploy</text>
<text x="630" y="95" text-anchor="middle" class="d-small">semanas depois</text>
<line x1="160" y1="77" x2="198" y2="77" class="d-line" marker-end="url(#gov-d1-arrow)"/>
<line x1="340" y1="77" x2="378" y2="77" class="d-line" marker-end="url(#gov-d1-arrow)"/>
<line x1="520" y1="77" x2="558" y2="77" class="d-line" marker-end="url(#gov-d1-arrow)"/>
<path d="M450,109 L450,128 L270,128 L270,111" fill="none" class="d-line-danger" marker-end="url(#gov-d1-arrow)"/>
<text x="360" y="146" text-anchor="middle" class="d-small">retrabalho: volta para o mês seguinte</text>
<text x="360" y="184" text-anchor="middle" class="d-label">GUARDRAILS: MINUTOS A HORAS</text>
<rect x="20" y="200" width="140" height="64" rx="10" class="d-box"/>
<text x="90" y="228" text-anchor="middle" class="d-title">Necessidade</text>
<text x="90" y="250" text-anchor="middle" class="d-small">começa a codar</text>
<rect x="200" y="200" width="140" height="64" rx="10" class="d-box-accent"/>
<text x="270" y="228" text-anchor="middle" class="d-title">Via pavimentada</text>
<text x="270" y="250" text-anchor="middle" class="d-small">templates, módulos</text>
<rect x="380" y="200" width="140" height="64" rx="10" class="d-box-info"/>
<text x="450" y="228" text-anchor="middle" class="d-title">Checagens</text>
<text x="450" y="250" text-anchor="middle" class="d-small">CI e plataforma</text>
<rect x="560" y="200" width="140" height="64" rx="10" class="d-box-accent"/>
<text x="630" y="228" text-anchor="middle" class="d-title">Deploy</text>
<text x="630" y="250" text-anchor="middle" class="d-small">no mesmo dia</text>
<line x1="160" y1="232" x2="198" y2="232" class="d-line-accent" marker-end="url(#gov-d1-arrow)"/>
<line x1="340" y1="232" x2="378" y2="232" class="d-line-accent" marker-end="url(#gov-d1-arrow)"/>
<line x1="520" y1="232" x2="558" y2="232" class="d-line-accent" marker-end="url(#gov-d1-arrow)"/>
</svg>
</div>
<figcaption>Figura 1: A mesma necessidade, tratada por um portão e por um guardrail</figcaption>
</figure>

Repare que o modelo de guardrails não elimina as regras. As regras são **as mesmas** (regiões permitidas, criptografia, nada de endpoint público pra dado interno, tags obrigatórias). O que muda é **onde** elas moram e **quando** são verificadas: em vez de uma pessoa lendo um documento uma vez por mês, uma *policy* avalia cada mudança, o tempo todo, em segundos.

### Vias pavimentadas: faça do certo o caminho mais fácil

Guardrails dizem o que você **não pode** fazer. Uma **via pavimentada** (*paved road*, que algumas empresas chamam de *golden path*) mostra o que você **deveria** fazer, e transforma isso no caminho de menor resistência.

Na prática, a via pavimentada é um conjunto de blocos prontos pra usar, mantidos por um time de plataforma:

- Módulos de infraestrutura (Terraform, Bicep, Pulumi) que já vêm com criptografia, rede privada, diagnósticos e tags;
- Templates de serviço com pipeline, observabilidade e *security scanning* configurados de fábrica;
- Padrões pré-aprovados para os cenários mais comuns (API web, consumidor de eventos, job batch, site estático);
- Documentação explicando **por que** cada escolha foi feita.

O acordo com os times é claro: **se você usa a via pavimentada, já está em conformidade**. Sem revisão, sem ticket, sem espera. Se quiser sair da estrada, pode, mas aí o ônus de provar que a sua alternativa atende aos mesmos requisitos é seu.

<div class="callout tip">
  <p>Uma via pavimentada só funciona se for <strong>de fato melhor</strong> que a alternativa. Se o template oficial é mais lento, mais velho ou mais chato de usar do que fazer na mão, os times vão abandoná-lo, não importa quantas policies você escreva. Trate a plataforma como produto, com os times de desenvolvimento como clientes.</p>
</div>

A via pavimentada tem interseção com padronização, e isso é intencional: os padrões reutilizáveis em si (quais linguagens, quais padrões, quais arquiteturas de referência) são assunto de [Padronização](/pt-br/principles/enterprise/standardization/). Aqui, o foco é a outra metade: **quem decide** o que entra na estrada e **como** as regras são aplicadas.

## Direitos de Decisão: Quem Decide o Quê

Toda organização toma decisões de arquitetura o tempo todo. A questão é se ela sabe **quem** está tomando. Direitos de decisão pouco claros geram duas doenças opostas: tudo sobe pro comitê (paralisia) ou nada sobe (caos).

Um jeito útil de distribuir as decisões é olhar para duas dimensões:

- **Raio de impacto** (*blast radius*): quantos times, sistemas ou clientes são afetados se a decisão estiver errada?
- **Reversibilidade:** quanto custa desfazer? Trocar uma biblioteca é barato. Trocar o banco de dados principal ou o provedor de identidade da empresa, nem um pouco.

A Amazon popularizou essa ideia com a analogia das "portas de mão única" e "portas de mão dupla": decisões por onde dá pra voltar devem ser tomadas rápido, por quem está mais perto do problema. Só as portas de mão única merecem uma deliberação mais pesada.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 340" role="img" aria-labelledby="gov-d2-title gov-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="gov-d2-title">Direitos de decisão por raio de impacto e reversibilidade</title>
<desc id="gov-d2-desc">Uma matriz dois por dois. Decisões de baixo impacto e fáceis de reverter são tomadas pelo time. Baixo impacto, mas difíceis de reverter: o time decide com um ADR e revisão por pares. Alto impacto, mas fáceis de reverter: um guardrail automático da plataforma. Alto impacto e difíceis de reverter: um fórum de arquitetura com ADR e revisão assíncrona.</desc>
<text x="70" y="175" text-anchor="middle" class="d-label" transform="rotate(-90 70 175)">RAIO DE IMPACTO</text>
<text x="100" y="60" text-anchor="end" class="d-small">alto</text>
<text x="100" y="295" text-anchor="end" class="d-small">baixo</text>
<rect x="120" y="40" width="265" height="125" rx="10" class="d-box-danger"/>
<text x="252" y="88" text-anchor="middle" class="d-title">Fórum de arquitetura</text>
<text x="252" y="112" text-anchor="middle" class="d-small">ADR e revisão assíncrona</text>
<text x="252" y="132" text-anchor="middle" class="d-small">dias, não meses</text>
<rect x="395" y="40" width="265" height="125" rx="10" class="d-box-info"/>
<text x="527" y="88" text-anchor="middle" class="d-title">Guardrail da plataforma</text>
<text x="527" y="112" text-anchor="middle" class="d-small">codificado como policy</text>
<text x="527" y="132" text-anchor="middle" class="d-small">checado a cada mudança</text>
<rect x="120" y="175" width="265" height="125" rx="10" class="d-box-warn"/>
<text x="252" y="223" text-anchor="middle" class="d-title">Time com ADR</text>
<text x="252" y="247" text-anchor="middle" class="d-small">revisão por pares, conselho</text>
<text x="252" y="267" text-anchor="middle" class="d-small">escrito para o futuro</text>
<rect x="395" y="175" width="265" height="125" rx="10" class="d-box-accent"/>
<text x="527" y="223" text-anchor="middle" class="d-title">Time decide</text>
<text x="527" y="247" text-anchor="middle" class="d-small">pode seguir em frente</text>
<text x="527" y="267" text-anchor="middle" class="d-small">dentro dos guardrails</text>
<text x="252" y="325" text-anchor="middle" class="d-label">DIFÍCIL DE REVERTER</text>
<text x="527" y="325" text-anchor="middle" class="d-label">FÁCIL DE REVERTER</text>
</svg>
</div>
<figcaption>Figura 2: Quem decide depende do raio de impacto e da reversibilidade</figcaption>
</figure>

A consequência prática: **a maioria das decisões nunca deveria chegar a um comitê**. Escolher biblioteca de JSON, nomear filas, organizar um repositório, escolher framework de teste: tudo isso mora no canto inferior direito. O fórum de arquitetura deveria ver um punhado de decisões por mês, não dezenas.

### RACI: deixando a responsabilidade explícita

Para as atividades recorrentes de governança, uma matriz **RACI** elimina o problema do "achei que era você que ia fazer". Cada letra responde uma pergunta diferente: quem executa (**R**, *Responsible*), quem responde pelo resultado e dá a palavra final (**A**, *Accountable*, apenas uma pessoa ou papel por atividade), quem precisa ser ouvido antes (**C**, *Consulted*) e quem precisa ser informado depois (**I**, *Informed*).

| Atividade | Time de produto | Time de plataforma | Fórum de arquitetura | Segurança | CISO / CTO |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Escolher bibliotecas e frameworks dentro da via pavimentada** | R, A | I | | | |
| **Escrever um ADR para uma decisão entre times** | R | C | A | C | I |
| **Criar ou alterar uma policy corporativa** | C | R | C | A | I |
| **Conceder uma exceção a uma policy** | R (solicita) | C | C | A | I |
| **Manter landing zones e módulos da via pavimentada** | C | R, A | C | C | |
| **Definir os próprios princípios de governança** | C | C | R | C | A |

<div class="callout info">
  <p>O erro mais comum em RACI é ter <strong>mais de um "A"</strong> por linha. Se duas pessoas são responsáveis pelo resultado, ninguém é. O segundo erro mais comum é consultar todo mundo sobre tudo: cada "C" é alguém por quem o trabalho vai ter que esperar.</p>
</div>

### Revisão de arquitetura do jeito certo

Então é pra acabar com o comitê? Não necessariamente. Ele precisa mudar de natureza: de um **portão** que aprova projetos para um **fórum** que ajuda as pessoas a tomarem boas decisões e aprende com elas. Algumas características dos fóruns que funcionam:

1. **Assíncrono por padrão.** A decisão é proposta por escrito (um ADR num *pull request*), as pessoas comentam ao longo de alguns dias, e a reunião só existe para os casos em que o texto não bastou.
2. **Conselho, não permissão.** O Andrew Harmel-Law descreve isso muito bem no "processo de conselho" (*advice process*, veja as referências): qualquer pessoa pode tomar uma decisão de arquitetura, desde que antes busque o conselho de quem é afetado e de quem tem expertise. Quem decide continua responsável, e o fórum é o lugar pra pedir esse conselho.
3. **Prazo curto e previsível.** Por exemplo, "se ninguém levantar uma objeção bloqueante em cinco dias úteis, a decisão está valendo". Previsibilidade importa mais do que velocidade.
4. **Só para portas de mão única.** Todo o resto é decidido pelos times, dentro dos guardrails.
5. **Alimenta a plataforma.** Quando o fórum vê a mesma pergunta três vezes, a resposta deveria virar um módulo da via pavimentada ou uma policy, pra ninguém precisar perguntar a quarta.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Escrever? Mas a gente já decidiu na reunião, todo mundo estava lá. Pra que perder tempo documentando?"</span>
    </div>
  </div>
</div>

Porque daqui a dezoito meses, Júnior, metade desse "todo mundo" vai ter saído da empresa, e a outra metade vai lembrar da reunião de um jeito diferente. Aí alguém novo olha o sistema, pensa "que escolha estranha" e passa três semanas desfazendo uma decisão que tinha um ótimo motivo por trás. Ou pior, mantém uma decisão ruim por medo, porque ninguém sabe se ela foi deliberada.

### Architecture Decision Records (ADRs)

Um **ADR** é um documento curto (uma ou duas páginas, no máximo) que registra uma única decisão significativa: o contexto, a decisão em si e as consequências. O formato foi popularizado pelo Michael Nygard, e a beleza dele está em ser pequeno. ADRs moram **no repositório**, junto do código, versionados no Git e revisados em *pull requests* como qualquer outra mudança.

Um template mínimo:

```markdown
# ADR-0042: Usar fila de mensagens gerenciada para eventos de pedido

Status: Aceito (2026-09-10)
Decisores: Time de Pedidos, com conselho de Plataforma e Segurança

## Contexto
Eventos de pedido se perdem quando o consumidor reinicia. Precisamos
de entrega at-least-once e não queremos operar um broker.

## Decisão
Usar a fila gerenciada do provedor de nuvem, provisionada pelo módulo
da via pavimentada, com private endpoint e criptografia com CMK.

## Consequências
+ Nenhum broker para atualizar ou escalar.
+ Já em conformidade com as policies da landing zone.
- Dependência da API de fila do provedor (mitigada por um adapter).
- Os consumidores precisam ser idempotentes.
```

Alguns hábitos que tornam os ADRs úteis em vez de decorativos:

- **ADRs são imutáveis.** Quando uma decisão muda, você escreve um novo ADR que *substitui* o antigo, e o antigo continua lá com o status atualizado. O histórico é justamente o valor.
- **Registre as alternativas descartadas**, com uma linha explicando por quê. É exatamente isso que o leitor do futuro vai perguntar.
- **Escreva na hora da decisão**, não depois. Um ADR escrito seis meses depois é arqueologia, não governança.
- **Ligue os ADRs às policies** que nasceram deles. Quando uma policy bloquear alguém, a pessoa deveria achar o motivo em um clique.

## Landing Zones e a Hierarquia

Os direitos de decisão dizem **quem** decide. A próxima pergunta é **onde** as decisões são aplicadas. Na nuvem, a resposta é a hierarquia de recursos: a estrutura de contas, assinaturas e projetos, e os agrupamentos acima deles.

Uma **landing zone** é um ambiente pré-configurado, pronto pra receber *workloads*, que já vem com identidade, rede, logs, segurança e as policies de governança no lugar. Em vez de cada time construir sua fundação do zero, eles "pousam" numa que já está em conformidade.

O pulo do gato é a hierarquia: **as policies são atribuídas num nível alto e herdadas para baixo**. Você escreve a regra "só estas regiões são permitidas" uma vez, lá em cima, e ela vale para todas as assinaturas ou contas abaixo, inclusive as que vão ser criadas no ano que vem.

- Na **Azure**, isso é feito com **management groups**, com atribuições de **Azure Policy** em cada nível;
- Na **AWS**, com o **AWS Organizations** e as **organizational units (OUs)**, onde as **Service Control Policies (SCPs)** definem as permissões máximas permitidas em cada conta, e o **AWS Control Tower** empacota a landing zone;
- No **Google Cloud**, com a hierarquia de **organização, pastas e projetos** e as **Organization Policies**.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 330" role="img" aria-labelledby="gov-d3-title gov-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="gov-d3-title">Hierarquia de management groups e contas</title>
<desc id="gov-d3-desc">A raiz da organização, com os guardrails globais, se divide nos grupos Plataforma, Landing zones, Sandbox e Descomissionados. Landing zones se divide em Corp, para workloads privados, e Online, onde endpoints públicos são permitidos. Policies atribuídas mais acima são herdadas por tudo que está abaixo.</desc>
<text x="360" y="22" text-anchor="middle" class="d-label">AZURE MANAGEMENT GROUPS / AWS OUS / GCP FOLDERS</text>
<rect x="270" y="38" width="180" height="56" rx="10" class="d-box-accent"/>
<text x="360" y="62" text-anchor="middle" class="d-title">Raiz da organização</text>
<text x="360" y="82" text-anchor="middle" class="d-small">regiões, auditoria, logs</text>
<line x1="360" y1="94" x2="360" y2="117" class="d-line"/>
<line x1="95" y1="117" x2="620" y2="117" class="d-line"/>
<line x1="95" y1="117" x2="95" y2="140" class="d-line"/>
<line x1="270" y1="117" x2="270" y2="140" class="d-line"/>
<line x1="445" y1="117" x2="445" y2="140" class="d-line"/>
<line x1="620" y1="117" x2="620" y2="140" class="d-line"/>
<rect x="20" y="140" width="150" height="56" rx="10" class="d-box"/>
<text x="95" y="164" text-anchor="middle" class="d-title">Plataforma</text>
<text x="95" y="184" text-anchor="middle" class="d-small">identidade, rede</text>
<rect x="195" y="140" width="150" height="56" rx="10" class="d-box-info"/>
<text x="270" y="164" text-anchor="middle" class="d-title">Landing zones</text>
<text x="270" y="184" text-anchor="middle" class="d-small">base dos workloads</text>
<rect x="370" y="140" width="150" height="56" rx="10" class="d-box-warn"/>
<text x="445" y="164" text-anchor="middle" class="d-title">Sandbox</text>
<text x="445" y="184" text-anchor="middle" class="d-small">solto, com teto</text>
<rect x="545" y="140" width="150" height="56" rx="10" class="d-box-danger"/>
<text x="620" y="164" text-anchor="middle" class="d-title">Descomissionados</text>
<text x="620" y="184" text-anchor="middle" class="d-small">nega tudo</text>
<line x1="270" y1="196" x2="270" y2="222" class="d-line"/>
<line x1="180" y1="222" x2="360" y2="222" class="d-line"/>
<line x1="180" y1="222" x2="180" y2="248" class="d-line"/>
<line x1="360" y1="222" x2="360" y2="248" class="d-line"/>
<rect x="110" y="248" width="140" height="56" rx="10" class="d-box"/>
<text x="180" y="272" text-anchor="middle" class="d-title">Corp</text>
<text x="180" y="292" text-anchor="middle" class="d-small">só privado</text>
<rect x="290" y="248" width="140" height="56" rx="10" class="d-box"/>
<text x="360" y="272" text-anchor="middle" class="d-title">Online</text>
<text x="360" y="292" text-anchor="middle" class="d-small">público permitido</text>
<rect x="470" y="238" width="225" height="76" rx="10" class="d-box-muted"/>
<text x="582" y="264" text-anchor="middle" class="d-text">Atribua policies no alto,</text>
<text x="582" y="284" text-anchor="middle" class="d-text">elas descem por herança</text>
<text x="582" y="303" text-anchor="middle" class="d-small">contas novas já nascem conformes</text>
</svg>
</div>
<figcaption>Figura 3: Uma hierarquia típica, em que as policies descem do topo para todas as contas abaixo</figcaption>
</figure>

Algumas dicas de design para a hierarquia:

- **Organize por necessidades de governança, não pelo organograma.** Departamentos são reorganizados todo ano; a diferença entre "workloads privados" e "workloads expostos à internet" não muda. Se dois grupos têm as mesmas policies, provavelmente não precisam ser grupos separados.
- **Mantenha rasa.** Três ou quatro níveis costumam bastar. Hierarquias profundas dificultam entender qual policy vale onde.
- **Tenha uma sandbox.** Dê às pessoas um lugar pra experimentar com regras mais soltas e um limite rígido de orçamento. A alternativa são experimentos no cartão de crédito pessoal (lembra da história?).
- **Tenha um grupo de descomissionados.** Mover uma conta pra lá antes de excluir bloqueia tudo enquanto você confirma que ninguém ainda depende dela.
- **Automatize a criação de contas** (*subscription vending* ou *account vending*): um pedido num formulário ou num *pull request* gera uma conta nova, já no lugar certo da hierarquia, com rede e policies aplicadas. Esperar duas semanas por uma assinatura também é um portão.

## Policy as Code

Já falamos de Policy as Code em [Otimização de Custos](/pt-br/principles/cloud/cost-optimization/), com foco nos *guardrails* de custo (limites de SKU, tags obrigatórias, orçamentos). Aqui a visão é mais ampla: policy como código é o **mecanismo de aplicação** de todas as decisões de governança, incluindo segurança, *compliance*, residência de dados e operação.

A ideia é tratar as regras exatamente como software: escritas numa linguagem declarativa, versionadas no Git, revisadas em *pull requests*, testadas automaticamente e publicadas por um pipeline. Chega de regra que só existe num PDF.

### Onde as policies rodam

As policies podem agir em momentos diferentes, e um programa de governança maduro usa mais de um:

| Momento | O que faz | Exemplos de ferramentas |
| :--- | :--- | :--- |
| **No pipeline do desenvolvedor (*shift left*)** | Avalia o plano de IaC antes de qualquer coisa existir e quebra o build com uma mensagem clara. | OPA com Conftest, Checkov, tfsec / Trivy, Sentinel (Terraform) |
| **No plano de controle da nuvem (preventivo)** | Nega a chamada de API que criaria um recurso fora do padrão, não importa de onde ela venha. | Azure Policy (deny), AWS SCPs, GCP Organization Policies |
| **Na API do Kubernetes (*admission*)** | Rejeita manifestos que quebram as regras (containers privilegiados, imagens de registries não confiáveis). | OPA Gatekeeper, Kyverno |
| **Depois do fato (detectivo)** | Avalia continuamente o que já existe e sinaliza ou corrige o *drift*. | Azure Policy (audit, deployIfNotExists), regras do AWS Config, Security Hub, Defender for Cloud |

O pipeline dá feedback rápido; o plano de controle garante que ninguém dê a volta pelo portal ou pela CLI; a camada detectiva pega o que foi criado antes de a policy existir. Você quer as três.

Um pequeno exemplo, em Rego (a linguagem do OPA), avaliando um plano do Terraform no pipeline:

```rego
package terraform.storage

import rego.v1

deny contains msg if {
  some r in input.resource_changes
  r.type == "azurerm_storage_account"
  r.change.after.public_network_access_enabled == true
  msg := sprintf("%s: acesso de rede público não é permitido (veja o ADR-0017)", [r.address])
}
```

Repare na mensagem: ela diz o que está errado **e** aponta pra decisão por trás. Uma policy que só diz "negado" gera um ticket. Uma policy que se explica gera uma correção.

### O ciclo de vida de uma policy

Uma policy nunca é ligada em modo *deny* no primeiro dia. Esse é o caminho mais rápido pra quebrar a produção e fazer a empresa inteira odiar governança. O caminho saudável é mais ou menos assim:

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 740 240" role="img" aria-labelledby="gov-d4-title gov-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="gov-d4-title">Ciclo de vida de policy como código</title>
<desc id="gov-d4-desc">A policy é escrita no Git e revisada, testada no CI, publicada primeiro em modo auditoria para medir o impacto, depois aplicada negando ou corrigindo, e por fim gera evidência contínua de conformidade. Exceções com prazo de validade e os achados alimentam a próxima versão da policy.</desc>
<defs><marker id="gov-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="370" y="30" text-anchor="middle" class="d-label">CICLO DE VIDA DA POLICY AS CODE</text>
<rect x="15" y="60" width="126" height="70" rx="10" class="d-box"/>
<text x="78" y="90" text-anchor="middle" class="d-title">Escrever</text>
<text x="78" y="112" text-anchor="middle" class="d-small">no Git, revisada</text>
<rect x="161" y="60" width="126" height="70" rx="10" class="d-box"/>
<text x="224" y="90" text-anchor="middle" class="d-title">Testar no CI</text>
<text x="224" y="112" text-anchor="middle" class="d-small">testes, plan</text>
<rect x="307" y="60" width="126" height="70" rx="10" class="d-box-warn"/>
<text x="370" y="90" text-anchor="middle" class="d-title">Auditoria</text>
<text x="370" y="112" text-anchor="middle" class="d-small">mede o impacto</text>
<rect x="453" y="60" width="126" height="70" rx="10" class="d-box-accent"/>
<text x="516" y="90" text-anchor="middle" class="d-title">Aplicar</text>
<text x="516" y="112" text-anchor="middle" class="d-small">nega ou corrige</text>
<rect x="599" y="60" width="126" height="70" rx="10" class="d-box-info"/>
<text x="662" y="90" text-anchor="middle" class="d-title">Evidência</text>
<text x="662" y="112" text-anchor="middle" class="d-small">relatório contínuo</text>
<line x1="141" y1="95" x2="159" y2="95" class="d-line" marker-end="url(#gov-d4-arrow)"/>
<line x1="287" y1="95" x2="305" y2="95" class="d-line" marker-end="url(#gov-d4-arrow)"/>
<line x1="433" y1="95" x2="451" y2="95" class="d-line" marker-end="url(#gov-d4-arrow)"/>
<line x1="579" y1="95" x2="597" y2="95" class="d-line" marker-end="url(#gov-d4-arrow)"/>
<path d="M662,130 L662,180 L78,180 L78,132" fill="none" class="d-line-dashed" marker-end="url(#gov-d4-arrow)"/>
<text x="370" y="205" text-anchor="middle" class="d-small">achados e exceções vencendo alimentam a próxima versão</text>
</svg>
</div>
<figcaption>Figura 4: A policy passa por auditoria antes de ser aplicada, e seus resultados alimentam a própria evolução</figcaption>
</figure>

1. **Escrever:** a policy é escrita como código, com um link para o ADR ou o requisito que a justifica, e revisada num *pull request* por plataforma, segurança e pelo menos um time de produto.
2. **Testar:** testes unitários com exemplos conformes e não conformes, rodando no CI. Sim, policies também têm bugs.
3. **Modo auditoria:** a policy é publicada só pra reportar. Por algumas semanas, você mede quantos recursos seriam bloqueados e conversa com os donos. É comum descobrir que a regra estava ampla demais.
4. **Aplicar:** só então ela passa para *deny* (ou para correção automática, quando isso for seguro). Os times foram avisados, o caminho de migração está documentado e os módulos da via pavimentada já estão conformes.
5. **Evidência:** o estado de conformidade é coletado continuamente e vira dashboard e relatório, o que fecha o ciclo.

## Exceções Com Prazo de Validade

Por melhores que sejam as suas policies, vão existir casos legítimos que não se encaixam: um sistema legado que não dá pra migrar neste trimestre, um produto de fornecedor que exige endpoint público, uma prova de conceito com prazo apertado. Fingir que exceções não existem é o caminho pra acabar com aquela conta de admin "temporária" de 2019.

A resposta é um **processo de exceção**, tão formal e automatizado quanto as próprias policies:

- **Solicitada por escrito**, com a justificativa, o risco aceito e os controles compensatórios (por exemplo, "endpoint público, mas atrás de um WAF com allowlist de IPs");
- **Aprovada pelo papel responsável**, conforme o RACI (normalmente segurança, para policies de segurança, e não o gestor de quem pediu);
- **Com o escopo mais restrito possível:** um recurso, não a assinatura inteira;
- **Com data de expiração obrigatória.** As *exemptions* da Azure Policy têm o campo `expiresOn`; com SCPs e OPA dá pra modelar o mesmo no código. Quando a data chega, a exceção some sozinha, e renovar exige uma nova justificativa;
- **Visível:** todas as exceções ativas num só lugar, com donos e datas de expiração, revisadas periodicamente.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Não seria mais fácil pedir pro admin desligar a policy rapidinho, fazer o deploy e ligar de novo?"</span>
    </div>
  </div>
</div>

Seria mais fácil, Júnior, assim como é mais fácil arrancar o detector de fumaça porque ele apita quando você faz torrada. O problema é que "depois eu ligo de novo" é uma frase com taxa de conclusão baixíssima. E enquanto ela está desligada, está desligada pra **todo mundo**, não só pra você. Uma exceção com escopo restrito e prazo de validade te dá exatamente o que você precisa, pelo tempo que você precisa, e deixa um rastro explicando o porquê.

<div class="callout tip">
  <p>Acompanhe a lista de exceções como um sinal. Se a mesma policy acumula muitas exceções, o problema provavelmente é a policy (ampla demais, ou sem alternativa viável na via pavimentada), e não os times. Exceção é feedback, não só papelada.</p>
</div>

## Automação de Compliance e Evidência Contínua

Lembra do desespero na semana anterior à auditoria? Isso acontece porque a evidência é coletada **de forma manual e periódica**: prints de tela, planilhas exportadas, e-mails perguntando "você confirma que a criptografia está habilitada?". É lento, sujeito a erro e, pior de tudo, só prova que as coisas estavam certas **no dia em que o print foi tirado**.

A conformidade contínua inverte isso:

- **Os controles são mapeados para policies.** Cada requisito do framework que você segue (ISO 27001, SOC 2, PCI DSS, LGPD, normas internas) aponta para uma ou mais policies automatizadas. A Azure Policy e o AWS Security Hub já trazem iniciativas prontas mapeadas para vários desses frameworks;
- **O estado é coletado o tempo todo.** A camada detectiva avalia cada recurso continuamente, e o resultado fica guardado com data e hora;
- **Evidência é uma consulta, não um projeto.** Quando o auditor pergunta, você mostra o histórico de conformidade do período, as exceções com suas aprovações e os ADRs por trás das regras;
- **As mudanças são rastreáveis.** Como policies e infraestrutura estão no Git, "quem mudou essa regra, quando e por quê" é respondido pelo histórico de commits e pelo *pull request*.

Isso não elimina o auditor, e não cobre tudo (processos como revisão de acessos ou treinamentos ainda precisam de evidência humana). Mas transforma a auditoria de uma escavação arqueológica numa conversa baseada em dados. Para o lado de risco dessa conversa (apetite, registros, tratamento), veja [Gestão de Riscos](/pt-br/principles/enterprise/risk-management/).

## Medindo a Governança

Se você não mede a governança, não tem como saber se ela está ajudando ou só atrapalhando. E cuidado: medir só conformidade incentiva o comitê que bloqueia tudo (100% de conformidade, 0% de entrega). Você precisa de métricas dos **dois** lados, controle e fluxo.

| Métrica | O que ela mostra | Fique de olho |
| :--- | :--- | :--- |
| **Taxa de conformidade** (recursos conformes / recursos avaliados, por policy) | O quanto as regras estão sendo seguidas na prática. | Uma taxa alta com poucas policies pode significar que você está medindo as coisas erradas. |
| **Tempo até a aprovação** (do pedido à decisão, para ADRs, exceções, contas novas) | Se a governança é uma estrada ou uma fila. | A mediana esconde a cauda longa; olhe o percentil 90 também. |
| **Adoção da via pavimentada** (% de workloads usando os módulos e templates oficiais) | Se o caminho fácil é de fato o caminho fácil. | Adoção baixa é problema de produto do time de plataforma. |
| **Exceções ativas e sua idade** | Quanto risco foi aceito, e se ele está sendo pago. | Exceção renovada várias vezes é exceção permanente disfarçada. |
| **Tempo para corrigir achados** | Com que velocidade o *drift* é corrigido depois de detectado. | Separe por severidade; crítico e baixo não devem ter a mesma meta. |
| **Decisões escaladas ao fórum por mês** | Se os direitos de decisão estão bem distribuídos. | Muitas indicam falta de autonomia; zero pode significar que ninguém pergunta. |

<div class="callout info">
  <p>Uma boa estrela-guia para a governança: <strong>tempo até produção conforme</strong>. Quanto tempo um time novo, partindo do zero, leva pra ter um serviço rodando em produção que já atende todas as policies? Em organizações com boas vias pavimentadas, isso se mede em horas ou dias. Na história do comitê mensal, se media em trimestres.</p>
</div>

## Princípios de Design para Governança

Juntando tudo, estas são as práticas que fazem da governança um acelerador em vez de um freio.

### 1. Codifique as regras, não apenas publique

**Meta:** toda regra de governança que pode ser verificada por uma máquina é verificada por uma máquina.

| Abordagem | Benefício |
| :--- | :--- |
| **Escreva policies como código, versionadas e revisadas no Git.** | As regras ficam testáveis, rastreáveis e auditáveis, com histórico de quem mudou o quê e por quê. |
| **Aplique em mais de uma camada** (pipeline, plano de controle, detectiva). | Feedback rápido para os devs, nada de dar a volta pelo portal e *drift* pego depois do fato. |
| **Publique em modo auditoria antes do deny.** | Você descobre o impacto real antes de quebrar alguém, e os times têm tempo de se adaptar. |

### 2. Faça do caminho conforme o caminho mais fácil

**Meta:** os times seguem as regras porque é o menor esforço, não porque têm medo.

| Abordagem | Benefício |
| :--- | :--- |
| **Ofereça vias pavimentadas (módulos, templates, landing zones) conformes por padrão.** | A maioria dos workloads nunca precisa de revisão, e a conformidade vem de graça. |
| **Automatize o provisionamento de contas e ambientes.** | Remove um dos portões escondidos mais comuns e a tentação de usar contas pessoais. |
| **Trate a plataforma como produto, com feedback de quem usa.** | As vias pavimentadas continuam atuais e realmente melhores que as alternativas. |

### 3. Leve as decisões para onde está a informação

**Meta:** as decisões são tomadas no nível mais baixo que tenha contexto e responsabilidade suficientes.

| Abordagem | Benefício |
| :--- | :--- |
| **Classifique as decisões por raio de impacto e reversibilidade.** | Só as portas de mão única recebem deliberação pesada; todo o resto é rápido. |
| **Deixe os direitos de decisão explícitos com RACI, um "A" por atividade.** | Acabou o "achei que era você que decidia isso". |
| **Troque o comitê de aprovação por um fórum de conselho, assíncrono e com prazo.** | Mantém a contribuição dos especialistas sem criar uma fila. |

### 4. Registre as decisões por escrito

**Meta:** a organização lembra por que fez o que fez.

| Abordagem | Benefício |
| :--- | :--- |
| **Registre as decisões significativas como ADRs no repositório.** | O contexto sobrevive à rotatividade do time, e quem chega entende o sistema mais rápido. |
| **Ligue as policies aos ADRs que as motivaram.** | Quem for bloqueado por uma regra encontra o motivo e pode contestá-la do jeito certo. |
| **Substitua, não edite.** | O histórico de decisões vira uma ferramenta de aprendizado. |

### 5. Trate exceções como cidadãs de primeira classe

**Meta:** desvios são permitidos, visíveis, limitados e temporários.

| Abordagem | Benefício |
| :--- | :--- |
| **Exija justificativa, controles compensatórios e data de expiração.** | O risco aceito é consciente e tem fim. |
| **Mantenha as exceções em código, junto das policies.** | Auditáveis e revisadas como qualquer outra mudança. |
| **Revise periodicamente as tendências de exceções.** | Exceções recorrentes revelam policies que precisam mudar. |

### 6. Meça controle e fluxo

**Meta:** a governança é julgada pelo que ela protege **e** pelo que ela viabiliza.

| Abordagem | Benefício |
| :--- | :--- |
| **Acompanhe a taxa de conformidade e o tempo até a aprovação juntos.** | Evita otimizar um às custas do outro. |
| **Colete evidência continuamente.** | Auditorias viram rotina, e os problemas aparecem em dias, não na próxima revisão anual. |
| **Revisite as policies que ninguém disparou em um ano.** | Mantém o conjunto de regras enxuto; regra morta é ruído. |

## Tradeoffs

A governança é, no fundo, um equilíbrio entre duas coisas que a organização quer ao mesmo tempo: **controle** (consistência, segurança, conformidade) e **autonomia** (velocidade, inovação, senso de dono). Não existe uma configuração que maximize as duas. Cada regra que você adiciona compra um pouco de controle com um pouco de autonomia, e o trabalho do arquiteto é fazer essa troca de propósito.

### Controle vs autonomia

Controle demais e você ganha o comitê mensal: os times param de propor, começam a contornar, e os melhores engenheiros vão embora pra lugares onde podem decidir as coisas. Autonomia demais e você ganha fragmentação: cada time com sua própria stack, nenhum aprendizado compartilhado, esforço duplicado e segurança inconsistente. O modelo de guardrails tenta pegar o melhor dos dois sendo **rígido nos resultados** (dados precisam ser criptografados, serviços internos não podem ser públicos) e **flexível nos meios** (use a linguagem ou o framework que quiser, dentro da estrada).

### Velocidade vs conformidade

Toda checagem custa tempo, até as automáticas. Um pipeline com vinte scanners de policy que leva quarenta minutos também é um portão, só que robotizado. Mantenha as checagens rápidas, coloque as baratas primeiro e não bloqueie o build por achados de baixa severidade que podem ser acompanhados em vez disso.

### Tradeoffs com Excelência Operacional (Operational Excellence)

Policies e landing zones são mais infraestrutura pra manter: código, testes, pipelines, versões, documentação. O time de plataforma vira uma dependência, e se ele estiver subdimensionado, a via pavimentada apodrece e vira gargalo. Por outro lado, governança bem feita **reduz** a variância operacional, que é exatamente o que a [Excelência Operacional](/pt-br/principles/cloud/operational-excellence/) busca.

### Tradeoffs com Confiabilidade (Reliability)

Uma policy de *deny* com bug pode bloquear deploys legítimos, inclusive correções de emergência durante um incidente. A correção automática pode alterar recursos em produção de jeitos que ninguém esperava. Mitigue com modo auditoria, rollout gradual das policies (um management group por vez) e um procedimento de *break-glass* documentado, rápido e, ele mesmo, auditado.

### Tradeoffs com Segurança (Security)

A governança é uma das melhores aliadas da segurança, mas pode criar uma falsa sensação de proteção: "temos 100% de conformidade" só significa que você cumpre as regras que escreveu. Além disso, as permissões necessárias pra gerenciar policies e exceções são extremamente poderosas e precisam ser protegidas como qualquer outro acesso privilegiado. Para os controles em si, veja [Segurança](/pt-br/principles/cloud/security/) e [Security Shift Left](/pt-br/principles/solution/security-shift-left/).

### Tradeoffs com Otimização de Custos (Cost Optimization)

Landing zones vêm com componentes compartilhados (redes hub, firewalls, logs centralizados, ferramentas de segurança) que custam dinheiro antes mesmo do primeiro workload pousar. Conformidade contínua significa avaliação contínua e retenção de logs. Normalmente sai mais barato que um incidente ou uma auditoria reprovada, mas não é de graça, e organizações pequenas devem dimensionar a fundação para a sua realidade em vez de copiar um blueprint de grande empresa.

### Tradeoffs com Eficiência de Performance (Performance Efficiency)

Algumas regras têm custo direto de performance: forçar o tráfego por um firewall central adiciona latência; restringir regiões pode deixar os dados longe dos usuários; criptografia obrigatória com chaves gerenciadas pelo cliente adiciona chamadas ao cofre de chaves. Muitas vezes são as escolhas certas, mas devem ser feitas de forma consciente, com os números na mesa.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Então não existe uma quantidade perfeita de governança? Como eu sei se a gente tem demais ou de menos?"</span>
    </div>
  </div>
</div>

Exatamente, Júnior, não existe quantidade perfeita, e ela muda conforme a empresa cresce. Olhe os sinais: se os times estão contornando o processo, se as aprovações levam semanas e a lista de exceções só cresce, você tem governança demais (ou do tipo errado). Se toda análise de incidente termina com "cada time fez de um jeito" e ninguém consegue responder o auditor, você tem de menos. As métricas da seção anterior existem justamente pra mostrar pra que lado você está pendendo, e os ADRs deixam você ajustar o rumo sem esquecer por que chegou até aqui.

## Conclusão

**Governança** não é o comitê que diz não. É o conjunto de mecanismos que permite a uma organização tomar boas decisões de forma consistente, lembrar delas e aplicá-las automaticamente na escala de dezenas ou centenas de times. Quando funciona, a maioria das pessoas mal percebe: elas usam a via pavimentada, as policies as mantêm longe de encrenca em silêncio, e a rara decisão difícil recebe o conselho de especialistas em dias, não em meses.

A virada é de **portões para guardrails**: de pessoas lendo documentos uma vez por mês para policies avaliando cada mudança em segundos; de permissão para conselho; de decisões verbais para ADRs; de exceções permanentes para exceções com prazo de validade; de auditorias no desespero para evidência contínua.

E como todo princípio, a governança não elimina os tradeoffs. Controle e autonomia, velocidade e conformidade, sempre vão puxar para lados opostos. A boa governança deixa essa tensão explícita, mede e ajusta ao longo do tempo, alinhada ao que o negócio realmente precisa (veja [Alinhamento com o Negócio](/pt-br/principles/enterprise/business-alignment/)).

## Próximos Passos

1. **Mapeie os direitos de decisão**
Liste as decisões de arquitetura recorrentes e classifique por raio de impacto e reversibilidade. Monte um RACI com um único papel responsável pelo resultado em cada atividade, e empurre para os times tudo o que der.

2. **Comece a escrever ADRs**
Escolha um template, crie uma pasta nos repositórios e registre a próxima decisão significativa. Não tente documentar o passado de uma vez; comece agora e só resgate as decisões sobre as quais as pessoas vivem perguntando.

3. **Codifique as cinco regras mais importantes**
Escolha as regras que mais importam (regiões permitidas, criptografia, nada de armazenamento de dados público, tags obrigatórias, logs) e transforme em policies. Publique em modo auditoria, meça, converse com os donos e só então aplique.

4. **Construa a fundação**
Organize a hierarquia de management groups, OUs ou pastas por necessidades de governança, crie uma sandbox e automatize o provisionamento de contas com landing zones conformes por padrão.

5. **Formalize as exceções**
Crie um processo leve e por escrito, com justificativa, controles compensatórios, aprovação pelo papel responsável e data de expiração obrigatória. Deixe a lista de exceções ativas visível.

6. **Transforme o comitê de revisão**
Mude para conselho assíncrono e com prazo, só para portas de mão única, e faça com que ele alimente a via pavimentada, pra mesma pergunta nunca precisar ser feita duas vezes.

7. **Meça controle e fluxo**
Acompanhe juntos a taxa de conformidade, o tempo até a aprovação, a adoção da via pavimentada e a idade das exceções, e revise regularmente com os times.

<div class="callout info" data-title="Referências">
  <ul>
    <li><a href="https://learn.microsoft.com/azure/cloud-adoption-framework/govern/" target="_blank" rel="noopener">Microsoft Cloud Adoption Framework: Govern</a></li>
    <li><a href="https://learn.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/" target="_blank" rel="noopener">Microsoft Cloud Adoption Framework: Azure landing zones</a></li>
    <li><a href="https://learn.microsoft.com/azure/governance/policy/overview" target="_blank" rel="noopener">Visão geral da Azure Policy</a></li>
    <li><a href="https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html" target="_blank" rel="noopener">AWS Organizations: Service control policies</a></li>
    <li><a href="https://aws.amazon.com/controltower/" target="_blank" rel="noopener">AWS Control Tower</a></li>
    <li><a href="https://aws.amazon.com/architecture/well-architected/" target="_blank" rel="noopener">AWS Well-Architected Framework</a></li>
    <li><a href="https://www.openpolicyagent.org/" target="_blank" rel="noopener">Open Policy Agent (OPA)</a></li>
    <li><a href="https://open-policy-agent.github.io/gatekeeper/" target="_blank" rel="noopener">OPA Gatekeeper</a></li>
    <li><a href="https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions" target="_blank" rel="noopener">Michael Nygard: Documenting Architecture Decisions</a></li>
    <li><a href="https://adr.github.io/" target="_blank" rel="noopener">Architecture Decision Records (adr.github.io)</a></li>
    <li><a href="https://martinfowler.com/articles/scaling-architecture-conversationally.html" target="_blank" rel="noopener">Andrew Harmel-Law: Scaling the Practice of Architecture, Conversationally</a></li>
    <li><a href="https://www.opengroup.org/togaf" target="_blank" rel="noopener">The Open Group: TOGAF Standard</a></li>
  </ul>
</div>
