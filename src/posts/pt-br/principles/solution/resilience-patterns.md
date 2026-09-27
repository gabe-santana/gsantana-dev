---
title: Padrões de resiliência
short: Tudo falha uma hora ou outra, então projete seu código para dobrar em vez de quebrar. Afinal, quem quer que uma API lenta derrube o checkout inteiro junto com ela?
category: solution
---

## Introdução

Uma verdade incômoda sobre sistemas distribuídos: **sempre tem alguma coisa falhando**. Um banco rodando uma *query* lenta, uma API de terceiro num dia ruim, um DNS demorando para resolver, um *pod* sendo reagendado bem no meio da sua requisição. A pergunta nunca é *se* uma dependência vai falhar, e sim *o que o seu código faz quando isso acontecer*.

Os **padrões de resiliência** são a resposta para essa pergunta no nível do código e da solução. São uma caixa de ferramentas de técnicas conhecidas (*timeouts*, *retries*, *circuit breakers*, *bulkheads*, *fallbacks*, filas e mais algumas) que permitem ao sistema **degradar com controle em vez de falhar por completo**. O objetivo não é impedir a falha; é contê-la, para que um problema num canto do sistema fique naquele canto.

Quando o time ignora esse princípio, os sintomas são dolorosamente conhecidos:

- Uma única dependência lenta congela a aplicação inteira, até as partes que nem usam essa dependência;
- *Thread pools* e *connection pools* se esgotam durante o incidente, e o serviço para de responder aos *health checks*;
- *Retries* bem-intencionados transformam um soluço em uma indisponibilidade completa (a famosa *retry storm*);
- O cliente é cobrado duas vezes porque a requisição foi repetida e a operação não era idempotente;
- Uma funcionalidade não crítica (recomendações, um banner, um pixel de rastreamento) derruba uma crítica (pagamento, login);
- Todo *post-mortem* termina com "precisamos colocar um *timeout* ali", e ninguém coloca;

Pois é, *é raro, mas acontece bastante*... Quem nunca viu um *dashboard* ficar vermelho por causa de um serviço que ninguém nem lembrava que estava no caminho da requisição?

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Mas o nosso provedor de nuvem garante 99,99% de disponibilidade. Se a infraestrutura não falha, pra que eu preciso de todos esses padrões no código?"</span>
    </div>
  </div>
</div>

Calma aí, Júnior! Esses 99,99% valem para **um** serviço, medido do jeito do provedor. O seu checkout provavelmente chama um banco de dados, um cache, um *gateway* de pagamento, um serviço de estoque, uma checagem antifraude e um motor de recomendação. Disponibilidades se multiplicam: seis dependências a 99,9% cada dão mais ou menos 99,4% se todas forem obrigatórias, o que passa de dois dias fora do ar por ano. E nenhum desses SLAs cobre o problema mais comum de todos: a dependência que está **no ar, mas lenta**.

A rede não é confiável, a latência não é zero e a banda não é infinita. Essas são as clássicas *falácias da computação distribuída*, e todo padrão de resiliência existe porque alguém, em algum lugar, acreditou em uma delas.

<div class="callout info">
  <p>Este princípio trata do que acontece <strong>dentro do seu código e do desenho da sua solução</strong>: como um serviço se comporta quando as dependências dele se comportam mal. Redundância de infraestrutura, zonas de disponibilidade, SLOs, <em>error budgets</em> e recuperação de desastres ficam no pilar de <a href="/pt-br/principles/cloud/reliability/">Confiabilidade</a>. Os dois andam juntos: infraestrutura redundante adianta pouco se uma única chamada lenta ainda consegue esgotar todas as suas <em>threads</em>.</p>
</div>

## Anatomia de uma falha em cascata

Deixa eu contar uma história que, com pequenas variações, já vi acontecer em mais de uma empresa.

É Black Friday. A página de checkout chama três serviços: **Pagamento**, **Estoque** e um **Recomendador** que mostra "quem comprou também levou" no rodapé da página. O recomendador é o menos importante dos três; se ele sumisse, a maioria dos clientes nem perceberia.

Aí o banco de dados do recomendador começa a sofrer com a carga. Ele não cai. Só fica lento: cada chamada passa a levar 30 segundos em vez de 50 milissegundos. O serviço de checkout não tem *timeout* nessa chamada (o padrão do cliente HTTP estava bom, né?), então toda requisição de checkout fica ali parada, segurando uma *thread* e uma conexão, esperando as recomendações.

Em poucos minutos, todas as *threads* do checkout estão bloqueadas esperando o recomendador. Novas requisições entram na fila. Os *health checks* do *load balancer* estouram o tempo, as instâncias são marcadas como não saudáveis e recicladas, o que joga ainda mais carga nas sobreviventes. Pagamento e Estoque estão perfeitamente saudáveis, mas ninguém consegue comprar nada. **Uma dependência lenta e não crítica derrubou o checkout inteiro.**

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 320" role="img" aria-labelledby="res-d1-title res-d1-desc" xmlns="http://www.w3.org/2000/svg">
<title id="res-d1-title">Uma falha em cascata, com e sem proteção</title>
<desc id="res-d1-desc">À esquerda, um recomendador lento bloqueia todas as threads do checkout e o checkout inteiro falha. À direita, um timeout, um bulkhead e um fallback isolam o recomendador lento e o checkout continua atendendo em modo degradado.</desc>
<defs><marker id="res-d1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker></defs>
<text x="185" y="28" text-anchor="middle" class="d-label">SEM PROTEÇÃO</text>
<rect x="95" y="46" width="180" height="60" rx="10" class="d-box-danger"/>
<text x="185" y="72" text-anchor="middle" class="d-title">Checkout</text>
<text x="185" y="92" text-anchor="middle" class="d-small">threads bloqueadas</text>
<line x1="185" y1="106" x2="74" y2="180" class="d-line" marker-end="url(#res-d1-arrow)"/>
<line x1="185" y1="106" x2="185" y2="180" class="d-line" marker-end="url(#res-d1-arrow)"/>
<line x1="185" y1="106" x2="296" y2="180" class="d-line-danger" marker-end="url(#res-d1-arrow)"/>
<rect x="22" y="180" width="104" height="70" rx="10" class="d-box"/>
<text x="74" y="208" text-anchor="middle" class="d-title">Pagamento</text>
<text x="74" y="228" text-anchor="middle" class="d-small">saudável</text>
<rect x="133" y="180" width="104" height="70" rx="10" class="d-box"/>
<text x="185" y="208" text-anchor="middle" class="d-title">Estoque</text>
<text x="185" y="228" text-anchor="middle" class="d-small">saudável</text>
<rect x="244" y="180" width="104" height="70" rx="10" class="d-box-danger"/>
<text x="296" y="208" text-anchor="middle" class="d-title">Recomendador</text>
<text x="296" y="228" text-anchor="middle" class="d-small">30 s por chamada</text>
<text x="185" y="284" text-anchor="middle" class="d-small">uma chamada lenta trava</text>
<text x="185" y="302" text-anchor="middle" class="d-small">todo o checkout</text>
<line x1="360" y1="40" x2="360" y2="300" class="d-line-dashed"/>
<text x="535" y="28" text-anchor="middle" class="d-label">COM TIMEOUT + BULKHEAD</text>
<rect x="445" y="46" width="180" height="60" rx="10" class="d-box-accent"/>
<text x="535" y="72" text-anchor="middle" class="d-title">Checkout</text>
<text x="535" y="92" text-anchor="middle" class="d-small">continua vendendo</text>
<line x1="535" y1="106" x2="424" y2="180" class="d-line" marker-end="url(#res-d1-arrow)"/>
<line x1="535" y1="106" x2="535" y2="180" class="d-line" marker-end="url(#res-d1-arrow)"/>
<line x1="535" y1="106" x2="646" y2="180" class="d-line-dashed" marker-end="url(#res-d1-arrow)"/>
<rect x="372" y="180" width="104" height="70" rx="10" class="d-box"/>
<text x="424" y="208" text-anchor="middle" class="d-title">Pagamento</text>
<text x="424" y="228" text-anchor="middle" class="d-small">saudável</text>
<rect x="483" y="180" width="104" height="70" rx="10" class="d-box"/>
<text x="535" y="208" text-anchor="middle" class="d-title">Estoque</text>
<text x="535" y="228" text-anchor="middle" class="d-small">saudável</text>
<rect x="594" y="180" width="104" height="70" rx="10" class="d-box-warn"/>
<text x="646" y="204" text-anchor="middle" class="d-title">Recomendador</text>
<text x="646" y="222" text-anchor="middle" class="d-small">timeout 300 ms</text>
<text x="646" y="240" text-anchor="middle" class="d-small">fallback em cache</text>
<text x="535" y="284" text-anchor="middle" class="d-small">a parte lenta fica isolada:</text>
<text x="535" y="302" text-anchor="middle" class="d-small">degradado, não fora do ar</text>
</svg>
</div>
<figcaption>Figura 1: A mesma dependência lenta, com e sem padrões de resiliência</figcaption>
</figure>

Repare no que falhou aqui. Não foi a infraestrutura, nem o recomendador (ele só estava lento), e sim **a forma como o checkout dependia dele**. Três decisões pequenas teriam mudado o final da história: um *timeout* de algumas centenas de milissegundos, um *pool* separado e limitado para as chamadas ao recomendador, e um *fallback* que mostra uma lista em cache de "mais vendidos" quando a chamada falha. O resto deste artigo é sobre essas decisões.

## Timeouts: a primeira linha de defesa

**Objetivo:** Nunca esperar para sempre por nada que passe pela rede.

Se você for adotar um único padrão deste artigo, que seja este. Toda chamada que atravessa a fronteira de um processo (HTTP, gRPC, banco de dados, cache, *message broker*, compartilhamento de arquivos) precisa de um *timeout* explícito.

Por que isso ainda é discussão? Porque **o padrão costuma ser infinito, ou quase isso**. Alguns exemplos que pegam muita gente de surpresa:

- A biblioteca `requests` do Python **não tem timeout** a menos que você passe um;
- O `HttpURLConnection` do Java vem com *timeouts* de conexão e de leitura iguais a `0`, que significa *esperar para sempre*;
- O `HttpClient` do .NET vem com 100 segundos, o que tecnicamente é finito, mas para um usuário olhando para um *spinner* dá no mesmo;
- Muitos *drivers* de banco e *sockets* crus bloqueiam indefinidamente numa leitura se ninguém configurar o contrário;

Quem escreve a biblioteca não tem como saber o seu orçamento de latência, então escolhe valores padrão do tipo "não quebrar nada". Faz sentido para uma biblioteca e é péssimo para produção.

```python
# timeout de conexão, timeout de leitura (segundos)
response = requests.get(url, timeout=(3.05, 10))
```

### Como escolher um timeout

Nada de tirar número da cartola. Olhe a distribuição real de latência da dependência (é aqui que o [Observability First](/pt-br/principles/solution/observability-first/) se paga) e coloque o *timeout* um pouco acima de um percentil alto, como o p99, e não da média. Depois confira se ele cabe no seu próprio orçamento: se a sua API promete responder em 2 segundos, a soma dos *timeouts* no caminho crítico não pode dar 10.

| Abordagem | Benefício |
| :--- | :--- |
| **Configure timeouts de conexão e de leitura separadamente.** Conectar deve ser rápido; ler pode legitimamente demorar mais. | Um *host* morto é detectado em milissegundos, sem esperar o *timeout* de leitura inteiro. |
| **Use um orçamento total (*deadline*) por requisição.** Propague o tempo restante para as chamadas seguintes (os *deadlines* do gRPC fazem isso nativamente). | Os serviços abaixo param de trabalhar em requisições cujo chamador já desistiu. |
| **Baseie os valores em percentis medidos.** Revise quando o perfil de latência mudar. | *Timeouts* que disparam em problemas reais, e não na variação normal. |
| **Trate timeout como sinal de falha.** Conte, registre em log, alimente o *circuit breaker*. | O *timeout* costuma ser o primeiro sintoma de um incidente; deixe-o visível. |

## Retries com backoff exponencial e jitter

**Objetivo:** Recuperar automaticamente de falhas transitórias sem piorar a situação.

Muitas falhas são transitórias: uma conexão resetada, um soluço na rede, um `503` durante um *deploy*, um `429 Too Many Requests` de uma API com *throttling*. Tentar de novo um instante depois muitas vezes simplesmente funciona. Então *retry* é ótimo, certo?

É, **quando feito com cuidado**. Feito de forma ingênua, é uma das maneiras mais eficientes de transformar um problema pequeno em um problemão.

### Retry storms

Imagine um serviço sofrendo a 100% da capacidade. Todo cliente que recebe um erro tenta de novo imediatamente, três vezes. O serviço que já estava mal passa a receber até quatro vezes a carga justamente no momento em que menos aguenta. Ele nunca se recupera, porque os *retries* o mantêm no chão. Isso é uma **retry storm**, e fica ainda pior quando os *retries* se empilham em camadas: se o *frontend*, a API e o serviço de dados tentam 3 vezes cada, uma única ação do usuário pode virar 4 × 4 × 4 = **64 chamadas** para o pobre banco de dados lá embaixo.

A correção tem três partes:

1. **Backoff exponencial:** esperar mais a cada falha (por exemplo 200 ms, 400 ms, 800 ms), dando espaço para a dependência respirar;
2. **Jitter:** adicionar aleatoriedade a cada espera, para que milhares de clientes não tentem de novo exatamente no mesmo instante;
3. **Limites:** um número máximo pequeno de tentativas e, de preferência, um *retry budget* (por exemplo, *retries* nunca passam de 10% do tráfego total).

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 285" role="img" aria-labelledby="res-d2-title res-d2-desc" xmlns="http://www.w3.org/2000/svg">
<title id="res-d2-title">Backoff exponencial e o efeito do jitter</title>
<desc id="res-d2-desc">A linha do tempo de cima mostra três tentativas com falha separadas por esperas de 200, 400 e 800 milissegundos antes de uma quarta tentativa bem-sucedida. A parte de baixo compara seis clientes tentando de novo no mesmo instante, sem jitter, com seis clientes espalhados no tempo, com jitter.</desc>
<text x="360" y="30" text-anchor="middle" class="d-label">BACKOFF EXPONENCIAL</text>
<line x1="60" y1="110" x2="690" y2="110" class="d-line"/>
<rect x="92" y="72" width="66" height="26" rx="10" class="d-box-muted"/>
<text x="125" y="90" text-anchor="middle" class="d-small">200 ms</text>
<rect x="182" y="72" width="116" height="26" rx="10" class="d-box-muted"/>
<text x="240" y="90" text-anchor="middle" class="d-small">400 ms</text>
<rect x="322" y="72" width="226" height="26" rx="10" class="d-box-muted"/>
<text x="435" y="90" text-anchor="middle" class="d-small">800 ms</text>
<circle cx="80" cy="110" r="9" class="d-fill-danger"/>
<circle cx="170" cy="110" r="9" class="d-fill-danger"/>
<circle cx="310" cy="110" r="9" class="d-fill-danger"/>
<circle cx="560" cy="110" r="9" class="d-fill-accent"/>
<text x="80" y="136" text-anchor="middle" class="d-small">falha</text>
<text x="170" y="136" text-anchor="middle" class="d-small">falha</text>
<text x="310" y="136" text-anchor="middle" class="d-small">falha</text>
<text x="560" y="136" text-anchor="middle" class="d-small">sucesso</text>
<text x="360" y="164" text-anchor="middle" class="d-label">RETRIES DE SEIS CLIENTES</text>
<text x="195" y="184" text-anchor="middle" class="d-small">sem jitter: todos juntos</text>
<text x="540" y="184" text-anchor="middle" class="d-small">com jitter: espalhados</text>
<line x1="60" y1="264" x2="330" y2="264" class="d-line"/>
<line x1="390" y1="264" x2="690" y2="264" class="d-line"/>
<circle cx="195" cy="254" r="5" class="d-fill-danger"/>
<circle cx="195" cy="242" r="5" class="d-fill-danger"/>
<circle cx="195" cy="230" r="5" class="d-fill-danger"/>
<circle cx="195" cy="218" r="5" class="d-fill-danger"/>
<circle cx="195" cy="206" r="5" class="d-fill-danger"/>
<circle cx="195" cy="194" r="5" class="d-fill-danger"/>
<circle cx="420" cy="254" r="5" class="d-fill-accent"/>
<circle cx="470" cy="254" r="5" class="d-fill-accent"/>
<circle cx="515" cy="254" r="5" class="d-fill-accent"/>
<circle cx="560" cy="254" r="5" class="d-fill-accent"/>
<circle cx="610" cy="254" r="5" class="d-fill-accent"/>
<circle cx="660" cy="254" r="5" class="d-fill-accent"/>
</svg>
</div>
<figcaption>Figura 2: O backoff dá espaço para a dependência se recuperar; o jitter evita que os clientes tentem de novo em sincronia</figcaption>
</figure>

### O que (não) repetir

Repita só o que for **transitório e seguro**:

- **Repita:** *timeouts*, conexões resetadas, `503 Service Unavailable`, `429 Too Many Requests` (respeitando o cabeçalho `Retry-After` quando ele vier), `502`/`504` vindos de um *gateway*;
- **Não repita:** `400 Bad Request`, `401`/`403`, `404`, erros de validação, violações de regra de negócio. Perguntar de novo não muda a resposta, só queima capacidade;
- **Repita em uma camada só**, de preferência a mais próxima da dependência que falhou, e deixe as camadas de cima falharem rápido.

No .NET, o [Polly](https://www.pollydocs.org/) é a biblioteca padrão de mercado para isso. Aqui vai uma estratégia de *retry* com *backoff* exponencial e *jitter* no Polly v8 (eu me aprofundo em [Construindo uma API .NET resiliente com Polly](/pt-br/blog/resilient-dotnet-api-polly/)):

```csharp
var retry = new RetryStrategyOptions<HttpResponseMessage>
{
    MaxRetryAttempts = 3,
    Delay = TimeSpan.FromMilliseconds(200),
    BackoffType = DelayBackoffType.Exponential,
    UseJitter = true,
    ShouldHandle = new PredicateBuilder<HttpResponseMessage>()
        .Handle<HttpRequestException>()
        .Handle<TimeoutRejectedException>()
        .HandleResult(r => (int)r.StatusCode >= 500
                        || r.StatusCode == HttpStatusCode.TooManyRequests)
};
```

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior empolgado" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Entendi! Então vou colocar toda chamada dentro de um loop que tenta 10 vezes. Se falhar 10 vezes, aí quebrou mesmo, né?"</span>
    </div>
  </div>
</div>

Calma aí, Júnior! Dez *retries* sem *backoff* é exatamente a *retry storm* que acabamos de descrever, com você no papel da tempestade. E tem uma segunda armadilha escondida nesse *loop*: e se a chamada **deu certo** no servidor, mas a resposta se perdeu no caminho de volta? Você tenta de novo, e agora o cliente tem dois pedidos e duas cobranças no cartão. O que nos leva ao padrão que torna os *retries* seguros.

### Idempotência: retries sem susto

Uma operação é **idempotente** quando executá-la duas vezes tem o mesmo efeito que executá-la uma vez. Leituras são naturalmente idempotentes. `PUT` e `DELETE` deveriam ser. `POST /payments` não é, a menos que você projete para isso.

O desenho mais comum é a **chave de idempotência** (*idempotency key*): o cliente gera uma chave única por operação lógica e a envia em todas as tentativas. O servidor grava a chave junto com o resultado da primeira execução bem-sucedida; qualquer nova tentativa com a mesma chave recebe o resultado guardado, sem executar a operação de novo. Consumidores de mensagens precisam do mesmo cuidado, já que a maioria dos *brokers* entrega *at least once* (pelo menos uma vez): guarde os IDs das mensagens processadas, ou faça os efeitos do *handler* naturalmente repetíveis (*upsert* em vez de *insert*, "marcar como pago" em vez de "somar 1 ao saldo").

Escrevi um post inteiro sobre isso: [Chaves de idempotência na prática](/pt-br/blog/idempotency-keys-in-practice/). A versão curta é: **nunca coloque retry numa operação que não é idempotente**. Corrija a operação primeiro.

## Circuit Breaker

**Objetivo:** Parar de chamar uma dependência que claramente está falhando, falhar rápido e verificar de tempos em tempos se ela já se recuperou.

*Retries* resolvem soluços curtos. Mas quando uma dependência fica fora por minutos, repetir cada requisição não faz sentido: cada uma continua esperando o *timeout*, continua segurando recursos e continua jogando carga num serviço que está tentando se recuperar. O **circuit breaker**, popularizado por Michael Nygard no livro *Release It!*, pega emprestada a ideia do disjuntor do quadro de luz da sua casa: quando algo dá errado, corta o circuito antes que a casa pegue fogo.

É uma pequena máquina de estados com três estados:

- **Fechado (*closed*):** tudo normal; as chamadas passam e o *breaker* acompanha as falhas (erros, *timeouts*, chamadas lentas) numa janela deslizante;
- **Aberto (*open*):** a taxa de falhas passou do limite; as chamadas falham **na hora**, sem tocar na dependência, durante um tempo de pausa configurado;
- **Meio-aberto (*half-open*):** o tempo de pausa acabou; algumas chamadas de teste são liberadas. Se derem certo, o *breaker* fecha; se falharem, ele abre de novo.

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="res-d3-title res-d3-desc" xmlns="http://www.w3.org/2000/svg">
<title id="res-d3-title">Máquina de estados do circuit breaker</title>
<desc id="res-d3-desc">Três estados: Fechado, em que as chamadas passam normalmente; Aberto, em que as chamadas falham rápido; e Meio-aberto, em que algumas chamadas de teste são liberadas. Fechado vai para Aberto quando a taxa de falhas passa do limite, Aberto vai para Meio-aberto depois do tempo de pausa, e Meio-aberto volta para Fechado se as chamadas de teste derem certo ou para Aberto se falharem.</desc>
<defs><marker id="res-d3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-muted"/></marker><marker id="res-d3-arrow-danger" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-danger"/></marker></defs>
<rect x="270" y="30" width="180" height="76" rx="10" class="d-box-warn"/>
<text x="360" y="62" text-anchor="middle" class="d-title">Meio-aberto</text>
<text x="360" y="84" text-anchor="middle" class="d-small">chamadas de teste</text>
<rect x="40" y="190" width="180" height="76" rx="10" class="d-box-accent"/>
<text x="130" y="222" text-anchor="middle" class="d-title">Fechado</text>
<text x="130" y="244" text-anchor="middle" class="d-small">chamadas passam</text>
<rect x="500" y="190" width="180" height="76" rx="10" class="d-box-danger"/>
<text x="590" y="222" text-anchor="middle" class="d-title">Aberto</text>
<text x="590" y="244" text-anchor="middle" class="d-small">falha rápido, sem chamar</text>
<line x1="220" y1="240" x2="498" y2="240" class="d-line-danger" marker-end="url(#res-d3-arrow-danger)"/>
<text x="360" y="230" text-anchor="middle" class="d-small">falhas acima do limite</text>
<line x1="600" y1="190" x2="452" y2="52" class="d-line" marker-end="url(#res-d3-arrow)"/>
<text x="560" y="122" text-anchor="start" class="d-small">fim da pausa</text>
<line x1="420" y1="106" x2="518" y2="188" class="d-line-danger" marker-end="url(#res-d3-arrow-danger)"/>
<text x="470" y="172" text-anchor="end" class="d-small">teste falha</text>
<line x1="270" y1="68" x2="132" y2="188" class="d-line" marker-end="url(#res-d3-arrow)"/>
<text x="180" y="122" text-anchor="end" class="d-small">testes dão certo</text>
</svg>
</div>
<figcaption>Figura 3: Os três estados de um circuit breaker e o que faz ele passar de um para o outro</figcaption>
</figure>

Falhar rápido parece ruim, mas é um presente: quem chama recebe uma resposta em microssegundos em vez de esperar um *timeout*, as *threads* são liberadas na hora e dá para ir direto para um *fallback*. Enquanto isso, a dependência que está sofrendo ganha uma folga do tráfego que a mantinha no chão.

No Java, o [resilience4j](https://resilience4j.readme.io/) é a biblioteca de referência (sucessora espiritual do Netflix Hystrix, que está em modo de manutenção). Um *breaker* que também trata chamadas *lentas* como falha, com *fallback* em cache:

```java
CircuitBreakerConfig config = CircuitBreakerConfig.custom()
    .failureRateThreshold(50)
    .slowCallRateThreshold(50)
    .slowCallDurationThreshold(Duration.ofSeconds(2))
    .minimumNumberOfCalls(20)
    .waitDurationInOpenState(Duration.ofSeconds(15))
    .permittedNumberOfCallsInHalfOpenState(3)
    .build();

CircuitBreaker breaker = CircuitBreaker.of("recommender", config);

Supplier<List<Product>> guarded = CircuitBreaker
    .decorateSupplier(breaker, () -> recommender.fetch(userId));

List<Product> products = Try.ofSupplier(guarded)
    .recover(ex -> cache.topSellers())
    .get();
```

| Abordagem | Benefício |
| :--- | :--- |
| **Um breaker por dependência** (ou por *endpoint*, quando os comportamentos forem diferentes). | Um *endpoint* com problema não bloqueia os saudáveis. |
| **Conte chamadas lentas, não só erros.** | Pega o caso "no ar, mas lento", que é justamente o que provoca cascatas. |
| **Exija um volume mínimo** antes de avaliar a taxa de falhas. | Duas falhas em três requisições às 3 da manhã não abrem o circuito. |
| **Exponha o estado do breaker como métrica** e crie alertas. | Um *breaker* aberto é um sinal de incidente claro e precoce. |

## Bulkhead

**Objetivo:** Isolar recursos para que uma falha em uma área não drene o que as outras precisam.

O nome vem dos navios: o casco é dividido em compartimentos estanques, então um rombo alaga um compartimento em vez de afundar a embarcação inteira. Em software, os compartimentos são **pools de recursos**.

Na nossa história do checkout, o problema de raiz era que todas as dependências dividiam o mesmo *thread pool*. Um *bulkhead* dá a cada dependência (ou a cada tipo de trabalho) o seu próprio *pool* limitado: no máximo 20 chamadas simultâneas ao recomendador, 50 ao pagamento, e assim por diante. Quando o recomendador fica lento, as 20 vagas dele se enchem e as próximas chamadas são rejeitadas na hora, enquanto o pagamento continua com toda a sua capacidade.

*Bulkheads* aparecem em vários níveis:

- **No código:** um limitador de concorrência ou semáforo por dependência (o *concurrency limiter* do Polly, o `Bulkhead` e o `ThreadPoolBulkhead` do resilience4j);
- **Pools de conexão:** um cliente HTTP ou *pool* de banco separado por dependência, em vez de um *pool* gigante compartilhado;
- **Implantação:** instâncias ou *node pools* separados para *workloads* críticos e não críticos, ou para *tenants* diferentes, para que um vizinho barulhento não deixe todo mundo sem recurso;

O *trade-off* é a utilização: a capacidade reservada para um compartimento fica ociosa enquanto outro passa fome. É o preço do isolamento e, para caminhos críticos, costuma valer a pena.

## Rate limiting e load shedding

**Objetivo:** Proteger o seu serviço de mais tráfego do que ele aguenta e, quando sobrecarregado, descartar primeiro o trabalho menos importante.

Tudo até aqui protege você das suas **dependências**. *Rate limiting* e *load shedding* protegem você de quem **chama** o seu serviço, incluindo as *retry storms* dos outros times.

O **rate limiting** limita quantas requisições um cliente pode fazer numa janela de tempo (*token bucket* e janela deslizante são os algoritmos clássicos). O excesso recebe um `429 Too Many Requests`, de preferência com o cabeçalho `Retry-After`, para que clientes bem-comportados saibam quando voltar. Limites por cliente ou por chave de API também evitam que um consumidor agressivo estrague a experiência de todo mundo.

O **load shedding** trata da saúde do próprio servidor: quando ele percebe que está sobrecarregado (profundidade da fila, CPU, requisições em andamento, latência), começa a rejeitar trabalho **antes** de colapsar. A grande sacada é que um "não" rápido é muito melhor do que um "talvez" lento: um servidor que tenta atender todo mundo durante uma sobrecarga acaba não atendendo ninguém, porque toda requisição estoura o *timeout* depois de consumir recursos.

Um bom *load shedding* é **priorizado**: descarte tráfego de *prefetch*, *analytics* e *jobs* em lote antes de descartar requisições de checkout. Marque as requisições com um nível de criticidade e deixe o mecanismo de descarte usar essa informação.

## Nivelamento de carga com filas

**Objetivo:** Absorver picos de tráfego colocando uma fila entre produtores e consumidores, para que o consumidor trabalhe no seu próprio ritmo.

Nem toda operação precisa terminar enquanto o usuário espera. Enviar o e-mail de confirmação, gerar o PDF da nota fiscal, atualizar o índice de busca, avisar o centro de distribuição: tudo isso pode acontecer alguns segundos depois. Coloque a requisição numa fila (Azure Service Bus, Amazon SQS, RabbitMQ, Kafka...) e deixe os *workers* processarem num ritmo constante. Esse é o padrão conhecido como *queue-based load leveling*.

A fila funciona como um amortecedor. Um pico de 10.000 requisições em um minuto vira um *backlog* que os *workers* esvaziam nos minutos seguintes, em vez de 10.000 chamadas simultâneas martelando um banco dimensionado para 500. Se um serviço lá embaixo estiver totalmente fora do ar, as mensagens simplesmente esperam na fila até ele voltar, em vez de se perderem.

### Dead-letter queues

E a mensagem que **nunca** vai conseguir ser processada? Um *payload* malformado, uma referência a um cliente que foi excluído, um *bug* no *handler*. Sem cuidado, ela é reprocessada para sempre, travando a fila ou queimando recursos (a famosa *poison message*).

A **dead-letter queue (DLQ)** é para onde vão as mensagens que passaram do número máximo de tentativas de entrega. A maioria dos *brokers* gerenciados oferece isso nativamente. A DLQ mantém o fluxo principal andando e preserva a mensagem com falha para análise e reprocessamento. Duas regras fazem dela algo útil em vez de um buraco negro:

- **Monitore.** Uma DLQ que ninguém olha é só um jeito mais lento de perder dados. Crie alerta para quando ela não estiver vazia;
- **Tenha um processo de reprocessamento.** Depois de corrigir o *bug*, você precisa de um jeito seguro de devolver essas mensagens para a fila, o que, de novo, exige *handlers* idempotentes.

## Fallbacks e degradação graciosa

**Objetivo:** Quando algo falhar, entregar ao usuário a melhor resposta possível em vez de uma página de erro.

É aqui que a resiliência fica visível para o cliente, e isso é mais uma decisão de produto do que técnica. Para cada dependência, pergunte: **"Se isso estiver indisponível, qual é a segunda melhor opção?"**

| Falha | Possível fallback |
| :--- | :--- |
| Recomendador fora do ar | Mostrar uma lista em cache dos mais vendidos, ou esconder a seção |
| Serviço de preços lento | Servir o último preço conhecido do cache, indicando de quando ele é |
| Personalização falha | Mostrar a página genérica, sem personalização |
| Motor de busca sobrecarregado | Cair para uma consulta mais simples, ou mostrar categorias populares |
| Provedor de pagamento A falha | Rotear para o provedor B, ou aceitar o pedido e cobrar depois |
| Serviço de *feature flags* inacessível | Usar as últimas *flags* conhecidas, ou valores padrão seguros |

Estratégias comuns:

- **Servir dados em cache ou desatualizados.** Um cache com política *stale-while-revalidate* ou *stale-if-error* continua respondendo com o último valor bom quando a origem falha;
- **Desligar funcionalidades não críticas.** Use *feature flags* ou *kill switches* para desligar funcionalidades caras ou com problema durante um incidente, protegendo a jornada principal;
- **Aceitar agora, processar depois.** Guarde a requisição e conclua de forma assíncrona (o nivelamento com filas de novo);
- **Devolver uma resposta parcial.** Renderize a página com as partes que funcionaram e um espaço amigável no lugar do resto;

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior desconfiado" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Peraí, servir dado velho de propósito? Isso não é basicamente mentir pro usuário?"</span>
    </div>
  </div>
</div>

Boa pergunta, Júnior, e a resposta é: **depende do dado**. Uma lista de recomendações de dez minutos atrás? Ninguém liga. A descrição de um produto de ontem? Tranquilo. O saldo de uma conta, o estoque da última unidade no depósito, o preço de uma cotação que tem validade contratual? Aí o dado desatualizado vira um problema de verdade, e o *fallback* certo pode ser "não conseguimos confirmar isso agora, tente de novo em instantes".

É por isso que *fallbacks* precisam ser desenhados **junto com o negócio**, e não decididos por um dev às 2 da manhã no meio de um incidente. Classifique cada dado por quanto ele pode estar desatualizado com segurança, seja transparente quando a resposta estiver degradada e nunca finja silenciosamente um resultado crítico.

## Monitoramento por health endpoints

**Objetivo:** Permitir que *load balancers*, orquestradores e ferramentas de monitoramento saibam se uma instância consegue fazer o seu trabalho.

Um serviço deve expor *endpoints* de saúde que ferramentas externas possam chamar (o padrão *health endpoint monitoring*). No Kubernetes e na maioria das plataformas modernas, são duas perguntas diferentes, e confundir as duas é uma fonte clássica de indisponibilidade:

- **Liveness:** "Esse processo está vivo, ou travou e precisa ser reiniciado?" Mantenha **simples e local**. Ele não deve checar o banco nem nenhuma outra dependência;
- **Readiness:** "Essa instância pode receber tráfego agora?" Pode checar dependências críticas e o estado de aquecimento. Falhar aqui tira a instância da rotação, sem reiniciá-la;

Por que a insistência em manter o *liveness* local? Porque se a *liveness probe* checa o banco e o banco dá um soluço, o orquestrador reinicia **todas** as instâncias de uma vez. Agora você tem um soluço no banco *e* uma frota inteira subindo a frio. Um mecanismo de resiliência acabou de causar a cascata que deveria evitar.

Alguns cuidados extras: evite que os *health endpoints* fiquem caros (guarde o resultado das checagens de dependência por alguns segundos), não exponha detalhes sensíveis publicamente e coloque o estado dos seus *circuit breakers* num *endpoint* de diagnóstico separado e interno.

## Transações compensatórias e sagas

**Objetivo:** Manter os dados consistentes entre serviços quando não existe uma transação distribuída para desfazer.

Num monólito com um único banco, uma operação que falha simplesmente faz *rollback*. Num sistema distribuído, fechar um pedido pode significar reservar estoque no serviço de estoque, cobrar o cartão no serviço de pagamento e agendar a entrega no serviço de logística. Três serviços, três bancos, nenhuma transação compartilhada. Se a logística falhar depois que o cartão foi cobrado, e agora?

O padrão **saga** quebra a operação de negócio numa sequência de transações locais, cada uma com uma **transação compensatória** que a desfaz semanticamente: liberar o estoque, estornar a cobrança, cancelar a entrega. Se um passo falhar, a saga executa as compensações dos passos que já foram concluídos.

Sagas vêm em dois sabores:

- **Coreografia:** cada serviço reage a eventos dos outros ("PagamentoConcluído" dispara a logística). Simples para fluxos curtos, difícil de acompanhar quando eles crescem;
- **Orquestração:** um coordenador central (um motor de *workflow* como Temporal, AWS Step Functions ou Azure Durable Functions) diz a cada serviço o que fazer e cuida das compensações. Mais fácil de entender e de monitorar;

Dois alertas. Primeiro, compensação **não** é *rollback*: o cliente pode ter visto a cobrança antes do estorno, e um e-mail pode já ter saído. Desenhe as compensações como ações de negócio, junto com o negócio. Segundo, todo passo e toda compensação precisam ser idempotentes e repetíveis, porque a saga vai tentar de novo. Percebe como todos esses padrões vivem se apoiando uns nos outros?

## Juntando tudo: o pipeline de resiliência

Na prática, você raramente usa um padrão sozinho. Eles são combinados em camadas ao redor de cada chamada a uma dependência, e **a ordem importa**. Uma organização comum, de fora para dentro:

<figure class="diagram" data-pagefind-ignore>
<div class="diagram-canvas">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="res-d4-title res-d4-desc" xmlns="http://www.w3.org/2000/svg">
<title id="res-d4-title">Camadas de um pipeline de resiliência</title>
<desc id="res-d4-desc">Uma chamada de quem chama até a dependência atravessa camadas aninhadas: o fallback por fora, depois um timeout total, depois o retry com backoff, depois um circuit breaker e, por fim, um timeout para cada tentativa individual.</desc>
<defs><marker id="res-d4-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-fill-accent"/></marker></defs>
<rect x="20" y="170" width="90" height="60" rx="10" class="d-box"/>
<text x="65" y="205" text-anchor="middle" class="d-text">Cliente</text>
<rect x="130" y="30" width="440" height="250" rx="10" class="d-box-info"/>
<text x="145" y="52" text-anchor="start" class="d-label">FALLBACK</text>
<rect x="150" y="62" width="400" height="206" rx="10" class="d-box"/>
<text x="165" y="84" text-anchor="start" class="d-label">TIMEOUT TOTAL</text>
<rect x="170" y="94" width="360" height="162" rx="10" class="d-box-warn"/>
<text x="185" y="116" text-anchor="start" class="d-label">RETRY + BACKOFF</text>
<rect x="190" y="126" width="320" height="118" rx="10" class="d-box-accent"/>
<text x="205" y="148" text-anchor="start" class="d-label">CIRCUIT BREAKER</text>
<rect x="210" y="158" width="280" height="74" rx="10" class="d-box"/>
<text x="225" y="180" text-anchor="start" class="d-label">TIMEOUT POR TENTATIVA</text>
<text x="350" y="222" text-anchor="middle" class="d-small">uma chamada real por tentativa</text>
<rect x="610" y="170" width="95" height="60" rx="10" class="d-box"/>
<text x="657" y="205" text-anchor="middle" class="d-text">Dependência</text>
<line x1="110" y1="200" x2="608" y2="200" class="d-line-accent" marker-end="url(#res-d4-arrow)"/>
</svg>
</div>
<figcaption>Figura 4: Padrões combinados em camadas; cada camada só enxerga o que as internas deixam passar</figcaption>
</figure>

Lendo de dentro para fora: cada **tentativa** tem o seu próprio *timeout* curto; o **circuit breaker** conta essas falhas e falha rápido quando a dependência claramente quebrou; o **retry** tenta de novo, com *backoff*, só para falhas transitórias (e não fica martelando um *breaker* aberto); o **timeout total** limita o tempo gasto somando todas as tentativas, para que os *retries* não estourem o seu orçamento de latência; e o **fallback** pega o que sobrar e devolve a melhor resposta degradada.

Com o Polly v8, esse *pipeline* inteiro cabe em poucas linhas:

```csharp
var pipeline = new ResiliencePipelineBuilder<HttpResponseMessage>()
    .AddFallback(new FallbackStrategyOptions<HttpResponseMessage>
    {
        FallbackAction = _ => Outcome.FromResultAsValueTask(CachedTopSellers())
    })
    .AddTimeout(TimeSpan.FromSeconds(3))    // orçamento total
    .AddRetry(retry)                        // as opções mostradas antes
    .AddCircuitBreaker(new CircuitBreakerStrategyOptions<HttpResponseMessage>
    {
        FailureRatio = 0.5,
        MinimumThroughput = 20,
        SamplingDuration = TimeSpan.FromSeconds(30),
        BreakDuration = TimeSpan.FromSeconds(15)
    })
    .AddTimeout(TimeSpan.FromMilliseconds(500))  // por tentativa
    .Build();
```

E se você usa `HttpClient` no ASP.NET Core, o pacote `Microsoft.Extensions.Http.Resilience` entrega uma versão sensata disso pronta, com `AddStandardResilienceHandler()`.

### Bibliotecas e onde elas vivem

Você quase nunca precisa escrever esses padrões do zero, e nem deveria: os casos de borda (concorrência, janelas deslizantes, chamadas simultâneas no meio-aberto) são sutis.

| Biblioteca / ferramenta | Ecossistema | Observações |
| :--- | :--- | :--- |
| **Polly** | .NET | *Retry*, *circuit breaker*, *timeout*, *fallback*, *rate limiter*, *hedging*. Integrado ao `Microsoft.Extensions.Http.Resilience`. |
| **resilience4j** | Java / Kotlin | Leve, estilo funcional, integra com Spring Boot e Micrometer. |
| **Hystrix** | Java | O pioneiro da Netflix; em modo de manutenção, prefira o resilience4j em código novo. |
| **Tenacity** | Python | *Retries* com *backoff* e *jitter* via *decorators*. |
| **cockatiel** | Node.js / TypeScript | Políticas inspiradas no Polly para JavaScript. |
| **Envoy / Istio / Linkerd** | *Service mesh* | *Timeouts*, *retries*, *outlier detection* e *rate limiting* na camada de rede, sem mudar o código. |

Um *service mesh* consegue aplicar *timeouts* e *retries* de forma uniforme em toda a frota, o que é ótimo para consistência. Só tome cuidado para não repetir no *mesh* **e** no código (lembra das 64 chamadas?), e lembre que o *mesh* não conhece os seus *fallbacks* de negócio. Esses ficam no código.

## Adotando padrões de resiliência

Conhecer os padrões é a parte fácil. Aplicar de forma consistente é onde os times tropeçam. Um caminho prático:

### 1. Mapeie e classifique suas dependências

Liste cada chamada de rede que o seu serviço faz e classifique cada uma: **crítica** (a requisição não tem como dar certo sem ela) ou **opcional** (a requisição pode dar certo de forma degradada).

**Benefício:** você sabe onde precisa de *fail fast* com *fallback* e onde precisa de isolamento forte e *retries* cuidadosos.

### 2. Coloque timeout em tudo

Audite todos os clientes: HTTP, banco, cache, *broker*, SDKs. Deixe os *timeouts* explícitos, mesmo quando você gostar do padrão, para que a próxima pessoa enxergue a decisão.

**Benefício:** elimina a causa mais comum de falhas em cascata com o menor esforço.

### 3. Padronize o pipeline

Crie uma configuração de resiliência compartilhada e bem testada (uma biblioteca, um cliente HTTP base, uma política no *mesh*) com bons padrões, em vez de cada time escrever o próprio *loop* de *retry*. É aqui que a [Padronização](/pt-br/principles/enterprise/standardization/) encontra a resiliência.

**Benefício:** comportamento consistente, menos *bugs* sutis e um lugar só para corrigir.

### 4. Torne tudo observável

Emita métricas de *retries*, *timeouts*, mudanças de estado dos *breakers*, chamadas rejeitadas pelo *bulkhead*, requisições descartadas e uso de *fallback*. Um *fallback* que dispara silenciosamente o dia inteiro é uma indisponibilidade que você ainda não percebeu.

**Benefício:** os mecanismos de resiliência viram sinais de alerta precoce, em vez de lugares onde os problemas se escondem.

### 5. Teste falhas de propósito

Injete latência e erros nos ambientes inferiores (e, conforme a maturidade cresce, com cuidado em produção): ferramentas de *chaos engineering*, injeção de falhas no *mesh* ou simplesmente um dublê de teste que dorme por 30 segundos. Faça *game days* em que o time assiste o sistema degradar.

**Benefício:** você descobre que o *fallback* lança uma `NullReferenceException` numa terça à tarde, e não na Black Friday.

## Tradeoffs

Padrões de resiliência deixam os sistemas mais robustos, mas não saem de graça. Cada um adiciona um comportamento que precisa ser desenhado, configurado, testado e entendido. Bora ver onde a conta aparece.

### Tradeoffs com Excelência Operacional (Operational Excellence)

**Mais complexidade:** cada padrão é mais uma lógica com a sua própria configuração (*timeouts*, limites, janelas, tamanhos de *pool*). Valores mal ajustados podem ser piores do que nenhum: um *breaker* que abre fácil demais causa indisponibilidades por conta própria.

**Depuração mais difícil:** quando uma requisição falha, foi a dependência, o *timeout*, o *breaker* aberto, a rejeição do *bulkhead* ou o *load shedding*? Sem boa telemetria, as camadas de resiliência deixam os incidentes mais confusos, não menos.

### Mascarando problemas reais

Esse merece um título só para ele. *Retries* e *fallbacks* podem **esconder** uma dependência que falha 30% das vezes: os usuários veem páginas um pouco mais lentas, os *dashboards* continuam verdes e ninguém corrige nada até o dia em que o *fallback* também falha. Meça sempre a taxa de *retries* e de *fallbacks*, e trate uma taxa subindo como um incidente em formação.

### Tradeoffs com Eficiência de Performance (Performance Efficiency)

**Latência adicional:** cada *retry* soma o tempo de *backoff* mais uma nova tentativa. Uma requisição que "dá certo na terceira" pode levar várias vezes o tempo normal. *Timeouts* totais e *retry budgets* mantêm isso sob controle.

**Carga extra:** *retries*, *health checks* e *hedged requests* (mandar uma requisição duplicada para uma segunda réplica quando a primeira demora) aumentam o tráfego nas dependências.

### Tradeoffs com Consistência e Dados

**Dados desatualizados:** servir valores do cache mantém a página no ar, mas pode mostrar informação velha; alguns dados não toleram isso.

**Consistência eventual:** filas e sagas trocam resultados imediatos e atômicos por "vai ficar consistente daqui a pouco". Isso muda a experiência do usuário e exige compensações que são processos de negócio, não *rollbacks* de código.

**Duplicidade:** entrega *at least once* e *retries* significam que todo *handler* precisa ser idempotente, o que custa desenho e armazenamento extras.

### Tradeoffs com Otimização de Custos (Cost Optimization)

**Mais infraestrutura:** filas, caches para *fallback*, *pools* separados para *bulkheads* e capacidade de sobra para *load shedding* custam dinheiro. A capacidade reservada num *bulkhead* fica ociosa enquanto outro está ocupado.

**Mais tempo de engenharia:** desenhar *fallbacks* com o negócio, escrever testes de caos e ajustar limites tiram tempo das *features*. Veja [Otimização de Custos](/pt-br/principles/cloud/cost-optimization/) para pesar isso contra o custo de ficar fora do ar.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev Júnior confuso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>"Então se resiliência adiciona complexidade, latência e custo... talvez seja melhor pular isso e deixar o código simples?"</span>
    </div>
  </div>
</div>

Boa tentativa, Júnior! Pular não faz as falhas desaparecerem; só significa que quem vai lidar com elas são os seus clientes e quem estiver de plantão naquela noite. O segredo é a **proporcionalidade**: *timeout* em tudo (barato, com retorno enorme), *retries* sensatos em erros transitórios e a artilharia pesada (*bulkheads*, sagas, *fallbacks* elaborados) onde o impacto no negócio justificar. Um fluxo de pagamento merece mais armadura do que um relatório interno que roda uma vez por semana.

## Conclusão

Os **padrões de resiliência** partem de uma premissa honesta: num sistema distribuído, sempre tem alguma coisa falhando, e uma hora a rede vai te trair. Em vez de fingir que não, a gente desenha código que **espera a falha e a contém**: *timeouts* para nunca esperar para sempre, *retries* com *backoff* e *jitter* para erros transitórios, idempotência para que os *retries* sejam seguros, *circuit breakers* para falhar rápido, *bulkheads* para isolar, *rate limiting* e *load shedding* para se proteger, filas para absorver picos, *fallbacks* para degradar com elegância, *health endpoints* que dizem a verdade e sagas para manter os dados consistentes quando algo dá errado no meio do caminho.

Nenhum desses padrões é complicado sozinho. A verdadeira habilidade está em **combiná-los com critério**, ajustá-los com dados reais, torná-los observáveis e combinar com o negócio como deve ser a cara do "degradado". Faça isso, e da próxima vez que uma dependência ficar lenta na Black Friday, o seu checkout continua vendendo enquanto o incidente é resolvido nos bastidores.

## Próximos Passos

1. **Desenhe o mapa de dependências**
Liste cada chamada de rede que os seus fluxos críticos fazem e classifique cada uma como crítica ou opcional. Só isso já mostra onde estão os riscos.

2. **Audite e configure os timeouts**
Encontre todo cliente sem *timeout* explícito e corrija, começando pelo caminho crítico. Baseie os valores em percentis reais de latência.

3. **Revise os seus retries**
Remova *loops* de *retry* sem *backoff*, adicione *jitter*, repita só erros transitórios, mantenha os *retries* numa camada só e garanta que as operações repetidas sejam idempotentes.

4. **Adicione circuit breakers e fallbacks às dependências opcionais**
Combine com o time de produto qual é o *fallback* de cada uma e garanta que um *breaker* aberto ou um *fallback* disparando apareça nos seus *dashboards*.

5. **Padronize e observe**
Monte uma configuração de resiliência compartilhada para a sua *stack* (Polly, resilience4j ou equivalente) e emita métricas de cada padrão, seguindo o [Observability First](/pt-br/principles/solution/observability-first/).

6. **Quebre coisas de propósito**
Agende um *game day*, injete latência numa dependência e observe o que acontece. Depois corrija o que te surpreendeu e complemente com o lado da infraestrutura em [Confiabilidade](/pt-br/principles/cloud/reliability/).

<div class="callout info" data-title="Referências">
  <ul>
    <li><a href="https://learn.microsoft.com/azure/architecture/patterns/" target="_blank" rel="noopener">Cloud Design Patterns (Azure Architecture Center)</a></li>
    <li><a href="https://learn.microsoft.com/azure/architecture/patterns/circuit-breaker" target="_blank" rel="noopener">Padrão Circuit Breaker (Azure Architecture Center)</a></li>
    <li><a href="https://martinfowler.com/bliki/CircuitBreaker.html" target="_blank" rel="noopener">Martin Fowler: CircuitBreaker</a></li>
    <li><a href="https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/" target="_blank" rel="noopener">Amazon Builders' Library: Timeouts, retries, and backoff with jitter</a></li>
    <li><a href="https://sre.google/sre-book/addressing-cascading-failures/" target="_blank" rel="noopener">Google SRE Book: Addressing Cascading Failures</a></li>
    <li><a href="https://www.pollydocs.org/" target="_blank" rel="noopener">Documentação do Polly</a></li>
    <li><a href="https://resilience4j.readme.io/" target="_blank" rel="noopener">Documentação do resilience4j</a></li>
    <li><a href="https://learn.microsoft.com/azure/well-architected/reliability/" target="_blank" rel="noopener">Azure Well-Architected Framework: Confiabilidade</a></li>
  </ul>
</div>
