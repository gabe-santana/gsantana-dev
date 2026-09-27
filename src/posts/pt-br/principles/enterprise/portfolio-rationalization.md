---
title: Racionalização do portfólio
short: Um portfólio de aplicações enxuto, sem redundância e sem custo oculto. Afinal, pra que pagar três vezes pelo mesmo CRM?
category: enterprise
---

## Introdução

Toda empresa que já tem alguns anos de estrada carrega uma coleção de sistemas. Uns foram comprados, outros desenvolvidos em casa, alguns vieram de brinde numa aquisição e outros nasceram numa sexta-feira à tarde, criados por alguém do Financeiro que "só precisava de uma ferramentinha rápida". Com o tempo essa coleção cresce, e quase ninguém para pra fazer a pergunta incômoda: **a gente ainda precisa de tudo isso?**

A **racionalização do portfólio** é a disciplina de responder essa pergunta de propósito. A **meta** deste princípio é simples de falar e difícil de fazer: **manter apenas as aplicações que entregam valor, no estado mais saudável possível, com o menor custo total razoável**. Todo o resto é modernizado, consolidado ou desligado, de forma planejada e segura.

Quando uma organização ignora este princípio, os sintomas aparecem por todo lado:

- Ninguém consegue apresentar uma lista confiável de todos os sistemas que a empresa roda;
- Três (ou cinco) aplicações fazendo o mesmo trabalho em departamentos diferentes;
- Renovações de licença pagas no automático, ano após ano, de ferramentas que ninguém abre;
- Integrações tão emaranhadas que qualquer mudança num sistema quebra outros dois;
- Patches de segurança que nunca acontecem porque "aquele servidor é velho demais pra mexer";
- Um orçamento de TI em que a maior parte do dinheiro vai pra *manter as luzes acesas* e quase nada sobra pra inovar;

Pois é, *é raro, mas acontece bastante*... Quem nunca?

### O sistema que ninguém sabe de quem é, mas ninguém tem coragem de desligar

Toda empresa tem um. É uma máquina virtual (ou pior, uma caixa física debaixo da mesa de alguém) com um nome enigmático tipo `SRV-APP-07`. Ela consome processamento, armazenamento, licenças e backup. Aparece em todo scan de vulnerabilidade com nota vermelha. Ninguém sabe direito o que ela faz. Quem montou saiu da empresa há seis anos.

E mesmo assim, ninguém tem coragem de desligar. Porque e se for ela que gera o relatório regulatório do mês? E se a integração da folha de pagamento passar por ela? E se o dashboard favorito do CEO ler do banco dela?

Então o servidor continua ligado. Ano após ano. Custando dinheiro em silêncio, acumulando risco em silêncio. Essa máquina é o símbolo perfeito de uma organização que nunca praticou a racionalização do portfólio: **o medo do desconhecido sai mais caro que o próprio sistema, mas ninguém nunca mediu nenhum dos dois**.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Mas se tá funcionando e ninguém reclama, pra que mexer? Time que tá ganhando não se mexe, né?"</span>
    </div>
  </div>
</div>

Calma aí, Júnior! "Ninguém reclama" não é a mesma coisa que "não custa nada". Esse sistema está pagando licença, hardware, energia, backup e, principalmente, **risco**: um sistema operacional sem patch na rede é uma porta aberta. Ele também cobra em atenção, porque toda auditoria, toda migração e toda mudança de infraestrutura precisa passar na ponta dos pés ao redor dele. O problema não é que ele está quebrado. O problema é que **ninguém sabe se ele importa**, e essa ignorância tem preço.

<div class="callout info">
  <p>Racionalizar o portfólio não é um projeto pontual de corte de custos. É uma prática contínua de <strong>saber o que você tem</strong>, <strong>avaliar com honestidade</strong> e <strong>agir a partir dessa avaliação</strong>, pra que o portfólio continue alinhado com o que o negócio realmente precisa.</p>
</div>

## O que é, de fato, Gestão do Portfólio de Aplicações

A racionalização do portfólio vive dentro de uma disciplina mais ampla chamada **Application Portfolio Management (APM)**, ou Gestão do Portfólio de Aplicações. A ideia vem do mercado financeiro: um investidor administra uma carteira de ativos, decidindo o que comprar, manter ou vender com base em retorno e risco. O APM aplica o mesmo raciocínio ao software. Cada aplicação é um ativo que consome dinheiro e gente, e precisa justificar o seu lugar.

Na prática, o trabalho segue um ciclo que nunca termina de verdade:

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 260" role="img" aria-labelledby="port-d1-title port-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="port-d1-title">O ciclo de racionalização do portfólio</title>
<desc id="port-d1-desc">Cinco etapas em ciclo: inventariar as aplicações, avaliar valor e saúde, decidir com TIME e os 7 Rs, executar em ondas do roadmap e governar para manter o portfólio enxuto, o que realimenta o inventário.</desc>
<defs><marker id="port-d1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="360" y="32" text-anchor="middle" class="d-label">GESTÃO DO PORTFÓLIO DE APLICAÇÕES</text>
<rect x="24" y="70" width="112" height="72" rx="10" class="d-box-info"/>
<text x="80" y="100" text-anchor="middle" class="d-title">Inventariar</text>
<text x="80" y="122" text-anchor="middle" class="d-small">CMDB, discovery</text>
<line x1="136" y1="106" x2="162" y2="106" class="d-line" marker-end="url(#port-d1-arrow)"/>
<rect x="164" y="70" width="112" height="72" rx="10" class="d-box"/>
<text x="220" y="100" text-anchor="middle" class="d-title">Avaliar</text>
<text x="220" y="122" text-anchor="middle" class="d-small">valor x saúde</text>
<line x1="276" y1="106" x2="302" y2="106" class="d-line" marker-end="url(#port-d1-arrow)"/>
<rect x="304" y="70" width="112" height="72" rx="10" class="d-box-accent"/>
<text x="360" y="100" text-anchor="middle" class="d-title">Decidir</text>
<text x="360" y="122" text-anchor="middle" class="d-small">TIME e 7 Rs</text>
<line x1="416" y1="106" x2="442" y2="106" class="d-line" marker-end="url(#port-d1-arrow)"/>
<rect x="444" y="70" width="112" height="72" rx="10" class="d-box"/>
<text x="500" y="100" text-anchor="middle" class="d-title">Executar</text>
<text x="500" y="122" text-anchor="middle" class="d-small">ondas do roadmap</text>
<line x1="556" y1="106" x2="582" y2="106" class="d-line" marker-end="url(#port-d1-arrow)"/>
<rect x="584" y="70" width="112" height="72" rx="10" class="d-box-warn"/>
<text x="640" y="100" text-anchor="middle" class="d-title">Governar</text>
<text x="640" y="122" text-anchor="middle" class="d-small">manter enxuto</text>
<path d="M640,142 L640,196 L80,196 L80,146" fill="none" class="d-line-dashed" marker-end="url(#port-d1-arrow)"/>
<text x="360" y="222" text-anchor="middle" class="d-small">novos sistemas, contratos e necessidades alimentam a próxima rodada</text>
</svg>
</div>
<figcaption>Figura 1: Racionalizar o portfólio é um ciclo, não um projeto</figcaption>
</figure>

Vamos passar por cada etapa.

## Etapa 1: Saiba o que você tem

Não dá pra racionalizar o que você não enxerga. A primeira etapa, e sinceramente aquela em que a maioria das iniciativas morre, é montar um **inventário confiável**.

### 1. Comece pela CMDB, mas não confie cegamente nela

Muitas empresas já têm uma **CMDB** (*Configuration Management Database*), geralmente atrelada à ferramenta de ITSM. É um ótimo ponto de partida, mas costuma estar desatualizada: servidores desativados há anos, aplicações cadastradas com o dono errado, ferramentas SaaS que nunca entraram porque "não rodam na nossa infraestrutura".

**Meta:** tratar a CMDB como uma hipótese a ser validada, não como a verdade absoluta.

### 2. Use *discovery* automatizado

Complemente a CMDB com fontes que não dependem de alguém lembrar de preencher um formulário:

- ***Discovery* de rede e infraestrutura:** agentes e scanners que encontram hosts, portas abertas, processos rodando e as conexões entre eles;
- **Inventários de nuvem:** os *resource graphs* e as *tags* de cada provedor, que listam tudo o que existe (e tudo o que gera fatura);
- **Logs do provedor de identidade:** os logins via SSO revelam quais aplicações SaaS as pessoas realmente usam, e com que frequência;
- **Dados financeiros:** fatura de cartão corporativo, reembolsos e contas a pagar são uma fonte incrível pra achar software que a TI nunca aprovou;
- **Repositórios de código e pipelines:** todo artefato publicável é uma aplicação em potencial.

**Benefício:** o inventário reflete a realidade, não as boas intenções, e pode ser atualizado de forma automática.

### 3. Registre os atributos mínimos úteis

Um inventário com duzentos campos por aplicação nunca é preenchido. Comece pequeno, com o que você precisa pra tomar decisões:

| Atributo | Por que importa |
|----------|-----------------|
| **Dono de negócio** | Alguém que consegue dizer se o sistema ainda importa. Sem dono, sem decisão. |
| **Dono técnico** | Alguém que sabe como ele roda e o que quebra se ele parar. |
| **Capacidade de negócio** | Qual capacidade ele suporta (faturamento, CRM, RH...). É assim que se encontra redundância. |
| **Usuários e uso** | Quantas pessoas usam e com que frequência. Números reais, não opiniões. |
| **Integrações** | Pra onde ele envia dados e de onde recebe. É aqui que mora o risco escondido. |
| **Custo anual** | Licenças, infraestrutura, suporte e pessoas. Até uma estimativa grosseira ajuda. |
| **Tecnologia e ciclo de vida** | Stack, versões, datas de fim de suporte do fornecedor. |
| **Classificação dos dados** | Se ele guarda dados pessoais, financeiros ou regulados. |

### 4. Mapeie aplicações para capacidades de negócio

Essa é a arma secreta. Quando você associa cada aplicação a um **mapa de capacidades de negócio**, a redundância salta aos olhos. Você olha a capacidade "Gestão de Relacionamento com o Cliente" e encontra três CRMs diferentes: um comprado pelo Comercial anos atrás, um que veio junto com a aquisição de uma empresa menor e um que o Marketing construiu numa plataforma *low-code* porque os outros dois "não faziam o que eles precisavam".

Três CRMs significam três contratos de licença, três conjuntos de integrações com o ERP, três versões da verdade sobre o cliente e três times mantendo tudo de pé. E, claro, ninguém consegue responder uma pergunta simples como "quantos clientes ativos a gente tem?" sem uma guerra de planilhas.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Pra que tanto trabalho? É só mandar uma planilha pra cada gestor e pedir pra listar os sistemas deles!"</span>
    </div>
  </div>
</div>

Pode fazer isso, Júnior, e deve, como uma das fontes. Mas uma planilha autodeclarada só captura o que as pessoas lembram e o que elas se sentem à vontade pra admitir. A ferramenta paga no cartão corporativo, o Excel cheio de macros que no fundo é um sistema crítico, o servidor antigo que "não é de ninguém"... nada disso entra na lista. Por isso você cruza a pesquisa com *discovery*, logs de SSO e dados financeiros. **A verdade está na interseção.**

### *Shadow IT*: o portfólio que ninguém aprovou

***Shadow IT*** é qualquer tecnologia usada pelo negócio sem o conhecimento ou a aprovação da TI. Nem sempre é vilã: na maioria das vezes é sintoma de que a TI oficial é lenta demais ou não atende uma necessidade real. Mas ela traz problemas concretos:

- Dados da empresa (às vezes dados pessoais) morando em ferramentas sem nenhuma revisão de segurança;
- Contratos assinados sem passar pelo jurídico ou por compras;
- Gasto duplicado, porque cada departamento paga a sua própria licença;
- Nenhum *offboarding*: quando alguém sai da empresa, o acesso àquela ferramenta SaaS continua aberto.

A resposta certa não é "caçar e proibir" tudo. É trazer pra luz: descobrir, avaliar como qualquer outra aplicação e então decidir. Às vezes a ferramenta paralela é melhor que a oficial e vira o novo padrão. Às vezes é consolidada. De um jeito ou de outro, ela deixa de ser invisível.

## Etapa 2: Avalie valor e saúde

Com o inventário em mãos, é hora de avaliar cada aplicação com honestidade. Duas perguntas importam mais:

1. **Valor de negócio:** quanto essa aplicação contribui pro negócio? Ela suporta uma capacidade crítica? Gera receita, atende uma exigência regulatória, diferencia a empresa?
2. **Saúde técnica:** em que condição técnica ela está? Tem suporte do fornecedor? É segura, estável, fácil de manter e de integrar? Ainda existe gente no mercado que sabe mexer nela?

Cada pergunta vira uma nota, construída a partir de alguns critérios com peso:

| Dimensão | Exemplos de critérios |
|----------|------------------------|
| **Valor de negócio** | Criticidade da capacidade, número de usuários, impacto em receita ou regulação, aderência à estratégia, satisfação dos usuários |
| **Saúde técnica** | Situação do suporte do fornecedor, postura de segurança, frequência de incidentes, manutenibilidade, aderência à arquitetura, disponibilidade de profissionais |

Mantenha a pontuação simples (de 1 a 5 por critério já basta) e, principalmente, **pontue com quem conhece**: os donos de negócio avaliam valor, os donos técnicos avaliam saúde. Um arquiteto pontuando tudo sozinho produz um gráfico bonito em que ninguém acredita.

### O modelo TIME

Com as duas notas em mãos, você posiciona cada aplicação numa matriz dois por dois. O **Gartner** popularizou uma forma clássica de ler essa matriz, o **modelo TIME**: *Tolerate, Invest, Migrate, Eliminate* (Tolerar, Investir, Migrar, Eliminar).

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 390" role="img" aria-labelledby="port-d2-title port-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="port-d2-title">O modelo TIME</title>
<desc id="port-d2-desc">Uma matriz dois por dois com a saúde técnica no eixo horizontal e o valor de negócio no eixo vertical. Alto valor e baixa saúde significa Migrar, alto valor e alta saúde significa Investir, baixo valor e baixa saúde significa Eliminar, baixo valor e alta saúde significa Tolerar.</desc>
<defs><marker id="port-d2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<rect x="146" y="46" width="228" height="134" rx="10" class="d-box-warn"/>
<text x="260" y="94" text-anchor="middle" class="d-title">Migrar</text>
<text x="260" y="118" text-anchor="middle" class="d-small">valioso, mas frágil</text>
<text x="260" y="136" text-anchor="middle" class="d-small">modernizar ou trocar</text>
<rect x="386" y="46" width="228" height="134" rx="10" class="d-box-accent"/>
<text x="500" y="94" text-anchor="middle" class="d-title">Investir</text>
<text x="500" y="118" text-anchor="middle" class="d-small">valioso e saudável</text>
<text x="500" y="136" text-anchor="middle" class="d-small">evoluir e expandir</text>
<rect x="146" y="192" width="228" height="134" rx="10" class="d-box-danger"/>
<text x="260" y="240" text-anchor="middle" class="d-title">Eliminar</text>
<text x="260" y="264" text-anchor="middle" class="d-small">pouco valor, frágil</text>
<text x="260" y="282" text-anchor="middle" class="d-small">aposentar e arquivar</text>
<rect x="386" y="192" width="228" height="134" rx="10" class="d-box-info"/>
<text x="500" y="240" text-anchor="middle" class="d-title">Tolerar</text>
<text x="500" y="264" text-anchor="middle" class="d-small">saudável, pouco valor</text>
<text x="500" y="282" text-anchor="middle" class="d-small">manter, gasto mínimo</text>
<line x1="130" y1="338" x2="640" y2="338" class="d-line" marker-end="url(#port-d2-arrow)"/>
<line x1="130" y1="338" x2="130" y2="36" class="d-line" marker-end="url(#port-d2-arrow)"/>
<text x="380" y="370" text-anchor="middle" class="d-label">SAÚDE TÉCNICA</text>
<text x="160" y="356" text-anchor="middle" class="d-small">baixa</text>
<text x="600" y="356" text-anchor="middle" class="d-small">alta</text>
<text x="92" y="190" text-anchor="middle" class="d-label" transform="rotate(-90 92 190)">VALOR DE NEGÓCIO</text>
<text x="118" y="322" text-anchor="end" class="d-small">baixo</text>
<text x="118" y="62" text-anchor="end" class="d-small">alto</text>
</svg>
</div>
<figcaption>Figura 2: O modelo TIME, valor de negócio versus saúde técnica</figcaption>
</figure>

- **Tolerar** (saudável, mas de pouco valor): funciona e não atrapalha, mas não é estratégica. Mantenha rodando com investimento mínimo e não adicione funcionalidades.
- **Investir** (valiosa e saudável): são as joias da coroa. Coloque dinheiro e gente aqui, evolua, transforme essas aplicações na plataforma pra onde as outras vão ser consolidadas.
- **Migrar** (valiosa, mas tecnicamente frágil): o negócio depende dela, mas ela está numa stack sem suporte, cheia de incidentes ou impossível de mudar. Modernize ou substitua, com cuidado.
- **Eliminar** (pouco valor e saúde ruim): as vitórias fáceis. Planeje a aposentadoria, arquive o que precisa ser guardado e desligue.

<div class="callout tip">
  <p>A matriz é um ponto de partida pra conversa, não um veredito. Uma aplicação em <strong>Eliminar</strong> pode guardar dados que você é obrigado por lei a manter por dez anos. Uma aplicação em <strong>Tolerar</strong> pode ser a única integrada a um parceiro-chave. Use o quadrante pra priorizar a discussão e depois valide cada caso com os donos.</p>
</div>

### Lidando com a redundância

A redundância merece um olhar à parte. Quando várias aplicações atendem a mesma capacidade, você compara lado a lado, com as mesmas notas, e escolhe um **alvo**: normalmente aquela que está em **Investir** (ou mais perto dele). As outras viram candidatas à consolidação. Voltando aos nossos três CRMs: se o do Comercial é saudável, bem integrado e tem mais usuários, ele vira o alvo, e os outros dois ganham um plano de migração com datas.

Cuidado com uma armadilha: o "vencedor" nem sempre é o sistema mais elegante tecnicamente. É aquele que melhor equilibra aderência ao negócio, saúde, custo e o esforço de trazer todo mundo pra dentro dele.

## Etapa 3: Entenda o custo real

Decidir consolidar ou aposentar é, no fim das contas, uma decisão financeira, então você precisa de números. E o preço da licença costuma ser a menor parte da história. O número que importa é o **custo total de propriedade**, o famoso ***TCO*** (*Total Cost of Ownership*).

| Categoria de custo | O que o pessoal esquece |
|--------------------|-------------------------|
| **Licenças e assinaturas** | Renovações automáticas, licenças sem uso, planos *premium* que ninguém precisa, compromissos mínimos |
| **Infraestrutura** | Servidores, armazenamento, backup, recuperação de desastres, rede, agentes de monitoramento |
| **Integrações** | *Middleware*, conectores customizados, o tempo gasto consertando interfaces quebradas a cada mudança |
| **Pessoas** | Suporte, manutenção, administradores, aquele especialista que é o único que entende o sistema |
| **Segurança e conformidade** | Auditorias extras, controles compensatórios pra software sem suporte, exceções de risco |
| **Custo de oportunidade** | Orçamento e atenção que poderiam ir pra novas capacidades em vez de manter as antigas vivas |

A linha de **pessoas** é a que mais surpreende os executivos. Uma ferramenta *open source* "gratuita" que exige dois engenheiros pra se manter de pé não é gratuita. Um sistema antigo que só uma pessoa entende tem um custo que não dá pra medir em reais até o dia em que essa pessoa pede demissão.

Se você já pratica **FinOps** no lado da nuvem, aproveite: *tags*, *showback* e alocação de custos são exatamente os dados de que você precisa pra atribuir um custo a cada aplicação. A gente falou disso em [Otimização de Custos](/pt-br/principles/cloud/cost-optimization/).

**Benefício:** com o TCO por aplicação, o portfólio deixa de ser uma lista de nomes e vira uma lista de investimentos, cada um com um preço e um retorno. Essa é a língua que o negócio entende.

## Etapa 4: Decida o caminho de cada aplicação

O TIME mostra a direção. Pras aplicações que vão se mover, ainda falta decidir **como**. O vocabulário mais usado aqui veio da migração pra nuvem: os **Rs da migração**. Começou com cinco, a AWS expandiu pra seis e depois pra sete, e a lista funciona muito bem também fora de projetos de nuvem.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 740 290" role="img" aria-labelledby="port-d3-title port-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="port-d3-title">Os 7 Rs da migração</title>
<desc id="port-d3-desc">Sete estratégias ordenadas de menos para mais mudança: retain, retire, relocate, rehost, replatform, repurchase e refactor. Esforço, custo e risco crescem da esquerda para a direita.</desc>
<defs><marker id="port-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-accent"/></marker></defs>
<text x="370" y="32" text-anchor="middle" class="d-label">OS 7 RS, DE MENOS PARA MAIS MUDANÇA</text>
<rect x="16" y="64" width="96" height="100" rx="10" class="d-box-muted"/>
<text x="64" y="100" text-anchor="middle" class="d-title">Retain</text>
<text x="64" y="124" text-anchor="middle" class="d-small">manter igual</text>
<text x="64" y="142" text-anchor="middle" class="d-small">rever depois</text>
<rect x="118" y="64" width="96" height="100" rx="10" class="d-box-danger"/>
<text x="166" y="100" text-anchor="middle" class="d-title">Retire</text>
<text x="166" y="124" text-anchor="middle" class="d-small">desligar</text>
<text x="166" y="142" text-anchor="middle" class="d-small">guardar dados</text>
<rect x="220" y="64" width="96" height="100" rx="10" class="d-box-info"/>
<text x="268" y="100" text-anchor="middle" class="d-title">Relocate</text>
<text x="268" y="124" text-anchor="middle" class="d-small">mover as VMs</text>
<text x="268" y="142" text-anchor="middle" class="d-small">sem mudanças</text>
<rect x="322" y="64" width="96" height="100" rx="10" class="d-box-info"/>
<text x="370" y="100" text-anchor="middle" class="d-title">Rehost</text>
<text x="370" y="124" text-anchor="middle" class="d-small">lift and shift</text>
<text x="370" y="142" text-anchor="middle" class="d-small">nova infra</text>
<rect x="424" y="64" width="96" height="100" rx="10" class="d-box-info"/>
<text x="472" y="100" text-anchor="middle" class="d-title">Replatform</text>
<text x="472" y="124" text-anchor="middle" class="d-small">ajustes leves</text>
<text x="472" y="142" text-anchor="middle" class="d-small">DB gerenciado</text>
<rect x="526" y="64" width="96" height="100" rx="10" class="d-box-warn"/>
<text x="574" y="100" text-anchor="middle" class="d-title">Repurchase</text>
<text x="574" y="124" text-anchor="middle" class="d-small">ir para SaaS</text>
<text x="574" y="142" text-anchor="middle" class="d-small">sai o custom</text>
<rect x="628" y="64" width="96" height="100" rx="10" class="d-box-accent"/>
<text x="676" y="100" text-anchor="middle" class="d-title">Refactor</text>
<text x="676" y="124" text-anchor="middle" class="d-small">rearquitetar</text>
<text x="676" y="142" text-anchor="middle" class="d-small">cloud native</text>
<line x1="24" y1="206" x2="716" y2="206" class="d-line-accent" marker-end="url(#port-d3-arrow)"/>
<text x="24" y="232" class="d-small">menos</text>
<text x="716" y="232" text-anchor="end" class="d-small">mais</text>
<text x="370" y="232" text-anchor="middle" class="d-label">ESFORÇO, CUSTO E RISCO</text>
<text x="370" y="262" text-anchor="middle" class="d-small">mais mudança também significa mais benefício potencial</text>
</svg>
</div>
<figcaption>Figura 3: Os 7 Rs, um vocabulário comum pro destino de cada aplicação</figcaption>
</figure>

| Estratégia | O que significa | Quando faz sentido |
|------------|-----------------|--------------------|
| ***Retire*** | Desligar e arquivar o que precisa ser guardado | Pouco valor, redundante ou ninguém usa mais |
| ***Retain*** | Deixar como está, por enquanto | Atualizado recentemente, arriscado demais pra mexer este ano ou aguardando uma dependência |
| ***Relocate*** | Mover a plataforma inteira pra outro host sem alterá-la (ex.: um cluster VMware pra um serviço VMware na nuvem) | Saída de *data center* com prazo apertado |
| ***Rehost*** | *Lift and shift*: mesma aplicação, infraestrutura nova | Economia rápida de infraestrutura, primeiro passo antes de modernizar |
| ***Replatform*** | Mudanças pontuais, como trocar um banco autogerenciado por um gerenciado | Reduzir o peso operacional sem reescrever |
| ***Repurchase*** | Substituir por um produto, geralmente SaaS | Capacidade *commodity* (e-mail, RH, CRM) em que código próprio não traz vantagem |
| ***Refactor*** | Rearquitetar, muitas vezes em serviços *cloud native* | Alto valor, precisa de agilidade ou escala que o desenho atual não entrega |

Relacionar o TIME com os Rs é bem natural: **Eliminar** leva a *Retire*; **Tolerar** normalmente significa *Retain* (talvez *Rehost*, se o *data center* estiver fechando); **Migrar** leva a *Replatform*, *Repurchase* ou *Refactor*; **Investir** pode envolver *Refactor* pra destravar a próxima fase de crescimento.

<div class="callout warning">
  <p><strong>Retire e Repurchase são subestimados.</strong> Os times adoram refatorar porque é o trabalho mais interessante. Mas a linha de código mais barata de manter é a que não existe mais e, pra capacidades <em>commodity</em>, um bom produto muitas vezes ganha de um sistema próprio que você vai ter que manter pra sempre.</p>
</div>

Pra refatorar sistemas grandes e críticos, fuja da reescrita "big bang". O padrão ***Strangler Fig***, em que novas funcionalidades substituem o sistema antigo pedaço por pedaço por trás de uma interface estável, permite entregar valor cedo e manter o rollback possível. A gente aprofunda essa mentalidade em [Design Evolutivo](/pt-br/principles/solution/evolutionary-design/).

## Etapa 5: Monte um roadmap de consolidação

Com uma decisão por aplicação, você precisa de um plano que caiba na capacidade real da organização. Um roadmap que tenta aposentar quarenta sistemas em um trimestre é lista de desejos, não plano.

### 1. Comece pelas vitórias rápidas

Assinaturas SaaS sem uso, servidores zumbis com tráfego zero, ferramentas duplicadas com meia dúzia de usuários. Elas constroem credibilidade, liberam orçamento pros movimentos mais difíceis e provam que o processo funciona.

**Benefício:** economia visível logo no começo compra o capital político de que você vai precisar nas consolidações difíceis.

### 2. Agrupe o trabalho em ondas

Organize o roadmap em **ondas**, agrupando aplicações que compartilham dependências, dados, usuários ou infraestrutura. Mover uma aplicação sem mover as integrações de que ela depende só troca o problema de lugar.

### 3. Respeite a ordem das dependências

Se três sistemas leem do banco antigo, você não pode desligar o banco antes de migrar os três. Desenhe o grafo de dependências (o atributo de integrações do inventário se paga aqui) e sequencie de acordo.

### 4. Respeite o calendário do negócio

Não migre o sistema de faturamento na última semana do ano fiscal. Não troque o PDV do varejo em dezembro. Todo negócio tem seus períodos sagrados, e o roadmap precisa contornar esses períodos.

### 5. Amarre cada movimento a um resultado mensurável

Cada onda deve ter um objetivo claro: licenças canceladas, servidores desligados, integrações removidas, incidentes reduzidos, horas economizadas. É assim que você prova valor e mantém o patrocínio. Esse é exatamente o elo descrito em [Alinhamento ao Negócio](/pt-br/principles/enterprise/business-alignment/).

### 6. Financie a transição

Consolidar custa dinheiro antes de economizar: operação em paralelo, migração de dados, treinamento, sobreposição de contratos. Coloque isso no *business case* desde o início. Um plano que assume economia desde o primeiro dia é cancelado na primeira revisão de orçamento.

## Etapa 6: Descomissione do jeito certo

Desligar um sistema parece a parte fácil. Não é. Um descomissionamento descuidado pode apagar dados que você era obrigado por lei a guardar, quebrar uma integração que ninguém documentou ou deixar os usuários na mão numa segunda-feira de manhã. Um bom descomissionamento é um pequeno projeto, com plano próprio.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 740 280" role="img" aria-labelledby="port-d4-title port-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="port-d4-title">Descomissionamento, passo a passo</title>
<desc id="port-d4-desc">Seis passos ao longo de uma linha do tempo: mapear dependências e donos, comunicar a mudança, congelar o sistema em modo somente leitura, arquivar e exportar os dados conforme as regras de retenção, desligar mantendo backups durante uma janela de rollback e, por fim, excluir dados, infraestrutura e contratos.</desc>
<defs><marker id="port-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="370" y="32" text-anchor="middle" class="d-label">DESCOMISSIONAMENTO, PASSO A PASSO</text>
<rect x="18" y="64" width="104" height="96" rx="10" class="d-box-info"/>
<text x="70" y="98" text-anchor="middle" class="d-title">Mapear</text>
<text x="70" y="122" text-anchor="middle" class="d-small">dependências</text>
<text x="70" y="140" text-anchor="middle" class="d-small">e donos</text>
<line x1="122" y1="112" x2="136" y2="112" class="d-line" marker-end="url(#port-d4-arrow)"/>
<rect x="138" y="64" width="104" height="96" rx="10" class="d-box"/>
<text x="190" y="98" text-anchor="middle" class="d-title">Comunicar</text>
<text x="190" y="122" text-anchor="middle" class="d-small">datas, quem,</text>
<text x="190" y="140" text-anchor="middle" class="d-small">o que muda</text>
<line x1="242" y1="112" x2="256" y2="112" class="d-line" marker-end="url(#port-d4-arrow)"/>
<rect x="258" y="64" width="104" height="96" rx="10" class="d-box"/>
<text x="310" y="98" text-anchor="middle" class="d-title">Congelar</text>
<text x="310" y="122" text-anchor="middle" class="d-small">só leitura</text>
<text x="310" y="140" text-anchor="middle" class="d-small">sem dado novo</text>
<line x1="362" y1="112" x2="376" y2="112" class="d-line" marker-end="url(#port-d4-arrow)"/>
<rect x="378" y="64" width="104" height="96" rx="10" class="d-box-accent"/>
<text x="430" y="98" text-anchor="middle" class="d-title">Arquivar</text>
<text x="430" y="122" text-anchor="middle" class="d-small">retenção</text>
<text x="430" y="140" text-anchor="middle" class="d-small">e exportação</text>
<line x1="482" y1="112" x2="496" y2="112" class="d-line" marker-end="url(#port-d4-arrow)"/>
<rect x="498" y="64" width="104" height="96" rx="10" class="d-box-warn"/>
<text x="550" y="98" text-anchor="middle" class="d-title">Desligar</text>
<text x="550" y="122" text-anchor="middle" class="d-small">scream test</text>
<text x="550" y="140" text-anchor="middle" class="d-small">guardar backup</text>
<line x1="602" y1="112" x2="616" y2="112" class="d-line" marker-end="url(#port-d4-arrow)"/>
<rect x="618" y="64" width="104" height="96" rx="10" class="d-box-danger"/>
<text x="670" y="98" text-anchor="middle" class="d-title">Excluir</text>
<text x="670" y="122" text-anchor="middle" class="d-small">dados, infra,</text>
<text x="670" y="140" text-anchor="middle" class="d-small">contratos</text>
<text x="70" y="188" text-anchor="middle" class="d-small">T-90 dias</text>
<text x="190" y="188" text-anchor="middle" class="d-small">T-60 dias</text>
<text x="310" y="188" text-anchor="middle" class="d-small">T-30 dias</text>
<text x="430" y="188" text-anchor="middle" class="d-small">T-15 dias</text>
<text x="550" y="188" text-anchor="middle" class="d-small">T-0</text>
<text x="670" y="188" text-anchor="middle" class="d-small">T+90 dias</text>
<line x1="550" y1="214" x2="670" y2="214" class="d-line-dashed"/>
<line x1="550" y1="206" x2="550" y2="222" class="d-line-dashed"/>
<line x1="670" y1="206" x2="670" y2="222" class="d-line-dashed"/>
<text x="610" y="242" text-anchor="middle" class="d-small">janela de rollback</text>
</svg>
</div>
<figcaption>Figura 4: Descomissionar é um pequeno projeto, com cronograma e caminho de volta</figcaption>
</figure>

O cronograma é ilustrativo: uma ferramenta interna pequena pode passar por ele em poucas semanas, enquanto um sistema central pode levar um ano. O que importa é que cada passo exista.

### 1. Mapeie dependências e donos

Antes de qualquer coisa, descubra quem usa o sistema e o que conversa com ele. Logs de fluxo de rede, logs de conexão do banco, métricas do *API gateway* e agendadores de jobs contam o que a documentação não conta. Confirme formalmente que o dono de negócio concorda com a aposentadoria.

### 2. Comunique cedo e com clareza

Conte pros usuários o que vai mudar, quando, por quê e pra onde eles devem ir. Repita. Depois repita de novo, mais perto da data. O silêncio é o jeito mais rápido de transformar uma decisão técnica numa crise política.

### 3. Congele antes de remover

Coloque o sistema em modo **somente leitura** primeiro. As pessoas ainda conseguem consultar o histórico, mas nada novo entra. Isso revela os "escritores escondidos" (aquele job noturno que ninguém conhecia) sem perder nada.

### 4. Respeite a retenção de dados

Esse ponto é inegociável. Registros fiscais, trabalhistas, de saúde e financeiros costumam ter prazos legais de guarda, e leis de privacidade como a **LGPD** e o **GDPR** exigem que você elimine dados pessoais que não tem mais base legal pra manter. Decida, junto com o jurídico e o time de conformidade, o que vai ser arquivado (em formato acessível e documentado), o que vai ser migrado e o que vai ser excluído.

### 5. Desligue com caminho de volta

Desligue, mas mantenha os backups e a capacidade de restaurar por uma janela combinada. É aqui que mora o famoso ***scream test***: você desliga o sistema e vê quem grita. Feito de qualquer jeito, é irresponsável. Feito com plano de rollback, depois da comunicação e da fase de somente leitura, é uma verificação final perfeitamente legítima pra pegar aquela última dependência que ninguém documentou.

### 6. Termine o serviço

Exclua a infraestrutura, revogue as credenciais e contas de serviço, remova as entradas de DNS e as regras de firewall, cancele contratos e licenças e atualize a CMDB. Um descomissionamento que deixa a licença renovando e os snapshots da VM esquecidos por aí não terminou; só ficou escondido.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Pera, então era só eu ter puxado o cabo do SRV-APP-07 e esperado pra ver quem ligava? Por que ninguém fez isso?"</span>
    </div>
  </div>
</div>

Porque puxar o cabo sem os passos anteriores é como as pessoas perdem o emprego, Júnior! Se aquele servidor alimentar o relatório regulatório e os dados dele nunca tiverem sido arquivados, você não ganha um grito, ganha uma multa. O *scream test* é o **último** passo de um processo cuidadoso, não um substituto pra ele. Mapeie, comunique, congele, arquive e só então desligue, com o backup pronto pra voltar.

## Mantenha o portfólio enxuto, continuamente

O maior erro é tratar a racionalização como um projeto que termina. Você limpa o portfólio, comemora a economia e, dois anos depois, está de volta com quatro CRMs. A entropia sempre vence, a não ser que exista um mecanismo empurrando no sentido contrário.

### 1. Coloque um portão na entrada

Toda aplicação nova, seja desenvolvida, comprada ou assinada, passa por uma revisão leve de entrada: já existe um sistema com essa capacidade? Quem vai ser o dono? Onde os dados vão morar? Esse é um dos controles mais valiosos da [Governança](/pt-br/principles/enterprise/governance/), desde que seja rápido. Um portão que leva três meses só cria mais *shadow IT*.

### 2. Defina padrões por capacidade

Quando a empresa tem um padrão claro pra CRM, pra BI, pra mensageria, as pessoas têm uma escolha padrão e não precisam reinventar a decisão. Esse é o coração da [Padronização](/pt-br/principles/enterprise/standardization/).

### 3. Dê um ciclo de vida a cada aplicação

Cada aplicação deve ter um estado declarado (emergente, estratégica, tolerada, em desativação, aposentada) e, pras que estão em desativação, uma data. As datas de fim de suporte dos fornecedores entram no calendário com anos de antecedência, em vez de serem descobertas no meio de um incidente.

### 4. Revise com ritmo

Revisite notas e custos pelo menos uma vez por ano, e sempre que houver um gatilho importante: uma aquisição, uma saída de *data center*, uma renovação de contrato grande, uma mudança de estratégia. As renovações de contrato são o momento perfeito: "a gente ainda precisa disso?" deve ser perguntado antes de assinar, não depois.

### 5. Acompanhe métricas de saúde do portfólio

| Métrica | O que ela mostra |
|---------|------------------|
| **Número de aplicações por capacidade** | A tendência de redundância ao longo do tempo |
| **Percentual de aplicações com dono nomeado** | Se a responsabilização é real |
| **Fatia do orçamento em "manter" vs "mudar"** | Quanto espaço sobra pra inovação |
| **Aplicações em tecnologia sem suporte** | O risco técnico e de segurança acumulado |
| **Aposentadorias concluídas vs planejadas** | Se o roadmap está de fato sendo executado |

**Benefício:** o portfólio se mantém alinhado ao negócio por construção, e a racionalização vira rotina em vez de um exercício doloroso a cada cinco anos.

## Tradeoffs

A **racionalização do portfólio** libera orçamento, reduz risco e simplifica o cenário. Mas, como todo princípio, ela traz custos e conflitos que precisam ser gerenciados de forma consciente.

### Risco da consolidação versus economia

Toda consolidação concentra. Três CRMs viram um, o que significa que uma falha agora afeta todo mundo, um fornecedor passa a ter mais poder de barganha sobre você e uma atualização ruim atinge a empresa inteira. A economia é real, mas o *blast radius* maior também. Equilibre com práticas fortes de confiabilidade na plataforma alvo (veja [Confiabilidade](/pt-br/principles/cloud/reliability/)) e cláusulas de saída claras nos contratos. Às vezes manter dois sistemas pra necessidades genuinamente diferentes é a decisão certa.

### Impacto nos usuários

Uma migração que é vitória na planilha pode ser derrota na ponta. As pessoas perdem funcionalidades de que dependiam, os fluxos mudam, a produtividade cai durante a transição. Subestime isso e você vai ver os usuários reconstruindo o sistema antigo em planilhas, em silêncio, o que nada mais é do que um novo *shadow IT*. Invista em gestão da mudança, treinamento e análise de lacunas de funcionalidade antes de escolher o alvo.

### Custo e tempo de migração

A consolidação se paga ao longo de anos, mas cobra adiantado: operação em paralelo, migração de dados, retrabalho de integrações, sobreposição de contratos e o tempo do time. Algumas migrações nunca se pagam, principalmente as de sistemas perto do fim natural da vida. Nesses casos, a resposta honesta é *Retain* até a aposentadoria, não uma migração cara só pela arrumação.

### Tradeoffs com Segurança (Security)

Aposentar sistemas sem suporte é uma grande vitória de segurança, mas a própria migração abre riscos: dados copiados pra locais temporários, credenciais extras criadas pra transição, arquivos que precisam de proteção por anos. Trate os ambientes de migração e de arquivo com o mesmo rigor da produção. Veja [Segurança](/pt-br/principles/cloud/security/).

### Tradeoffs com Excelência Operacional (Operational Excellence)

Um programa de racionalização adiciona trabalho a times que já estão ocupados: atualização do inventário, sessões de pontuação, ondas de migração, checklists de descomissionamento. Sem automação (*discovery*, *tags*, alocação de custos), vira burocracia que as pessoas contornam. Por outro lado, um portfólio mais enxuto significa menos coisas pra aplicar patch, monitorar e dar suporte, que é exatamente o que a [Excelência Operacional](/pt-br/principles/cloud/operational-excellence/) pede.

### Tradeoffs com a agilidade do negócio

Padrões rígidos e portões de entrada pesados reduzem a redundância, mas podem frear times que precisam experimentar. Um pouco de duplicação controlada, como o piloto de uma ferramenta nova ao lado do padrão, pode ser o preço do aprendizado. O segredo é torná-la temporária e visível, com data de término e uma decisão no final.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Então consolidar pode economizar, mas também concentrar risco, irritar os usuários e custar uma fortuna logo de cara? Como eu sei se vale a pena?"</span>
    </div>
  </div>
</div>

Essa é exatamente a pergunta certa, Júnior! Você sabe se vale a pena colocando tudo na mesma mesa: o TCO de hoje, o TCO depois, o custo da migração, o risco concentrado e o risco eliminado, e o impacto nos usuários. Quando os números e os donos concordam, você avança. Quando não concordam, você documenta a decisão e revisita mais tarde. Esse é o trabalho, e ele é sempre feito junto com o negócio, nunca pelas costas dele. É também por isso que este princípio anda de mãos dadas com a [Gestão de Riscos](/pt-br/principles/enterprise/risk-management/).

## Conclusão

A **racionalização do portfólio** é a disciplina de manter honesto o cenário de aplicações de uma organização. Ela começa por **saber o que você tem** (um inventário real, cruzando a CMDB com *discovery*, SSO e dados financeiros), continua com **uma avaliação justa** (valor de negócio versus saúde técnica, o modelo TIME, o TCO real) e termina com **ação** (os 7 Rs, as ondas de consolidação e um descomissionamento cuidadoso).

Aquele servidor esquecido que ninguém sabe de quem é e ninguém tem coragem de desligar não é um problema técnico. É o sintoma visível de um portfólio que ninguém gerencia. Resolver um servidor de cada vez ajuda; criar o hábito que evita o próximo é o que realmente muda o jogo.

**Mais importante:** racionalizar não é ter menos sistemas só por ter. É ter **os sistemas certos**, com dono, bem mantidos e pagos de forma consciente, pra que o orçamento e o talento da organização vão pro que realmente faz o negócio avançar.

## Próximos Passos

1. **Monte um primeiro inventário**
Comece pela CMDB e depois cruze com os inventários de nuvem, os logs de SSO e os dados financeiros. Mire em "bom o suficiente pra decidir", não em perfeito.

2. **Dê um dono a cada aplicação**
Sem dono, sem decisão. Aplicações sem dono de negócio são as primeiras candidatas à revisão.

3. **Mapeie aplicações para capacidades de negócio**
Use o mapa pra expor a redundância. Escolha uma capacidade com duplicação óbvia como piloto.

4. **Pontue valor, saúde e custo**
Faça sessões curtas de pontuação com os donos de negócio e técnicos, estime o TCO e monte a matriz TIME.

5. **Entregue vitórias rápidas e depois planeje as ondas**
Aposente os zumbis e cancele as licenças sem uso primeiro. Use a economia e a credibilidade pra financiar as consolidações mais difíceis.

6. **Institucionalize o ciclo**
Crie um portão de entrada pra novas aplicações, estados de ciclo de vida com datas, uma revisão anual e algumas métricas de saúde do portfólio.

<div class="callout info" data-title="Referências">
  <ul>
    <li><a href="https://www.opengroup.org/togaf" target="_blank" rel="noopener">The Open Group: TOGAF Standard</a></li>
    <li><a href="https://aws.amazon.com/blogs/enterprise-strategy/6-strategies-for-migrating-applications-to-the-cloud/" target="_blank" rel="noopener">AWS: 6 Strategies for Migrating Applications to the Cloud</a></li>
    <li><a href="https://learn.microsoft.com/azure/cloud-adoption-framework/" target="_blank" rel="noopener">Microsoft Cloud Adoption Framework for Azure</a></li>
    <li><a href="https://martinfowler.com/bliki/StranglerFigApplication.html" target="_blank" rel="noopener">Martin Fowler: Strangler Fig Application</a></li>
    <li><a href="https://www.finops.org/" target="_blank" rel="noopener">FinOps Foundation</a></li>
    <li><a href="https://learn.microsoft.com/azure/well-architected/" target="_blank" rel="noopener">Microsoft Azure Well-Architected Framework</a></li>
  </ul>
</div>
