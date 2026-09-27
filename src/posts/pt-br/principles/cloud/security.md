---
title: Segurança
short: Proteger confidencialidade, integridade e disponibilidade num mundo em que o perímetro sumiu. Afinal, quem quer descobrir um vazamento pelo jornal?
category: cloud
---

## Introdução

Segurança é aquele pilar com o qual todo mundo diz se importar, mas que quase ninguém quer pagar até o dia em que alguma coisa dá errado. A **meta** deste princípio é simples de enunciar e difícil de viver: **proteger o workload, seus dados e seus usuários contra ameaças intencionais e acidentais, durante toda a vida do workload**.

Na nuvem, esse trabalho mudou de forma. Não existe mais um muro físico em volta dos "nossos servidores" com um firewall na porta. Seu *workload* conversa com serviços gerenciados por endpoints públicos, desenvolvedores fazem deploy do próprio notebook, pipelines guardam credenciais de produção e um único checkbox mal configurado pode expor milhões de registros para a internet inteira. A superfície de ataque deixou de ser um prédio: agora é um conjunto de identidades, configurações e APIs.

Quando o time negligencia este princípio de design, os sintomas aparecem muito antes do incidente. É comum ver:

- Todo mundo com *Owner* ou *Admin* na subscription de produção "porque é mais fácil";
- Senhas, connection strings e chaves de API commitadas no repositório, coladas no chat ou salvas numa página da wiki;
- Storage accounts, buckets e bancos de dados com acesso público que ninguém lembra de ter habilitado;
- Logs que ninguém lê ou, pior, nenhum log, de modo que ninguém consegue responder "o que aconteceu?" depois de um incidente;
- Uma rede plana em que qualquer máquina comprometida alcança o banco de dados diretamente;
- Nenhuma ideia de quais dados são sensíveis, então tudo é protegido do mesmo jeito (geralmente mal);
- Um plano de resposta a incidentes que se resume a "liga pra aquela pessoa que sabe como funciona".

Pois é, *é raro, mas acontece bastante*... Quem nunca abriu o console da nuvem e encontrou um recurso chamado `teste-export-final-2` parado ali, com acesso público habilitado desde dois anos atrás? Falhas de segurança na nuvem raramente são ataques sofisticados dignos de filme. Na maioria das vezes, alguém simplesmente deixou a porta aberta.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Mas agora a gente tá na nuvem! Segurança não é problema do provedor? Eles têm um exército de engenheiros de segurança, né?"</span>
    </div>
  </div>
</div>

Calma aí, Júnior! Eles têm mesmo um exército de engenheiros de segurança, e protegem a parte deles no acordo extremamente bem. O problema é que "a parte deles" é menor do que a maioria das pessoas imagina. O provedor garante que ninguém vai entrar no datacenter e roubar um disco. Ele não garante que você não vai deixar sua storage account pública, dar permissão de admin para a conta pessoal do estagiário ou guardar a senha do banco em texto puro. Essa divisão tem nome, **modelo de responsabilidade compartilhada**, e já já a gente chega lá.

<div class="callout info">
  <p>Segurança não é um produto que se compra nem uma fase no fim do projeto. É uma <strong>propriedade do design</strong>, mantida continuamente pelo <strong>time</strong>: cada decisão sobre identidade, rede, dados e operação ou a fortalece ou a enfraquece.</p>
</div>

## A Tríade CIA: O Que Estamos Protegendo de Verdade

Antes de falar de ferramentas, vale combinar o que significa "seguro". O modelo clássico é a **tríade CIA** (*Confidentiality, Integrity, Availability*), e todo controle de segurança que você vai implementar na vida protege pelo menos um dos seus três vértices:

| Propriedade | O que significa | Como é uma falha |
| :--- | :--- | :--- |
| **Confidencialidade** | Só pessoas e sistemas autorizados conseguem ler os dados. | Dados de clientes vazando de um bucket público; um funcionário consultando registros que não têm nada a ver com o trabalho dele. |
| **Integridade** | Dados e sistemas só são alterados por atores autorizados, de formas autorizadas, e as alterações podem ser detectadas. | Alguém altera preços no banco; um build comprometido injeta código malicioso; logs são adulterados para esconder uma invasão. |
| **Disponibilidade** | Usuários autorizados conseguem acessar o sistema quando precisam. | Um ataque DDoS derruba o site; um ransomware criptografa o banco de produção; um atacante apaga seus backups. |

Repare que disponibilidade também é assunto de segurança, não só de confiabilidade. Ransomware é, na essência, um ataque à disponibilidade (e cada vez mais à confidencialidade também, com a dupla extorsão do tipo "paga ou a gente publica"). Por isso este pilar e o de [Confiabilidade](/pt-br/principles/cloud/reliability/) são vizinhos tão próximos: um backup imutável é ao mesmo tempo um controle de confiabilidade e um controle de segurança.

A tríade também ajuda a priorizar. Um site institucional público se preocupa muito com integridade (ninguém quer a home pichada) e disponibilidade, e bem menos com confidencialidade. Um sistema de prontuário médico inverte essa ordem. Saber qual vértice importa mais para cada tipo de dado é o primeiro passo para protegê-lo de forma proporcional, em vez de proteger tudo do mesmo jeito.

## O Modelo de Responsabilidade Compartilhada

Voltando à pergunta do Júnior. Na nuvem, as obrigações de segurança são divididas entre você e o provedor, e **onde fica a linha depende do modelo de serviço**:

- **IaaS (máquinas virtuais, redes virtuais):** o provedor cuida do datacenter físico, do hardware e do hypervisor. Tudo acima disso é seu: sistema operacional, patches, runtime, aplicação, regras de rede, identidades e dados.
- **PaaS (bancos gerenciados, App Service, funções serverless):** o provedor também assume o SO e o runtime. Você continua dono do código da aplicação, da configuração, do controle de acesso e dos dados. Os controles de rede viram trabalho compartilhado: o provedor oferece private endpoints e firewalls, mas quem precisa ligar isso é você.
- **SaaS (e-mail, CRM, suítes de escritório):** o provedor opera quase tudo. Você continua dono de **quem tem acesso** e de **quais dados coloca lá dentro**.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 370" role="img" aria-labelledby="sec-d1-title sec-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="sec-d1-title">Responsabilidade compartilhada por modelo de serviço</title>
<desc id="sec-d1-desc">Uma matriz com IaaS, PaaS e SaaS nas colunas e cinco camadas nas linhas. Dados e identidades são sempre do cliente, o datacenter físico é sempre do provedor e as camadas intermediárias passam do cliente para o provedor conforme se vai de IaaS para SaaS.</desc>
<text x="295" y="58" text-anchor="middle" class="d-label">IAAS</text>
<text x="465" y="58" text-anchor="middle" class="d-label">PAAS</text>
<text x="635" y="58" text-anchor="middle" class="d-label">SAAS</text>
<text x="190" y="105" text-anchor="end" class="d-text">Dados e identidades</text>
<rect x="220" y="80" width="150" height="40" rx="10" class="d-box-accent"/>
<text x="295" y="105" text-anchor="middle" class="d-text">Você</text>
<rect x="390" y="80" width="150" height="40" rx="10" class="d-box-accent"/>
<text x="465" y="105" text-anchor="middle" class="d-text">Você</text>
<rect x="560" y="80" width="150" height="40" rx="10" class="d-box-accent"/>
<text x="635" y="105" text-anchor="middle" class="d-text">Você</text>
<text x="190" y="153" text-anchor="end" class="d-text">Aplicações</text>
<rect x="220" y="128" width="150" height="40" rx="10" class="d-box-accent"/>
<text x="295" y="153" text-anchor="middle" class="d-text">Você</text>
<rect x="390" y="128" width="150" height="40" rx="10" class="d-box-accent"/>
<text x="465" y="153" text-anchor="middle" class="d-text">Você</text>
<rect x="560" y="128" width="150" height="40" rx="10" class="d-box-info"/>
<text x="635" y="153" text-anchor="middle" class="d-text">Provedor</text>
<text x="190" y="201" text-anchor="end" class="d-text">Runtime e SO</text>
<rect x="220" y="176" width="150" height="40" rx="10" class="d-box-accent"/>
<text x="295" y="201" text-anchor="middle" class="d-text">Você</text>
<rect x="390" y="176" width="150" height="40" rx="10" class="d-box-info"/>
<text x="465" y="201" text-anchor="middle" class="d-text">Provedor</text>
<rect x="560" y="176" width="150" height="40" rx="10" class="d-box-info"/>
<text x="635" y="201" text-anchor="middle" class="d-text">Provedor</text>
<text x="190" y="249" text-anchor="end" class="d-text">Controles de rede</text>
<rect x="220" y="224" width="150" height="40" rx="10" class="d-box-accent"/>
<text x="295" y="249" text-anchor="middle" class="d-text">Você</text>
<rect x="390" y="224" width="150" height="40" rx="10" class="d-box-warn"/>
<text x="465" y="249" text-anchor="middle" class="d-text">Compartilhado</text>
<rect x="560" y="224" width="150" height="40" rx="10" class="d-box-info"/>
<text x="635" y="249" text-anchor="middle" class="d-text">Provedor</text>
<text x="190" y="297" text-anchor="end" class="d-text">Datacenter físico</text>
<rect x="220" y="272" width="150" height="40" rx="10" class="d-box-info"/>
<text x="295" y="297" text-anchor="middle" class="d-text">Provedor</text>
<rect x="390" y="272" width="150" height="40" rx="10" class="d-box-info"/>
<text x="465" y="297" text-anchor="middle" class="d-text">Provedor</text>
<rect x="560" y="272" width="150" height="40" rx="10" class="d-box-info"/>
<text x="635" y="297" text-anchor="middle" class="d-text">Provedor</text>
<rect x="160" y="336" width="14" height="14" rx="3" class="d-fill-accent"/>
<text x="182" y="348" class="d-small">Você (cliente)</text>
<rect x="320" y="336" width="14" height="14" rx="3" class="d-fill-warn"/>
<text x="342" y="348" class="d-small">Compartilhado</text>
<rect x="460" y="336" width="14" height="14" rx="3" class="d-fill-info"/>
<text x="482" y="348" class="d-small">Provedor de nuvem</text>
</svg>
</div>
<figcaption>Figura 1: A linha de responsabilidade sobe conforme se vai de IaaS para SaaS, mas dados e identidades nunca saem do seu lado</figcaption>
</figure>

A linha de cima é a que mais importa: **dados e identidades são sempre seus**, não importa o modelo de serviço. Não existe SaaS tão gerenciado que vá te impedir de compartilhar uma planilha com "qualquer pessoa com o link". É também por isso que migrar para PaaS costuma ser uma vitória de segurança: cada camada que o provedor assume é uma camada que você não precisa mais corrigir às 2 da manhã quando uma nova vulnerabilidade aparece no noticiário.

<div class="callout warning">
  <p>Os vazamentos mais comuns na nuvem não exploram o lado do provedor no modelo. Eles exploram o lado do cliente: <strong>configurações erradas, credenciais vazadas e permissões excessivas</strong>. A segurança do provedor é a fundação, não uma garantia.</p>
</div>

## Zero Trust: Nunca Confie, Sempre Verifique

Por décadas, o modelo dominante foi o do castelo com fosso: um perímetro forte e, uma vez dentro da rede corporativa, você era considerado confiável. Esse modelo envelheceu mal. Trabalho remoto, SaaS, dispositivos móveis, parceiros, APIs e a própria nuvem dissolveram o perímetro. E os atacantes aprenderam a lição óbvia: basta conseguir um ponto de apoio lá dentro (um notebook vítima de phishing, uma VM vulnerável) e a rede "confiável" entrega todo o resto de bandeja.

O **Zero Trust** substitui essa confiança implícita por três princípios:

### 1. Verifique explicitamente

Toda requisição é autenticada e autorizada com base em todos os sinais disponíveis: a identidade, a força da autenticação (usou MFA?), a saúde do dispositivo, a localização, o recurso acessado e se o comportamento é incomum. Estar "na rede interna" não é credencial.

### 2. Use acesso com menor privilégio

Dê a cada identidade, humana ou de máquina, só as permissões de que ela precisa, só nos recursos de que ela precisa e, de preferência, só pelo tempo de que ela precisa (acesso *just-in-time* e *just-enough*). Permissão é passivo: cada uma delas é algo que o atacante herda se aquela identidade for comprometida.

### 3. Presuma a violação

Projete como se o atacante já estivesse lá dentro, porque um dia ele vai estar. Segmente tudo para limitar o *blast radius*, criptografe os dados de ponta a ponta, colete telemetria para detectar movimentação lateral e tenha um plano para quando (e não se) algo for comprometido.

<div class="callout info">
  <p>Zero Trust não é um produto e não é algo que se "termina". É uma estratégia aplicada camada por camada: primeiro identidade, depois dispositivos, rede, aplicações e dados. Qualquer fornecedor que prometa "Zero Trust numa caixinha" está te vendendo uma peça do quebra-cabeça.</p>
</div>

## A História do Bucket Público Esquecido

Antes de entrar nas práticas, deixa eu contar uma história. Você provavelmente já leu alguma versão dela no noticiário, com nomes de empresas diferentes, várias vezes.

Um desenvolvedor precisa mandar um export grande de dados para um parceiro. O arquivo é pesado demais para e-mail, então ele cria um bucket, sobe o export e, para facilitar a vida do parceiro, habilita leitura pública. "É temporário, apago na sexta." A sexta chega junto com um incidente em produção. O bucket fica. Ninguém colocou uma tag de dono, ele não está em nenhum repositório de IaC e custa uns centavos por mês, então também nunca aparece na revisão de custos.

Enquanto isso, na internet, scanners automatizados enumeram nomes de buckets o tempo todo, dia e noite, procurando exatamente isso. Uma hora, um deles encontra. Poucos dias depois, o export (cheio de nomes, e-mails e CPFs de clientes) está à venda num fórum, e a empresa fica sabendo por um jornalista pedindo um posicionamento.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 320" role="img" aria-labelledby="sec-d2-title sec-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="sec-d2-title">Linha do tempo de um bucket público esquecido</title>
<desc id="sec-d2-desc">Uma linha do tempo com cinco eventos: um bucket é criado para um export rápido, fica público para enviar um arquivo, é esquecido sem dono, um scanner automatizado o encontra e os dados vazam. Abaixo, os guardrails que teriam quebrado a corrente: policies bloqueando acesso público, tag de dono obrigatória e varredura de postura.</desc>
<text x="360" y="28" text-anchor="middle" class="d-label">COMO UM ATALHO TEMPORÁRIO VIRA UM VAZAMENTO</text>
<line x1="80" y1="130" x2="500" y2="130" class="d-line"/>
<line x1="500" y1="130" x2="640" y2="130" class="d-line-danger"/>
<circle cx="80" cy="130" r="9" class="d-fill-muted"/>
<circle cx="220" cy="130" r="9" class="d-fill-warn"/>
<circle cx="360" cy="130" r="9" class="d-fill-warn"/>
<circle cx="500" cy="130" r="9" class="d-fill-danger"/>
<circle cx="640" cy="130" r="9" class="d-fill-danger"/>
<text x="80" y="100" text-anchor="middle" class="d-label">DIA 0</text>
<text x="220" y="100" text-anchor="middle" class="d-label">DIA 3</text>
<text x="360" y="100" text-anchor="middle" class="d-label">DIA 90</text>
<text x="500" y="100" text-anchor="middle" class="d-label">DIA 400</text>
<text x="640" y="100" text-anchor="middle" class="d-label">DIA 401</text>
<text x="80" y="168" text-anchor="middle" class="d-text">Bucket criado</text>
<text x="80" y="188" text-anchor="middle" class="d-small">para export rápido</text>
<text x="220" y="168" text-anchor="middle" class="d-text">Virou público</text>
<text x="220" y="188" text-anchor="middle" class="d-small">para enviar o arquivo</text>
<text x="360" y="168" text-anchor="middle" class="d-text">Esquecido</text>
<text x="360" y="188" text-anchor="middle" class="d-small">sem dono, sem tag</text>
<text x="500" y="168" text-anchor="middle" class="d-text">Achado por bot</text>
<text x="500" y="188" text-anchor="middle" class="d-small">varredura em massa</text>
<text x="640" y="168" text-anchor="middle" class="d-text">Vazamento</text>
<text x="640" y="188" text-anchor="middle" class="d-small">manchete e multa</text>
<rect x="40" y="228" width="640" height="64" rx="10" class="d-box-accent"/>
<text x="360" y="254" text-anchor="middle" class="d-title">Guardrails que quebram a corrente</text>
<text x="360" y="276" text-anchor="middle" class="d-small">policy bloqueando acesso público, tag de dono obrigatória, varredura de postura (CSPM)</text>
</svg>
</div>
<figcaption>Figura 2: Nenhum passo parecia perigoso na hora, e o problema é exatamente esse</figcaption>
</figure>

O que torna essa história tão didática é que **ninguém agiu de má-fé e ninguém fez nada que parecesse arriscado**. Cada passo, isoladamente, era um atalho razoável. E cada passo também era um controle que faltou:

- Uma policy negando acesso público em storage (no nível da organização, não bucket por bucket) teria barrado o dia 3;
- Uma alternativa segura (uma URL assinada com prazo de validade ou um canal de transferência de arquivos decente) teria tornado o atalho desnecessário;
- Tags obrigatórias de dono e de expiração teriam dado ao dia 90 um nome para quem ligar;
- Uma ferramenta de gestão de postura (CSPM) procurando recursos públicos teria disparado um alerta muito antes do dia 400;
- A classificação de dados teria sinalizado que aquele export continha dados pessoais e nunca deveria sair de um local controlado.

Guarde essa história. Quase todas as práticas a seguir são, de alguma forma, um elo da corrente que teria evitado esse desfecho.

## Princípios de Design para Segurança

As práticas a seguir acompanham a estrutura do pilar de Segurança do Well-Architected presente nos principais frameworks de nuvem. Como sempre, não são um checklist para aplicar de olhos fechados: são diretrizes que você prioriza de acordo com o risco e o valor do seu *workload*.

### 1. Identidade é o novo perímetro

**Objetivo:** Garantir que todo acesso a todo recurso venha de uma identidade conhecida, autenticada de forma forte e com o mínimo de permissões necessário.

Se a rede deixou de ser a fronteira, a identidade assumiu esse papel. Na nuvem, quem tem uma credencial válida com permissões suficientes consegue fazer praticamente qualquer coisa, de qualquer lugar, sem nem passar pelo seu firewall. Isso faz da identidade o alvo mais valioso e o controle mais importante.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Não posso só me dar Owner na subscription de produção? Toda vez que preciso de algo tenho que abrir chamado, assim é muito mais rápido!"</span>
    </div>
  </div>
</div>

Mais rápido pra você, Júnior, e também pra quem roubar o seu token de sessão. Um papel de Owner permanente significa que um único e-mail de phishing, uma extensão maliciosa no navegador ou um token esquecido num arquivo de log entrega ao atacante a chave do reino inteiro, 24 horas por dia, 365 dias por ano. A boa notícia é que não precisamos escolher entre "abrir chamado pra tudo" e "todo mundo é admin". É exatamente para isso que existe o acesso *just-in-time*.

| Abordagem | Benefício de Segurança |
| :--- | :--- |
| **Use identidades gerenciadas para os workloads.** Deixe suas aplicações se autenticarem em bancos, filas e cofres de chaves com identidades gerenciadas pela plataforma (*managed identities*, IAM roles para serviços, *workload identity federation*) em vez de senhas ou chaves. | Não existe segredo para vazar, rotacionar ou esquecer num arquivo de configuração. A plataforma emite tokens de vida curta automaticamente, e a credencial não pode ser copiada e reutilizada em outro lugar. |
| **Exija MFA de toda identidade humana**, principalmente das privilegiadas, e prefira métodos resistentes a phishing (chaves FIDO2, *passkeys*, autenticadores da plataforma). | Senha roubada deixa de ser suficiente. O MFA bloqueia a grande maioria das tentativas de tomada de conta baseadas em *credential stuffing* e *password spraying*. |
| **Aplique controle de acesso baseado em papéis (RBAC) com menor privilégio.** Use papéis prontos que correspondam a tarefas reais, restrinja o escopo ao menor resource group ou projeto possível e atribua a grupos, não a indivíduos. | Limita o que uma identidade comprometida consegue fazer e onde. Atribuir por grupo torna revisões de acesso e desligamentos administráveis. |
| **Use gestão de identidades privilegiadas e elevação just-in-time (PIM/JIT).** Admins ficam elegíveis a papéis de alto privilégio, mas só os ativam quando precisam, por tempo limitado, com justificativa e, nos papéis mais sensíveis, com aprovação. | Acaba com o privilégio permanente. Na maior parte do tempo ninguém tem direito de admin para ser roubado, e cada elevação deixa trilha de auditoria. |
| **Use acesso condicional.** Avalie conformidade do dispositivo, localização e sinais de risco antes de liberar o acesso, e bloqueie protocolos legados que não suportam MFA. | Implementa o "verifique explicitamente": uma senha válida vinda de um dispositivo não gerenciado num país incomum não é tratada igual a um login do notebook corporativo. |
| **Revise acessos periodicamente e automatize o ciclo de entrada, mudança e saída de pessoas.** | Permissões se acumulam com o tempo (o tal *privilege creep*). Revisões regulares e remoção automática quando alguém muda de time ou sai da empresa mantêm o *blast radius* pequeno. |
| **Proteja o acesso de emergência.** Mantenha uma ou duas contas *break-glass*, fora das políticas normais, com credenciais fortes guardadas em local seguro e alerta a cada uso. | Você não fica trancado do lado de fora durante uma indisponibilidade do provedor de identidade, e qualquer uso dessas contas fica imediatamente visível. |

<div class="callout tip">
  <p>Um bom sinal de maturidade: se você perguntar "quem consegue apagar o banco de produção agora?", a resposta deveria ser uma lista curta, de preferência vazia, com todo o resto precisando passar por uma elevação auditada e com prazo.</p>
</div>

### 2. Segmente a rede e construa defesa em profundidade

**Objetivo:** Garantir que, quando um controle falhar (e um vai falhar), ainda existam outras camadas entre o atacante e o que importa.

A identidade é o perímetro principal, mas não o único. **Defesa em profundidade** (*defense in depth*) significa empilhar controles independentes para que nenhuma falha isolada leve direto a um vazamento. Cada camada presume que a camada de fora pode ter sido violada.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 440" role="img" aria-labelledby="sec-d3-title sec-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="sec-d3-title">Camadas da defesa em profundidade</title>
<desc id="sec-d3-desc">Seis camadas aninhadas protegendo os dados no centro: identidade por fora, depois perímetro, rede, computação, aplicação e, por fim, os próprios dados criptografados.</desc>
<text x="360" y="24" text-anchor="middle" class="d-label">CADA CAMADA PRESUME QUE A DE FORA PODE FALHAR</text>
<rect x="40" y="40" width="640" height="380" rx="10" class="d-box-accent"/>
<text x="56" y="62" class="d-text">Identidade</text>
<text x="664" y="62" text-anchor="end" class="d-small">MFA, RBAC, just-in-time</text>
<rect x="90" y="72" width="540" height="316" rx="10" class="d-box-info"/>
<text x="106" y="94" class="d-text">Perímetro</text>
<text x="614" y="94" text-anchor="end" class="d-small">proteção DDoS, WAF</text>
<rect x="140" y="104" width="440" height="252" rx="10" class="d-box-warn"/>
<text x="156" y="126" class="d-text">Rede</text>
<text x="564" y="126" text-anchor="end" class="d-small">segmentos, endpoints privados</text>
<rect x="190" y="136" width="340" height="188" rx="10" class="d-box"/>
<text x="206" y="158" class="d-text">Computação</text>
<text x="514" y="158" text-anchor="end" class="d-small">hardening, patches</text>
<rect x="240" y="168" width="240" height="124" rx="10" class="d-box-info"/>
<text x="256" y="190" class="d-text">Aplicação</text>
<text x="464" y="190" text-anchor="end" class="d-small">authZ, validação</text>
<rect x="290" y="200" width="140" height="60" rx="10" class="d-box-danger"/>
<text x="360" y="226" text-anchor="middle" class="d-title">Dados</text>
<text x="360" y="246" text-anchor="middle" class="d-small">criptografados</text>
</svg>
</div>
<figcaption>Figura 3: Defesa em profundidade, os dados no centro são protegidos por camadas independentes</figcaption>
</figure>

Do lado da rede, a ideia central é a **segmentação**: em vez de uma rede grande e plana em que tudo conversa com tudo, divida o workload em zonas com fluxos explícitos e mínimos entre elas.

| Abordagem | Benefício de Segurança |
| :--- | :--- |
| **Segmente por função e sensibilidade.** Separe as camadas de front-end, aplicação e dados em subnets ou VPCs diferentes, e separe os ambientes (dev, teste, produção) em subscriptions ou contas diferentes. | Um servidor web comprometido não alcança o banco diretamente, e um ambiente de dev comprometido não encosta em produção. O *blast radius* encolhe para um único segmento. |
| **Negue por padrão.** Network security groups e regras de firewall devem nascer fechados e liberar só os fluxos específicos de que o workload precisa. | Cada porta aberta é uma porta de entrada. Listas explícitas de liberação deixam a arquitetura pretendida visível e todo o resto suspeito. |
| **Use private endpoints para serviços PaaS.** Bancos, storage e cofres de chaves devem ser alcançáveis só pela sua rede privada, com acesso público desabilitado. | Tira o serviço da internet por completo. Até uma connection string vazada fica inútil fora da sua rede. |
| **Proteja a borda.** Coloque WAF e proteção contra DDoS na frente dos pontos de entrada públicos e centralize a saída (*egress*) num firewall que controle para onde os workloads podem se conectar. | Filtra ataques web comuns (os do OWASP Top 10) antes de chegarem na aplicação, absorve ataques volumétricos e dificulta muito a exfiltração de dados para destinos arbitrários. |
| **Elimine acesso administrativo direto pela internet.** Nada de RDP ou SSH expostos publicamente; use um serviço de bastion ou acesso JIT às VMs. | Portas de gerenciamento estão entre as mais varridas da internet. Fechá-las elimina uma classe enorme de ataques de força bruta. |
| **Endureça a computação (*hardening*).** Use imagens base mínimas e atualizadas, desabilite serviços não utilizados e mantenha a aplicação de patches automatizada. | Menos componentes significam menos vulnerabilidades, e patches automatizados fecham a janela entre a divulgação de uma falha e sua exploração. |

Repare como a história do bucket se encaixa aqui: com acesso público bloqueado por policy e o storage acessível só por um private endpoint, o bot do dia 400 não teria encontrado nada para varrer.

### 3. Proteja os dados

**Objetivo:** Saber quais dados você tem, quão sensíveis eles são, e protegê-los de acordo, em repouso, em trânsito e em uso.

No fim das contas, atacantes raramente querem os seus servidores. Eles querem os seus dados. E não dá para proteger dados direito sem saber o que eles são e onde estão.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Coloquei a connection string do banco no appsettings.json, mas relaxa, o repositório é privado! Só o nosso time enxerga."</span>
    </div>
  </div>
</div>

Ai, Júnior... "Privado" hoje. Aí alguém faz um fork para a conta pessoal, um log de CI imprime a configuração, um terceirizado ganha acesso de leitura, o repositório fica público sem querer durante uma migração ou o notebook de um dev é roubado. E mesmo que nada disso aconteça, o segredo agora está no histórico do Git para sempre: apagar no commit seguinte não remove nada. Segredo em código-fonte é uma das portas de entrada mais comuns em incidentes reais, e bots varrem repositórios públicos atrás deles poucos minutos depois de um push.

A solução é simples: segredos moram num **gerenciador de segredos** (Azure Key Vault, AWS Secrets Manager, Google Secret Manager, HashiCorp Vault), são lidos em tempo de execução por uma identidade gerenciada e, melhor ainda, desaparecem de vez onde o serviço suportar autenticação por identidade.

| Abordagem | Benefício de Segurança |
| :--- | :--- |
| **Classifique seus dados.** Rotule os dados por sensibilidade (público, interno, confidencial, restrito) e por escopo regulatório (dados pessoais sob a LGPD ou a GDPR, dados de pagamento sob o PCI DSS, dados de saúde). | Permite aplicar controles mais fortes onde eles importam, em vez de espalhar esforço por igual. A classificação guia decisões de criptografia, retenção, acesso e de onde os dados podem ficar. |
| **Criptografe dados em repouso.** Habilite a criptografia de storage e bancos (ligada por padrão na maioria das plataformas) e, para dados sensíveis ou regulados, considere chaves gerenciadas pelo cliente. | Um disco, snapshot ou backup roubado não serve para nada sem a chave. Chaves gerenciadas pelo cliente dão controle sobre revogação e rotação. |
| **Criptografe dados em trânsito.** Exija TLS 1.2 ou superior em todo lugar, inclusive no tráfego interno entre serviços, e recuse HTTP sem criptografia. | Protege contra interceptação e adulteração na rede, inclusive dentro da sua própria VNet, alinhado ao "presuma a violação". |
| **Gerencie chaves direito.** Guarde chaves num serviço de gestão de chaves ou HSM, separe administradores de chaves de administradores de dados, habilite *soft delete* e proteção contra expurgo e rotacione as chaves periodicamente. | A chave é o verdadeiro segredo. A segregação de funções impede que um único admin acesse os dados e ainda apague as evidências, e a proteção contra expurgo impede que um atacante destrua as chaves para fazer seus dados de refém. |
| **Centralize e rotacione segredos.** Nunca guarde segredos em código, arquivos de configuração, imagens de container ou variáveis de pipeline em texto puro. Automatize a rotação e alerte sobre vencimentos. | Um segredo vazado tem vida útil limitada, e você sempre sabe onde cada segredo está e quem consegue lê-lo. |
| **Minimize e mascare dados.** Colete só o necessário, guarde só pelo tempo exigido e mascare ou tokenize campos sensíveis em ambientes não produtivos e nos logs. | Dado que você não tem não vaza. Ambientes de teste deixam de ser uma porta dos fundos para os dados de produção. |
| **Proteja os backups.** Mantenha backups imutáveis ou logicamente isolados, numa fronteira de segurança separada da produção. | Operadores de ransomware vão atrás dos backups primeiro. Uma cópia imutável transforma uma catástrofe num dia ruim. |

<div class="callout warning">
  <p>Uma armadilha clássica: dados de produção copiados para um ambiente de teste "só pra debugar um problema". Ambientes de teste costumam ter controles mais fracos, acesso mais amplo e menos monitoramento. Se dados pessoais reais caírem lá, aquele ambiente passa a estar no escopo regulatório, você queira ou não.</p>
</div>

### 4. Modele ameaças no nível do workload

**Objetivo:** Identificar, antes do atacante, como o workload pode ser abusado, e priorizar controles com base no risco real.

Modelagem de ameaças (*threat modeling*) parece intimidadora, mas no fundo é uma conversa estruturada em torno de quatro perguntas (popularizadas por Adam Shostack e pela comunidade OWASP):

1. **O que estamos construindo?** Desenhe a arquitetura: componentes, fluxos de dados, fronteiras de confiança (onde o dado passa de uma zona menos confiável para uma mais confiável) e onde ficam os dados sensíveis.
2. **O que pode dar errado?** Percorra cada fluxo e componente procurando ameaças.
3. **O que vamos fazer a respeito?** Mitigar, transferir, aceitar ou evitar cada ameaça, com um responsável claro.
4. **Fizemos um bom trabalho?** Confirme que as mitigações existem e funcionam, e revisite o modelo quando a arquitetura mudar.

Uma técnica popular para a pergunta 2 é o **STRIDE**, que dá ao time um vocabulário comum para que a conversa não dependa de quem é o mais paranoico da sala:

| Ameaça | Viola | Exemplo no workload | Mitigação típica |
| :--- | :--- | :--- | :--- |
| **Spoofing** (falsificação de identidade) | Autenticação | Alguém chama a API interna fingindo ser o serviço de pedidos. | Identidades gerenciadas, TLS mútuo, validação de tokens. |
| **Tampering** (adulteração) | Integridade | Uma mensagem na fila é alterada entre o produtor e o consumidor. | Mensagens assinadas, controle de acesso na fila, verificação de integridade. |
| **Repudiation** (repúdio) | Não repúdio | Um admin apaga registros e não há como provar quem foi. | Logs de auditoria imutáveis, logging centralizado com acesso restrito. |
| **Information disclosure** (vazamento de informação) | Confidencialidade | Uma mensagem de erro devolve um stack trace com dados de conexão. | Respostas de erro genéricas, gestão de segredos, criptografia. |
| **Denial of service** (negação de serviço) | Disponibilidade | Um único cliente inunda a API e derruba o serviço para todos. | Rate limiting, cotas, proteção contra DDoS, limites de autoscaling. |
| **Elevation of privilege** (elevação de privilégio) | Autorização | Um usuário comum troca um ID na URL e edita os dados de outro cliente. | Checagem de autorização em toda requisição, papéis com menor privilégio. |

Faça isso em time, com um quadro branco, durante o design e sempre que a arquitetura mudar de forma relevante: uma nova integração, um novo repositório de dados, um novo endpoint público. O resultado não precisa ser um documento de 50 páginas. Um diagrama com as fronteiras de confiança e uma lista priorizada de ameaças, cada uma com dono, já te coloca à frente da maioria dos times.

<div class="callout info">
  <p>Parte do trabalho de segurança acontece ainda mais cedo, dentro do próprio pipeline de entrega: análise estática (SAST), varredura de dependências e containers, detecção de segredos nos commits, checagens de infraestrutura como código e proteção da cadeia de suprimentos de software. Esse é o assunto de <a href="/pt-br/principles/solution/security-shift-left/">Security Shift-Left</a>. Este pilar foca no workload depois de projetado e rodando.</p>
</div>

### 5. Monitore, detecte e responda

**Objetivo:** Detectar atividades suspeitas rapidamente, contê-las antes que se espalhem e aprender com cada incidente.

O "presuma a violação" tem uma consequência prática: você precisa conseguir **enxergar** a violação. Em muitas organizações, o tempo médio entre uma invasão e sua descoberta ainda é medido em semanas ou meses. Cada dia que o atacante passa despercebido é um dia de movimentação lateral, escalada de privilégio e exfiltração de dados.

| Abordagem | Benefício de Segurança |
| :--- | :--- |
| **Colete a telemetria certa.** Logins e logs de auditoria de identidade, atividade do plano de controle (quem criou, alterou ou apagou o quê), fluxos de rede, logs de WAF e firewall e eventos de segurança da aplicação. | Você consegue reconstruir o que aconteceu. Sem logs do plano de controle, a pergunta "quem deixou esse bucket público?" fica sem resposta. |
| **Centralize num SIEM.** Envie os logs relevantes para segurança a um SIEM (Microsoft Sentinel, Google Security Operations, Splunk, Elastic, entre outros) com retenção que atenda às necessidades de investigação e de conformidade. | Correlação entre fontes: um login vindo de um país incomum seguido de um download em massa é um padrão que nenhum log isolado mostra. |
| **Proteja os próprios logs.** Guarde-os numa fronteira de segurança separada, com acesso restrito e imutável. | A primeira coisa que um atacante competente faz é tentar apagar os rastros. |
| **Use gestão de postura e detecção de ameaças.** Habilite as ferramentas de *cloud security posture management* (CSPM) e de proteção de workloads (CWPP) do provedor, como Microsoft Defender for Cloud, AWS Security Hub e GuardDuty, ou Google Security Command Center. | Detecção contínua de configurações erradas (como o nosso bucket público) e de padrões de ataque conhecidos, sem construir tudo do zero. |
| **Ajuste os alertas e automatize a resposta.** Comece por detecções de alta fidelidade, direcione-as a quem pode agir e automatize a contenção repetitiva com playbooks de SOAR (desabilitar um usuário, isolar uma VM, revogar um token). | Evita a fadiga de alertas, em que o alerta verdadeiro se afoga entre milhares de falsos positivos, e reduz o tempo até a contenção. |
| **Tenha um plano de resposta a incidentes e pratique.** Defina papéis, canais de comunicação, obrigações legais e regulatórias de notificação, e faça simulações de mesa (*tabletop exercises*). | Num incidente real, ninguém deveria estar descobrindo para quem ligar. Regulações como a LGPD e a GDPR têm prazos de notificação, e o relógio começa a correr no momento em que você fica sabendo. |

Um processo maduro de resposta a incidentes segue um ciclo, não uma linha reta. O modelo de tratamento de incidentes do NIST o descreve em fases, que podemos simplificar assim:

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 320" role="img" aria-labelledby="sec-d4-title sec-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="sec-d4-title">Ciclo de resposta a incidentes</title>
<desc id="sec-d4-desc">Um ciclo de quatro etapas: preparar, detectar e analisar, conter e recuperar, e aprender, que realimenta a preparação. A telemetria do SIEM e do SOAR apoia todas as etapas.</desc>
<defs><marker id="sec-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<rect x="80" y="50" width="200" height="64" rx="10" class="d-box-accent"/>
<text x="180" y="78" text-anchor="middle" class="d-title">1. Preparar</text>
<text x="180" y="100" text-anchor="middle" class="d-small">runbooks, papéis, simulações</text>
<rect x="440" y="50" width="200" height="64" rx="10" class="d-box-info"/>
<text x="540" y="78" text-anchor="middle" class="d-title">2. Detectar e analisar</text>
<text x="540" y="100" text-anchor="middle" class="d-small">alertas do SIEM, triagem</text>
<rect x="440" y="210" width="200" height="64" rx="10" class="d-box-danger"/>
<text x="540" y="238" text-anchor="middle" class="d-title">3. Conter e recuperar</text>
<text x="540" y="260" text-anchor="middle" class="d-small">isolar, erradicar, restaurar</text>
<rect x="80" y="210" width="200" height="64" rx="10" class="d-box-warn"/>
<text x="180" y="238" text-anchor="middle" class="d-title">4. Aprender</text>
<text x="180" y="260" text-anchor="middle" class="d-small">post-mortem sem culpados</text>
<line x1="280" y1="82" x2="436" y2="82" class="d-line" marker-end="url(#sec-d4-arrow)"/>
<line x1="540" y1="114" x2="540" y2="206" class="d-line" marker-end="url(#sec-d4-arrow)"/>
<line x1="440" y1="242" x2="284" y2="242" class="d-line" marker-end="url(#sec-d4-arrow)"/>
<line x1="180" y1="210" x2="180" y2="118" class="d-line" marker-end="url(#sec-d4-arrow)"/>
<text x="360" y="156" text-anchor="middle" class="d-label">SIEM + SOAR</text>
<text x="360" y="176" text-anchor="middle" class="d-small">telemetria em cada etapa</text>
</svg>
</div>
<figcaption>Figura 4: Resposta a incidentes é um ciclo, e cada incidente deveria melhorar a próxima preparação</figcaption>
</figure>

A etapa de "aprender" é a que os times mais pulam, e é justamente ela que faz as outras melhorarem. Um post-mortem sem culpados pergunta *como o nosso sistema permitiu isso?*, e não *quem vacilou?*. Na história do bucket, "o dev esqueceu de apagar" é uma conclusão inútil. "Nossa plataforma permitia buckets públicos sem dono e nada nos alertou por um ano" é uma conclusão que leva a correções de verdade. É a mesma mentalidade de melhoria contínua que discutimos em [Excelência Operacional](/pt-br/principles/cloud/operational-excellence/), aplicada à segurança.

## Tradeoffs

A segurança protege a confidencialidade, a integridade e a disponibilidade do *workload*. Mas, como todo pilar, ela não vive sozinha: controles de segurança custam dinheiro, adicionam latência, geram trabalho operacional e podem até reduzir a disponibilidade se forem projetados sem cuidado.

**Mas atenção:** a resposta para um tradeoff nunca é "desliga a segurança". É escolher controles proporcionais ao risco, entender quanto eles custam e documentar a decisão. Bora ver alguns exemplos na prática?

### Tradeoffs com Eficiência de Performance (Performance Efficiency)

**Latência adicional:** cada camada de inspeção (WAF, firewall, terminação e recriptografia de TLS, um proxy de segurança, validação de tokens) acrescenta tempo de processamento a cada requisição.

**Consumo de recursos:** criptografia, inspeção profunda de pacotes, agentes de segurança nas VMs e logging detalhado consomem CPU, memória e I/O que a aplicação poderia estar usando.

**Menos oportunidades de cache:** dados sensíveis e específicos por usuário não podem ser cacheados na borda como conteúdo público, e um isolamento rígido pode impedir o compartilhamento de recursos que melhoraria a eficiência.

**Complexidade da rede privada:** rotear tudo por private endpoints e firewalls centrais pode introduzir saltos extras e gargalos se a rede não for dimensionada para a vazão necessária. Veja [Eficiência de Performance](/pt-br/principles/cloud/performance-efficiency/) para saber como reservar orçamento para isso.

### Tradeoffs com Otimização de Custos (Cost Optimization)

**Mais infraestrutura:** WAFs, firewalls, planos de proteção contra DDoS, bastions, HSMs, private endpoints e ambientes separados por fronteira de segurança, tudo isso aparece na fatura.

**Telemetria custa caro:** a ingestão no SIEM e a retenção longa de logs de segurança podem virar um dos maiores itens da conta de nuvem. Vai ser preciso decidir quais logs valem o dinheiro.

**Ferramentas e pessoas:** ferramentas de segurança, auditorias, testes de intrusão, certificações e profissionais especializados (ou um SOC terceirizado) são custos reais.

**Redundância para isolamento:** subscriptions, contas ou clusters separados para isolar workloads sensíveis reduzem a densidade e o compartilhamento de recursos, o contrário do que a [Otimização de Custos](/pt-br/principles/cloud/cost-optimization/) gostaria. Por outro lado, compare com o custo de um vazamento, multas incluídas.

### Tradeoffs com Excelência Operacional (Operational Excellence)

**Mais atrito:** elevação JIT, aprovações, acesso restrito à produção e controle de mudanças deixam algumas tarefas operacionais mais lentas. Durante um incidente, esse atrito pode atrapalhar se o processo de *break-glass* não estiver bem ensaiado.

**Mais complexidade:** rotação de chaves, renovação de certificados, gestão de segredos, exceções de policy e revisões de acesso são trabalho operacional recorrente que precisa de automação, senão vira trabalho braçal.

**Troubleshooting mais difícil:** redes privadas, tráfego criptografado e logs mascarados dificultam a depuração. "Não consigo reproduzir porque não consigo ver o dado" é uma reclamação real.

**Tensão com a observabilidade:** operações quer logs ricos, segurança quer zero dado sensível neles. Os dois têm razão, e é por isso que classificação e mascaramento de logs importam.

### Tradeoffs com Confiabilidade (Reliability)

**Novos pontos de falha:** o provedor de identidade, o serviço de gestão de chaves e o firewall central viram dependências críticas. Se o cofre de chaves ficar indisponível e a aplicação não conseguir ler os segredos, o workload cai junto.

**Indisponibilidades autoinfligidas:** um certificado vencido, um segredo rotacionado que não foi propagado ou uma regra de firewall agressiva demais são causas clássicas de downtime.

**Risco de se trancar do lado de fora:** policies rígidas podem bloquear ações legítimas de recuperação, como restaurar um backup em outra região que não esteja liberada. Os procedimentos de recuperação precisam ser desenhados levando em conta os controles de segurança, e testados.

**Proteções agressivas:** mitigação de DDoS ou rate limiting ajustados de forma apertada demais podem bloquear picos legítimos de tráfego, que é justamente o tipo de problema de disponibilidade que a [Confiabilidade](/pt-br/principles/cloud/reliability/) tenta evitar.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Pera... se segurança deixa tudo mais lento, mais caro e mais difícil de operar, por que não coloca depois, quando o produto já estiver dando dinheiro?"</span>
    </div>
  </div>
</div>

Porque "depois" é exatamente quando custa mais caro, Júnior! Encaixar identidades gerenciadas, segmentação de rede e classificação de dados num workload que já está em produção é doloroso, arriscado e caro. E se esse "depois" vier depois de um vazamento, você vai fazer tudo sob pressão, com advogado na call e cliente fazendo perguntas. O segredo, como em todo pilar, é a **proporcionalidade**: um MVP de startup não precisa dos mesmos controles de um banco, mas precisa do básico (MFA, nada de segredo no código, nenhum repositório de dados público, menor privilégio e logs) desde o primeiro dia. Esse básico é barato. Vazamento não é.

## Conclusão

**Segurança** não é uma funcionalidade que se adiciona no fim nem um produto que se compra de um fornecedor. É uma propriedade da arquitetura, construída desde a primeira sessão de design e mantida enquanto o workload estiver rodando. Na nuvem, o perímetro se mudou para a **identidade**, a maioria dos vazamentos vem do lado do cliente no **modelo de responsabilidade compartilhada**, e a mentalidade certa é a do **Zero Trust**: verificar explicitamente, conceder o menor privilégio e presumir a violação.

As práticas deste princípio se encaixam: identidades fortes com privilégio just-in-time, redes segmentadas e defesa em profundidade, dados classificados e criptografados com chaves e segredos bem geridos, modelagem de ameaças como hábito do time e monitoramento com um plano de resposta a incidentes ensaiado. Nenhuma delas basta sozinha, e é justamente essa a ideia: cada camada cobre as brechas das outras.

**Mais importante:** segurança traz tradeoffs em performance, custo, operação e confiabilidade. Um time maduro não os ignora nem os usa como desculpa. Ele toma decisões informadas e proporcionais, documenta e revisita essas decisões conforme o workload e as ameaças evoluem. E lembra do bucket esquecido: os maiores riscos raramente são os mais sofisticados.

## Próximos Passos

1. **Mapeie suas responsabilidades**
Para cada serviço que o seu workload usa, identifique onde fica a linha da responsabilidade compartilhada e liste quais controles são seus. Atenção especial a dados e identidades.

2. **Blinde as identidades primeiro**
Exija MFA de todo mundo, migre os workloads para identidades gerenciadas, troque o acesso de admin permanente por elevação just-in-time e agende revisões periódicas de acesso.

3. **Cace exposições públicas**
Faça um inventário de todo recurso com acesso público (storage, bancos, portas de gerenciamento, APIs) e feche o que não precisa ser público. Depois, impeça que volte com policies no nível da organização.

4. **Tire os segredos do código**
Varra repositórios e pipelines atrás de segredos, mova-os para um gerenciador de segredos, rotacione tudo o que já tiver sido exposto e habilite a detecção de segredos para barrar novos.

5. **Classifique e proteja seus dados**
Identifique onde estão os dados sensíveis e regulados, aplique criptografia e controles de acesso proporcionais à classificação e mantenha dados reais fora dos ambientes de teste.

6. **Faça uma sessão de modelagem de ameaças**
Escolha o workload mais crítico, desenhe seus fluxos de dados e fronteiras de confiança, percorra o STRIDE com o time e transforme os achados em itens priorizados no backlog, cada um com dono.

7. **Garanta que você consegue enxergar e responder**
Centralize os logs de segurança num SIEM, habilite a gestão de postura, escreva um plano de resposta a incidentes e ensaie com uma simulação de mesa antes de precisar dele de verdade.

8. **Leve a segurança para mais cedo**
Complemente esses controles de tempo de execução com checagens dentro do pipeline de entrega, como descrito em [Security Shift-Left](/pt-br/principles/solution/security-shift-left/).

<div class="callout info" data-title="Referências">
  <ul>
    <li><a href="https://learn.microsoft.com/azure/well-architected/security/" target="_blank" rel="noopener">Azure Well-Architected Framework: pilar de Segurança</a></li>
    <li><a href="https://aws.amazon.com/architecture/well-architected/" target="_blank" rel="noopener">AWS Well-Architected Framework</a></li>
    <li><a href="https://cloud.google.com/architecture/framework" target="_blank" rel="noopener">Google Cloud Architecture Framework</a></li>
    <li><a href="https://learn.microsoft.com/security/zero-trust/" target="_blank" rel="noopener">Microsoft: guia de Zero Trust</a></li>
    <li><a href="https://csrc.nist.gov/pubs/sp/800/207/final" target="_blank" rel="noopener">NIST SP 800-207: Zero Trust Architecture</a></li>
    <li><a href="https://owasp.org/www-community/Threat_Modeling" target="_blank" rel="noopener">OWASP: Threat Modeling</a></li>
    <li><a href="https://owasp.org/www-project-top-ten/" target="_blank" rel="noopener">OWASP Top Ten</a></li>
  </ul>
</div>
