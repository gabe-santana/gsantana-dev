---
title: "Guia definitivo de redes no Azure: do CIDR ao hub e spoke"
description: "Tudo o que você precisa para projetar, proteger e diagnosticar redes no Azure, do planejamento de endereços à conectividade híbrida, private endpoints e hub e spoke."
date: 2025-10-19
tags: [Azure, Networking, Security, Software Architecture]
tldr:
  - "Planeje o endereçamento antes de tudo: blocos CIDR sem sobreposição por VNet e sub-rede, dimensionados para os picos e para os 5 endereços que o Azure reserva em toda sub-rede, evitam refazer endereços ao adicionar peering, VPN ou ExpressRoute."
  - "Defenda em camadas e deixe todo caminho explícito: NSGs e tabelas de rota na sub-rede, Azure Firewall no hub, saída explícita em vez do acesso de saída padrão e Private Link com DNS privado para o tráfego de PaaS não passar pela internet."
  - "Cresça com hub e spoke, lembrando que peering não é transitivo, e diagnostique camada por camada (DNS, rota, TCP, TLS, HTTP) com o Network Watcher e os flow logs de VNet."
---

<div class="callout info" data-title="Revisado em setembro de 2026">
  <p>Este guia foi atualizado com as mudanças do último ano: sub-redes privadas por padrão e o fim do acesso de saída padrão em VNets novas, a aposentadoria dos flow logs de NSG em favor dos flow logs de VNet, a migração para SKUs de VPN Gateway com redundância de zona e a aposentadoria do Front Door (clássico) e do Azure CDN (clássico).</p>
</div>

Este é o guia que eu queria ter tido quando comecei a projetar redes no Azure: o que cada peça faz, onde ela fica, como as peças falham juntas e o que conferir primeiro quando algo não conecta. Ele vai dos fundamentos de endereçamento até o hub e spoke, com diagramas para as partes que são mais fáceis de ver do que de ler.

De tempos em tempos aparece o "Júnior Inocente" com uma dúvida que muita gente tem e não pergunta. Use essas interrupções para testar o seu entendimento antes de ler a resposta.

## Ganhando intuição

Ao longo do texto, farei analogias com um cenário só.

Imagine um **grande condomínio**. Cada apartamento é um recurso (uma VM, um pod, um banco de dados), os corredores são os caminhos do tráfego e o número do apartamento é o **endereço IP**. Cada prédio tem um padrão de numeração que diz quantos dígitos identificam o "andar" (a rede) e quantos identificam o "apartamento" (o host). Esse padrão é a **máscara**, escrita na notação **CIDR** (Classless Inter-Domain Routing), e é ela que define o tamanho máximo de cada prédio. Se você não define esse padrão com clareza desde o começo, tudo vira confusão no dia em que quiser conectar prédios (VNets) ou abrir passagens entre eles (peering, VPN, ExpressRoute).

Com vários prédios no mesmo condomínio, as pessoas precisam circular entre eles: visitar um vizinho de outro bloco, ir à administração ou usar as áreas comuns. Esse é o trabalho dos **roteadores**, as portarias internas que direcionam quem vai para qual prédio, para o tráfego sair do lugar certo e chegar ao destino correto.

Circular não basta; também é preciso controle de acesso. Ninguém quer estranhos entrando nos apartamentos, e no mundo digital isso importa ainda mais. Por isso existem os "porteiros digitais", como firewalls e network security groups (NSGs), que decidem quem pode e quem não pode acessar um recurso: "só entra quem está na lista".

Alguns prédios também têm acesso exclusivo, como garagens privativas ou elevadores que só abrem com chave eletrônica. No Azure, isso é o **Private Link**: serviços sensíveis acessados por dentro da rede, sem passar pela internet pública, como se um corredor privativo levasse direto ao apartamento.

E quando o condomínio cresce tanto que fica difícil manter tudo organizado, você adota o **hub e spoke**: um prédio central (o hub) concentra os serviços compartilhados, como segurança, DNS e conectividade externa, enquanto os outros prédios (spokes) se conectam só a ele, nunca diretamente entre si.

Primeiro conceito firme: sem máscara, um endereço IP é ambíguo. `10.50.12.34` sozinho não diz a qual bloco pertence, como um número de apartamento quando você não sabe se os dois primeiros dígitos são o andar. `10.50.0.0/20` diz: os primeiros 20 bits são a rede, e o bloco tem um espaço delimitado para usar, então nunca colide com um vizinho quando qualquer um dos dois crescer.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Se eu pegar um /16 gigante para cada VNet, não resolvo tudo de uma vez?</span>
    </div>
  </div>
</div>

Você só empurra o problema para frente. Um /16 por VNet queima 65.536 endereços de cada vez, então algumas regiões e ambientes esgotam as faixas privadas que a sua empresa divide com o on-premises, e todo peering ou VPN precisa desviar do desperdício. Vários blocos bem dimensionados são melhores que um monolito superdimensionado, e facilitam muito a segmentação.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>E se a faixa ficar errada, trocar depois não é só editar um campo?</span>
    </div>
  </div>
</div>

Dá para adicionar faixas a uma VNet depois, mas não dá para encolher nem mover uma faixa com sub-redes em uso. Consertar um plano ruim costuma exigir recriar sub-redes, mover recursos, ajustar rotas e NSGs, recriar private endpoints e mudar o que os roteadores do on-premises anunciam. Em produção, isso custa semanas e traz risco. Planeje cedo.

Com essa base, vamos mapear onde cada componente atua nas camadas de rede, para você saber onde olhar quando algo quebrar.

### Modelos OSI e TCP/IP na prática do Azure

Você não precisa decorar cada campo de cada cabeçalho, mas precisa saber "onde está" quando alguém fala de um serviço:

| Camada (OSI) | Equivalente TCP/IP | Foco | Exemplos e conceitos no Azure |
|---|---|---|---|
| 7 Aplicação | Aplicação | Semântica da requisição | Front Door, Application Gateway (WAF), HTTP, gRPC |
| 6 Apresentação | (parte da Aplicação) | Formato e codificação | Terminação TLS (Application Gateway, Front Door), compressão |
| 5 Sessão | (parte da Aplicação) | Controle de sessão | WebSockets através de um gateway, handshake TLS |
| 4 Transporte | Transporte | Confiabilidade e portas | TCP/UDP, Load Balancer, SNAT, health probes |
| 3 Rede | Internet | Endereçamento e roteamento | VNet, sub-rede, tabela de rotas (UDR), BGP (VPN, ExpressRoute) |
| 2 Enlace | Acesso à rede | Quadros, MAC, ARP | NIC virtual; a SDN do Azure abstrai (sem broadcast, sem multicast) |
| 1 Física | Acesso à rede | Sinal e fibra | A infraestrutura do provedor, que você não gerencia |

O modelo TCP/IP simplifica isso em 4 camadas (enlace, internet, transporte, aplicação). Na nuvem você trabalha principalmente nas camadas 3 a 7. Quando cria uma VNet, está desenhando limites de L3; um NSG é uma política sobre metadados de L3 e L4; um Application Gateway adiciona lógica de L7; e o Front Door leva a L7 para a borda global.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Então se eu errar uma rota, não arrumo no WAF, certo?</span>
    </div>
  </div>
</div>

Correto. Um problema de L3 (roteamento) não se corrige num componente de L7 (o WAF). Um diagnóstico eficiente começa identificando a camada onde o sintoma aparece e provando que as camadas abaixo dela funcionam. A seção 6 transforma isso num checklist.

## Como este guia está organizado

<div class="callout info" data-title="O caminho">
  <ol>
    <li>Fundamentos de endereçamento (IPv4 e IPv6, CIDR, faixas privadas, NAT)</li>
    <li>Componentes base do Azure (VNet, sub-redes, NSGs, rotas, saída, Bastion)</li>
    <li>Conectividade privada e híbrida (VPN, ExpressRoute, peering, Virtual WAN, Private Link e DNS)</li>
    <li>Serviços de entrega (Load Balancer, Application Gateway, Front Door, Traffic Manager)</li>
    <li>Segurança de rede (Azure Firewall, DDoS Protection, Zero Trust, regras centralizadas)</li>
    <li>Observabilidade e diagnóstico (Network Watcher, flow logs de VNet, um método camada por camada)</li>
    <li>Performance (hairpinning, rede acelerada, FastPath, cache)</li>
    <li>Padrões de arquitetura (hub e spoke, Virtual WAN, landing zones, multicloud)</li>
    <li>Operação e governança (gestão de IPs, IaC, Azure Policy, revisões)</li>
    <li>Checklist final</li>
  </ol>
</div>

---

## 1. Fundamentos de endereçamento

### Endereços IP e faixas CIDR

Um **endereço IP** (Internet Protocol) é um identificador lógico atribuído a uma interface de rede para que os pacotes encontrem origem e destino. Pense nele como o endereço completo do apartamento de que o carteiro precisa. Ele não está gravado no cabo; ele vive no cabeçalho do pacote, na camada de rede (camada 3). Duas versões estão em uso: IPv4 (32 bits, decimal com pontos) e IPv6 (128 bits, hexadecimal). O IP trabalha junto com os protocolos de transporte (TCP, UDP), que usam portas para diferenciar aplicações no mesmo endereço.

Um endereço IPv4 é escrito `A.B.C.D`, e o sufixo CIDR (`/n`) diz quantos dos seus 32 bits formam a parte de rede. `10.0.0.0/16` guarda 16 bits para a rede e deixa 16 para os hosts: 65.536 endereços.

#### IPv4 vs IPv6: por que existem dois?

O **IPv4** foi projetado quando ninguém imaginava bilhões de dispositivos conectados (celulares, sensores, carros, relógios). O espaço teórico de cerca de 4,29 bilhões de endereços encolhe rápido quando você tira os blocos reservados e privados e considera a distribuição desigual, então surgiram mecanismos de economia (NAT, CIDR, CGNAT, logo abaixo).

O **IPv6** expande o espaço para cerca de 3,4 x 10^38 endereços. Além da quantidade, traz autoconfiguração sem estado (SLAAC), cabeçalhos mais simples e dispensa o NAT para escalar. A adoção é lenta por causa do legado IPv4: ferramentas, aplicações e infraestrutura que ainda assumem o padrão antigo.

| Aspecto | IPv4 | IPv6 |
|---|---|---|
| Tamanho | 32 bits | 128 bits |
| Formato | 192.0.2.10 | 2001:db8:85a3::8a2e:370:7334 |
| Escassez | Sim | Não (praticamente inesgotável) |
| NAT necessário | Quase sempre em escala | Normalmente desnecessário |
| Configuração | DHCP ou manual | SLAAC, DHCPv6 opcional |
| Fragmentação | Roteadores podem fragmentar | Só a origem fragmenta |
| IPsec | Complemento opcional | Previsto no projeto, mas opcional na prática |

### Tipos de IP

1. **Privado**: as faixas da RFC 1918, `10.0.0.0/8`, `172.16.0.0/12` e `192.168.0.0/16`, não roteáveis na internet. O Azure também aceita o espaço compartilhado da RFC 6598, `100.64.0.0/10`, como espaço privado numa VNet.
2. **Público**: acessível pela internet. No Azure, um IP público é um recurso que você associa a um load balancer, um gateway, um firewall ou (raramente) uma VM.
3. **Estático**: não muda. Necessário para allowlists, registros DNS que apontam direto para um IP e parceiros que filtram pela origem.
4. **Dinâmico**: atribuído sob demanda. Serve para recursos internos que sempre são acessados pelo nome.
5. **IP de saída padrão**: o IP público implícito que o Azure historicamente dava a uma VM sem nenhum caminho explícito para a internet. Ele pertence à Microsoft, pode mudar sem aviso e está sendo descontinuado: veja "Saída: deixe explícita" na seção 2.

### Como o mundo lidou com a escassez de IPv4

- **NAT (Network Address Translation)**: traduz endereços privados internos para um endereço público (ou alguns) na saída, para centenas de dispositivos dividirem um IP externo.
- **PAT (Port Address Translation)**: multiplexa muitas conexões sobre um IP dando a cada uma uma porta de origem diferente. É o que o roteador da sua casa faz, e o que o Azure chama de SNAT.
- **CGNAT (Carrier-Grade NAT)**: provedores de internet colocam muitos assinantes atrás de camadas extras de NAT.
- **CIDR**: blocos de tamanho flexível em vez das classes fixas A, B e C, para aproveitar melhor o espaço e agregar rotas.
- **NAT Gateway (Azure)**: SNAT gerenciado e escalável para uma sub-rede inteira, sem um IP público por VM.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Se o NAT resolve o problema, pra que perder tempo com IPv6?</span>
    </div>
  </div>
</div>

NAT é um paliativo. Ele quebra o princípio fim a fim, dificulta a telemetria e o diagnóstico (o endereço que você vê não é o que enviou o pacote), exige tratamento especial para protocolos que carregam endereços no conteúdo (SIP, FTP) e fica sem portas sob carga pesada de saída. O IPv6 devolve o modelo direto: cada dispositivo com um endereço global único.

### Proxy reverso vs NAT

Um **proxy reverso** (Nginx, Envoy, Azure Application Gateway, Front Door) trabalha na camada de aplicação. Ele termina a conexão HTTP(S) e pode reescrever cabeçalhos, balancear carga, autenticar e inspecionar o conteúdo. O NAT só troca endereços e portas, sem entender o que o pacote carrega.

| Característica | NAT/PAT | Proxy reverso |
|---|---|---|
| Camada | L3/L4 | L7 |
| Entende o protocolo | Não | Sim (HTTP, gRPC) |
| Altera o conteúdo | Não | Pode (cabeçalhos, compressão) |
| Objetivo principal | Economizar IPs, chegar à internet | Segurança, balanceamento, observabilidade |
| O que os logs mostram | Fluxos (5-tupla) | Método, caminho, status, latência |

### Dual stack e transição gradual

A maioria dos ambientes chega ao IPv6 pelo **dual stack**: IPv4 e IPv6 lado a lado. No Azure, uma VNet e suas sub-redes podem ter faixas IPv6 (sub-redes IPv6 precisam ser exatamente `/64`), um Standard Load Balancer pode ser dual stack, o Application Gateway v2 aceita frontend IPv6 (em gateways novos, numa VNet dual stack, com backends IPv4) e o Front Door atende clientes IPv6 na borda.

Uma estratégia que funciona:

1. Planeje faixas IPv6 documentadas, com o mesmo cuidado do IPv4.
2. Habilite IPv6 primeiro na borda (Front Door, load balancers públicos), com o interior ainda em IPv4.
3. Meça: fatia de requisições IPv6, latência comparada ao IPv4, erros por protocolo.

Duas coisas mudam no caminho. **Segurança**: as regras de NSG e firewall precisam cobrir o IPv6 explicitamente; um conjunto de regras só de IPv4 não protege o caminho IPv6. **Monitoração**: flow logs e dashboards precisam dos dois protocolos para a visão completa.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Então primeiro eu deixo o IPv4 bem organizado, e depois vou ativando IPv6 onde fizer sentido?</span>
    </div>
  </div>
</div>

Exatamente. Primeiro um planejamento rigoroso de IPv4 (CIDR sem sobreposição), depois IPv6 onde compensa (a borda pública, APIs com enormes populações de clientes, IoT). O dual stack evita uma migração tudo ou nada.

### Qual o tamanho certo de uma sub-rede?

Aqui está o detalhe que a maioria das tabelas da internet erra para o Azure: **o Azure reserva 5 endereços em toda sub-rede**. Em `192.168.1.0/24`, são o `.0` (a rede), o `.1` (o gateway padrão), o `.2` e o `.3` (mapeados para o DNS do Azure) e o `.255` (o endereço de broadcast, mesmo as VNets não tendo broadcast). A menor sub-rede IPv4 que o Azure aceita é uma `/29`, e a maior, uma `/2`.

| Prefixo | Endereços no total | Utilizáveis no Azure | Uso típico |
|---|---|---|---|
| /29 | 8 | 3 | A menor permitida; raramente vale a pena |
| /28 | 16 | 11 | Endpoints do DNS Private Resolver, camadas pequenas |
| /27 | 32 | 27 | GatewaySubnet |
| /26 | 64 | 59 | Azure Firewall, Azure Bastion, private endpoints |
| /24 | 256 | 251 | Uma camada de aplicação normal |
| /22 | 1.024 | 1.019 | A faixa inteira de um spoke, node pools do AKS |
| /20 | 4.096 | 4.091 | AKS com Azure CNI (um IP por pod) |
| /16 | 65.536 | 65.531 | Um bloco regional para recortar, não um workload |

Dimensione para os picos, não para a média de hoje. O esgotamento clássico é o AKS com o Azure CNI tradicional, em que cada pod consome um IP da sub-rede; com o **Azure CNI Overlay**, os pods recebem endereços de uma faixa separada, fora da VNet, e a sub-rede só precisa caber os nós.

### Faixas privadas e sobreposição

O Azure usa as mesmas faixas privadas do seu data center, e é exatamente aí que mora o perigo: no dia em que você conecta os dois por VPN ou ExpressRoute, qualquer sobreposição entre on-premises e nuvem vira uma faixa inalcançável. Mantenha um único plano de endereços para a empresa inteira, nuvem incluída, e recorte blocos regionais a partir dele.

Dá para conferir um plano antes de um único recurso existir. Este script, que usa só a biblioteca padrão do Python, monta um hub e dois spokes, aplica os 5 endereços reservados e os tamanhos mínimos das sub-redes dedicadas e procura sobreposições dentro do plano e contra o on-premises. Plantei um erro nele de propósito:

```python title="plan_addresses.py"
"""Check an Azure address plan before any of it exists: sizes, overlaps, reserved names."""
from ipaddress import ip_network
from itertools import combinations

AZURE_RESERVED = 5  # network, gateway, 2 x Azure DNS, broadcast
MIN_PREFIX = {  # dedicated subnets with a minimum size
    "GatewaySubnet": 27,
    "AzureFirewallSubnet": 26,
    "AzureBastionSubnet": 26,
    "snet-dns-inbound": 28,
    "snet-dns-outbound": 28,
}

on_premises = {"datacenter-sp": "10.0.0.0/14", "branches": "172.20.0.0/16"}

plan = {
    "vnet-hub (10.40.0.0/22)": {
        "GatewaySubnet": "10.40.0.0/27",
        "snet-dns-inbound": "10.40.0.32/28",
        "snet-dns-outbound": "10.40.0.48/28",
        "AzureFirewallSubnet": "10.40.0.64/26",
        "AzureBastionSubnet": "10.40.0.128/26",
    },
    "vnet-app (10.40.4.0/22)": {
        "snet-web": "10.40.4.0/24",
        "snet-aks-nodes": "10.40.5.0/24",
        "snet-private-endpoints": "10.40.6.0/26",
    },
    "vnet-data (10.40.8.0/23)": {
        "snet-data": "10.40.8.0/24",
        "snet-private-endpoints": "10.40.9.0/26",
        "snet-legacy-import": "10.3.200.0/24",
    },
}

problems = []
subnets = []
for vnet, members in plan.items():
    vnet_range = ip_network(vnet.split("(")[1].rstrip(")"))
    print(f"{vnet}")
    for name, cidr in members.items():
        net = ip_network(cidr)
        usable = net.num_addresses - AZURE_RESERVED
        print(f"  {name:<24} {cidr:<16} {usable:>5} usable")
        if not net.subnet_of(vnet_range):
            problems.append(f"{name} {cidr} is outside {vnet_range}")
        if name in MIN_PREFIX and net.prefixlen > MIN_PREFIX[name]:
            problems.append(f"{name} {cidr} is smaller than /{MIN_PREFIX[name]}")
        subnets.append((f"{vnet.split()[0]}/{name}", net))

for (a, net_a), (b, net_b) in combinations(subnets, 2):
    if net_a.overlaps(net_b):
        problems.append(f"{a} {net_a} overlaps {b} {net_b}")
for label, net in subnets:
    for site, cidr in on_premises.items():
        if net.overlaps(ip_network(cidr)):
            problems.append(f"{label} {net} overlaps on-premises {site} {cidr}")

print("\nproblems:" if problems else "\nno problems found")
for problem in problems:
    print(f"  - {problem}")
```

```text title="terminal"
$ python plan_addresses.py
vnet-hub (10.40.0.0/22)
  GatewaySubnet            10.40.0.0/27        27 usable
  snet-dns-inbound         10.40.0.32/28       11 usable
  snet-dns-outbound        10.40.0.48/28       11 usable
  AzureFirewallSubnet      10.40.0.64/26       59 usable
  AzureBastionSubnet       10.40.0.128/26      59 usable
vnet-app (10.40.4.0/22)
  snet-web                 10.40.4.0/24       251 usable
  snet-aks-nodes           10.40.5.0/24       251 usable
  snet-private-endpoints   10.40.6.0/26        59 usable
vnet-data (10.40.8.0/23)
  snet-data                10.40.8.0/24       251 usable
  snet-private-endpoints   10.40.9.0/26        59 usable
  snet-legacy-import       10.3.200.0/24      251 usable

problems:
  - snet-legacy-import 10.3.200.0/24 is outside 10.40.8.0/23
  - vnet-data/snet-legacy-import 10.3.200.0/24 overlaps on-premises datacenter-sp 10.0.0.0/14
```

Alguém "pegou emprestada" uma faixa que viu numa planilha antiga, e o script pegou as duas consequências: a sub-rede não cabe na VNet dela e colide com o data center de São Paulo. Hoje é um conserto de dois minutos; depois, seria um projeto de migração. Rode uma checagem assim no pipeline que cuida do seu plano de endereços.

---

## 2. Componentes base do Azure

### Virtual Network (VNet)

Uma VNet é uma rede isolada numa região e numa assinatura: você escolhe uma ou mais faixas de endereços (por exemplo `10.40.4.0/22`) e recorta sub-redes delas. O tráfego entre sub-redes da mesma VNet é roteado por padrão, sem gateway. Planeje as VNets por finalidade (`vnet-hub`, `vnet-app`, `vnet-data`) e por ambiente, nunca pelo organograma, que muda mais vezes do que uma rede deveria.

### Sub-redes

As sub-redes separam funções: front-end, aplicação, dados, private endpoints e as sub-redes dedicadas que alguns serviços exigem pelo nome:

| Nome da sub-rede | Usada por | Tamanho mínimo |
|---|---|---|
| `GatewaySubnet` | Gateways de VPN e ExpressRoute | /27 recomendado |
| `AzureFirewallSubnet` | Azure Firewall | /26 |
| `AzureBastionSubnet` | Azure Bastion | /26 |
| Entrada e saída do resolver | Azure DNS Private Resolver (delegadas) | /28 |

Serviços como a integração de VNet do App Service, o Container Apps ou o SQL Managed Instance também usam sub-redes **delegadas**, que pertencem a um serviço cada. Reserve espaço para elas no plano, mesmo que ainda não precise.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Mas não posso só colocar tudo na mesma sub-rede e seguir a vida? Parece menos trabalho...</span>
    </div>
  </div>
</div>

Sub-redes separadas reduzem o raio de estrago. Se uma regra ou rota errada atingir a sub-rede de aplicação, a de dados continua intacta. Elas também permitem NSGs direcionados (o banco só aceita a porta 1433 vinda da sub-rede de aplicação) em vez de uma lista infinita de regras cheia de exceções, e alguns serviços simplesmente se recusam a dividir sub-rede.

### NSG (Network Security Group)

Um NSG filtra o tráfego pela 5-tupla: origem, porta de origem, destino, porta de destino e protocolo. Ele é **stateful**: se uma regra permite uma conexão de saída, a resposta volta sem precisar de regra de entrada, e vice-versa. Cada regra tem uma prioridade de 100 a 4096 (números menores são avaliados primeiro, e a primeira regra que casa vence), uma direção, um protocolo, origem e destino, portas e uma ação.

Todo NSG também traz regras padrão que você não apaga, só sobrepõe com regras de prioridade maior: na entrada, `AllowVNetInBound` (65000), `AllowAzureLoadBalancerInBound` (65001) e `DenyAllInbound` (65500); na saída, `AllowVnetOutBound`, `AllowInternetOutBound` e `DenyAllOutBound`. Repare na segunda regra de saída: de fábrica, um NSG libera tudo para a internet.

Três recursos mantêm os conjuntos de regras legíveis. As **service tags** (`Internet`, `VirtualNetwork`, `AzureLoadBalancer`, `Storage.BrazilSouth`) representam faixas que a Microsoft mantém. Os **application security groups** permitem escrever "servidores web podem acessar servidores de aplicação" em vez de listas de IPs. E as **regras de administrador de segurança** do Azure Virtual Network Manager valem de forma central em muitas VNets e são avaliadas antes de qualquer NSG, que é como um time de plataforma garante "SSH vindo da internet nunca é permitido" sem depender de cada time de workload.

Um NSG pode ser associado a uma sub-rede e a uma NIC. No tráfego de entrada, o NSG da sub-rede é avaliado primeiro e depois o da NIC; na saída, primeiro o da NIC e depois o da sub-rede. O tráfego precisa ser permitido pelos dois. A própria Microsoft recomenda escolher um nível só, normalmente a sub-rede: regras nos dois níveis entram em conflito de jeitos difíceis de diagnosticar.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>E se eu abrir logo tudo (0.0.0.0/0) pra testar rápido e depois fecho? Prometo que fecho...</span>
    </div>
  </div>
</div>

Regras "temporárias" viram regras esquecidas, e scanners acham uma porta de administração aberta em minutos. Aplique o menor privilégio desde o primeiro dia. Para depurar, crie uma regra estreita (o seu IP, uma porta) com a validade no nome ou numa tag, e deixe o pipeline apagá-la. E lembre que remover uma regra não derruba conexões que já estão abertas: mudanças no NSG só afetam conexões novas.

Uma regra simplificada que deixa a internet chegar à porta 443 de uma camada web, e a mais nada:

```json title="nsg-rule-allow-https.json"
{
  "name": "Allow-Internet-HTTPS-To-Web",
  "properties": {
    "priority": 200,
    "direction": "Inbound",
    "access": "Allow",
    "protocol": "Tcp",
    "sourceAddressPrefix": "Internet",
    "sourcePortRange": "*",
    "destinationAddressPrefix": "10.40.4.0/24",
    "destinationPortRange": "443"
  }
}
```

### Tabelas de rota e como o Azure escolhe uma rota

O Azure cria uma tabela de rotas para cada sub-rede com as **rotas de sistema**: as faixas da própria VNet, `0.0.0.0/0` para a internet e rotas de descarte para faixas privadas que você não usa. Peerings e gateways adicionam as rotas deles, e o BGP (da VPN ou do ExpressRoute) adiciona os prefixos que a sua rede anuncia. As **rotas definidas pelo usuário (UDRs)** numa tabela de rotas mudam o próximo salto para destinos específicos: para um appliance de inspeção, para um gateway ou para lugar nenhum (`None`), descartando o tráfego.

Quando várias rotas casam com um destino, o Azure escolhe em dois passos:

<div id="azure-network-route-selection-slot"></div>

1. **Prefixo mais longo.** Uma `/24` vence uma `/16`, que vence uma `/0`, qualquer que seja a origem delas.
2. **Para prefixos idênticos**, a UDR vence a rota BGP, que vence a rota de sistema. A exceção: as rotas de sistema das faixas da própria VNet, dos peerings e dos service endpoints têm preferência até sobre rotas BGP mais específicas, e as rotas de service endpoint não podem ser sobrepostas.

Dois detalhes operacionais pegam muita gente. O próximo salto de uma rota `VirtualAppliance` precisa ter o **encaminhamento de IP** habilitado na NIC (e normalmente no sistema operacional também); sem isso, o Azure descarta os pacotes encaminhados. E todo caminho forçado precisa de um **caminho de volta** equivalente: se o tráfego sai pelo firewall e a resposta volta direto, o firewall vê meia conversa e derruba a sessão. Essa assimetria é a causa mais comum do "conecta e depois trava".

Também nunca associe uma tabela de rotas com `0.0.0.0/0` à `GatewaySubnet`; isso pode fazer o gateway parar de funcionar.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Se eu mandar tudo pro firewall fica mais seguro, né?</span>
    </div>
  </div>
</div>

Nem sempre. Forçar tráfego interno falante (cache, replicação dentro de uma camada) pelo firewall adiciona latência, custo e um ponto único de estrangulamento, sem muita segurança em troca. Mande pelo firewall os fluxos que precisam de inspeção ou de saída controlada: saída para a internet, tráfego entre spokes, tráfego de e para o on-premises.

### Saída: deixe explícita

Historicamente, uma VM sem nenhum caminho explícito de saída recebia um IP de **acesso de saída padrão** da Microsoft. Esse IP pode mudar sem aviso, não aceita ICMP nem pacotes fragmentados e não dá nenhum controle sobre o que os seus servidores acessam, por isso a Microsoft está aposentando esse comportamento. Nas versões de API lançadas depois de 31 de março de 2026, as sub-redes de VNets **novas** são **privadas por padrão** (`defaultOutboundAccess: false`), e o portal já as cria assim. VNets existentes mantêm o comportamento antigo até você mudar as sub-redes delas.

Numa sub-rede privada, uma VM só chega à internet por um método explícito:

- **NAT Gateway** na sub-rede, o padrão recomendado para a maioria dos workloads: IPs públicos estáticos, muitas portas SNAT, nenhuma exposição de entrada.
- **Regras de saída** num Standard Load Balancer.
- Um **IP público** na NIC da VM (raramente o que você quer).
- Uma **UDR para um firewall** ou appliance que faz a saída, como no hub e spoke.

Repare que a ativação e as atualizações do Windows também precisam desse caminho explícito. E para tornar privada uma sub-rede existente, as VMs dela precisam ser paradas e desalocadas para a mudança chegar às NICs.

### IPs públicos e privados

Prefira expor serviços por uma camada de entrega (Front Door, Application Gateway, um load balancer) e acessar PaaS por private endpoints. Um IP público direto numa VM raramente é necessário. Quando criar IPs públicos, use o SKU Standard: os IPs públicos Basic e o Basic Load Balancer foram aposentados em setembro de 2025.

### Azure Bastion

O Bastion dá RDP e SSH às VMs pelo navegador ou pelo cliente nativo, sobre TLS, sem nenhum IP público nas VMs e sem portas de administração abertas para a internet. Ele fica na `AzureBastionSubnet` do hub e alcança VMs em spokes com peering.

---

## 3. Conectividade privada e híbrida

### VPN site-to-site

Um túnel IPsec pela internet entre o seu data center (ou escritório) e um gateway de VPN no Azure. É o jeito mais rápido de começar. Para gateways novos, use os SKUs com redundância de zona (VpnGw1AZ a VpnGw5AZ), que vão de 650 Mbps a 10 Gbps de throughput agregado; os SKUs sem zona estão sendo migrados, e o Basic não é para produção. Um túnel sozinho fica bem abaixo do agregado (a Microsoft mediu cerca de 1,25 a 2,3 Gbps por túnel com GCMAES256 nos SKUs maiores), então throughput alto exige vários túneis. Use gateways ativo-ativo e BGP para ter failover sem intervenção manual.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Como eu sei que é hora de sair da VPN e ir pra algo mais profissional?</span>
    </div>
  </div>
</div>

Throughput sozinho raramente é o motivo: um VpnGw5AZ move 10 Gbps. Você vai para o ExpressRoute quando precisa do que a internet não pode prometer: latência e jitter consistentes para workloads sensíveis, banda previsível sob carga, uma conexão que não dependa do seu link de internet, ou uma exigência de compliance por conectividade privada. Muitas empresas mantêm a VPN como caminho reserva do ExpressRoute.

### ExpressRoute

Uma conexão privada entre a sua rede e a da Microsoft, provisionada por um provedor de conectividade, com banda de 50 Mbps a 10 Gbps por circuito (o ExpressRoute Direct oferece portas de 10, 100 ou 400 Gbps). O roteamento é BGP, e cada circuito tem duas conexões com dois roteadores de borda da Microsoft; para resiliência máxima, a Microsoft recomenda dois circuitos em dois locais de peering diferentes. Existem dois peerings: o **privado** (as suas VNets) e o **Microsoft** (serviços públicos da Microsoft, recomendado para o Microsoft 365 só em cenários específicos).

Duas coisas surpreendem. O ExpressRoute é privado, mas **não é criptografado** por padrão: use MACsec no ExpressRoute Direct ou IPsec sobre o peering privado quando precisar de criptografia em trânsito. E um circuito padrão alcança as regiões da sua área geopolítica; o **Premium** estende o alcance para o mundo todo, o **Global Reach** liga os seus sites on-premises pela rede da Microsoft e o **FastPath** manda o tráfego direto para as VMs, tirando o gateway do caminho dos dados.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>E posso ligar o ExpressRoute direto num serviço tipo Storage sem passar por VNet?</span>
    </div>
  </div>
</div>

Para PaaS, o padrão é um private endpoint dentro de uma VNet: o ExpressRoute dá o caminho privado até a VNet, e o private endpoint completa a jornada até o serviço. O peering Microsoft existe, mas chega aos endpoints públicos dos serviços, que é justamente o que os private endpoints permitem evitar.

### Peering de VNets

O peering conecta duas VNets, na mesma região ou entre regiões (peering global), pela rede da Microsoft, sem gateway e com baixa latência. A regra de que todo o resto depende: **peering não é transitivo**. Se o spoke de aplicação tem peering com o hub e o spoke de dados também, aplicação e dados não conversam entre si pelo hub sozinhos. O tráfego entre spokes precisa de UDRs apontando para um firewall ou roteador no hub, com o tráfego encaminhado permitido nos peerings. Chegar ao on-premises pelo gateway do hub também exige configurações próprias: **gateway transit** no lado do hub e **use remote gateways** no lado do spoke.

<div id="azure-network-hub-spoke-slot"></div>

As linhas da figura são peerings com o hub, não trânsito automático: todo caminho entre spokes, e entre um spoke e o on-premises, é algo que você configura. A seção 8 volta a essa topologia como um todo.

### Virtual WAN

O Virtual WAN é um hub gerenciado pela Microsoft: VPN, ExpressRoute, SD-WAN, VPN de usuários e roteamento entre hubs como um serviço só, com o roteamento entre spokes (e entre hubs) embutido. Ele troca controle por menos trabalho: brilha com muitas filiais ou muitas regiões, enquanto um hub e spoke gerenciado por você dá controle total de cada rota.

### Private Link, private endpoints e service endpoints

Um **private endpoint** é uma NIC com IP privado na sua sub-rede que aponta para um recurso de PaaS específico (uma conta de armazenamento, um servidor SQL, um Key Vault). O tráfego para ele fica em endereços privados, funciona a partir de VNets com peering e do on-premises via VPN ou ExpressRoute, e não pode ser usado para chegar a recursos de outros clientes. Um **service endpoint** é mais simples e mais antigo: a sub-rede chega ao endpoint público do serviço pela rede da Microsoft, e o serviço pode liberar aquela sub-rede; ele não funciona a partir do on-premises, e o serviço continua com endereço público.

Criar um private endpoint não fecha a porta pública. Desabilite o acesso de rede público no próprio recurso, senão o private endpoint é só mais uma entrada.

### DNS privado: onde os private endpoints costumam falhar

A sua aplicação continua usando o nome público do serviço (`orders.database.windows.net`), porque os certificados TLS e a autenticação dependem dele. O que muda é a resposta: o nome público é um CNAME para `orders.privatelink.database.windows.net`, e uma **zona DNS privada** de `privatelink.database.windows.net`, vinculada às suas VNets, responde com o IP do private endpoint. A partir do on-premises, os seus servidores DNS encaminham essas zonas para o endpoint de entrada do **Azure DNS Private Resolver** no hub.

<div id="azure-network-private-dns-slot"></div>

Resolução e caminho dos dados são dois problemas separados. Uma resposta DNS correta não cria rota, e uma rota que funciona não autoriza nada no banco. Quando um private endpoint "não funciona", confira nessa ordem: para que o nome resolveu, e a partir de onde; depois, se os pacotes chegam àquele IP; depois, se o serviço aceita a identidade.

---

## 4. Serviços de entrega

| Serviço | Camada | Escopo | O que faz | Uso típico |
|---|---|---|---|---|
| Load Balancer | L4 | Regional | Distribui fluxos TCP/UDP | Serviços não HTTP, AKS, pares de NVAs |
| Application Gateway (WAF) | L7 | Regional | Roteamento HTTP, TLS, WAF | Apps web e APIs numa região |
| Front Door | L7 | Global | Roteamento na borda, cache, WAF, failover | Sites e APIs públicos, multirregião |
| Traffic Manager | DNS | Global | Responde DNS por política | Failover não HTTP, endpoints híbridos |

### Application Gateway

Um proxy reverso regional: roteamento por host e caminho, terminação TLS e TLS ponta a ponta, redirecionamentos, reescrita de cabeçalhos e um Web Application Firewall opcional baseado nos conjuntos de regras da OWASP. Use o SKU v2, com autoscaling e zonas de disponibilidade, e deixe-o escalar com o seu tráfego real em vez de chutar um tamanho fixo.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Posso usar o Application Gateway como CDN também, pra arquivos grandes?</span>
    </div>
  </div>
</div>

Não. O Application Gateway é regional e não faz cache. Para cache e aceleração global, use o Front Door, que agora também é a CDN do Azure: o Azure CDN from Microsoft (clássico) é aposentado em 30 de setembro de 2027, e perfis novos já vão para o Front Door Standard ou Premium.

### Front Door

Um ponto de entrada L7 global na borda da Microsoft: TLS perto do usuário, cache, compressão, políticas de WAF e failover entre origens com base na saúde delas. Ele roteia entre origens com quatro métodos (latência, prioridade, ponderado e afinidade de sessão); regras por geografia vêm do rules engine ou do WAF, não do método de roteamento. Use a camada Standard ou Premium: o Front Door (clássico) é aposentado em 31 de março de 2027. O Premium adiciona conjuntos de regras gerenciados no WAF, proteção contra bots e **origens via Private Link**, que deixam o Front Door chegar a uma origem sem nenhum endpoint público.

Quando a origem é pública, trancá-la é trabalho seu. O Front Door não impede ninguém de chamar a origem diretamente, e um WAF que dá para contornar não é um controle:

<div id="azure-network-ingress-slot"></div>

Libere na origem só a service tag `AzureFrontDoor.Backend`, valide o cabeçalho `X-Azure-FDID` contra o ID do seu próprio perfil (a tag sozinha cobre todos os clientes do Front Door) e negue todo o resto. E mantenha separadas as duas fronteiras da figura: o private endpoint do storage protege o caminho dos dados, não a entrada pública da aplicação.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Se eu usar Front Door, ainda preciso de Application Gateway?</span>
    </div>
  </div>
</div>

Depende do que está atrás. O Front Door sozinho basta para muitas aplicações (App Service, Container Apps, sites estáticos no storage). O Application Gateway atrás do Front Door faz sentido quando você precisa de lógica L7 regional dentro de uma VNet: backends privados no AKS, regras de caminho complexas por região ou uma política de WAF perto do workload. Encadear os dois é comum e tudo bem, desde que você saiba por que cada salto existe.

### Load Balancer

Camada 4, throughput altíssimo, para tudo que não é HTTP ou quando você quer que a própria aplicação termine o TLS: bancos em cluster, serviços do AKS do tipo `LoadBalancer`, pares de appliances de rede (com HA ports). Sempre o SKU Standard, que tem redundância de zona e é seguro por padrão: só aceita tráfego de entrada que um NSG permita.

### Traffic Manager

Um roteador baseado em DNS: responde cada consulta com o endpoint escolhido por política (prioridade, ponderado, desempenho, geográfico, multivalor ou sub-rede). Por ser DNS, funciona para qualquer protocolo e qualquer endpoint, inclusive on-premises, mas o failover depende de os clientes respeitarem o TTL. Para HTTP, o Front Door costuma ser a ferramenta melhor; o Traffic Manager cobre o resto.

---

## 5. Segurança de rede

### Azure Firewall vs NVAs

O **Azure Firewall** é um firewall gerenciado e stateful, com alta disponibilidade e autoscaling embutidos, em três SKUs: Basic (até 250 Mbps, para ambientes pequenos), Standard (até 30 Gbps, com inteligência de ameaças, filtragem por FQDN no nível de rede, categorias web e proxy DNS) e Premium (até 100 Gbps, acrescentando inspeção TLS de saída, IDPS e filtragem completa de URL). As políticas são gerenciadas de forma central pelo Firewall Manager. As **NVAs** (Fortinet, Palo Alto, Check Point e outras) trazem recursos do fabricante e o modelo de operação que o seu time de segurança talvez já conheça, ao custo de você mesmo cuidar de alta disponibilidade, escala e patches.

Decida com uma matriz de requisitos: inspeção TLS, IDPS, as habilidades do time que vai operar, integração com o seu SIEM, custo no seu volume de tráfego.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Se eu pegar o mais caro, resolve tudo sem eu precisar pensar?</span>
    </div>
  </div>
</div>

Um firewall caro com uma regra "allow any" é um roteador caro. A segurança vem das regras e da disciplina de mantê-las pequenas e revisadas. Simplicidade operacional muitas vezes entrega mais segurança real do que uma ferramenta poderosa que ninguém do time entende por completo.

### DDoS Protection

Todo recurso do Azure já recebe, sem custo, a proteção DDoS de infraestrutura da plataforma, e o Front Door absorve ataques volumétricos na borda. Para IPs públicos dentro das suas VNets (load balancers, Application Gateways, firewalls), o **DDoS Network Protection** (por VNet) ou o **DDoS IP Protection** (por IP público) acrescenta mitigação ajustada ao perfil do seu tráfego, telemetria dos ataques e alertas; o Network Protection também inclui acesso ao time de DDoS Rapid Response da Microsoft e proteção de custos. Proteja as entradas públicas dos workloads críticos, e combine com um WAF para ataques de camada 7, que a proteção DDoS não trata.

### Zero Trust na rede

Assuma que houve uma invasão e limite o que ela alcança: segmente por sub-rede e aplicação, negue o tráfego leste-oeste por padrão, inspecione o tráfego entre spokes e para a internet, nunca exponha portas de administração (use o Bastion) e exija identidade forte para administrar (Entra ID, RBAC e Privileged Identity Management). A rede é uma camada do Zero Trust, não o Zero Trust inteiro: uma requisição que passa por todos os controles de rede ainda precisa ser autenticada e autorizada pelo serviço.

### Defender for Cloud

Gestão contínua de postura: ele aponta portas de administração expostas à internet, sub-redes sem NSG, recursos com acesso de rede público que poderiam ser privados, e recomenda acesso just-in-time às VMs. Trate as recomendações como um backlog, não como ruído.

---

## 6. Observabilidade e diagnóstico

### Network Watcher

O Network Watcher é a caixa de ferramentas para provar o que a rede está fazendo, em vez de adivinhar:

- **IP flow verify**: esse pacote seria permitido, e por qual regra de NSG?
- **Next hop** e **rotas efetivas**: para onde esse pacote iria, e qual rota venceu?
- **Regras de segurança efetivas**: a combinação das regras de NSG realmente aplicada a uma NIC.
- **Connection troubleshoot**: um teste de conexão real entre dois pontos, com o salto onde ele falha.
- **Connection monitor**: alcance e latência contínuos entre endpoints, inclusive on-premises.
- **Packet capture**: quando você precisa ver os pacotes em si.
- **Topologia**: um mapa dos recursos e de como eles se conectam.

### Flow logs de VNet

Os flow logs registram os fluxos IP que cruzam a sua rede: 5-tupla, decisão e volume. Use os **flow logs de VNet**. Os flow logs de NSG são aposentados em 30 de setembro de 2027 e já não aceitam configurações novas; os de VNet cobrem a VNet inteira, inclusive o tráfego que nenhum NSG avalia, e alimentam o **traffic analytics** no Log Analytics com os maiores consumidores, os fluxos bloqueados e os destinos inesperados.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Se eu ativar todos os logs, nunca mais vou ter dúvida nenhuma, né?</span>
    </div>
  </div>
</div>

Você vai ter uma conta grande e as mesmas dúvidas. Dado que ninguém consulta é ruído. Comece com flow logs de VNet nas VNets importantes, logs do firewall, métricas dos gateways e alguns alertas que significam algo (túnel caído, esgotamento de portas SNAT, falhas de health probe), e adicione mais só quando uma pergunta real pedir.

### Diagnóstico, camada por camada

A maioria dos incidentes de rede se resolve provando cada camada em ordem, a partir do ambiente onde a falha acontece, e coletando as evidências antes de mudar qualquer coisa:

<div id="azure-network-troubleshooting-slot"></div>

1. **DNS**: para que o nome resolveu, e por qual resolver? Um private endpoint respondido com IP público é o clássico.
2. **Rota**: qual rota venceu, e existe caminho de volta? As rotas efetivas e o next hop respondem isso.
3. **TCP e política**: a porta abre de ponta a ponta? Teste a porta real e leia as regras de NSG efetivas e os logs do firewall.
4. **TLS**: o handshake completa com o hostname certo? Um certificado para o nome errado parece erro de rede para muitos clientes.
5. **HTTP e identidade**: a requisição está certa, e quem chama tem permissão? Um 403 é uma resposta, ou seja, a rede funcionou.

Uma camada que funciona não prova que a seguinte funciona, e uma camada de cima não conserta uma de baixo: lembre do WAF e da rota.

---

## 7. Performance

- **Evite hairpinning.** Tráfego que sai de uma região para ser inspecionado em outra, ou que vai ao on-premises e volta para chegar a um spoke vizinho, paga a latência duas vezes. Mantenha a inspeção e a saída na mesma região dos workloads, um hub por região.
- **A rede acelerada** tira o switch virtual do host do caminho dos dados e reduz latência e jitter; habilite em todo tamanho de VM que suporte.
- **Mantenha as camadas falantes perto.** Zonas de disponibilidade adicionam um pouco de latência entre camadas; proximity placement groups mantêm VMs críticas em latência fisicamente próximas quando isso importa mais do que a resiliência de zona.
- **O FastPath do ExpressRoute** tira o gateway do caminho dos dados para tráfego híbrido de alto volume.
- **Faça cache na borda.** O cache do Front Door elimina idas à origem para conteúdo estático e pode acelerar o dinâmico também.
- **Sumarize as rotas BGP.** Anuncie o menor número de prefixos, e os maiores possíveis, nas duas direções: existem limites de rotas, e tabelas enormes deixam a convergência lenta.

---

## 8. Padrões de arquitetura

### Hub e spoke

O hub guarda o que todos compartilham: o gateway de VPN ou ExpressRoute, o Azure Firewall, o DNS Private Resolver e o Bastion. Cada workload ganha o seu spoke, com peering só com o hub. Isso dá um lugar único para inspecionar e controlar o tráfego, isolamento entre workloads e uma linha clara de responsabilidade entre o time de plataforma (o hub) e os times de aplicação (os spokes).

Como mostra o diagrama da seção de peering, o hub é adjacência, não trânsito automático. Como peering não é transitivo, o tráfego entre spokes só funciona quando os dois spokes roteiam para o firewall (UDRs nos dois sentidos), os peerings permitem tráfego encaminhado e o firewall tem uma regra para ele. O tráfego híbrido precisa de gateway transit no hub e de remote gateways nos spokes, e o DNS precisa das zonas privadas vinculadas onde a resolução acontece.

### Virtual WAN como hub

Quando você tem muitas filiais, muitas regiões ou SD-WAN, um hub do Virtual WAN substitui a VNet do hub e cuida por você do roteamento entre spokes, filiais e outros hubs. Os secured hubs adicionam o Azure Firewall com routing intent. Você escreve menos UDRs e abre mão de parte do controle fino.

### Malha seletiva

Peering direto entre alguns spokes que trocam muito tráfego sensível a latência, passando por fora do hub de propósito. O Azure Virtual Network Manager consegue gerenciar esses grupos de conectividade de forma declarativa. Mantenha como exceção: cada ligação direta é um caminho que o firewall não vê.

### Landing zones

As Azure landing zones do Cloud Adoption Framework empacotam tudo isso numa fundação padrão: management groups, políticas, identidade, uma assinatura de conectividade com o hub (ou o Virtual WAN) e landing zones de aplicação para os spokes. Se você está começando um ambiente corporativo, parta da implementação de referência em vez de uma assinatura em branco.

### Multicloud

Conecte o Azure a outras nuvens com uma VPN site-to-site entre os gateways delas, ou de forma privada por um provedor de conectividade ou um ponto de troca em colocation que alcance as duas nuvens. As regras de endereçamento não mudam: um plano de endereços único para a empresa, sem sobreposições, e rotas sumarizadas nas duas direções.

---

## 9. Operação e governança

- **Gestão de endereços IP.** Uma fonte única da verdade para o plano de endereços (uma ferramenta de IPAM, ou um arquivo versionado checado no CI como o script da seção 1), com cada alocação tendo um dono.
- **Infraestrutura como código.** VNets, sub-redes, NSGs, rotas e zonas DNS em Bicep ou Terraform, revisados em pull requests. Redes mudadas pelo portal se desviam do planejado rapidinho.
- **Azure Policy.** Negue o que nunca deveria existir: IPs públicos em NICs, sub-redes sem NSG, contas de armazenamento com acesso de rede público, recursos fora das regiões aprovadas.
- **Revisão de regras.** A cada trimestre, procure regras que liberam demais, regras que ninguém sabe explicar e regras sem nenhum acerto nos flow logs.
- **Custo.** Os dados processados pelo firewall, pelo NAT Gateway e pelos private endpoints, a transferência entre regiões e pelo peering global e a ingestão de logs somam. Olhe para eles antes que surpreendam na fatura.

---

## 10. Checklist final

| Item | Ok? | Nota |
|---|---|---|
| Plano de endereços da empresa, sem sobreposição | ☐ | Inclui on-premises e outras nuvens |
| Sub-redes para os picos, 5 endereços reservados contados | ☐ | Espaço para sub-redes dedicadas e delegadas |
| Hub e spoke (ou Virtual WAN) implantado | ☐ | Trânsito entre spokes explícito |
| NSGs em toda sub-rede, menor privilégio | ☐ | Service tags e ASGs em vez de listas de IP |
| Saída explícita (NAT Gateway ou firewall) | ☐ | Sub-redes privadas, sem acesso de saída padrão |
| Private endpoints para PaaS sensível | ☐ | Acesso de rede público desabilitado no recurso |
| Zonas DNS privadas e Private Resolver | ☐ | Resolução testada a partir do on-premises também |
| Entrada pública pelo Front Door ou Application Gateway | ☐ | Origens trancadas, WAF habilitado |
| Proteção DDoS avaliada para IPs públicos | ☐ | Workloads críticos |
| Flow logs de VNet e traffic analytics | ☐ | Flow logs de NSG migrados |
| Network Watcher e alertas principais | ☐ | Túneis, SNAT, health probes |
| Tudo em IaC, protegido por Azure Policy | ☐ | Bicep ou Terraform versionado |
| Revisão trimestral | ☐ | Regras, rotas, custos |

---

## Conclusão

Rede no Azure não é criar uma VNet e seguir em frente. É compor camadas: um plano de endereços que sobrevive ao crescimento, isolamento por sub-rede e spoke, caminhos explícitos para cada fluxo (entrada, saída e entre spokes), acesso privado aos dados com um DNS que resolva, observabilidade capaz de provar o que aconteceu e governança que impede tudo isso de se desviar.

Comece pequeno, registre as decisões, automatize cedo e revise com frequência. É assim que uma fundação de rede continua sem graça, que é o melhor elogio que uma rede pode receber.

<div class="callout tip" data-title="Próximo passo">
  <p>Monte um lab: uma VNet de hub com Azure Firewall, DNS Private Resolver e Bastion; dois spokes (aplicação e dados) com peering com o hub; uma conta de armazenamento com acesso público desabilitado e um private endpoint no spoke de dados; UDRs para o tráfego entre aplicação e dados passar pelo firewall; e flow logs de VNet com traffic analytics. Depois quebre de propósito (remova o vínculo de uma zona DNS, apague uma rota de volta) e ache o problema com o método camada por camada.</p>
</div>
