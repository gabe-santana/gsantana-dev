---
title: Transparência de custos
short: Se ninguém sabe dizer quanto custa uma requisição, um tenant ou um pedido, a fatura vira boato. Projete a solução para que o preço fique visível.
category: solution
---

## Introdução

Imagine a cena. Primeira segunda-feira do mês, o café ainda quente, e alguém do Financeiro solta um print no canal do time: a fatura da nuvem dobrou. Nenhum lançamento, nenhuma campanha de marketing, nenhuma Black Friday. Só um número duas vezes maior que o do mês passado e uma pergunta muito educada: *"Alguém consegue explicar isso?"*

O que vem depois é clássico. O time de plataforma diz que o cluster não cresceu. O time de dados jura que o *warehouse* está "igual sempre esteve". O time de produto lembra que a quantidade de clientes quase não mudou. Dois engenheiros passam três dias garimpando o console de *billing*, filtrando por serviço, por região, por *resource group*, e no final têm uma planilha cheia de palpites e uma conclusão honesta: **ninguém sabe por que a fatura dobrou**.

É exatamente essa situação que o princípio de **Transparência de Custos** existe para evitar. O lado organizacional dessa história (a cultura FinOps, o *Cloud Financial Management*, *showback* e *chargeback*) já está coberto em detalhes em [Otimização de custos](/pt-br/principles/cloud/cost-optimization/), e não vou repetir aqui. Este artigo é sobre a outra metade, a que mora dentro da arquitetura: **projetar a solução para que o custo dela fique visível por fluxo de valor e por unidade técnica**. Não "quanto a nuvem custa pra gente", mas "quanto custa um *checkout*", "quanto custa o tenant ACME", "quanto custa uma conversa com a IA".

Quando um time ignora este princípio, os sintomas são bem previsíveis:

- A fatura só é legível por tipo de serviço ("computação", "armazenamento", "rede"), nunca por produto, funcionalidade ou cliente;
- A infraestrutura compartilhada (clusters, bancos de dados, *brokers* de mensagem) vira um buraco negro onde entra custo e não sai nenhum dono;
- Ninguém sabe dizer se um cliente ou um plano é lucrativo, porque ninguém sabe quanto custa atendê-lo;
- Regressões de custo são descobertas pelo Financeiro, semanas depois do deploy que as causou;
- Toda discussão de arquitetura sobre custo é baseada em opinião, porque não existe número para discutir;
- As *tags* existem, mas metade dos recursos não tem, e a outra metade tem três grafias diferentes de `environment`;

Pois é, *é raro, mas acontece bastante*... Quem nunca abriu um relatório de custos e deu de cara com uma linha chamada "Outros" maior que o próprio produto?

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Mas custo não é problema do Financeiro? Eu escrevo código, eles pagam a conta. Por que eu ia me importar com quanto custa uma requisição?"</span>
    </div>
  </div>
</div>

Calma aí, Júnior! Na nuvem, **cada linha de código que você escreve tem um preço grudado nela**. A *query* sem índice, o *loop* de *retry* sem *backoff*, o log dentro de um caminho quente, o *prompt* que manda o histórico inteiro da conversa para o modelo a cada turno: tudo isso aparece na fatura. O Financeiro consegue ver *que* o dinheiro foi embora, mas só a engenharia consegue ver *por quê*. Se a arquitetura não expõe o custo no nível em que os engenheiros tomam decisões, ninguém liga uma coisa à outra, e a fatura vira boato em vez de sinal.

<div class="callout info">
  <p><strong>Transparência de Custos</strong> não é sobre gastar menos. É sobre tornar o custo da solução <strong>observável</strong>, atribuído às coisas com que o negócio e os engenheiros realmente se importam, para que todas as outras decisões de custo (inclusive a otimização) sejam tomadas com dados, e não com palpites.</p>
</div>

## Da fatura para a arquitetura

Uma fatura de nuvem crua é uma lista de itens: tantas horas de vCPU, tantos GB armazenados, tantos GB trafegados entre zonas. É precisa e quase inútil, porque descreve *recursos*, enquanto o seu negócio pensa em *produtos*, *clientes* e *transações*.

Transparência de custos é a corrente que transforma uma coisa na outra. Eu gosto de pensar nela em camadas, cada uma acrescentando um contexto que a anterior não tem:

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 740 260" role="img" aria-labelledby="ct-d1-title ct-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="ct-d1-title">Da fatura da nuvem às decisões</title>
<desc id="ct-d1-desc">Cinco camadas da esquerda para a direita: a fatura crua da nuvem, a alocação por tags e contas, a divisão dos custos compartilhados, o custo unitário vindo da telemetria da aplicação e as decisões em ADRs e pull requests, com um ciclo de retorno ao início.</desc>
<defs><marker id="ct-d1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="80" y="40" text-anchor="middle" class="d-label">CAMADA 1</text>
<text x="225" y="40" text-anchor="middle" class="d-label">CAMADA 2</text>
<text x="370" y="40" text-anchor="middle" class="d-label">CAMADA 3</text>
<text x="515" y="40" text-anchor="middle" class="d-label">CAMADA 4</text>
<text x="660" y="40" text-anchor="middle" class="d-label">CAMADA 5</text>
<rect x="21" y="56" width="118" height="100" rx="10" class="d-box-muted"/>
<text x="80" y="90" text-anchor="middle" class="d-title">Fatura</text>
<text x="80" y="114" text-anchor="middle" class="d-small">itens crus</text>
<text x="80" y="132" text-anchor="middle" class="d-small">sem contexto</text>
<rect x="166" y="56" width="118" height="100" rx="10" class="d-box"/>
<text x="225" y="90" text-anchor="middle" class="d-title">Alocação</text>
<text x="225" y="114" text-anchor="middle" class="d-small">tags, contas</text>
<text x="225" y="132" text-anchor="middle" class="d-small">embutidas no IaC</text>
<rect x="311" y="56" width="118" height="100" rx="10" class="d-box-info"/>
<text x="370" y="90" text-anchor="middle" class="d-title">Rateio</text>
<text x="370" y="114" text-anchor="middle" class="d-small">clusters, bancos</text>
<text x="370" y="132" text-anchor="middle" class="d-small">critérios justos</text>
<rect x="456" y="56" width="118" height="100" rx="10" class="d-box-accent"/>
<text x="515" y="90" text-anchor="middle" class="d-title">Por unidade</text>
<text x="515" y="114" text-anchor="middle" class="d-small">tenant, pedido</text>
<text x="515" y="132" text-anchor="middle" class="d-small">telemetria do app</text>
<rect x="601" y="56" width="118" height="100" rx="10" class="d-box-accent"/>
<text x="660" y="90" text-anchor="middle" class="d-title">Decisões</text>
<text x="660" y="114" text-anchor="middle" class="d-small">ADR, PR, backlog</text>
<text x="660" y="132" text-anchor="middle" class="d-small">donos do produto</text>
<line x1="139" y1="106" x2="162" y2="106" class="d-line" marker-end="url(#ct-d1-arrow)"/>
<line x1="284" y1="106" x2="307" y2="106" class="d-line" marker-end="url(#ct-d1-arrow)"/>
<line x1="429" y1="106" x2="452" y2="106" class="d-line" marker-end="url(#ct-d1-arrow)"/>
<line x1="574" y1="106" x2="597" y2="106" class="d-line" marker-end="url(#ct-d1-arrow)"/>
<path d="M660,156 L660,210 L80,210 L80,160" class="d-line-dashed" marker-end="url(#ct-d1-arrow)"/>
<text x="370" y="232" text-anchor="middle" class="d-small">retorno: mudanças de design que movem o custo unitário</text>
</svg>
</div>
<figcaption>Figura 1: As camadas que transformam uma fatura crua em decisões de arquitetura</figcaption>
</figure>

- **Camada 1, a fatura:** o que o provedor cobra. Você não controla o formato dela.
- **Camada 2, a alocação:** quem é dono de cada recurso. Isso vem de *tags*, *labels*, contas, *subscriptions* e nomenclatura, e precisa ser projetado, não remendado depois.
- **Camada 3, o rateio:** os recursos que atendem vários donos ao mesmo tempo (um cluster Kubernetes, um banco compartilhado, um NAT *gateway*) precisam de uma regra para dividir o custo.
- **Camada 4, o custo unitário:** divida o custo atribuído por um direcionador de negócio (requisições, pedidos, tenants, conversas) que só a aplicação conhece.
- **Camada 5, as decisões:** os números aparecem onde as decisões são tomadas: registros de decisão de arquitetura, *pull requests*, revisões de produto.

Repare que as camadas 2, 3 e 4 são **trabalho de arquitetura**. Nenhuma ferramenta de *billing* vai inventar uma *tag* que você nunca aplicou, ratear um cluster que você nunca rotulou ou contar pedidos que a sua aplicação nunca emitiu. Por isso este é um princípio de *solução*, e não só de FinOps.

## Economia unitária: o número que realmente importa

A ideia mais útil de toda a transparência de custos é o **custo unitário**: o custo total de um escopo, dividido pela unidade de negócio que esse escopo entrega.

`custo unitário = custo atribuído ao escopo ÷ unidades de valor entregues`

O pulo do gato é escolher a unidade certa. Ela precisa ser algo que o negócio entende, que cresce quando o negócio cresce e que a arquitetura consegue medir de forma confiável. Alguns exemplos:

| Tipo de solução | Unidade útil | Por que funciona |
| :--- | :--- | :--- |
| API pública | Custo por 1.000 requisições | Ligado diretamente ao tráfego, fácil de comparar entre versões e regiões. |
| E-commerce | Custo por pedido | Conecta infraestrutura com receita; dá para comparar com a margem média por pedido. |
| SaaS B2B | Custo por tenant (por mês) | Mostra quais clientes e planos dão lucro e alimenta decisões de preço. |
| App de consumo | Custo por usuário ativo mensal | Útil para planejar crescimento e comparar com a receita por usuário. |
| Plataforma de dados | Custo por execução de *pipeline* ou por GB processado | Expõe transformações caras e recargas completas desnecessárias. |
| Produto com LLM | Custo por conversa, por 1.000 *tokens*, por chamado resolvido | O uso de modelo costuma ser o maior custo variável, e varia absurdamente por usuário. |

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Pra que tanta conta? Se o total do mês caiu, estamos bem. Se subiu, estamos mal. Simples!"</span>
    </div>
  </div>
</div>

Não é bem assim, Júnior! O total do mês é o número mais enganoso do relatório inteiro. Se o seu negócio está crescendo, a fatura **deveria** crescer. O que importa é se ela cresce *mais devagar* que o valor que produz. Olha só:

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="ct-d2-title ct-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="ct-d2-title">Fatura total versus custo por pedido</title>
<desc id="ct-d2-desc">Em seis meses a fatura total, mostrada em barras, cresce cerca de 133 por cento, enquanto o custo por pedido, mostrado como uma linha, cai cerca de 38 por cento porque os pedidos cresceram mais rápido que o custo.</desc>
<text x="360" y="26" text-anchor="middle" class="d-label">OS MESMOS SEIS MESES, DUAS HISTÓRIAS</text>
<line x1="80" y1="220" x2="690" y2="220" class="d-line"/>
<line x1="80" y1="50" x2="80" y2="220" class="d-line"/>
<rect x="110" y="160" width="40" height="60" rx="4" class="d-box-info"/>
<rect x="210" y="148" width="40" height="72" rx="4" class="d-box-info"/>
<rect x="310" y="135" width="40" height="85" rx="4" class="d-box-info"/>
<rect x="410" y="120" width="40" height="100" rx="4" class="d-box-info"/>
<rect x="510" y="102" width="40" height="118" rx="4" class="d-box-info"/>
<rect x="610" y="80" width="40" height="140" rx="4" class="d-box-info"/>
<polyline points="130,70 230,85 330,102 430,115 530,128 630,140" class="d-line-accent"/>
<circle cx="130" cy="70" r="5" class="d-fill-accent"/>
<circle cx="230" cy="85" r="5" class="d-fill-accent"/>
<circle cx="330" cy="102" r="5" class="d-fill-accent"/>
<circle cx="430" cy="115" r="5" class="d-fill-accent"/>
<circle cx="530" cy="128" r="5" class="d-fill-accent"/>
<circle cx="630" cy="140" r="5" class="d-fill-accent"/>
<text x="130" y="240" text-anchor="middle" class="d-small">M1</text>
<text x="230" y="240" text-anchor="middle" class="d-small">M2</text>
<text x="330" y="240" text-anchor="middle" class="d-small">M3</text>
<text x="430" y="240" text-anchor="middle" class="d-small">M4</text>
<text x="530" y="240" text-anchor="middle" class="d-small">M5</text>
<text x="630" y="240" text-anchor="middle" class="d-small">M6</text>
<rect x="130" y="262" width="14" height="14" rx="3" class="d-box-info"/>
<text x="152" y="274" class="d-text">Fatura total: +133%</text>
<circle cx="407" cy="269" r="5" class="d-fill-accent"/>
<text x="420" y="274" class="d-text">Custo por pedido: -38%</text>
</svg>
</div>
<figcaption>Figura 2: A fatura mais que dobrou, e a solução ficou mais barata de operar</figcaption>
</figure>

Se você olhasse só as barras, convocaria uma reunião de emergência. Olhando a linha, você vê uma solução que ficou quase 40% mais eficiente por pedido enquanto o negócio decolava. Agora inverta: uma fatura estável com custo por pedido subindo significa que você está **perdendo eficiência** sem ninguém perceber, porque o total "parece ok".

Algumas regras práticas para métricas unitárias:

- **Escolha uma ou duas unidades principais por fluxo de valor**, não vinte. Um *dashboard* com cinquenta razões é tão opaco quanto a fatura crua.
- **Separe custo fixo de custo variável.** O custo unitário de um tenant em um sistema compartilhado tem uma parte fixa (a plataforma) e uma parte variável (o que o uso dele consome). As duas se comportam de formas bem diferentes quando você escala.
- **Acompanhe a tendência, não o valor absoluto.** O primeiro número que você calcular vai ser impreciso. Tudo bem. O que importa é que o método seja estável, para que a tendência seja real.
- **Coloque ao lado de um número de receita sempre que possível.** Custo por pedido significa muito mais do lado da margem por pedido.

## Práticas de design para transparência de custos

As práticas de FinOps em [Otimização de custos](/pt-br/principles/cloud/cost-optimization/) dizem à organização *o que* medir. As práticas abaixo são sobre construir uma solução que *possa* ser medida.

### 1. Desenhe o modelo de alocação antes do primeiro recurso

**Objetivo:** Todo recurso nasce sabendo quem é o dono, a qual produto pertence e em qual ambiente roda.

Colocar *tags* depois é arqueologia. Quando alguém decide "arrumar as *tags*", já existem milhares de recursos, ninguém lembra quem criou metade deles, e a auditoria leva um trimestre. O momento barato de decidir o modelo de alocação é **antes do primeiro `terraform apply`**.

Defina uma taxonomia de *tags* pequena e obrigatória e embuta nos seus módulos de IaC, para que os desenvolvedores não consigam esquecer nem se tentarem:

| Tag | Exemplo | Finalidade |
| :--- | :--- | :--- |
| `product` | `checkout` | O fluxo de valor que o recurso atende. |
| `component` | `payment-api` | A unidade técnica dentro do produto. |
| `owner` | `team-payments` | Quem responde pelo custo (e é acionado em anomalias). |
| `environment` | `prod` | Separa produção de todo o resto. |
| `cost-center` | `cc-4410` | O mapeamento para o Financeiro, quando a organização precisa. |
| `tenant` | `shared` ou `acme` | Só para recursos dedicados a um cliente. |

No Terraform, por exemplo, as *default tags* no nível do *provider* garantem que todo recurso criado pelo módulo herde a taxonomia:

```hcl
provider "aws" {
  default_tags {
    tags = {
      product     = var.product
      component   = var.component
      owner       = var.owner
      environment = var.environment
    }
  }
}
```

Depois, garanta a regra com *Policy as Code* (a parte de governança está em Otimização de custos) para que um recurso sem as *tags* obrigatórias simplesmente não possa ser criado. Mantenha os valores permitidos numa lista, não em texto livre, ou você vai acabar com `prod`, `Prod`, `production` e `prd` como quatro ambientes diferentes.

**Benefício:** A alocação vira uma propriedade da plataforma em vez de um projeto de faxina, e a cobertura fica perto de 100% conforme a solução cresce.

### 2. Use fronteiras de conta e *subscription* por *workload*

**Objetivo:** Deixar o mecanismo de alocação mais forte e mais barato fazer a maior parte do trabalho.

*Tags* são ótimas, mas nem tudo pode ser marcado: algumas cobranças (planos de suporte, parte da transferência de dados, taxas de *marketplace*, alguns custos indiretos de serviços gerenciados) nunca carregam as suas *tags*. Já uma conta AWS, uma *subscription* Azure ou um projeto GCP **atribui cada centavo que contém**, sem esforço nenhum. Uma conta dedicada por *workload* e ambiente (por exemplo, `checkout-prod`, `checkout-staging`) te dá um piso de alocação impossível de esquecer.

Ela também traz benefícios de segurança e de raio de impacto (o lado de [Segurança](/pt-br/principles/cloud/security/) e de [Confiabilidade](/pt-br/principles/cloud/reliability/) da mesma decisão), e é por isso que muitos desenhos de *landing zone* já recomendam essa separação.

**Benefício:** Uma base confiável de atribuição, em que as *tags* só precisam refinar a visão dentro de cada conta em vez de carregar o peso todo.

### 3. Dê nomes legíveis aos recursos

**Objetivo:** Qualquer pessoa olhando uma linha de custo sabe o que ela é sem abrir cinco consoles.

Uma convenção como `<produto>-<componente>-<ambiente>-<região>-<nn>` (por exemplo, `checkout-orders-db-prod-weu-01`) parece burocracia até o dia em que você está olhando um relatório de custos às 23h e encontra um `db-teste-2-final-novo` custando mais que o banco de produção. Nomes não substituem *tags* (são mais difíceis de consultar e de mudar), mas são o recurso legível por humanos que deixa relatórios e *dashboards* autoexplicativos.

**Benefício:** Investigações mais rápidas, menos conversas de "de quem é isso?", e recursos órfãos que saltam aos olhos na hora.

### 4. Rateie os custos compartilhados com regras explícitas

**Objetivo:** Nenhum recurso compartilhado vira um buraco negro de custo.

A infraestrutura compartilhada é onde a transparência costuma morrer. Um cluster Kubernetes rodando trinta serviços é cobrado como meia dúzia de nós. Uma instância PostgreSQL atendendo cinco produtos é uma linha só. Se você parar aí, o time de plataforma fica "dono" de um custo enorme que não controla, e os times de produto consomem de graça.

A saída é definir uma **regra de rateio** para cada recurso compartilhado, baseada num direcionador que reflita o consumo real:

- **Kubernetes:** aloque por *namespace* e *labels*, usando os *requests* de recursos (o que cada *workload* reservou) ou o uso real, o que for maior. Ferramentas como o **OpenCost** (um projeto *open source* da CNCF) e o **Kubecost** leem as métricas do cluster e a tabela de preços da nuvem para fazer exatamente isso. Faça os *namespaces* e *labels* espelharem a sua taxonomia de *tags* (`product`, `component`, `owner`), para que os dados do cluster e os da nuvem se cruzem sem atrito.
- **Bancos compartilhados:** rateie por um direcionador que o banco consegue informar, como armazenamento por *schema*, tempo de *query* por usuário da aplicação ou conexões por serviço. Dê a cada serviço consumidor o seu próprio usuário de banco, e esse direcionador vem praticamente de graça.
- **Rede e serviços de plataforma:** *gateways*, NAT, a pilha de observabilidade. Esses costumam ser rateados proporcionalmente ao custo direto de cada consumidor, ou pelo volume de requisições quando você tem esse dado.

E tem a parte desconfortável: a **capacidade ociosa**. Nós que ninguém pediu, folga para o *autoscaling*, *pods* de sistema. Você pode manter o custo ocioso visível numa linha própria (o que pressiona o time de plataforma a empacotar melhor o cluster) ou espalhá-lo proporcionalmente entre os consumidores (o que reflete o preço "real" de rodar ali). As duas opções são válidas; o erro é esconder.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 740 330" role="img" aria-labelledby="ct-d3-title ct-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="ct-d3-title">Rateio do custo de um cluster Kubernetes compartilhado</title>
<desc id="ct-d3-desc">Um cluster de 10.000 dólares por mês é primeiro alocado por namespace: checkout 3.800, catalog 2.200, search 1.500, sistema 1.000 e ocioso 1.500. As parcelas de sistema e ociosa são então espalhadas proporcionalmente, resultando em checkout 5.067, catalog 2.933 e search 2.000.</desc>
<defs><marker id="ct-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="40" y="30" class="d-label">1. FATURA DO CLUSTER</text>
<rect x="40" y="40" width="660" height="46" rx="10" class="d-box-muted"/>
<text x="370" y="69" text-anchor="middle" class="d-text">US$ 10.000 por mês: nós, discos, load balancers</text>
<text x="40" y="124" class="d-label">2. POR NAMESPACE (REQUESTS OU USO)</text>
<rect x="40" y="134" width="251" height="52" rx="6" class="d-box-accent"/>
<text x="165" y="156" text-anchor="middle" class="d-text">checkout</text>
<text x="165" y="175" text-anchor="middle" class="d-small">US$ 3.800</text>
<rect x="291" y="134" width="145" height="52" rx="6" class="d-box-info"/>
<text x="363" y="156" text-anchor="middle" class="d-text">catalog</text>
<text x="363" y="175" text-anchor="middle" class="d-small">US$ 2.200</text>
<rect x="436" y="134" width="99" height="52" rx="6" class="d-box"/>
<text x="485" y="156" text-anchor="middle" class="d-text">search</text>
<text x="485" y="175" text-anchor="middle" class="d-small">US$ 1.500</text>
<rect x="535" y="134" width="66" height="52" rx="6" class="d-box-warn"/>
<text x="568" y="156" text-anchor="middle" class="d-text">sistema</text>
<text x="568" y="175" text-anchor="middle" class="d-small">US$ 1.000</text>
<rect x="601" y="134" width="99" height="52" rx="6" class="d-box-danger"/>
<text x="650" y="156" text-anchor="middle" class="d-text">ocioso</text>
<text x="650" y="175" text-anchor="middle" class="d-small">US$ 1.500</text>
<line x1="370" y1="86" x2="370" y2="130" class="d-line" marker-end="url(#ct-d3-arrow)"/>
<line x1="568" y1="186" x2="520" y2="256" class="d-line-dashed" marker-end="url(#ct-d3-arrow)"/>
<line x1="650" y1="186" x2="630" y2="256" class="d-line-dashed" marker-end="url(#ct-d3-arrow)"/>
<text x="40" y="226" class="d-label">3. SISTEMA E OCIOSO RATEADOS PROPORCIONALMENTE</text>
<rect x="40" y="260" width="334" height="52" rx="6" class="d-box-accent"/>
<text x="207" y="282" text-anchor="middle" class="d-text">checkout</text>
<text x="207" y="301" text-anchor="middle" class="d-small">US$ 5.067</text>
<rect x="374" y="260" width="194" height="52" rx="6" class="d-box-info"/>
<text x="471" y="282" text-anchor="middle" class="d-text">catalog</text>
<text x="471" y="301" text-anchor="middle" class="d-small">US$ 2.933</text>
<rect x="568" y="260" width="132" height="52" rx="6" class="d-box"/>
<text x="634" y="282" text-anchor="middle" class="d-text">search</text>
<text x="634" y="301" text-anchor="middle" class="d-small">US$ 2.000</text>
</svg>
</div>
<figcaption>Figura 3: Um cluster compartilhado rateado por namespace, com a capacidade de sistema e a ociosa redistribuídas</figcaption>
</figure>

**Benefício:** Cada time enxerga o custo do que roda, o time de plataforma enxerga o seu *overhead*, e a capacidade ociosa vira um alvo visível em vez de desperdício silencioso.

### 5. Atribua custo por tenant em soluções *multi-tenant*

**Objetivo:** Saber quanto custa atender cada cliente, mesmo quando eles compartilham tudo.

Num SaaS B2B, "custo por tenant" é a métrica que liga a arquitetura ao modelo de negócio. E a forma como você desenha o *tenancy* decide o quanto ela é difícil de obter:

| Modelo de *tenancy* | Como o custo é atribuído | Transparência |
| :--- | :--- | :--- |
| <strong>Silo</strong> (pilha dedicada por tenant) | Diretamente, por conta ou pela *tag* `tenant`. | Excelente, mas você paga capacidade ociosa por tenant e opera muitas pilhas. |
| <strong>Pool</strong> (tudo compartilhado) | Indiretamente, medindo o consumo de cada tenant na aplicação e rateando o custo compartilhado por ele. | Tão boa quanto a sua medição. Sem ela, você não faz ideia. |
| <strong>Bridge</strong> (computação compartilhada e dados dedicados, ou tenants *premium* em silos) | Um misto: direto para as partes dedicadas, medido para as compartilhadas. | Boa, e muitas vezes o meio-termo pragmático. |

O ponto central é que, num modelo *pool*, **a infraestrutura não consegue diferenciar os tenants; só a aplicação consegue**. Então a aplicação precisa registrar, em cada operação relevante, qual tenant ela atendeu e quanto dos recursos caros consumiu: requisições, tempo de processamento, armazenamento, mensagens, *tokens* de modelo. Esse consumo vira o direcionador usado para ratear a fatura compartilhada.

Isso importa além da contabilidade. É muito comum descobrir que 5% dos tenants geram 60% da carga, às vezes no plano mais barato. Sem atribuição por tenant, esse cliente parece exatamente igual a todos os outros. Com ela, você consegue precificar faixas de uso, definir cotas justas ou, no mínimo, tomar uma decisão consciente de continuar subsidiando.

**Benefício:** Preço, limites de plano e descontos comerciais passam a se apoiar no custo real de atendimento, e os "vizinhos barulhentos" ficam visíveis.

### 6. Emita telemetria relevante para custo a partir da aplicação

**Objetivo:** Tratar os direcionadores de custo como sinais de observabilidade de primeira classe.

É aqui que a transparência de custos encontra o [Observability First](/pt-br/principles/solution/observability-first/). A aplicação já emite métricas, *traces* e logs. Acrescente as dimensões e os contadores que explicam o custo:

- **Unidades de negócio:** pedidos feitos, documentos processados, conversas iniciadas. Esses são os denominadores dos seus custos unitários.
- **Direcionadores de custo:** tamanho de *payload*, bytes gravados, linhas lidas, chamadas a APIs externas e, principalmente, ***tokens* de LLM** (entrada, saída, em cache), marcados por modelo.
- **Dimensões de atribuição:** `tenant`, `product`, `feature`, `plan`. Fique de olho na cardinalidade: IDs de tenant funcionam bem num SaaS com centenas de clientes, IDs de usuário geralmente não.

Com OpenTelemetry, por exemplo, registrar *tokens* por tenant e por funcionalidade é um único contador:

```ts
const tokens = meter.createCounter("llm.tokens", { unit: "token" });

tokens.add(usage.inputTokens, {
  tenant: ctx.tenantId,
  feature: "support-assistant",
  model: "large",
  direction: "input",
});
```

Produtos com LLM tornam isso urgente. Dois usuários da mesma funcionalidade podem ter custos cem vezes diferentes, dependendo do tamanho das conversas, de quanto contexto é recuperado e de qual modelo é chamado. A fatura mensal do provedor de modelo não diz nada sobre isso. Um contador de *tokens* por tenant e por funcionalidade diz tudo: qual funcionalidade é cara, qual cliente é pesado, se o novo *template* de *prompt* dobrou o tamanho da entrada, se o cache está mesmo acertando.

<div class="callout tip">
  <p>Multiplique os contadores de uso pela tabela de preços do provedor no <em>dashboard</em>, não na aplicação. Preços mudam; a sua telemetria não deveria precisar de um novo deploy quando isso acontece. Emita <strong>quantidades</strong>, calcule <strong>dinheiro</strong> depois.</p>
</div>

**Benefício:** O custo passa a ser explicável no nível de uma funcionalidade, de um tenant ou de um único deploy, com as mesmas ferramentas que o time já usa para latência e erros.

### 7. Coloque o custo na decisão de arquitetura e no *pull request*

**Objetivo:** Saber o preço de uma mudança antes de ela ir para produção, e não um mês depois.

Custo que só aparece quando a fatura chega é aula de história. Transparência significa trazer esse custo para mais cedo, para os lugares onde a decisão é de fato tomada.

**Nos registros de decisão de arquitetura (ADRs):** acrescente uma seção de "Impacto em custo". Não precisa ser uma previsão precisa, só uma ordem de grandeza e, acima de tudo, o efeito no **custo unitário**: "A opção A acrescenta cerca de US$ 0,002 por pedido; a opção B tem um fixo de US$ 1.200/mês, mas fica mais barata acima de 600.000 pedidos por mês". Esse único parágrafo muda a qualidade da discussão e deixa registro para o dia em que alguém perguntar por que a fatura está do jeito que está.

**Nos *pull requests*:** ferramentas como o **Infracost** leem as mudanças de Terraform e comentam a diferença estimada de custo mensal direto no PR. Quem revisa vê "+US$ 840/mês" do lado do *diff* que trocou um tipo de instância, antes do botão de *merge*. Ele não pega custos que dependem de uso (não tem como saber quantas requisições você vai receber), mas pega o clássico "só aumentei o SKU para testar uma coisinha" que sobrevive por um ano.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 340" role="img" aria-labelledby="ct-d4-title ct-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="ct-d4-title">Custo no ciclo de entrega</title>
<desc id="ct-d4-desc">Um ciclo de cinco etapas: o ADR estima o custo unitário, o pull request mostra a diferença de custo, o deploy garante as tags, a telemetria mede o custo por tenant e a revisão compara a tendência, alimentando o próximo ADR.</desc>
<defs><marker id="ct-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-accent"/></marker></defs>
<rect x="285" y="32" width="150" height="56" rx="10" class="d-box-accent"/>
<text x="360" y="56" text-anchor="middle" class="d-title">ADR</text>
<text x="360" y="76" text-anchor="middle" class="d-small">estimativa unitária</text>
<rect x="515" y="112" width="150" height="56" rx="10" class="d-box-info"/>
<text x="590" y="136" text-anchor="middle" class="d-title">Pull request</text>
<text x="590" y="156" text-anchor="middle" class="d-small">diferença de custo</text>
<rect x="445" y="262" width="150" height="56" rx="10" class="d-box"/>
<text x="520" y="286" text-anchor="middle" class="d-title">Deploy</text>
<text x="520" y="306" text-anchor="middle" class="d-small">tags obrigatórias</text>
<rect x="125" y="262" width="150" height="56" rx="10" class="d-box"/>
<text x="200" y="286" text-anchor="middle" class="d-title">Telemetria</text>
<text x="200" y="306" text-anchor="middle" class="d-small">custo por tenant</text>
<rect x="55" y="112" width="150" height="56" rx="10" class="d-box-warn"/>
<text x="130" y="136" text-anchor="middle" class="d-title">Revisão</text>
<text x="130" y="156" text-anchor="middle" class="d-small">tendência unitária</text>
<line x1="435" y1="70" x2="536" y2="110" class="d-line-accent" marker-end="url(#ct-d4-arrow)"/>
<line x1="580" y1="168" x2="546" y2="256" class="d-line-accent" marker-end="url(#ct-d4-arrow)"/>
<line x1="445" y1="290" x2="281" y2="290" class="d-line-accent" marker-end="url(#ct-d4-arrow)"/>
<line x1="180" y1="262" x2="142" y2="173" class="d-line-accent" marker-end="url(#ct-d4-arrow)"/>
<line x1="184" y1="112" x2="281" y2="72" class="d-line-accent" marker-end="url(#ct-d4-arrow)"/>
<text x="360" y="178" text-anchor="middle" class="d-label">CUSTO NO CICLO</text>
<text x="360" y="200" text-anchor="middle" class="d-small">toda mudança tem um preço</text>
</svg>
</div>
<figcaption>Figura 4: Custo visível em cada etapa da entrega, da decisão à revisão</figcaption>
</figure>

**Benefício:** Regressões de custo são pegas por quem as causa, no momento em que é mais barato corrigir, e o raciocínio por trás das escolhas caras fica registrado.

### 8. Coloque os *dashboards* de custo ao lado dos de latência

**Objetivo:** O custo é acompanhado com a mesma frequência e pelas mesmas pessoas que a performance.

Se o *dashboard* do serviço mostra latência p95, taxa de erro e *throughput*, ele também deveria mostrar o **custo por requisição** (ou por pedido, por tenant) do mesmo serviço, na mesma janela de tempo. Não numa ferramenta de *billing* separada que só uma pessoa acessa. Ali mesmo, onde o engenheiro de plantão olha todos os dias.

Quando custo e latência moram lado a lado, as correlações saltam aos olhos: o deploy que resolveu a latência dobrando o cluster de cache, a *release* que cortou 30% do custo por requisição graças a uma *query* melhor, o tenant cujo padrão de tráfego mudou da noite para o dia. Acrescente **alertas de anomalia no custo unitário**, não só no gasto total. Um alerta de gasto total dispara quando o negócio cresce; um alerta de custo unitário dispara quando algo está realmente errado.

**Benefício:** Custo vira um sinal operacional normal, discutido nas mesmas *dailies* e revisões de incidente que todo o resto.

## De volta à fatura que dobrou

Vamos voltar àquela segunda-feira. Imagine o mesmo time, mas com as práticas acima funcionando. A conversa seria mais ou menos assim:

1. O *dashboard* de custo unitário mostra que o **custo por pedido ficou estável** em todos os produtos menos um: o assistente de suporte, cujo custo por conversa triplicou duas semanas atrás.
2. Filtrando o contador de *tokens* por funcionalidade e tenant, o time vê que os *tokens* de entrada por conversa saltaram logo depois de um deploy.
3. O histórico de PRs daquele deploy mostra uma mudança na etapa de recuperação: ela passou a mandar vinte documentos para o modelo em vez de cinco, "para melhorar a qualidade das respostas".
4. O ADR do assistente tinha estimado cerca de US$ 0,04 por conversa. Agora está em US$ 0,13. Ninguém percebeu, porque ninguém estava olhando esse número.

Diagnóstico em uma hora em vez de três dias, com um dono claro e uma decisão concreta a tomar: o ganho de qualidade vale três vezes o custo por conversa? Pode ser que sim! Essa é uma decisão de produto, e agora ela pode ser tomada com dados. A transparência não reduziu a fatura sozinha. Ela transformou um mistério numa escolha.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Beleza, me convenceu. Então bora colocar tag em absolutamente tudo, medir cada chamada de função por usuário e fazer um dashboard pra cada microsserviço, começando hoje!"</span>
    </div>
  </div>
</div>

Opa, segura a empolgação, Júnior! O entusiasmo é ótimo, mas transparência tem um custo próprio, e correr atrás de precisão perfeita é um dos jeitos mais rápidos de queimar um trimestre e desistir. Comece pelas poucas unidades que importam para o negócio e acerte-as de forma aproximada. O que nos leva aos *tradeoffs*.

## Tradeoffs

Como todo princípio, a **Transparência de Custos** puxa contra outros. Saber onde isso acontece permite decidir até onde ir.

### Tradeoffs com Eficiência de Performance (Performance Efficiency)

**Overhead de instrumentação:** cada contador, *label* e *span* tem um custo em tempo de execução. Medir cada operação por tenant num caminho quente acrescenta CPU, memória e rede, e dimensões de alta cardinalidade (por usuário, por ID de requisição) podem deixar o seu *backend* de métricas lento e caro ao mesmo tempo.

**Mitigação:** agregue em memória e exporte periodicamente, use amostragem onde a exatidão não é necessária e mantenha as dimensões de atribuição grossas (tenant, funcionalidade, plano) em vez de por usuário.

### Tradeoffs com Otimização de Custos (Cost Optimization)

**Transparência não é de graça:** armazenamento de métricas, ferramentas de alocação de custo, o tempo de engenharia para construir e manter *dashboards* e regras de rateio. Para uma solução pequena, com uma fatura modesta, um *pipeline* completo de atribuição por tenant pode facilmente custar mais do que a economia que ele um dia vai revelar.

**Precisão vs. esforço:** sair do "mais ou menos certo" para o "exato até o centavo" segue uma curva íngreme. Um custo unitário 80% preciso, construído em uma semana, costuma valer muito mais que um 99% preciso que leva seis meses. Deixe explícita a precisão de que você precisa: mostrar uma tendência para os engenheiros exige bem menos do que cobrar um cliente pelo uso.

### Tradeoffs com Excelência Operacional (Operational Excellence)

**Proliferação de contas:** uma conta por *workload* e ambiente é fantástica para alocação, mas em escala isso significa centenas de contas para proteger, atualizar, interligar e governar. Sem uma automação sólida (*landing zones*, *account vending*, políticas centralizadas), o peso operacional cresce mais rápido que o benefício de transparência.

**Manutenção da taxonomia:** esquemas de *tags* e regras de rateio envelhecem conforme a organização se reorganiza. Times mudam de nome, produtos se fundem, centros de custo mudam. Alguém precisa ser dono da taxonomia, ou ela apodrece devagar até virar o mesmo caos que deveria resolver.

### Tradeoffs com Segurança (Security)

**A telemetria carrega contexto sensível:** identificadores de tenant, uso de funcionalidades e padrões de consumo são sensíveis para o negócio e, em alguns casos, dados pessoais. A telemetria de custo precisa da mesma classificação e do mesmo controle de acesso de qualquer outro dado de observabilidade.

**O próprio dado de custo é sensível:** custo e margem por cliente são exatamente o tipo de informação que você não quer espalhada. Transparência dentro do time de engenharia não significa publicar todos os números para todo mundo.

### Tradeoffs com Confiabilidade (Reliability)

**Isolamento vs. compartilhamento:** pilhas dedicadas por tenant dão atribuição perfeita e um raio de impacto menor, mas multiplicam a capacidade ociosa e a quantidade de peças móveis. Desenhos compartilhados são mais baratos e mais simples de operar, mas exigem uma medição cuidadosa. O modelo de *tenancy* é uma decisão que equilibra custo, [Confiabilidade](/pt-br/principles/cloud/reliability/) e transparência ao mesmo tempo, não só transparência.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Quer dizer que até medir custo tem custo? E como eu sei a hora de parar?"</span>
    </div>
  </div>
</div>

Exatamente, Júnior! A regra que eu uso: pare quando o próximo nível de detalhe não muda mais nenhuma decisão. Se saber o custo por tenant muda o preço, meça. Se saber o custo por *endpoint* da API não muda nada que alguém vá fazer, não meça. Transparência é um meio para decisões melhores, não um troféu.

## Conclusão

A **Transparência de Custos** é o que transforma o custo da nuvem de uma surpresa mensal em um sinal de engenharia. No nível da solução, ela se resume a algumas escolhas de design: um modelo de alocação embutido no IaC desde o primeiro dia, fronteiras de conta que atribuem custo de graça, regras explícitas para ratear a infraestrutura compartilhada, atribuição por tenant em desenhos *multi-tenant* e uma telemetria de aplicação que conta as unidades de valor e os direcionadores de custo.

Em cima dessa base, a **economia unitária** substitui o enganoso total do mês por números que realmente significam alguma coisa: custo por requisição, por pedido, por tenant, por conversa. E quando esses números aparecem nos ADRs, nos *pull requests* e do lado do *dashboard* de latência, o custo deixa de ser um problema do Financeiro descoberto semanas depois e passa a fazer parte de como o time constrói software todos os dias.

A cultura organizacional (FinOps, *showback*, *chargeback*) descrita em [Otimização de custos](/pt-br/principles/cloud/cost-optimization/) depende de tudo isso. A cultura consegue fazer as perguntas certas, mas só a arquitetura consegue tornar as respostas visíveis. E da próxima vez que a fatura dobrar, a resposta para *"Alguém consegue explicar isso?"* deveria levar uma hora, não uma *sprint*.

## Próximos Passos

1. **Escolha as suas unidades**
Para cada fluxo de valor, escolha uma ou duas métricas unitárias que o negócio entenda (custo por pedido, por tenant, por conversa) e combine como elas são calculadas.

2. **Defina e garanta uma taxonomia de *tags***
Mantenha-a curta e obrigatória, embuta nos módulos de IaC como *default tags*, restrinja os valores a listas permitidas e bloqueie recursos sem *tags* com *Policy as Code*.

3. **Desenhe as fronteiras de conta**
Separe *workloads* e ambientes em contas, *subscriptions* ou projetos próprios sempre que o custo operacional for aceitável.

4. **Escreva regras de rateio para os recursos compartilhados**
Rotule os *namespaces* do Kubernetes com a mesma taxonomia, adote o OpenCost ou uma ferramenta parecida, decida como tratar a capacidade ociosa e de sistema e documente o direcionador de cada banco ou serviço de plataforma compartilhado.

5. **Instrumente a aplicação**
Emita unidades de negócio e direcionadores de custo (incluindo *tokens* de LLM) como métricas com dimensões de tenant e funcionalidade, e calcule o dinheiro depois, a partir das quantidades.

6. **Leve o custo para as decisões**
Acrescente uma seção de impacto em custo aos ADRs, rode uma estimativa de custo nos *pull requests* de infraestrutura e coloque painéis de custo unitário e alertas de anomalia do lado da latência e da taxa de erro.

<div class="callout info" data-title="Referências">
  <ul>
    <li><a href="https://learn.microsoft.com/azure/well-architected/cost-optimization/" target="_blank" rel="noopener">Azure Well-Architected Framework: Otimização de custos</a></li>
    <li><a href="https://aws.amazon.com/architecture/well-architected/" target="_blank" rel="noopener">AWS Well-Architected Framework</a></li>
    <li><a href="https://cloud.google.com/architecture/framework" target="_blank" rel="noopener">Google Cloud Architecture Framework</a></li>
    <li><a href="https://www.finops.org/" target="_blank" rel="noopener">FinOps Foundation</a></li>
    <li><a href="https://www.opencost.io/" target="_blank" rel="noopener">OpenCost</a></li>
    <li><a href="https://www.infracost.io/" target="_blank" rel="noopener">Infracost</a></li>
    <li><a href="https://opentelemetry.io/" target="_blank" rel="noopener">OpenTelemetry</a></li>
  </ul>
</div>
