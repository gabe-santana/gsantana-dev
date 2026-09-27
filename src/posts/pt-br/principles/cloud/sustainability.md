---
title: Sustentabilidade
short: O servidor mais verde é aquele que você nunca precisou ligar. Afinal, pra que gastar energia com um trabalho que ninguém pediu?
category: cloud
---

## Introdução

Por muito tempo, sustentabilidade parecia assunto do time de facilities, do relatório anual de ESG ou daquele slide do marketing com uma folhinha verde. Arquiteto tinha problema "de verdade" pra resolver: latência, disponibilidade, segurança, a fatura. Pois é, a nuvem mudou isso. Quando o seu data center está a uma chamada de API de distância, toda decisão de arquitetura também é uma decisão de energia, e energia (junto com o hardware que a consome) tem pegada de carbono.

Não é à toa que a AWS incluiu a **Sustentabilidade** como o sexto pilar do seu Well-Architected Framework, a Microsoft publicou orientações para *workloads* sustentáveis no Azure Well-Architected Framework e o Google Cloud tem um pilar de sustentabilidade no seu Architecture Framework. Do lado da comunidade, a **Green Software Foundation** (GSF) vem transformando o tema em prática de engenharia, com princípios, padrões e até uma especificação para medir a intensidade de carbono de software.

A **meta** deste princípio é fácil de dizer e difícil de praticar: **entregar o mesmo valor de negócio usando menos recursos, menos energia e energia mais limpa**. Não se trata de piorar o produto para salvar o planeta. Trata-se de eliminar o desperdício que ninguém sentiria falta.

Quando um time ignora esse princípio, os sintomas são surpreendentemente familiares:

- Máquinas virtuais rodando com uso de CPU de um dígito, 24 horas por dia, 7 dias por semana;
- Ambientes de desenvolvimento e teste que ninguém desliga à noite nem no fim de semana;
- Dados guardados para sempre no tier de armazenamento mais quente (e mais gastador) "vai que precisa";
- Jobs batch agendados no horário que o dev por acaso digitou na expressão do cron;
- Modelos de IA gigantes respondendo perguntas que um modelo bem menor resolveria tranquilamente;
- Nenhuma ideia de quanto carbono o *workload* emite e, portanto, nenhuma forma de melhorar;

Pois é, *é raro, mas acontece bastante*... Quem nunca encontrou um cluster esquecido, zumbindo quietinho em alguma subscription, gastando energia por um projeto que acabou há meses?

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Mas a nuvem é o data center dos outros! Se polui, o problema não é do provedor? Eu só escrevo código."</span>
    </div>
  </div>
</div>

Calma aí, Júnior! É exatamente esse mal-entendido que este princípio tenta corrigir. O provedor é responsável por muita coisa, mas não por tudo. Bora ver como essa responsabilidade é dividida.

## Responsabilidade Compartilhada pela Sustentabilidade

Você provavelmente conhece o modelo de responsabilidade compartilhada da segurança: o provedor protege a infraestrutura física e você protege o que constrói em cima dela. A AWS aplica a mesma ideia à sustentabilidade, e ela funciona muito bem como modelo mental para qualquer nuvem:

- **Sustentabilidade DA nuvem** é do provedor: eficiência do data center, refrigeração, origem da energia, cadeia de suprimentos do hardware, utilização dos servidores da frota e o destino dos equipamentos no fim da vida útil.
- **Sustentabilidade NA nuvem** é sua: em qual região você faz o deploy, quão bem você usa o que provisiona, quão eficiente é o seu código, quantos dados você guarda e por quanto tempo, e quais padrões de arquitetura você escolhe.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="sus-d1-title sus-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="sus-d1-title">Responsabilidade compartilhada pela sustentabilidade</title>
<desc id="sus-d1-desc">O cliente é dono da sustentabilidade na nuvem: escolha de região, utilização, código eficiente e ciclo de vida dos dados. O provedor é dono da sustentabilidade da nuvem: data centers, refrigeração, origem da energia e ciclo de vida do hardware.</desc>
<text x="360" y="28" text-anchor="middle" class="d-label">RESPONSABILIDADE COMPARTILHADA</text>
<rect x="40" y="46" width="640" height="116" rx="10" class="d-box-accent"/>
<text x="360" y="74" text-anchor="middle" class="d-title">Você: sustentabilidade NA nuvem</text>
<rect x="60" y="92" width="140" height="52" rx="10" class="d-box"/>
<text x="130" y="123" text-anchor="middle" class="d-text">Região</text>
<rect x="215" y="92" width="140" height="52" rx="10" class="d-box"/>
<text x="285" y="123" text-anchor="middle" class="d-text">Utilização</text>
<rect x="370" y="92" width="140" height="52" rx="10" class="d-box"/>
<text x="440" y="123" text-anchor="middle" class="d-text">Código eficiente</text>
<rect x="525" y="92" width="140" height="52" rx="10" class="d-box"/>
<text x="595" y="123" text-anchor="middle" class="d-text">Ciclo dos dados</text>
<line x1="40" y1="178" x2="680" y2="178" class="d-line-dashed"/>
<rect x="40" y="194" width="640" height="90" rx="10" class="d-box-info"/>
<text x="360" y="222" text-anchor="middle" class="d-title">Provedor: sustentabilidade DA nuvem</text>
<text x="360" y="246" text-anchor="middle" class="d-small">data centers, refrigeração, origem da energia,</text>
<text x="360" y="266" text-anchor="middle" class="d-small">cadeia de suprimentos e descarte do hardware</text>
</svg>
</div>
<figcaption>Figura 1: O provedor opera um data center eficiente; o que você roda lá dentro é com você</figcaption>
</figure>

O provedor pode ter o data center mais eficiente do planeta, mas se você deixar cem máquinas ociosas rodando lá dentro, elas continuam consumindo energia e ocupando hardware que precisou ser fabricado. **A eficiência do prédio não anula o desperdício do inquilino.**

<div class="callout info">
  <p>Sustentabilidade na nuvem é uma <strong>responsabilidade de arquitetura</strong>, assim como custo e segurança. Não é algo que você terceiriza para a página de marketing do provedor.</p>
</div>

## Os Pilares do Software Verde

A Green Software Foundation organiza o tema em algumas ideias centrais. Vale a pena conhecê-las pelo nome, porque cada prática que aparece mais adiante neste artigo é uma aplicação de uma delas.

### Eficiência de carbono

Emitir a menor quantidade possível de carbono **por unidade de trabalho útil**. Esse é o objetivo guarda-chuva; todo o resto é caminho para chegar lá. Repare no "por unidade de trabalho": um sistema que atende dez vezes mais usuários emitindo o dobro ficou *mais* eficiente em carbono, mesmo que a pegada total tenha crescido.

### Eficiência energética

Usar a menor quantidade possível de energia para fazer o trabalho. A energia é o principal indicador do carbono operacional: menos energia consumida significa menos carbono emitido, seja qual for a matriz da rede elétrica. Aqui tem um detalhe sutil chamado **proporcionalidade energética** (*energy proportionality*): servidores não consomem energia na proporção da carga. Um servidor ocioso ou com pouca carga ainda puxa uma parte relevante da sua potência máxima só por estar ligado. Por isso, poucas máquinas bem utilizadas ganham de muitas máquinas paradas.

### Eficiência de hardware (carbono incorporado)

Todo servidor, disco, switch de rede e celular emitiu carbono para ser fabricado, transportado e, um dia, descartado. Esse é o **carbono incorporado** (*embodied carbon*), e ele já foi "gasto" antes da primeira requisição chegar. A conclusão prática: use o mínimo de hardware possível e extraia o máximo do hardware que já existe. Utilização mais alta dilui o carbono incorporado em mais trabalho útil, e prolongar a vida útil dos equipamentos evita fabricar novos.

### Consciência de carbono

O mesmo quilowatt-hora não tem o mesmo carbono em todo lugar, nem em toda hora. A intensidade de carbono da eletricidade depende da mistura de fontes que alimenta a rede (solar, eólica, hidrelétrica, gás, carvão...), e essa mistura muda conforme o local e o horário. Consciência de carbono (*carbon awareness*) significa **fazer mais quando e onde a energia é mais limpa, e menos quando e onde ela é mais suja**. Isso acontece de duas formas:

- **Deslocamento de demanda** (*demand shifting*): mover trabalho flexível no tempo (rodar mais tarde) ou no espaço (rodar em outra região) para onde a rede está mais limpa;
- **Modelagem de demanda** (*demand shaping*): mudar a quantidade de trabalho de acordo com a energia disponível, por exemplo reduzindo a qualidade do vídeo ou pausando funcionalidades não essenciais quando a intensidade está alta, do mesmo jeito que o modo economia do celular troca recursos por bateria.

### Medição

O que não é medido não pode ser melhorado. Esse ponto é tão importante que merece uma seção só dele.

## Meça Antes de Otimizar

Quem nunca viu um time discutir por semanas sobre reescrever um serviço numa "linguagem mais rápida" para economizar energia, quando o desperdício de verdade era um ambiente esquecido que custava mais do que o serviço inteiro? Medir primeiro mantém o esforço onde as emissões realmente estão.

### SCI: Software Carbon Intensity

A Green Software Foundation criou a especificação **Software Carbon Intensity (SCI)**, que depois foi publicada como a norma ISO/IEC 21031:2024. Em vez de gerar um total único, ela entrega uma **taxa**: carbono emitido por unidade de algo que faz sentido para o seu negócio.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 245" role="img" aria-labelledby="sus-d2-title sus-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="sus-d2-title">A fórmula da Software Carbon Intensity</title>
<desc id="sus-d2-desc">SCI é igual à energia consumida vezes a intensidade de carbono da rede, mais o carbono incorporado, dividido por uma unidade funcional, como usuário, requisição ou job.</desc>
<text x="360" y="28" text-anchor="middle" class="d-label">SOFTWARE CARBON INTENSITY (SCI)</text>
<text x="180" y="58" text-anchor="middle" class="d-label">OPERACIONAL</text>
<text x="435" y="58" text-anchor="middle" class="d-label">INCORPORADO</text>
<text x="615" y="58" text-anchor="middle" class="d-label">UNIDADE FUNCIONAL</text>
<rect x="30" y="70" width="130" height="90" rx="10" class="d-box-info"/>
<text x="95" y="100" text-anchor="middle" class="d-title">E</text>
<text x="95" y="122" text-anchor="middle" class="d-small">energia usada</text>
<text x="95" y="142" text-anchor="middle" class="d-small">kWh</text>
<text x="180" y="121" text-anchor="middle" class="d-title">×</text>
<rect x="200" y="70" width="130" height="90" rx="10" class="d-box-info"/>
<text x="265" y="100" text-anchor="middle" class="d-title">I</text>
<text x="265" y="122" text-anchor="middle" class="d-small">intensidade</text>
<text x="265" y="142" text-anchor="middle" class="d-small">gCO2e por kWh</text>
<text x="350" y="121" text-anchor="middle" class="d-title">+</text>
<rect x="370" y="70" width="130" height="90" rx="10" class="d-box-warn"/>
<text x="435" y="100" text-anchor="middle" class="d-title">M</text>
<text x="435" y="122" text-anchor="middle" class="d-small">carbono</text>
<text x="435" y="142" text-anchor="middle" class="d-small">do hardware</text>
<text x="525" y="120" text-anchor="middle" class="d-text">por</text>
<rect x="550" y="70" width="130" height="90" rx="10" class="d-box-accent"/>
<text x="615" y="100" text-anchor="middle" class="d-title">R</text>
<text x="615" y="122" text-anchor="middle" class="d-small">por unidade</text>
<text x="615" y="142" text-anchor="middle" class="d-small">usuário, req., job</text>
<text x="360" y="198" text-anchor="middle" class="d-text">SCI = ((E × I) + M) por R</text>
<text x="360" y="224" text-anchor="middle" class="d-small">Uma taxa, não um total: reduza com menos energia, energia limpa ou menos hardware</text>
</svg>
</div>
<figcaption>Figura 2: A SCI transforma carbono numa taxa acompanhável, como latência ou custo por transação</figcaption>
</figure>

- **E** é a energia consumida pelo software;
- **I** é a intensidade de carbono da eletricidade onde e quando ele rodou (baseada na localização, em gramas de CO2 equivalente por kWh);
- **M** é a parcela das emissões incorporadas do hardware atribuível ao software;
- **R** é a unidade funcional: por usuário, por chamada de API, por transação, por treinamento, por relatório gerado.

O legal é que a própria fórmula mostra as três alavancas que você tem: **usar menos energia (E), usar energia mais limpa (I) ou usar menos hardware (M)**. E, por ser uma taxa, ela premia a eficiência em vez de punir o crescimento.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Pra que tanta conta? O provedor diz que compensa 100% da energia com renováveis, e a gente sempre pode comprar crédito de carbono. Problema resolvido, né?"</span>
    </div>
  </div>
</div>

Não tão rápido, Júnior! Os contratos de compra de energia renovável e os certificados são um esforço real e valioso dos provedores, mas funcionam como instrumento contábil ao longo de um ano inteiro e de uma frota inteira. Em qualquer hora do dia, a máquina que roda o seu código continua ligada numa rede física, com uma mistura física de fontes. É por isso que a SCI usa a intensidade baseada na localização e **proíbe explicitamente reduzir a pontuação com créditos de carbono ou instrumentos de mercado**: a única forma de melhorar é emitir menos de verdade. Créditos de carbono podem até ter lugar na estratégia climática da empresa, mas não são decisão de arquitetura. Reduzir desperdício é.

### Painéis de carbono dos provedores

Você não precisa começar do zero. Os três grandes provedores oferecem relatórios de carbono da sua conta:

| Ferramenta | O que ela entrega |
| :--- | :--- |
| **Azure: Emissions Impact Dashboard** (e as visões de otimização de carbono no portal) | Emissões estimadas do seu uso do Azure, por serviço e região, boas para relatórios e acompanhamento de tendência. |
| **AWS: Customer Carbon Footprint Tool** | Emissões estimadas do seu uso da AWS por serviço e região, disponíveis no console de billing, com histórico para acompanhar a evolução. |
| **Google Cloud: Carbon Footprint** | Emissões estimadas por projeto, serviço e região, com exportação para o BigQuery para suas próprias análises. |

Algumas ressalvas honestas: esses relatórios costumam ter atraso de semanas ou meses, usam a metodologia de cada provedor (então comparar nuvens diferentes é complicado) e servem melhor para **tendência e reporte** do que para decisões em tempo real. No dia a dia da engenharia, combine esses relatórios com os indicadores que você já tem: utilização de CPU e memória, horas ociosas, volume armazenado, dados trafegados e, claro, a fatura. Para agendamento consciente de carbono, você vai precisar de dados de intensidade da rede por região e por hora, que o **Carbon Aware SDK**, projeto open source da GSF, consegue buscar em provedores de dados terceiros.

<div class="callout tip">
  <p>Comece por um <strong>indicador que você já mede</strong>. Se você acompanha utilização e recursos ociosos por causa de FinOps, já está acompanhando boa parte do seu desperdício de energia. Contabilidade de carbono perfeita não é pré-requisito para cortar desperdício óbvio.</p>
</div>

## Princípios de Design para Sustentabilidade

Com os pilares e a medição definidos, bora para a prática. Os princípios a seguir reúnem o pilar de Sustentabilidade da AWS, as orientações do Azure para *workloads* sustentáveis e os padrões da Green Software Foundation.

### 1. Escolha as regiões com critério

**Meta:** Rodar os *workloads* onde a energia é mais limpa, desde que os requisitos de negócio permitam.

As regiões variam na intensidade de carbono da rede elétrica local e na quantidade de energia renovável ou livre de carbono que o provedor tem ali. O Google, por exemplo, publica informações de energia livre de carbono por região, e o console dele destaca as regiões de menor carbono. Latência, leis de residência de dados (como LGPD ou GDPR), disponibilidade de serviços e custo continuam vindo primeiro, mas quando duas regiões atendem aos requisitos, carbono é um critério de desempate legítimo.

| Abordagem | Benefício |
| :--- | :--- |
| **Inclua a intensidade de carbono nos critérios de escolha de região**, ao lado de latência, compliance e custo. | Coloca o *workload* inteiro numa base mais limpa com uma única decisão. |
| **Coloque o trabalho flexível (batch, treinamento, analytics) em regiões mais limpas**, mesmo que o tráfego interativo fique perto dos usuários. | Captura a maior parte do benefício sem prejudicar a experiência do usuário. |
| **Mantenha os dados perto da computação.** | Evita mover grandes volumes entre regiões, o que custa energia e dinheiro. |

### 2. Maximize a utilização e faça o right sizing

**Meta:** Extrair mais trabalho útil de cada máquina provisionada.

É aqui que sustentabilidade e custo apertam as mãos. Por causa da proporcionalidade energética e do carbono incorporado, uma frota superdimensionada rodando com baixa utilização desperdiça duas vezes: gasta energia fazendo pouco e prende hardware que teve custo de carbono para ser fabricado.

| Abordagem | Benefício |
| :--- | :--- |
| **Faça *right sizing* contínuo** com base em métricas reais de utilização, não na estimativa "por via das dúvidas" do dia do lançamento. | Menos máquinas, mais cheias, fazendo o mesmo trabalho. |
| **Escale conforme a demanda com *autoscaling***, incluindo *scale-in* e *scale to zero* onde a plataforma permitir. | A capacidade acompanha a curva de carga em vez de ficar no pico o dia inteiro. |
| **Desligue ambientes não produtivos** fora do horário de trabalho e crie ambientes sob demanda. | Elimina uma parcela enorme de horas ociosas com um simples agendamento. |
| **Prefira plataformas de maior densidade**: *containers*, *serverless* e serviços gerenciados onde fizer sentido. | O provedor acomoda muitos clientes em hardware compartilhado, elevando a utilização muito além do que um único time costuma alcançar. |
| **Use as famílias de instância mais recentes e eficientes**, incluindo processadores ARM quando a sua stack suportar. | Gerações mais novas em geral entregam mais desempenho por watt. Valide com seus próprios benchmarks. |

### 3. Desloque e modele a demanda

**Meta:** Fazer o trabalho flexível quando e onde a rede está mais limpa, e reduzir o trabalho opcional quando não está.

Nem tudo precisa rodar *agora*. Relatórios noturnos, pipelines de dados, treinamento de modelos, transcodificação de vídeo, backups e reconstrução de índices geralmente têm um prazo, não um minuto específico. Essa flexibilidade é uma oportunidade.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="sus-d3-title sus-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="sus-d3-title">Deslocando um job batch para uma janela mais limpa</title>
<desc id="sus-d3-desc">Uma linha mostra a intensidade de carbono da rede variando ao longo do dia. Um job batch originalmente agendado no pico da noite é movido para uma janela no meio do dia, com intensidade menor, usando a mesma energia com menos emissões.</desc>
<defs><marker id="sus-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-accent"/></marker></defs>
<text x="360" y="28" text-anchor="middle" class="d-label">INTENSIDADE DE CARBONO DA REDE AO LONGO DO DIA</text>
<text x="66" y="54" text-anchor="start" class="d-small">gCO2e por kWh</text>
<rect x="340" y="62" width="150" height="168" rx="10" class="d-box-muted"/>
<text x="415" y="82" text-anchor="middle" class="d-label">JANELA MAIS LIMPA</text>
<line x1="60" y1="60" x2="60" y2="230" class="d-line"/>
<line x1="60" y1="230" x2="680" y2="230" class="d-line"/>
<polyline points="60,120 140,100 220,95 300,150 370,190 440,195 500,160 560,95 620,82 680,110" fill="none" class="d-line-accent"/>
<rect x="570" y="140" width="100" height="46" rx="10" class="d-box-danger"/>
<text x="620" y="160" text-anchor="middle" class="d-text">Job batch</text>
<text x="620" y="178" text-anchor="middle" class="d-small">horário de pico</text>
<rect x="365" y="96" width="100" height="46" rx="10" class="d-box-accent"/>
<text x="415" y="116" text-anchor="middle" class="d-text">Job batch</text>
<text x="415" y="134" text-anchor="middle" class="d-small">deslocado</text>
<line x1="568" y1="160" x2="470" y2="124" class="d-line-dashed" marker-end="url(#sus-d3-arrow)"/>
<text x="60" y="250" text-anchor="middle" class="d-small">00:00</text>
<text x="215" y="250" text-anchor="middle" class="d-small">06:00</text>
<text x="370" y="250" text-anchor="middle" class="d-small">12:00</text>
<text x="525" y="250" text-anchor="middle" class="d-small">18:00</text>
<text x="680" y="250" text-anchor="middle" class="d-small">24:00</text>
<text x="360" y="282" text-anchor="middle" class="d-small">Mesmo job, mesma energia, menos emissões: só o horário mudou</text>
</svg>
</div>
<figcaption>Figura 3: Deslocamento de demanda no tempo (curva ilustrativa; o formato real depende de cada rede)</figcaption>
</figure>

| Abordagem | Benefício |
| :--- | :--- |
| **Separe o trabalho urgente do trabalho flexível** no design, com filas e prazos em vez de horários fixos. | Cria a liberdade de escolher *quando* as coisas rodam. |
| **Agende jobs flexíveis usando previsões de intensidade da rede** (deslocamento no tempo) ou rode-os numa região mais limpa (deslocamento no espaço). | Mesmo trabalho, mesma energia, menos emissões. |
| **Modele a demanda**: degrade com elegância quando a intensidade estiver alta, por exemplo com resolução padrão de vídeo menor, menos atualizações em segundo plano ou funcionalidades não essenciais adiadas. | Mantém a experiência principal enquanto corta o consumo opcional. |
| **Achate os picos com filas e nivelamento de carga** (*load leveling*). | Carga mais suave significa menos capacidade provisionada só para o pico. |

<div class="callout warning">
  <p>Deslocar só ajuda se o trabalho for realmente flexível. Mover um job para "a hora mais limpa" e depois estourar um prazo de negócio não é vitória verde, é incidente. Coloque o prazo no agendador, não na memória de alguém.</p>
</div>

### 4. Gerencie o ciclo de vida dos dados

**Meta:** Guardar só o que você precisa, no tier certo, pelo tempo necessário.

Dado parece de graça porque é invisível. Não é. Cada cópia vive em discos que consomem energia e foram fabricados com carbono incorporado, e armazenamento quente com alta redundância consome mais do que os tiers frios de arquivamento. Quem nunca encontrou terabytes de logs de debug de um serviço que foi desativado há dois anos?

| Abordagem | Benefício |
| :--- | :--- |
| **Classifique os dados e defina políticas de retenção** desde o primeiro dia. | Os dados param de se acumular por padrão. |
| **Use regras de ciclo de vida para mover dados entre tiers** (*hot*, *cool*, *archive*) e para apagá-los quando a retenção acabar. | Armazenamento menos intensivo em energia para dados raramente lidos, de forma automática. |
| **Evite cópias desnecessárias e replicação excessiva**: ajuste a redundância à criticidade real do dado. | Menos discos girando para a mesma informação. |
| **Comprima e use formatos eficientes** (por exemplo, formatos colunares para analytics). | Menos armazenamento, menos dados trafegados, menos computação para ler. |
| **Reduza a transferência de dados**: cache, CDN e enviar só os campos que o cliente precisa. | Equipamentos de rede também consomem energia, assim como os dispositivos do outro lado. |

### 5. Escreva software eficiente

**Meta:** Fazer o mesmo trabalho com menos ciclos de CPU, menos memória e menos idas e vindas pela rede.

É aqui que os desenvolvedores têm influência direta. Código eficiente não é micro-otimização em todo canto; é não fazer trabalho que não precisa ser feito.

- **Evite trabalho desnecessário**: consultas N+1, *polling* onde eventos resolveriam, recalcular resultados que poderiam estar em cache, serializar payloads enormes que ninguém lê;
- **Escolha algoritmos e estruturas de dados adequados** para os caminhos críticos, guiado por *profiling* e não por palpite;
- **Otimize o front-end**: bundles menores, imagens otimizadas, *lazy loading*. Uma página pesada gasta energia em toda visita, em todo dispositivo, para sempre;
- **Use designs assíncronos e orientados a eventos** para que recursos não fiquem presos esperando;
- **Remova funcionalidades mortas**: caminhos de código, jobs agendados e integrações que ninguém usa continuam consumindo recursos.

<div class="callout info">
  <p>Não reescreva tudo numa "linguagem mais rápida" por causa de um benchmark que você viu na internet. Faça <em>profiling</em> primeiro. Os maiores ganhos quase sempre vêm de <strong>não fazer o trabalho</strong>: um cluster ocioso desligado economiza mais do que qualquer loop esperto.</p>
</div>

### 6. Seja criterioso com workloads de IA e LLM

**Meta:** Usar o menor modelo, o mínimo de hardware e a menor quantidade de tokens que atendam ao nível de qualidade exigido.

*Workloads* de IA merecem um princípio próprio, porque concentram tudo o que discutimos até aqui: aceleradores famintos por energia e com carbono incorporado relevante, jobs de treinamento longos e tráfego de inferência que cresce a cada novo usuário.

Deixa eu contar uma história que já vi em mais de uma versão. Um time consegue aprovar um cluster de GPUs para uma prova de conceito. O experimento roda por algumas semanas, os resultados viram uma apresentação, todo mundo fica feliz e o projeto segue para a próxima fase... com outra arquitetura. E o cluster? Continua lá, totalmente provisionado, com utilização perto de zero, por meses. Ninguém é mais dono dele, ninguém lembra por que ele existe e ninguém quer ser a pessoa que apaga "vai que alguém precisa". Aceleradores estão entre os recursos mais caros e gastadores de energia da nuvem, então esse único cluster esquecido pode facilmente pesar mais do que todas as outras otimizações que o time já fez. O financeiro acabou percebendo, claro, porque **desperdício de custo e de carbono costuma aparecer no mesmo lugar**.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Mas o maior modelo é sempre o mais inteligente! Por que eu não usaria ele pra tudo, inclusive pra classificar chamado de suporte?"</span>
    </div>
  </div>
</div>

Calma aí, Júnior! O maior modelo é o mais *capaz*, não necessariamente o mais *adequado*. Classificar um chamado em cinco categorias não precisa do mesmo modelo que escreve uma análise jurídica. Um modelo maior em geral precisa de mais computação por token, mais memória e muitas vezes mais aceleradores para ser servido. Se um modelo menor atinge o seu nível de qualidade nas suas avaliações, o maior só está queimando energia para te dar a mesma resposta.

| Abordagem | Benefício |
| :--- | :--- |
| **Escolha o menor modelo que passa nas suas avaliações** e roteie por tarefa: modelos pequenos para tarefas simples, grandes só onde forem necessários. | Menos computação por requisição na maior parte do tráfego. |
| **Use modelos destilados, com *fine-tuning* ou quantizados** quando a qualidade permitir. | Menos memória, menos aceleradores, inferência mais rápida. |
| **Agrupe requisições de inferência em lotes** (*batching*) e use APIs de batch para trabalho que não é interativo. | Utilização maior dos aceleradores; os provedores muitas vezes cobram menos pelo processamento em batch, inclusive. |
| **Faça cache de respostas e de prompts** (incluindo o *prompt caching* dos provedores) e evite gerar de novo respostas idênticas. | Trabalho feito uma vez e reaproveitado muitas vezes. |
| **Mantenha prompts e saídas enxutos**: corte contexto, limite o tamanho da resposta, recupere só os documentos relevantes. | Token é computação; menos tokens, menos energia. |
| **Prefira *fine-tuning* ou recuperação (RAG) a treinar do zero**, e agende treinamentos em regiões e janelas mais limpas. | Evita a etapa mais intensiva em energia quando ela não é necessária e deixa mais limpa a parte inevitável. |
| **Dê a todo acelerador um dono e uma data de validade**, com alertas de baixa utilização e *scale to zero* automático. | A história do cluster de GPUs ocioso nunca mais se repete. |

### 7. Prolongue a vida do hardware e pense no usuário final

**Meta:** Reduzir o carbono incorporado que o seu sistema exige, dos dois lados do fio.

Carbono incorporado não está só no data center. Se o seu web app é tão pesado que só roda bem nos celulares do ano passado, você está empurrando os usuários para hardware novo. Se as suas ferramentas internas exigem notebooks topo de linha, vale o mesmo raciocínio.

- Dê suporte a dispositivos e navegadores mais antigos quando for razoável, e mantenha o cliente leve;
- Prefira serviços gerenciados e compartilhados a hardware dedicado que você vai subutilizar;
- Em ambientes on-premises ou híbridos, estenda os ciclos de renovação quando o equipamento ainda atender aos requisitos, e consolide antes de comprar mais.

## Sustentabilidade e Custo: Quase Sempre Amigos, Mas Não Gêmeos

Se você leu o princípio de [Otimização de Custos](/pt-br/principles/cloud/cost-optimization/), muitas das práticas acima devem ter soado familiares: *right sizing*, desligar recursos ociosos, políticas de ciclo de vida, *autoscaling*. Não é coincidência. Na nuvem, você paga por recursos, e recursos consomem energia e hardware. **Na maioria das vezes, cortar desperdício reduz a fatura e as emissões ao mesmo tempo.**

Na maioria das vezes. Não sempre.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 375" role="img" aria-labelledby="sus-d4-title sus-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="sus-d4-title">Matriz de sustentabilidade e custo</title>
<desc id="sus-d4-desc">Uma matriz dois por dois. Menor custo e menor carbono: desligar ociosos, right sizing, apagar dados que ninguém lê. Menor carbono com custo maior: regiões mais limpas e mais caras, esforço de engenharia consciente de carbono. Menor custo sem menor carbono: regiões baratas com rede mais suja, capacidade paga parada. Custo e carbono maiores: sistemas superdimensionados sempre ligados, redundância desnecessária, logs eternos.</desc>
<text x="360" y="28" text-anchor="middle" class="d-label">SUSTENTABILIDADE E CUSTO: QUASE SEMPRE AMIGOS</text>
<rect x="120" y="50" width="275" height="135" rx="10" class="d-box-info"/>
<text x="257" y="80" text-anchor="middle" class="d-title">Mais verde, mais caro</text>
<text x="257" y="108" text-anchor="middle" class="d-small">Região limpa custa mais</text>
<text x="257" y="128" text-anchor="middle" class="d-small">Agendamento por carbono</text>
<text x="257" y="148" text-anchor="middle" class="d-small">Tempo de engenharia p/ medir</text>
<rect x="405" y="50" width="275" height="135" rx="10" class="d-box-accent"/>
<text x="542" y="80" text-anchor="middle" class="d-title">Todos ganham</text>
<text x="542" y="108" text-anchor="middle" class="d-small">Desligar recursos ociosos</text>
<text x="542" y="128" text-anchor="middle" class="d-small">Right sizing e consolidação</text>
<text x="542" y="148" text-anchor="middle" class="d-small">Apagar dados que ninguém lê</text>
<rect x="120" y="195" width="275" height="135" rx="10" class="d-box-danger"/>
<text x="257" y="225" text-anchor="middle" class="d-title">Evite</text>
<text x="257" y="253" text-anchor="middle" class="d-small">Superdimensionado e sempre on</text>
<text x="257" y="273" text-anchor="middle" class="d-small">Redundância sem necessidade</text>
<text x="257" y="293" text-anchor="middle" class="d-small">Logs guardados para sempre</text>
<rect x="405" y="195" width="275" height="135" rx="10" class="d-box-warn"/>
<text x="542" y="225" text-anchor="middle" class="d-title">Mais barato, não verde</text>
<text x="542" y="253" text-anchor="middle" class="d-small">Região barata, rede mais suja</text>
<text x="542" y="273" text-anchor="middle" class="d-small">Capacidade paga e parada</text>
<text x="60" y="110" text-anchor="middle" class="d-label">MENOS</text>
<text x="60" y="126" text-anchor="middle" class="d-label">CARBONO</text>
<text x="60" y="255" text-anchor="middle" class="d-label">MAIS</text>
<text x="60" y="271" text-anchor="middle" class="d-label">CARBONO</text>
<text x="257" y="355" text-anchor="middle" class="d-label">CUSTO MAIOR</text>
<text x="542" y="355" text-anchor="middle" class="d-label">CUSTO MENOR</text>
</svg>
</div>
<figcaption>Figura 4: A maior parte da redução de desperdício cai em "Todos ganham", mas fique de olho nos outros quadrantes</figcaption>
</figure>

Algumas situações em que os dois se separam:

- **A região mais barata nem sempre é a mais limpa.** Mover um *workload* para economizar alguns por cento em computação pode colocá-lo numa rede que emite consideravelmente mais por kWh.
- **"Já está pago."** Reservas e *savings plans* são ótimos para o custo, mas criam um incentivo torto: se a capacidade já foi paga, ninguém se preocupa em desligá-la. Financeiramente é custo afundado; para o planeta, uma máquina ociosa continua puxando energia. Ajustar o tamanho do compromisso no próximo ciclo faz diferença.
- **Engenharia consciente de carbono tem preço.** Medir, construir agendadores que seguem a intensidade da rede e rodar jobs numa região mais limpa, porém mais cara, custam dinheiro e tempo de engenharia.
- **Créditos de carbono custam dinheiro e não reduzem nada na arquitetura.** Podem fazer parte da estratégia corporativa, mas não mudam a SCI do sistema.

<div class="callout tip" data-title="Uma regra prática">
  <p>Comece pelo quadrante "Todos ganham": ele se paga sozinho e ninguém discute. Depois decida, de forma explícita e junto com o negócio, quanto vocês estão dispostos a investir no quadrante "Mais verde, mais caro". Só não finja que as decisões do quadrante "Mais barato, não verde" são verdes.</p>
</div>

## Tradeoffs

A **sustentabilidade** empurra o *workload* para fazer mais com menos: menos recursos, utilização mais alta, menos dados, energia mais limpa. É uma pressão saudável, mas, como todo pilar, em algum momento ela puxa contra os outros. Bora ver alguns exemplos na prática?

### Tradeoffs com Confiabilidade (Reliability)

Redundância é a melhor amiga do pilar de confiabilidade, e redundância significa recursos que existem "por via das dúvidas". Um setup ativo-passivo multirregião mantém um ambiente inteiro de reserva consumindo energia e hardware enquanto espera um desastre que talvez nunca aconteça.

Utilização mais alta deixa menos folga. Uma frota rodando com alta utilização é eficiente, mas um pico de tráfego ou um nó que cai encontra menos capacidade sobrando para absorver o impacto.

*Scale-in* agressivo e *scale to zero* introduzem *cold starts* e atrasos de escalonamento, que podem prejudicar a disponibilidade em picos repentinos.

Retenção mais curta e menos cópias de dados reduzem o armazenamento, mas também reduzem as opções de recuperação e de análise forense.

**Como equilibrar:** ajuste a redundância à criticidade real de cada componente (nem todo serviço precisa ser multirregião), prefira designs ativo-ativo em que a capacidade de reserva faz trabalho útil e use as metas de [Confiabilidade](/pt-br/principles/cloud/reliability/) (SLOs, RTO, RPO) para justificar cada recurso sobressalente, em vez de adicioná-los por reflexo.

### Tradeoffs com Eficiência de Performance (Performance Efficiency)

O agendamento consciente de carbono atrasa o trabalho de propósito. Se um relatório precisa ficar pronto em minutos, esperar por uma janela mais limpa não é opção.

Rodar numa região mais limpa, porém mais distante, adiciona latência para os usuários interativos.

Modelos de IA menores são mais eficientes, mas podem entregar menos qualidade em tarefas complexas, e a modelagem de demanda (vídeo com qualidade menor, menos atualizações) é literalmente uma redução na experiência.

Por outro lado, [Eficiência de Performance](/pt-br/principles/cloud/performance-efficiency/) e sustentabilidade concordam mais do que brigam: código eficiente, cache e menos dados trafegados deixam os sistemas mais rápidos e mais verdes ao mesmo tempo.

### Tradeoffs com Otimização de Custos (Cost Optimization)

Como vimos acima, os dois costumam andar juntos, mas regiões mais limpas podem ser mais caras, medição e ferramentas conscientes de carbono consomem tempo de engenharia, e renovar hardware antes da hora em busca de eficiência soma carbono incorporado e investimento ao mesmo tempo.

### Tradeoffs com Segurança (Security)

Controles de segurança consomem recursos: criptografia, logs de auditoria detalhados, retenção estendida por compliance, varreduras e ambientes duplicados para isolamento, tudo isso soma energia e armazenamento. Você não corta esses controles para economizar carbono; você os dimensiona corretamente, retém o que a regulação exige (e não "para sempre por padrão") e aplica tiers aos logs de segurança como a qualquer outro dado.

Compartilhar infraestrutura aumenta a utilização, mas pode enfraquecer o isolamento. A densidade multi-tenant é ótima para a sustentabilidade, mas algumas classificações de dados exigem recursos dedicados.

### Tradeoffs com Excelência Operacional (Operational Excellence)

Medir carbono, manter políticas de ciclo de vida, cuidar de agendamentos e operar pipelines conscientes de carbono é trabalho operacional a mais. Mais automação, mais componentes, mais coisas para monitorar. Sem a disciplina da [Excelência Operacional](/pt-br/principles/cloud/operational-excellence/) (donos claros, IaC, automação), as iniciativas de sustentabilidade viram faxinas pontuais que se deterioram em poucos meses.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Então se eu desligar tudo, o sistema fica verde no máximo? Zero servidor, zero carbono!"</span>
    </div>
  </div>
</div>

Tecnicamente correto, Júnior, e também um ótimo jeito de ser demitido! Um sistema que não entrega valor não é sustentável, ele só está desligado. A ideia nunca foi minimizar recursos a qualquer custo, e sim minimizar **desperdício**: recursos que não contribuem para o valor que o negócio precisa. Como todo tradeoff, a resposta é uma decisão consciente, documentada e tomada junto com o time e o negócio, não um reflexo para nenhum dos lados.

## Conclusão

A **Sustentabilidade** é o pilar mais novo dos frameworks Well-Architected, mas as ideias dela não têm nada de novas: use o que você precisa, desligue o que não precisa, faça o trabalho de forma eficiente e preste atenção de onde vem a sua energia. O que mudou é que agora dá para medir, atribuir e projetar para isso, do mesmo jeito que fazemos com custo e performance.

O provedor cuida da sustentabilidade *da* nuvem; a sustentabilidade *na* nuvem é nossa. Isso inclui a escolha de região, a utilização, o deslocamento de demanda, o ciclo de vida dos dados, o código eficiente e, cada vez mais, o uso criterioso de IA. A maioria dessas práticas também reduz a fatura, o que torna a venda interna bem fácil. As que não reduzem devem ser discutidas abertamente, como os tradeoffs que são.

No fim das contas, arquitetura sustentável é simplesmente **arquitetura sem desperdício**. E um sistema sem desperdício é mais barato, mais simples, mais rápido e mais fácil de operar. Nada mal para algo que ainda faz bem para o planeta.

## Próximos Passos

1. **Ganhe visibilidade**
Ative os relatórios de carbono do seu provedor (Emissions Impact Dashboard, Customer Carbon Footprint Tool ou Carbon Footprint) e analise-os junto com os relatórios de custo. Escolha um indicador que você já acompanha, como horas ociosas ou utilização média, como métrica inicial.

2. **Colha o quadrante "Todos ganham"**
Desligue recursos ociosos, agende os ambientes não produtivos, faça *right sizing* das máquinas superdimensionadas e aplique políticas de ciclo de vida ao armazenamento e aos logs. Dê a todo recurso caro, principalmente aceleradores, um dono e uma data de validade.

3. **Defina uma SCI para um workload importante**
Escolha uma unidade funcional que faça sentido (por usuário, por transação, por job), estime E, I e M e acompanhe a taxa ao longo do tempo. Use-a para comparar opções de design, não só para gerar relatório.

4. **Torne o trabalho flexível consciente de carbono**
Identifique jobs de batch, treinamento e analytics com prazos flexíveis, leve-os para filas com prazo e experimente o deslocamento no tempo ou no espaço usando dados de intensidade da rede.

5. **Revise os workloads de IA com olhar de eficiência**
Avalie modelos menores ou destilados, adicione cache e *batching*, enxugue os prompts e roteie cada tarefa para o tamanho de modelo certo.

6. **Inclua sustentabilidade nas revisões de arquitetura**
Coloque carbono como critério nas decisões de design e nas ADRs, ao lado de custo, confiabilidade e performance, e documente os tradeoffs quando decidir conscientemente contra ele.

<div class="callout info" data-title="Referências">
  <ul>
    <li><a href="https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sustainability-pillar.html" target="_blank" rel="noopener">AWS Well-Architected: Sustainability Pillar</a></li>
    <li><a href="https://aws.amazon.com/architecture/well-architected/" target="_blank" rel="noopener">AWS Well-Architected Framework</a></li>
    <li><a href="https://learn.microsoft.com/azure/well-architected/" target="_blank" rel="noopener">Microsoft Azure Well-Architected Framework</a></li>
    <li><a href="https://cloud.google.com/architecture/framework" target="_blank" rel="noopener">Google Cloud Architecture Framework</a></li>
    <li><a href="https://greensoftware.foundation/" target="_blank" rel="noopener">Green Software Foundation</a></li>
    <li><a href="https://sci.greensoftware.foundation/" target="_blank" rel="noopener">Especificação Software Carbon Intensity (SCI)</a></li>
    <li><a href="https://learn.greensoftware.foundation/" target="_blank" rel="noopener">Curso Green Software Practitioner</a></li>
    <li><a href="https://github.com/Green-Software-Foundation/carbon-aware-sdk" target="_blank" rel="noopener">Carbon Aware SDK</a></li>
    <li><a href="https://aws.amazon.com/aws-cost-management/aws-customer-carbon-footprint-tool/" target="_blank" rel="noopener">AWS Customer Carbon Footprint Tool</a></li>
    <li><a href="https://cloud.google.com/carbon-footprint" target="_blank" rel="noopener">Google Cloud Carbon Footprint</a></li>
    <li><a href="https://www.finops.org/" target="_blank" rel="noopener">FinOps Foundation</a></li>
  </ul>
</div>
