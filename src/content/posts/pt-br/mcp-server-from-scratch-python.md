---
title: "Model Context Protocol do zero: crie seu primeiro servidor MCP em Python"
description: "Construa um servidor MCP em Python para expor ferramentas e dados a clientes de IA."
date: 2025-11-18
tags: [MCP, AI Agents, Python, LLM]
tldr:
  - "O MCP separa tools e dados do host do modelo: escreva um server e qualquer client compatível com MCP consegue usá-lo."
  - "Um server expõe tools (ações do modelo), resources (contexto da aplicação) e prompts (templates do usuário) via JSON-RPC, por stdio ou Streamable HTTP."
  - "Mantenha as tools estreitas e bem descritas, devolva erros legíveis, limite o tamanho da saída e nunca faça log no stdout com o transporte stdio."
---

Todo time que constrói com LLMs acaba escrevendo o mesmo código de cola: uma função que busca na wiki, outra que lê tickets, outra que consulta o banco, cada uma embrulhada no formato de tool calling específico do modelo ou framework que estava na moda naquele mês. Aí alguém quer a mesma capacidade dentro da IDE, ou em outro framework de agentes, e a cola é escrita de novo.

O Model Context Protocol (MCP) existe para acabar com essa repetição. Neste post vamos entender o que ele realmente é (spoiler: é bem menos mágico do que o hype sugere), depois construir um server MCP pequeno, mas real, em Python, testar, plugar num client e ver o que quebra quando você leva isso para produção. O Júnior Inocente vai aparecer pelo caminho com as dúvidas que muita gente tem e pouca gente pergunta.

## O problema e o contexto

Imagine uma empresa com três hosts de IA: um assistente de chat, um assistente de código dentro da IDE e um agente caseiro que faz triagem de alertas. Agora imagine cinco sistemas internos que esses hosts deveriam acessar: o tracker de incidentes, a documentação interna, o CRM, o data warehouse e o pipeline de deploy.

Sem um protocolo comum, cada host precisa da sua própria integração com cada sistema. É o clássico **problema N por M**: 3 hosts vezes 5 sistemas dá 15 integrações, cada uma com seu tratamento de autenticação, formato de schema, convenção de erro e bugs. Adicionou um host, deve mais cinco integrações. Adicionou um sistema, deve mais três.

<div id="mcp-integrations-slot"></div>

O MCP transforma isso num **problema N mais M**. Cada sistema é embrulhado uma vez, como um server MCP. Cada host implementa o lado client do MCP uma vez. A partir daí, qualquer host conversa com qualquer server. Se você lembra da vida antes do USB, a analogia se escreve sozinha: em vez de um cabo diferente para cada impressora, teclado e câmera, você tem uma porta e um plugue.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Mas os modelos já têm function calling. MCP não é só function calling com nome mais bonito?</span>
    </div>
  </div>
</div>

Não exatamente. Function calling é a capacidade do modelo de dizer "quero chamar `search_docs` com estes argumentos". Isso não diz nada sobre onde `search_docs` mora, como o host descobre que ela existe, como ela é executada ou como o resultado volta. O MCP fica um nível abaixo: é o contrato entre a aplicação que roda o modelo e o processo que é dono da tool. O host continua usando o function calling nativo do modelo; o MCP é como o host descobriu que a tool existe e como ele a executa. São complementares, não concorrentes.

O outro ponto importante é ownership. Com MCP, o time dono do tracker de incidentes pode publicar e manter o server MCP de incidentes. O time de IA não precisa entender as entranhas do tracker, e o time do tracker não precisa se importar com qual modelo está do outro lado. Essa separação é o ganho de verdade, mais do que qualquer linha de código economizada.

## Mergulho na arquitetura

### Host, client e server

O MCP tem três papéis, e confundi-los é a fonte mais comum de confusão:

| Papel | O que é | Exemplo |
|-------|---------|---------|
| Host | A aplicação com a qual o usuário interage; é dona do modelo e da conversa | Claude Desktop, uma IDE, seu agente customizado |
| Client | Um conector dentro do host que mantém uma sessão 1:1 com um server | Um client por server configurado |
| Server | Um programa que expõe tools, resources e prompts | Seu server de notas de incidentes |

Um host com três servers configurados roda três clients, um por server. O host decide o que mostrar ao modelo, o que pedir para o usuário aprovar e como combinar resultados. O server nunca fala diretamente com o modelo. Ele só responde requisições.

### JSON-RPC 2.0 no fio

Por baixo dos panos, toda mensagem MCP é JSON-RPC 2.0 puro: requests com um `id`, responses que ecoam esse `id` e notifications sem id. Uma sessão começa com um handshake `initialize`, no qual client e server trocam a versão do protocolo e suas capabilities (esse server oferece tools? resources? prompts?). Depois disso, o client pode chamar métodos como `tools/list`, `tools/call`, `resources/read` e `prompts/get`.

Uma chamada de tool fica assim:

```json title="tools-call.json"
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "search_incidents",
    "arguments": { "query": "timeout", "limit": 3 }
  }
}
```

E a resposta:

```json title="tools-call-response.json"
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [{ "type": "text", "text": "INC-101 | payments-api | Upstream timeout on card processor" }],
    "isError": false
  }
}
```

É só isso. Nada de formato binário proprietário, nada de mágica. Se você lê JSON, você consegue debugar MCP.

### Transportes: stdio e Streamable HTTP

As mesmas mensagens JSON-RPC podem viajar por transportes diferentes:

- **stdio**: o host inicia o server como processo filho e troca mensagens via stdin e stdout. É o padrão para servers locais: sem portas, sem rede, e o server herda as permissões do usuário na máquina.
- **Streamable HTTP**: o server roda como um serviço HTTP independente, os clients enviam mensagens via HTTP POST e o server pode fazer streaming das respostas. É a opção para servers remotos e compartilhados (por exemplo, um que está publicado na sua cloud e é usado pela empresa inteira). Ele substituiu o antigo transporte HTTP+SSE, que hoje é considerado legado.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Então eu devo usar sempre HTTP, né? É a opção "de verdade" para produção.</span>
    </div>
  </div>
</div>

Depende de quem usa. stdio é perfeito quando o server roda na mesma máquina do host e age em nome daquele único usuário, como um server que lê arquivos locais ou chama uma API com o token do próprio usuário. Streamable HTTP faz sentido quando o server é compartilhado, publicado de forma centralizada e precisa de autenticação de verdade, rate limiting e observabilidade. Comece com stdio enquanto desenvolve; a parte boa é que, com o SDK de Python, trocar de transporte é basicamente um argumento.

### Os três primitivos

É aqui que o MCP fica mais interessante do que "chamada de função remota". Um server pode expor três tipos de coisa, e a diferença principal é **quem controla cada uma**:

| Primitivo | Controlado por | O que é | Exemplo |
|-----------|----------------|---------|---------|
| Tools | O modelo | Ações que o modelo decide invocar, possivelmente com efeitos colaterais | `search_incidents`, `add_note` |
| Resources | A aplicação | Contexto somente leitura endereçado por URI, que o host escolhe anexar | `incidents://INC-101` |
| Prompts | O usuário | Templates reutilizáveis que o usuário escolhe explicitamente, muitas vezes via slash command ou menu | "Rascunhe um postmortem do incidente X" |

Tools são a parte de que todo mundo fala: o modelo lê nomes, descrições e schemas de entrada e decide quando chamá-las. Resources são dados que o host (ou o usuário, através do host) puxa para o contexto, como anexar um arquivo. Prompts são fluxos prontos que empacotam boas instruções para o usuário não ter que escrevê-las toda vez.

Manter isso separado importa para segurança e UX. Uma tool que apaga algo deve ser uma tool, para o host poder pedir confirmação ao usuário. Um documento de referência deve ser um resource, para o modelo não gastar uma chamada de tool só para ler um contexto estático.

## Implementação na prática

Vamos construir um server de **notas de incidentes**: um serviço pequeno que permite a um assistente buscar incidentes passados, ler seus detalhes e adicionar notas. Os dados ficam em memória para manter o exemplo focado, mas trocar isso por um banco ou uma API real é exatamente onde entra o seu código.

### Setup

O SDK oficial de Python é o pacote `mcp`. O extra `cli` traz a linha de comando `mcp`, incluindo o launcher do Inspector.

```bash title="terminal"
python -m venv .venv
source .venv/bin/activate   # on Windows: .venv\Scripts\activate
pip install "mcp[cli]<2"
```

<div class="callout warning" data-title="Atenção">
  <p>Este post usa o SDK 1.x, por isso o <code>&lt;2</code> na instalação. A versão 2 renomeou a classe de alto nível: troque <code>from mcp.server.fastmcp import FastMCP</code> por <code>from mcp.server.mcpserver import MCPServer</code> e <code>FastMCP("incident-notes")</code> por <code>MCPServer("incident-notes")</code>. O resto do exemplo roda igual nas duas (testado com 1.30 e 2.2). Confira sua versão com <code>pip show mcp</code>.</p>
</div>

### O server

```python title="server.py"
import logging
import sys
from datetime import datetime, timezone

from mcp.server.fastmcp import FastMCP

# Log no stderr: o stdout é reservado para as mensagens JSON-RPC no transporte stdio
logging.basicConfig(stream=sys.stderr, level=logging.INFO)
logger = logging.getLogger("incident-notes")

mcp = FastMCP("incident-notes")

# Dados em memória para manter o exemplo autocontido
INCIDENTS: dict[str, dict] = {
    "INC-101": {
        "service": "payments-api",
        "severity": "SEV2",
        "title": "Upstream timeout on card processor",
        "summary": "Card authorizations timed out for 18 minutes after the processor rotated its TLS certificate.",
        "notes": [],
    },
    "INC-102": {
        "service": "search",
        "severity": "SEV3",
        "title": "Index lag after bulk import",
        "summary": "A bulk catalog import saturated the indexing queue and results were stale for about an hour.",
        "notes": [],
    },
}

MAX_RESULTS = 10


def _format_incident(incident_id: str, incident: dict) -> str:
    notes = "\n".join(f"- {n}" for n in incident["notes"]) or "(no notes yet)"
    return (
        f"{incident_id} [{incident['severity']}] {incident['service']}\n"
        f"Title: {incident['title']}\n"
        f"Summary: {incident['summary']}\n"
        f"Notes:\n{notes}"
    )


@mcp.tool()
def search_incidents(query: str, limit: int = 5) -> str:
    """Search past incidents by keyword in the title, summary or service name.

    Use this to find incidents similar to a current problem.
    Returns one line per match: id, service and title.
    """
    limit = max(1, min(limit, MAX_RESULTS))
    q = query.lower()
    matches = [
        f"{iid} | {inc['service']} | {inc['title']}"
        for iid, inc in INCIDENTS.items()
        if q in inc["title"].lower() or q in inc["summary"].lower() or q in inc["service"].lower()
    ]
    if not matches:
        return f"No incidents matched '{query}'. Try a broader keyword or a service name."
    return "\n".join(matches[:limit])


@mcp.tool()
def get_incident(incident_id: str) -> str:
    """Get the full details and notes of one incident, by id (for example 'INC-101')."""
    incident = INCIDENTS.get(incident_id.upper())
    if incident is None:
        raise ValueError(f"Incident '{incident_id}' not found. Use search_incidents to find valid ids.")
    return _format_incident(incident_id.upper(), incident)


@mcp.tool()
def add_note(incident_id: str, note: str) -> str:
    """Append a short, timestamped note to an existing incident."""
    incident = INCIDENTS.get(incident_id.upper())
    if incident is None:
        raise ValueError(f"Incident '{incident_id}' not found. Use search_incidents to find valid ids.")
    if not note.strip():
        raise ValueError("Note is empty. Provide the text to append.")
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    incident["notes"].append(f"{stamp}: {note.strip()[:500]}")
    logger.info("Note added to %s", incident_id)
    return f"Note added to {incident_id.upper()}."


@mcp.resource("incidents://{incident_id}")
def incident_resource(incident_id: str) -> str:
    """Read-only view of an incident, for hosts that attach it as context."""
    incident = INCIDENTS.get(incident_id.upper())
    if incident is None:
        return f"Incident '{incident_id}' not found."
    return _format_incident(incident_id.upper(), incident)


@mcp.prompt()
def postmortem_draft(incident_id: str) -> str:
    """Template that asks the model to draft a blameless postmortem."""
    return (
        f"Use the get_incident tool to read {incident_id}. Then draft a blameless postmortem "
        "with these sections: Summary, Impact, Timeline, Root Cause, What Went Well, "
        "Action Items. Do not invent facts that are not in the incident data."
    )


if __name__ == "__main__":
    mcp.run()  # stdio por padrão
```

Algumas coisas estão fazendo muito trabalho aqui. O `FastMCP` lê os **type hints** e as **docstrings** de cada função decorada e os transforma no JSON Schema e na descrição da tool. `query: str, limit: int = 5` vira um schema com uma string obrigatória e um inteiro opcional. A docstring vira o texto que o modelo lê para decidir se chama ou não a tool. Em outras palavras, sua docstring agora é um prompt. Escreva como tal.

O resource usa um template de URI, `incidents://{incident_id}`, e o SDK mapeia o segmento `{incident_id}` para o argumento da função. O prompt retorna uma string que vira uma mensagem de usuário no host.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Por que lançar ValueError? Não seria mais seguro colocar tudo num try/except e não retornar nada?</span>
    </div>
  </div>
</div>

Não retornar nada é a pior opção, porque o modelo não faz ideia do que deu errado e muitas vezes vai tentar de novo às cegas ou alucinar uma resposta. Quando uma função de tool lança uma exceção, o FastMCP captura e devolve um resultado de tool marcado com `isError: true` contendo a mensagem, em vez de derrubar o server. Então o que importa é a mensagem: "Incident 'INC-999' not found. Use search_incidents to find valid ids." diz ao modelo exatamente como se recuperar. Um stack trace cru, por outro lado, desperdiça contexto e pode vazar detalhes internos. Lance exceções com mensagens claras e acionáveis para problemas esperados, e capture os inesperados na fronteira de integração (banco, client HTTP) para traduzi-los em algo sensato.

### Teste com o MCP Inspector

Antes de conectar qualquer host de IA, cutuque o server na mão. A CLI do SDK inicia o MCP Inspector, uma UI web que age como client:

```bash title="terminal"
mcp dev server.py
```

O Inspector precisa do Node.js disponível, já que roda via `npx`. Quando ele abrir no navegador, conecte, vá na aba Tools, chame `search_incidents` com `timeout`, teste `get_incident` com um id inexistente para ver o caminho de erro e confira se o template de resource e o prompt aparecem. Se algo parecer errado aqui, vai parecer errado para o modelo também, só que com mais confusão.

### Plugue num client

No Claude Desktop, adicione uma entrada em `mcpServers` no `claude_desktop_config.json` (acessível pelas configurações de desenvolvedor do app). Use caminhos absolutos e aponte o `command` para o Python dentro do seu ambiente virtual, para o pacote `mcp` ser encontrado:

```json title="claude_desktop_config.json"
{
  "mcpServers": {
    "incident-notes": {
      "command": "/absolute/path/to/project/.venv/bin/python",
      "args": ["/absolute/path/to/project/server.py"]
    }
  }
}
```

No Windows, o interpretador fica em `.venv\Scripts\python.exe`, e barras invertidas no JSON precisam ser escapadas (`C:\\projects\\...`). Reinicie o app e as tools aparecem. Outros hosts compatíveis com MCP, incluindo várias IDEs, usam um formato bem parecido de `command` mais `args`.

### Um client mínimo seu

O mesmo server funciona com o seu próprio agente. Aqui vai um client mínimo usando o `ClientSession` do SDK sobre stdio. Ele inicia o server, lista as tools e chama uma delas:

```python title="client.py"
import asyncio

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

server_params = StdioServerParameters(command="python", args=["server.py"])


async def main() -> None:
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = await session.list_tools()
            for tool in tools.tools:
                print(f"{tool.name}: {tool.description}")

            result = await session.call_tool("search_incidents", arguments={"query": "timeout"})
            for item in result.content:
                if item.type == "text":
                    print(item.text)


if __name__ == "__main__":
    asyncio.run(main())
```

Num agente real, você converteria cada item de `tools.tools` (nome, descrição e `inputSchema`) para o formato de tool do seu provedor de modelo, enviaria junto com a conversa e, quando o modelo pedisse uma tool, rotearia esse pedido para `session.call_tool`. Esse loop é todo o truque por trás do "suporte a MCP" em qualquer host.

<div class="callout tip" data-title="Dica">
  <p>Ir para remoto depois é uma mudança pequena no lado do server: <code>mcp.run(transport="streamable-http")</code> serve as mesmas tools via HTTP. A parte difícil não é o transporte, é a autenticação, a autorização e a operação em volta dele.</p>
</div>

## Checagem de realidade em produção

A demo funciona. Veja o que morde quando usuários reais e modelos reais batem nela.

### Design de tool é engenharia de prompt

O modelo escolhe tools com base em nomes, descrições e schemas, nada mais. Uma tool chamada `query` com a descrição "Queries data" vai ser chamada na hora errada, com os argumentos errados, ou nunca. Algumas regras práticas:

- **Nomeie tools como verbos com um objeto claro**: `search_incidents`, `get_incident`, `add_note`. Se dois servers estiverem carregados ao mesmo tempo, nomes genéricos como `search` colidem na cabeça do modelo, mesmo quando o host adiciona namespace.
- **Diga quando usar e o que volta**: "Use this to find incidents similar to a current problem. Returns one line per match." Essa frase evita muita chamada inútil.
- **Mantenha schemas pequenos e tipados**: poucos parâmetros, defaults sensatos, enums ou literais quando o conjunto de valores é fechado. Cada parâmetro opcional é uma decisão que o modelo pode errar.
- **Prefira poucas tools focadas a um canivete suíço**: uma tool `execute(action: str, payload: dict)` empurra todo o trabalho de design para o modelo.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>E se eu expuser os 80 endpoints da nossa API como tools? Mais tools, agente mais esperto, né?</span>
    </div>
  </div>
</div>

Normalmente é o contrário. Toda definição de tool entra no contexto do modelo a cada turno, então 80 tools significam um bom pedaço de tokens gasto antes de o usuário dizer qualquer coisa, e mais opções quase duplicadas para o modelo confundir. Desenhe em torno das tarefas que os usuários realmente fazem, não em torno da superfície da sua API. Cinco tools bem descritas que cobrem os fluxos reais ganham de oitenta wrappers rasos.

### Modos de falha que vale conhecer

**Saídas enormes estourando o contexto.** Uma tool que devolve um arquivo de log inteiro ou uma query com 5.000 linhas pode empurrar a conversa útil para fora da janela de contexto, aumentar custo e piorar as respostas. Limite resultados (como o `MAX_RESULTS` acima), trunque campos longos, pagine e devolva resumos com ids que o modelo pode detalhar com uma segunda tool.

**Log no stdout quebra o stdio.** No transporte stdio, o stdout *é* o canal do protocolo. Um `print("debug")` perdido injeta bytes que não são JSON no stream e o client falha ao parsear as mensagens, muitas vezes com erros confusos. Mande logs para o stderr (como o `server.py` faz) ou para um arquivo.

**I/O bloqueante.** Uma chamada síncrona lenta (uma query pesada, um request HTTP sem timeout) pode travar o server enquanto o host espera. Defina tools com `async def` e use clients assíncronos (por exemplo `httpx.AsyncClient`), ou mande o trabalho bloqueante para uma thread com `asyncio.to_thread`. Sempre configure timeouts nas chamadas de saída; uma tool que trava para sempre é pior do que uma que falha rápido com uma mensagem clara.

**Segredos na saída da tool.** Tudo que uma tool retorna vai para o contexto do modelo, pode ser mostrado ao usuário e pode acabar em logs. Nunca devolva connection strings, tokens ou registros brutos completos com dados pessoais. Filtre os campos explicitamente na saída em vez de despejar objetos inteiros.

**Descrições vagas.** Já falamos disso, mas é a causa mais comum de "o agente não usa minha tool". Quando o comportamento estiver estranho, leia suas descrições como se você fosse o modelo, com zero contexto.

### Segurança e confiança

Um server MCP é código que roda com permissões reais, disparado por um modelo que pode ser influenciado por qualquer texto que caia no contexto dele. Isso inclui conteúdo devolvido por outras tools, o que abre a porta para prompt injection. Trate de acordo:

<div class="callout warning" data-title="Atenção">
  <ul>
    <li><strong>Menor privilégio</strong>: dê ao server credenciais restritas ao que as tools realmente precisam. Um server de busca somente leitura não precisa de acesso de escrita.</li>
    <li><strong>Confirme ações destrutivas</strong>: deixe as tools com efeito colateral explícitas para que os hosts possam pedir aprovação ao usuário antes de executá-las.</li>
    <li><strong>Só instale servers em que você confia</strong>: um server stdio local roda com as permissões do seu usuário. Revise servers de terceiros como qualquer outra dependência.</li>
    <li><strong>Autentique servers remotos</strong>: um server Streamable HTTP exposto sem autenticação é uma API pública para os seus sistemas internos.</li>
  </ul>
</div>

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Se o host pergunta ao usuário antes de cada chamada de tool, então o server não precisa validar nada, certo?</span>
    </div>
  </div>
</div>

Não. A confirmação no host é uma proteção de UX, não uma fronteira de segurança: usuários clicam em "Permitir" no piloto automático, alguns hosts deixam aprovar automaticamente e seu server pode ser usado por clients que você não controla. Valide entradas, cheque autorização e aplique limites dentro do server, exatamente como faria em qualquer API. O server é o único lugar que é totalmente seu.

### Para onde ir daqui

O server de notas de incidentes é pequeno de propósito, mas o formato escala: troque o dicionário pela sua fonte de dados real, mantenha as saídas enxutas, faça log no stderr e escreva docstrings como se fossem prompts. Quando estiver sólido sobre stdio, levá-lo para Streamable HTTP com autenticação de verdade o transforma numa capacidade compartilhada que todo host compatível com MCP da sua empresa pode usar, sem ninguém reescrever a integração de novo. Esse é o ponto do MCP: escreva uma vez, plugue em todo lugar.
