---
title: Padronização
short: Padrões e blocos reutilizáveis para que cada time pare de reinventar a roda. Afinal, quem quer corrigir o mesmo bug em doze loggers diferentes?
category: enterprise
---

## Introdução

Padronização é o princípio que transforma as boas decisões de um time no padrão de todos os outros. A **meta** é simples de falar e difícil de fazer: **o jeito certo também precisa ser o jeito mais fácil**, para que os times gastem energia no produto e não em redescobrir, pela quinta vez no ano, como chamar uma API com *retry*.

Em empresas pequenas, isso acontece quase sem querer: são cinco devs, sentados lado a lado, e todo mundo usa o que a pessoa mais sênior escolheu. O problema aparece quando a empresa cresce. Chegam times novos, cada um com o seu gosto, o seu *framework* favorito e o seu jeito "melhor" de fazer as coisas. Alguns anos depois, você olha o cenário e encontra:

- Várias bibliotecas de log, cada uma com um formato, e ninguém consegue correlacionar uma requisição entre serviços;
- Cinco jeitos diferentes de chamar uma API HTTP, sendo que três deles não têm *timeout*;
- Cada serviço com seu próprio formato de erro, obrigando cada cliente a escrever um *parser* sob medida;
- Infraestrutura copiada e colada entre repositórios, com pequenas diferenças que ninguém lembra por que existem;
- Gente nova que leva meses para ficar produtiva, porque cada repositório é um mundo;
- Um *patch* de segurança crítico que leva semanas para ser aplicado, porque ninguém sabe onde a biblioteca vulnerável é usada;

Pois é, *é raro, mas acontece bastante*... Quem nunca abriu um repositório e pensou "pera, por que esse serviço faz tudo diferente dos outros?" E o pior é que cada uma dessas escolhas fazia todo o sentido no dia em que foi feita.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Mas autonomia do time não é justamente isso? Cada squad escolhe a melhor ferramenta pro seu problema. Padrão me parece a polícia da arquitetura vindo tomar meu framework favorito!"</span>
    </div>
  </div>
</div>

Calma aí, Júnior! Autonomia é ótimo, e ninguém aqui quer polícia da arquitetura. Mas autonomia sem nenhum chão comum tem um preço, e quem paga são todos: a pessoa de plantão que precisa depurar um serviço escrito numa *stack* que ela nunca viu, o time de segurança caçando dependências vulneráveis e o próximo dev que entrar no seu squad.

Uma boa padronização não tira autonomia. Ela tira as **decisões que não merecem a sua atenção** (qual logger, qual formato de log, como montar um *pipeline*) para que você gaste a sua autonomia onde ela realmente importa: o problema de negócio.

<div class="callout info">
  <p>Este princípio trata de <strong>o que</strong> é padronizado e de <strong>como</strong> os padrões são criados, compartilhados e aposentados. Quem tem autoridade para decidir, como a conformidade é verificada e o que acontece quando um time foge do padrão são assuntos de <a href="/pt-br/principles/enterprise/governance/">Governança</a>. Os dois andam juntos: padrão sem governança vira sugestão, e governança sem bons padrões vira burocracia.</p>
</div>

## A História das 12 Bibliotecas de Log e dos 5 Jeitos de Chamar uma API

Deixa eu contar uma história que, com pequenas variações, eu já vi em mais de uma empresa.

A empresa começa com um monolito. Depois adota microsserviços, e cada time novo ganha bastante liberdade. O time de pagamentos ama uma biblioteca de log. O time de catálogo prefere outra, porque é mais rápida. O time de busca escreve o próprio *wrapper*, porque nenhuma das existentes "faz exatamente o que a gente precisa". Três anos e quarenta serviços depois, alguém resolve contar: **doze bibliotecas de log**. E para chamar APIs HTTP existem cinco abordagens, desde um cliente bem configurado com *retry* e *circuit breaker* até uma função caseira que simplesmente espera para sempre quando o outro lado não responde.

Tudo funciona, mais ou menos, até o dia do grande incidente. Um cliente reclama que os pagamentos estão falhando de forma intermitente. A pessoa de plantão tenta seguir a requisição do *frontend* até o provedor de pagamentos e descobre que:

- Cada serviço loga num formato diferente, uns em JSON, outros em texto puro;
- Só metade deles propaga um *correlation ID*, e cada um usa um nome de *header* diferente;
- O serviço que está de fato falhando usa o cliente HTTP caseiro, sem *timeout*, então as *threads* vão se acumulando até tudo parar;

A correção leva dez minutos. **Achar o problema leva seis horas.**

Alguns meses depois, é anunciada uma vulnerabilidade crítica numa biblioteca de log popular (quem viveu o Log4Shell em dezembro de 2021 sabe exatamente como é). Quantos serviços usam essa biblioteca? Ninguém sabe. Cada time precisa verificar as próprias dependências, uns estão de férias, alguns repositórios não são compilados há um ano. O *patch* que deveria levar um dia leva três semanas.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 320" role="img" aria-labelledby="std-d1-title std-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="std-d1-title">Antes e depois da padronização</title>
<desc id="std-d1-desc">À esquerda, três times se conectam de forma embaralhada a seis bibliotecas diferentes de log e de HTTP. À direita, os mesmos três times apontam para um único conjunto de blocos compartilhados.</desc>
<defs><marker id="std-d1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-accent"/></marker></defs>
<text x="180" y="28" text-anchor="middle" class="d-label">ANTES: CADA TIME POR SI</text>
<text x="545" y="28" text-anchor="middle" class="d-label">DEPOIS: UMA ESTRADA PAVIMENTADA</text>
<line x1="360" y1="45" x2="360" y2="290" class="d-line-dashed"/>
<rect x="30" y="60" width="100" height="40" rx="10" class="d-box"/>
<text x="80" y="85" text-anchor="middle" class="d-text">Time A</text>
<rect x="30" y="130" width="100" height="40" rx="10" class="d-box"/>
<text x="80" y="155" text-anchor="middle" class="d-text">Time B</text>
<rect x="30" y="200" width="100" height="40" rx="10" class="d-box"/>
<text x="80" y="225" text-anchor="middle" class="d-text">Time C</text>
<rect x="210" y="50" width="120" height="30" rx="10" class="d-box-danger"/>
<text x="270" y="69" text-anchor="middle" class="d-small">Logger A</text>
<rect x="210" y="90" width="120" height="30" rx="10" class="d-box-danger"/>
<text x="270" y="109" text-anchor="middle" class="d-small">Logger B</text>
<rect x="210" y="130" width="120" height="30" rx="10" class="d-box-danger"/>
<text x="270" y="149" text-anchor="middle" class="d-small">Logger caseiro</text>
<rect x="210" y="170" width="120" height="30" rx="10" class="d-box-danger"/>
<text x="270" y="189" text-anchor="middle" class="d-small">Cliente HTTP X</text>
<rect x="210" y="210" width="120" height="30" rx="10" class="d-box-danger"/>
<text x="270" y="229" text-anchor="middle" class="d-small">Cliente HTTP Y</text>
<rect x="210" y="250" width="120" height="30" rx="10" class="d-box-danger"/>
<text x="270" y="269" text-anchor="middle" class="d-small">Retry caseiro</text>
<line x1="130" y1="80" x2="210" y2="65" class="d-line-danger"/>
<line x1="130" y1="80" x2="210" y2="185" class="d-line-danger"/>
<line x1="130" y1="80" x2="210" y2="265" class="d-line-danger"/>
<line x1="130" y1="150" x2="210" y2="105" class="d-line-danger"/>
<line x1="130" y1="150" x2="210" y2="225" class="d-line-danger"/>
<line x1="130" y1="150" x2="210" y2="145" class="d-line-danger"/>
<line x1="130" y1="220" x2="210" y2="145" class="d-line-danger"/>
<line x1="130" y1="220" x2="210" y2="185" class="d-line-danger"/>
<line x1="130" y1="220" x2="210" y2="265" class="d-line-danger"/>
<text x="180" y="308" text-anchor="middle" class="d-small">3 times, 6 jeitos, 0 correções comuns</text>
<rect x="380" y="60" width="100" height="40" rx="10" class="d-box"/>
<text x="430" y="85" text-anchor="middle" class="d-text">Time A</text>
<rect x="380" y="130" width="100" height="40" rx="10" class="d-box"/>
<text x="430" y="155" text-anchor="middle" class="d-text">Time B</text>
<rect x="380" y="200" width="100" height="40" rx="10" class="d-box"/>
<text x="430" y="225" text-anchor="middle" class="d-text">Time C</text>
<line x1="480" y1="80" x2="518" y2="80" class="d-line-accent" marker-end="url(#std-d1-arrow)"/>
<line x1="480" y1="150" x2="518" y2="150" class="d-line-accent" marker-end="url(#std-d1-arrow)"/>
<line x1="480" y1="220" x2="518" y2="220" class="d-line-accent" marker-end="url(#std-d1-arrow)"/>
<rect x="520" y="50" width="170" height="230" rx="10" class="d-box-accent"/>
<text x="605" y="85" text-anchor="middle" class="d-title">Blocos</text>
<text x="605" y="105" text-anchor="middle" class="d-title">compartilhados</text>
<text x="605" y="140" text-anchor="middle" class="d-small">1 biblioteca de log</text>
<text x="605" y="165" text-anchor="middle" class="d-small">1 cliente HTTP</text>
<text x="605" y="190" text-anchor="middle" class="d-small">1 política de retry</text>
<text x="605" y="215" text-anchor="middle" class="d-small">Templates de serviço</text>
<text x="605" y="240" text-anchor="middle" class="d-small">Módulos de IaC</text>
<text x="545" y="308" text-anchor="middle" class="d-small">3 times, 1 jeito, correção feita uma vez</text>
</svg>
</div>
<figcaption>Figura 1: Os mesmos três times, antes e depois de combinarem blocos compartilhados</figcaption>
</figure>

Repare que ninguém nessa história era incompetente. Cada decisão, isoladamente, era razoável. O problema é a **soma** de decisões locais razoáveis, sem ninguém olhando o todo. É exatamente essa lacuna que este princípio preenche.

## Por Que os Padrões Valem a Pena

É fácil enxergar padrão como burocracia. Então vamos ser concretos sobre o que eles compram.

### Menos carga cognitiva

Toda decisão técnica que um dev precisa tomar, ou entender, ocupa um pedacinho da cabeça. O pessoal do *Team Topologies* fala em **carga cognitiva estranha** (*extraneous cognitive load*): o esforço gasto com coisas que não têm nada a ver com o problema que você está resolvendo. Descobrir qual dos doze loggers esse repositório usa, e como ele está configurado, é carga estranha pura.

Quando o básico está padronizado, quem abre qualquer repositório da empresa já sabe onde está o *pipeline*, como os logs são escritos, como os erros são devolvidos e como o serviço é implantado. A cabeça fica livre para a parte realmente nova: a regra de negócio.

### Onboarding mais rápido

Quem chega num ambiente padronizado aprende a plataforma **uma vez**. Depois disso, trocar de time custa dias, não meses. O mesmo vale para a mobilidade interna: as pessoas conseguem ajudar outros times durante um incidente, cobrir colegas de férias ou mudar de produto sem começar do zero.

### Menos risco

Padrões concentram conhecimento e esforço. Um cliente HTTP compartilhado, com *timeouts* sensatos, *retry* com *backoff* e *circuit breaker*, protege todos os serviços que o utilizam. Um *patch* de segurança numa biblioteca compartilhada é aplicado num lugar só e distribuído com uma troca de versão. Um inventário de quais serviços usam quais blocos diz, em minutos, onde você está exposto.

### Economia de escala

Tudo que é construído uma vez e reutilizado muitas vezes melhora com o tempo: mais gente usa, mais bugs são encontrados, mais casos de borda são tratados. Tudo que é construído quarenta vezes ganha quarenta vezes os bugs, e cada cópia melhora (ou apodrece) sozinha.

<div class="callout tip">
  <p>Um teste útil para qualquer padrão: <strong>ele reduz o número de decisões que um time precisa tomar sem reduzir a qualidade do resultado?</strong> Se a resposta for sim, provavelmente é um bom padrão. Se o time agora precisa tomar <em>mais</em> decisões (exceções, gambiarras, papelada), tem alguma coisa errada.</p>
</div>

## O Que Padronizar (e o Que Deixar em Paz)

Nem tudo merece um padrão. Uma boa regra de bolso é: **padronize as costuras, não o recheio**.

As costuras são os pontos onde times, sistemas e pessoas se encontram: contratos de API, formatos de eventos, autenticação, logs e *traces*, deploy, infraestrutura. Inconsistência ali machuca todo mundo, porque vaza para outros times. O recheio são os detalhes de implementação de um serviço que ninguém de fora precisa ver: como o código está organizado internamente, qual *helper* de teste o time prefere, como as funções privadas são nomeadas. Inconsistência ali machuca, no máximo, o próprio time.

| Camada | Quão rígido | Exemplos |
| :--- | :--- | :--- |
| **Contratos entre sistemas** | Rígido: todos seguem | Nomes e versionamento de API, formato de erro, *schemas* de eventos, autenticação, *correlation IDs* |
| **Plataforma e operações** | Padrão forte, exceções possíveis | *Pipelines* de CI/CD, módulos de IaC, logs e *tracing*, imagens base de contêiner, gestão de segredos |
| **Escolhas de tecnologia** | Guiadas pelo radar | Linguagens, *frameworks*, bancos de dados, *message brokers* |
| **Dentro do serviço** | Escolha do time | Estrutura interna do código, bibliotecas que não cruzam fronteiras, convenções locais |

Essa divisão também ajuda com a tensão que o Júnior levantou. Os times mantêm autonomia onde ela não afeta mais ninguém e abrem mão de um pouquinho dela nas costuras, em troca de muito benefício coletivo.

## A Caixa de Ferramentas da Padronização

Não existe uma única ferramenta que resolva a padronização. Existe um conjunto de práticas complementares, cada uma boa numa coisa. Bora passar por elas.

### 1. Mantenha um Radar de Tecnologia

**Meta:** deixar as escolhas de tecnologia visíveis, explícitas e fáceis de consultar, em vez de viverem na cabeça de meia dúzia de pessoas sêniores.

A ideia foi popularizada pela ThoughtWorks, que publica o seu *Technology Radar* duas vezes por ano há mais de uma década. Cada tecnologia (uma ferramenta, uma plataforma, uma técnica, uma linguagem ou *framework*) é colocada num de quatro anéis:

- **Adote** (*Adopt*): a escolha padrão para trabalho novo. Se você escolher outra coisa, precisa de um bom motivo;
- **Experimente** (*Trial*): vale usar em projetos reais onde o risco é controlável. Estamos ganhando experiência com ela;
- **Avalie** (*Assess*): vale explorar, com um *spike* ou uma prova de conceito, para entender como pode nos afetar;
- **Evite** (*Hold*): não comece nada novo com ela. O que já existe pode ficar, mas a direção é se afastar;

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 450" role="img" aria-labelledby="std-d2-title std-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="std-d2-title">Um radar de tecnologia com quatro anéis e quatro quadrantes</title>
<desc id="std-d2-desc">Anéis concêntricos chamados Adote, Experimente, Avalie e Evite, do centro para fora, divididos nos quadrantes Técnicas, Ferramentas, Plataformas e Linguagens. Tecnologias ilustrativas aparecem como pontos em cada anel, com uma legenda explicando cada anel.</desc>
<circle cx="230" cy="225" r="200" class="d-box-danger"/>
<circle cx="230" cy="225" r="150" class="d-box-warn"/>
<circle cx="230" cy="225" r="100" class="d-box-info"/>
<circle cx="230" cy="225" r="50" class="d-box-accent"/>
<line x1="30" y1="225" x2="430" y2="225" class="d-line-dashed"/>
<line x1="230" y1="25" x2="230" y2="425" class="d-line-dashed"/>
<text x="30" y="35" class="d-label">TÉCNICAS</text>
<text x="430" y="35" text-anchor="end" class="d-label">FERRAMENTAS</text>
<text x="30" y="422" class="d-label">PLATAFORMAS</text>
<text x="430" y="422" text-anchor="end" class="d-label">LINGUAGENS</text>
<circle cx="205" cy="200" r="6" class="d-fill-accent"/>
<text x="197" y="192" text-anchor="end" class="d-small">Trunk-based</text>
<circle cx="167" cy="117" r="6" class="d-fill-warn"/>
<text x="159" y="121" text-anchor="end" class="d-small">Code review com IA</text>
<circle cx="283" cy="172" r="6" class="d-fill-info"/>
<text x="291" y="176" class="d-small">OpenTelemetry</text>
<circle cx="317" cy="73" r="6" class="d-fill-danger"/>
<text x="325" y="77" class="d-small">Logger nº 7</text>
<circle cx="205" cy="250" r="6" class="d-fill-accent"/>
<text x="197" y="254" text-anchor="end" class="d-small">Golden path</text>
<circle cx="201" cy="305" r="6" class="d-fill-info"/>
<text x="193" y="309" text-anchor="end" class="d-small">Portal do dev</text>
<circle cx="87" cy="325" r="6" class="d-fill-danger"/>
<text x="95" y="342" class="d-small">VMs artesanais</text>
<circle cx="255" cy="250" r="6" class="d-fill-accent"/>
<text x="263" y="254" class="d-small">TypeScript</text>
<circle cx="338" cy="288" r="6" class="d-fill-warn"/>
<text x="346" y="292" class="d-small">Rust</text>
<circle cx="290" cy="389" r="6" class="d-fill-danger"/>
<text x="298" y="393" class="d-small">Perl legado</text>
<text x="470" y="60" class="d-label">ANÉIS</text>
<circle cx="478" cy="95" r="7" class="d-fill-accent"/>
<text x="494" y="100" class="d-title">Adote</text>
<text x="494" y="120" class="d-small">padrão para trabalho novo</text>
<circle cx="478" cy="155" r="7" class="d-fill-info"/>
<text x="494" y="160" class="d-title">Experimente</text>
<text x="494" y="180" class="d-small">em casos reais de baixo risco</text>
<circle cx="478" cy="215" r="7" class="d-fill-warn"/>
<text x="494" y="220" class="d-title">Avalie</text>
<text x="494" y="240" class="d-small">explore, faça spikes, aprenda</text>
<circle cx="478" cy="275" r="7" class="d-fill-danger"/>
<text x="494" y="280" class="d-title">Evite</text>
<text x="494" y="300" class="d-small">nada novo começa com ele</text>
<text x="470" y="350" class="d-small">Pontos são exemplos</text>
<text x="470" y="368" class="d-small">ilustrativos, não conselhos.</text>
</svg>
</div>
<figcaption>Figura 2: Um radar de tecnologia no estilo da ThoughtWorks (Adote, Experimente, Avalie, Evite)</figcaption>
</figure>

A mágica do radar é que ele é **uma conversa, não uma lei**. Ele mostra para os times para onde a organização está indo, dá às tecnologias novas um caminho legítimo de entrada (Avalie, depois Experimente, depois Adote) e dá às antigas uma saída digna (Evite). A ThoughtWorks inclusive abriu o seu ferramental, então qualquer empresa pode montar o próprio radar.

**Benefício:** menos tecnologias em paralelo fazendo o mesmo trabalho, menos surpresas e um lugar onde "por que a gente usa X?" tem uma resposta escrita. Conecte o radar aos esforços de [racionalização do portfólio](/pt-br/principles/enterprise/portfolio-rationalization/): o anel Evite costuma ser a primeira lista de candidatos à aposentadoria.

### 2. Publique Arquiteturas de Referência

**Meta:** dar aos times um ponto de partida comprovado para os tipos de sistema mais comuns.

Uma arquitetura de referência é um *blueprint* documentado e opinativo para um problema recorrente: "uma API REST com banco relacional", "um *worker* orientado a eventos", "um site estático com CDN", "um *pipeline* de dados". Ela mostra os componentes, como se conectam, quais blocos usar, como tudo é protegido, monitorado e implantado e, muito importante, **por que** cada escolha foi feita.

Os provedores de nuvem publicam várias (o Azure Architecture Center e o AWS Architecture Center são bons exemplos), mas as mais valiosas são as suas, porque já incluem o seu provedor de identidade, as suas regras de rede, a sua *stack* de observabilidade e os seus requisitos de *compliance*.

**Benefício:** um time que começa um serviço novo não parte de uma página em branco. Parte de algo que já passou pela revisão de segurança, já se encaixa na plataforma e já tem um perfil de custo conhecido.

<div class="callout warning">
  <p>Uma arquitetura de referência que ninguém atualiza vira armadilha: os times seguem direitinho e acabam construindo em cima de decisões desatualizadas. Toda arquitetura de referência precisa de um <strong>dono</strong> e de uma data de <strong>última revisão</strong>, como qualquer outro padrão.</p>
</div>

### 3. Construa Golden Paths sobre uma Plataforma Interna de Desenvolvimento

**Meta:** transformar padrões em algo que os times *usam*, e não em algo que eles *leem*.

Documento é ótimo, mas ninguém lê documento às seis da tarde de uma sexta-feira. O que funciona muito melhor é fazer do padrão o caminho de menor resistência. Essa é a ideia do ***golden path*** (termo do Spotify) ou ***paved road*** (termo da Netflix): um jeito suportado, opinativo e bem mantido de construir e operar um certo tipo de software, do primeiro `git init` até produção.

Na prática, o *golden path* é entregue por uma **plataforma interna de desenvolvimento** (*internal developer platform*): um conjunto de capacidades *self-service*, mantido por um time de plataforma e tratado como produto. O dev escolhe um *template* num portal (ferramentas como o Backstage são comuns aqui), responde algumas perguntas e recebe um repositório com o esqueleto do serviço, o *pipeline*, a infraestrutura, logs, *tracing*, *dashboards* e alertas, tudo já ligado aos padrões da empresa.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 390" role="img" aria-labelledby="std-d3-title std-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="std-d3-title">Golden paths sobre uma plataforma interna de desenvolvimento</title>
<desc id="std-d3-desc">Os times de produto, no topo, usam golden paths, construídos sobre uma plataforma interna formada por pipelines de CI/CD, módulos de IaC, observabilidade e segurança, rodando na nuvem. Ao lado, um caminho fora do trilho permite que um time contorne a plataforma, desde que assuma o resultado.</desc>
<defs><marker id="std-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="300" y="28" text-anchor="middle" class="d-label">OS TIMES CONSTROEM SOBRE A PLATAFORMA</text>
<rect x="30" y="50" width="165" height="50" rx="10" class="d-box"/>
<text x="112" y="80" text-anchor="middle" class="d-text">Time Pagamentos</text>
<rect x="217" y="50" width="165" height="50" rx="10" class="d-box"/>
<text x="300" y="80" text-anchor="middle" class="d-text">Time Catálogo</text>
<rect x="405" y="50" width="165" height="50" rx="10" class="d-box"/>
<text x="488" y="80" text-anchor="middle" class="d-text">Time Busca</text>
<line x1="112" y1="100" x2="112" y2="128" class="d-line" marker-end="url(#std-d3-arrow)"/>
<line x1="300" y1="100" x2="300" y2="128" class="d-line" marker-end="url(#std-d3-arrow)"/>
<line x1="488" y1="100" x2="488" y2="128" class="d-line" marker-end="url(#std-d3-arrow)"/>
<rect x="30" y="130" width="540" height="60" rx="10" class="d-box-accent"/>
<text x="300" y="156" text-anchor="middle" class="d-title">Golden paths</text>
<text x="300" y="177" text-anchor="middle" class="d-small">templates, scaffolding, docs e um portal</text>
<line x1="300" y1="190" x2="300" y2="218" class="d-line" marker-end="url(#std-d3-arrow)"/>
<rect x="30" y="220" width="540" height="92" rx="10" class="d-box"/>
<text x="300" y="241" text-anchor="middle" class="d-label">PLATAFORMA INTERNA DE DESENVOLVIMENTO</text>
<rect x="45" y="252" width="122" height="48" rx="10" class="d-box-info"/>
<text x="106" y="272" text-anchor="middle" class="d-text">CI/CD</text>
<text x="106" y="290" text-anchor="middle" class="d-small">pipelines</text>
<rect x="177" y="252" width="122" height="48" rx="10" class="d-box-info"/>
<text x="238" y="272" text-anchor="middle" class="d-text">IaC</text>
<text x="238" y="290" text-anchor="middle" class="d-small">módulos</text>
<rect x="309" y="252" width="122" height="48" rx="10" class="d-box-info"/>
<text x="370" y="272" text-anchor="middle" class="d-text">Observabilidade</text>
<text x="370" y="290" text-anchor="middle" class="d-small">logs, traces</text>
<rect x="441" y="252" width="122" height="48" rx="10" class="d-box-info"/>
<text x="502" y="272" text-anchor="middle" class="d-text">Segurança</text>
<text x="502" y="290" text-anchor="middle" class="d-small">e identidade</text>
<line x1="300" y1="312" x2="300" y2="338" class="d-line" marker-end="url(#std-d3-arrow)"/>
<rect x="30" y="340" width="540" height="36" rx="10" class="d-box-muted"/>
<text x="300" y="363" text-anchor="middle" class="d-text">Nuvem e infraestrutura</text>
<path d="M570,75 L649,75 L649,128" class="d-line-dashed" marker-end="url(#std-d3-arrow)"/>
<rect x="588" y="130" width="122" height="180" rx="10" class="d-box-warn"/>
<text x="649" y="165" text-anchor="middle" class="d-text">Fora do trilho</text>
<text x="649" y="192" text-anchor="middle" class="d-small">permitido, mas</text>
<text x="649" y="210" text-anchor="middle" class="d-small">você constrói,</text>
<text x="649" y="228" text-anchor="middle" class="d-small">opera e atende</text>
<text x="649" y="246" text-anchor="middle" class="d-small">o plantão</text>
<path d="M649,310 L649,358 L572,358" class="d-line-dashed" marker-end="url(#std-d3-arrow)"/>
</svg>
</div>
<figcaption>Figura 3: Golden paths sobre uma plataforma interna de desenvolvimento, com uma opção explícita fora do trilho</figcaption>
</figure>

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Então o time de plataforma decide tudo e a gente só obedece? E se o meu serviço precisar mesmo de algo que o golden path não tem?"</span>
    </div>
  </div>
</div>

Ótima pergunta, Júnior, e é por isso que a figura tem uma caixa **fora do trilho**. Um *golden path* é uma recomendação que ficou irresistível, não uma jaula. Você pode sair dele, mas aí passa a ser dono de tudo que a plataforma faria por você: o *pipeline*, os *patches*, o monitoramento, o *pager* tocando às três da manhã. A maioria dos times, fazendo essa conta com honestidade, fica no caminho. Os poucos que saem geralmente têm um motivo real, e esses motivos são o melhor *input* que o time de plataforma pode receber sobre o que construir a seguir.

A outra metade da resposta: um bom time de plataforma trata os devs como **clientes**. Tem *roadmap*, coleta *feedback*, mede adoção e satisfação e disputa os seus usuários. Se os times estão fugindo do *golden path* em massa, o problema é o caminho, não os times. O trabalho da CNCF sobre plataformas e o *Team Topologies* (com as ideias de "plataforma como produto" e de "plataforma mínima viável", a *thinnest viable platform*) são bons lugares para se aprofundar.

**Benefício:** padrões aplicados por padrão, sem ninguém precisar lembrar deles. Um serviço novo já nasce em conformidade, observável e seguro, e é aí que a [excelência operacional](/pt-br/principles/cloud/operational-excellence/) e o [security shift-left](/pt-br/principles/solution/security-shift-left/) ficam baratos em vez de heroicos.

### 4. Ofereça Módulos e Templates de IaC Reutilizáveis

**Meta:** transformar a própria infraestrutura num conjunto de blocos testados e versionados.

Copiar código de infraestrutura de outro repositório e dar uma ajeitada é como quase todo *drift* começa. Uma abordagem melhor é publicar **módulos** (módulos Terraform, módulos Bicep, componentes Pulumi, *templates* CloudFormation) para as peças que todo time precisa: uma rede com a segmentação certa, um banco com *backup* e criptografia habilitados, uma aplicação em contêiner com os *sidecars* padrão, uma conta de armazenamento com a política de retenção correta.

Algumas práticas deixam os módulos realmente úteis:

- **Versione** com versionamento semântico, para que os times atualizem no próprio ritmo e saibam quando uma mudança quebra compatibilidade;
- **Mantenha-os pequenos e combináveis**, um módulo por responsabilidade, em vez de um módulo gigante "faz tudo" com cem parâmetros;
- **Embuta o inegociável** (criptografia, *tags*, rede privada) dentro do módulo, para que os times não precisem lembrar;
- **Teste-os** no *pipeline* do próprio módulo, antes de qualquer time consumir uma versão nova;
- **Publique num *registry*** com documentação e exemplos, para que achar o módulo seja mais fácil do que reescrevê-lo;

**Benefício:** infraestrutura consistente, controles de segurança e de custo embutidos e melhorias que chegam a todos os times com uma troca de versão.

### 5. Defina Padrões de Serviço e de API

**Meta:** fazer com que toda API da empresa pareça ter sido desenhada pela mesma pessoa.

APIs são as costuras mais importantes de todas. Quando cada time desenha a sua do seu jeito, os clientes acabam aprendendo dezenas de dialetos. Um guia de API curto e prático normalmente cobre:

- **Nomes:** substantivos no plural para recursos, um padrão de *casing* (escolha `camelCase` ou `snake_case` para os campos e nunca misture), URLs previsíveis;
- **Versionamento:** como a versão é expressa (URL, *header* ou *media type*), o que conta como mudança que quebra compatibilidade, por quanto tempo versões antigas são suportadas e como a descontinuação é anunciada;
- **Erros:** um único formato de erro para todos;
- **Paginação, filtros e ordenação:** um jeito só para cada um;
- ***Headers* transversais:** *correlation IDs*, chaves de idempotência, *headers* de *rate limit*;
- **Segurança:** esquema de autenticação, escopos, o que nunca pode aparecer numa URL ou num log;

Para os erros, você nem precisa inventar nada: a RFC 9457 (*Problem Details for HTTP APIs*) define um formato JSON padrão que muitos *frameworks* já suportam:

```json
{
  "type": "https://api.example.com/problems/insufficient-funds",
  "title": "Saldo insuficiente",
  "status": 422,
  "detail": "O saldo da conta é 30,00, mas a transferência precisa de 50,00.",
  "instance": "/transfers/7f3c",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736"
}
```

Se não quiser começar do zero, guias públicos como as *REST API Guidelines* da Microsoft e as *API Improvement Proposals* (AIPs) do Google são ótimas referências para adaptar. Para eventos e telemetria vale o mesmo raciocínio: combine os *schemas* e prefira padrões abertos como o OpenTelemetry para *traces*, métricas e logs (que, aliás, é exatamente o que torna possível a [observabilidade em primeiro lugar](/pt-br/principles/solution/observability-first/) entre times).

**Benefício:** os clientes integram mais rápido, o ferramental genérico (*gateways*, geradores de SDK, *linters*, *dashboards*) funciona para todos os serviços, e a pessoa de plantão lê qualquer erro sem precisar de tradutor.

### 6. Escolha com Cuidado entre Biblioteca Compartilhada e Copiar e Colar

**Meta:** compartilhar o que realmente precisa ser compartilhado, e nada além disso.

Agora um assunto polêmico. Bibliotecas compartilhadas são o jeito óbvio de reutilizar código, mas também criam acoplamento: todo consumidor passa a depender do ciclo de *release* da biblioteca, das suas dependências transitivas e dos seus bugs. A comunidade Go tem um provérbio famoso sobre isso: *"a little copying is better than a little dependency"* (um pouco de cópia é melhor do que um pouco de dependência).

Então quando vale uma biblioteca compartilhada, e quando copiar tudo bem?

| Abordagem | Benefício | Cuidado com |
| :--- | :--- | :--- |
| **Biblioteca compartilhada** para preocupações transversais, estáveis e sensíveis a segurança (configuração de log, cliente HTTP resiliente, validação de *token*, telemetria) | Uma correção chega a todos; comportamento consistente nas costuras | Precisa de dono, versionamento, *changelog* e retrocompatibilidade; mantenha enxuta e com poucas dependências |
| **Copiar e colar (ou um *template*)** para código pequeno, específico do domínio ou ainda em evolução | Os times ficam independentes e adaptam à vontade | As cópias divergem; tudo bem para código que deve mesmo divergir |
| **Serviço de plataforma** em vez de biblioteca (um serviço central de autenticação, um serviço de *feature flags*) | Nenhuma biblioteca para atualizar em quarenta repositórios | Vira dependência em tempo de execução; precisa ser tão confiável quanto os serviços que o usam |
| **Código gerado** a partir de um contrato (OpenAPI, Protobuf, AsyncAPI) | Cliente e servidor sempre batem com o contrato | O contrato vira o padrão; invista na qualidade dele |

Uma heurística prática é a **regra de três**: escreva uma vez, copie na segunda, extraia um componente compartilhado só quando o terceiro time precisar e o formato estiver claro. Extrair cedo demais congela a abstração errada e acopla times sem motivo.

E nunca, jamais, coloque **regra de negócio** numa biblioteca "commons" compartilhada por todos os serviços. É assim que nasce um monolito distribuído, em que mudar uma regra de cliente exige deploy coordenado de quinze serviços. Lógica de domínio mora dentro do seu [bounded context](/pt-br/principles/solution/bounded-contexts/).

### 7. Adote o Inner Source

**Meta:** deixar todo mundo contribuir com os componentes compartilhados, em vez de enfileirar pedidos para um time central sobrecarregado.

*Inner source* é aplicar práticas de código aberto dentro da empresa: os componentes compartilhados ficam em repositórios que todos podem ler, qualquer pessoa pode abrir um *pull request*, existe um `CONTRIBUTING.md` explicando como, e um pequeno grupo de ***trusted committers*** revisa e faz o *merge*. A comunidade InnerSource Commons tem muitos padrões e material sobre o assunto.

Isso resolve um problema clássico: o time central dono da biblioteca compartilhada vira gargalo, os times cansam de esperar e fazem um *fork* do código, e pronto, lá estão seis bibliotecas "compartilhadas" de novo. Com *inner source*, o time que precisa de uma funcionalidade pode construí-la ele mesmo, com os donos cuidando da qualidade e do design.

**Benefício:** os componentes compartilhados evoluem na velocidade dos seus usuários, o conhecimento se espalha entre os times e os donos deixam de ser gargalo sem perder o controle da qualidade.

## Como um Padrão Nasce, Vive e Morre

Um padrão não é uma tábua de pedra. Ele tem um ciclo de vida, e gerenciar bem esse ciclo é o que separa padrões vivos de documentos mortos que todo mundo ignora.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 760 250" role="img" aria-labelledby="std-d4-title std-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="std-d4-title">O ciclo de vida de um padrão</title>
<desc id="std-d4-desc">Um padrão passa por seis etapas: proposta em RFC, piloto com times pioneiros, adoção como padrão, manutenção por um dono, depreciação com data de sunset e aposentadoria. Da manutenção, um laço volta para um novo RFC quando surge uma opção melhor.</desc>
<defs><marker id="std-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="380" y="36" text-anchor="middle" class="d-label">COMO UM PADRÃO NASCE, VIVE E MORRE</text>
<rect x="20" y="80" width="104" height="70" rx="10" class="d-box"/>
<text x="72" y="110" text-anchor="middle" class="d-title">RFC</text>
<text x="72" y="131" text-anchor="middle" class="d-small">proposta</text>
<rect x="144" y="80" width="104" height="70" rx="10" class="d-box-info"/>
<text x="196" y="110" text-anchor="middle" class="d-title">Piloto</text>
<text x="196" y="131" text-anchor="middle" class="d-small">times pioneiros</text>
<rect x="268" y="80" width="104" height="70" rx="10" class="d-box-accent"/>
<text x="320" y="110" text-anchor="middle" class="d-title">Adoção</text>
<text x="320" y="131" text-anchor="middle" class="d-small">vira o padrão</text>
<rect x="392" y="80" width="104" height="70" rx="10" class="d-box-accent"/>
<text x="444" y="110" text-anchor="middle" class="d-title">Manutenção</text>
<text x="444" y="131" text-anchor="middle" class="d-small">tem um dono</text>
<rect x="516" y="80" width="104" height="70" rx="10" class="d-box-warn"/>
<text x="568" y="110" text-anchor="middle" class="d-title">Depreciação</text>
<text x="568" y="131" text-anchor="middle" class="d-small">data de sunset</text>
<rect x="640" y="80" width="104" height="70" rx="10" class="d-box-muted"/>
<text x="692" y="110" text-anchor="middle" class="d-title">Aposentado</text>
<text x="692" y="131" text-anchor="middle" class="d-small">removido</text>
<line x1="124" y1="115" x2="142" y2="115" class="d-line" marker-end="url(#std-d4-arrow)"/>
<line x1="248" y1="115" x2="266" y2="115" class="d-line" marker-end="url(#std-d4-arrow)"/>
<line x1="372" y1="115" x2="390" y2="115" class="d-line" marker-end="url(#std-d4-arrow)"/>
<line x1="496" y1="115" x2="514" y2="115" class="d-line" marker-end="url(#std-d4-arrow)"/>
<line x1="620" y1="115" x2="638" y2="115" class="d-line" marker-end="url(#std-d4-arrow)"/>
<path d="M444,150 L444,200 L72,200 L72,152" class="d-line-dashed" marker-end="url(#std-d4-arrow)"/>
<text x="258" y="222" text-anchor="middle" class="d-small">surgiu algo melhor: novo RFC</text>
</svg>
</div>
<figcaption>Figura 4: O ciclo de vida de um padrão, da proposta à aposentadoria</figcaption>
</figure>

### Nascimento: RFCs e comunidades de prática

O pior jeito de criar um padrão é uma pessoa (geralmente com "arquiteto" no cargo) escrever tudo sozinha e anunciar por e-mail. Ninguém segue regra da qual não participou, principalmente regra que não bate com a realidade do time.

Um jeito muito melhor:

1. **Comece de uma dor real.** "Temos doze loggers e não conseguimos correlacionar requisições" é um ótimo motivo. "Seria legal ter um padrão para X" não é;
2. **Escreva um RFC** (*Request for Comments*): um documento curto descrevendo o problema, a proposta, as alternativas consideradas, o custo de migração e os *trade-offs*. Guarde no controle de versão, onde qualquer um pode comentar;
3. **Discuta numa comunidade de prática**: um grupo de pessoas de times diferentes que se importam com o tema (*backend*, *frontend*, dados, observabilidade). Elas revisam o RFC, trazem a visão das trincheiras e viram embaixadoras do padrão nos seus times;
4. **Registre a decisão** num ADR (*Architecture Decision Record*), com o contexto e os motivos, para que daqui a dois anos ninguém precise adivinhar o porquê;
5. **Faça um piloto** com um ou dois times voluntários antes de espalhar, e ajuste com base no que eles aprenderem;

O artigo do Andrew Harmel-Law no martinfowler.com sobre escalar a arquitetura com o ***advice process*** é uma ótima leitura aqui: qualquer pessoa pode tomar uma decisão de arquitetura, desde que peça conselho a quem é afetado e a quem tem experiência no assunto. Encaixa muito bem com padrões.

### Vida: dono e versionamento

Depois de adotado, um padrão precisa do mesmo que qualquer produto: um **dono** (um time ou um grupo nomeado, nunca "todo mundo"), um lugar onde está documentado, uma versão, um *changelog* e um canal para dúvidas e *feedback*. Padrões também precisam aparecer onde os devs já estão: nos *templates*, nos *linters*, nas verificações do *pipeline* e no portal, e não só numa página de wiki.

### Morte: depreciação e aposentadoria

Padrões devem morrer. Tecnologias envelhecem, opções melhores aparecem, e um padrão que era ótimo cinco anos atrás pode virar uma âncora. Aposentar um padrão direito envolve:

- **Movê-lo para Evite** no radar e anunciar o substituto;
- **Definir uma data de *sunset***, com tempo suficiente para os times migrarem;
- **Oferecer um caminho de migração**: guias, *codemods*, *templates* atualizados e ajuda dos donos;
- **Acompanhar o uso**, para saber quem ainda depende dele e ajudar essas pessoas especificamente;
- **Remover de verdade** quando a data chegar, em vez de deixar lá para sempre;

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Mas por que aposentar alguma coisa? Se o padrão antigo ainda funciona, deixa ele lá. Não faz mal a ninguém!"</span>
    </div>
  </div>
</div>

Ah, Júnior, quem dera fosse simples assim! Todo padrão que nunca é aposentado continua no cenário, e mantê-lo custa dinheiro: alguém precisa aplicar *patches*, alguém precisa saber como ele funciona, quem chega precisa aprendê-lo. Sem aposentadoria, a "padronização" vira acúmulo aos poucos. Você acaba com dois padrões para a mesma coisa, depois três, e volta direto para os doze loggers, só que agora cada um com carimbo oficial. Aposentar padrões faz parte deste princípio tanto quanto criá-los.

## A Armadilha da Padronização Excessiva

Agora o outro lado da moeda. Assim como a falta de padrões gera caos, o excesso gera paralisia. Sinais de que você passou do ponto:

- Os times precisam da aprovação de um comitê para usar qualquer biblioteca, até numa ferramenta interna pequena;
- A *stack* aprovada não muda há anos, e toda ideia nova esbarra no "não está no padrão";
- As pessoas passam mais tempo preenchendo pedido de exceção do que escrevendo código;
- Bons engenheiros vão embora porque sentem que não podem aprender nem testar nada novo;
- Aparece o *shadow IT*: os times usam o que querem, em silêncio, e escondem;
- Os padrões descrevem como as coisas eram feitas em 2018, e não como os melhores times trabalham hoje;

A padronização excessiva mata a inovação de um jeito bem silencioso. Ninguém proíbe explicitamente a experimentação; ela só fica tão cara que ninguém se dá ao trabalho.

Alguns jeitos de evitar isso:

| Abordagem | Benefício |
| :--- | :--- |
| **Padronize as costuras, não o recheio.** Seja rígido com contratos e plataformas, flexível com detalhes de implementação. | Os times mantêm autonomia real onde ela não afeta os outros. |
| **Mantenha vivos os anéis Avalie e Experimente.** Toda edição do radar deveria trazer coisas novas, não só tirar. | A inovação ganha um caminho legítimo, em vez de acontecer nas sombras. |
| **Deixe as exceções baratas e visíveis.** Uma justificativa curta por escrito, não um processo de aprovação de três semanas. | Você aprende onde os padrões não servem, e os times não precisam se esconder. |
| **Dê validade aos padrões.** Revise cada um periodicamente: ainda é a melhor opção? | Os padrões evoluem com o mercado em vez de fossilizar. |
| **Meça os resultados, não a conformidade.** Tempo de *onboarding*, tempo até o primeiro deploy, tempo de resolução de incidentes, satisfação dos devs. | Você sabe se os padrões ajudam, e não só se estão sendo seguidos. |
| **Ofereça *sandboxes* para experimentos.** Ambientes isolados onde os times testam qualquer coisa dentro de limites de custo e segurança. | Aprender continua barato e seguro, sem poluir a produção. |

<div class="callout info">
  <p>Os melhores padrões são aqueles que os times escolheriam de qualquer forma, se tivessem tempo de avaliar todas as opções. Um padrão que precisa ser imposto na marra muitas vezes está dizendo que é o padrão errado (ou que ninguém explicou o porquê).</p>
</div>

## Tradeoffs

A **padronização** reduz variância, carga cognitiva e risco, e permite que a organização aprenda uma vez e aplique em todo lugar. Mas, como todo princípio, ela traz *trade-offs*. Algo que deixa o cenário mais consistente pode prejudicar outras qualidades da arquitetura, ou da própria organização.

Bora ver os principais?

### Consistência vs Autonomia dos Times

Essa é a tensão central. Todo padrão tira uma escolha de um time. Quando a escolha não importava muito (qual logger), é ganho. Quando a escolha importava de verdade para o problema daquele time (um time de dados obrigado a usar o mesmo banco de um serviço CRUD), é perda, e às vezes grande.

O equilíbrio vem da divisão que vimos antes: rígido nas costuras, flexível no recheio. E de uma cultura em que os times podem questionar um padrão com argumentos e dados, e em que os donos do padrão realmente escutam. Autonomia e alinhamento não são opostos; o objetivo é a *autonomia alinhada*.

### Lock-in em Plataformas Internas

Todo mundo se preocupa com *vendor lock-in* em provedores de nuvem, mas pouca gente percebe o ***lock-in* interno**. Quando todos os serviços dependem da plataforma interna, das bibliotecas internas e dos *templates* internos, a empresa fica presa à própria criação. Se o time de plataforma encolher, se a plataforma envelhecer ou se a empresa for adquirida e precisar se integrar a outra *stack*, essa dependência pode sair muito cara.

Algumas mitigações: construa a plataforma sobre padrões abertos (OpenTelemetry, contêineres OCI, ferramentas de IaC de mercado) em vez de formatos internos proprietários; mantenha as camadas de abstração finas, para que os times enxerguem o que existe por baixo; e documente as rotas de fuga. A ideia de *thinnest viable platform* existe justamente para isso.

### Custo de Manutenção dos Componentes Compartilhados

Nada é de graça. Uma biblioteca compartilhada, um módulo de IaC ou um *template* de *golden path* precisa de gente: para corrigir bugs, atualizar dependências, responder dúvidas, manter a retrocompatibilidade, escrever documentação. Quando esse custo não é planejado, o componente compartilhado apodrece aos poucos, os times perdem a confiança nele e voltam a construir o próprio. É assim que se chega a doze loggers *com* um padrão.

Se a organização quer blocos reutilizáveis, precisa financiá-los como produtos, com time, *roadmap* e orçamento. Caso contrário, é melhor ter menos blocos e mantê-los bem.

### Tradeoffs com Confiabilidade (Reliability)

Componentes compartilhados criam **modos de falha compartilhados**. Um bug no cliente HTTP comum ou uma versão ruim da imagem base de contêiner pode atingir todos os serviços de uma vez. O *blast radius* de um erro cresce junto com a adoção. Monoculturas são eficientes até o dia em que adoecem todas juntas.

Mitigações: distribua versões novas de componentes compartilhados de forma progressiva (times *canary* primeiro), mantenha a retrocompatibilidade, teste muito e garanta que os serviços fixem versões em vez de sempre puxar a "latest". Do lado positivo, uma biblioteca de resiliência bem feita pode aumentar a [confiabilidade](/pt-br/principles/cloud/reliability/) de todos os serviços de uma vez só.

### Tradeoffs com Segurança (Security)

A padronização é, na maior parte do tempo, amiga da [segurança](/pt-br/principles/cloud/security/): menos tecnologias significam uma superfície de ataque menor, *patches* são aplicados num lugar só e inventários ficam fáceis. O outro lado é que uma única vulnerabilidade num componente muito adotado expõe tudo ao mesmo tempo, e os atacantes adoram componentes muito usados exatamente por isso. O *pipeline* compartilhado e o *registry* interno de pacotes também viram alvos valiosos na cadeia de suprimentos de software, e precisam ser protegidos à altura (*frameworks* como o SLSA ajudam aqui).

### Tradeoffs com Otimização de Custos (Cost Optimization)

Times de plataforma, comunidades de prática, revisões de RFC, migrações para padrões novos e a aposentadoria dos antigos consomem tempo e dinheiro que poderiam ir para funcionalidades do produto. No curto prazo, a padronização muitas vezes *custa* mais do que economiza. O retorno vem depois, com *onboarding* mais rápido, menos incidentes e menos trabalho duplicado. Por outro lado, os padrões também podem melhorar a [otimização de custos](/pt-br/principles/cloud/cost-optimization/) diretamente: módulos padrão com *tags* obrigatórias, tamanhos padrão bem dimensionados e licenças consolidadas.

### Tradeoffs com Eficiência de Performance (Performance Efficiency)

Padrões são feitos para o caso comum. Um cliente HTTP genérico, uma configuração padrão de banco ou um tamanho padrão de contêiner vão ser bons o bastante para a maioria dos serviços e subótimos para alguns. Um serviço com requisitos extremos de latência ou *throughput* pode precisar sair do trilho, e os padrões devem permitir isso quando houver evidência (medições, não achismo) de que o padrão não dá conta.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Pera aí... Então padrão de menos é caos, padrão demais é paralisia, e cada um tem um custo. Como eu sei qual é o ponto certo?"</span>
    </div>
  </div>
</div>

Exatamente, Júnior, não existe número mágico. O ponto certo depende do tamanho da empresa, do contexto regulatório, da maturidade e da estratégia. Uma *startup* com três times precisa de pouquíssimos padrões; um banco com trezentos times precisa de muito mais. O que funciona em qualquer lugar é começar pelas costuras que mais doem, medir se os padrões ajudam, ouvir os times que os usam e continuar aposentando o que não faz mais sentido. Padronização é uma prática contínua, não um projeto com data para acabar.

## Conclusão

A **padronização** é como uma organização para de pagar, de novo e de novo, pelas mesmas decisões. Radares de tecnologia deixam as escolhas explícitas, arquiteturas de referência dão aos times um ponto de partida comprovado, *golden paths* e plataformas internas fazem do padrão o caminho mais fácil, módulos de IaC reutilizáveis e guias de API mantêm as costuras consistentes, e o *inner source* mantém os componentes compartilhados vivos e evoluindo.

**Mais importante:** bons padrões nascem de dores reais, são construídos com as pessoas que vão usá-los, têm dono e morrem quando deixam de ser a melhor opção. Eles reduzem carga cognitiva, tempo de *onboarding* e risco, sem matar a experimentação que faz a empresa andar para a frente.

E lembre-se: os padrões definem o *quê*. Quem decide, como a conformidade é verificada e como as exceções são tratadas é papel da [governança](/pt-br/principles/enterprise/governance/). Acerte os dois e você terá uma organização em que os times andam rápido *porque* compartilham um chão comum sólido, e não apesar dele.

## Próximos Passos

1. **Faça o inventário do cenário atual**
Mapeie quais linguagens, *frameworks*, bibliotecas, *pipelines* e padrões de infraestrutura estão em uso hoje. Não dá para padronizar o que você não enxerga, e só o inventário já costuma revelar as piores duplicações.

2. **Escolha as costuras que mais doem**
Comece pelas áreas em que a inconsistência causa incidentes ou atrasos de verdade: logs e *tracing*, erros de API, autenticação, *pipelines* de deploy. Deixe o recheio dos serviços em paz.

3. **Publique o seu primeiro radar de tecnologia**
Mesmo um radar simples, com algumas dezenas de itens, dá aos times uma referência comum e abre a conversa sobre o que adotar, experimentar, avaliar e evitar.

4. **Construa um golden path de ponta a ponta**
Escolha o tipo de serviço mais comum da empresa e torne possível ir do zero à produção pela estrada pavimentada em horas. Meça o tempo até o primeiro deploy antes e depois.

5. **Monte o ciclo de vida**
Crie um *template* de RFC, uma comunidade de prática, ADRs e um dono para cada padrão. Defina como os padrões são revisados, depreciados e aposentados, e use o processo de verdade.

6. **Meça e escute**
Acompanhe o tempo de *onboarding*, o tempo de resolução de incidentes, a adoção dos componentes compartilhados e a satisfação dos devs. Quando os times insistirem em sair do *golden path*, trate isso como *feedback* sobre o caminho.

<div class="callout info" data-title="Referências">
  <ul>
    <li><a href="https://www.thoughtworks.com/radar" target="_blank" rel="noopener">ThoughtWorks Technology Radar</a></li>
    <li><a href="https://teamtopologies.com/" target="_blank" rel="noopener">Team Topologies</a></li>
    <li><a href="https://tag-app-delivery.cncf.io/whitepapers/platforms/" target="_blank" rel="noopener">CNCF Platforms White Paper</a></li>
    <li><a href="https://backstage.io/" target="_blank" rel="noopener">Backstage, uma plataforma aberta para portais de desenvolvimento</a></li>
    <li><a href="https://innersourcecommons.org/" target="_blank" rel="noopener">InnerSource Commons</a></li>
    <li><a href="https://martinfowler.com/articles/scaling-architecture-conversationally.html" target="_blank" rel="noopener">Scaling the Practice of Architecture, Conversationally (martinfowler.com)</a></li>
    <li><a href="https://www.rfc-editor.org/rfc/rfc9457" target="_blank" rel="noopener">RFC 9457: Problem Details for HTTP APIs</a></li>
    <li><a href="https://github.com/microsoft/api-guidelines" target="_blank" rel="noopener">Microsoft REST API Guidelines</a></li>
    <li><a href="https://google.aip.dev/" target="_blank" rel="noopener">Google API Improvement Proposals (AIP)</a></li>
    <li><a href="https://semver.org/lang/pt-BR/" target="_blank" rel="noopener">Versionamento Semântico</a></li>
    <li><a href="https://opentelemetry.io/" target="_blank" rel="noopener">OpenTelemetry</a></li>
    <li><a href="https://learn.microsoft.com/azure/well-architected/" target="_blank" rel="noopener">Microsoft Azure Well-Architected Framework</a></li>
  </ul>
</div>
