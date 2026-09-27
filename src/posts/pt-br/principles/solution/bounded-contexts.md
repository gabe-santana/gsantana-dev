---
title: Contextos delimitados
short: Um modelo único para tudo parece ótimo até "Cliente" significar cinco coisas diferentes. Desenhe as fronteiras antes que elas desenhem você.
category: solution
---

## Introdução

Todo sistema começa pequeno e honesto. Tem uma tabela `Pedido`, uma tabela `Cliente`, alguns serviços conversando entre si, e todo mundo na sala quer dizer a mesma coisa quando fala "pedido". Aí a empresa cresce, chegam novos times, o comercial quer uma coisa, o financeiro quer outra, a logística quer uma terceira, e aquela inocente tabela `Cliente` termina com 80 colunas, metade delas anuláveis, e um comentário no topo dizendo "não mexa, fale com o Carlos".

Os **Contextos Delimitados** (*Bounded Contexts*) são a resposta que o Domain-Driven Design (DDD) dá para essa bagunça. A **meta** deste princípio é simples de falar e difícil de praticar: **dividir um domínio grande em modelos menores, cada um com uma fronteira clara, sua própria linguagem e seu próprio dono**, e tornar explícitas as relações entre esses modelos, em vez de deixá-las acontecer por acidente.

Quando um time ignora este princípio, os sintomas aparecem mais cedo do que qualquer um espera:

- A mesma palavra significa coisas diferentes em reuniões diferentes, e ninguém percebe até um bug chegar em produção;
- Um único modelo "canônico" tenta atender todos os departamentos e acaba não atendendo nenhum direito;
- Toda mudança em uma área quebra alguma coisa em outra área da qual ninguém do time nunca ouviu falar;
- Os times ficam esperando uns pelos outros a cada release, porque tudo encosta em tudo;
- Microsserviços que compartilham um banco de dados e precisam ser implantados juntos (o famoso monólito distribuído);
- Integrações com sistemas legados vazam nomes esquisitos e regras estranhas para dentro de código novinho;

Pois é, *é raro, mas acontece bastante*... Quem nunca abriu uma classe chamada `ClienteHelperManagerService` e sentiu um pedacinho da alma ir embora?

<div class="callout info">
  <p>Contextos delimitados não são uma tecnologia, um framework nem uma unidade de deploy. Eles são uma <strong>decisão de modelagem</strong>: onde um modelo termina e outro começa. Serviços, bancos de dados e times podem (e muitas vezes devem) seguir essas linhas, mas a fronteira vem primeiro.</p>
</div>

## Linguagem Ubíqua: a palavra é o design

Antes de falar de fronteiras, precisamos falar de linguagem. Eric Evans, autor do livro original de DDD, chamou isso de **Linguagem Ubíqua** (*Ubiquitous Language*): um vocabulário compartilhado e rigoroso, usado tanto pelos especialistas de negócio quanto pelos desenvolvedores, nas conversas, nos documentos, nos testes e, acima de tudo, no código.

Se o negócio diz "a apólice foi *reativada*" e o código diz `setStatus(3)`, existe uma camada de tradução morando na cabeça das pessoas. Cada tradução é uma chance de mal-entendido, e mal-entendido compila numa boa.

Uma linguagem ubíqua saudável tem algumas características:

- **Ela vive no código.** Nomes de classes, métodos, eventos e campos de API usam os termos do negócio, não aproximações técnicas;
- **Ela é precisa.** "Cliente ativo" tem uma definição que todo mundo consegue repetir, não uma sensação;
- **Ela evolui.** Quando uma conversa com um especialista revela um termo melhor, o código é renomeado. Refatorar a linguagem é refatorar o design;
- **Ela tem fronteira.** E essa é a parte-chave: uma linguagem ubíqua só é ubíqua *dentro de um contexto*.

### O problema do "Cliente significa cinco coisas diferentes"

Pergunte a cinco departamentos o que é um "cliente" e você vai receber cinco respostas honestas, corretas e incompatíveis.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 330" role="img" aria-labelledby="bc-d1-title bc-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="bc-d1-title">Uma palavra, cinco modelos</title>
<desc id="bc-d1-desc">A palavra Cliente fica no centro, ligada a cinco contextos: Vendas vê um lead no funil, Faturamento vê quem paga a fatura, Entrega vê um nome e um endereço, Suporte vê quem abriu o chamado e Marketing vê um membro de segmento.</desc>
<text x="360" y="22" text-anchor="middle" class="d-label">UMA PALAVRA, CINCO MODELOS</text>
<rect x="280" y="110" width="160" height="60" rx="10" class="d-box-warn"/>
<text x="360" y="136" text-anchor="middle" class="d-title">Cliente</text>
<text x="360" y="156" text-anchor="middle" class="d-small">uma tabela, 80 colunas</text>
<line x1="280" y1="125" x2="230" y2="80" class="d-line-dashed"/>
<line x1="440" y1="125" x2="490" y2="80" class="d-line-dashed"/>
<line x1="280" y1="155" x2="230" y2="215" class="d-line-dashed"/>
<line x1="440" y1="155" x2="490" y2="215" class="d-line-dashed"/>
<line x1="360" y1="170" x2="360" y2="240" class="d-line-dashed"/>
<rect x="30" y="35" width="200" height="70" rx="10" class="d-box-accent"/>
<text x="130" y="64" text-anchor="middle" class="d-title">Vendas</text>
<text x="130" y="86" text-anchor="middle" class="d-small">um lead no funil</text>
<rect x="490" y="35" width="200" height="70" rx="10" class="d-box-info"/>
<text x="590" y="64" text-anchor="middle" class="d-title">Faturamento</text>
<text x="590" y="86" text-anchor="middle" class="d-small">quem paga a fatura</text>
<rect x="30" y="190" width="200" height="70" rx="10" class="d-box-info"/>
<text x="130" y="219" text-anchor="middle" class="d-title">Entrega</text>
<text x="130" y="241" text-anchor="middle" class="d-small">um nome e um endereço</text>
<rect x="490" y="190" width="200" height="70" rx="10" class="d-box-info"/>
<text x="590" y="219" text-anchor="middle" class="d-title">Suporte</text>
<text x="590" y="241" text-anchor="middle" class="d-small">quem abriu o chamado</text>
<rect x="260" y="240" width="200" height="70" rx="10" class="d-box"/>
<text x="360" y="269" text-anchor="middle" class="d-title">Marketing</text>
<text x="360" y="291" text-anchor="middle" class="d-small">um membro de segmento</text>
</svg>
</div>
<figcaption>Figura 1: A mesma palavra, cinco significados legítimos</figcaption>
</figure>

- Para **Vendas**, cliente é um lead com uma etapa no funil, um responsável e uma probabilidade de fechar;
- Para **Faturamento**, cliente é quem responde legalmente pelo pagamento: CNPJ ou CPF, forma de pagamento, endereço de cobrança, limite de crédito;
- Para **Entrega**, o "cliente" quase nem existe. O que importa é o destinatário: um nome, um endereço, uma janela de entrega;
- Para **Suporte**, cliente é quem abriu o chamado, com um plano, um SLA e um histórico de reclamações;
- Para **Marketing**, cliente é um membro de um segmento, com flags de consentimento (olá, LGPD) e histórico de campanhas.

O erro clássico é olhar para isso e dizer "beleza, vamos criar uma única entidade `Cliente` que cubra tudo". É assim que nascem a tabela de 80 colunas, a flag `isLead`, o campo `enderecoEntrega2Antigo` e aquela reunião em que três times discutem se `status = 'ATIVO'` quer dizer "pagou este mês" ou "fez login este mês".

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Mas isso não é duplicação? E o DRY? Se a gente tiver cinco classes Cliente, estamos nos repetindo cinco vezes!"</span>
    </div>
  </div>
</div>

Calma aí, Júnior! O DRY fala de não duplicar **conhecimento**, não de nunca ter duas classes com o mesmo nome. O destinatário da entrega e o pagador do faturamento são *conceitos diferentes* que por acaso dividem uma palavra. Forçar os dois numa classe só não remove duplicação, cria **acoplamento**: agora toda mudança nas regras de faturamento precisa ser negociada com a entrega, e vice-versa.

A resposta do DDD é: cada contexto tem o seu próprio modelo de "cliente", moldado exatamente para o seu trabalho, e os contextos compartilham apenas um identificador (um `clienteId`) e os fatos que combinarem explicitamente de trocar. Cinco modelos pequenos e afiados ganham de um modelo grande e borrado.

## Subdomínios: onde colocar seus melhores profissionais

Um **domínio** é a área de negócio que o seu software atende. Domínios grandes são formados por **subdomínios**, e nem todos têm a mesma importância. O DDD os classifica em três tipos, e essa classificação deveria guiar onde você investe.

| Tipo | O que é | Como tratar |
| :--- | :--- | :--- |
| **Core (principal)** | O que diferencia o negócio da concorrência. O motivo pelo qual os clientes escolhem você. | Construa internamente, com as melhores pessoas, modelos de domínio ricos e refinamento constante. É aqui que o DDD mais se paga. |
| **De suporte** | Necessário e um pouco específico do seu negócio, mas não é diferencial. | Construa, mas mantenha simples. Um CRUD muitas vezes resolve. Considere terceirizar. |
| **Genérico** | Problemas que toda empresa tem e que já estão resolvidos: identidade, e-mail, pagamentos, contabilidade. | Compre, use um SaaS ou uma solução *open source*. Não reinvente autenticação. |

Para um e-commerce que compete com precificação dinâmica, **Precificação** é *core*. **Gestão de pedidos** talvez seja *core* também. **Entrega** é de suporte (precisa funcionar bem, mas não é por isso que as pessoas compram de você). **Identidade** e **pagamentos** são genéricos: use um provedor consolidado e siga em frente.

<div class="callout tip">
  <p>Um teste rápido: se um concorrente copiasse esse subdomínio amanhã, doeria? Se a resposta for "não muito", ele não é <em>core</em>. Times adoram tratar tudo como <em>core</em>, porque é lá que moram os problemas interessantes. Resista. Colocar seus melhores engenheiros num sistema de login caseiro é um erro estratégico, não técnico.</p>
</div>

Subdomínios pertencem ao **espaço do problema** (como o negócio se organiza). Contextos delimitados pertencem ao **espaço da solução** (como modelamos e construímos). O ideal é que batam um para um, mas na vida real um sistema legado pode cobrir três subdomínios, ou um único subdomínio pode precisar de dois contextos. Conhecer a diferença ajuda a conversar sobre essa distância.

## Contextos Delimitados: traçando as linhas

Um **contexto delimitado** é uma fronteira explícita dentro da qual um determinado modelo se aplica e uma determinada linguagem ubíqua é consistente. Dentro da fronteira, "Pedido" significa exatamente uma coisa. Fora dela, pode significar outra, e tudo bem.

Na prática, um contexto delimitado costuma vir com:

- **Modelo próprio:** entidades, *value objects*, agregados e regras, desenhados apenas para aquele contexto;
- **Linguagem própria:** termos documentados, de preferência num glossário pequeno que mora no repositório;
- **Dados próprios:** um banco, ou pelo menos um *schema*, em que só esse contexto escreve;
- **Time próprio:** um time é dono dele de ponta a ponta. Um time pode ter vários contextos, mas um contexto não deveria ter vários times donos;
- **Interface explícita:** uma API, eventos ou um contrato publicado. Ninguém mete a mão nas entranhas dele.

### Encontrando as fronteiras

Não existe algoritmo que cuspa contextos perfeitos, mas existem bons sinais:

#### 1. A linguagem muda

Quando a mesma palavra começa a significar outra coisa, ou quando os especialistas passam a usar outro vocabulário, você provavelmente está cruzando uma fronteira. Fique atento a frases como "bom, para a gente um pedido só vira pedido depois de pago".

#### 2. Ritmos de mudança diferentes

As regras de precificação mudam toda semana; o motor fiscal muda uma vez por ano, quando a lei muda. Partes que mudam em velocidades diferentes e por motivos diferentes querem morar separadas.

#### 3. Especialistas diferentes

Se as pessoas com quem você precisa conversar para entender uma área são outras pessoas, isso é uma pista forte. O financeiro não quer saber como o armazém separa os itens, e o armazém não quer saber de reconhecimento de receita.

#### 4. Necessidades de consistência

Coisas que precisam ser consistentes na mesma transação geralmente ficam juntas. Coisas que toleram alguns segundos (ou minutos) de atraso podem ser separadas e integradas por eventos.

#### 5. Capacidades de negócio

Capacidades como "receber pedidos", "faturar clientes" e "entregar pacotes" são mais estáveis que organogramas e muito mais estáveis que tecnologia. São um bom primeiro corte.

**Meta:** cada contexto deve ser pequeno o bastante para ser entendido por um time e coeso o bastante para que a maioria das mudanças fique dentro dele.

**Benefício:** os times podem mudar o seu modelo livremente, sem pedir permissão para a empresa inteira, desde que respeitem os contratos publicados.

## Event Storming: descobrindo fronteiras em conjunto

Desenhar contextos sozinho numa sala de reunião é receita para um diagrama lindo com o qual ninguém concorda. O **Event Storming**, criado por Alberto Brandolini, é um formato de *workshop* que coloca desenvolvedores e especialistas de negócio na frente de uma parede enorme (ou de um quadro virtual) para mapear o negócio como uma sequência de **eventos de domínio**.

O fluxo básico é mais ou menos assim:

1. **Exploração caótica:** todo mundo escreve eventos de domínio em post-its laranja, no passado: "Pedido Realizado", "Pagamento Autorizado", "Pacote Enviado", "Reembolso Solicitado". Nada de discussão ainda, só volume;
2. **Imponha a linha do tempo:** coloque os eventos em ordem cronológica. Duplicatas e contradições aparecem, e é justamente essa a ideia;
3. **Pontos quentes:** marque as áreas de confusão, discordância ou dor com post-its rosa-choque. Isso é ouro: mostra onde a linguagem está quebrada;
4. **Comandos e atores:** adicione o que dispara cada evento (azul para comandos, amarelo pequeno para atores ou papéis);
5. **Políticas e sistemas externos:** regras do tipo "sempre que X acontecer, faça Y" e os sistemas dos quais você depende;
6. **Encontre as fronteiras:** procure grupos de eventos que usam a mesma linguagem e pertencem às mesmas pessoas. Trace linhas ao redor deles. Esses são seus contextos delimitados candidatos.

A mágica do Event Storming não está nos post-its. Está em ver alguém de vendas e alguém do financeiro discutirem por dez minutos o que significa "Pedido Confirmado" e perceber que você acabou de encontrar uma fronteira de contexto de graça.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Então... cada contexto delimitado é um microsserviço, né? A gente faz o workshop, desenha oito bolinhas e amanhã cria oito repositórios e oito bancos!"</span>
    </div>
  </div>
</div>

Segura aí, Júnior! Esse é exatamente o erro que cria os sistemas mais caros da indústria. Já chegamos lá, ele merece uma seção só dele.

## Mapeamento de Contextos: as relações importam tanto quanto as caixas

Contextos não vivem sozinhos. Pedidos precisam de preços, o faturamento precisa dos pedidos, a entrega precisa de endereços. Um **mapa de contextos** (*context map*) deixa essas relações explícitas: quem depende de quem, quem tem poder para mudar o contrato e como os modelos são traduzidos na fronteira.

Estes são os padrões clássicos:

| Padrão | O que significa | Quando usar |
| :--- | :--- | :--- |
| **Parceria** (*Partnership*) | Dois times têm sucesso ou fracassam juntos e coordenam as mudanças de perto. | Dois contextos *core* que evoluem juntos, com times que conversam todo dia. |
| **Núcleo Compartilhado** (*Shared Kernel*) | Dois contextos compartilham um pedaço pequeno e bem definido de modelo ou código. | Um subconjunto minúsculo e estável (como um *value object* `Dinheiro` ou `Endereco`). Mantenha mínimo; mudanças exigem aprovação dos dois times. |
| **Cliente/Fornecedor** (*Customer/Supplier*) | O *upstream* (fornecedor) atende o *downstream* (cliente), e as necessidades do *downstream* influenciam o roadmap do *upstream*. | A maioria das integrações internas. O time *downstream* tem voz no planejamento. |
| **Conformista** (*Conformist*) | O *downstream* simplesmente adota o modelo do *upstream*, sem tradução. | O *upstream* não vai mudar por você (um grande fornecedor, um time poderoso) e o modelo dele é bom o suficiente. |
| **Camada Anticorrupção** (*ACL*) | O *downstream* constrói uma camada de tradução para proteger o seu modelo do modelo do *upstream*. | Sistemas legados, APIs externas com modelos ruins, qualquer coisa que você não queira vazando para o seu *core*. |
| **Serviço de Host Aberto** (*Open Host Service*) | O *upstream* expõe um protocolo bem definido para muitos consumidores. | Um contexto usado por muitos outros, como identidade ou catálogo. |
| **Linguagem Publicada** (*Published Language*) | Um formato de troca documentado e compartilhado (muitas vezes junto com o OHS). | Eventos públicos, padrões de mercado, *schemas* versionados. |
| **Caminhos Separados** (*Separate Ways*) | Nenhuma integração. Cada contexto resolve o próprio problema. | Quando integrar custa mais do que o benefício. Às vezes duplicar uma funcionalidade pequena é a decisão certa. |

Veja como poderia ficar um mapa de contextos para o nosso exemplo de e-commerce:

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 760 410" role="img" aria-labelledby="bc-d2-title bc-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="bc-d2-title">Mapa de contextos de um e-commerce</title>
<desc id="bc-d2-desc">Identidade é um contexto genérico exposto como serviço de host aberto com linguagem publicada para Precificação, Pedidos e Faturamento. Precificação e Pedidos são contextos core em parceria. Pedidos fornece para Faturamento como cliente e fornecedor e divide um núcleo compartilhado com Entrega. Entrega é conformista em relação à API da transportadora. Faturamento lê um ERP legado por meio de uma camada anticorrupção. Marketing segue caminhos separados.</desc>
<defs><marker id="bc-d2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="380" y="26" text-anchor="middle" class="d-label">MAPA DE CONTEXTOS</text>
<rect x="30" y="50" width="160" height="70" rx="10" class="d-box-muted"/>
<text x="110" y="80" text-anchor="middle" class="d-title">Marketing</text>
<text x="110" y="102" text-anchor="middle" class="d-small">caminhos separados</text>
<rect x="300" y="50" width="160" height="70" rx="10" class="d-box"/>
<text x="380" y="80" text-anchor="middle" class="d-title">Identidade</text>
<text x="380" y="102" text-anchor="middle" class="d-small">genérico</text>
<rect x="570" y="44" width="14" height="14" rx="3" class="d-box-accent"/>
<text x="592" y="56" class="d-small">Core</text>
<rect x="570" y="64" width="14" height="14" rx="3" class="d-box-info"/>
<text x="592" y="76" class="d-small">De suporte</text>
<rect x="570" y="84" width="14" height="14" rx="3" class="d-box"/>
<text x="592" y="96" class="d-small">Genérico</text>
<rect x="570" y="104" width="14" height="14" rx="3" class="d-box-muted"/>
<text x="592" y="116" class="d-small">Externo</text>
<rect x="570" y="124" width="14" height="14" rx="3" class="d-box-danger"/>
<text x="592" y="136" class="d-small">Legado</text>
<line x1="380" y1="120" x2="380" y2="178" class="d-line-dashed" marker-end="url(#bc-d2-arrow)"/>
<line x1="300" y1="108" x2="112" y2="178" class="d-line-dashed" marker-end="url(#bc-d2-arrow)"/>
<line x1="460" y1="108" x2="648" y2="178" class="d-line-dashed" marker-end="url(#bc-d2-arrow)"/>
<text x="390" y="156" class="d-label">OHS / PL</text>
<rect x="30" y="180" width="160" height="70" rx="10" class="d-box-accent"/>
<text x="110" y="210" text-anchor="middle" class="d-title">Precificação</text>
<text x="110" y="232" text-anchor="middle" class="d-small">core</text>
<rect x="300" y="180" width="160" height="70" rx="10" class="d-box-accent"/>
<text x="380" y="210" text-anchor="middle" class="d-title">Pedidos</text>
<text x="380" y="232" text-anchor="middle" class="d-small">core</text>
<rect x="570" y="180" width="160" height="70" rx="10" class="d-box-info"/>
<text x="650" y="210" text-anchor="middle" class="d-title">Faturamento</text>
<text x="650" y="232" text-anchor="middle" class="d-small">de suporte</text>
<line x1="190" y1="222" x2="300" y2="222" class="d-line-accent"/>
<text x="245" y="212" text-anchor="middle" class="d-label">PARCERIA</text>
<line x1="460" y1="222" x2="568" y2="222" class="d-line" marker-end="url(#bc-d2-arrow)"/>
<text x="515" y="198" text-anchor="middle" class="d-label">CLIENTE /</text>
<text x="515" y="212" text-anchor="middle" class="d-label">FORNECEDOR</text>
<line x1="380" y1="250" x2="380" y2="320" class="d-line"/>
<text x="390" y="290" class="d-label">NÚCLEO COMPARTILHADO</text>
<rect x="30" y="320" width="160" height="70" rx="10" class="d-box-muted"/>
<text x="110" y="350" text-anchor="middle" class="d-title">API Transportadora</text>
<text x="110" y="372" text-anchor="middle" class="d-small">externo</text>
<rect x="300" y="320" width="160" height="70" rx="10" class="d-box-info"/>
<text x="380" y="350" text-anchor="middle" class="d-title">Entrega</text>
<text x="380" y="372" text-anchor="middle" class="d-small">de suporte</text>
<line x1="190" y1="362" x2="298" y2="362" class="d-line" marker-end="url(#bc-d2-arrow)"/>
<text x="245" y="352" text-anchor="middle" class="d-label">CONFORMISTA</text>
<rect x="570" y="320" width="160" height="70" rx="10" class="d-box-danger"/>
<text x="650" y="350" text-anchor="middle" class="d-title">ERP Legado</text>
<text x="650" y="372" text-anchor="middle" class="d-small">legado</text>
<line x1="650" y1="320" x2="650" y2="302" class="d-line"/>
<rect x="610" y="268" width="80" height="34" rx="10" class="d-box-warn"/>
<text x="650" y="290" text-anchor="middle" class="d-text">ACL</text>
<line x1="650" y1="268" x2="650" y2="252" class="d-line" marker-end="url(#bc-d2-arrow)"/>
</svg>
</div>
<figcaption>Figura 2: Um mapa de contextos mostra as caixas e, principalmente, as relações de poder entre elas</figcaption>
</figure>

Repare que o mapa de contextos não é só técnico. Ele é **político**. "Conformista" é uma confissão honesta de que você não tem poder de barganha com o *upstream*. "Cliente/Fornecedor" só funciona se o time *upstream* realmente escuta. "Parceria" exige dois times com objetivos alinhados e comunicação de verdade. Desenhar o mapa obriga essas conversas a acontecerem em voz alta, em vez de serem descobertas no meio de um incidente.

<div class="callout warning">
  <p>Cuidado com o <strong>Núcleo Compartilhado</strong>. Ele começa como "só a classe Endereco" e, seis meses depois, virou uma biblioteca compartilhada com 40 classes em torno da qual três times precisam coordenar releases. Se crescer, deixou de ser núcleo: é um monólito disfarçado. Mantenha minúsculo, versionado e sem graça.</p>
</div>

## Camada Anticorrupção: mantendo o legado do lado de fora

Vamos dar um zoom no padrão mais útil para quem já integrou com um sistema legado: a **Camada Anticorrupção** (*Anti-Corruption Layer*, ou ACL).

Imagine o cenário. Seu novo contexto de Faturamento tem um modelo limpo: `Fatura`, `Pagador`, `Dinheiro`, `StatusFatura`. Só que o ERP de 20 anos da empresa ainda é a fonte da verdade para os dados de crédito dos clientes, e a API dele devolve coisas assim:

```json
{
  "CD_CLI": "000482",
  "NM_RAZ": "ACME LTDA",
  "TP_DOC": 3,
  "VL_LIM_CRED": "15000,00",
  "FL_BLOQ": "S"
}
```

`TP_DOC = 3` significa "pessoa jurídica" (a não ser que seja filial, aí é 4, exceto nos registros criados antes de 2011). `FL_BLOQ = "S"` quer dizer bloqueado, e o valor é uma string com vírgula como separador decimal. Se você deixar esse formato entrar no seu modelo de domínio, em um mês o seu contexto novinho vai estar falando "ERPês".

A ACL é uma camada que pertence ao **seu** contexto e cuja única função é traduzir. Ela costuma ter três partes:

- **Fachada** (*Facade*): uma interface simplificada sobre o sistema legado, expondo só o que você precisa;
- **Adaptador** (*Adapter*): cuida dos detalhes técnicos, como protocolo, autenticação, *retries*, paginação e *encodings* esquisitos;
- **Tradutor** (*Translator*): converte o modelo legado no seu modelo de domínio (e de volta, se precisar), incluindo todas as manias do negócio.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 290" role="img" aria-labelledby="bc-d3-title bc-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="bc-d3-title">Camada anticorrupção entre Faturamento e um ERP legado</title>
<desc id="bc-d3-desc">O contexto de Faturamento, com seu próprio modelo de Fatura, Pagador e Dinheiro, conversa com uma camada anticorrupção formada por fachada, tradutor e adaptador. A camada conversa com o ERP legado e seus campos enigmáticos, então o modelo legado nunca chega ao Faturamento.</desc>
<defs><marker id="bc-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="120" y="58" text-anchor="middle" class="d-label">NOSSO MODELO</text>
<rect x="30" y="70" width="180" height="140" rx="10" class="d-box-accent"/>
<text x="120" y="100" text-anchor="middle" class="d-title">Faturamento</text>
<text x="120" y="130" text-anchor="middle" class="d-small">Fatura</text>
<text x="120" y="152" text-anchor="middle" class="d-small">Pagador</text>
<text x="120" y="174" text-anchor="middle" class="d-small">Dinheiro</text>
<text x="360" y="38" text-anchor="middle" class="d-label">DO FATURAMENTO</text>
<rect x="270" y="50" width="180" height="180" rx="10" class="d-box-warn"/>
<text x="360" y="76" text-anchor="middle" class="d-title">Camada</text>
<text x="360" y="95" text-anchor="middle" class="d-title">Anticorrupção</text>
<rect x="290" y="108" width="140" height="32" rx="10" class="d-box"/>
<text x="360" y="129" text-anchor="middle" class="d-text">Fachada</text>
<rect x="290" y="148" width="140" height="32" rx="10" class="d-box"/>
<text x="360" y="169" text-anchor="middle" class="d-text">Tradutor</text>
<rect x="290" y="188" width="140" height="32" rx="10" class="d-box"/>
<text x="360" y="209" text-anchor="middle" class="d-text">Adaptador</text>
<text x="600" y="58" text-anchor="middle" class="d-label">MODELO DELES</text>
<rect x="510" y="70" width="180" height="140" rx="10" class="d-box-danger"/>
<text x="600" y="100" text-anchor="middle" class="d-title">ERP Legado</text>
<text x="600" y="130" text-anchor="middle" class="d-small">CD_CLI, NM_RAZ</text>
<text x="600" y="152" text-anchor="middle" class="d-small">TP_DOC = 3</text>
<text x="600" y="174" text-anchor="middle" class="d-small">FL_BLOQ = "S"</text>
<line x1="212" y1="140" x2="268" y2="140" class="d-line" marker-start="url(#bc-d3-arrow)" marker-end="url(#bc-d3-arrow)"/>
<line x1="452" y1="140" x2="508" y2="140" class="d-line" marker-start="url(#bc-d3-arrow)" marker-end="url(#bc-d3-arrow)"/>
<text x="360" y="268" text-anchor="middle" class="d-small">a tradução acontece num lugar só; o modelo legado nunca vaza para dentro</text>
</svg>
</div>
<figcaption>Figura 3: A ACL pertence ao contexto downstream e absorve toda a esquisitice do legado</figcaption>
</figure>

No código, o tradutor costuma ser surpreendentemente pequeno e sem graça, que é exatamente o que você quer:

```typescript
// Modelo próprio do Faturamento: nenhum rastro do ERP aqui
type TipoPagador = "pessoa_fisica" | "pessoa_juridica";

interface Pagador {
  id: PagadorId;
  razaoSocial: string;
  tipo: TipoPagador;
  limiteCredito: Dinheiro;
  bloqueado: boolean;
}

// Tradutor da ACL: o único lugar que sabe o que TP_DOC significa
function paraPagador(raw: ErpClienteDto): Pagador {
  return {
    id: PagadorId.doLegado(raw.CD_CLI),
    razaoSocial: raw.NM_RAZ.trim(),
    tipo: raw.TP_DOC === 3 || raw.TP_DOC === 4 ? "pessoa_juridica" : "pessoa_fisica",
    limiteCredito: Dinheiro.brl(parseDecimalLegado(raw.VL_LIM_CRED)),
    bloqueado: raw.FL_BLOQ === "S",
  };
}
```

O domínio de Faturamento trabalha com `Pagador` e nunca vê `FL_BLOQ`. Quando o ERP finalmente for substituído (um dia ele vai ser, quem sabe), você reescreve a ACL e o resto do Faturamento nem percebe. A ACL também é o lugar natural para a estratégia **Strangler Fig**: roteie as chamadas por ela e vá tirando capacidades do legado aos poucos, pedaço por pedaço.

**Benefício:** seu modelo de domínio continua limpo, mudanças no legado têm um raio de impacto pequeno e as regras de tradução são testadas isoladamente, em vez de ficarem espalhadas pelo código.

## Contextos Delimitados vs Microsserviços

Agora voltando à pergunta do Júnior. É o equívoco mais comum de todo o assunto, então vamos ser bem claros:

<div class="callout info">
  <p><strong>Um contexto delimitado é uma fronteira lógica. Um microsserviço é uma fronteira de deploy.</strong> Um bom microsserviço não deveria atravessar uma fronteira de contexto, mas um contexto não precisa ser um microsserviço. Um contexto pode ser um módulo dentro de um monólito, um serviço ou até vários serviços.</p>
</div>

### A história do monólito distribuído

Eu já vi esse filme mais de uma vez. A empresa decide que chegou a hora de "ir para microsserviços". O time faz um *workshop* rapidinho, divide o monólito antigo por **entidade** (um `cliente-service`, um `pedido-service`, um `produto-service`, um `estoque-service`) e, para ganhar tempo, todos continuam apontando para o mesmo banco de dados. Afinal, os dados já estão lá.

Um ano depois:

- Fechar um pedido chama o `cliente-service`, que chama o `produto-service`, que chama o `estoque-service`, que chama o `preco-service`. Se qualquer um estiver lento, o checkout fica lento. Se qualquer um cair, o checkout cai;
- Renomear uma coluna no banco compartilhado exige um deploy coordenado de seis serviços, agendado para sábado às 2 da manhã;
- Toda funcionalidade encosta em quatro repositórios, quatro pipelines e quatro times;
- A conta da nuvem triplicou, a latência dobrou e depurar exige *tracing* distribuído passando por uma dúzia de saltos;
- Ninguém consegue fazer deploy de nada sozinho, que era justamente o objetivo da migração.

Esse é o **monólito distribuído**: todo o acoplamento de um monólito, somado a todo o custo operacional de um sistema distribuído. O pior dos dois mundos. A causa raiz não foram os microsserviços em si, foi dividir pelas linhas erradas (entidades e tabelas em vez de capacidades de negócio e linguagem) e compartilhar os dados por baixo.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 740 310" role="img" aria-labelledby="bc-d4-title bc-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="bc-d4-title">Monólito distribuído versus monólito modular</title>
<desc id="bc-d4-desc">À esquerda, três serviços se chamam de forma síncrona em cadeia e compartilham um único banco, então sobem e caem juntos. À direita, um único deployable contém três módulos, cada um com seu próprio schema, conversando por eventos em processo e APIs públicas, prontos para serem separados depois em costuras já comprovadas.</desc>
<defs><marker id="bc-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-danger"/></marker></defs>
<text x="185" y="26" text-anchor="middle" class="d-label">MONÓLITO DISTRIBUÍDO</text>
<rect x="35" y="64" width="90" height="44" rx="10" class="d-box"/>
<text x="80" y="91" text-anchor="middle" class="d-text">Pedidos</text>
<rect x="140" y="64" width="90" height="44" rx="10" class="d-box"/>
<text x="185" y="91" text-anchor="middle" class="d-text">Fatura</text>
<rect x="245" y="64" width="90" height="44" rx="10" class="d-box"/>
<text x="290" y="91" text-anchor="middle" class="d-text">Entrega</text>
<path d="M85,64 Q132,36 178,62" class="d-line-danger" marker-end="url(#bc-d4-arrow)"/>
<path d="M192,64 Q240,36 284,62" class="d-line-danger" marker-end="url(#bc-d4-arrow)"/>
<text x="185" y="40" text-anchor="middle" class="d-small">chamadas síncronas</text>
<line x1="80" y1="108" x2="148" y2="188" class="d-line-danger"/>
<line x1="185" y1="108" x2="185" y2="188" class="d-line-danger"/>
<line x1="290" y1="108" x2="222" y2="188" class="d-line-danger"/>
<rect x="110" y="190" width="150" height="60" rx="10" class="d-box-danger"/>
<text x="185" y="216" text-anchor="middle" class="d-title">Banco único</text>
<text x="185" y="236" text-anchor="middle" class="d-small">um schema para tudo</text>
<text x="185" y="284" text-anchor="middle" class="d-small">sobem juntos, caem juntos</text>
<line x1="370" y1="20" x2="370" y2="290" class="d-line-dashed"/>
<text x="550" y="26" text-anchor="middle" class="d-label">MONÓLITO MODULAR</text>
<rect x="390" y="44" width="320" height="210" rx="10" class="d-box"/>
<text x="550" y="66" text-anchor="middle" class="d-small">um único deployable</text>
<rect x="405" y="80" width="90" height="46" rx="10" class="d-box-accent"/>
<text x="450" y="108" text-anchor="middle" class="d-text">Pedidos</text>
<rect x="505" y="80" width="90" height="46" rx="10" class="d-box-accent"/>
<text x="550" y="108" text-anchor="middle" class="d-text">Fatura</text>
<rect x="605" y="80" width="90" height="46" rx="10" class="d-box-accent"/>
<text x="650" y="108" text-anchor="middle" class="d-text">Entrega</text>
<line x1="415" y1="148" x2="685" y2="148" class="d-line-dashed"/>
<line x1="450" y1="126" x2="450" y2="172" class="d-line"/>
<line x1="550" y1="126" x2="550" y2="172" class="d-line"/>
<line x1="650" y1="126" x2="650" y2="172" class="d-line"/>
<rect x="420" y="172" width="60" height="32" rx="10" class="d-box-info"/>
<text x="450" y="193" text-anchor="middle" class="d-small">schema</text>
<rect x="520" y="172" width="60" height="32" rx="10" class="d-box-info"/>
<text x="550" y="193" text-anchor="middle" class="d-small">schema</text>
<rect x="620" y="172" width="60" height="32" rx="10" class="d-box-info"/>
<text x="650" y="193" text-anchor="middle" class="d-small">schema</text>
<text x="550" y="234" text-anchor="middle" class="d-small">eventos e APIs públicas entre módulos</text>
<text x="550" y="284" text-anchor="middle" class="d-small">separe depois, nas costuras comprovadas</text>
</svg>
</div>
<figcaption>Figura 4: Os mesmos três nomes, acoplamentos muito diferentes</figcaption>
</figure>

### O monólito modular: contextos sem a rede

Para muitos times, o melhor primeiro passo é um **monólito modular**: uma única aplicação implantável, dividida internamente em módulos que seguem as linhas dos contextos delimitados. Cada módulo:

- Tem seu próprio modelo interno e expõe apenas uma API pública pequena (uma interface, uma fachada, eventos publicados);
- É dono das próprias tabelas, de preferência num *schema* próprio, e os outros módulos nunca consultam essas tabelas diretamente;
- Se comunica com os outros módulos por essa API pública ou por eventos em processo;
- Tem suas fronteiras garantidas por ferramentas: testes de arquitetura (ArchUnit, NetArchTest, dependency-cruiser), projetos ou pacotes separados, regras de *lint*.

Você ganha a maior parte dos benefícios de modelagem dos contextos delimitados (linguagem clara, mudanças isoladas, contratos explícitos) sem pagar por chamadas de rede, transações distribuídas, *service discovery* e uma dúzia de pipelines. E, se mais tarde um módulo precisar escalar de forma independente ou passar para outro time, a costura já está lá. Extrair um módulo bem isolado para um serviço é projeto de fim de semana. Desembaraçar uma grande bola de lama é programa de dois anos.

### Quando um contexto deve virar serviço

Separe um contexto num deployable próprio quando houver um motivo concreto, como:

1. **Escala independente:** o perfil de carga dele é muito diferente do resto (busca, processamento de imagens, precificação na Black Friday);
2. **Cadência de release independente:** um time precisa publicar várias vezes por dia sem coordenar com ninguém;
3. **Autonomia de time:** um time separado é dono dele e o deploy compartilhado virou gargalo;
4. **Necessidades tecnológicas diferentes:** outro *runtime*, linguagem ou banco de dados realmente faz diferença;
5. **Isolamento de falhas:** uma falha ali não pode derrubar o resto (veja [Padrões de Resiliência](/pt-br/principles/solution/resilience-patterns/)).

Se nenhum desses se aplica, um módulo provavelmente basta. Distribuir é um custo que você paga por um benefício, não uma medalha.

## Propriedade dos Dados por Contexto

Uma fronteira que para no código e ignora os dados não é fronteira. A regra é simples e inegociável: **cada contexto é dono dos seus dados, e só ele escreve neles.** Os outros contextos obtêm esses dados pela API do dono ou pelos eventos que ele publica.

Como isso fica na prática?

### 1. Nada de tabelas compartilhadas

Se dois contextos escrevem na mesma tabela, eles são um contexto só (admitindo ou não). Ler diretamente as tabelas de outro contexto é quase tão ruim: seu código passa a depender do *schema* interno dele, e ele não consegue refatorar sem quebrar você.

### 2. Compartilhe identificadores, não linhas

O Faturamento guarda o `pedidoId`, não uma *foreign key* para o banco de Pedidos. Ele pode pedir detalhes a Pedidos ou manter a própria cópia dos poucos fatos de que precisa.

### 3. Cópias locais são normais

A Entrega pode manter a própria projeção do endereço de entrega, atualizada por um evento `PedidoRealizado` ou `EnderecoAlterado`. Isso não é bug, é um **modelo de leitura** (*read model*) proposital. Cada cópia tem exatamente o formato de que o seu contexto precisa.

### 4. Eventos fazem parte da linguagem publicada

Eventos de domínio que atravessam fronteiras (`PedidoRealizado`, `PagamentoCapturado`) são contratos. Versione, documente e trate *breaking changes* com o mesmo cuidado de uma mudança em API pública. Eventos internos podem mudar à vontade; os públicos, não.

### 5. Use o padrão Outbox para publicar com segurança

Gravar no seu banco e publicar um evento são duas operações que podem falhar de forma independente. O **Transactional Outbox** salva o evento na mesma transação da mudança de estado, e um processo de *relay* publica depois. Assim você nunca perde um evento nem publica um evento de uma mudança que sofreu *rollback*.

```csharp
public async Task RealizarPedido(RealizarPedidoCommand cmd)
{
    var pedido = Pedido.Realizar(cmd.ClienteId, cmd.Itens, _relogio);

    await using var tx = await _db.Database.BeginTransactionAsync();
    _db.Pedidos.Add(pedido);
    _db.Outbox.Add(OutboxMessage.De(new PedidoRealizado(pedido.Id, pedido.Total)));
    await _db.SaveChangesAsync();
    await tx.CommitAsync();
    // Um relay em background lê o outbox e publica no broker
}
```

| Abordagem | Benefício |
| :--- | :--- |
| **Um único escritor por dado** | Nenhum acoplamento escondido pelo banco; cada time pode mudar seu *schema* livremente. |
| **Integração por APIs e eventos** | Contratos explícitos, versionados e testáveis. |
| **Modelos de leitura locais** | Cada contexto recebe exatamente o formato de dados de que precisa, sem depender dos outros em tempo de execução para leituras. |
| **Transactional outbox** | Mudanças de estado e eventos publicados continuam consistentes, mesmo com falhas no meio do caminho. |

## Lei de Conway e Team Topologies

Em 1967, Melvin Conway observou que *organizações projetam sistemas que espelham a sua própria estrutura de comunicação*. Mais de meio século depois, a lei continua invicta. Se três times constroem um compilador, você ganha um compilador de três passadas. Se um time é dono de Faturamento e Entrega juntos e ninguém é dono de Precificação, sua arquitetura vai refletir exatamente isso, não importa o que diga o diagrama da wiki.

Isso tem uma consequência direta para os contextos delimitados: **as fronteiras no software só se sustentam se baterem com as fronteiras na organização.** Um contexto com três times donos vai ser puxado em três direções. Dois contextos nas mãos de um único time sobrecarregado vão se fundir aos poucos.

A jogada prática é conhecida como **Manobra Inversa de Conway** (*Inverse Conway Maneuver*): desenhe a estrutura de times que você quer para que a arquitetura que você quer surja naturalmente. O livro *Team Topologies*, de Matthew Skelton e Manuel Pais, traz um vocabulário muito útil para isso:

- **Times alinhados ao fluxo** (*stream-aligned*): são donos de um fluxo de valor de negócio de ponta a ponta, geralmente um ou mais contextos delimitados. A maioria dos times deveria ser deste tipo;
- **Times de plataforma** (*platform*): oferecem serviços internos (deploy, observabilidade, plataforma de dados) que reduzem a carga cognitiva dos times alinhados ao fluxo;
- **Times habilitadores** (*enabling*): ajudam outros times a adotar novas habilidades ou práticas e depois saem de cena;
- **Times de subsistema complicado** (*complicated-subsystem*): cuidam de uma parte que exige conhecimento especializado profundo (um motor de precificação, um codec de vídeo, um modelo de risco).

E três modos de interação que conversam muito bem com o mapeamento de contextos: **colaboração** (parecido com Parceria), **X como serviço** (parecido com Serviço de Host Aberto e Cliente/Fornecedor) e **facilitação** (times habilitadores ajudando os demais).

<div class="callout tip">
  <p>Uma boa heurística do Team Topologies é a <strong>carga cognitiva</strong>: um time deve ser dono apenas de quantos contextos conseguir entender de verdade. Se um time não consegue explicar o próprio modelo de domínio sem abrir o código, ele tem coisa demais nas mãos. Divida a responsabilidade antes que o modelo apodreça.</p>
</div>

## Tradeoffs

Contextos delimitados trazem clareza, autonomia e modelos adequados ao seu propósito. Mas, como toda decisão de arquitetura, eles têm um preço. Fingir que são de graça é o caminho mais curto para um time passar a odiar DDD.

### Duplicação de dados e modelos

O mesmo conceito aparece em vários contextos com formatos diferentes. Isso é intencional, mas significa mais código, mais mapeamento e mais lugares para atualizar quando um fato realmente compartilhado muda (como a razão social de um cliente). Você troca um pouco de duplicação por muita independência. Só garanta que a troca seja consciente.

### Complexidade de integração

Cada relação no mapa de contextos é uma integração para desenhar, construir, testar, monitorar e versionar. Testes de contrato, *schema registries*, versionamento de eventos, ACLs: tudo isso é trabalho de verdade. Com contextos pequenos demais, o custo de integração pode superar o benefício. Poucos contextos maiores costumam ser melhores que muitos minúsculos, principalmente no começo.

### Consistência eventual

Quando os contextos passam a se comunicar por eventos, o sistema deixa de ser consistente a cada instante. O pedido é realizado, mas a fatura aparece alguns segundos depois. O negócio precisa aceitar isso (e geralmente aceita, depois que alguém lembra que o sistema antigo também rodava um *batch* noturno). Você vai precisar de consumidores idempotentes, *retries*, compensações (*sagas*) e interfaces que lidem bem com estados de "processando".

### Tradeoffs com Confiabilidade (Reliability)

Separar em serviços introduz chamadas de rede e mais modos de falha. Sem *timeouts*, *retries*, *circuit breakers* e comunicação assíncrona, mais fronteiras significam mais jeitos de falhar. Veja [Confiabilidade](/pt-br/principles/cloud/reliability/) e [Padrões de Resiliência](/pt-br/principles/solution/resilience-patterns/).

### Tradeoffs com Eficiência de Performance (Performance Efficiency)

Camadas de tradução, serialização e saltos pela rede adicionam latência. Consultas que antes eram um único *join* em SQL agora precisam de composição entre contextos ou de modelos de leitura dedicados. Veja [Eficiência de Performance](/pt-br/principles/cloud/performance-efficiency/).

### Tradeoffs com Otimização de Custos (Cost Optimization)

Mais deployables significam mais infraestrutura, mais pipelines, mais bancos e mais dados de observabilidade. Um monólito modular mantém a maior parte dos benefícios de modelagem por uma fração do custo. Veja [Otimização de Custos](/pt-br/principles/cloud/cost-optimization/).

### Tradeoffs com Excelência Operacional (Operational Excellence)

Cada contexto precisa de dono, *runbooks*, *dashboards* e plantão. Rastrear uma requisição entre contextos exige *correlation IDs* e *tracing* distribuído desde o primeiro dia. Veja [Excelência Operacional](/pt-br/principles/cloud/operational-excellence/) e [Observabilidade em Primeiro Lugar](/pt-br/principles/solution/observability-first/).

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Pera aí... então se eu errar as fronteiras, fico preso a elas para sempre?"</span>
    </div>
  </div>
</div>

Para sempre não, Júnior, mas mover uma fronteira fica mais caro quanto mais você investiu nela. É exatamente por isso que vale começar com um monólito modular, manter os contextos um pouco maiores no início e ajustar conforme aprende. Fronteiras são hipóteses sobre o negócio. Trate-as como qualquer outra decisão de design: explícitas, documentadas (um ADR ajuda muito) e abertas a revisão. Esse é o coração do [Design Evolutivo](/pt-br/principles/solution/evolutionary-design/).

## Conclusão

Os **Contextos Delimitados** são uma das ideias mais poderosas da arquitetura de software, justamente porque não falam de tecnologia. Eles falam de aceitar que um negócio grande não cabe num único modelo, que as palavras significam coisas diferentes em lugares diferentes e que fronteiras claras (na linguagem, no código, nos dados e nos times) são o que permite a um sistema crescer sem desabar sob o próprio peso.

Acerte a linguagem dentro de cada contexto. Classifique os subdomínios para investir onde importa. Deixe as relações explícitas com um mapa de contextos. Proteja seu modelo do legado com camadas anticorrupção. Dê a cada contexto a propriedade dos seus dados. E lembre que um contexto é, antes de tudo, uma fronteira de modelagem: se ele vai virar módulo ou microsserviço é uma decisão separada, posterior e guiada por necessidades reais.

**Mais importante:** contextos delimitados não eliminam a complexidade, eles a colocam no lugar certo. Você troca acoplamento acidental por integração deliberada, e um único modelo borrado por vários modelos afiados. É uma troca que vale a pena, desde que seja feita de forma consciente.

## Próximos Passos

1. **Monte um glossário do seu sistema atual**
Escolha os dez termos de negócio mais importantes e peça para times diferentes defini-los. Onde as definições divergirem, é provável que você tenha achado uma fronteira de contexto.

2. **Classifique seus subdomínios**
Liste as principais áreas do negócio e rotule cada uma como *core*, de suporte ou genérica. Verifique se as melhores pessoas e os maiores investimentos estão indo para o *core*.

3. **Faça uma sessão de Event Storming**
Reúna especialistas de negócio e desenvolvedores por algumas horas. Mapeie os eventos, marque os pontos quentes e desenhe as fronteiras candidatas.

4. **Desenhe seu mapa de contextos**
Documente as relações que já existem, incluindo as desconfortáveis (conformista, banco compartilhado). Torná-las visíveis é o primeiro passo para corrigi-las.

5. **Proteja o core com uma ACL**
Identifique a integração legada ou externa que mais vaza para dentro do seu modelo principal e envolva-a numa camada anticorrupção.

6. **Garanta as fronteiras antes de distribuir**
Comece com um monólito modular ou com fronteiras rígidas entre módulos, um *schema* por contexto e testes de arquitetura. Extraia serviços só quando houver um motivo concreto.

7. **Alinhe times e contextos**
Revise quem é dono do quê. Todo contexto deve ter exatamente um time dono, com uma carga cognitiva que ele consiga sustentar.

<div class="callout info" data-title="Referências">
  <ul>
    <li><a href="https://martinfowler.com/bliki/BoundedContext.html" target="_blank" rel="noopener">Martin Fowler: Bounded Context</a></li>
    <li><a href="https://martinfowler.com/bliki/UbiquitousLanguage.html" target="_blank" rel="noopener">Martin Fowler: Ubiquitous Language</a></li>
    <li><a href="https://martinfowler.com/bliki/StranglerFigApplication.html" target="_blank" rel="noopener">Martin Fowler: Strangler Fig Application</a></li>
    <li><a href="https://martinfowler.com/bliki/MonolithFirst.html" target="_blank" rel="noopener">Martin Fowler: Monolith First</a></li>
    <li><a href="https://learn.microsoft.com/azure/architecture/microservices/model/domain-analysis" target="_blank" rel="noopener">Microsoft Learn: Usando a análise de domínio para modelar microsserviços</a></li>
    <li><a href="https://learn.microsoft.com/azure/architecture/patterns/anti-corruption-layer" target="_blank" rel="noopener">Microsoft Learn: Padrão Anti-corruption Layer</a></li>
    <li><a href="https://www.domainlanguage.com/ddd/" target="_blank" rel="noopener">Domain Language: Domain-Driven Design (Eric Evans)</a></li>
    <li><a href="https://www.eventstorming.com/" target="_blank" rel="noopener">EventStorming (Alberto Brandolini)</a></li>
    <li><a href="https://teamtopologies.com/" target="_blank" rel="noopener">Team Topologies (Matthew Skelton e Manuel Pais)</a></li>
  </ul>
</div>
