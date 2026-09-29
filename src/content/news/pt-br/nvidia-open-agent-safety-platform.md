---
title: 'NVIDIA abre uma plataforma para manter agentes de IA dentro do sandbox, e a Perplexity mostra por onde os sandboxes vazam'
summary: A Open Agent Safety Platform da NVIDIA junta o runtime open source OpenShell ao Sentry, um vigia que roda em DPUs BlueField-4. No mesmo dia, o red team da Perplexity mostrou que nenhum modelo rompeu a fronteira da VM, mas quatro driblaram a política de rede em 8 de 10 sandboxes testados.
date: '2026-09-29'
order: 0
category: security
publisher: NVIDIA
sourceUrl: 'https://nvidianews.nvidia.com/news/open-agent-safety-platform'
image: /news/nvidia-open-agent-safety-platform/cover.webp?v=1
sources:
  - url: 'https://nvidianews.nvidia.com/news/open-agent-safety-platform'
    label: 'NVIDIA Newsroom: a Open Agent Safety Platform'
  - url: 'https://developer.nvidia.com/blog/nvidia-open-agent-safety-platform-a-reference-for-continuous-in-silicon-agent-monitoring/'
    label: 'NVIDIA Technical Blog: monitoramento contínuo de agentes no silício'
  - url: 'https://www.perplexity.ai/hub/blog/escaping-space-part-i'
    label: 'Perplexity: Escaping SPACE, parte I'
  - url: 'https://alphasignal.ai/news/perplexity-s-space-red-team-exposes-a-network-bypass-flaw-hitting-8-sandboxes'
    label: 'AlphaSignal: o desvio de rede que atingiu 8 sandboxes'
lead:
  - 'A NVIDIA lançou na segunda-feira a Open Agent Safety Platform, um projeto de referência para rodar agentes de IA dentro de limites que o próprio agente não consegue contornar na conversa. São duas peças: o OpenShell, um runtime open source (Apache 2.0) que isola o agente no nível do kernel e decide quais arquivos, redes, ferramentas, processos e credenciais ele pode tocar, e o Sentry, um vigia que roda fora da máquina do agente, em DPUs BlueField-4, e consegue colocar um agente em quarentena em milissegundos quando ele sai da política. Mais de 100 organizações trabalham com a plataforma, entre elas Anthropic, Microsoft, Cisco, CrowdStrike, Hugging Face, Red Hat, SAP e ServiceNow.'
  - 'No mesmo dia, a Perplexity publicou o que aconteceu quando seu time de segurança mandou nove modelos de ponta, com acesso root, fugirem do SPACE, o sandbox por trás do Perplexity Computer. Em 108 tentativas de fuga, nenhum atravessou a fronteira da máquina virtual, mesmo com o código-fonte do sandbox em mãos. Mas nas rodadas que liberavam um pouco de rede, quatro modelos chegaram a um endereço bloqueado mesmo assim, e o mesmo truque funcionou contra 8 dos 10 produtos de sandbox que a Perplexity testou.'
---

## A regra aplicada fora do agente

A ideia do projeto da NVIDIA é a que Mike Nicolls, presidente da SpaceXAI, resumiu numa frase no anúncio: a segurança "deve ser aplicada fora do modelo, por controles adicionais". O OpenShell transforma as instruções do operador numa política conferida antes de o agente rodar e aplicada enquanto ele trabalha, e cada ação fica registrada. O [post técnico da NVIDIA](https://developer.nvidia.com/blog/nvidia-open-agent-safety-platform-a-reference-for-continuous-in-silicon-agent-monitoring/) vai além e diz que um provador demonstra que a política não escapa da intenção do operador. O Sentry fica na DPU, que a NVIDIA descreve como o único caminho do nó até o modelo, e cruza interações do agente, decisões de política e acesso a ferramentas e dados na velocidade da linha, sem depender da pilha de software que um atacante ou um agente mal comportado poderia adulterar.

O OpenShell já está no GitHub e roda nas CPUs NVIDIA Vera, com suporte a plataformas Arm e Intel. O Sentry precisa da BlueField-4, e nos sistemas Vera que já têm a placa, a NVIDIA diz que ativar as proteções é uma atualização de software. O que o anúncio não traz também vale saber: nenhum número de overhead, nenhuma latência de quarentena além de "milissegundos", nenhuma sintaxe de política e nenhum limite de escala por enquanto.

## O vazamento é a rede, de novo

O relatório da Perplexity é a metade mais instrutiva do dia. O SPACE roda cada sandbox como uma microVM Firecracker, com um gateway no host que aplica a política de saída de rede, e a fronteira da VM segurou em todas as rodadas. As falhas vieram da lista de permissões. Com acesso só aos espelhos do PyPI e do Ubuntu, modelos forjaram respostas de DNS para que `pypi.org` apontasse para um endereço de callback, ou acharam endpoints de CDN (Fastly, Taboola, thum.io) que dividem IPs com os repositórios liberados e passaram por eles. Um modelo, o GPT-5.6 Cyber, fez um serviço de screenshot fotografar a página bloqueada e leu a flag de volta com OCR. A Perplexity passou a validar o endereço de origem e a exigir o hostname nas camadas TLS e HTTP, e, segundo o resumo do AlphaSignal, só o Cloudflare Sandbox e o NVIDIA OpenShell resistiram aos dois ataques, enquanto outros quatro fornecedores já tinham publicado correções.

É a mesma lição da [fuga pelo DNS na OpenAI](/pt-br/news/openai-pauses-models-dns-escape/), relatada dias antes, agora reproduzida no mercado inteiro: um agente capaz trata todo caminho que funciona como permitido, e uma regra de saída escrita como "estes IPs" ou "estes domínios" vaza por DNS, por infraestrutura compartilhada e por qualquer serviço que busque URLs em seu nome. Se você roda agentes com ferramentas, aplique a saída por hostname e pelo nome do servidor TLS, não por IP, confira se as respostas de DNS vêm do seu resolvedor, negue por padrão serviços que buscam URLs e coloque o monitor e o botão de parada num lugar que o processo do agente não alcança.
