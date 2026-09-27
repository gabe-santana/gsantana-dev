---
title: "AZ-305 / AZ-104: Private Endpoint ou Service Endpoint para Azure Storage?"
description: "Uma questão simulada sobre acesso privado ao Storage: o IP de destino, e não só o caminho do tráfego, decide a resposta."
date: "2026-09-26"
exam: "AZ-305 / AZ-104"
kind: "question"
videoEmbed: "https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7426370058035236864?compact=1"
sourceUrl: "https://www.linkedin.com/posts/gsantana-s_quest%C3%A3ozinha-simulada-para-az-305-az-104-activity-7426370267280752640-_gyV"
---

## A pista está no IP de destino

No vídeo, o App1 acessa dados em uma conta do Azure Storage. A questão simulada pede uma solução de rede que mantenha o tráfego no backbone privado da Microsoft **e permita acessar o Storage por um IP privado dentro da VNet**. As opções são Private Endpoint, Service Endpoint com Service Endpoint Policy, ExpressRoute com Microsoft Peering e Virtual Network Gateway.

**A resposta é Private Endpoint.** Tanto ele quanto o Service Endpoint podem manter o tráfego na rede da Microsoft. Só o primeiro cria, na VNet, um IP privado de destino para a conexão com esse Storage. É a segunda parte do enunciado que decide a questão; "passa pela rede da Microsoft" não basta.

## O que o Private Endpoint cria de verdade

Um Azure Private Endpoint é uma interface de rede em uma subnet da VNet. Ela recebe um IP daquela subnet e se conecta a um recurso específico por meio do Private Link. Para o Storage, a aplicação continua usando o nome normal da conta, mas o [DNS privado o resolve para o IP do endpoint](https://learn.microsoft.com/en-us/azure/storage/common/storage-private-endpoints). O tráfego segue pelo backbone da Microsoft até o serviço, sem passar pela internet pública.

A precisão aqui importa: o IP privado pertence à **interface do endpoint**, não a todos os serviços da conta nem ao endpoint público dela. O Storage separa seus sub-recursos: se o App1 usa Blob Storage, precisa de um endpoint para `blob`; se também usa Files ou Queues, precisa de endpoints para esses serviços. A [documentação de Private Endpoints no Storage](https://learn.microsoft.com/en-us/azure/storage/common/storage-private-endpoints) lista as zonas DNS correspondentes, como `privatelink.blob.core.windows.net`.

## Por que as outras três opções não fecham a conta

- **Service Endpoint + Service Endpoint Policy:** é uma alternativa séria, não uma resposta absurda. O [Service Endpoint](https://learn.microsoft.com/en-us/azure/virtual-network/virtual-network-service-endpoints-overview) leva o tráfego da subnet ao Storage pelo backbone da Microsoft, e a [policy](https://learn.microsoft.com/en-us/azure/virtual-network/virtual-network-service-endpoint-policies-overview) pode limitar as contas de Storage alcançáveis. Só que o destino continua sendo um IP publicamente roteável. A conta não ganha um IP privado de destino dentro da VNet. Se o enunciado pedisse apenas restrição por subnet, essa opção mereceria análise; aqui ela falha no requisito explícito de IP privado.
- **ExpressRoute (Microsoft Peering):** conecta a rede local a serviços Microsoft por seus endereços públicos. Não cria um Private Endpoint de Storage na VNet do App1. Num cenário híbrido, [ExpressRoute private peering ou VPN podem dar acesso à VNet que contém o endpoint](https://learn.microsoft.com/en-us/azure/storage/common/storage-private-endpoints), mas o endpoint continua sendo outro recurso, configurado à parte.
- **Virtual Network Gateway:** conecta redes, como um ambiente local e uma VNet Azure. Não é uma interface dedicada ao recurso Storage e, sozinha, não faz o nome da conta resolver para um IP privado.

## Da resposta de prova para uma arquitetura que funciona

Marcar a alternativa certa é uma coisa. Fazer o acesso ser privado de verdade exige mais alguns passos:

1. Crie um Private Endpoint para cada sub-recurso do Storage usado pelo App1, começando por `blob` se a aplicação lê blobs.
2. Integre a zona DNS privada adequada à VNet. A partir da rede do App1, confirme que o nome *normal* do Storage resolve para o IP privado do endpoint; nada de fixar IP no código.
3. Se todos os clientes puderem usar Private Link, [desabilite o acesso público à conta de Storage](https://learn.microsoft.com/en-us/azure/storage/common/storage-network-security-set-default-access). Criar o Private Endpoint **não** desliga automaticamente o endpoint público.
4. Separe rede de autorização: configure a identidade Microsoft Entra e as permissões de dados necessárias. Chegar ao Storage por uma rota privada não dá, por si só, acesso aos arquivos.

O hábito de prova que quero reforçar é este: leia cada restrição do enunciado e diferencie **por onde o tráfego passa** de **qual endereço o cliente acessa**. O AZ-104 cobra a configuração dos dois tipos de endpoint; o AZ-305 cobra a escolha arquitetural para o requisito ([guia do AZ-104](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-104), [guia do AZ-305](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-305)).
