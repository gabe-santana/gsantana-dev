---
title: Reddit desliga os feeds RSS em 13 de novembro e a API pública em março, e culpa a raspagem por IA
summary: O RSS virou uma "superfície comum para raspagem em larga escala e abuso automatizado", diz o Reddit. Moderadores ganham um app que repassa a atividade para o Discord, os outros usuários de RSS ficam sem nada, e desenvolvedores precisam registrar seus apps até 12 de janeiro ou perdem o acesso à API.
date: '2026-09-30'
order: 2
category: engineering
publisher: Reddit
sourceUrl: 'https://www.reddit.com/r/modnews/comments/1wubgvt/continuing_our_infrastructure_updates_whats/'
image: /news/reddit-ends-rss-public-api/cover.webp?v=1
sources:
  - url: 'https://www.reddit.com/r/modnews/comments/1wubgvt/continuing_our_infrastructure_updates_whats/'
    label: 'r/modnews: o anúncio para os moderadores'
  - url: 'https://www.reddit.com/r/redditdev/comments/1wubcvf/moving_data_api_apps_to_the_developer_platform/'
    label: 'r/redditdev: a migração dos apps da Data API para a Developer Platform'
  - url: 'https://techcrunch.com/2026/09/30/reddit-is-killing-rss-feeds-ending-public-api-access-because-of-ai-bots/'
    label: 'TechCrunch: o Reddit acaba com os feeds RSS e com o acesso público à API'
  - url: 'https://thenextweb.com/news/reddit-rss-feeds-shut-down-old-reddit-ai-scraping'
    label: 'The Next Web: o RSS acaba em 13 de novembro, e o old Reddit fica mais fechado'
lead:
  - 'O Reddit anunciou na quarta-feira que vai desligar os feeds RSS em 13 de novembro e encerrar a API pública em março de 2027. O motivo declarado é a raspagem por IA: o RSS virou uma "superfície comum para raspagem em larga escala e abuso automatizado". "Sabemos que o RSS é uma parte querida da web aberta há muito tempo, e agradecemos a todos que o usaram", escreveu a empresa aos moderadores.'
  - 'A mudança na API atinge toda ferramenta que lê conversas do Reddit de forma programática, de produtos de monitoramento de redes sociais e projetos de pesquisa a assistentes de IA. Quem desenvolve apps e bots de terceiros aprovados tem até 12 de janeiro para registrá-los; depois disso, o Reddit corta o acesso à API de quem não tiver registrado. O old Reddit, que já exige login, vai continuar aberto só para moderadores e para quem o usou nos últimos 90 dias.'
---

## O que substitui o quê

Para moderadores que acompanham suas comunidades pelo RSS, o Reddit indica o Discord Relay, um app da sua Developer Platform (Devvit) que repassa a atividade para o Discord, e pede que as equipes de moderação migrem antes de 13 de novembro. Quem lê feeds de comunidades que não modera fica sem nada: para esse uso, diz o Reddit, "não há substituto".

O post para desenvolvedores trata da migração dos apps da Data API para a Developer Platform, onde os apps rodam dentro do Reddit. Segundo o The Next Web, o Reddit vai pagar US$ 1.000 a cada app elegível que concluir a mudança, de um fundo de US$ 1 milhão, e mais de 14.000 apps e bots já se registraram. Para uso comercial por IA, o caminho que sobra é um contrato de licenciamento pago com o Reddit.

## Por que o Reddit está fechando as portas abertas

O Reddit vende seus dados para empresas de IA. A linha de "outras receitas", onde esse licenciamento entra, somou US$ 43 milhões no segundo trimestre, 24% a mais que um ano antes, segundo o TechCrunch. Cada feed aberto é um jeito de pegar as mesmas conversas sem pagar, e este é o passo seguinte à mudança de preços da API em 2023, que acabou com apps como o Apollo, e ao login obrigatório que já vale para o old Reddit.

## O que conferir no seu stack

Se algo que você roda lê o Reddit por RSS, para de funcionar em 13 de novembro: leitores de feed, automações no Zapier, IFTTT ou n8n, bots de Slack e Discord que postam novas threads. Scripts que usam a API, como coletores com PRAW e raspadores de pesquisa, precisam de um app registrado antes de 12 de janeiro e de um plano para março. E se algum produto seu de IA usa threads do Reddit como fonte, por busca ou retrieval, essa fonte vai embora, a não ser que você pague a licença.
