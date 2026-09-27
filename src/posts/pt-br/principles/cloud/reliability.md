---
title: Confiabilidade
short: "Tudo falha, o tempo todo: confiabilidade é decidir antes quanta falha você aguenta e garantir que o sistema sobreviva ao resto."
category: cloud
---

## Introdução

O Werner Vogels, CTO da Amazon, tem uma frase que todo arquiteto deveria ter emoldurada na parede: *"Everything fails, all the time."* Tudo falha, o tempo todo. Disco morre, zona cai, certificado expira às 3 da manhã, uma mudança de DNS propaga para meio planeta e aquela dependência que ninguém lembra de ter adicionado resolve tirar a tarde de folga.

A **meta** do pilar de Confiabilidade não é construir um sistema que nunca falha (esse sistema não existe). A meta é construir um *workload* que **continue fazendo o que prometeu, no nível que prometeu, mesmo quando partes dele falham**, e que se recupere de forma rápida e previsível quando algo grande dá errado.

Quando o time negligencia a confiabilidade, os sintomas aparecem rápido, e geralmente em produção:

- Ninguém sabe qual é a meta de disponibilidade, então todo incidente vira uma discussão sobre se "foi tão grave assim";
- A arquitetura tem um único banco de dados, em uma única zona, e uma única pessoa que sabe restaurá-lo;
- Os backups existem, na teoria, mas ninguém nunca tentou restaurar um;
- Toda indisponibilidade é uma surpresa, porque os modos de falha nunca foram mapeados;
- O time promete 99,99% para o cliente enquanto as dependências, multiplicadas, entregam 99,8%;
- A recuperação depende de heroísmo, sala de guerra e muita sorte.

Pois é, *é raro, mas acontece bastante*... Quem nunca viu a página de status verdinha enquanto o telefone não parava de tocar?

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Mas agora a gente tá na nuvem! A nuvem nunca cai, né? É pra isso que a gente paga."</span>
    </div>
  </div>
</div>

Calma aí, Júnior! A nuvem cai sim. Não com frequência, e normalmente não tudo de uma vez, mas cai. O que a nuvem te dá são **blocos de construção** para a confiabilidade: múltiplas zonas, múltiplas regiões, replicação gerenciada, *health probes*, balanceadores de carga e automação. Ela não monta tudo isso para você.

É o famoso **modelo de responsabilidade compartilhada** aplicado à confiabilidade. O provedor é responsável pela confiabilidade *da* nuvem (data centers, hardware, a plataforma em si). Você é responsável pela confiabilidade *na* nuvem: como você faz o deploy, onde replica, como recupera e como o seu código se comporta quando uma dependência fica lenta ou some. Se você sobe uma única VM em uma única zona, o provedor vai manter essa VM rodando exatamente com a confiabilidade que uma única VM em uma única zona consegue oferecer.

<div class="callout info">
  <p>Confiabilidade é uma <strong>decisão de design</strong>, não uma funcionalidade que você liga. Ela começa com uma meta honesta acordada com o negócio, e toda escolha arquitetural (zonas, regiões, replicação, backups, testes) deve ser rastreável até essa meta.</p>
</div>

## Confiabilidade, Disponibilidade e Resiliência

Essas três palavras vivem sendo confundidas, então vamos alinhar antes de seguir:

- **Disponibilidade** (*availability*) é o percentual de tempo em que o sistema está utilizável. É uma medida: "a API de checkout ficou disponível 99,93% do tempo no mês passado".
- **Resiliência** (*resilience*) é a capacidade de absorver uma falha e continuar funcionando, talvez de forma degradada. É uma propriedade do design: "quando o serviço de recomendações falha, a página do produto carrega sem as recomendações".
- **Confiabilidade** (*reliability*) é o objetivo mais amplo: o sistema faz o que deveria fazer, corretamente e de forma consistente, ao longo do tempo. Disponibilidade e resiliência são ingredientes. Um sistema que está "no ar", mas devolve dados errados, está disponível e não é nada confiável.

Nos frameworks Well-Architected (Azure, AWS e Google Cloud têm cada um a sua versão), o pilar de Confiabilidade cobre o nível do *workload* e da infraestrutura: metas, redundância, recuperação, testes. As técnicas no nível do código, que fazem cada chamada sobreviver a falhas, como *retry* com *backoff*, *circuit breaker*, *bulkhead* e *timeouts*, têm sua própria casa em [Padrões de Resiliência](/pt-br/principles/solution/resilience-patterns/). As duas coisas são necessárias: uma arquitetura multirregião não te salva de um serviço que faz *retry* em loop apertado e derruba o próprio banco de dados.

## Defina Metas de Confiabilidade

**Objetivo:** combinar com o negócio o quão confiável o *workload* precisa ser, e expressar isso em números que dá para medir.

Sem meta, "confiável" significa o que a pessoa mais ansiosa da sala achar que significa. Com meta, vira um requisito de engenharia que você consegue projetar, medir e pagar.

### SLI, SLO e SLA

Três siglas, três coisas bem diferentes:

- **SLI (Service Level Indicator):** o que você **mede**. Por exemplo, a proporção de requisições com sucesso sobre o total, ou o percentual de requisições respondidas em menos de 300 ms.
- **SLO (Service Level Objective):** a **meta** interna para um SLI em uma janela de tempo. Por exemplo, "99,9% das requisições de checkout com sucesso nos últimos 30 dias".
- **SLA (Service Level Agreement):** o **contrato** com o cliente, normalmente com consequências financeiras (créditos de serviço) quando é quebrado. Por exemplo, "99,5% de disponibilidade mensal, ou você recebe créditos".

A regra de ouro: **o seu SLA deve ser mais folgado que o seu SLO**. O SLO é o seu alarme antecipado; se você quebrá-lo, ainda sobra margem antes de quebrar a promessa feita ao cliente e começar a pagar por isso.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 280" role="img" aria-labelledby="rel-d1-title rel-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="rel-d1-title">SLI, SLO, SLA e o error budget</title>
<desc id="rel-d1-desc">O SLI é o que você mede, o SLO é a meta interna para essa medida e o SLA é o contrato mais folgado com o cliente. O error budget é 100% menos o SLO.</desc>
<defs><marker id="rel-d1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="360" y="36" text-anchor="middle" class="d-label">MEDIR, MIRAR, PROMETER</text>
<rect x="30" y="65" width="190" height="105" rx="10" class="d-box-info"/>
<text x="125" y="97" text-anchor="middle" class="d-title">SLI</text>
<text x="125" y="122" text-anchor="middle" class="d-text">O que você mede</text>
<text x="125" y="146" text-anchor="middle" class="d-small">requisições OK / total</text>
<line x1="222" y1="117" x2="263" y2="117" class="d-line" marker-end="url(#rel-d1-arrow)"/>
<rect x="265" y="65" width="190" height="105" rx="10" class="d-box-accent"/>
<text x="360" y="97" text-anchor="middle" class="d-title">SLO</text>
<text x="360" y="122" text-anchor="middle" class="d-text">Meta interna</text>
<text x="360" y="146" text-anchor="middle" class="d-small">99,9% em 30 dias</text>
<line x1="457" y1="117" x2="498" y2="117" class="d-line" marker-end="url(#rel-d1-arrow)"/>
<rect x="500" y="65" width="190" height="105" rx="10" class="d-box-warn"/>
<text x="595" y="97" text-anchor="middle" class="d-title">SLA</text>
<text x="595" y="122" text-anchor="middle" class="d-text">Contrato com cliente</text>
<text x="595" y="146" text-anchor="middle" class="d-small">99,5%, ou créditos</text>
<text x="360" y="200" text-anchor="middle" class="d-label">ERROR BUDGET</text>
<rect x="30" y="212" width="660" height="50" rx="10" class="d-box-muted"/>
<text x="360" y="242" text-anchor="middle" class="d-text">100% menos o SLO: 0,1% de 30 dias, uns 43 minutos para gastar</text>
</svg>
</div>
<figcaption>Figura 1: O SLI mede, o SLO mira, o SLA promete, e a folga é o seu error budget</figcaption>
</figure>

Um bom SLI é medido **do ponto de vista do usuário**. CPU em 40% não é SLI; "a página de login carregou em menos de 2 segundos para 99% dos usuários" é. O seu cliente não quer saber se todos os pods estão verdes quando o balanceador está devolvendo 502.

### Os Noves e o Tempo Real de Indisponibilidade

"Vamos de cinco noves!" é uma ótima frase para um slide e uma péssima frase para um orçamento. Cada nove a mais divide por dez o tempo de indisponibilidade permitido, e o custo para chegar lá cresce muito mais rápido que isso. Olha o que os números significam de verdade:

| Disponibilidade | Indisponibilidade por ano | Indisponibilidade por mês (30 dias) | Na prática |
| :--- | :--- | :--- | :--- |
| **99%** (dois noves) | cerca de 3,65 dias | cerca de 7,2 horas | Ferramentas internas, processos batch que podem esperar |
| **99,9%** (três noves) | cerca de 8,8 horas | cerca de 43 minutos | A maioria das aplicações de negócio |
| **99,95%** | cerca de 4,4 horas | cerca de 22 minutos | Sistemas importantes voltados ao cliente |
| **99,99%** (quatro noves) | cerca de 53 minutos | cerca de 4,3 minutos | Sistemas críticos; exige recuperação automática, humano é lento demais |
| **99,999%** (cinco noves) | cerca de 5,3 minutos | cerca de 26 segundos | Telecom, núcleo de pagamentos; multirregião ativo-ativo, investimento pesado |

Olha de novo a linha dos quatro noves: **4,3 minutos por mês**. É menos tempo do que levar o alerta, abrir o notebook, conectar na VPN e achar o dashboard certo. Nesse nível, a recuperação precisa ser automática, ponto final.

O número certo de noves é uma **decisão de negócio**. Pergunte ao negócio: quanto custa uma hora de indisponibilidade (receita, multas, reputação)? Quanto custa construir e operar o próximo nove? Se a resposta da segunda for maior que a da primeira, você achou a sua meta. É exatamente aqui que a confiabilidade encontra a [Otimização de Custos](/pt-br/principles/cloud/cost-optimization/).

### SLA Composto

Agora vem a parte que surpreende muita gente. O seu *workload* não é um serviço só; é uma corrente de serviços. E quando os componentes dependem uns dos outros **em série** (todos precisam funcionar para a requisição funcionar), as disponibilidades **se multiplicam**.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Fácil: o banco do provedor tem SLA de 99,99%, então a nossa aplicação também tem 99,99%. Já coloquei no contrato."</span>
    </div>
  </div>
</div>

Ai, Júnior. Vamos fazer a conta. A sua aplicação roda numa plataforma web com 99,95%, conversa com um banco de dados com 99,99% e com um cache com 99,9%. Se qualquer um deles falhar, a requisição falha. Então:

0,9995 × 0,9999 × 0,999 ≈ **0,9984**, ou **99,84%**, o que dá mais ou menos **14 horas de indisponibilidade por ano**. E isso antes de contar o seu próprio código, os seus deploys, o DNS, o provedor de identidade e o gateway de pagamento.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 310" role="img" aria-labelledby="rel-d2-title rel-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="rel-d2-title">Disponibilidade composta em série e em paralelo</title>
<desc id="rel-d2-desc">Três dependências em série com 99,95, 99,99 e 99,9 por cento resultam em cerca de 99,84 por cento. Duas regiões independentes de 99,84 por cento em paralelo resultam em cerca de 99,9997 por cento, se o failover funcionar.</desc>
<defs><marker id="rel-d2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="360" y="32" text-anchor="middle" class="d-label">EM SÉRIE: CADA DEPENDÊNCIA MULTIPLICA</text>
<rect x="20" y="55" width="140" height="90" rx="10" class="d-box"/>
<text x="90" y="92" text-anchor="middle" class="d-title">App web</text>
<text x="90" y="116" text-anchor="middle" class="d-text">99,95%</text>
<line x1="162" y1="100" x2="188" y2="100" class="d-line" marker-end="url(#rel-d2-arrow)"/>
<rect x="190" y="55" width="140" height="90" rx="10" class="d-box"/>
<text x="260" y="92" text-anchor="middle" class="d-title">Banco</text>
<text x="260" y="116" text-anchor="middle" class="d-text">99,99%</text>
<line x1="332" y1="100" x2="358" y2="100" class="d-line" marker-end="url(#rel-d2-arrow)"/>
<rect x="360" y="55" width="140" height="90" rx="10" class="d-box"/>
<text x="430" y="92" text-anchor="middle" class="d-title">Cache</text>
<text x="430" y="116" text-anchor="middle" class="d-text">99,9%</text>
<line x1="502" y1="100" x2="538" y2="100" class="d-line-danger" marker-end="url(#rel-d2-arrow)"/>
<rect x="540" y="55" width="160" height="90" rx="10" class="d-box-danger"/>
<text x="620" y="87" text-anchor="middle" class="d-title">Composto</text>
<text x="620" y="110" text-anchor="middle" class="d-text">99,84%</text>
<text x="620" y="130" text-anchor="middle" class="d-small">cerca de 14 h por ano</text>
<text x="360" y="190" text-anchor="middle" class="d-label">EM PARALELO: REDUNDÂNCIA SOMA NOVES</text>
<rect x="20" y="208" width="200" height="38" rx="10" class="d-box-info"/>
<text x="120" y="232" text-anchor="middle" class="d-text">Região A: 99,84%</text>
<rect x="20" y="256" width="200" height="38" rx="10" class="d-box-info"/>
<text x="120" y="280" text-anchor="middle" class="d-text">Região B: 99,84%</text>
<line x1="222" y1="227" x2="298" y2="242" class="d-line-accent" marker-end="url(#rel-d2-arrow)"/>
<line x1="222" y1="275" x2="298" y2="260" class="d-line-accent" marker-end="url(#rel-d2-arrow)"/>
<rect x="300" y="213" width="230" height="76" rx="10" class="d-box-accent"/>
<text x="415" y="245" text-anchor="middle" class="d-title">Combinado: 99,9997%</text>
<text x="415" y="268" text-anchor="middle" class="d-small">só se o failover funcionar</text>
<text x="625" y="236" text-anchor="middle" class="d-small">Roteamento global e</text>
<text x="625" y="253" text-anchor="middle" class="d-small">replicação de dados</text>
<text x="625" y="270" text-anchor="middle" class="d-small">têm SLA próprio</text>
</svg>
</div>
<figcaption>Figura 2: Dependências em série perdem noves; redundância independente os recupera</figcaption>
</figure>

A boa notícia é que a matemática também joga a seu favor. Quando você coloca cópias **independentes** **em paralelo** (qualquer uma pode atender a requisição), você passa a multiplicar as probabilidades de *falha*: duas regiões de 99,84% só falham juntas 0,16% × 0,16% do tempo, o que dá uns 99,9997%. Na teoria.

Na prática, o caminho paralelo adiciona novos componentes em série (balanceamento global, DNS, replicação de dados, a própria lógica de *failover*), e eles têm a sua própria disponibilidade. A redundância só é tão boa quanto o mecanismo que chaveia para ela. Por isso a seção de testes, mais adiante, não é opcional.

<div class="callout tip" data-title="Regra prática">
  <p>Antes de assinar qualquer SLA, desenhe a cadeia de dependências do seu fluxo crítico, anote a disponibilidade de cada salto e multiplique. Se o resultado for menor do que o comercial quer prometer, você precisa de redundância ou de outra promessa. Nunca o contrário.</p>
</div>

### Error Budget

Aqui vem a ideia que mudou a forma como muitos times pensam confiabilidade, direto da prática de SRE do Google: **se o seu SLO é 99,9%, então 0,1% de falha não é um problema, é um orçamento**.

Em 30 dias, isso dá uns 43 minutos de falha "permitida". O time pode gastar esse orçamento com deploys arriscados, experimentos, migrações e manutenções planejadas. O *error budget* transforma a eterna briga entre "entregar feature rápido" e "não mexe em produção" numa regra simples e baseada em dados:

- **Sobrou orçamento:** entregue, experimente, corra riscos calculados;
- **Orçamento queimando rápido:** desacelere, investigue, adicione proteções;
- **Orçamento esgotado:** congele mudanças arriscadas e foque em confiabilidade até ele se recuperar.

Ele também te protege do problema oposto: correr atrás de 100%. Um serviço que nunca usa o seu *error budget* provavelmente está andando devagar demais ou está superdimensionado (e pagando caro por isso). **100% é a meta errada para praticamente tudo**, porque os dispositivos, as redes e os provedores de internet dos próprios usuários são bem menos confiáveis que isso, e eles nunca perceberiam a diferença.

## Identifique Fluxos Críticos e Modos de Falha

**Objetivo:** saber quais partes do *workload* importam mais e como cada uma delas pode falhar, antes que a produção te ensine.

### Fluxos Críticos

Nem tudo no seu sistema merece o mesmo nível de confiabilidade. Tratar tudo como crítico sai caro e, no fim, significa que nada é realmente prioridade.

Quebre o *workload* em **fluxos de usuário** e classifique cada um pelo impacto no negócio. Num e-commerce, por exemplo:

| Fluxo | Criticidade | Por quê |
| :--- | :--- | :--- |
| **Checkout e pagamento** | Alta | Perda direta de receita a cada minuto fora do ar |
| **Busca e catálogo de produtos** | Alta | Sem navegação, sem compra |
| **Histórico de pedidos** | Média | Incomoda, mas o cliente espera uma hora |
| **Recomendações de produtos** | Baixa | A página funciona muito bem sem elas |
| **Relatório mensal de vendas** | Baixa | Pode rodar de novo amanhã |

Agora cada fluxo pode ter o seu próprio SLO e o seu próprio orçamento de redundância. O checkout pode ganhar multizona, multirregião e quatro noves; as recomendações podem viver numa zona só e simplesmente sumir da página quando falharem (isso é **degradação graciosa**, ou *graceful degradation*, e é uma das vitórias de confiabilidade mais baratas que existem).

### Análise de Modos de Falha

Com os fluxos críticos mapeados, faça uma **Análise de Modos de Falha** (*Failure Mode Analysis*, ou FMA): para cada componente do fluxo, pergunte "como isso pode falhar, o que acontece quando falha, como vamos saber e o que fazemos a respeito?"

| Componente | Modo de falha | Impacto | Detecção | Mitigação |
| :--- | :--- | :--- | :--- | :--- |
| **Banco de dados** | Nó primário cai | Checkout falha | *Health probe*, alerta de taxa de erro | Réplica com redundância de zona e *failover* automático |
| **Provedor de pagamento** | Respostas lentas (5s ou mais) | Threads se acumulam, a API inteira fica lenta | SLI de latência da dependência | *Timeouts* e *circuit breaker*, fila e nova tentativa depois |
| **Zona** | Zona inteira fora do ar | Instâncias daquela zona somem | Eventos de saúde da plataforma, *probes* | Instâncias distribuídas em três zonas |
| **Certificado TLS** | Expira | Todo cliente recebe erro | Monitoramento de expiração com 30 dias de antecedência | Renovação automática |
| **Região** | Indisponibilidade regional | O *workload* inteiro cai | Testes sintéticos de fora da região | Região secundária com estratégia de DR (veja abaixo) |

Algumas dessas linhas são decisões de infraestrutura (zonas, réplicas, regiões) e pertencem a este pilar. Outras, como a forma que a API reage a um provedor de pagamento lento, são decisões de código e vivem em [Padrões de Resiliência](/pt-br/principles/solution/resilience-patterns/). Uma boa FMA cobre as duas, e é um documento vivo: todo *post-mortem* de incidente deveria adicionar ou atualizar uma linha.

Preste atenção especial aos **pontos únicos de falha** (*single points of failure*: o único NAT gateway, o único provedor de DNS, o único cofre de segredos, o único engenheiro que tem a senha) e às **dependências que não são suas**. APIs de terceiros, provedores de identidade e ferramentas SaaS fazem parte do seu SLA composto, você querendo ou não.

## Projete com Redundância

**Objetivo:** garantir que nenhuma falha isolada num fluxo crítico derrube o fluxo.

Redundância é ter mais de um de qualquer coisa cuja falha doeria: instâncias, zonas, regiões, caminhos de rede, até pessoas de plantão. A pergunta é sempre **em que nível** você precisa dela, e a resposta vem direto das suas metas.

### Zonas e Regiões

Os provedores de nuvem organizam a infraestrutura em camadas, e cada camada te protege contra um tipo diferente de falha:

- **Múltiplas instâncias em uma zona** protegem contra a falha de uma máquina ou processo. Barato, e o mínimo do mínimo para qualquer coisa em produção.
- **Múltiplas zonas de disponibilidade** (data centers fisicamente separados na mesma região, com energia, refrigeração e rede independentes) protegem contra a falha de um data center. A latência entre zonas é baixa, então replicação síncrona costuma ser viável. Para a maioria dos *workloads* em produção, **redundância de zona é o ponto ideal** entre custo e proteção.
- **Múltiplas regiões** protegem contra um desastre regional ou um incidente amplo da plataforma. A distância traz latência maior, então a replicação costuma ser assíncrona (o que significa que alguma perda de dados é possível num *failover*), e custo e complexidade dão um salto considerável.

Um padrão pragmático: **redundância de zona na região primária para tudo que é crítico, mais uma estratégia de DR documentada e testada para uma segunda região**, dimensionada conforme o RTO e o RPO que o negócio definiu.

### Ativo-Ativo vs Ativo-Passivo

Quando você tem mais de um local, precisa decidir como eles dividem o trabalho:

| Modelo | Como funciona | Benefício | Cuidado com |
| :--- | :--- | :--- | :--- |
| **Ativo-Ativo** | Todos os locais atendem tráfego ao mesmo tempo | Tempo de recuperação quase zero, a capacidade paga é realmente usada, falhas só reduzem capacidade | Consistência de dados entre locais, resolução de conflitos, cada local precisa aguentar a carga inteira se outro cair |
| **Ativo-Passivo** | Um local atende o tráfego; o outro espera, pronto para assumir | Modelo de dados mais simples, mais fácil de entender | O *failover* leva tempo, o lado passivo pode apodrecer em silêncio se nunca for testado, você paga por capacidade ociosa |

Ativo-ativo parece o vencedor óbvio, e para camadas sem estado (*stateless*) muitas vezes é mesmo. A parte difícil é o **estado**. Escrever nos mesmos dados a partir de duas regiões significa lidar com atraso de replicação, conflitos e modelos de consistência, e essa complexidade tem os seus próprios modos de falha. Muitos times acabam num híbrido: ativo-ativo para o *front-end* e as APIs sem estado, ativo-passivo (ou escritor único) para o banco de dados.

Mais uma armadilha: no ativo-ativo, se cada uma das duas regiões roda normalmente a 70% da capacidade, perder uma significa que a sobrevivente precisa aguentar 140%. **Redundância sem folga é só uma indisponibilidade mais lenta.** Planeje a capacidade para o cenário de falha, não para o dia de sol, e garanta que os limites de *autoscaling* e as cotas da região sobrevivente permitam isso.

## RTO e RPO

**Objetivo:** definir, por fluxo crítico, quanto tempo você pode ficar fora do ar e quantos dados pode perder.

Esses dois números guiam praticamente toda decisão de recuperação de desastres:

- **RTO (Recovery Time Objective):** o tempo máximo aceitável entre o desastre e o serviço voltar. "Quanto tempo podemos ficar fora?"
- **RPO (Recovery Point Objective):** a perda máxima aceitável de dados, medida em tempo. "Se restaurarmos a partir da última cópia boa, quanto voltamos no tempo?"

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 240" role="img" aria-labelledby="rel-d4-title rel-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="rel-d4-title">RPO e RTO numa linha do tempo</title>
<desc id="rel-d4-desc">Uma linha do tempo com a última cópia boa dos dados, depois o desastre, depois o serviço restaurado. O RPO é o intervalo entre a última cópia boa e o desastre, os dados perdidos. O RTO é o intervalo entre o desastre e a restauração, o tempo fora do ar.</desc>
<defs><marker id="rel-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="360" y="34" text-anchor="middle" class="d-label">O RPO OLHA PARA TRÁS, O RTO PARA FRENTE</text>
<line x1="40" y1="130" x2="690" y2="130" class="d-line" marker-end="url(#rel-d4-arrow)"/>
<circle cx="180" cy="130" r="8" class="d-fill-info"/>
<text x="180" y="105" text-anchor="middle" class="d-text">Última cópia boa</text>
<circle cx="360" cy="130" r="8" class="d-fill-danger"/>
<text x="360" y="105" text-anchor="middle" class="d-text">Desastre</text>
<circle cx="580" cy="130" r="8" class="d-fill-accent"/>
<text x="580" y="105" text-anchor="middle" class="d-text">Serviço restaurado</text>
<rect x="184" y="152" width="172" height="30" rx="10" class="d-box-warn"/>
<text x="270" y="172" text-anchor="middle" class="d-text">RPO: dados perdidos</text>
<rect x="364" y="152" width="212" height="30" rx="10" class="d-box-danger"/>
<text x="470" y="172" text-anchor="middle" class="d-text">RTO: tempo fora do ar</text>
<text x="270" y="208" text-anchor="middle" class="d-small">Quanto dado podemos perder?</text>
<text x="470" y="208" text-anchor="middle" class="d-small">Quanto tempo podemos parar?</text>
</svg>
</div>
<figcaption>Figura 3: O RPO mede os dados que você perde, o RTO mede o tempo que você fica fora do ar</figcaption>
</figure>

Um backup noturno te dá um RPO de até 24 horas: se o banco morre às 23h, você perde o dia inteiro. Replicação contínua pode derrubar o RPO para segundos. Do outro lado, se restaurar significa provisionar a infraestrutura do zero, restaurar 2 TB e reapontar o DNS, o seu RTO é medido em horas, por mais bonito que o *runbook* esteja.

Duas coisas que o pessoal costuma esquecer:

- **O RTO inclui o tempo de detecção e de decisão.** Se leva 20 minutos para perceber a indisponibilidade e mais 30 para alguém com autoridade dizer "faz o *failover*", são 50 minutos perdidos antes de qualquer recuperação começar. Defina antes quem decide e em que condições, ou automatize a decisão.
- **A replicação também replica os erros.** Se alguém roda um `DELETE` sem `WHERE`, a replicação síncrona vai apagar fielmente as linhas na réplica também, em milissegundos. Réplicas protegem contra falha de infraestrutura; **backups** (com restauração para um ponto no tempo) protegem contra erro humano, bugs, corrupção e *ransomware*. Você precisa dos dois.

## Estratégias de Backup e Recuperação de Desastres

**Objetivo:** escolher, por *workload*, uma estratégia de recuperação que atenda o RTO e o RPO a um custo que o negócio aceite.

Existe um espectro bem conhecido de estratégias de recuperação de desastres (*disaster recovery*, ou DR). A AWS documenta isso de forma muito clara, e as mesmas ideias valem para qualquer nuvem. Quanto mais para a direita, mais rápida a recuperação e menor a perda de dados, e maior a conta.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 740 270" role="img" aria-labelledby="rel-d3-title rel-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="rel-d3-title">Estratégias de recuperação de desastres</title>
<desc id="rel-d3-desc">Quatro estratégias de recuperação de desastres da esquerda para a direita: backup e restauração, pilot light, warm standby e multi-site ativo. Indo para a direita, RTO e RPO caem e custo e complexidade sobem.</desc>
<defs><marker id="rel-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-accent"/></marker></defs>
<text x="370" y="35" text-anchor="middle" class="d-label">ESTRATÉGIAS DE RECUPERAÇÃO DE DESASTRES</text>
<rect x="20" y="60" width="160" height="125" rx="10" class="d-box"/>
<text x="100" y="92" text-anchor="middle" class="d-title">Backup e Restore</text>
<text x="100" y="120" text-anchor="middle" class="d-small">Só backups</text>
<text x="100" y="142" text-anchor="middle" class="d-small">RPO: horas</text>
<text x="100" y="164" text-anchor="middle" class="d-small">RTO: horas a dias</text>
<rect x="200" y="60" width="160" height="125" rx="10" class="d-box-info"/>
<text x="280" y="92" text-anchor="middle" class="d-title">Pilot Light</text>
<text x="280" y="120" text-anchor="middle" class="d-small">Dados vivos, sem app</text>
<text x="280" y="142" text-anchor="middle" class="d-small">RPO: minutos</text>
<text x="280" y="164" text-anchor="middle" class="d-small">RTO: dezenas de min</text>
<rect x="380" y="60" width="160" height="125" rx="10" class="d-box-accent"/>
<text x="460" y="92" text-anchor="middle" class="d-title">Warm Standby</text>
<text x="460" y="120" text-anchor="middle" class="d-small">Cópia menor rodando</text>
<text x="460" y="142" text-anchor="middle" class="d-small">RPO: segundos</text>
<text x="460" y="164" text-anchor="middle" class="d-small">RTO: minutos</text>
<rect x="560" y="60" width="160" height="125" rx="10" class="d-box-warn"/>
<text x="640" y="92" text-anchor="middle" class="d-title">Multi-Site Ativo</text>
<text x="640" y="120" text-anchor="middle" class="d-small">Cópia completa ativa</text>
<text x="640" y="142" text-anchor="middle" class="d-small">RPO: quase zero</text>
<text x="640" y="164" text-anchor="middle" class="d-small">RTO: quase zero</text>
<line x1="20" y1="215" x2="716" y2="215" class="d-line-accent" marker-end="url(#rel-d3-arrow)"/>
<text x="20" y="245" text-anchor="start" class="d-label">MAIS BARATO, MAIS LENTO</text>
<text x="720" y="245" text-anchor="end" class="d-label">MAIS CARO, MAIS RÁPIDO</text>
</svg>
</div>
<figcaption>Figura 4: O espectro de DR, onde cada passo à direita compra RTO e RPO menores com dinheiro e complexidade</figcaption>
</figure>

### 1. Backup e Restore

Você mantém backups (de preferência em outra região) e, quando o desastre acontece, provisiona a infraestrutura a partir do seu IaC e restaura os dados.

**Benefício:** a opção mais barata; você só paga pelo armazenamento. Ótima para *workloads* não críticos e como base para todas as outras estratégias.
**Cuidado com:** o RTO depende da velocidade com que você consegue reconstruir tudo. Sem IaC, "reconstruir tudo" significa sair clicando no portal sob pressão às 4 da manhã. Não recomendo.

### 2. Pilot Light

Os dados principais são replicados continuamente para a região secundária, mas a camada de computação fica desligada ou no mínimo. No desastre, você liga e escala a aplicação em volta dos dados que já estão lá.

**Benefício:** o RPO cai para minutos ou segundos graças à replicação, e o custo continua baixo porque quase nada está rodando.
**Cuidado com:** escalar do zero numa região sob pressão pode esbarrar em cotas ou limites de capacidade, justamente quando todos os outros clientes estão fazendo a mesma coisa.

### 3. Warm Standby

Uma cópia reduzida, mas totalmente funcional, do *workload* roda o tempo todo na região secundária. No desastre, você escala essa cópia e manda o tráfego para ela.

**Benefício:** recuperação em minutos e, como a cópia está sempre rodando, dá para testar continuamente se ela funciona de verdade.
**Cuidado com:** você paga por um segundo ambiente em tempo integral, e ele precisa da mesma disciplina de deploy que a produção, ou vai divergir.

### 4. Multi-Site Ativo-Ativo

As duas (ou todas as) regiões atendem tráfego de produção o tempo todo. Perder uma significa que as outras absorvem a carga dela.

**Benefício:** RTO e RPO próximos de zero, e nenhum *failover* no sentido dramático da palavra, só uma redução de capacidade.
**Cuidado com:** o custo mais alto e, principalmente, a maior complexidade (consistência de dados, tratamento de conflitos, roteamento global). Reserve para os fluxos que realmente justificam.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Relaxa, estamos cobertos. O job de backup roda toda noite e o dashboard mostra um check verdinho. Pronto!"</span>
    </div>
  </div>
</div>

Júnior, backup que nunca foi restaurado é *backup de Schrödinger*: ele está funcionando e quebrado ao mesmo tempo até você abrir a caixa, e você definitivamente não quer abrir a caixa pela primeira vez no meio de uma indisponibilidade. O check verde quer dizer que o job rodou. Não quer dizer que o arquivo está completo, que a chave de criptografia ainda existe, que a restauração cabe no seu RTO ou que alguém conhece o procedimento. Alguns hábitos de backup que valem a pena:

- **Teste restaurações com frequência**, de forma automatizada se possível, e meça quanto tempo levam. Esse número é o seu RTO real, não o que está no documento.
- **Siga a ideia do 3-2-1:** pelo menos três cópias, em dois tipos diferentes de armazenamento, com uma fora do local principal (na nuvem: outra região ou outra conta).
- **Deixe os backups imutáveis** ou guarde em uma conta separada e bem trancada. *Ransomware* adora apagar os backups primeiro, e engenheiro estressado com permissão de admin também.
- **Faça backup de mais do que dados:** configurações, segredos (com segurança), estado do IaC, registros de DNS. Restaurar um banco sem as *connection strings* e os certificados é só metade de uma recuperação.
- **Ajuste a retenção à necessidade:** restauração para um ponto no tempo para erros recentes, retenção longa para *compliance*.

## Autorrecuperação e Health Probes

**Objetivo:** deixar a plataforma detectar e corrigir falhas comuns automaticamente, mais rápido do que qualquer humano conseguiria.

Lembra da tabela dos quatro noves: 4,3 minutos por mês. O único jeito de chegar lá é deixar as máquinas cuidarem das falhas rotineiras. Autorrecuperação (*self-healing*) é o conjunto de mecanismos que detecta um problema e reage sem esperar alguém acordar.

### Health Probes

Balanceadores de carga, orquestradores e *service meshes* decidem para onde mandar o tráfego com base em *health probes*. A forma como você desenha essas verificações importa mais do que parece:

- **Liveness:** "esse processo está vivo ou travado?" Se falhar, reinicia a instância. Mantenha simples e rápido.
- **Readiness:** "essa instância pode receber tráfego agora?" Se falhar, tira da rotação sem matar (por exemplo, enquanto ela aquece um cache ou perdeu a conexão com o banco).
- **Verificação rasa vs profunda:** a rasa (*shallow*) só confirma que o processo responde. A profunda (*deep*) verifica também as dependências críticas. A profunda dá um retrato mais honesto, mas cuidado: se toda instância verifica o banco e o banco dá uma piscada, o balanceador pode tirar **todas** as instâncias de uma vez e transformar um soluço num apagão completo. Muitos times usam verificações rasas para roteamento e profundas para monitoramento e alertas.

### Mecanismos de Autorrecuperação

| Abordagem | Benefício |
| :--- | :--- |
| **Substituição automática de instâncias** (orquestradores, *scale sets*, grupos de instâncias gerenciados) | Instâncias com falha são recicladas sem intervenção humana |
| **Autoscaling com mínimos sensatos** | Absorve picos de carga e repõe capacidade perdida; mínimos distribuídos entre zonas te mantêm vivo durante a queda de uma zona |
| **Serviços gerenciados com failover embutido** (bancos, filas, armazenamento) | O provedor cuida da replicação e do *failover*, muitas vezes melhor do que você faria |
| **Degradação graciosa** | Funcionalidades não críticas desligam sob estresse para os fluxos críticos continuarem rodando |
| **Nivelamento de carga com filas** (*queue-based load leveling*) | Filas absorvem rajadas e deixam os consumidores processarem no próprio ritmo, isolando produtores de consumidores lentos |
| **Failover automatizado com critérios claros** | Tira do RTO o atraso do "quem decide?"; aprovação manual só onde o risco de um *failover* falso é alto |

A metade da autorrecuperação que fica no código (*retries* com *backoff* exponencial e *jitter*, *circuit breakers*, *bulkheads*, *timeouts*, idempotência) está em [Padrões de Resiliência](/pt-br/principles/solution/resilience-patterns/). A versão curta: toda chamada de rede pode falhar, então toda chamada de rede precisa de um *timeout* e de um plano.

E nada disso funciona se você não enxerga. Modelos de saúde, dashboards de SLI, alertas sobre a velocidade de consumo do *error budget* e *tracing* distribuído são o que te dizem se a autorrecuperação está curando ou só oscilando. Esse é o território de [Observabilidade em Primeiro Lugar](/pt-br/principles/solution/observability-first/).

## Teste a Confiabilidade

**Objetivo:** provar, com frequência e de propósito, que o *workload* sobrevive às falhas para as quais ele foi projetado.

Todo mecanismo de confiabilidade deste artigo é uma hipótese até ser testado. O *failover* que nunca foi acionado, o backup que nunca foi restaurado, o alerta que nunca disparou: todos funcionam perfeitamente no diagrama de arquitetura.

### Chaos Engineering

*Chaos engineering* (engenharia do caos) é a disciplina de **injetar falhas de propósito**, de forma controlada, para achar fraquezas antes que elas te achem. A Netflix ficou famosa com o Chaos Monkey, que derrubava instâncias de produção aleatoriamente para os engenheiros não terem outra escolha a não ser construir serviços que tolerassem isso.

O processo é científico, não inconsequente:

1. **Defina o estado estável:** como é "funcionando", em termos de SLI?
2. **Formule uma hipótese:** "se perdermos uma zona, o checkout mantém o SLO".
3. **Injete a falha:** derrube instâncias, adicione latência, bloqueie uma dependência, derrube uma zona, encha um disco.
4. **Observe:** o estado estável se manteve? O que quebrou que ninguém esperava?
5. **Corrija e repita,** aumentando aos poucos o escopo (o *blast radius*), da pré-produção até a produção.

Ferramentas gerenciadas facilitam muito hoje em dia: Azure Chaos Studio, AWS Fault Injection Service e opções *open source* como Chaos Mesh ou LitmusChaos para Kubernetes.

### Simulações de DR e Game Days

- **Simulações de DR** (*DR drills*): faça de verdade o *failover* para a região secundária (ou restaure a partir do backup num ambiente limpo) com uma periodicidade definida. Meça o RTO e o RPO reais e compare com as metas. A primeira simulação é sempre uma lição de humildade, e a ideia é essa mesma.
- **Game days:** o time se reúne, alguém injeta uma falha (às vezes sem contar para todo mundo qual é) e o time responde como num incidente real, usando os *runbooks* e dashboards reais. Você testa o sistema, os alertas, a documentação **e as pessoas**.

Toda simulação e todo *game day* devem terminar como um incidente: com uma revisão sem culpados (*blameless*), itens de ação e atualizações na FMA e nos *runbooks*.

<div class="callout warning">
  <p>Comece pequeno e seguro. Faça os primeiros experimentos em pré-produção, com um botão claro de abortar e o time acompanhando. <em>Chaos engineering</em> em produção sem observabilidade sólida e sem <em>kill switch</em> não é engenharia, é só caos.</p>
</div>

## Mantenha Simples

**Objetivo:** evitar complexidade que cria mais modos de falha do que remove.

Parece contraditório depois de tantas seções sobre redundância, mas este é um dos princípios de confiabilidade mais importantes. **Todo componente que você adiciona é um componente que pode falhar.** Cada link de replicação, cada script de *failover*, cada região extra é código novo e configuração nova que precisam ser testados e operados.

Alguns hábitos saudáveis:

- **Prefira serviços gerenciados** para o trabalho pesado que não diferencia o seu produto. O time de banco de dados do provedor já fez mais *failovers* do que o seu fará na vida.
- **Não construa multirregião ativo-ativo para uma ferramenta interna** que precisa de três noves. Ajuste a arquitetura à meta, não à palestra do evento.
- **Reduza as peças móveis nos fluxos críticos.** Se o checkout chama sete serviços de forma síncrona, são sete multiplicações no seu SLA composto. Algumas dessas chamadas podem ser assíncronas ou opcionais?
- **Deixe o failover sem graça:** um mecanismo bem entendido, automatizado e testado com frequência vale mais que três mecanismos espertos que ninguém entende direito.
- **Evolua aos poucos:** comece com redundância de zona e backups sólidos, meça e só adicione regiões quando as metas e o histórico de incidentes pedirem. O [Design Evolutivo](/pt-br/principles/solution/evolutionary-design/) vale aqui também.

Um sistema simples, com bons backups, redundância de zona e um *runbook* testado, muitas vezes é mais confiável na prática do que um design multirregião sofisticado que o time tem medo de tocar.

## Tradeoffs

A **confiabilidade** garante que o *workload* continue entregando o que prometeu, por meio de metas claras, redundância, planos de recuperação e testes contínuos. Mas confiabilidade não é de graça e não vive isolada. As decisões tomadas para melhorá-la inevitavelmente puxam os outros pilares.

Bora ver alguns exemplos na prática?

### Tradeoffs com Otimização de Custos (Cost Optimization)

Mais cópias, mais dinheiro: instâncias redundantes, zonas extras e regiões secundárias multiplicam o custo de infraestrutura, e um *warm standby* ou um ativo-ativo pode quase dobrar a conta.

Camadas de serviço mais caras: redundância de zona, georreplicação e SLAs *premium* normalmente ficam nos SKUs mais caros.

Capacidade ociosa: ativo-passivo e folga para *failover* significam pagar por recursos que ficam parados a maior parte do tempo.

Custo de testar: simulações de DR, experimentos de caos e ambientes de pré-produção parecidos com a produção consomem recursos e tempo do time.

Transferência de dados: replicação entre zonas e entre regiões gera cobrança de tráfego de rede, fácil de esquecer nas estimativas.

### Tradeoffs com Eficiência de Performance (Performance Efficiency)

Replicação síncrona adiciona latência: esperar a confirmação de uma escrita em outra zona ou região deixa toda escrita mais lenta.

*Health checks*, replicação e telemetria consomem CPU, memória e rede que o *workload* poderia usar para trabalho de verdade.

Consistência versus velocidade: consistência forte entre regiões protege os dados, mas custa latência; consistência eventual é rápida, mas abre a porta para conflitos e leituras desatualizadas.

Saltos extras: balanceadores globais, filas e gateways adicionados pela confiabilidade acrescentam, cada um, um pouquinho de tempo ao caminho da requisição.

### Tradeoffs com Excelência Operacional (Operational Excellence)

Mais complexidade para operar: deploys multirregião, replicação e automação de *failover* exigem mais pipelines, mais *runbooks* e mais conhecimento.

Deploys ficam mais difíceis: cada mudança precisa ser liberada em vários locais numa ordem segura, mantendo as versões compatíveis durante o *rollout*.

Risco de divergência: um ambiente passivo ou de *standby* que não recebe as mesmas mudanças da produção vai divergir em silêncio e falhar justamente quando você precisar dele.

Custo dos testes: *game days* e simulações são valiosos, mas exigem planejamento, tempo e coordenação, tirando foco da entrega.

### Tradeoffs com Segurança (Security)

Superfície de ataque maior: cada réplica, região e cópia de backup é mais um lugar onde os dados vivem e precisam ser protegidos, atualizados e monitorados.

Residência de dados e *compliance*: replicar para outra região pode levar dados pessoais para fora do país, o que leis como a LGPD e a GDPR podem restringir.

Acesso para recuperação: contas de emergência (*break-glass*) e *failover* automatizado precisam de permissões poderosas, que devem ser controladas e auditadas de perto.

Backups como alvo: os repositórios de backup guardam cópias completas dos seus dados e são alvos preferenciais; precisam de criptografia, isolamento e imutabilidade. Veja mais em [Segurança](/pt-br/principles/cloud/security/).

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Então se eu deixo mais confiável eu pago mais, faço deploy mais devagar e tenho mais coisa pra proteger? Por que não coloca logo cinco noves em tudo e para de se preocupar?"</span>
    </div>
  </div>
</div>

Porque cinco noves em tudo quebraria o projeto muito antes de salvá-lo, Júnior! É exatamente por isso que tudo começa pelas metas. O negócio decide quanto de confiabilidade cada fluxo vale, a arquitetura entrega exatamente isso (nem menos, nem muito mais) e os tradeoffs ficam documentados para todo mundo saber o que foi escolhido e por quê. Perfeição não existe, mas decisões conscientes sim.

## Conclusão

**Confiabilidade** não é sobre evitar falhas; é sobre **esperar por elas**. Tudo falha, o tempo todo, e um *workload* bem arquitetado é aquele em que a falha foi prevista, dimensionada e planejada.

Ela começa pelas **metas**: SLIs medidos do ponto de vista do usuário, SLOs acordados com o negócio, SLAs que deixam margem para erro e a matemática composta que mantém as promessas honestas. Continua com o **entendimento** do sistema: fluxos críticos, modos de falha e pontos únicos de falha. Depois vem o **design**: redundância no nível certo, RTO e RPO por fluxo e uma estratégia de recuperação de desastres que o negócio consiga pagar. E se sustenta com **automação e testes**: autorrecuperação para as falhas rotineiras, e experimentos de caos, simulações de DR e *game days* para provar que o resto funciona de verdade.

**Mais importante:** a confiabilidade tem preço em custo, performance, esforço operacional e segurança. O papel do arquiteto não é maximizá-la, mas encontrar o ponto em que o custo do próximo nove fica maior que o custo da indisponibilidade que ele evitaria, e fazer essa escolha de forma consciente, junto com o time e com o negócio.

## Próximos Passos

1. **Defina metas para os seus fluxos críticos**
Escolha os dois ou três fluxos que mais importam, defina SLIs centrados no usuário e combine SLOs com o negócio. Garanta que qualquer SLA seja mais folgado que o SLO.

2. **Faça a conta do SLA composto**
Desenhe a cadeia de dependências de cada fluxo crítico, anote a disponibilidade de cada componente e multiplique. Compare o resultado com o que você promete.

3. **Faça uma análise de modos de falha**
Para cada componente dos fluxos críticos, registre como ele pode falhar, o impacto, como você detectaria e como mitiga. Cace os pontos únicos de falha.

4. **Defina RTO e RPO e escolha uma estratégia de DR**
Combine as metas de recuperação por fluxo e escolha a estratégia mais barata (backup e restore, *pilot light*, *warm standby* ou *multi-site*) que as atenda.

5. **Restaure um backup este mês**
Não é "conferir se ele existe": restaure de verdade num ambiente limpo e meça quanto tempo leva. Depois agende isso para acontecer com frequência.

6. **Comece a testar de propósito**
Rode um pequeno experimento de caos em pré-produção e depois planeje um *game day*. Adote *error budgets* para equilibrar o trabalho de confiabilidade com a entrega de funcionalidades.

<div class="callout info" data-title="Referências">
  <ul>
    <li><a href="https://learn.microsoft.com/azure/well-architected/reliability/" target="_blank" rel="noopener">Azure Well-Architected Framework: Confiabilidade</a></li>
    <li><a href="https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html" target="_blank" rel="noopener">AWS Well-Architected Framework: Pilar de Confiabilidade</a></li>
    <li><a href="https://cloud.google.com/architecture/framework" target="_blank" rel="noopener">Google Cloud Architecture Framework</a></li>
    <li><a href="https://sre.google/sre-book/table-of-contents/" target="_blank" rel="noopener">Site Reliability Engineering (livro de SRE do Google)</a></li>
    <li><a href="https://sre.google/workbook/table-of-contents/" target="_blank" rel="noopener">The Site Reliability Workbook</a></li>
    <li><a href="https://principlesofchaos.org/" target="_blank" rel="noopener">Principles of Chaos Engineering</a></li>
  </ul>
</div>
