---
title: Eficiência de desempenho
short: "Rápido para o usuário, enxuto nos recursos e pronto para crescer: desempenho é requisito que se projeta, não milagre que se pede em produção."
category: cloud
---

## Introdução

Eficiência de desempenho é a capacidade do seu *workload* de **atender à demanda com os recursos que tem**, e de continuar atendendo quando essa demanda cresce, diminui ou muda de formato. Não se trata de ser "o sistema mais rápido do mundo". Trata-se de ser **rápido o suficiente, para os usuários certos, pelo custo certo**, e continuar assim ao longo do tempo.

Repare na palavra *eficiência*. Qualquer um deixa um sistema mais rápido jogando dinheiro em cima dele: máquinas maiores, mais réplicas, SKUs *premium* em tudo. O desafio de verdade é entregar o desempenho que o negócio precisa **sem desperdício**, sabendo exatamente para onde está indo cada milissegundo e cada vCPU.

Quando um time ignora este pilar, os sintomas são bem conhecidos:

- Ninguém sabe o que "rápido" significa para o produto, então toda reclamação vira discussão baseada em achismo;
- O sistema voa com dez usuários e cai com mil;
- Black Friday, campanha de marketing ou uma menção em um podcast famoso vira incidente em vez de comemoração;
- Escalar significa "ligar para alguém às 2 da manhã para redimensionar o banco na mão";
- A fatura mensal cresce mais rápido que a base de usuários, porque a resposta para toda lentidão foi uma máquina maior;
- Problemas de desempenho só são descobertos em produção, pelo cliente, geralmente no pior dia possível;

Pois é, *é raro, mas acontece bastante*... Quem nunca ouviu a frase clássica no meio de um incidente em produção?

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Mas na minha máquina funciona! Eu testei e todas as telas abriram na hora."</span>
    </div>
  </div>
</div>

Ah, o famoso **"na minha máquina funciona, com 3 usuários"**. Deixa eu contar uma história que já aconteceu, com pequenas variações, em quase toda empresa por onde passei.

O time desenvolve uma nova tela de gestão de pedidos. No notebook do dev, com um banco local de 200 pedidos fictícios e exatamente três pessoas clicando (o dev, o QA e o PO), tudo abre num piscar de olhos. Demo aprovada, aplausos, deploy na sexta à tarde (claro).

Na segunda de manhã, 4.000 vendedores fazem login às 8h. A tabela de produção tem 30 milhões de linhas e nenhum índice na coluna que o novo filtro usa. Cada requisição faz um *full table scan*, o pool de conexões se esgota em minutos, as requisições começam a enfileirar, os *timeouts* se espalham para os outros serviços que compartilham o mesmo banco e a plataforma inteira se arrasta. O código estava *correto*. Ele só nunca tinha conhecido a realidade.

A lição: **desempenho é uma propriedade do sistema sob carga real, com dados reais, em um ambiente real**. O seu notebook não é nenhuma dessas três coisas.

<div class="callout info">
  <p>Eficiência de desempenho não é sobre micro-otimizações prematuras nem tecnologias exóticas. É sobre <strong>definir metas claras</strong>, <strong>projetar para escalar</strong>, <strong>testar sob carga realista</strong> e <strong>otimizar continuamente</strong> com base em dados, não em palpites.</p>
</div>

## Desempenho é requisito, não sensação

O primeiro passo é parar de falar de desempenho com adjetivos ("lento", "pesado", "rapidinho") e começar a falar com **números**. Um requisito de desempenho que não pode ser medido é só um desejo.

### A média mente, os percentis contam a verdade

O erro mais comum é olhar para o tempo de resposta **médio**. A média esconde os usuários que estão sofrendo. Se 99 requisições levam 100 ms e uma leva 10 segundos, a média fica em torno de 200 ms, e o *dashboard* fica lindo. Enquanto isso, aquele usuário (que provavelmente é o seu maior cliente, carregando uma conta enorme) está olhando para um *spinner*.

Por isso usamos **percentis**:

- **p50 (mediana):** metade das requisições é mais rápida que isso. É a experiência "típica";
- **p95:** 95% das requisições são mais rápidas que isso. É o que os usuários *não tão sortudos* veem;
- **p99:** 99% das requisições são mais rápidas que isso. É a cauda, onde mora a dor.

E a cauda importa mais do que parece. Uma única página muitas vezes dispara dezenas de chamadas ao *backend*. Se cada chamada tem 1% de chance de ser lenta, uma página com 50 chamadas tem uma chance enorme de esbarrar em pelo menos uma chamada lenta. Em escala, **o seu p99 vira a experiência típica dos seus usuários**.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 280" role="img" aria-labelledby="perf-d1-title perf-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="perf-d1-title">Média versus percentis para o mesmo endpoint</title>
<desc id="perf-d1-desc">Barras horizontais mostram a latência de um endpoint: média de 250 ms, p50 de 120 ms, p95 de 480 ms e p99 de 1.900 ms. Uma linha tracejada marca um SLO de 500 ms. A média e o p95 parecem ótimos, mas o p99 está quase quatro vezes acima da meta.</desc>
<text x="360" y="22" text-anchor="middle" class="d-label">LATÊNCIA DO MESMO ENDPOINT</text>
<text x="265" y="44" text-anchor="middle" class="d-small">SLO: 500 ms</text>
<line x1="265" y1="52" x2="265" y2="236" class="d-line-dashed"/>
<text x="128" y="79" text-anchor="end" class="d-text">Média</text>
<rect x="140" y="60" width="62" height="28" rx="4" class="d-fill-info"/>
<text x="210" y="79" class="d-small">250 ms</text>
<text x="128" y="124" text-anchor="end" class="d-text">p50</text>
<rect x="140" y="105" width="30" height="28" rx="4" class="d-fill-accent"/>
<text x="178" y="124" class="d-small">120 ms</text>
<text x="128" y="169" text-anchor="end" class="d-text">p95</text>
<rect x="140" y="150" width="120" height="28" rx="4" class="d-fill-warn"/>
<text x="274" y="169" class="d-small">480 ms</text>
<text x="128" y="214" text-anchor="end" class="d-text">p99</text>
<rect x="140" y="195" width="475" height="28" rx="4" class="d-fill-danger"/>
<text x="623" y="214" class="d-small">1.900 ms</text>
<line x1="140" y1="240" x2="640" y2="240" class="d-line"/>
<text x="140" y="258" text-anchor="middle" class="d-small">0</text>
<text x="265" y="258" text-anchor="middle" class="d-small">500</text>
<text x="390" y="258" text-anchor="middle" class="d-small">1000</text>
<text x="515" y="258" text-anchor="middle" class="d-small">1500</text>
<text x="640" y="258" text-anchor="middle" class="d-small">2000 ms</text>
</svg>
</div>
<figcaption>Figura 1: A média diz que está tudo bem; o p99 diz que uma a cada cem requisições é uma experiência ruim</figcaption>
</figure>

### As métricas que importam

| Métrica | O que ela mostra |
|---------|------------------|
| **Latência (p50/p95/p99)** | Quanto tempo o usuário espera. Meça sempre em percentis, por operação, nunca como média global. |
| **Vazão (*throughput*)** | Quanto trabalho o sistema conclui por unidade de tempo (requisições/s, mensagens/s, jobs/hora). |
| **Taxa de erro sob carga** | Um sistema rápido que devolve 5% de erros no pico não é rápido, é um sistema que quebra rápido. |
| **Saturação** | O quanto um recurso está "cheio" (CPU, memória, pool de conexões, profundidade de fila). Saturação é o aviso antecipado de um problema de latência. |
| **Concorrência** | Quantas requisições ou usuários estão sendo atendidos ao mesmo tempo. É o que derruba os sistemas que "funcionam com 3 usuários". |
| **Eficiência de recursos** | Quanto de computação, memória ou dinheiro custa cada unidade de trabalho (ex.: custo por 1.000 requisições). Essa é a parte da *eficiência* do pilar. |

### De números a metas: SLIs, SLOs e SLAs

Números sozinhos não ajudam se ninguém concorda sobre o que é "bom". O vocabulário popularizado pela prática de SRE do Google encaixa perfeitamente aqui:

- **SLI (*Service Level Indicator*):** a medição em si, ex.: "latência p95 da API de *checkout*";
- **SLO (*Service Level Objective*):** a meta interna, ex.: "p95 abaixo de 400 ms em 28 dias, em 99% das janelas de tempo";
- **SLA (*Service Level Agreement*):** a promessa contratual ao cliente, normalmente mais folgada que o SLO, com multas associadas.

Uma boa meta de desempenho é **específica para um fluxo do usuário** ("a busca retorna resultados em menos de 300 ms no p95 com 2.000 requisições por segundo"), e não um genérico "o sistema deve ser rápido". E ela precisa vir do negócio: o que o usuário espera, o que a concorrência oferece, quanto custa um *checkout* lento em carrinhos abandonados?

## A piada da otimização prematura

Com certeza você já ouviu, provavelmente em um *code review*: *"otimização prematura é a raiz de todo mal"*. A frase é do Donald Knuth e é uma das mais mal citadas da computação. A ideia completa é que não devemos perder tempo otimizando os 97% do código que não importam, **mas também não devemos desperdiçar as oportunidades naqueles 3% críticos**.

Na prática, os times costumam cair em um de dois buracos:

- **O micro-otimizador:** passa dois dias reescrevendo um *loop* para economizar 3 microssegundos em uma função que roda uma vez por dia, enquanto a página faz 400 consultas ao banco (o famoso N+1);
- **O "o Knuth disse":** usa a frase como desculpa permanente para nunca pensar em desempenho, até o sistema conhecer a produção e o "depois" chegar todo de uma vez, com juros.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"E aí, qual é? Eu otimizo tudo desde o primeiro dia ou deixo tudo para depois?"</span>
    </div>
  </div>
</div>

Nenhum dos dois, Júnior! O segredo é separar **decisões arquiteturais** de **ajustes de código**.

Decisões arquiteturais são caras de mudar depois: como os dados são particionados, se um componente é *stateless*, se um fluxo é síncrono ou assíncrono, qual banco de dados você escolhe. Nessas você pensa **cedo**, guiado pelas metas que acabou de definir. Isso não é otimização prematura, isso é design.

Ajustes de código (um *serializer* mais rápido, um *loop* mais esperto, uma *query* afinada na mão) são baratos de mudar depois. Esses você faz **quando uma medição mostrar** que aquele trecho específico é o gargalo. A regra de ouro: **primeiro meça, depois otimize**. O gargalo quase nunca está onde você acha que está.

## Princípios de design para Eficiência de desempenho

Com as metas definidas e a piada fora do caminho, vamos às práticas. Como nos outros pilares, cada uma vem com um objetivo e o benefício que traz.

### 1. Negocie metas de desempenho realistas

**Objetivo:** transformar "tem que ser rápido" em requisitos mensuráveis e combinados para cada fluxo crítico.

Metas de desempenho são **requisitos não funcionais** e merecem o mesmo cuidado de qualquer *feature*. Identifique os fluxos que realmente importam para o negócio (login, busca, *checkout*, geração de relatórios) e defina metas para cada um. Nem todo fluxo precisa da mesma meta: um *checkout* precisa ser rápido, já um relatório mensal pode levar um minuto, desde que o usuário saiba que ele está sendo processado.

| Abordagem | Benefício |
|-----------|-----------|
| **Mapeie os fluxos críticos** e ordene por impacto no negócio. | O esforço vai para onde está o valor, em vez de otimizar telas que ninguém usa. |
| **Defina metas em percentis** com a carga esperada (ex.: p95 abaixo de 300 ms a 1.500 req/s). | As metas ficam testáveis e objetivas, acabando com o debate do "tá parecendo lento". |
| **Combine as metas com o negócio** e revise quando o produto mudar. | Evita tanto o *over-engineering* (pagar por velocidade que ninguém pediu) quanto a entrega abaixo do esperado. |
| **Defina um orçamento de desempenho** por requisição, dividido entre os componentes do caminho. | Cada time sabe quantos milissegundos pode "gastar", e *gateways*, *sidecars* e saltos de rede param de comer o orçamento em silêncio. |

### 2. Planeje a capacidade antes da demanda chegar

**Objetivo:** saber quanta carga o sistema precisa aguentar, hoje e amanhã, e quanta capacidade isso exige.

Planejamento de capacidade não é chute. Ele começa com dados: tráfego atual, tendência de crescimento, sazonalidade (fechamento de mês, feriados, promoções), eventos de negócio planejados (um lançamento, um novo mercado, um comercial na TV). Com isso, você estima a carga de pico e os recursos necessários para cumprir as metas nesse pico, mais uma margem de segurança.

| Abordagem | Benefício |
|-----------|-----------|
| **Modele a demanda** usando histórico, sazonalidade e o *roadmap* do negócio. | Surpresas viram eventos previsíveis: ninguém descobre a Black Friday na Black Friday. |
| **Conheça a capacidade de cada componente** (requisições por instância, conexões por banco, vazão por partição). | Você encontra o primeiro gargalo no papel, não em produção. |
| **Verifique limites e cotas da plataforma** (cotas de vCPU, *throttling* de APIs, IOPS, máximo de conexões). | O *autoscaling* não te salva se a cota da assinatura te trava em 20 instâncias. |
| **Planeje para o pico, não para a média**, com folga para *failover* e deploys. | O sistema sobrevive ao dia que mais importa, mesmo com uma zona fora do ar ou um deploy em andamento. |

### 3. Escolha os serviços e SKUs certos

**Objetivo:** escolher a tecnologia e o nível de serviço que combinam com o comportamento real do *workload*.

A nuvem oferece dezenas de formas de rodar código e armazenar dados. Escolher bem é uma das maiores alavancas de desempenho que você tem, e ela é decidida cedo. Um *job batch* pesado em CPU, uma API sensível à latência e um processador de eventos com picos têm necessidades muito diferentes.

- **Computação:** VMs, *containers*, Kubernetes, funções *serverless*. *Serverless* é ótimo para trabalho orientado a eventos e com picos, mas tem *cold start*; cargas longas e estáveis costumam rodar melhor (e mais barato) em *containers* ou VMs;
- **Famílias de instância:** otimizadas para computação, memória, armazenamento, GPU. Um cache faminto por memória em uma VM otimizada para computação desperdiça dinheiro e ainda roda mal;
- **Armazenamento de dados:** relacional, documentos, chave-valor, colunar, motores de busca, séries temporais. Use o armazenamento certo para cada padrão de acesso, em vez de forçar tudo em um único banco;
- **Níveis e SKUs:** vazão, IOPS e limite de conexões normalmente dependem do nível contratado. Leia as letras miúdas, o limite que te morde raramente é a CPU.

Não chute: faça uma **prova de conceito** com carga representativa antes de se comprometer com um serviço. E lembre que serviços gerenciados transferem boa parte do trabalho de *tuning* para o provedor, o que muitas vezes é a escolha mais eficiente para um time pequeno. O lado financeiro dessa decisão está em [Otimização de custos](/pt-br/principles/cloud/cost-optimization/).

### 4. Projete para escalar

**Objetivo:** adicionar capacidade quando a demanda cresce e removê-la quando a demanda cai, sem reescrever o sistema.

Existem duas formas de escalar, e você precisa entender as duas:

- **Escala vertical (*scale up*):** uma máquina maior. Mais CPU, mais memória. Simples, sem mudar código, mas tem um teto rígido (o maior SKU disponível), normalmente exige reinício e um único nó grande continua sendo um ponto único de falha;
- **Escala horizontal (*scale out*):** mais máquinas dividindo a carga. Praticamente ilimitada e naturalmente resiliente, mas exige que a aplicação seja projetada para isso: instâncias **stateless**, sessões guardadas fora do processo, nada de arquivos locais que outras instâncias precisam.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 280" role="img" aria-labelledby="perf-d2-title perf-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="perf-d2-title">Escala vertical versus escala horizontal</title>
<desc id="perf-d2-desc">À esquerda, a escala vertical troca um nó de 4 vCPU por um único nó de 32 vCPU: simples, mas com teto rígido. À direita, a escala horizontal coloca um balanceador de carga na frente de vários nós idênticos, e novos nós podem ser adicionados automaticamente, o que exige um design stateless.</desc>
<defs><marker id="perf-d2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="185" y="30" text-anchor="middle" class="d-label">SCALE UP (VERTICAL)</text>
<text x="555" y="30" text-anchor="middle" class="d-label">SCALE OUT (HORIZONTAL)</text>
<rect x="50" y="90" width="90" height="60" rx="10" class="d-box"/>
<text x="95" y="118" text-anchor="middle" class="d-text">4 vCPU</text>
<text x="95" y="136" text-anchor="middle" class="d-small">nó</text>
<line x1="144" y1="120" x2="186" y2="120" class="d-line" marker-end="url(#perf-d2-arrow)"/>
<rect x="195" y="60" width="130" height="120" rx="10" class="d-box-accent"/>
<text x="260" y="116" text-anchor="middle" class="d-title">32 vCPU</text>
<text x="260" y="138" text-anchor="middle" class="d-small">o mesmo nó único</text>
<line x1="365" y1="50" x2="365" y2="260" class="d-line-dashed"/>
<rect x="475" y="60" width="160" height="44" rx="10" class="d-box-info"/>
<text x="555" y="87" text-anchor="middle" class="d-text">Balanceador</text>
<line x1="535" y1="104" x2="438" y2="146" class="d-line" marker-end="url(#perf-d2-arrow)"/>
<line x1="548" y1="104" x2="518" y2="146" class="d-line" marker-end="url(#perf-d2-arrow)"/>
<line x1="562" y1="104" x2="596" y2="146" class="d-line" marker-end="url(#perf-d2-arrow)"/>
<line x1="575" y1="104" x2="672" y2="146" class="d-line" marker-end="url(#perf-d2-arrow)"/>
<rect x="400" y="150" width="72" height="50" rx="10" class="d-box-accent"/>
<text x="436" y="180" text-anchor="middle" class="d-text">Nó 1</text>
<rect x="481" y="150" width="72" height="50" rx="10" class="d-box-accent"/>
<text x="517" y="180" text-anchor="middle" class="d-text">Nó 2</text>
<rect x="562" y="150" width="72" height="50" rx="10" class="d-box-accent"/>
<text x="598" y="180" text-anchor="middle" class="d-text">Nó 3</text>
<rect x="643" y="150" width="72" height="50" rx="10" class="d-box-muted"/>
<text x="679" y="180" text-anchor="middle" class="d-text">Nó N</text>
<text x="185" y="232" text-anchor="middle" class="d-small">Simples, sem mudar código</text>
<text x="185" y="252" text-anchor="middle" class="d-small">Teto rígido, reinício, nó único</text>
<text x="555" y="232" text-anchor="middle" class="d-small">Crescimento quase linear</text>
<text x="555" y="252" text-anchor="middle" class="d-small">Exige design stateless</text>
</svg>
</div>
<figcaption>Figura 2: Escalar verticalmente compra tempo; escalar horizontalmente compra futuro</figcaption>
</figure>

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Para que tanta complicação? Ficou lento, é só pegar a maior máquina do catálogo e pronto!"</span>
    </div>
  </div>
</div>

Calma aí, Júnior! Escalar verticalmente é um primeiro passo perfeitamente válido, e às vezes é o certo (um banco relacional, por exemplo, é bem mais fácil de escalar na vertical). Mas tem três problemas. Primeiro, o catálogo acaba: um dia não existe máquina maior. Segundo, no topo do catálogo o custo costuma crescer mais rápido que a capacidade. Terceiro, se o gargalo é um *lock*, um processo *single-thread* ou uma *query* ruim, uma máquina duas vezes maior deixa tudo... exatamente tão lento quanto antes. **Hardware não resolve problema de design, só adia a conta.**

As práticas que fazem a escala funcionar:

| Abordagem | Benefício |
|-----------|-----------|
| **Projete serviços *stateless***, mantendo sessão e estado em armazenamentos externos (cache, banco). | Qualquer instância atende qualquer requisição, então adicionar ou remover instâncias vira algo trivial. |
| **Use *autoscaling*** baseado em sinais que fazem sentido (CPU, profundidade de fila, requisições por instância, métricas customizadas), com mínimos e máximos sensatos. | A capacidade acompanha a demanda automaticamente, e o máximo protege tanto o orçamento quanto as dependências que estão atrás. |
| **Escale antes de eventos conhecidos** (*scheduled scaling*) em vez de depender só de regras reativas. | O *autoscaling* leva minutos; uma campanha que começa às 20h em ponto não espera. |
| **Defina unidades de escala (*scale units*)**: um grupo de recursos (app, cache, partição de banco) que escala junto, como um bloco. | O crescimento fica previsível e repetível: "cada unidade atende 50 mil usuários, precisamos de mais 3". |
| **Particione os dados (*sharding*)** por uma chave que distribua a carga de forma equilibrada, como *tenant* ou região. | Remove o teto do banco único. Escolha a chave com cuidado: uma chave ruim cria "partições quentes" que concentram a carga. |
| **Escale todas as camadas**, não só a camada web. | Dez vezes mais instâncias web batendo no mesmo banco só mudam o gargalo de lugar (e normalmente pioram tudo). |

### 5. Use cache com sabedoria e aproveite a CDN

**Objetivo:** evitar fazer o mesmo trabalho duas vezes e servir o conteúdo o mais perto possível do usuário.

Existe uma piada antiga que diz que só há duas coisas difíceis na ciência da computação: invalidação de cache e dar nomes às coisas. É piada porque é verdade. Cache é uma das ferramentas de desempenho mais poderosas, e também uma das formas mais fáceis de mostrar dados velhos ou errados para o usuário.

Pense em cache como **camadas**. Cada requisição respondida por uma camada anterior é trabalho que as próximas camadas nunca precisarão fazer:

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 760 240" role="img" aria-labelledby="perf-d3-title perf-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="perf-d3-title">Camadas de cache do navegador ao banco de dados</title>
<desc id="perf-d3-desc">Uma requisição passa por cinco camadas: cache do navegador, CDN na borda, cache da aplicação em memória, cache distribuído e, por fim, o banco de dados com réplicas de leitura. Cada camada que responde à requisição economiza o trabalho e a latência das camadas que vêm depois.</desc>
<defs><marker id="perf-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="380" y="36" text-anchor="middle" class="d-label">CADA ACERTO ANTES É TRABALHO QUE A PRÓXIMA CAMADA NÃO FAZ</text>
<rect x="20" y="80" width="120" height="80" rx="10" class="d-box-info"/>
<text x="80" y="115" text-anchor="middle" class="d-title">Navegador</text>
<text x="80" y="136" text-anchor="middle" class="d-small">cache HTTP</text>
<line x1="140" y1="120" x2="166" y2="120" class="d-line" marker-end="url(#perf-d3-arrow)"/>
<rect x="170" y="80" width="120" height="80" rx="10" class="d-box-accent"/>
<text x="230" y="115" text-anchor="middle" class="d-title">CDN</text>
<text x="230" y="136" text-anchor="middle" class="d-small">borda, estáticos</text>
<line x1="290" y1="120" x2="316" y2="120" class="d-line" marker-end="url(#perf-d3-arrow)"/>
<rect x="320" y="80" width="120" height="80" rx="10" class="d-box-info"/>
<text x="380" y="115" text-anchor="middle" class="d-title">Cache local</text>
<text x="380" y="136" text-anchor="middle" class="d-small">em memória</text>
<line x1="440" y1="120" x2="466" y2="120" class="d-line" marker-end="url(#perf-d3-arrow)"/>
<rect x="470" y="80" width="120" height="80" rx="10" class="d-box-info"/>
<text x="530" y="115" text-anchor="middle" class="d-title">Redis</text>
<text x="530" y="136" text-anchor="middle" class="d-small">distribuído</text>
<line x1="590" y1="120" x2="616" y2="120" class="d-line" marker-end="url(#perf-d3-arrow)"/>
<rect x="620" y="80" width="120" height="80" rx="10" class="d-box"/>
<text x="680" y="115" text-anchor="middle" class="d-title">Banco</text>
<text x="680" y="136" text-anchor="middle" class="d-small">+ réplicas</text>
<text x="80" y="186" text-anchor="middle" class="d-small">sem rede</text>
<text x="230" y="186" text-anchor="middle" class="d-small">perto do usuário</text>
<text x="380" y="186" text-anchor="middle" class="d-small">microssegundos</text>
<text x="530" y="186" text-anchor="middle" class="d-small">cerca de 1 ms</text>
<text x="680" y="186" text-anchor="middle" class="d-small">mais lento e caro</text>
<line x1="60" y1="214" x2="700" y2="214" class="d-line-accent" marker-end="url(#perf-d3-arrow)"/>
<text x="380" y="232" text-anchor="middle" class="d-small">latência e custo por requisição crescem para a direita</text>
</svg>
</div>
<figcaption>Figura 3: Cache em camadas, do navegador ao banco de dados</figcaption>
</figure>

| Abordagem | Benefício |
|-----------|-----------|
| **Use uma CDN** para arquivos estáticos, imagens, vídeos e, quando possível, páginas inteiras ou respostas de API cacheáveis. | O conteúdo é servido de um ponto de borda perto do usuário, reduzindo latência e tirando carga da origem. |
| **Configure cabeçalhos de cache HTTP** (`Cache-Control`, `ETag`) e versione seus arquivos estáticos. | Navegadores e CDNs fazem o trabalho de graça, e um novo deploy invalida os arquivos antigos sem drama. |
| **Aplique o padrão *cache-aside*** com um cache distribuído para dados muito lidos e pouco alterados. | Tira consultas repetidas do banco e compartilha os dados em cache entre todas as instâncias. |
| **Defina regras de expiração (TTL) e invalidação** por tipo de dado, com base no quanto ele pode estar desatualizado. | Transforma dado desatualizado em decisão consciente de negócio ("preço pode ter 60 segundos, estoque não"), e não em acidente. |
| **Proteja-se contra o efeito manada (*stampede*)**, quando uma chave popular expira e milhares de requisições batem no banco ao mesmo tempo. | Técnicas como *request coalescing*, TTLs com variação aleatória e *refresh* em segundo plano evitam que um *cache miss* vire uma indisponibilidade. |
| **Monitore a taxa de acerto (*hit ratio*).** | Um cache com 10% de acerto é só latência extra, custo extra e mais um componente que pode falhar. |

### 6. Cuide do desempenho dos dados

**Objetivo:** deixar a camada de dados rápida, já que ela é o gargalo na grande maioria dos sistemas.

Lembra da história da introdução? Não era o código, nem o *framework*, nem a nuvem. Era um índice faltando. Na minha experiência, a maioria dos chamados de "o sistema está lento" termina no banco de dados.

| Abordagem | Benefício |
|-----------|-----------|
| **Crie índices para as suas consultas reais**, revisando os planos de execução das críticas. Não indexe tudo: cada índice acelera a leitura e deixa a escrita mais lenta. | Consultas que varriam milhões de linhas passam a ler meia dúzia. |
| **Elimine consultas N+1 e acessos "tagarelas"**, buscando o que precisa em uma ida só e apenas as colunas necessárias. | Menos idas e voltas pela rede, que normalmente custam mais que a própria consulta. |
| **Use réplicas de leitura** para absorver tráfego pesado de leitura (relatórios, listagens, busca). | O nó primário fica livre para as escritas. Lembre que réplicas têm um pequeno atraso, então leituras logo após uma escrita podem precisar do primário. |
| **Desnormalize e use *views* materializadas** onde as leituras superam em muito as escritas. | As leituras deixam de precisar de *joins* caros; você troca um pouco de armazenamento e complexidade de escrita por velocidade. |
| **Separe os modelos de leitura e escrita (CQRS)** quando as necessidades realmente divergem. | Cada lado pode ser otimizado e escalado de forma independente. |
| **Gerencie conexões** com *pooling* e limites sensatos. | Evita o cenário clássico em que o *autoscaling* cria 100 instâncias e elas esgotam juntas as conexões do banco. |
| **Arquive e separe dados antigos em camadas**, mantendo as tabelas quentes pequenas. | Consultas, índices e *backups* continuam rápidos conforme o histórico cresce. |

### 7. Vá de assíncrono e nivele a carga com filas

**Objetivo:** não fazer o usuário esperar por trabalho que não precisa acontecer agora, e absorver picos sem cair.

Nem tudo precisa de resposta imediata. Enviar o e-mail de confirmação, gerar o PDF da nota fiscal, atualizar o motor de recomendação, avisar o estoque: o usuário não precisa assistir a tudo isso acontecendo. Ele precisa saber que o pedido foi recebido.

Com uma **fila** entre o produtor e o consumidor, o *front end* responde rápido ("pedido recebido") e o trabalho pesado é processado em segundo plano, no ritmo que os consumidores aguentam. Esse é o padrão ***queue-based load leveling***: um pico de 10.000 pedidos em um minuto vira uma fila que os *workers* esvaziam nos minutos seguintes, em vez de 10.000 requisições simultâneas esmagando o banco.

| Abordagem | Benefício |
|-----------|-----------|
| **Tire o trabalho não crítico do caminho da requisição** usando filas ou *streams* de eventos. | O tempo de resposta reflete só o que o usuário realmente precisa, e o desempenho percebido melhora muito. |
| **Escale os consumidores pela profundidade da fila.** | A capacidade de processamento acompanha o *backlog* automaticamente, e a própria fila vira um sinal claro de saturação. |
| **Projete consumidores idempotentes.** | Mensagens podem ser reprocessadas ou entregues duas vezes sem criar pedidos duplicados ou cobranças em dobro. |
| **Dê retorno ao usuário** em operações longas (status, progresso, notificações). | "Seu relatório fica pronto em 2 minutos" é uma experiência muito melhor que um *spinner* de 2 minutos. |

Filas também ajudam muito com falhas, mas *retries*, *dead-letter queues*, *circuit breakers* e *backpressure* merecem uma conversa própria, que você encontra em [Padrões de resiliência](/pt-br/principles/solution/resilience-patterns/).

### 8. Teste o desempenho antes dos seus usuários

**Objetivo:** descobrir limites e gargalos em um ambiente controlado, e não em produção no pior dia do ano.

É aqui que a história do "na minha máquina funciona" ganha um final feliz. Se aquele time tivesse rodado um teste de carga simples com um volume de dados do tamanho da produção, o índice faltando teria aparecido nos primeiros cinco minutos. Existem vários tipos de teste, e cada um responde a uma pergunta diferente:

| Tipo de teste | Pergunta que ele responde |
|---------------|---------------------------|
| **Teste de carga (*load*)** | O sistema cumpre as metas com a carga esperada (normal e de pico)? |
| **Teste de estresse (*stress*)** | Onde ele quebra, e como quebra? Degrada de forma controlada ou desmorona? |
| **Teste de pico (*spike*)** | O que acontece quando o tráfego salta de repente, mais rápido do que o *autoscaling* consegue reagir? |
| **Teste de resistência (*soak*)** | Ele aguenta horas ou dias? É aqui que aparecem vazamentos de memória, filas crescendo e discos enchendo. |
| **Teste de escalabilidade** | Quando dobro as instâncias, a vazão dobra, ou alguma outra coisa vira o teto? |

Algumas regras básicas para esses testes valerem alguma coisa:

- **Volume de dados realista:** um teste contra um banco com 200 linhas não prova nada sobre uma tabela com 30 milhões;
- **Mistura de tráfego realista:** usuários não acessam só a *home*. Modele a proporção real de leituras, escritas, buscas e operações pesadas;
- **Ambiente parecido com produção:** mesmos SKUs, mesma topologia, mesmos limites. Caso contrário, você está testando outro sistema;
- **Automatize no *pipeline*:** um teste de desempenho mais leve a cada *release* pega regressões cedo (do tipo "alguém colocou uma *query* dentro de um *loop*");
- **Estabeleça uma *baseline*** e compare cada execução com ela. Uma regressão de 20% é um achado, não ruído.

Ferramentas como k6, JMeter, Gatling, Locust e os serviços gerenciados de teste de carga dos provedores de nuvem deixam isso acessível para qualquer time. Não tem mais desculpa.

### 9. Monitore e otimize continuamente

**Objetivo:** manter o desempenho dentro da meta conforme o código, os dados e os usuários mudam.

Desempenho não é um projeto com data para acabar. Cada deploy muda o código, os dados crescem todo dia, os padrões de uso mudam e o provedor lança novos SKUs e serviços. Um sistema que cumpria as metas seis meses atrás pode não cumprir hoje.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="perf-d4-title perf-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="perf-d4-title">O ciclo contínuo de otimização de desempenho</title>
<desc id="perf-d4-desc">Um ciclo de cinco etapas: definir metas, projetar, testar sob carga, monitorar produção e otimizar, que leva de volta a definir metas. O trabalho de desempenho nunca termina.</desc>
<defs><marker id="perf-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-accent"/></marker></defs>
<rect x="275" y="30" width="170" height="54" rx="10" class="d-box-accent"/>
<text x="360" y="54" text-anchor="middle" class="d-title">Definir metas</text>
<text x="360" y="73" text-anchor="middle" class="d-small">p95, vazão, SLO</text>
<rect x="520" y="105" width="170" height="54" rx="10" class="d-box-info"/>
<text x="605" y="129" text-anchor="middle" class="d-title">Projetar</text>
<text x="605" y="148" text-anchor="middle" class="d-small">SKU, escala, cache</text>
<rect x="440" y="225" width="170" height="54" rx="10" class="d-box-info"/>
<text x="525" y="249" text-anchor="middle" class="d-title">Testar sob carga</text>
<text x="525" y="268" text-anchor="middle" class="d-small">carga, estresse, soak</text>
<rect x="110" y="225" width="170" height="54" rx="10" class="d-box-info"/>
<text x="195" y="249" text-anchor="middle" class="d-title">Monitorar produção</text>
<text x="195" y="268" text-anchor="middle" class="d-small">percentis reais</text>
<rect x="30" y="105" width="170" height="54" rx="10" class="d-box-warn"/>
<text x="115" y="129" text-anchor="middle" class="d-title">Otimizar</text>
<text x="115" y="148" text-anchor="middle" class="d-small">atacar o gargalo</text>
<line x1="445" y1="60" x2="558" y2="102" class="d-line-accent" marker-end="url(#perf-d4-arrow)"/>
<line x1="600" y1="159" x2="548" y2="222" class="d-line-accent" marker-end="url(#perf-d4-arrow)"/>
<line x1="440" y1="252" x2="284" y2="252" class="d-line-accent" marker-end="url(#perf-d4-arrow)"/>
<line x1="170" y1="225" x2="128" y2="162" class="d-line-accent" marker-end="url(#perf-d4-arrow)"/>
<line x1="140" y1="105" x2="271" y2="62" class="d-line-accent" marker-end="url(#perf-d4-arrow)"/>
<text x="360" y="162" text-anchor="middle" class="d-label">CICLO CONTÍNUO</text>
<text x="360" y="184" text-anchor="middle" class="d-small">desempenho nunca está pronto</text>
</svg>
</div>
<figcaption>Figura 4: O ciclo de desempenho: metas, projeto, testes, monitoramento e otimização, de novo e de novo</figcaption>
</figure>

| Abordagem | Benefício |
|-----------|-----------|
| **Instrumente os fluxos críticos** com métricas, *traces* distribuídos e logs, medindo percentis por operação. | Quando algo fica lento, você descobre em minutos, e não em dias, qual componente e qual chamada são os culpados. Veja [Observabilidade em primeiro lugar](/pt-br/principles/solution/observability-first/). |
| **Crie alertas sobre SLOs e saturação**, não só sobre "servidor fora do ar". | Você reage enquanto a latência está subindo, antes de os usuários começarem a reclamar. |
| **Acompanhe o desempenho por *release*.** | A regressão fica ligada à mudança que a causou, o que torna o *rollback* ou a correção algo trivial. |
| **Revise a arquitetura periodicamente** frente a novos requisitos e novos serviços. | Um serviço gerenciado, uma nova geração de SKU ou um novo padrão podem entregar o mesmo desempenho com muito menos esforço ou custo. |
| **Otimize primeiro o maior gargalo**, e depois meça de novo. | Corrigir qualquer coisa que não seja o gargalo não melhora o sistema como um todo. Resolvido, o gargalo muda de lugar e o ciclo recomeça. |
| **Faça *right-sizing* com frequência**, nas duas direções. | Recurso superdimensionado é dinheiro jogado fora; recurso subdimensionado é incidente futuro. Eficiência é sobre o tamanho certo, não o menor. |

## Tradeoffs

A **Eficiência de desempenho** faz o *workload* atender à demanda com os recursos que tem, escalando para cima e para baixo conforme necessário. Mas, assim como em todos os outros pilares, as decisões tomadas aqui têm consequências em outros lugares. Melhorar desempenho quase sempre significa gastar alguma coisa: dinheiro, simplicidade, consistência ou segurança.

Bora ver os *trade-offs* mais comuns?

### Tradeoffs com Confiabilidade (Reliability)

Complexidade aumentada: escala horizontal, *sharding*, caches e filas adicionam peças móveis. Cada componente é um novo ponto de falha, e sistemas distribuídos falham de formas criativas.

Consistência versus velocidade: caches, réplicas de leitura e processamento assíncrono significam que alguns dados vão estar levemente desatualizados. Ler de uma réplica atrasada logo após uma escrita pode mostrar ao usuário um pedido que "sumiu".

*Autoscaling* agressivo pode amplificar falhas: uma rajada de novas instâncias pode sobrecarregar um banco ou uma dependência que não escala no mesmo ritmo.

Dimensionar os recursos no limite para maximizar a eficiência deixa pouca folga para absorver a perda de uma zona ou instância. Rodar a 90% de utilização parece eficiente até um nó cair. Para o quadro completo, veja [Confiabilidade](/pt-br/principles/cloud/reliability/).

### Tradeoffs com Segurança (Security)

Cache de dados sensíveis: um cache ou CDN mal configurado pode servir os dados pessoais de um usuário para outro. Respostas privadas nunca devem ser cacheadas publicamente.

Área de ataque maior: mais instâncias, mais partições, mais *endpoints* e pontos de borda significam mais coisas para atualizar, monitorar e proteger.

Atalhos de desempenho: pular validação, afrouxar criptografia ou desligar inspeção "porque está lento" é um jeito clássico de trocar milissegundos por um vazamento. Controles de segurança têm custo, e ele precisa fazer parte do orçamento de desempenho, não ser lembrado depois. Mais sobre isso em [Segurança](/pt-br/principles/cloud/security/).

### Tradeoffs com Otimização de custos (Cost Optimization)

Folga custa dinheiro: cumprir o p99 no pico normalmente significa pagar por capacidade que fica ociosa na maior parte do tempo.

SKUs *premium*, réplicas extras, CDNs, caches distribuídos e implantações multirregião aparecem todos na fatura.

Por outro lado, eficiência e custo muitas vezes andam juntos: corrigir uma *query* ruim, adicionar um cache ou mover trabalho para uma fila pode deixar o sistema mais rápido **e** mais barato. O segredo é saber onde está a meta e não pagar por desempenho que ninguém pediu. Detalhes em [Otimização de custos](/pt-br/principles/cloud/cost-optimization/).

### Tradeoffs com Excelência operacional (Operational Excellence)

Mais componentes para operar: caches para invalidar, filas para vigiar, partições para rebalancear, regras de *autoscaling* para ajustar. Cada otimização adiciona conhecimento operacional que o time precisa manter.

Complexidade de testes: testes de desempenho realistas exigem ambientes e dados parecidos com os de produção, que dão trabalho para construir, manter e deixar em conformidade (mascarar dados pessoais nas bases de teste, por exemplo).

*Troubleshooting* mais difícil: um sistema assíncrono, particionado e cheio de cache é muito mais difícil de depurar do que um monólito simples batendo em um único banco. Sem boa observabilidade, um ganho de desempenho vira um pesadelo operacional. Veja [Excelência operacional](/pt-br/principles/cloud/operational-excellence/).

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Então deixar mais rápido pode deixar menos confiável, menos seguro, mais caro e mais difícil de operar? Melhor deixar lento mesmo!"</span>
    </div>
  </div>
</div>

Rá! Não é bem assim, Júnior. Um sistema lento também tem custo: usuários que desistem, carrinhos abandonados, SLAs quebrados e times virando noites em incidentes. O ponto é **mirar na meta, não no máximo**. Depois que o requisito de desempenho está atendido, cada milissegundo a mais que você corta precisa justificar a complexidade e o dinheiro que custa. Entenda o impacto, discuta com o time, documente a decisão e siga em frente.

## Conclusão

A **Eficiência de desempenho** não é sobre perseguir *benchmarks* nem escolher a tecnologia da moda. É sobre **saber o que "rápido o suficiente" significa para os seus usuários**, projetar um sistema que **acompanhe o crescimento da demanda** e **provar isso com dados**, antes e depois de chegar em produção.

Ela começa com metas claras expressas em percentis e SLOs, passa pelo planejamento de capacidade, pela escolha dos serviços certos, pelo design para escala horizontal, pelo uso inteligente de cache, pelo cuidado com a camada de dados e por tirar trabalho do caminho crítico. E nunca termina de verdade: testes, monitoramento e otimização contínua mantêm o sistema dentro da meta enquanto tudo ao redor muda.

Acima de tudo, lembre da história da tela de pedidos: **o seu notebook com 3 usuários não é produção**. Meça em condições reais, otimize o que as medições apontarem e faça os *trade-offs* de forma consciente, junto com o time.

## Próximos Passos

1. **Defina metas para os fluxos críticos**
Escolha os três a cinco fluxos que mais importam para o negócio e defina metas de latência p95/p99 e de vazão para cada um, combinadas com o time de produto.

2. **Meça onde você está hoje**
Instrumente esses fluxos e olhe os percentis reais em produção, não as médias. A distância entre as metas e a realidade é o seu *roadmap*.

3. **Encontre o primeiro gargalo**
Use *traces* e métricas de saturação para descobrir onde o tempo e os recursos estão sendo gastos de verdade. Comece pelo banco de dados; normalmente ele está lá.

4. **Prepare o design para escalar**
Tire o estado dos seus serviços, verifique as cotas da plataforma, configure o *autoscaling* com limites sensatos e identifique o que deveria ir para uma fila.

5. **Coloque testes de desempenho no *pipeline***
Comece com um teste de carga simples a cada *release*, comparado com uma *baseline*, e depois adicione testes de estresse e de resistência antes dos grandes eventos.

6. **Revise continuamente e pese os tradeoffs**
Revisite metas, dimensionamento e arquitetura periodicamente, e documente como cada decisão de desempenho afeta custo, confiabilidade, segurança e operação.

<div class="callout info" data-title="Referências">
  <ul>
    <li><a href="https://learn.microsoft.com/azure/well-architected/performance-efficiency/" target="_blank" rel="noopener">Azure Well-Architected Framework: Performance Efficiency</a></li>
    <li><a href="https://aws.amazon.com/architecture/well-architected/" target="_blank" rel="noopener">AWS Well-Architected Framework</a></li>
    <li><a href="https://cloud.google.com/architecture/framework" target="_blank" rel="noopener">Google Cloud Architecture Framework</a></li>
    <li><a href="https://sre.google/sre-book/service-level-objectives/" target="_blank" rel="noopener">Google SRE Book: Service Level Objectives</a></li>
    <li><a href="https://learn.microsoft.com/azure/architecture/patterns/cache-aside" target="_blank" rel="noopener">Padrão Cache-Aside (Azure Architecture Center)</a></li>
    <li><a href="https://learn.microsoft.com/azure/architecture/patterns/queue-based-load-leveling" target="_blank" rel="noopener">Padrão Queue-Based Load Leveling (Azure Architecture Center)</a></li>
  </ul>
</div>
