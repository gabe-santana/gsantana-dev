---
title: Design evolutivo
short: Arquitetura que muda em passos pequenos e medidos, em vez de apostar tudo num plano gigante. Afinal, quem consegue prever o que o negócio vai precisar daqui a três anos?
category: solution
---

## Introdução

Todo sistema em que você vai trabalhar na vida vai mudar. Novas funcionalidades, novas regulamentações, novos padrões de tráfego, um novo CEO com uma nova estratégia, um provedor de nuvem que descontinua justamente o serviço em que você apoiou tudo. A única pergunta que importa é se a sua arquitetura foi feita para **absorver a mudança** ou para **resistir a ela**.

O **Design Evolutivo** é o princípio que trata a mudança como o estado normal do software, e não como exceção. Em vez de tentar acertar o design inteiro no primeiro dia, você desenha o suficiente para começar, constrói em passos pequenos, mede o que acontece e deixa o *feedback* real guiar a próxima decisão. A arquitetura cresce junto com o produto, protegida por verificações automáticas que impedem que ela apodreça no caminho.

Quando um time ignora esse princípio, os sintomas aparecem em dois sabores opostos, e às vezes nos dois ao mesmo tempo:

- Meses gastos em diagramas e especificações antes de uma única linha de código chegar a um usuário de verdade;
- Decisões travadas cedo, baseadas em chute, que ninguém tem coragem de revisitar depois;
- O extremo oposto: nenhum design, onde cada *sprint* adiciona mais um atalho até o código virar uma grande bola de lama;
- Mudanças que deveriam levar um dia levando um mês, porque tudo está acoplado a tudo;
- Medo de fazer deploy, então os releases ficam maiores, mais raros e mais assustadores;
- A famosa reunião do "vamos reescrever do zero", que acontece mais ou menos a cada dois anos;
- Ninguém lembra *por que* o sistema é do jeito que é, então ninguém sabe o que é seguro mudar.

Pois é, *é raro, mas acontece bastante*... Quem nunca herdou um sistema em que mudar um campo numa tela exigia mexer em onze projetos e pedir benção para três times?

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Mas não seria mais seguro desenhar tudo direitinho logo no começo? Aí a gente nunca ia precisar mudar nada!"</span>
    </div>
  </div>
</div>

Calma aí, Júnior! Esse é o sonho de todo arquiteto que nunca viu um sistema sobreviver ao contato com usuários reais. O problema não é que desenhar antes seja ruim; é que o futuro é imprevisível. Os requisitos dos quais você tem tanta certeza hoje são hipóteses, e algumas estão erradas. Você só não sabe quais ainda.

Deixa eu contar uma história que mostra como esse sonho costuma terminar.

## A reescrita que nunca foi para produção

Uma empresa tinha um monólito que era, sendo sincero, uma bagunça. Deploys lentos, código emaranhado, um banco com quatrocentas tabelas e nenhum dono claro. A diretoria aprovou "a nova plataforma": uma reescrita limpa, desenhada do zero pelas melhores pessoas da empresa, com todas as necessidades futuras previstas.

O time de arquitetura passou seis meses no design. Microsserviços, *event sourcing*, *service mesh*, um framework próprio "para todo mundo construir do mesmo jeito". Diagramas lindos. Aí começou o desenvolvimento.

Veja o que aconteceu nos três anos seguintes:

- O sistema antigo **continuou mudando**, porque o negócio não podia parar por três anos. Toda funcionalidade nova tinha que ser feita duas vezes, ou a reescrita ficava ainda mais para trás;
- Os requisitos que embasaram o design **ficaram obsoletos**: a empresa entrou num mercado novo, abandonou uma linha de produtos e mudou o modelo de preços duas vezes;
- O framework próprio consumia um time inteiro só para ser mantido;
- Nada foi para produção até "tudo estar pronto", então foram três anos com **zero *feedback* real**;
- Os melhores engenheiros estavam na reescrita, então o sistema antigo, aquele que pagava as contas, ficou com quem sobrou.

No terceiro ano, um novo CTO olhou o orçamento, olhou a data de entrega (que já tinha mudado cinco vezes) e cancelou o projeto. O monólito roda até hoje. Um pouco pior do que antes, porque ficou três anos abandonado.

<div class="callout warning">
  <p>A reescrita <em>big bang</em> falha por um motivo simples: ela troca um sistema conhecido, que funciona, por um desconhecido, e não entrega <strong>nem valor nem aprendizado</strong> até o final. Quando você descobre que as premissas do design estavam erradas, o orçamento já acabou.</p>
</div>

A alternativa nunca foi "não melhorar o sistema". Era melhorar **de forma incremental**: separar uma parte de cada vez, colocar em produção, aprender com ela e seguir em frente. É disso que trata o Design Evolutivo.

## O que é, de fato, arquitetura evolutiva

O termo foi popularizado por Neal Ford, Rebecca Parsons e Patrick Kua no livro *Building Evolutionary Architectures*. A definição deles é curta e precisa: uma arquitetura evolutiva **suporta mudança guiada e incremental em múltiplas dimensões**.

Vale destrinchar essas três ideias, porque cada uma importa:

- **Incremental:** a mudança acontece em passos pequenos, tanto na construção (commits pequenos, deploys pequenos) quanto na liberação (*rollout* progressivo, nada de *big bang*);
- **Guiada:** a mudança não é aleatória. Existem critérios objetivos (as *fitness functions*, que veremos já já) que dizem se a arquitetura continua saudável depois de cada passo;
- **Múltiplas dimensões:** arquitetura não é só estrutura de código. Inclui performance, segurança, dados, operabilidade, custo, conformidade. Uma mudança pode ser ótima num eixo e péssima em outro.

Isso fica entre dois extremos que todo mundo já viu por aí.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 280" role="img" aria-labelledby="evo-d1-title evo-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="evo-d1-title">O espectro do design</title>
<desc id="evo-d1-desc">Um eixo horizontal que vai de desenhar tudo antecipadamente até não desenhar nada. Big Design Up Front fica à esquerda, Sem Design à direita e o Design Evolutivo no meio, desenhando continuamente em passos pequenos e verificáveis.</desc>
<defs><marker id="evo-d1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="360" y="24" text-anchor="middle" class="d-label">O ESPECTRO DO DESIGN</text>
<text x="60" y="52" text-anchor="start" class="d-small">tudo antecipado</text>
<text x="660" y="52" text-anchor="end" class="d-small">nada de design</text>
<line x1="62" y1="66" x2="658" y2="66" class="d-line" marker-start="url(#evo-d1-arrow)" marker-end="url(#evo-d1-arrow)"/>
<rect x="30" y="95" width="200" height="120" rx="10" class="d-box-warn"/>
<text x="130" y="128" text-anchor="middle" class="d-title">Big Design Up Front</text>
<text x="130" y="154" text-anchor="middle" class="d-small">meses de diagramas</text>
<text x="130" y="174" text-anchor="middle" class="d-small">decisões antes dos dados</text>
<text x="130" y="194" text-anchor="middle" class="d-small">rígido quando erra</text>
<rect x="260" y="95" width="200" height="120" rx="10" class="d-box-accent"/>
<text x="360" y="128" text-anchor="middle" class="d-title">Evolutivo</text>
<text x="360" y="154" text-anchor="middle" class="d-small">o suficiente para começar</text>
<text x="360" y="174" text-anchor="middle" class="d-small">decida no último</text>
<text x="360" y="194" text-anchor="middle" class="d-small">momento responsável</text>
<rect x="490" y="95" width="200" height="120" rx="10" class="d-box-danger"/>
<text x="590" y="128" text-anchor="middle" class="d-title">Sem design</text>
<text x="590" y="154" text-anchor="middle" class="d-small">codar antes, pensar depois</text>
<text x="590" y="174" text-anchor="middle" class="d-small">arquitetura acidental</text>
<text x="590" y="194" text-anchor="middle" class="d-small">grande bola de lama</text>
<text x="360" y="252" text-anchor="middle" class="d-small">O alvo é o meio: design contínuo, em passos pequenos e verificáveis</text>
</svg>
</div>
<figcaption>Figura 1: O design evolutivo fica entre planejar tudo e não planejar nada</figcaption>
</figure>

O **Big Design Up Front (BDUF)** parte do princípio de que dá para conhecer os requisitos bem o bastante para desenhar tudo antes de construir. Funciona para pontes, onde a física não muda depois que a planta é assinada. Software não é ponte: o chão se mexe embaixo dele a cada trimestre.

O **sem design** é onde muitos times caem quando rejeitam o BDUF e entendem ágil como "a gente não planeja". Toda decisão é local e de curto prazo, e a arquitetura que surge é acidental. É rápido por seis meses e depois fica lento para sempre.

Design Evolutivo **não** é ausência de design. Como Martin Fowler escreveu anos atrás em *Is Design Dead?*, é design que acontece continuamente, apoiado por práticas (testes, refatoração, integração contínua) que deixam barato mudar o design. Você continua pensando seriamente em arquitetura; só não finge que dá para pensar em tudo de uma vez.

## Decida no último momento responsável

Se não dá para saber tudo antes, quando tomar cada decisão? A comunidade de software *Lean* tem uma boa resposta: no **último momento responsável**. É o ponto em que adiar mais eliminaria uma opção importante ou custaria mais do que decidir agora.

Repare na palavra *responsável*. Não é o *último momento possível*, em que o time está paralisado e a decisão acaba sendo tomada por acidente. É o momento em que você tem o máximo de informação que vai conseguir sem pagar caro demais pela espera.

E por que adiar? Porque a cada semana de espera você aprende algo:

- Dados reais de uso mostram quais funcionalidades importam e quais eram chute de alguém;
- O perfil de carga fica visível, então você dimensiona pela realidade e não por uma planilha;
- O time entende melhor o domínio, então as fronteiras que desenha ficam melhores;
- Podem surgir novas opções (um serviço gerenciado, uma biblioteca, um recurso da plataforma).

### Decisões reversíveis e irreversíveis

Nem toda decisão merece o mesmo cuidado. A Amazon popularizou um jeito simples de separar as duas: **portas de mão única** e **portas de mão dupla** (*one-way doors* e *two-way doors*).

- Uma **porta de mão dupla** é uma decisão que dá para desfazer se der errado: a escolha de uma biblioteca atrás de uma interface, um layout de tela, uma estratégia de cache, uma funcionalidade atrás de uma *flag*. Tome essas decisões rápido, com times pequenos, e acompanhe os resultados;
- Uma **porta de mão única** é difícil ou impossível de reverter: a tecnologia do banco principal para os dados centrais, um contrato de API pública que clientes externos já integraram, um modelo de dados com anos de histórico, um contrato com fornecedor com três anos de *lock-in*. Essas merecem reflexão lenta e cuidadosa, protótipos e registro por escrito.

A armadilha é tratar toda decisão como porta de mão única (e ficar lento e burocrático) ou tratar portas de mão única como se fossem de mão dupla (e descobrir a tranca só quando já é tarde).

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 380" role="img" aria-labelledby="evo-d2-title evo-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="evo-d2-title">Matriz de reversibilidade das decisões</title>
<desc id="evo-d2-desc">Uma matriz dois por dois com impacto no eixo vertical e reversibilidade no eixo horizontal. Alto impacto e difícil de reverter é uma porta de mão única, que exige cuidado. Alto impacto e fácil de reverter é uma porta de mão dupla, decidida rápido e monitorada. Baixo impacto e difícil de reverter é uma armadilha oculta. Baixo impacto e fácil de reverter significa só fazer.</desc>
<defs><marker id="evo-d2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="407" y="28" text-anchor="middle" class="d-label">MATRIZ DE DECISÃO</text>
<text x="60" y="187" text-anchor="middle" class="d-label" transform="rotate(-90 60 187)">IMPACTO</text>
<text x="120" y="64" text-anchor="end" class="d-small">alto</text>
<text x="120" y="320" text-anchor="end" class="d-small">baixo</text>
<line x1="130" y1="324" x2="130" y2="52" class="d-line" marker-end="url(#evo-d2-arrow)"/>
<rect x="140" y="50" width="264" height="134" rx="10" class="d-box-danger"/>
<text x="272" y="105" text-anchor="middle" class="d-title">Porta de mão única</text>
<text x="272" y="128" text-anchor="middle" class="d-small">decida com cuidado</text>
<text x="272" y="146" text-anchor="middle" class="d-small">protótipo, ADR, revisão</text>
<rect x="410" y="50" width="264" height="134" rx="10" class="d-box-info"/>
<text x="542" y="105" text-anchor="middle" class="d-title">Porta de mão dupla</text>
<text x="542" y="128" text-anchor="middle" class="d-small">decida rápido</text>
<text x="542" y="146" text-anchor="middle" class="d-small">acompanhe as métricas</text>
<rect x="140" y="190" width="264" height="134" rx="10" class="d-box-warn"/>
<text x="272" y="245" text-anchor="middle" class="d-title">Armadilha oculta</text>
<text x="272" y="268" text-anchor="middle" class="d-small">barato hoje, caro amanhã</text>
<text x="272" y="286" text-anchor="middle" class="d-small">torne reversível</text>
<rect x="410" y="190" width="264" height="134" rx="10" class="d-box-accent"/>
<text x="542" y="245" text-anchor="middle" class="d-title">Só faça</text>
<text x="542" y="268" text-anchor="middle" class="d-small">o time decide</text>
<text x="542" y="286" text-anchor="middle" class="d-small">sem cerimônia</text>
<line x1="140" y1="336" x2="672" y2="336" class="d-line" marker-end="url(#evo-d2-arrow)"/>
<text x="140" y="354" text-anchor="start" class="d-small">difícil de reverter</text>
<text x="674" y="354" text-anchor="end" class="d-small">fácil de reverter</text>
<text x="407" y="372" text-anchor="middle" class="d-label">REVERSIBILIDADE</text>
</svg>
</div>
<figcaption>Figura 2: Ajuste a cerimônia de cada decisão ao impacto e à reversibilidade dela</figcaption>
</figure>

O quadrante de baixo à esquerda é o mais traiçoeiro. Decisões pequenas, com cara de inofensivas, que viram permanentes sem ninguém perceber: uma data gravada como texto numa tabela que dez serviços leem, um formato de evento interno que todo mundo copia, um ID gerado de um jeito que vaza para as URLs. Ninguém escreve ADR para isso, e cinco anos depois custa uma migração.

E aqui está a jogada de arquiteto de verdade: **transformar portas de mão única em portas de mão dupla**. Coloque o banco atrás de uma camada de repositório. Versione a API pública desde o primeiro dia. Deixe o código específico de fornecedor atrás de um *adapter*. Você paga um pouquinho agora para comprar o direito de mudar de ideia depois.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior pensativo" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Entendi! Então o truque é adiar toda decisão o máximo possível. Ninguém pode me culpar por uma decisão que eu nunca tomei!"</span>
    </div>
  </div>
</div>

Boa tentativa, Júnior, mas não. Não decidir também é uma decisão, e geralmente a pior, porque ela é tomada por omissão, por quem escrever o código primeiro, sem pensar em nada. O último momento *responsável* tem prazo. E para decisões baratas de reverter, adiar é puro desperdício: escolha algo razoável, coloque em produção e aprenda. Guarde a reflexão demorada para as portas de mão única.

## Fitness functions: guardrails para a mudança

Esta é a parte que separa a arquitetura evolutiva do "a gente refatora quando dá vontade". Se a arquitetura vai mudar o tempo todo, como saber se ela continua saudável? Como impedir que mil mudanças pequenas, todas com cara de razoáveis, destruam a estrutura aos poucos?

A resposta de Ford, Parsons e Kua é a **fitness function arquitetural** (algo como "função de aptidão"): uma verificação objetiva, de preferência automatizada, de quanto o sistema atende a uma característica arquitetural. O nome vem da computação evolutiva, onde uma *fitness function* mede o quão perto uma solução candidata está do objetivo.

Traduzindo: você pega as regras arquiteturais que normalmente moram numa página da wiki que ninguém lê ("a camada de domínio não pode depender da camada web", "a página de checkout precisa carregar em menos de dois segundos", "nenhum serviço acessa o banco de outro serviço") e transforma em **testes que rodam no pipeline**. Quando uma mudança quebra uma regra, o build falha, igualzinho a um teste unitário.

<div class="callout info">
  <p>Uma <em>fitness function</em> transforma uma intenção arquitetural em uma verificação executável. É a diferença entre <strong>torcer</strong> para que a arquitetura seja respeitada e <strong>saber</strong> que ela é, a cada commit.</p>
</div>

### Tipos de fitness functions

| Tipo | O que verifica | Exemplo |
| :--- | :--- | :--- |
| **Estrutural (regras de dependência)** | Camadas, fronteiras de módulos, dependências proibidas, ciclos | ArchUnit (Java), NetArchTest (.NET), dependency-cruiser (JavaScript) quebrando o build quando o domínio importa a camada de infraestrutura |
| **Orçamentos de performance** | Latência, vazão, tamanho do *bundle*, peso da página | Um teste de carga no pipeline que falha se o p95 passar de 300 ms; um orçamento de front-end que falha se o *bundle* JavaScript passar de 200 KB |
| **Segurança** | Dependências vulneráveis, segredos, configurações inseguras | Varredura de dependências e detecção de segredos como etapas bloqueantes do pipeline |
| **Operabilidade** | Presença de *health checks*, logs, métricas, *traces* | Um teste de contrato que falha se um serviço novo não expõe endpoints de saúde e de métricas |
| **Dados e contratos** | Compatibilidade de schema e de API | Testes de contrato orientados ao consumidor; uma verificação que bloqueia mudanças incompatíveis num schema de evento publicado |
| **Custo** | Tamanho de recursos, *tags*, gasto por unidade | *Policy as Code* que rejeita recursos sem *tag* ou SKUs superdimensionados fora de produção |
| **Holística (em produção)** | Comportamento do sistema rodando | Alertas de *burn rate* de SLO; experimentos de caos que verificam se o sistema sobrevive à perda de uma instância |

Algumas *fitness functions* são **atômicas** (verificam uma coisa só, como uma regra de dependência) e outras são **holísticas** (verificam uma combinação, como "o sistema continua dentro do SLO de latência durante a falha de uma zona"). Algumas rodam **a cada commit**, outras **agendadas**, outras **continuamente em produção**. Você precisa de uma mistura.

### Como adotar fitness functions

### 1. Comece pelas características que realmente importam

**Objetivo:** proteger as poucas qualidades arquiteturais que mais doeriam se degradassem.

Não tente automatizar todas as regras no primeiro dia. Pergunte ao time: "Qual propriedade arquitetural, se fosse se desgastando em silêncio, mais daria dor de cabeça daqui a um ano?" Pode ser a separação entre contextos delimitados, pode ser a latência do checkout, pode ser a ausência de ciclos entre módulos. Comece por aí.

**Benefício:** retorno rápido sobre o esforço e um time que enxerga o valor antes de precisar manter dezenas de verificações.

### 2. Faça rodar no pipeline, não num slide

**Objetivo:** regras arquiteturais aplicadas por máquinas, em toda mudança.

Uma regra que só existe num documento vai ser quebrada no primeiro prazo apertado. Uma regra que quebra o build é respeitada, ou é alterada conscientemente depois de uma conversa, o que é igualmente bom.

**Benefício:** revisões de arquitetura deixam de ser caça a violações e passam a ser sobre tomar decisões melhores.

### 3. Trate uma fitness function falhando como conversa, não como muro

**Objetivo:** manter as regras vivas e relevantes.

Às vezes a regra está certa e o código precisa mudar. Às vezes a regra ficou velha e a arquitetura precisa evoluir. As duas coisas são normais, desde que a decisão seja explícita e registrada. O que não pode é desligar a verificação na surdina "só para este release".

**Benefício:** as *fitness functions* evoluem junto com a arquitetura, em vez de virarem um museu de opiniões antigas.

### 4. Inclua sinais de produção

**Objetivo:** verificar a arquitetura onde ela realmente vive.

O pipeline testa o que você previu. A produção mostra o que de fato acontece. SLOs, *error budgets*, custo por transação e percentis de latência também são *fitness functions*, e são as que o cliente sente. É aqui que o design evolutivo encontra o [Observability First](/pt-br/principles/solution/observability-first/).

**Benefício:** você detecta desvios arquiteturais que nenhum teste estático enxergaria, como uma integração tagarela que só dói sob carga real.

## Mudança incremental com ciclos de feedback

As *fitness functions* dizem se uma mudança é segura. A outra metade do princípio é fazer mudanças **pequenas e frequentes**, para que cada uma gere *feedback* rápido. É o clássico ciclo *build, measure, learn* (construir, medir, aprender), aplicado à arquitetura e não só às funcionalidades do produto.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 740 295" role="img" aria-labelledby="evo-d3-title evo-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="evo-d3-title">O ciclo da evolução</title>
<desc id="evo-d3-desc">Uma mudança pequena passa por build e testes, depois por fitness functions que quebram o build se uma regra arquitetural for violada, depois por um deploy atrás de uma feature flag e por medição com métricas DORA e SLOs. O que é medido alimenta uma etapa de aprender e decidir, que molda a próxima mudança pequena.</desc>
<defs><marker id="evo-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="370" y="30" text-anchor="middle" class="d-label">O CICLO DA EVOLUÇÃO</text>
<rect x="20" y="70" width="120" height="80" rx="10" class="d-box"/>
<text x="80" y="104" text-anchor="middle" class="d-title">Mudança</text>
<text x="80" y="126" text-anchor="middle" class="d-small">uma ideia por vez</text>
<line x1="140" y1="110" x2="163" y2="110" class="d-line" marker-end="url(#evo-d3-arrow)"/>
<rect x="165" y="70" width="120" height="80" rx="10" class="d-box"/>
<text x="225" y="104" text-anchor="middle" class="d-title">Build + teste</text>
<text x="225" y="126" text-anchor="middle" class="d-small">unit, contrato</text>
<line x1="285" y1="110" x2="308" y2="110" class="d-line" marker-end="url(#evo-d3-arrow)"/>
<rect x="310" y="70" width="120" height="80" rx="10" class="d-box-accent"/>
<text x="370" y="98" text-anchor="middle" class="d-title">Fitness</text>
<text x="370" y="116" text-anchor="middle" class="d-title">functions</text>
<text x="370" y="137" text-anchor="middle" class="d-small">regras de design</text>
<line x1="430" y1="110" x2="453" y2="110" class="d-line" marker-end="url(#evo-d3-arrow)"/>
<rect x="455" y="70" width="120" height="80" rx="10" class="d-box"/>
<text x="515" y="104" text-anchor="middle" class="d-title">Deploy</text>
<text x="515" y="126" text-anchor="middle" class="d-small">atrás de flag</text>
<line x1="575" y1="110" x2="598" y2="110" class="d-line" marker-end="url(#evo-d3-arrow)"/>
<rect x="600" y="70" width="120" height="80" rx="10" class="d-box"/>
<text x="660" y="104" text-anchor="middle" class="d-title">Medição</text>
<text x="660" y="126" text-anchor="middle" class="d-small">DORA, SLOs</text>
<text x="370" y="172" text-anchor="middle" class="d-small">quebra o build se violada</text>
<polyline points="660,150 660,220 462,220" fill="none" class="d-line-dashed" marker-end="url(#evo-d3-arrow)"/>
<rect x="280" y="195" width="180" height="50" rx="10" class="d-box-info"/>
<text x="370" y="217" text-anchor="middle" class="d-text">Aprender + decidir</text>
<text x="370" y="235" text-anchor="middle" class="d-small">ajustar o design</text>
<polyline points="280,220 80,220 80,153" fill="none" class="d-line-dashed" marker-end="url(#evo-d3-arrow)"/>
<text x="370" y="278" text-anchor="middle" class="d-small">Cada volta é curta: horas ou dias, não trimestres</text>
</svg>
</div>
<figcaption>Figura 3: Mudanças pequenas, guardrails automáticos e medições reais alimentam a próxima decisão de design</figcaption>
</figure>

Quanto mais curto esse ciclo, mais barato é errar. Se uma volta leva um trimestre, uma decisão ruim custa um trimestre. Se leva um dia, custa um dia. Por isso o design evolutivo está tão ligado a integração contínua, entrega contínua e às práticas descritas em [Excelência operacional](/pt-br/principles/cloud/operational-excellence/): sem elas, o ciclo é lento demais para a arquitetura evoluir com segurança.

### Métricas que guiam a evolução

Como saber se a sua arquitetura está ficando mais fácil ou mais difícil de mudar? Opinião não basta. O programa de pesquisa por trás do livro *Accelerate* e dos relatórios anuais do DORA identificou um pequeno conjunto de métricas que se correlacionam tanto com a performance de entrega quanto com os resultados da organização:

| Métrica | O que ela revela sobre a arquitetura |
| :--- | :--- |
| **Frequência de deploy** | Com que frequência você consegue entregar. Frequência baixa costuma indicar acoplamento: coisas demais precisam ir juntas para produção. |
| **Lead time de mudanças** | Tempo do commit até a produção. *Lead time* longo aponta para pipelines lentos, aprovações manuais ou dependências emaranhadas. |
| **Taxa de falha de mudanças** | Proporção de deploys que causam falha. Taxa alta sugere falta de testes, falta de *fitness functions* ou mudanças grandes demais. |
| **Tempo de restauração do serviço** | A velocidade da recuperação. Recuperação lenta aponta para pouca observabilidade e nenhum *rollback* fácil. |

Não são números de vaidade para enfeitar dashboard. Olhe a **tendência**. Se o *lead time* cresce trimestre após trimestre enquanto o tamanho do time continua o mesmo, a arquitetura está acumulando atrito, e esse é o sinal para investir em desacoplamento antes da próxima grande funcionalidade.

## Técnicas para mudar um sistema em funcionamento

A evolução acontece com o sistema em produção e os clientes usando. Não dá para parar o avião para trocar as turbinas, então você precisa de técnicas que permitam que o antigo e o novo convivam com segurança.

### 1. Strangler Fig

O nome, dado por Martin Fowler, vem das figueiras estranguladoras, que crescem em volta de uma árvore hospedeira até substituí-la. Você coloca uma **fachada** (um roteador, *gateway* ou *proxy*) na frente do sistema legado e move uma capacidade de cada vez para a nova implementação. A fachada decide para onde vai cada requisição. Com o tempo, o legado encolhe até poder ser desligado.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 320" role="img" aria-labelledby="evo-d4-title evo-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="evo-d4-title">Progressão de um strangler fig</title>
<desc id="evo-d4-desc">Três etapas de uma migração atrás de uma fachada. Na etapa um, uma única fatia vai para o sistema novo e o legado ainda atende a maior parte do tráfego. Na etapa dois, cerca de metade já migrou, junto com a posse dos dados. Na etapa três, os serviços novos atendem tudo e o legado é desligado.</desc>
<defs><marker id="evo-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="120" y="38" text-anchor="middle" class="d-label">ETAPA 1</text>
<text x="360" y="38" text-anchor="middle" class="d-label">ETAPA 2</text>
<text x="600" y="38" text-anchor="middle" class="d-label">ETAPA 3</text>
<rect x="20" y="55" width="200" height="40" rx="10" class="d-box-info"/>
<text x="120" y="80" text-anchor="middle" class="d-text">Fachada / roteador</text>
<rect x="260" y="55" width="200" height="40" rx="10" class="d-box-info"/>
<text x="360" y="80" text-anchor="middle" class="d-text">Fachada / roteador</text>
<rect x="500" y="55" width="200" height="40" rx="10" class="d-box-info"/>
<text x="600" y="80" text-anchor="middle" class="d-text">Fachada / roteador</text>
<line x1="120" y1="95" x2="120" y2="118" class="d-line" marker-end="url(#evo-d4-arrow)"/>
<line x1="360" y1="95" x2="360" y2="118" class="d-line" marker-end="url(#evo-d4-arrow)"/>
<line x1="600" y1="95" x2="600" y2="118" class="d-line" marker-end="url(#evo-d4-arrow)"/>
<rect x="20" y="120" width="168" height="38" rx="10" class="d-box-warn"/>
<text x="104" y="144" text-anchor="middle" class="d-small">legado</text>
<rect x="190" y="120" width="30" height="38" rx="10" class="d-box-accent"/>
<rect x="260" y="120" width="99" height="38" rx="10" class="d-box-warn"/>
<text x="309" y="144" text-anchor="middle" class="d-small">legado</text>
<rect x="361" y="120" width="99" height="38" rx="10" class="d-box-accent"/>
<text x="410" y="144" text-anchor="middle" class="d-small">novo</text>
<rect x="500" y="120" width="200" height="38" rx="10" class="d-box-accent"/>
<text x="600" y="144" text-anchor="middle" class="d-small">serviços novos</text>
<line x1="226" y1="139" x2="254" y2="139" class="d-line-accent" marker-end="url(#evo-d4-arrow)"/>
<line x1="466" y1="139" x2="494" y2="139" class="d-line-accent" marker-end="url(#evo-d4-arrow)"/>
<text x="120" y="182" text-anchor="middle" class="d-small">legado 85%, novo 15%</text>
<text x="360" y="182" text-anchor="middle" class="d-small">legado 50%, novo 50%</text>
<text x="600" y="182" text-anchor="middle" class="d-small">legado 0%, novo 100%</text>
<text x="120" y="218" text-anchor="middle" class="d-title">Primeira fatia</text>
<text x="360" y="218" text-anchor="middle" class="d-title">Metade migrada</text>
<text x="600" y="218" text-anchor="middle" class="d-title">Legado desligado</text>
<text x="120" y="240" text-anchor="middle" class="d-small">uma rota, canário</text>
<text x="360" y="240" text-anchor="middle" class="d-small">dados com novo dono</text>
<text x="600" y="240" text-anchor="middle" class="d-small">é só desligar</text>
<text x="360" y="292" text-anchor="middle" class="d-small">Cada etapa entrega valor em produção e tem seu próprio rollback</text>
</svg>
</div>
<figcaption>Figura 4: Uma migração strangler fig substitui o legado uma fatia de cada vez</figcaption>
</figure>

É exatamente o que a empresa da nossa história da reescrita deveria ter feito. Cada fatia vai para produção, entrega valor, gera *feedback* e pode ser revertida trocando uma rota. Escrevi um guia prático completo sobre isso em [O plano Strangler Fig](/pt-br/blog/strangler-fig-migration/).

### 2. Branch by Abstraction

Quando o que você precisa substituir mora **dentro** do código (um ORM, o cliente de um provedor de pagamentos, uma biblioteca de log), não dá para colocar um roteador na frente. O *Branch by Abstraction* resolve isso:

1. Crie uma abstração (uma interface) em volta do componente que você quer substituir;
2. Faça todos os chamadores usarem a abstração em vez do componente concreto;
3. Construa a nova implementação atrás da mesma abstração;
4. Migre os chamadores aos poucos (muitas vezes com uma *flag*) até a implementação antiga ficar sem usuários;
5. Apague a implementação antiga, e a abstração também, se ela não se pagar mais.

O ponto-chave: a branch principal continua pronta para release **o tempo todo**. Nada de *feature branch* de vida longa que leva três semanas para ser mesclada e quebra tudo quando finalmente é.

### 3. Feature flags

*Feature flags* (ou *toggles*) separam **implantar** código de **liberar** comportamento. O código vai para produção desligado, e você liga para usuários internos, depois para 1% dos clientes, depois 10%, depois todo mundo. Se algo der errado, é só desligar de novo, sem novo deploy.

Para a arquitetura, as *flags* permitem rodar o caminho antigo e o novo lado a lado, comparar resultados e migrar com confiança.

### 4. Execução paralela

Para lógica crítica (precificação, cálculo de impostos, conciliação financeira), dá para rodar a implementação antiga e a nova **ao mesmo tempo**, entregar ao cliente o resultado da antiga e comparar as duas em segundo plano. Quando as diferenças ficam zeradas por tempo suficiente, você troca. Custa processamento extra, mas para mudanças de alto risco é uma pechincha.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior empolgado" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Feature flag é sensacional! Vou colocar flag em tudo. Aí nunca mais quebro nada, né?"</span>
    </div>
  </div>
</div>

Calma aí, Júnior! *Flags* são poderosas, mas cada uma é um pequeno desvio no código que alguém precisa entender, testar e, um dia, remover. Um código com trezentas *flags* esquecidas tem 2<sup>300</sup> combinações teóricas, e ninguém sabe quais estão realmente rodando em produção. Toda *flag* precisa de um **dono**, uma **data de validade** e uma **tarefa de limpeza** criada no mesmo dia em que a *flag* nasce. *Flags* de release deveriam durar semanas, não anos. É o que chamamos de **dívida de flags**, e é dívida de verdade, com juros de verdade.

## Modularidade e baixo acoplamento: os verdadeiros habilitadores

Todas essas técnicas dependem de uma coisa: conseguir mudar uma parte do sistema **sem mudar todo o resto**. É isso que modularidade e baixo acoplamento entregam.

Um sistema em que cada módulo mexe nas entranhas de todos os outros não consegue evoluir de forma incremental, porque não existem incrementos. Toda mudança é uma mudança grande. É por isso que o "monólito distribuído" dói tanto: você tem todo o custo operacional de microsserviços e nenhuma independência, porque os serviços continuam tendo que ir juntos para produção.

Algumas formas práticas de manter a arquitetura evoluível:

| Abordagem | Benefício |
| :--- | :--- |
| **Desenhe fronteiras em torno de capacidades de negócio.** Use modelagem de domínio para achar onde um contexto termina e outro começa (veja [Contextos delimitados](/pt-br/principles/solution/bounded-contexts/)). | Mudanças numa área de negócio ficam dentro de um módulo, e os times andam de forma independente. |
| **Comunique por contratos explícitos.** APIs e eventos com schemas versionados, nunca tabelas de banco compartilhadas. | Dá para trocar a implementação atrás de um contrato sem os consumidores perceberem. |
| **Esconda decisões voláteis atrás de interfaces.** Fornecedores, mecanismos de armazenamento, APIs externas. | Transforma portas de mão única em portas de mão dupla com um custo inicial pequeno. |
| **Prefira um monólito modular antes de microsserviços.** Fronteiras internas fortes, uma única unidade de deploy. | Você ganha evolutividade sem pagar o imposto dos sistemas distribuídos antes da hora, e pode extrair serviços depois, seguindo fronteiras já comprovadas. |
| **Garanta as fronteiras com fitness functions.** Regras de dependência no pipeline. | As fronteiras não se desgastam em silêncio sob pressão de prazo. |

<div class="callout tip">
  <p>Um bom teste de evolutividade: pegue uma funcionalidade real do último trimestre e conte quantos módulos, repositórios e times ela envolveu. Se a resposta for "quase todos", a sua arquitetura está resistindo à mudança, por mais moderna que a <em>stack</em> pareça.</p>
</div>

## Architecture Decision Records: lembre o porquê

Design evolutivo significa que decisões serão revisitadas. Isso só funciona se as pessoas souberem **por que** a decisão foi tomada. Caso contrário, você cai num de dois resultados ruins: ninguém tem coragem de mudar nada ("deve ter tido um motivo"), ou alguém muda e reintroduz exatamente o problema que a decisão original resolvia.

Um **Architecture Decision Record (ADR)** é um documento curto, normalmente um arquivo markdown no próprio repositório, que registra uma decisão:

- **Contexto:** que situação e que forças levaram à decisão;
- **Decisão:** o que foi escolhido;
- **Alternativas consideradas:** e por que foram descartadas;
- **Consequências:** o lado bom, o lado ruim e os *trade-offs* aceitos;
- **Status:** proposto, aceito, substituído (com link para o ADR mais novo).

ADRs são baratos, versionados junto com o código e revisados em *pull requests* como todo o resto. Quando uma decisão muda, você não apaga o ADR antigo; escreve um novo que o substitui. A história da arquitetura fica legível, e quem chega no time entende o formato do sistema sem precisar de uma expedição arqueológica.

Escreva ADRs para as portas de mão única e para as portas de mão dupla importantes. Não precisa de um para cada atualização de biblioteca.

## YAGNI versus desenhar para a mudança

*You Aren't Gonna Need It* (YAGNI, algo como "você não vai precisar disso") é um dos pilares do design evolutivo: não construa funcionalidades nem abstrações para necessidades que você só imagina. Toda abstração especulativa tem custo: código para manter, conceitos para aprender, indireção para depurar. E na maioria das vezes o futuro para o qual você se preparou nunca chega, ou chega com uma cara diferente da esperada.

Só que o YAGNI é muitas vezes mal interpretado como "nunca pense no futuro". Não é isso. A distinção é sutil, mas importante:

- **Generalidade especulativa** (ruim): construir um sistema de *plugins* porque "um dia talvez a gente suporte outros provedores de pagamento", quando existe um provedor só e nenhum plano para outro;
- **Desenhar para a mudança** (bom): manter o provedor de pagamento atrás de uma interface limpa, o que custa quase nada e deixa a mudança futura barata, se um dia ela vier.

A regra de bolso: não construa o futuro, mas também **não o bloqueie**. Mantenha o código limpo, as fronteiras claras e os testes bons, e a maior parte das mudanças futuras fica viável sem que você precise tê-las previsto.

<div class="callout info">
  <p>A melhor preparação para um futuro desconhecido não é um framework flexível. É um código <strong>fácil de mudar</strong>: bem testado, pouco acoplado e simples. Simplicidade é a arquitetura mais à prova de futuro que existe.</p>
</div>

## Dívida técnica como ferramenta consciente

Dívida técnica nem sempre é pecado. Assim como a dívida financeira, ela pode ser um **investimento inteligente** quando assumida conscientemente: você entrega mais rápido agora, valida uma hipótese de mercado e paga depois. O problema é a dívida assumida sem saber, e a dívida que nunca é paga.

O *Technical Debt Quadrant* de Martin Fowler é um jeito útil de pensar nisso, cruzando *deliberada versus inadvertida* com *prudente versus imprudente*:

- **Deliberada e prudente:** "Sabemos que isso não escala além de dez mil usuários, mas precisamos lançar e aprender. Revisitamos quando chegarmos a cinco mil." Isso é saudável;
- **Deliberada e imprudente:** "Não temos tempo para design." É assim que começa a grande bola de lama;
- **Inadvertida e imprudente:** o time não conhecia boas práticas e não fez questão de aprender;
- **Inadvertida e prudente:** "Agora que construímos, entendemos como deveríamos ter construído." Acontece com todo mundo, e é justamente por isso que a evolução importa.

Tornar a dívida uma ferramenta consciente significa:

1. **Registrar** quando ela é assumida (um ADR, um ticket, um comentário com link), junto com o gatilho que vai fazer você pagá-la;
2. **Deixar visível** no backlog, e não escondida na cabeça de alguém;
3. **Reservar capacidade** para amortizar continuamente (muitos times usam uma fatia fixa de cada iteração), em vez de esperar uma "sprint de refatoração" que nunca é aprovada;
4. **Acompanhar os juros**: se o *lead time* e a taxa de falha de mudanças estão crescendo numa área, a dívida ali está cobrando juros, e é hora de pagar.

## Tradeoffs

O design evolutivo é poderoso, mas não é de graça. Como todo princípio, ele puxa contra outros, e fingir que não é assim é o caminho mais curto para a decepção. Bora ver as principais tensões?

### Velocidade no curto prazo versus integridade estrutural

A pressão do dia a dia é sempre para entregar a funcionalidade agora. Escrever *fitness functions*, manter as fronteiras limpas e pagar dívida competem com isso. Pule essas coisas por tempo demais e você escorrega para o "sem design"; exagere e você volta ao BDUF com etapas extras. O equilíbrio muda com o tempo: um produto em estágio inicial, validando mercado, aceita mais dívida do que uma plataforma madura com centenas de clientes.

### O custo de manter opções abertas

Toda abstração que mantém uma porta de mão dupla tem preço: mais código, mais indireção, às vezes um pouco de performance. Manter *todas* as opções abertas é uma forma de *over-engineering* por si só. Mantenha opções abertas apenas onde a probabilidade de mudança multiplicada pelo custo da mudança justifique.

### Tradeoffs com Confiabilidade (Reliability)

Mudanças frequentes e incrementais significam mais deploys, e cada um é uma oportunidade de falha. Sem automação sólida, observabilidade e *rollback*, "evoluir continuamente" vira "quebrar continuamente". Os períodos de convivência (fachadas *strangler*, execução paralela, escrita dupla) também adicionam peças móveis e novos modos de falha. As práticas de [Confiabilidade](/pt-br/principles/cloud/reliability/) são pré-requisito, não detalhe.

### Tradeoffs com Segurança (Security)

Cada *flag*, fachada e caminho de transição é mais superfície a proteger. Sistemas antigo e novo rodando em paralelo podem ter modelos de segurança diferentes, e a costura entre eles é um lugar clássico para brechas. As *fitness functions* ajudam aqui também: verificações de segurança pertencem ao mesmo pipeline (veja [Security Shift-Left](/pt-br/principles/solution/security-shift-left/)).

### Tradeoffs com Otimização de Custos (Cost Optimization)

Rodar legado e novo lado a lado durante uma migração significa pagar pelos dois. Execução paralela dobra o processamento da lógica em teste. Pipelines cheios de *fitness functions*, testes de carga e testes de contrato consomem minutos de build. Esses custos costumam ser bem menores que uma reescrita fracassada, mas precisam estar no orçamento e ter prazo, senão a convivência "temporária" vira permanente.

### Tradeoffs com Eficiência de Performance (Performance Efficiency)

Abstrações, fachadas e *adapters* adicionam latência e saltos de rede. Uma fachada *strangler* é mais uma chamada em cada requisição. Normalmente é desprezível, às vezes não. Orçamentos de performance como *fitness functions* mantêm isso visível, para que o custo da evolutividade nunca cresça em silêncio.

### Tradeoffs com Excelência Operacional (Operational Excellence)

*Flags*, múltiplas versões e sistemas convivendo aumentam a carga cognitiva de quem opera. "Em que versão está esse cliente? Essa *flag* está ligada nessa região?" Sem disciplina (dono para cada *flag*, limpeza, dashboards claros), a complexidade operacional cresce mais rápido que o próprio sistema.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Então desenhar tudo antes é ruim, não desenhar é ruim, e evoluir também tem custo. Como eu sei que estou fazendo certo?"</span>
    </div>
  </div>
</div>

Bem-vindo à arquitetura, Júnior! Não existe configuração certa para sempre. Você sabe que está no caminho certo quando as mudanças continuam baratas ao longo do tempo: o *lead time* está estável ou caindo, os deploys são entediantes, o time não tem medo de mexer em código antigo e ninguém está marcando a reunião da "grande reescrita". Os *trade-offs* não somem; você só passa a fazê-los conscientemente, registra em ADRs e revisita quando o contexto muda.

## Conclusão

O **Design Evolutivo** aceita uma verdade simples: você nunca vai saber tão pouco sobre o seu sistema quanto no primeiro dia. Então, em vez de apostar tudo num plano antecipado, você desenha o suficiente para começar, decide no último momento responsável e deixa o *feedback* real moldar a arquitetura ao longo do tempo.

Não é ausência de design. É design apoiado por **guardrails**: *fitness functions* que transformam regras arquiteturais em verificações automáticas, ciclos de *feedback* curtos o bastante para deixar o erro barato, técnicas como *strangler fig* e *branch by abstraction* para mudar um sistema em funcionamento com segurança, modularidade que mantém as mudanças locais e ADRs que lembram por que as coisas são do jeito que são.

**Mais importante:** o design evolutivo é o que te mantém longe da armadilha do "reescrever do zero". Um sistema que evolui continuamente nunca fica tão ruim a ponto de jogá-lo fora parecer a única saída.

## Próximos Passos

1. **Mapeie suas portas de mão única**
Liste as decisões do seu sistema que seriam muito caras de reverter. Verifique se cada uma tem um ADR e se algumas poderiam se tornar reversíveis com uma pequena abstração.

2. **Escreva sua primeira fitness function**
Escolha a regra arquitetural que mais dói quando é quebrada (uma dependência entre camadas, um orçamento de latência, uma fronteira de módulo) e faça ela quebrar o build. Uma verificação real vale mais que cinquenta regras numa wiki.

3. **Comece a medir as métricas DORA**
Frequência de deploy, *lead time*, taxa de falha de mudanças e tempo de restauração. Acompanhe a tendência a cada trimestre e use-a para decidir onde investir em desacoplamento.

4. **Adote ADRs**
Crie uma pasta `adr` no repositório e registre a próxima decisão relevante. Depois a seguinte.

5. **Troque a próxima reescrita por um plano strangler**
Se existe um sistema legado que todo mundo quer reescrever, desenhe a fachada e a primeira fatia. Coloque em produção, aprenda, repita.

6. **Coloque as flags de dieta**
Dê a cada *feature flag* um dono e uma data de validade, e remova as que já foram liberadas para todos.

<div class="callout info" data-title="Referências">
  <ul>
    <li><a href="https://evolutionaryarchitecture.com/" target="_blank" rel="noopener">Building Evolutionary Architectures (Ford, Parsons, Kua)</a></li>
    <li><a href="https://martinfowler.com/articles/designDead.html" target="_blank" rel="noopener">Martin Fowler: Is Design Dead?</a></li>
    <li><a href="https://martinfowler.com/bliki/StranglerFigApplication.html" target="_blank" rel="noopener">Martin Fowler: Strangler Fig Application</a></li>
    <li><a href="https://martinfowler.com/bliki/BranchByAbstraction.html" target="_blank" rel="noopener">Martin Fowler: Branch By Abstraction</a></li>
    <li><a href="https://martinfowler.com/articles/feature-toggles.html" target="_blank" rel="noopener">Pete Hodgson: Feature Toggles (aka Feature Flags)</a></li>
    <li><a href="https://martinfowler.com/bliki/TechnicalDebtQuadrant.html" target="_blank" rel="noopener">Martin Fowler: Technical Debt Quadrant</a></li>
    <li><a href="https://dora.dev/" target="_blank" rel="noopener">DORA: DevOps Research and Assessment</a></li>
    <li><a href="https://www.archunit.org/" target="_blank" rel="noopener">ArchUnit</a></li>
    <li><a href="https://adr.github.io/" target="_blank" rel="noopener">Architecture Decision Records</a></li>
    <li><a href="https://learn.microsoft.com/azure/well-architected/" target="_blank" rel="noopener">Microsoft Azure Well-Architected Framework</a></li>
  </ul>
</div>
