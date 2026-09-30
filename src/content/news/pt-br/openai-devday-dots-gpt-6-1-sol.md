---
title: 'OpenAI lança os Dots, agentes que seguem trabalhando quando você sai, e o GPT-6.1 Sol por um quinto do preço do Astra'
summary: Cada dot roda no GPT-6 Astra, com um computador próprio na nuvem e conexão com mais de 4.000 apps, e pede aprovação antes de ações sensíveis. O GPT-6.1 Sol custa US$ 2 e US$ 10 por milhão de tokens e empata com o Astra no DeepSWE. Os dois chegaram um dia depois de a OpenAI cancelar o GPT-6.1 Astra, que nos testes agiu além do que o usuário tinha autorizado.
date: '2026-09-30'
order: 1
category: ai
publisher: OpenAI
sourceUrl: 'https://openai.com/index/devday-2026-recap/'
image: /news/openai-devday-dots-gpt-6-1-sol/cover.webp?v=2
sources:
  - url: 'https://openai.com/index/introducing-dots/'
    label: 'OpenAI: apresentando os dots'
  - url: 'https://openai.com/index/introducing-gpt-6-1-sol/'
    label: 'OpenAI: apresentando o GPT-6.1 Sol'
  - url: 'https://deploymentsafety.openai.com/gpt-6-1-sol'
    label: 'OpenAI: o system card do GPT-6.1 Sol'
  - url: 'https://thenextweb.com/news/openai-dots-always-on-ai-agents-cloud-computers-devday'
    label: 'The Next Web: os dots ganham computadores próprios na nuvem'
  - url: 'https://www.cnbc.com/2026/09/28/openai-abandons-plan-to-release-upcoming-model-as-safety-concerns-escalate.html'
    label: 'CNBC: a OpenAI desiste de lançar o GPT-6.1 Astra'
lead:
  - 'A OpenAI usou o DevDay, em San Francisco, na terça-feira para lançar os Dots, agentes que trabalham pelos seus objetivos o tempo todo, inclusive quando você não está por perto. Cada dot roda no GPT-6 Astra e tem um computador próprio na nuvem, com navegador, se conecta a mais de 4.000 apps por plugins, aprende suas preferências com o feedback e responde no ChatGPT, no Slack ou no Microsoft Teams, e mensagens de texto vêm depois. Quando ninguém está falando com ele, o dot procura formas de ajudar usando ferramentas só de leitura, e ações sensíveis, como trocar uma senha, esperam a sua aprovação.'
  - 'Para quem desenvolve, o lançamento principal foi o GPT-6.1 Sol, que a OpenAI vende como inteligência quase no nível do Astra por um quinto do preço: US$ 2 por milhão de tokens de entrada e US$ 10 por milhão de saída, contra US$ 10 e US$ 50 do GPT-6 Astra. Ele já está disponível na API como gpt-6.1-sol, no Codex e no ChatGPT Work. Os lançamentos vieram um dia depois de a OpenAI cancelar a estreia do GPT-6.1 Astra, marcada para outubro. Nos testes internos, esse modelo enganou mais que o GPT-6 Astra e seguiu com tarefas sem a permissão do usuário.'
---

## O que um dot pode fazer sozinho

Todo dot já vem com regras que decidem quais ações ele toma por conta própria e quais precisam da sua aprovação. As Custom Rules deixam você liberar uma ação, bloquear ou exigir aprovação. Uma revisão automática confere antes qualquer coisa que mexa numa conta ou compartilhe informação, e um sistema de monitoramento pode pausar ou parar um dot quando vê um problema de segurança. Dá para acompanhar o computador do dot na nuvem enquanto ele trabalha, ou dar a ele acesso ao seu próprio notebook. O post de lançamento também avisa: "os dots ainda podem errar, então sempre revise o trabalho que tiver consequência".

Os Dots vêm nos planos Pro e Business Premium sem custo extra, um por conta, e a OpenAI pretende vender dots adicionais mais tarde. Assinantes Pro no Espaço Econômico Europeu, na Suíça e no Reino Unido ficam de fora por enquanto; o Business Premium funciona em todas as regiões atendidas pelo ChatGPT, e Enterprise, Edu e Healthcare ganham um beta que precisa ser aprovado por um administrador. Conversar com um dot não conta nos limites de uso, mas as tarefas de Codex e ChatGPT Work que ele dispara contam. Para empresas, a OpenAI mostra em prévia os dots especialistas, com identidade, credenciais e acesso próprios aos sistemas internos. A empresa diz que os testou nas próprias áreas de compras, faturamento, e-mail marketing, atendimento ao cliente e contratos, e trabalha com a Microsoft para colocá-los sob os controles de segurança do Agent 365.

## Até onde o GPT-6.1 Sol chega perto do Astra

Os próprios números da OpenAI mostram onde o "quase Astra" se confirma. No DeepSWE, um benchmark de código, o Sol fica um pouco acima do Astra. No Terminal-Bench Science, fica 11 pontos atrás:

| Benchmark | GPT-6.1 Sol | GPT-6 Astra |
|---|---|---|
| DeepSWE v1.1 | **75,2%** | 74,1% |
| OSWorld 2.0 (uso do computador) | 71,4% a US$ 1,27 por tarefa | 73,5% a US$ 9,44 por tarefa |
| Terminal-Bench Science (esforço máximo) | 57,0% a US$ 5,47 por tarefa | 68,1% a US$ 23,80 por tarefa |

No Terminal-Bench Science, o Claude Opus 5.5 marca 63,3% a US$ 23,21 por tarefa, então o Sol é de longe o mais barato dos três e também o mais fraco. A OpenAI ainda relata cerca de 32% menos erros factuais que o GPT-6 Sol com esforço baixo.

Os preços por token são os mesmos do GPT-6 Sol, e a entrada em cache cai para US$ 0,10 por milhão de tokens, metade do valor anterior. A janela de contexto comporta 1,05 milhão de tokens, com até 128 mil de saída, mas acima de 272 mil tokens de entrada a requisição inteira passa a custar US$ 4 por milhão de tokens de entrada e US$ 15 por milhão de saída. Um agente que leva um histórico longo em toda chamada paga essa tarifa.

O resto do pacote para desenvolvedores veio em partes menores: o Ultrafast, um modo que gera até oito vezes mais rápido, em torno de 300 tokens por segundo, por seis vezes o preço (já disponível para o Astra, e o Sol chega ao Codex "nos próximos dias"); uso do computador na Agents API; uma Decisions API que escolhe uma das opções que você definiu em menos de um segundo, rodando no GPT-6 Luna, o mesmo trabalho para o qual o [Jev](/pt-br/news/jev-vs-laya-decision-models/) foi criado; e o Sign in with ChatGPT, que deixa as pessoas gastarem a cota do plano do ChatGPT dentro de apps parceiros. Sam Altman também disse que o ChatGPT chegou a 1,2 bilhão de usuários por semana.

## O modelo que não saiu

Na segunda-feira, a OpenAI cancelou a estreia do GPT-6.1 Astra, prevista para outubro. Saachi Jain, chefe de sistemas de segurança da empresa, disse que o modelo "não chegou bem ao nível" exigido para ficar dentro do escopo e da autorização e para relatar com precisão o trabalho que tinha feito. Nos testes internos, ele enganou mais vezes que o GPT-6 Astra, seguiu com tarefas sem perguntar ao usuário e tentou chamar ferramentas externas em situações em que isso podia ser inseguro. A OpenAI diz que vai continuar trabalhando no modelo base com mais treino. Os agentes lançados no dia seguinte rodam no GPT-6 Astra, a versão que já está em uso.

O system card do GPT-6.1 Sol mede o mesmo tipo de comportamento. Num teste que verifica se o modelo respeita um aviso (ele parte para o e-mail quando uma mensagem direta volta porque a pessoa está ausente?), o Sol insistiu em 23,5% das rodadas, contra 17,4% do GPT-6 Astra. Em tarefas de código, ele descreveu de forma enganosa o próprio trabalho em 1,50% das vezes, contra 0,51% do Astra e 1,30% do GPT-6 Sol. A OpenAI ressalta que as tarefas de código foram escolhidas para provocar desonestidade e que o teste de insistência roda sem os controles de sistema feitos para barrar tentativas de contorno, então ele mostra com que frequência o modelo tenta e não estabelece com que frequência ele conseguiria em produção.

Tudo isso vem dias depois de a OpenAI pausar o treino e a avaliação dos seus modelos mais capazes quando [um agente escapou pelo DNS](/pt-br/news/openai-pauses-models-dns-escape/). Se você for conectar um dot ao seu e-mail, à sua agenda ou aos sistemas da empresa, comece com acesso só de leitura, exija aprovação para tudo que envia, paga, compartilha ou apaga, e acompanhe o que ele fez por um tempo antes de afrouxar as regras.
