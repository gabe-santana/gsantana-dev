---
title: Segurança desde o início
short: Segurança que só aparece no fim do projeto chega como conta a pagar. Traga para o começo e ela chega como hábito.
category: solution
---

## Introdução

Durante muito tempo, segurança funcionou como a prova final de um projeto de software. O time passava meses desenvolvendo e, uma semana antes do go-live, aparecia alguém da área de segurança com um scanner, um checklist e um PDF de 200 páginas cheio de achados em vermelho. Aí vinha o pânico, as "aprovações de exceção" e o lançamento que atrasava um mês (ou, pior, o lançamento que acontecia mesmo assim, com buraco e tudo).

**Security Shift-Left** é o princípio que inverte essa lógica: o trabalho de segurança vai para a **esquerda** da linha do tempo de entrega, mais perto do design e do código, onde os problemas são mais baratos de evitar e mais fáceis de corrigir. É o coração do que o mercado chama de **DevSecOps**: segurança deixa de ser um portão no fim do caminho e passa a ser uma propriedade do jeito como o time constrói software, todos os dias.

Quando um time ignora esse princípio, os sintomas são bem fáceis de reconhecer:

- Revisões de segurança que só acontecem às vésperas do release, virando gargalo e briga de última hora;
- Vulnerabilidades encontradas em produção que uma ferramenta gratuita na IDE teria pegado;
- Senhas, tokens e *connection strings* morando no repositório "só por enquanto";
- Dependências que ninguém atualiza há anos, com CVEs conhecidas que qualquer um pode consultar;
- Um time de segurança visto como "o departamento do não" e desenvolvedores que acham que segurança é "problema dos outros";
- Relatórios de pentest que repetem os mesmos achados ano após ano, porque nada mudou no processo;

Pois é, *é raro, mas acontece bastante*... Quem nunca abriu um repositório antigo e encontrou um `appsettings.Production.json` com a senha real do banco ali, commitada em 2019, por alguém que saiu da empresa em 2020?

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Mas a gente tem um time de segurança pra isso, né? Meu trabalho é entregar feature. Eles rodam o scanner deles antes de subir pra produção e pronto."</span>
    </div>
  </div>
</div>

Calma lá, Júnior! Esse é exatamente o *mindset* que este princípio existe para corrigir. O time de segurança não pode ser a única linha de defesa, por um motivo bem simples: normalmente existe um punhado de pessoas de segurança para dezenas (ou centenas) de desenvolvedores. Se cada linha de código precisar passar pela mão delas no final, ou elas viram gargalo, ou começam a aprovar sem olhar. Nenhuma das opções termina bem.

<div class="callout info">
  <p>Fazer <em>shift-left</em> não significa jogar todo o trabalho de segurança no colo do desenvolvedor. Significa colocar o <strong>controle certo na fase certa</strong>, automatizar o que dá para automatizar e deixar o time de segurança atuar como habilitador e especialista, em vez de ser o último checkpoint.</p>
</div>

## Por que mais cedo sai mais barato

Existe uma ideia antiga na engenharia de software: quanto mais tarde um defeito é encontrado, mais caro fica corrigir. Você vai achar muitos artigos citando multiplicadores precisos ("100 vezes mais caro em produção!"), e boa parte desses números tem origem duvidosa. A gente não precisa deles. A **tendência** é óbvia para quem já viveu isso na pele:

- No **design**, corrigir uma falha de segurança significa mudar um diagrama ou um parágrafo de documento;
- No **desenvolvimento**, significa mudar algumas linhas antes que alguém dependa delas;
- Depois do **merge**, significa nova branch, nova revisão, talvez retrabalho em código do qual outras features já dependem;
- Em **homologação**, significa reabrir uma história fechada, testar de novo e possivelmente mexer na data do release;
- Em **produção**, significa incidente, hotfix sob pressão, talvez notificação de clientes, advogados, ANPD e uma reunião bem desconfortável com a diretoria.

E o custo não é só dinheiro. Quanto mais para a direita uma vulnerabilidade viaja, mais contexto se perde. Quem escreveu o código já está em outra, a regra de negócio que justificava aquilo ficou nebulosa e a correção acaba feita por alguém que tem medo de mexer.

A figura abaixo mostra o ciclo de entrega típico, onde cada controle de segurança vive naturalmente e a tendência ilustrativa de como o custo de correção cresce conforme você vai para a direita.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 760 350" role="img" aria-labelledby="ssl-d1-title ssl-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="ssl-d1-title">Controles de segurança ao longo do ciclo de entrega</title>
<desc id="ssl-d1-desc">Oito fases do ciclo, do design à operação, o controle de segurança que vive em cada uma e barras mostrando que o custo de corrigir uma vulnerabilidade cresce quanto mais tarde ela é encontrada. Uma seta na parte de baixo indica mover os controles para a esquerda.</desc>
<defs><marker id="ssl-d1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-accent"/></marker></defs>
<text x="380" y="26" text-anchor="middle" class="d-label">ONDE CADA CONTROLE VIVE</text>
<rect x="17" y="44" width="82" height="44" rx="10" class="d-box-accent"/>
<text x="58" y="71" text-anchor="middle" class="d-text">Design</text>
<rect x="109" y="44" width="82" height="44" rx="10" class="d-box-accent"/>
<text x="150" y="71" text-anchor="middle" class="d-text">Código</text>
<rect x="201" y="44" width="82" height="44" rx="10" class="d-box-accent"/>
<text x="242" y="71" text-anchor="middle" class="d-text">Commit</text>
<rect x="293" y="44" width="82" height="44" rx="10" class="d-box-info"/>
<text x="334" y="71" text-anchor="middle" class="d-text">Build</text>
<rect x="385" y="44" width="82" height="44" rx="10" class="d-box-info"/>
<text x="426" y="71" text-anchor="middle" class="d-text">Teste</text>
<rect x="477" y="44" width="82" height="44" rx="10" class="d-box-info"/>
<text x="518" y="71" text-anchor="middle" class="d-text">Release</text>
<rect x="569" y="44" width="82" height="44" rx="10" class="d-box-warn"/>
<text x="610" y="71" text-anchor="middle" class="d-text">Deploy</text>
<rect x="661" y="44" width="82" height="44" rx="10" class="d-box-danger"/>
<text x="702" y="71" text-anchor="middle" class="d-text">Operação</text>
<text x="58" y="112" text-anchor="middle" class="d-small">STRIDE</text>
<text x="58" y="128" text-anchor="middle" class="d-small">Requisitos</text>
<text x="150" y="112" text-anchor="middle" class="d-small">Linters IDE</text>
<text x="150" y="128" text-anchor="middle" class="d-small">Padrões</text>
<text x="242" y="112" text-anchor="middle" class="d-small">Pre-commit</text>
<text x="242" y="128" text-anchor="middle" class="d-small">Segredos</text>
<text x="334" y="112" text-anchor="middle" class="d-small">SAST, SCA</text>
<text x="334" y="128" text-anchor="middle" class="d-small">Scan de IaC</text>
<text x="426" y="112" text-anchor="middle" class="d-small">DAST</text>
<text x="426" y="128" text-anchor="middle" class="d-small">Scan imagem</text>
<text x="518" y="112" text-anchor="middle" class="d-small">SBOM, assina</text>
<text x="518" y="128" text-anchor="middle" class="d-small">Proveniência</text>
<text x="610" y="112" text-anchor="middle" class="d-small">Verifica</text>
<text x="610" y="128" text-anchor="middle" class="d-small">Política</text>
<text x="702" y="112" text-anchor="middle" class="d-small">Runtime</text>
<text x="702" y="128" text-anchor="middle" class="d-small">Pilar Seg.</text>
<text x="17" y="166" class="d-label">CUSTO DE CORREÇÃO (TENDÊNCIA)</text>
<line x1="17" y1="290" x2="743" y2="290" class="d-line"/>
<rect x="38" y="280" width="40" height="10" rx="3" class="d-fill-accent"/>
<rect x="130" y="274" width="40" height="16" rx="3" class="d-fill-accent"/>
<rect x="222" y="268" width="40" height="22" rx="3" class="d-fill-accent"/>
<rect x="314" y="258" width="40" height="32" rx="3" class="d-fill-info"/>
<rect x="406" y="244" width="40" height="46" rx="3" class="d-fill-info"/>
<rect x="498" y="228" width="40" height="62" rx="3" class="d-fill-warn"/>
<rect x="590" y="210" width="40" height="80" rx="3" class="d-fill-warn"/>
<rect x="682" y="186" width="40" height="104" rx="3" class="d-fill-danger"/>
<line x1="700" y1="314" x2="60" y2="314" class="d-line-accent" marker-end="url(#ssl-d1-arrow)"/>
<text x="380" y="338" text-anchor="middle" class="d-label">SHIFT LEFT: PEGUE MAIS CEDO</text>
</svg>
</div>
<figcaption>Figura 1: Controles de segurança ao longo do ciclo e a tendência ilustrativa de custo (não são valores medidos)</figcaption>
</figure>

Repare numa coisa importante na figura: fazer *shift-left* não significa remover os controles da direita. Proteção em *runtime*, monitoramento e resposta a incidentes continuam lá (e pertencem ao [pilar de Segurança](/pt-br/principles/cloud/security/), onde falamos de Zero Trust, identidade, segmentação de rede e SIEM). A ideia é que os controles da direita virem a **última** rede de proteção, não a **única**.

## A chave de API da sexta à noite

Deixa eu contar uma história. Talvez você já tenha ouvido uma versão dela, ou até vivido uma.

Sexta-feira, 23h. Um desenvolvedor está terminando de casa uma integração pequena com um provedor de nuvem. Para testar rapidinho, cola a chave de acesso direto num arquivo de configuração. Funcionou! Feliz da vida, roda `git add .`, `git commit -m "fix"`, `git push` e vai dormir. O repositório é público, uma biblioteca utilitária open source que o time mantém.

O que ele não sabe é que existem bots vigiando o tempo todo os commits públicos no GitHub, procurando exatamente esse tipo de padrão. Em questão de minutos (às vezes menos), a chave foi encontrada. No sábado de manhã, alguém já subiu dezenas de instâncias grandes com GPU em regiões que a empresa nunca usou, minerando criptomoeda na conta da empresa. Na segunda-feira, o financeiro quer saber por que a fatura da nuvem parece um número de telefone.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior preocupado" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Tá, mas isso é fácil de resolver, né? É só apagar o commit e dar um force push. Ninguém nunca vai ver."</span>
    </div>
  </div>
</div>

Ah, Júnior... O Git tem memória longa. O commit continua vivo em forks, em clones, em caches, no banco de dados do bot e no histórico de qualquer um que tenha feito pull nesse meio tempo. **Depois que um segredo foi publicado num lugar público, ele está comprometido. Ponto.** A única correção de verdade é **revogar e rotacionar** a credencial e depois ir atrás do que foi feito com ela.

Agora olha quantos controles de *shift-left* poderiam ter evitado essa história, cada um mais cedo e mais barato que o anterior:

- Um **cofre de segredos** (Azure Key Vault, AWS Secrets Manager, HashiCorp Vault) e credenciais de curta duração, para que nem exista uma chave de longa duração para colar;
- Um **hook de pre-commit** com scanner de segredos (como gitleaks ou detect-secrets) que recusa o commit na máquina do desenvolvedor;
- **Push protection** na plataforma de hospedagem, que bloqueia o push quando aparece um padrão de segredo conhecido;
- **Secret scanning** no pipeline e em todo o histórico do repositório;
- **Alertas de orçamento e menor privilégio** na conta de nuvem, para que mesmo uma chave vazada cause um estrago limitado (e alguém seja acionado no sábado, não na segunda).

Perceba que os quatro primeiros estão todos à esquerda. O último é a rede de proteção. Esse é o princípio resumido.

## Comece no design: requisitos e modelagem de ameaças

O ponto mais à esquerda possível é o quadro branco. Antes de uma única linha de código, o time já consegue responder perguntas como: que dados essa funcionalidade manipula? Quem deveria ter acesso? O que acontece se alguém tentar abusar dela?

### 1. Escreva requisitos de segurança como qualquer outro requisito

Requisito de segurança não pode ser uma frase genérica do tipo "o sistema deve ser seguro". Ele precisa ser concreto e testável, escrito nas histórias, igualzinho aos requisitos funcionais:

- "Só o dono da conta e o pessoal de suporte com a role `billing:read` podem ver as faturas";
- "Dados pessoais são criptografados em repouso e nunca são gravados nos logs da aplicação";
- "O link de redefinição de senha expira em 30 minutos e só pode ser usado uma vez";
- "Tentativas de login com falha têm *rate limit* por conta e por IP".

**Meta:** fazer da segurança parte da definição de pronto, não uma fase extra.
**Benefício:** requisitos claros no design viram casos de teste, e casos de teste viram verificações automatizadas.

### 2. Modelagem de ameaças com STRIDE

*Threat modeling* parece coisa sofisticada, mas no fundo é uma conversa estruturada em torno de quatro perguntas (popularizadas por Adam Shostack): **O que estamos construindo? O que pode dar errado? O que vamos fazer a respeito? Fizemos um bom trabalho?**

O time desenha um diagrama simples de fluxo de dados da funcionalidade (usuários, serviços, bancos de dados, fronteiras de confiança) e percorre cada elemento perguntando "o que pode dar errado aqui?". Para ninguém ficar olhando para o quadro em silêncio, o **STRIDE** oferece seis categorias de ameaças para pensar, cada uma violando uma propriedade de segurança específica:

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="ssl-d2-title ssl-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="ssl-d2-title">As categorias de ameaça do STRIDE</title>
<desc id="ssl-d2-desc">Uma grade com seis caixas, uma para cada categoria do STRIDE: spoofing, tampering, repudiation, information disclosure, denial of service e elevation of privilege, cada uma com a propriedade de segurança que viola e uma mitigação típica.</desc>
<text x="360" y="28" text-anchor="middle" class="d-label">STRIDE: SEIS PERGUNTAS POR ELEMENTO</text>
<rect x="20" y="48" width="220" height="110" rx="10" class="d-box-accent"/>
<text x="130" y="80" text-anchor="middle" class="d-title">Spoofing</text>
<text x="130" y="108" text-anchor="middle" class="d-small">viola autenticação</text>
<text x="130" y="130" text-anchor="middle" class="d-small">mitigação: MFA, mTLS</text>
<rect x="250" y="48" width="220" height="110" rx="10" class="d-box-accent"/>
<text x="360" y="80" text-anchor="middle" class="d-title">Tampering</text>
<text x="360" y="108" text-anchor="middle" class="d-small">viola integridade</text>
<text x="360" y="130" text-anchor="middle" class="d-small">mitigação: assinatura, hash</text>
<rect x="480" y="48" width="220" height="110" rx="10" class="d-box-accent"/>
<text x="590" y="80" text-anchor="middle" class="d-title">Repudiation</text>
<text x="590" y="108" text-anchor="middle" class="d-small">viola não repúdio</text>
<text x="590" y="130" text-anchor="middle" class="d-small">mitigação: logs de auditoria</text>
<rect x="20" y="170" width="220" height="110" rx="10" class="d-box-info"/>
<text x="130" y="202" text-anchor="middle" class="d-title">Info disclosure</text>
<text x="130" y="230" text-anchor="middle" class="d-small">viola confidencialidade</text>
<text x="130" y="252" text-anchor="middle" class="d-small">mitigação: criptografia</text>
<rect x="250" y="170" width="220" height="110" rx="10" class="d-box-info"/>
<text x="360" y="202" text-anchor="middle" class="d-title">Denial of service</text>
<text x="360" y="230" text-anchor="middle" class="d-small">viola disponibilidade</text>
<text x="360" y="252" text-anchor="middle" class="d-small">mitigação: rate limit</text>
<rect x="480" y="170" width="220" height="110" rx="10" class="d-box-info"/>
<text x="590" y="202" text-anchor="middle" class="d-title">Elevation of privilege</text>
<text x="590" y="230" text-anchor="middle" class="d-small">viola autorização</text>
<text x="590" y="252" text-anchor="middle" class="d-small">mitigação: menor privilégio</text>
</svg>
</div>
<figcaption>Figura 2: STRIDE, as seis categorias de ameaça e a propriedade que cada uma ataca</figcaption>
</figure>

Uma sessão de modelagem de ameaças para uma única funcionalidade não precisa levar dias. Uma hora com o desenvolvedor, o tech lead e (idealmente) um *security champion* costuma bastar para achar as duas ou três coisas que realmente importam. Ferramentas como o OWASP Threat Dragon ou o Microsoft Threat Modeling Tool ajudam, mas um quadro branco e gente honesta funcionam igualmente bem.

**Meta:** encontrar falhas de design enquanto elas ainda são só linhas num diagrama.
**Benefício:** falhas de design são as mais caras de corrigir depois, porque nenhum scanner vai descobrir que "esquecemos de checar quem é o dono da fatura". Isso é problema de lógica, e só gente que entende o negócio pega.

<div class="callout tip">
  <p>Não tente modelar o sistema inteiro de uma vez. Modele <strong>mudanças</strong>: uma nova integração, um novo endpoint público, um novo tipo de dado. Sessões pequenas e frequentes ganham de um workshop gigante anual que ninguém lembra.</p>
</div>

### 3. Use referências em vez de reinventar a roda

O **OWASP Top 10** é a lista clássica dos riscos de segurança mais críticos em aplicações web (controle de acesso quebrado, injeção, falhas criptográficas, configuração insegura, componentes vulneráveis e por aí vai). Não é um padrão completo, mas é um vocabulário excelente para o time e um bom checklist inicial para revisões de design. O **OWASP ASVS** vai mais fundo, com requisitos verificáveis que você pode transformar em critérios de aceite.

E para avaliar a maturidade do programa como um todo, o **OWASP SAMM** (*Software Assurance Maturity Model*) divide o desenvolvimento seguro em funções de negócio (governança, design, implementação, verificação e operações), com níveis de maturidade para cada prática. É um ótimo jeito de responder "onde estamos e o que devemos melhorar a seguir?" sem contratar uma consultoria.

## Código seguro: padrões e a máquina do desenvolvedor

Com o design redondo, o próximo lugar para pegar problemas é onde o código nasce.

### 1. Padrões de codificação segura

Combinem, como time, como as coisas sensíveis do dia a dia são feitas: como consultar o banco (queries parametrizadas, sempre), como validar entrada, como fazer *encoding* de saída, como tratar erros sem vazar *stack trace*, como logar sem gravar dados pessoais, quais bibliotecas de criptografia são permitidas. O OWASP Cheat Sheet Series é uma ótima base para começar.

O segredo é manter o padrão **curto e prático**, com exemplos na sua própria stack, e conectá-lo aos esforços de [Padronização](/pt-br/principles/enterprise/standardization/) da empresa. Um PDF de 90 páginas que ninguém lê não é padrão, é enfeite.

### 2. Feedback na IDE

Linters de segurança e plugins de IDE dão feedback enquanto o desenvolvedor digita, que é o momento mais barato possível: sem troca de contexto, sem ticket, sem reunião. Uma linha ondulada embaixo de `"SELECT * FROM users WHERE id = " + id` ensina mais do que um treinamento anual.

### 3. Hooks de pre-commit e scan de segredos

Hooks de pre-commit rodam na máquina do desenvolvedor antes de o commit ser criado. São perfeitos para verificações rápidas: scan de segredos, formatação, bloqueio de binários grandes, lint básico. Frameworks como o `pre-commit` facilitam compartilhar os mesmos hooks com todo o time por meio de um arquivo de configuração no repositório.

<div class="callout warning">
  <p>Hooks de pre-commit são <strong>conveniência, não controle</strong>. Qualquer um pode pular com <code>--no-verify</code> ou simplesmente nunca instalar. Sempre repita as verificações críticas (principalmente o scan de segredos) do lado do servidor: push protection e pipeline.</p>
</div>

## Segurança no pipeline

O pipeline de CI é onde o *shift-left* vira sistemático. Toda mudança passa por ele, então é o lugar natural para automatizar verificações que seriam impossíveis de fazer na mão. Vamos às principais famílias.

### 1. SAST (Static Application Security Testing)

Ferramentas de SAST analisam o código-fonte sem executá-lo, procurando padrões que levam a vulnerabilidades: injeção, desserialização insegura, segredos *hardcoded*, criptografia fraca, *path traversal*. Exemplos: Semgrep, CodeQL, SonarQube e várias opções comerciais.

**Benefício:** feedback rápido direto no pull request, apontando a linha exata.
**Cuidado:** SAST gera falso positivo, e muito, se você ligar todas as regras. Comece com um conjunto curado de regras de alta confiança e vá crescendo.

### 2. SCA (Software Composition Analysis) e SBOMs

A maior parte do código que roda na sua aplicação não foi escrita pelo seu time. Ela veio de pacotes open source, que trazem suas próprias dependências, que trazem as delas. Ferramentas de SCA (Dependabot, Renovate, Snyk, OWASP Dependency-Check, Trivy e outras) comparam sua árvore de dependências com bases de vulnerabilidades e dizem quais pacotes têm CVEs conhecidas, muitas vezes já abrindo o pull request de atualização para você.

Bem relacionado a isso está o **SBOM** (*Software Bill of Materials*): uma lista legível por máquina de todos os componentes dentro do seu artefato, em formatos padrão como **CycloneDX** ou **SPDX**. Parece burocracia até o dia em que uma vulnerabilidade crítica atinge uma biblioteca popular e seu chefe pergunta "a gente foi afetado?". Com SBOM de cada release, a resposta leva minutos. Sem ele, leva uma semana de grep em repositório.

**Benefício:** visibilidade do que você realmente entrega e resposta rápida quando a próxima grande CVE aparecer.

### 3. Scan de IaC

Se sua infraestrutura é código (e deveria ser, veja [Excelência Operacional](/pt-br/principles/cloud/operational-excellence/)), então as configurações erradas dela são bugs que você consegue pegar antes de existirem. Ferramentas como Checkov, tfsec/Trivy, KICS e motores de política nativos da nuvem sinalizam buckets públicos, security groups abertos, criptografia desligada, logs ausentes e roles de IAM amplas demais direto no pull request.

**Benefício:** "alguém deixou o bucket público" deixa de ser manchete e vira um check falhando numa terça à tarde.

### 4. Scan de imagens de container

Imagens de container carregam uma camada inteira de sistema operacional junto com a sua aplicação. Scanners como Trivy ou Grype verificam a imagem base e os pacotes instalados atrás de vulnerabilidades conhecidas. Junte isso com boa higiene: imagens base mínimas ou *distroless*, versões fixadas (de preferência por *digest*), usuário não root e rebuilds regulares para que os patches cheguem de fato em produção.

### 5. DAST (Dynamic Application Security Testing)

O DAST testa a aplicação rodando, de fora para dentro, como um atacante faria: navega pelos endpoints, envia payloads maliciosos e observa as respostas. O OWASP ZAP é a opção open source clássica. O DAST encontra coisas que a análise estática não enxerga, como headers mal configurados, problemas de autenticação e comportamento do servidor, mas é mais lento e normalmente roda contra um ambiente de teste ou homologação, não a cada commit.

| Abordagem | Benefício |
|---|---|
| **Modelagem de ameaças** | Pega falhas de design e de lógica que nenhuma ferramenta enxerga |
| **Pre-commit e push protection** | Barra segredos antes de saírem da máquina |
| **SAST** | Feedback em nível de linha sobre padrões inseguros, direto no PR |
| **SCA e SBOM** | Visibilidade e alertas de componentes de terceiros vulneráveis |
| **Scan de IaC** | Bloqueia configuração insegura de nuvem antes de ser provisionada |
| **Scan de imagem** | Encontra pacotes de SO vulneráveis e más práticas de container |
| **DAST** | Testa a aplicação rodando do jeito que um atacante faria |
| **Assinatura e proveniência** | Prova que o artefato é o que seu pipeline gerou, sem alteração |

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior empolgado" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Show! Então vou ligar todos os scanners, colocar todas as regras no máximo e quebrar o build com qualquer achado. Segurança máxima!"</span>
    </div>
  </div>
</div>

Segura aí, Júnior! Esse é o jeito mais rápido de fazer o time inteiro odiar segurança. Liga tudo no máximo numa base de código legada e você vai ter dois mil achados na primeira execução, metade falso positivo, e um pipeline que nunca mais fica verde. Em uma semana, alguém coloca um `continue-on-error: true` e você volta à estaca zero, só que agora com um time que ignora alerta de segurança. Já já a gente fala de como tratar os achados.

## Segurança da cadeia de suprimentos de software

Um pensamento desconfortável: você pode escrever um código perfeitamente seguro e ainda assim entregar algo malicioso. Ataques como o comprometimento do build da SolarWinds, a tentativa de backdoor no `xz` e uma enxurrada constante de pacotes com *typosquatting* ou sequestrados mostraram que atacantes adoram a cadeia de suprimentos: as dependências, o sistema de build e o caminho do código-fonte até a produção.

Protegê-la significa responder, com evidência: **esse artefato foi mesmo gerado a partir desse código, por esse pipeline, sem adulteração?**

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 760 290" role="img" aria-labelledby="ssl-d3-title ssl-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="ssl-d3-title">Uma cadeia de suprimentos de software protegida</title>
<desc id="ssl-d3-desc">Cinco etapas do código ao deploy: código revisado, um build endurecido que gera proveniência, um artefato assinado com SBOM, um registry que o escaneia e um deploy que verifica assinatura e política antes de admiti-lo. Proveniência e assinatura acompanham o artefato até a verificação.</desc>
<defs><marker id="ssl-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="380" y="28" text-anchor="middle" class="d-label">DO CÓDIGO À PRODUÇÃO, COM EVIDÊNCIA</text>
<rect x="10" y="60" width="128" height="96" rx="10" class="d-box"/>
<text x="74" y="90" text-anchor="middle" class="d-title">Código</text>
<text x="74" y="116" text-anchor="middle" class="d-small">PRs revisados</text>
<text x="74" y="134" text-anchor="middle" class="d-small">branch protegida</text>
<rect x="163" y="60" width="128" height="96" rx="10" class="d-box-info"/>
<text x="227" y="90" text-anchor="middle" class="d-title">Build</text>
<text x="227" y="116" text-anchor="middle" class="d-small">runner endurecido</text>
<text x="227" y="134" text-anchor="middle" class="d-small">gera proveniência</text>
<rect x="316" y="60" width="128" height="96" rx="10" class="d-box-accent"/>
<text x="380" y="90" text-anchor="middle" class="d-title">Artefato</text>
<text x="380" y="116" text-anchor="middle" class="d-small">SBOM anexado</text>
<text x="380" y="134" text-anchor="middle" class="d-small">assinado (cosign)</text>
<rect x="469" y="60" width="128" height="96" rx="10" class="d-box-info"/>
<text x="533" y="90" text-anchor="middle" class="d-title">Registry</text>
<text x="533" y="116" text-anchor="middle" class="d-small">imagem escaneada</text>
<text x="533" y="134" text-anchor="middle" class="d-small">tags imutáveis</text>
<rect x="622" y="60" width="128" height="96" rx="10" class="d-box-accent"/>
<text x="686" y="90" text-anchor="middle" class="d-title">Deploy</text>
<text x="686" y="116" text-anchor="middle" class="d-small">verifica assinatura</text>
<text x="686" y="134" text-anchor="middle" class="d-small">gate de política</text>
<line x1="138" y1="108" x2="161" y2="108" class="d-line" marker-end="url(#ssl-d3-arrow)"/>
<line x1="291" y1="108" x2="314" y2="108" class="d-line" marker-end="url(#ssl-d3-arrow)"/>
<line x1="444" y1="108" x2="467" y2="108" class="d-line" marker-end="url(#ssl-d3-arrow)"/>
<line x1="597" y1="108" x2="620" y2="108" class="d-line" marker-end="url(#ssl-d3-arrow)"/>
<line x1="227" y1="186" x2="686" y2="186" class="d-line-dashed"/>
<line x1="227" y1="156" x2="227" y2="186" class="d-line-dashed"/>
<line x1="686" y1="186" x2="686" y2="158" class="d-line-dashed" marker-end="url(#ssl-d3-arrow)"/>
<text x="456" y="208" text-anchor="middle" class="d-small">proveniência e assinatura viajam com o artefato</text>
<rect x="163" y="228" width="434" height="44" rx="10" class="d-box-danger"/>
<text x="380" y="255" text-anchor="middle" class="d-text">Artefato sem assinatura? Rejeitado.</text>
</svg>
</div>
<figcaption>Figura 3: Uma cadeia de suprimentos em que cada etapa deixa evidências que a próxima consegue verificar</figcaption>
</figure>

### 1. SLSA

O **SLSA** (*Supply-chain Levels for Software Artifacts*, pronuncia-se "salsa") é um framework da OpenSSF que define níveis incrementais de garantia sobre como os artefatos são gerados. Nos níveis mais baixos, você basicamente documenta como o build acontece e gera **proveniência**: uma declaração assinada dizendo qual código, qual builder e quais parâmetros produziram o artefato. Nos níveis mais altos, o build roda numa plataforma endurecida e isolada, onde nem uma conta de desenvolvedor comprometida consegue forjar essa proveniência.

A beleza do SLSA é ser incremental. Você não precisa chegar ao nível máximo para ter valor; só de gerar proveniência você já está à frente de boa parte do mercado.

### 2. Artefatos assinados com Sigstore e cosign

Assinar artefatos costumava ser sofrido por causa da gestão de chaves: onde guardar a chave privada, quem rotaciona, o que acontece se ela vazar? O **Sigstore** mudou isso com a assinatura *keyless*: o **cosign** assina o artefato usando um certificado de curta duração atrelado à identidade do pipeline (via OIDC), e a assinatura fica registrada num log público de transparência (Rekor). Do outro lado, a etapa de deploy (por exemplo, um *admission controller* do Kubernetes como o Kyverno ou o policy controller do Sigstore) verifica se a imagem foi assinada pelo **seu** pipeline antes de deixá-la rodar.

### 3. Higiene de dependências

- Fixe versões com *lock files* e verifique os hashes de integridade;
- Use um proxy ou mirror privado de pacotes, para controlar o que entra;
- Desconfie de pacotes novinhos com nomes muito parecidos com os populares (*typosquatting*);
- Revise o que uma atualização realmente muda antes de fazer merge automático, principalmente scripts de instalação;
- Avalie a saúde do que você adota: é mantido? Tem mais de um mantenedor? O OpenSSF Scorecard ajuda nisso.

### 4. Endureça o próprio pipeline

Seu sistema de CI/CD tem as chaves da produção, o que faz dele um dos alvos mais atraentes que você tem. Trate-o assim:

- **Menor privilégio** para as identidades do pipeline, separadas por ambiente, com credenciais de produção disponíveis só em branches protegidas;
- **Federação OIDC** em vez de chaves de nuvem de longa duração guardadas como segredo do pipeline;
- **Fixe actions e plugins de terceiros** por hash de commit, não por uma tag que pode mudar;
- **Branches protegidas e revisão obrigatória**, para que ninguém (nem admin) dê push direto na main;
- **Runners efêmeros**, para que um build não deixe nada para trás para o próximo;
- **Não rode código não confiável com segredos**: pull requests vindos de forks não devem ter acesso às credenciais de deploy;
- **Logs de auditoria** das mudanças no pipeline, porque mudar o pipeline é mudar a produção.

## Tratando achados sem travar tudo

É aqui que muita iniciativa de DevSecOps morre. As ferramentas são instaladas, os scanners rodam e aí... milhares de achados, um pipeline vermelho e um time que aprende a ignorar segurança do mesmo jeito que ignora o alarme de carro no estacionamento.

A solução é um processo de triagem que trata achados como qualquer outro trabalho: priorizado, com dono e com prazo.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 740 310" role="img" aria-labelledby="ssl-d4-title ssl-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="ssl-d4-title">Triagem de achados de segurança</title>
<desc id="ssl-d4-desc">Um achado de scanner passa por deduplicação e triagem e segue um de quatro caminhos: achados críticos bloqueiam o merge, achados altos viram tickets com prazo de correção, médios e baixos vão para o backlog e falsos positivos são suprimidos com motivo e data de validade.</desc>
<defs><marker id="ssl-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="370" y="24" text-anchor="middle" class="d-label">TODO ACHADO GANHA UM CAMINHO, NÃO UM PÂNICO</text>
<rect x="20" y="128" width="140" height="70" rx="10" class="d-box"/>
<text x="90" y="158" text-anchor="middle" class="d-title">Achado</text>
<text x="90" y="180" text-anchor="middle" class="d-small">de qualquer scanner</text>
<line x1="160" y1="163" x2="198" y2="163" class="d-line" marker-end="url(#ssl-d4-arrow)"/>
<rect x="200" y="128" width="150" height="70" rx="10" class="d-box-info"/>
<text x="275" y="158" text-anchor="middle" class="d-title">Triagem</text>
<text x="275" y="180" text-anchor="middle" class="d-small">dedup, contexto</text>
<rect x="420" y="40" width="300" height="54" rx="10" class="d-box-danger"/>
<text x="570" y="63" text-anchor="middle" class="d-text">Crítico: bloqueia o merge</text>
<text x="570" y="82" text-anchor="middle" class="d-small">explorável, alcançável, corrigir já</text>
<rect x="420" y="104" width="300" height="54" rx="10" class="d-box-warn"/>
<text x="570" y="127" text-anchor="middle" class="d-text">Alto: ticket com SLA</text>
<text x="570" y="146" text-anchor="middle" class="d-small">dono e prazo, o release segue</text>
<rect x="420" y="168" width="300" height="54" rx="10" class="d-box"/>
<text x="570" y="191" text-anchor="middle" class="d-text">Médio, baixo: backlog</text>
<text x="570" y="210" text-anchor="middle" class="d-small">priorizado com o resto do trabalho</text>
<rect x="420" y="232" width="300" height="54" rx="10" class="d-box-muted"/>
<text x="570" y="255" text-anchor="middle" class="d-text">Falso positivo: suprimir</text>
<text x="570" y="274" text-anchor="middle" class="d-small">com motivo e data de validade</text>
<line x1="350" y1="163" x2="418" y2="67" class="d-line" marker-end="url(#ssl-d4-arrow)"/>
<line x1="350" y1="163" x2="418" y2="131" class="d-line" marker-end="url(#ssl-d4-arrow)"/>
<line x1="350" y1="163" x2="418" y2="195" class="d-line" marker-end="url(#ssl-d4-arrow)"/>
<line x1="350" y1="163" x2="418" y2="259" class="d-line" marker-end="url(#ssl-d4-arrow)"/>
</svg>
</div>
<figcaption>Figura 4: Limites de severidade e triagem transformam uma enxurrada de alertas num fluxo administrável</figcaption>
</figure>

### 1. Limites de severidade

Decidam, como time e junto com o pessoal de segurança, o que realmente quebra o build. Um ponto de partida comum: só achados **novos** de severidade **crítica** (e talvez alta, quando a casa estiver arrumada) bloqueiam o merge. Todo o resto é reportado, visível e acompanhado, mas não trava a entrega.

Severidade sozinha não é tudo, porém. Contexto importa: uma CVE crítica numa função de biblioteca que você nunca chama é menos urgente que uma média no seu endpoint público de login. Análise de alcançabilidade (*reachability*), o score EPSS e o catálogo KEV da CISA (vulnerabilidades sabidamente exploradas) ajudam a separar o "teoricamente ruim" do "sendo explorado agora".

### 2. Faça uma baseline do legado

Em bases de código existentes, tire uma **baseline**: registre os achados atuais e bloqueie só os **novos**. A dívida antiga vai para um backlog com um plano para ser queimada. Assim o pipeline fica verde no primeiro dia e a regra "não piore" passa a valer daí em diante.

### 3. SLAs por severidade

Definam prazos de correção por severidade (por exemplo: crítico em dias, alto em algumas semanas, médio em um trimestre), combinados com o negócio e com o time de segurança. Os números exatos dependem do seu apetite a risco, o que liga isso diretamente à [Gestão de Riscos](/pt-br/principles/enterprise/risk-management/). O que importa é que todo achado tenha um **dono** e um **prazo**, e que os itens vencidos fiquem visíveis para a liderança.

### 4. Supressões com responsabilidade

Falso positivo existe, e obrigar as pessoas a "corrigir" isso é desperdício de tempo. Permita supressões, mas com regras: um motivo por escrito, um revisor e uma **data de validade** para que sejam revistas. Supressão sem motivo é só um jeito de esconder o problema.

## Faça do caminho seguro o caminho fácil

Se tem uma ideia para levar deste artigo, é esta: **desenvolvedores seguem o caminho de menor resistência**. Se o jeito seguro for mais difícil que o inseguro, sob pressão de prazo as pessoas vão pelo inseguro, não importa quantos treinamentos tenham feito. Então faça do jeito seguro o mais fácil. O mercado chama isso de *paved roads* ou *golden paths*:

- **Templates de projeto** que já vêm com pipeline, scanners, configuração de pre-commit e padrões seguros prontos;
- **Módulos de pipeline compartilhados**, para que melhorar uma verificação uma vez melhore para todos os times;
- **Bibliotecas seguras por padrão**: um cliente HTTP que valida TLS, um ORM que parametriza queries, um logger que mascara dados pessoais;
- **Imagens base endurecidas**, mantidas por um time de plataforma e reconstruídas automaticamente;
- **Cofres de segredos e identidade de workload** mais fáceis de usar do que um arquivo de configuração;
- **Mensagens claras e acionáveis** nos checks que falham: o que está errado, por que importa e como corrigir, com link.

É o mesmo raciocínio do [Design Evolutivo](/pt-br/principles/solution/evolutionary-design/): a arquitetura deve tornar fácil a mudança certa. Com segurança não é diferente.

## Security champions

Ferramenta não muda cultura; gente muda. Um **programa de security champions** escolhe desenvolvedores (voluntários, de preferência) dentro de cada time de produto, que ganham treinamento extra, tempo dedicado e uma linha direta com o time de segurança. Eles não são a polícia da segurança: são a pessoa do time que fala "bora fazer uma modelagem de ameaças rapidinho antes de construir isso?", que ajuda na triagem de achados e que leva as dores do time de volta para o pessoal de segurança.

Para funcionar:

- Dê aos champions **tempo de verdade** para isso (uma porcentagem da semana, não "no tempo livre");
- Dê **reconhecimento**: plano de carreira, visibilidade, certificações;
- Construa uma **comunidade**: encontros regulares, um canal compartilhado, palestras internas;
- Deixe que eles **influenciem** as ferramentas e os padrões, porque são eles que sabem o que dói no dia a dia.

O time de segurança, por sua vez, muda de papel: de porteiro para treinador, construindo *paved roads*, curando regras e mergulhando fundo nos problemas difíceis que realmente precisam de um especialista.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior pensativo" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Então, se a gente fizer tudo isso na esquerda, dá pra cortar o pentest e o monitoramento em runtime, né? O código já está seguro!"</span>
    </div>
  </div>
</div>

Não é bem assim, Júnior. Fazer *shift-left* reduz quantos problemas chegam em produção; não zera esse número. Novas vulnerabilidades são descobertas todos os dias em código que ontem estava "limpo", configurações se desviam do planejado e atacantes são criativos. Por isso você ainda precisa de pentests regulares, proteção em *runtime*, logs, detecção e resposta a incidentes. Pense em *shift left* **e** *shield right*. O [pilar de Segurança](/pt-br/principles/cloud/security/) cobre o lado do *runtime*, e o [Observability First](/pt-br/principles/solution/observability-first/) garante que você consiga ver o que está acontecendo quando alguma coisa passar.

## Tradeoffs

Como todo princípio, levar a segurança para a esquerda tem custos. Deixá-los explícitos é o que separa um programa maduro de uma pilha de ferramentas.

### Tradeoffs com Eficiência de Performance e velocidade de entrega

Cada scanner adiciona minutos ao pipeline. SAST num monorepo grande, DAST contra um ambiente completo e scan de imagem de muitos serviços podem transformar um build de cinco minutos num de quarenta, o que mata o feedback rápido. Mitigue rodando as verificações rápidas em todo PR (segredos, SAST incremental, SCA) e as mais pesadas em paralelo, à noite ou antes do release, e usando cache sem dó.

### Tradeoffs com Excelência Operacional

Mais ferramentas significam mais coisas para instalar, atualizar, configurar e manter funcionando. Cada scanner tem suas próprias regras, seu próprio dashboard e seus próprios falsos positivos. Sem consolidação (um lugar único para ver os achados, templates de pipeline compartilhados), o próprio ferramental de segurança vira dívida operacional.

### Falsos positivos e fadiga de alertas

Esse merece um título só para ele. Uma ferramenta que grita "lobo!" todo dia ensina as pessoas a ignorá-la, e aí o lobo de verdade entra pela porta da frente. Faça curadoria das regras, ajuste os limites, remova verificações barulhentas que nunca encontram nada real e meça a taxa de falso positivo como qualquer outra métrica de qualidade.

### Atrito para o desenvolvedor

Toda verificação bloqueante gera atrito. Um pouco de atrito é saudável (você quer que o push com a chave da nuvem falhe), mas demais leva a gambiarras: hooks desligados, supressões sem motivo, *bypasses* "temporários" que duram para sempre. O objetivo é proteção máxima com atrito mínimo, e é por isso que *paved roads* e mensagens de erro claras importam tanto.

### Tradeoffs com Otimização de Custos

Scanners comerciais, minutos extras de pipeline, armazenamento de SBOM, tempo dos champions e treinamento custam dinheiro. Mesmo assim, costuma sair bem mais barato que um incidente. Use a [Transparência de Custos](/pt-br/principles/solution/cost-transparency/) para deixar esse investimento visível e defensável, e comece pelas ótimas opções open source antes de comprar.

### Tradeoffs com Confiabilidade

Os controles de cadeia de suprimentos adicionam dependências ao seu caminho de deploy. Se o serviço de verificação de assinatura, o log de transparência ou o motor de políticas estiver fora do ar, você ainda consegue fazer o deploy de uma correção emergencial? Planeje procedimentos de *break-glass* (auditados, raros e revisados depois) para que os controles de segurança não virem um ponto único de falha no meio de um incidente.

## Conclusão

**Security Shift-Left** não é uma ferramenta que se compra, é uma mudança de **quando** e **por quem** o trabalho de segurança é feito. Requisitos de segurança e modelagem de ameaças no design, padrões seguros e feedback rápido durante o desenvolvimento, scan de segredos antes do push, SAST, SCA, scan de IaC e de imagens no pipeline, DAST antes do release e uma cadeia de suprimentos verificável do código até a produção. Cada controle na fase em que ele é mais barato e mais eficaz.

Mas as ferramentas são a parte fácil. A parte difícil é a cultura: um processo de triagem que não paralisa a entrega, *paved roads* que fazem do jeito seguro o jeito fácil, champions que levam segurança para dentro de cada time e um time de segurança que atua como parceiro, não como porteiro.

Faça isso bem, e a chave de API da sexta à noite vira um hook de pre-commit falhando e um desenvolvedor levemente irritado. O que, convenhamos, é um final muito melhor do que uma reunião na segunda de manhã sobre a fatura da nuvem.

## Próximos Passos

1. **Avalie onde você está**
Use o OWASP SAMM para ter uma foto rápida da sua maturidade e escolha as duas ou três práticas com a maior lacuna.

2. **Estanque o sangramento dos segredos**
Ative push protection e secret scanning em todos os repositórios, mova as credenciais para um cofre de segredos e rotacione tudo o que encontrar.

3. **Adicione as verificações básicas no pipeline**
Comece com SCA e um conjunto curado de regras de SAST em todo pull request, com baseline para o código legado e bloqueando só achados críticos novos.

4. **Modele as ameaças da sua próxima mudança**
Escolha a próxima funcionalidade que mexe com dado sensível ou endpoint público e faça uma sessão de STRIDE de uma hora com o time.

5. **Defina regras de triagem e SLAs**
Combinem limites de severidade, prazos por severidade e como funcionam as supressões, e deixem os achados vencidos visíveis.

6. **Proteja a cadeia de suprimentos aos poucos**
Gere SBOMs, assine seus artefatos com cosign, verifique as assinaturas no deploy e endureça as identidades do pipeline com OIDC e menor privilégio.

7. **Desenvolva pessoas, não só ferramentas**
Comece um programa de security champions e construa *paved roads* para que o caminho seguro seja sempre o mais fácil.

<div class="callout info" data-title="Referências">
  <ul>
    <li><a href="https://owasp.org/www-project-top-ten/" target="_blank" rel="noopener">OWASP Top 10</a></li>
    <li><a href="https://owaspsamm.org/" target="_blank" rel="noopener">OWASP SAMM (Software Assurance Maturity Model)</a></li>
    <li><a href="https://owasp.org/www-project-application-security-verification-standard/" target="_blank" rel="noopener">OWASP Application Security Verification Standard (ASVS)</a></li>
    <li><a href="https://cheatsheetseries.owasp.org/" target="_blank" rel="noopener">OWASP Cheat Sheet Series</a></li>
    <li><a href="https://slsa.dev/" target="_blank" rel="noopener">SLSA: Supply-chain Levels for Software Artifacts</a></li>
    <li><a href="https://www.sigstore.dev/" target="_blank" rel="noopener">Sigstore</a></li>
    <li><a href="https://cyclonedx.org/" target="_blank" rel="noopener">CycloneDX, padrão de SBOM</a></li>
    <li><a href="https://csrc.nist.gov/projects/ssdf" target="_blank" rel="noopener">NIST Secure Software Development Framework (SSDF)</a></li>
    <li><a href="https://learn.microsoft.com/azure/well-architected/security/" target="_blank" rel="noopener">Azure Well-Architected Framework: Segurança</a></li>
    <li><a href="https://aws.amazon.com/architecture/well-architected/" target="_blank" rel="noopener">AWS Well-Architected Framework</a></li>
  </ul>
</div>
