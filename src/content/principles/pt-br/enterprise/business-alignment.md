---
title: Alinhamento com o negócio
short: "Arquitetura que não mexe em nenhum indicador de negócio é só um hobby caro: toda capacidade, sistema e decisão precisa se ligar a um resultado que alguém realmente valoriza."
category: enterprise
---

## Introdução

Vamos começar com uma verdade incômoda: **o negócio não liga para a sua arquitetura**. Ele liga para vender mais, gastar menos, reter clientes, entrar em novos mercados, estar em conformidade e não aparecer na capa do jornal pelos motivos errados. A arquitetura só importa na medida em que torna essas coisas possíveis, mais rápidas, mais baratas ou mais seguras.

A **meta** deste princípio é simples de falar e difícil de praticar: **toda decisão de arquitetura deve ser rastreável até um objetivo de negócio, e o seu impacto deve ser mensurável em termos de negócio**. Não em termos de "migramos para microsserviços", mas em termos de "reduzimos o tempo de *onboarding* de dez dias para dois, e o *churn* no primeiro mês caiu um terço".

Quando uma organização ignora o alinhamento com o negócio, os sintomas aparecem rápido. É comum ver:

- Times de arquitetura produzindo diagramas lindos que ninguém fora do time jamais abre;
- *Roadmaps* de tecnologia que não citam um único objetivo de negócio;
- Grandes iniciativas de plataforma sem um dono claro do lado do negócio e sem critério de sucesso;
- Vários sistemas fazendo a mesma coisa em departamentos diferentes, cada um "estratégico" para alguém;
- Orçamento cortado exatamente onde a empresa precisava investir, porque ninguém soube explicar o valor;
- Áreas de negócio contratando as próprias ferramentas SaaS escondidas da TI (olá, *shadow IT*), porque "a TI demora demais";
- Uma sensação permanente de que tecnologia é centro de custo, e não parceira;

Pois é, *é raro, mas acontece bastante*... Quem nunca participou de um comitê executivo em que o CTO apresenta um slide cheio de siglas e a única pergunta do CFO é "tá, mas quanto isso dá de retorno?". Silêncio. Todo mundo olha para o arquiteto.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Mas esse papo de negócio não é problema do Product Manager? Eu achava que arquiteto só escolhia a tecnologia certa e desenhava as caixinhas."</span>
    </div>
  </div>
</div>

Calma aí, Júnior! Escolher tecnologia e desenhar caixinhas faz parte do trabalho, mas isso é o *como*. O *porquê* vem do negócio, e um arquiteto que não entende o porquê está chutando. Pior: está chutando com o dinheiro da empresa.

Pensa assim: o Product Manager decide *o que* construir em um produto. O arquiteto corporativo ajuda a organização a decidir *quais capacidades* ela precisa para executar a estratégia, *onde investir* em tecnologia e *o que parar de fazer*. Os dois precisam falar a língua do negócio. A diferença está no escopo: um produto versus o portfólio inteiro.

<div class="callout info">
  <p>Alinhamento com o negócio não significa que a arquitetura obedece cegamente a todo pedido que chega. Significa que arquitetura e negócio compartilham os mesmos objetivos, o mesmo vocabulário e o mesmo placar. Às vezes, a coisa mais alinhada que um arquiteto pode fazer é dizer "não, e aqui está por que isso prejudicaria o objetivo que vocês mais valorizam".</p>
</div>

## A Arquitetura Linda que Ninguém Pediu

Deixa eu contar uma história. Nomes trocados para proteger os inocentes (e os culpados).

Um varejista de porte médio tinha um problema: os clientes estavam abandonando o *checkout* em uma taxa alarmante, e os números apontavam para páginas lentas e um fluxo de pagamento que falhava silenciosamente. O objetivo de negócio era cristalino: **reduzir o abandono no checkout**.

O time de engenharia recebeu o orçamento. Dezoito meses depois, apresentou orgulhoso o resultado: uma plataforma orientada a eventos com *service mesh*, um cluster Kubernetes autogerenciado, um portal interno de desenvolvedores novinho em folha, CQRS em todos os serviços (inclusive no que guardava o horário de funcionamento das lojas) e um *data lake* "para uso futuro". Os diagramas eram maravilhosos. As palestras em eventos fizeram sucesso. Três pessoas receberam ótimas propostas de emprego.

E o abandono no checkout? **Praticamente igual.** O fluxo de pagamento continuava falhando em silêncio, porque ninguém priorizou a correção sem graça: um tratamento de erro decente e um *retry* com o provedor de pagamento. Essa correção levaria três semanas.

Isso tem nome: **resume-driven development**, ou desenvolvimento orientado a currículo. É quando as escolhas de tecnologia são guiadas pelo que fica bonito no LinkedIn ou num *meetup*, e não pelo que o negócio precisa. Raramente é por maldade. Engenheiros adoram aprender, e tecnologia nova é empolgante de verdade. Mas quando ninguém ancora as decisões em um objetivo, a arquitetura deriva para o que é interessante em vez do que é valioso.

Os sinais de que você está indo por esse caminho:

- A definição do problema fala de tecnologia ("precisamos de Kafka") em vez de um resultado de negócio ("os pedidos precisam chegar ao armazém em menos de um minuto");
- Ninguém sabe dizer qual indicador vai melhorar, nem quanto;
- A solução é dimensionada para uma escala que a empresa não vai atingir nos próximos cinco anos;
- A primeira entrega de valor está prevista para a "fase 3";
- As pessoas mais empolgadas com o projeto são as que vão construí-lo, não as que vão usá-lo.

<div class="callout warning" data-title="Red flag">
  <p>Se você não consegue explicar, em uma frase e sem siglas, qual resultado de negócio uma iniciativa move, você não tem uma iniciativa de arquitetura. Você tem um hobby com orçamento.</p>
</div>

## Da Estratégia à Execução: Rastreabilidade

E como evitar a arquitetura linda que ninguém pediu? Construindo uma **cadeia de rastreabilidade** que liga a estratégia até a tecnologia, e de volta.

O **TOGAF**, *framework* de arquitetura corporativa do The Open Group, organiza a arquitetura em quatro domínios: **negócio**, **dados**, **aplicação** e **tecnologia**. Acima deles fica a estratégia: os objetivos e resultados que a organização persegue. A ideia é que cada camada existe para servir à camada de cima.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 410" role="img" aria-labelledby="biz-d1-title biz-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="biz-d1-title">Rastreabilidade da estratégia à tecnologia</title>
<desc id="biz-d1-desc">Cinco camadas empilhadas: estratégia, negócio, dados, aplicação e tecnologia. Uma seta descendo explica como cada camada é realizada, e uma seta subindo explica por que cada camada existe.</desc>
<defs><marker id="biz-d1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-accent"/></marker></defs>
<text x="310" y="26" text-anchor="middle" class="d-label">CADEIA DE RASTREABILIDADE</text>
<rect x="60" y="50" width="500" height="56" rx="10" class="d-box-accent"/>
<text x="80" y="82" class="d-label">ESTRATÉGIA</text>
<text x="350" y="74" text-anchor="middle" class="d-title">Objetivos e resultados</text>
<text x="350" y="94" text-anchor="middle" class="d-small">aumentar receita recorrente, churn em 3%</text>
<rect x="60" y="120" width="500" height="56" rx="10" class="d-box-info"/>
<text x="80" y="152" class="d-label">NEGÓCIO</text>
<text x="350" y="144" text-anchor="middle" class="d-title">Capacidades e fluxos de valor</text>
<text x="350" y="164" text-anchor="middle" class="d-small">Retenção, Faturamento, Onboarding</text>
<rect x="60" y="190" width="500" height="56" rx="10" class="d-box"/>
<text x="80" y="222" class="d-label">DADOS</text>
<text x="350" y="214" text-anchor="middle" class="d-title">Informação e responsáveis</text>
<text x="350" y="234" text-anchor="middle" class="d-small">visão 360 do cliente, eventos de uso, contratos</text>
<rect x="60" y="260" width="500" height="56" rx="10" class="d-box"/>
<text x="80" y="292" class="d-label">APLICAÇÃO</text>
<text x="350" y="284" text-anchor="middle" class="d-title">Sistemas e serviços</text>
<text x="350" y="304" text-anchor="middle" class="d-small">CRM, faturamento, modelo de churn</text>
<rect x="60" y="330" width="500" height="56" rx="10" class="d-box"/>
<text x="80" y="362" class="d-label">TECNOLOGIA</text>
<text x="350" y="354" text-anchor="middle" class="d-title">Plataformas e infraestrutura</text>
<text x="350" y="374" text-anchor="middle" class="d-small">nuvem, plataforma de dados, integração</text>
<text x="615" y="42" text-anchor="middle" class="d-label">COMO</text>
<line x1="615" y1="54" x2="615" y2="380" class="d-line-accent" marker-end="url(#biz-d1-arrow)"/>
<line x1="675" y1="380" x2="675" y2="54" class="d-line-accent" marker-end="url(#biz-d1-arrow)"/>
<text x="675" y="402" text-anchor="middle" class="d-label">POR QUÊ</text>
</svg>
</div>
<figcaption>Figura 1: Lendo de cima para baixo você descobre como um objetivo é realizado; de baixo para cima, por que um sistema existe</figcaption>
</figure>

A mágica dessa cadeia é que ela funciona nas duas direções:

- **De cima para baixo (como?):** "Queremos reduzir o *churn* para 3%. Quais capacidades fazem isso acontecer? Retenção de Clientes. Que dados ela precisa? Uma visão unificada do cliente e eventos de uso. Quais aplicações a suportam? O CRM e um modelo de previsão de *churn*. Em que tecnologia elas rodam? Na nossa plataforma de dados em nuvem."
- **De baixo para cima (por quê?):** "Por que pagamos por essa plataforma de dados? Porque ela alimenta o modelo de *churn*. Por que precisamos do modelo? Porque ele suporta a Retenção de Clientes. E por que isso importa? Porque retenção é um dos três objetivos estratégicos do ano."

Se você pegar qualquer componente do seu ambiente e a cadeia de "por quê?" quebrar antes de chegar a um objetivo de negócio, você encontrou **desperdício** ou **valor não documentado**. Os dois merecem atenção. O primeiro é candidato à [racionalização de portfólio](/pt-br/principles/enterprise/portfolio-rationalization/); o segundo é um risco, porque tudo cujo valor ninguém sabe explicar é a primeira coisa a ser cortada numa crise de orçamento.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Então eu preciso escrever um documento TOGAF com cinco camadas toda vez que quiser colocar uma fila no meu serviço?"</span>
    </div>
  </div>
</div>

Não, Júnior, pelo amor de Deus! Ninguém quer um documento de 90 páginas por causa de uma fila. Rastreabilidade é sobre **conseguir responder à pergunta**, não sobre produzir papelada. Para uma fila, uma linha no seu *Architecture Decision Record* (ADR) basta: "Suporta a capacidade de Atendimento de Pedidos; necessária para que os pedidos cheguem ao armazém em menos de um minuto (KPI: latência pedido-armazém)". Isso é rastreabilidade. O TOGAF te dá o vocabulário e um mapa; você escolhe quanta cerimônia o seu contexto precisa.

## Capacidades de Negócio: a Pedra de Roseta do Arquiteto

Se existe uma ferramenta que mudou a forma como eu converso com o pessoal de negócio, é o **mapa de capacidades de negócio** (*business capability map*).

Uma **capacidade de negócio** é *o que* a organização faz, independentemente de *como* faz, *quem* faz ou *qual sistema* suporta. "Gerir Onboarding de Clientes", "Processar Pagamentos", "Planejar Estoque", "Tratar Sinistros". Capacidades são impressionantemente estáveis: um banco "concede crédito" há séculos, mesmo que os processos, as pessoas e os sistemas por trás tenham mudado completamente.

É justamente essa estabilidade que torna as capacidades tão úteis. O organograma muda todo ano, processos são redesenhados, sistemas são substituídos, mas o mapa de capacidades continua reconhecível. Ele vira uma **linguagem comum**: o negócio entende porque descreve o que ele faz, e a tecnologia consegue mapear sistemas, dados e custos em cima dele.

### Montando um mapa de capacidades

Algumas regras práticas que aprendi (às vezes do jeito difícil):

1. **Nomeie capacidades como ações ou substantivos de negócio**, nunca como sistemas ("Onboarding de Clientes", e não "Salesforce").
2. **Mantenha poucos níveis.** O nível 1 são grandes domínios (Cliente, Operações, Finanças), o nível 2 são as capacidades onde acontece a maior parte das conversas, e o nível 3 só onde precisar de detalhe.
3. **Não modele o organograma.** Se uma capacidade é compartilhada por três departamentos, ela aparece uma vez só.
4. **Construa junto com o negócio**, em *workshops*, e não sozinho numa sala. Um mapa de capacidades que o negócio não reconhece não serve para nada.
5. **Busque caber em uma página.** Se no nível 2 ele não cabe em uma tela, está detalhado demais para guiar decisões.

### Heat maps: para onde o dinheiro deve ir

Um mapa de capacidades sozinho é um pôster bonito. Ele vira ferramenta de decisão quando você **pinta ele**. Um *heat map* sobrepõe uma avaliação em cada capacidade: importância estratégica, maturidade atual, custo, risco, dor do cliente, dívida técnica. A combinação de "estrategicamente importante" com "mal suportada" é onde o investimento deve ir.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 340" role="img" aria-labelledby="biz-d2-title biz-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="biz-d2-title">Exemplo de heat map de capacidades</title>
<desc id="biz-d2-desc">Três domínios de negócio, Cliente, Operações e Finanças, cada um com três capacidades coloridas pela avaliação: saudável, estratégica porém fraca, lacuna crítica ou commodity.</desc>
<text x="360" y="26" text-anchor="middle" class="d-label">HEAT MAP DE CAPACIDADES</text>
<rect x="30" y="46" width="200" height="40" rx="10" class="d-box-info"/>
<text x="130" y="71" text-anchor="middle" class="d-title">Cliente</text>
<rect x="260" y="46" width="200" height="40" rx="10" class="d-box-info"/>
<text x="360" y="71" text-anchor="middle" class="d-title">Operações</text>
<rect x="490" y="46" width="200" height="40" rx="10" class="d-box-info"/>
<text x="590" y="71" text-anchor="middle" class="d-title">Finanças</text>
<rect x="30" y="100" width="200" height="52" rx="10" class="d-box-warn"/>
<text x="130" y="122" text-anchor="middle" class="d-text">Onboarding de Clientes</text>
<text x="130" y="140" text-anchor="middle" class="d-small">estratégica, fraca</text>
<rect x="30" y="164" width="200" height="52" rx="10" class="d-box-danger"/>
<text x="130" y="186" text-anchor="middle" class="d-text">Retenção de Clientes</text>
<text x="130" y="204" text-anchor="middle" class="d-small">lacuna crítica</text>
<rect x="30" y="228" width="200" height="52" rx="10" class="d-box-accent"/>
<text x="130" y="250" text-anchor="middle" class="d-text">Atendimento ao Cliente</text>
<text x="130" y="268" text-anchor="middle" class="d-small">saudável</text>
<rect x="260" y="100" width="200" height="52" rx="10" class="d-box-accent"/>
<text x="360" y="122" text-anchor="middle" class="d-text">Gestão de Pedidos</text>
<text x="360" y="140" text-anchor="middle" class="d-small">saudável</text>
<rect x="260" y="164" width="200" height="52" rx="10" class="d-box-warn"/>
<text x="360" y="186" text-anchor="middle" class="d-text">Planejamento de Estoque</text>
<text x="360" y="204" text-anchor="middle" class="d-small">estratégica, fraca</text>
<rect x="260" y="228" width="200" height="52" rx="10" class="d-box-muted"/>
<text x="360" y="250" text-anchor="middle" class="d-text">Rastreamento Logístico</text>
<text x="360" y="268" text-anchor="middle" class="d-small">commodity</text>
<rect x="490" y="100" width="200" height="52" rx="10" class="d-box-danger"/>
<text x="590" y="122" text-anchor="middle" class="d-text">Faturamento e Cobrança</text>
<text x="590" y="140" text-anchor="middle" class="d-small">lacuna crítica</text>
<rect x="490" y="164" width="200" height="52" rx="10" class="d-box-muted"/>
<text x="590" y="186" text-anchor="middle" class="d-text">Relatórios Financeiros</text>
<text x="590" y="204" text-anchor="middle" class="d-small">commodity</text>
<rect x="490" y="228" width="200" height="52" rx="10" class="d-box-muted"/>
<text x="590" y="250" text-anchor="middle" class="d-text">Folha de Pagamento</text>
<text x="590" y="268" text-anchor="middle" class="d-small">commodity</text>
<rect x="40" y="306" width="16" height="16" rx="3" class="d-fill-accent"/>
<text x="64" y="319" class="d-small">Saudável, manter</text>
<rect x="210" y="306" width="16" height="16" rx="3" class="d-fill-warn"/>
<text x="234" y="319" class="d-small">Estratégica, investir</text>
<rect x="390" y="306" width="16" height="16" rx="3" class="d-fill-danger"/>
<text x="414" y="319" class="d-small">Lacuna crítica</text>
<rect x="560" y="306" width="16" height="16" rx="3" class="d-fill-muted"/>
<text x="584" y="319" class="d-small">Commodity, comprar</text>
</svg>
</div>
<figcaption>Figura 2: Um heat map transforma o mapa de capacidades em uma conversa sobre investimento</figcaption>
</figure>

Repara no que essa figura faz numa reunião. Ninguém precisa entender de Kubernetes para ver que Retenção de Clientes está vermelha justamente quando é um dos objetivos do ano. Ninguém precisa saber o que é um módulo de ERP para concordar que Folha de Pagamento é *commodity*: ela precisa funcionar, precisa estar em conformidade, mas nenhum cliente jamais escolheu a sua empresa por causa do sistema de folha. **Compre, padronize e siga em frente.** Guarde a engenharia sob medida para as capacidades que diferenciam você.

Esse último ponto é o coração da questão: **capacidades diferenciadoras** merecem soluções customizadas, experimentação e as suas melhores pessoas; **capacidades commodity** merecem produtos de prateleira, [padronização](/pt-br/principles/enterprise/standardization/) e o mínimo de customização. O desenvolvimento orientado a currículo costuma fazer exatamente o contrário: um *framework* artesanal para reembolso de despesas e uma planilha rodando o motor de precificação.

### Fluxos de valor: capacidades em movimento

As capacidades dizem *o que* a organização consegue fazer. Os **fluxos de valor** (*value streams*) mostram *como o valor chega* a um cliente ou *stakeholder*, etapa por etapa. "Adquirir cliente", "Entregar pedido", "Resolver sinistro" são fluxos de valor; cada etapa é habilitada por uma ou mais capacidades.

Por que usar os dois? Porque os fluxos de valor revelam onde o cliente realmente sente a dor. Se "Entregar pedido" leva cinco dias e três deles são gastos esperando em "Confirmar pagamento", você sabe qual capacidade olhar, e o *business case* praticamente se escreve sozinho: cada dia economizado é mensurável em satisfação do cliente e em fluxo de caixa.

| Abordagem | Benefício |
| :--- | :--- |
| **Mapeie capacidades junto com o negócio**, no nível 2, em uma página. | Cria um vocabulário comum entre negócio e tecnologia que sobrevive a reestruturações. |
| **Sobreponha heat maps** (importância estratégica, maturidade, custo, risco). | Transforma opiniões em uma imagem visível e debatível de onde é preciso investir. |
| **Mapeie aplicações e custos nas capacidades.** | Revela duplicidades, sistemas órfãos e quanto cada capacidade realmente custa para rodar. |
| **Modele fluxos de valor para as jornadas-chave do cliente.** | Mostra onde o valor fica travado e quais capacidades melhorar primeiro. |
| **Separe capacidades diferenciadoras das commodity.** | Concentra a engenharia sob medida onde ela gera vantagem, e padroniza o resto. |

## Outcomes, Não Outputs

Aqui mora uma armadilha em que até times maduros caem: medir **outputs** (entregas) em vez de **outcomes** (resultados).

- Um **output** é o que você produz: uma nova API, um banco migrado, 40 microsserviços, um *data lake*, um portal.
- Um **outcome** é a mudança de comportamento ou de resultado que aquele output provoca: clientes entram mais rápido, menos pedidos falham, as ligações no suporte caem, um novo produto é lançado em semanas em vez de meses.

Outputs são fáceis de contar, e é exatamente por isso que são perigosos. "Migramos 200 aplicações para a nuvem" soa impressionante num relatório de status. Mas se o objetivo de negócio era "reduzir o *time to market* de novos produtos" e as entregas continuam tão lentas quanto antes, você entregou um output e errou o outcome.

<div class="callout tip">
  <p>Um teste rápido: pergunte "e daí?" depois de cada resultado. "Migramos para a nuvem." E daí? "Agora provisionamos ambientes em minutos." E daí? "Os times entregam funcionalidades novas em duas semanas em vez de dois meses." <strong>Isso</strong> é um outcome. Continue perguntando até chegar em algo que o próprio negócio colocaria no placar dele.</p>
</div>

### Ligando OKRs e KPIs às decisões de arquitetura

Muitas organizações já expressam a estratégia como **OKRs** (*Objectives and Key Results*) ou acompanham **KPIs**. Isso é um presente para o arquiteto: o placar já existe, você só precisa conectar as suas decisões a ele.

Um jeito prático de fazer isso:

1. **Comece pelo objetivo:** "Ser o banco mais fácil de abrir conta."
2. **Identifique os resultados-chave:** "Abertura de conta em menos de 5 minutos; 80% das aberturas totalmente digitais."
3. **Encontre as capacidades envolvidas:** Onboarding de Clientes, Verificação de Identidade, Gestão de Documentos.
4. **Avalie essas capacidades no heat map:** Verificação de Identidade é manual e está vermelha.
5. **Tome decisões de arquitetura que movam o KR:** integrar um provedor de verificação de identidade, expor o onboarding como API, aposentar o fluxo em papel.
6. **Registre o vínculo no ADR:** cada decisão diz qual KR ela suporta e como vocês vão saber se funcionou.
7. **Meça depois da entrega:** o tempo de onboarding caiu? Se não caiu, por quê?

O passo 6 é o que quase todo mundo pula, e é o mais barato. Adicionar uma seção de "Direcionador de negócio" e de "Resultado esperado" no seu modelo de ADR leva cinco minutos e força a conversa a acontecer no momento certo: antes de o dinheiro ser gasto.

| Output (o que construímos) | Outcome (o que mudou) | KPI para acompanhar |
| :--- | :--- | :--- |
| API de onboarding self-service | Clientes abrem conta sem ir à agência | Tempo de onboarding, taxa de conclusão digital |
| Pipeline de pedidos orientado a eventos | Pedidos chegam ao armazém em até um minuto | Latência pedido-armazém, taxa de envio no mesmo dia |
| Plataforma consolidada de dados do cliente | O suporte resolve no primeiro contato | Resolução no primeiro contato, tempo médio de atendimento |
| Três CRMs legados aposentados | Custo de operação menor e visão única do cliente | Custo de operação por capacidade, incidentes de qualidade de dados |

## Priorize por Valor

Toda organização tem mais ideias do que dinheiro, gente e tempo. O papel da arquitetura não é fazer tudo; é ajudar a decidir **o que fazer primeiro** e, tão importante quanto, **o que não fazer de jeito nenhum**.

### O business case, sem drama

Um *business case* não precisa ser uma apresentação de 40 slides. No fundo, ele responde a quatro perguntas:

1. **Que problema estamos resolvendo, e para quem?** Em termos de negócio.
2. **Qual o benefício esperado?** Receita gerada, custo evitado, risco reduzido, tempo economizado. Estimado, com as premissas por escrito.
3. **Quanto custa?** Construir *e* operar. Licenças, pessoas, consumo de nuvem, treinamento e o custo de desativar o que está sendo substituído.
4. **O que acontece se não fizermos?** O custo de não agir costuma ser o número mais convincente.

A partir daí, o **ROI** é aritmética simples: (benefício menos custo) dividido pelo custo. A parte difícil nunca é a fórmula; é ser honesto com as premissas. O arquiteto agrega um valor enorme aqui, porque conhece os custos escondidos que os *business cases* adoram esquecer: trabalho de integração, migração de dados, sobrecarga operacional, revisões de segurança, o segundo sistema que ninguém desliga. O pessoal de [otimização de custos](/pt-br/principles/cloud/cost-optimization/) completaria: e a fatura da nuvem que cresce quietinha todo mês.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"ROI? Business case? Eu sou desenvolvedor, não contador! O Financeiro não pode calcular isso?"</span>
    </div>
  </div>
</div>

O Financeiro faz a conta, Júnior, mas não tem como adivinhar os números de entrada. Só a tecnologia sabe que a "integração simples" precisa de uma licença nova de *middleware*, que o sistema legado não pode ser desligado até o módulo de relatórios ser reescrito, ou que a solução elegante precisa de mais dois engenheiros para ser operada. Se você não leva esses números para a mesa, alguém vai inventá-los, e eles vão estar errados. Saber colocar um preço aproximado e um benefício aproximado numa decisão técnica é uma das habilidades que separam um engenheiro sênior de um arquiteto.

E nem todo benefício é financeiro. Conformidade regulatória, postura de segurança e redução da dependência de pessoas-chave são valor de verdade, mesmo que não apareçam como receita. O truque é torná-los **explícitos**: "isso reduz a probabilidade de um vazamento de dados que custaria X" é um argumento de negócio; "isso é boa prática" não é. O princípio de [gestão de riscos](/pt-br/principles/enterprise/risk-management/) se aprofunda em como expressar risco nesses termos.

### Valor versus esforço

Quando você tem uma lista de iniciativas candidatas, uma matriz simples de **valor versus esforço** ajuda muito. Não é científica, mas deixa as prioridades visíveis e debatíveis, que é justamente a ideia.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 400" role="img" aria-labelledby="biz-d3-title biz-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="biz-d3-title">Matriz de priorização valor versus esforço</title>
<desc id="biz-d3-desc">Uma matriz dois por dois com valor de negócio no eixo vertical e esforço e risco no eixo horizontal. Os quadrantes são ganhos rápidos, apostas estratégicas, complementos e ralos de dinheiro.</desc>
<defs><marker id="biz-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<rect x="120" y="50" width="245" height="145" rx="10" class="d-box-accent"/>
<text x="242" y="110" text-anchor="middle" class="d-title">Ganhos rápidos</text>
<text x="242" y="132" text-anchor="middle" class="d-small">faça agora</text>
<text x="242" y="150" text-anchor="middle" class="d-small">ganhos pequenos e visíveis</text>
<rect x="375" y="50" width="245" height="145" rx="10" class="d-box-info"/>
<text x="497" y="110" text-anchor="middle" class="d-title">Apostas estratégicas</text>
<text x="497" y="132" text-anchor="middle" class="d-small">planeje, financie, fatie</text>
<text x="497" y="150" text-anchor="middle" class="d-small">grandes mudanças de capacidade</text>
<rect x="120" y="205" width="245" height="145" rx="10" class="d-box"/>
<text x="242" y="265" text-anchor="middle" class="d-title">Complementos</text>
<text x="242" y="287" text-anchor="middle" class="d-small">quando houver capacidade</text>
<rect x="375" y="205" width="245" height="145" rx="10" class="d-box-danger"/>
<text x="497" y="265" text-anchor="middle" class="d-title">Ralos de dinheiro</text>
<text x="497" y="287" text-anchor="middle" class="d-small">a arquitetura linda</text>
<text x="497" y="305" text-anchor="middle" class="d-small">que ninguém pediu</text>
<line x1="105" y1="360" x2="105" y2="50" class="d-line" marker-end="url(#biz-d3-arrow)"/>
<line x1="105" y1="360" x2="630" y2="360" class="d-line" marker-end="url(#biz-d3-arrow)"/>
<text x="70" y="200" text-anchor="middle" transform="rotate(-90 70 200)" class="d-label">VALOR DE NEGÓCIO</text>
<text x="370" y="388" text-anchor="middle" class="d-label">ESFORÇO E RISCO</text>
</svg>
</div>
<figcaption>Figura 3: Todo mundo concorda com os ganhos rápidos; a disciplina de verdade é dizer não aos ralos de dinheiro</figcaption>
</figure>

Algumas observações da vida real:

- **Ganhos rápidos** constroem confiança. Um time de arquitetura que entrega uma melhoria visível no primeiro mês ganha credibilidade para propor as apostas estratégicas depois.
- **Apostas estratégicas** são onde a arquitetura corporativa justifica o salário. São grandes, arriscadas e valiosas, então fatie em incrementos que entreguem valor pelo caminho. "A fase 3 entrega valor" é sinal de alerta; "todo trimestre move um KPI" é um plano. O princípio de [design evolutivo](/pt-br/principles/solution/evolutionary-design/) é seu amigo aqui.
- **Complementos** tudo bem, desde que não tomem o espaço do resto.
- **Ralos de dinheiro** são onde mora o desenvolvimento orientado a currículo. Muitas vezes eles vêm disfarçados de apostas estratégicas, e é por isso que o eixo de valor precisa ser defendido em termos de negócio, e não com entusiasmo técnico.

## Arquitetura como Parceira do Negócio

A arquitetura corporativa tem um problema de reputação. Em muitas empresas, ela é vista como a **torre de marfim**: um grupo de pessoas que produz padrões, *frameworks* e comitês de revisão, desconectado tanto do negócio quanto dos times de entrega. Dizem "não" o tempo todo, pedem documentos que ninguém lê e aparecem depois que a decisão já foi tomada.

A alternativa é a arquitetura como **parceira do negócio**: pessoas que sentam à mesa da estratégia, entendem o modelo de negócio, falam em resultados e ajudam os times de entrega a tomar boas decisões rapidamente.

| Torre de marfim | Parceira do negócio |
| :--- | :--- |
| Parte de padrões de tecnologia | Parte de objetivos e dores do negócio |
| Mede conformidade com o framework | Mede resultados e valor entregue |
| Produz documentos e revisões | Produz decisões, roadmaps e capacitação |
| Aparece no fim, como um portão | Aparece no início, como conselheira |
| Fala em siglas | Fala em capacidades, custos e riscos |
| Diz "não" | Diz "assim não, mas tem esse caminho" |

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 290" role="img" aria-labelledby="biz-d4-title biz-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="biz-d4-title">O ciclo da parceria com o negócio</title>
<desc id="biz-d4-desc">Um ciclo contínuo de quatro etapas: entender objetivos, mapear e avaliar capacidades, decidir e entregar, e medir resultados, que realimenta o entendimento dos objetivos.</desc>
<defs><marker id="biz-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-accent"/></marker></defs>
<rect x="60" y="40" width="200" height="64" rx="10" class="d-box-accent"/>
<text x="160" y="68" text-anchor="middle" class="d-title">Entender objetivos</text>
<text x="160" y="88" text-anchor="middle" class="d-small">estratégia, OKRs, dores</text>
<rect x="460" y="40" width="200" height="64" rx="10" class="d-box-info"/>
<text x="560" y="68" text-anchor="middle" class="d-title">Mapear e avaliar</text>
<text x="560" y="88" text-anchor="middle" class="d-small">capacidades, heat map</text>
<rect x="460" y="196" width="200" height="64" rx="10" class="d-box-info"/>
<text x="560" y="224" text-anchor="middle" class="d-title">Decidir e entregar</text>
<text x="560" y="244" text-anchor="middle" class="d-small">ADRs, incrementos</text>
<rect x="60" y="196" width="200" height="64" rx="10" class="d-box-accent"/>
<text x="160" y="224" text-anchor="middle" class="d-title">Medir resultados</text>
<text x="160" y="244" text-anchor="middle" class="d-small">KPIs, feedback</text>
<line x1="262" y1="72" x2="456" y2="72" class="d-line-accent" marker-end="url(#biz-d4-arrow)"/>
<line x1="560" y1="106" x2="560" y2="192" class="d-line-accent" marker-end="url(#biz-d4-arrow)"/>
<line x1="458" y1="228" x2="264" y2="228" class="d-line-accent" marker-end="url(#biz-d4-arrow)"/>
<line x1="160" y1="194" x2="160" y2="108" class="d-line-accent" marker-end="url(#biz-d4-arrow)"/>
<text x="360" y="145" text-anchor="middle" class="d-label">CICLO CONTÍNUO</text>
<text x="360" y="165" text-anchor="middle" class="d-small">o mapa segue a estratégia</text>
</svg>
</div>
<figcaption>Figura 4: Alinhamento é um ciclo, não um exercício que se faz uma vez</figcaption>
</figure>

E como é ser parceira na prática?

### 1. **Aprenda o modelo de negócio**

**Meta:** entender como a empresa ganha dinheiro, com o que ela gasta e o que tira o sono da liderança.

Leia o relatório anual. Passe um dia com vendas, operações e atendimento. Descubra os três ou quatro números que o conselho realmente olha. Você vai se surpreender com quantos debates de arquitetura terminam na hora quando você sabe que a margem da empresa depende de um processo específico.

**Benefício:** suas recomendações partem do que importa para o negócio, o que as torna muito mais fáceis de financiar e defender.

### 2. **Fale a língua dos resultados**

**Meta:** traduzir propostas técnicas em impacto de negócio, e objetivos de negócio em implicações técnicas.

Em vez de "precisamos substituir o monolito por serviços orientados a eventos", tente "hoje uma mudança de preço leva seis semanas para chegar ao cliente; com essa mudança leva um dia, o que nos permite reagir à concorrência na mesma semana".

**Benefício:** as decisões são tomadas mais rápido, pelas pessoas certas e pelos motivos certos.

### 3. **Esteja presente desde o começo**

**Meta:** influenciar as decisões enquanto elas ainda são baratas de mudar.

O momento mais valioso para a arquitetura é quando a iniciativa ainda é uma ideia num slide. Uma conversa rápida ali economiza meses de retrabalho depois. Uma revisão de arquitetura no fim do projeto é, na maior parte, controle de danos.

**Benefício:** menos surpresas, menos momentos de "mas já assinamos o contrato" e muito menos atrito com os times de entrega.

### 4. **Mantenha um roadmap vivo**

**Meta:** mostrar como a arquitetura evolui do estado atual ao estado-alvo, em incrementos ligados às prioridades do negócio.

Um *roadmap* que lista tecnologias ("T3: Kafka") é uma lista de compras. Um *roadmap* que lista capacidades e resultados ("T3: status do pedido em tempo real para o cliente, viabilizado pelo novo barramento de eventos") é um plano que o negócio consegue acompanhar, financiar e cobrar.

**Benefício:** o negócio vê para onde vai o dinheiro e quando o valor chega; a tecnologia ganha uma direção estável.

### 5. **Capacite, não apenas aprove**

**Meta:** fazer com que o jeito certo seja o jeito fácil para os times de entrega.

Arquiteturas de referência, *templates*, *paved roads* e plataformas reutilizáveis entregam alinhamento em escala. Um comitê de revisão consegue avaliar dez projetos por mês; um bom *template* molda centenas de decisões sem uma única reunião. É aqui que entra a [governança](/pt-br/principles/enterprise/governance/) bem feita: leve, automatizada onde possível e focada no que realmente importa.

**Benefício:** o alinhamento deixa de depender de o arquiteto estar em todas as salas.

## Medindo o Impacto da Arquitetura

"Como sabemos que a arquitetura está funcionando?" é uma pergunta justa, e "confia na gente" não é uma resposta aceitável. Se pregamos resultados para todo mundo, precisamos medir os nossos.

O impacto da arquitetura raramente é medido de forma direta, porque a arquitetura atua através dos outros. Mas ela deixa impressões digitais bem claras:

| Dimensão | O que medir | Por que importa |
| :--- | :--- | :--- |
| **Velocidade** | Tempo da ideia de negócio até produção, *lead time* de mudanças | Mostra se a arquitetura acelera ou trava o negócio |
| **Custo** | Custo de operação por capacidade, custo de sistemas duplicados, custo evitado por reúso | Conecta a arquitetura ao DRE |
| **Simplicidade** | Aplicações por capacidade, integrações por sistema, sistemas aposentados | Um ambiente mais simples é mais barato, mais seguro e mais rápido de mudar |
| **Risco** | Sistemas em tecnologia sem suporte, dependência de pessoas-chave, apontamentos de auditoria | Torna a dívida técnica visível como risco de negócio |
| **Alinhamento** | Parcela do gasto em capacidades estratégicas versus commodity | Mostra se o dinheiro segue a estratégia |
| **Adoção** | Uso de arquiteturas de referência e plataformas compartilhadas | Mostra se as orientações de arquitetura são realmente úteis |
| **Satisfação** | Feedback dos *stakeholders* de negócio e dos times de entrega | Parceiros são avaliados por quem eles atendem |

Alguns cuidados:

- **Não transforme métricas em metas às cegas.** Se você premiar "número de sistemas aposentados", vai ter gente aposentando sistemas fáceis e irrelevantes enquanto os dolorosos continuam lá. A lei de Goodhart vale para arquitetos também.
- **Meça tendências, não fotos.** Um trimestre diz pouco; quatro trimestres contam uma história.
- **Conte a história com os números.** "Aposentamos 12 sistemas" é um número. "Aposentamos 12 sistemas, liberando R$ 2 milhões por ano, reinvestidos na plataforma de retenção que reduziu o *churn* em 15%" é uma história que o conselho não esquece. Transparência de custos ajuda muito aqui; veja [transparência de custos](/pt-br/principles/solution/cost-transparency/).

## Tradeoffs

Alinhamento com o negócio parece algo com que ninguém poderia discordar. Quem seria *contra* se alinhar ao negócio? Mas, na prática, alinhar-se ao negócio cria tensões reais com outros princípios e pilares. Fingir que essas tensões não existem é o caminho mais curto para virar ou uma torre de marfim ou uma fábrica de *features*.

Bora ver as principais?

### Arquitetura de longo prazo versus pressão de curto prazo

Esse é o clássico. O negócio quer a funcionalidade até o fim do trimestre; a arquitetura precisa de uma fundação que leva dois trimestres para ficar pronta. Se você sempre escolhe o curto prazo, acumula dívida técnica até que qualquer mudança demore uma eternidade. Se sempre escolhe o longo prazo, o negócio perde a paciência (e talvez o mercado) antes de a fundação ficar pronta.

A saída não é escolher um lado, é **tornar a dívida visível e com preço**: "conseguimos entregar em quatro semanas com um atalho que vai custar umas oito semanas de retrabalho no ano que vem; ou em sete semanas sem ele". Deixe o negócio tomar uma decisão informada, registre essa decisão e volte a ela depois.

### Padronização versus velocidade

Padrões reduzem custo, risco e carga cognitiva no portfólio. Mas um time com uma oportunidade de negócio urgente pode andar mais rápido com uma ferramenta fora do padrão. Rígido demais, e você bloqueia a inovação e empurra as pessoas para o *shadow IT*. Solto demais, e você acaba com quinze bancos de dados, doze ferramentas de CI e ninguém para dar suporte.

Um bom meio-termo é uma **abordagem em níveis**: padrões rígidos para capacidades commodity e plataformas compartilhadas, mais liberdade para capacidades diferenciadoras, e um processo de exceção claro, rápido e com data de validade.

### Tradeoffs com Otimização de Custos (Cost Optimization)

Alinhar-se ao negócio às vezes significa gastar *mais*: investir pesado numa capacidade diferenciadora, pagar por serviços *premium* para cumprir uma data de lançamento ou rodar dois sistemas em paralelo durante uma transição. A resposta ótima em custo e a resposta ótima para o negócio nem sempre coincidem. A pergunta não é "o que é mais barato?", e sim "o que dá o melhor retorno para o objetivo que estamos perseguindo?".

### Tradeoffs com Segurança e Conformidade (Security)

O negócio quer lançar em um novo país no mês que vem; segurança e *compliance* precisam de tempo para avaliar residência de dados e requisitos regulatórios. A velocidade de mercado puxa para um lado, o risco puxa para o outro. A resposta alinhada é tratar conformidade como requisito de negócio desde o primeiro dia, e não como portão no final, porque uma multa ou um vazamento também é um resultado de negócio, só que péssimo.

### Tradeoffs com Confiabilidade (Reliability)

Nem toda capacidade precisa de cinco noves. O alinhamento com o negócio ajuda aqui: a meta de confiabilidade deve acompanhar a criticidade de negócio da capacidade. Mas a tensão aparece quando o negócio quer alta disponibilidade para tudo sem pagar por ela, ou quando uma capacidade "não crítica" se revela crítica no meio de um incidente. Amarre as metas de confiabilidade às capacidades e ao seu impacto no negócio, e revise-as conforme o negócio muda. O princípio de [confiabilidade](/pt-br/principles/cloud/reliability/) mostra como definir essas metas.

### Tradeoffs com Excelência Operacional (Operational Excellence)

Correr para pegar uma oportunidade de negócio muitas vezes significa pular automação, documentação e *runbooks* "por enquanto". O negócio tem o seu resultado, e a operação herda um sistema frágil. Excelência operacional também é assunto de negócio: uma queda na Black Friday é um evento de negócio, não um evento de TI. Veja [excelência operacional](/pt-br/principles/cloud/operational-excellence/).

### Tradeoffs com Eficiência de Performance (Performance Efficiency)

Prioridades de negócio podem empurrar para soluções rápidas de construir, mas pouco eficientes para rodar, como uma plataforma *low-code* ou um SaaS genérico para um processo de alto volume. Funciona no lançamento e vira gargalo quando escala. A correção é conhecer as premissas de crescimento e colocar os limites de performance dentro do *business case*.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Peraí, então se o negócio sempre ganha, pra que serve ter arquiteto?"</span>
    </div>
  </div>
</div>

Ótima pergunta, Júnior! O negócio não "sempre ganha". Alinhamento não é obediência. O trabalho do arquiteto é garantir que o negócio decida **com informação completa**: o custo real, o risco real, as consequências de longo prazo e as alternativas. Às vezes isso significa dizer "sim, e dá para fazer mais rápido assim". Às vezes significa "não, isso prejudicaria o objetivo que vocês disseram ser o mais importante". O que um arquiteto alinhado nunca faz é tomar essas decisões sozinho, num vácuo técnico, com base no que seria divertido construir.

## Conclusão

O **alinhamento com o negócio** é o que separa a arquitetura que gera valor da arquitetura que apenas gera diagramas. Ele faz uma pergunta simples a cada decisão: *qual resultado de negócio isso move, e como vamos saber?* Quando a resposta é clara, o financiamento fica mais fácil, as prioridades ficam mais nítidas e a arquitetura ganha um lugar à mesa da estratégia.

As ferramentas não são complicadas: uma cadeia de rastreabilidade da estratégia à tecnologia, um mapa de capacidades pintado com *heat maps*, fluxos de valor que mostram onde o cliente sente a dor, outcomes no lugar de outputs, *business cases* honestos e uma priorização disposta a dizer não. O difícil é a disciplina de usá-las com consistência, e a humildade de aceitar que a solução mais elegante nem sempre é a mais valiosa.

**Mais importante:** alinhamento não é um exercício que se faz uma vez. A estratégia muda, o mercado muda, empresas se fundem e se dividem. O mapa de capacidades, o *heat map* e o *roadmap* precisam evoluir junto. Uma arquitetura perfeitamente alinhada há três anos pode estar perigosamente desalinhada hoje.

## Próximos Passos

1. **Conheça a estratégia da sua empresa**
Descubra os objetivos estratégicos, OKRs ou KPIs que a liderança realmente acompanha. Se não estiverem escritos, pergunte. Não dá para se alinhar com algo que você não conhece.

2. **Construa um mapa de capacidades de nível 2 com o negócio**
Faça alguns *workshops*, mantenha tudo em uma página e nomeie as capacidades na linguagem do negócio. Valide com pessoas de fora da TI.

3. **Pinte o mapa com um heat map**
Avalie importância estratégica, maturidade e custo. Identifique as capacidades estratégicas em vermelho; é ali que o investimento deve ir. Identifique as commodities; é ali que você deve padronizar e comprar.

4. **Inclua direcionadores de negócio no seu modelo de ADR**
Toda decisão relevante deve dizer qual objetivo ela suporta e qual KPI vai mostrar se funcionou.

5. **Revise as iniciativas em andamento**
Coloque todas numa matriz de valor versus esforço. Olhe com atenção para qualquer coisa no quadrante dos ralos de dinheiro, e seja honesto sobre motivações de currículo.

6. **Meça e conte a história**
Escolha algumas métricas de impacto (velocidade, custo, simplicidade, risco, alinhamento) e reporte-as em termos de negócio todo trimestre.

<div class="callout info" data-title="Referências">
  <ul>
    <li><a href="https://www.opengroup.org/togaf" target="_blank" rel="noopener">The Open Group: TOGAF Standard</a></li>
    <li><a href="https://www.opengroup.org/archimate-forum" target="_blank" rel="noopener">The Open Group: ArchiMate Forum</a></li>
    <li><a href="https://www.businessarchitectureguild.org" target="_blank" rel="noopener">Business Architecture Guild (BIZBOK Guide)</a></li>
    <li><a href="https://learn.microsoft.com/azure/cloud-adoption-framework/" target="_blank" rel="noopener">Microsoft Cloud Adoption Framework</a></li>
    <li><a href="https://learn.microsoft.com/azure/well-architected/" target="_blank" rel="noopener">Microsoft Azure Well-Architected Framework</a></li>
    <li><a href="https://aws.amazon.com/architecture/well-architected/" target="_blank" rel="noopener">AWS Well-Architected Framework</a></li>
    <li><a href="https://martinfowler.com/architecture/" target="_blank" rel="noopener">Martin Fowler: Software Architecture Guide</a></li>
  </ul>
</div>
