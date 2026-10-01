---
title: "Quantizando LLMs sem chute: quanto 4 bits custam de verdade"
description: "O que a quantização faz com os pesos, as ativações e o KV cache de um LLM, e como medir o que você perdeu antes de colocar em produção."
date: 2026-08-17
tags: [LLMs, Quantization, Python, Performance]
tldr:
  - "Quantização é arredondamento com uma escala, e quantos valores dividem a mesma escala (tensor, canal ou grupo) decide o estrago tanto quanto o número de bits."
  - "Pesos vão para 8 bits com facilidade e para 4 bits com grupos pequenos ou GPTQ e AWQ; ativações resistem, porque alguns canais carregam valores de 100 a 1.000 vezes maiores que o resto."
  - "Compare todo modelo quantizado com a própria versão sem quantização usando perplexidade, divergência KL, concordância top-1 e as suas próprias avaliações de tarefa, porque a perplexidade sozinha dilui as regressões na média."
---

Um time quer hospedar um modelo de 8B numa única GPU de 24 GB. O checkpoint em BF16 tem 15 GiB, o que carrega, mas sobra espaço para algumas dezenas de milhares de tokens de KV cache divididos entre todas as requisições simultâneas. Alguém baixa um build de 4 bits do hub, ele tem um terço do tamanho, um chat rápido parece ok, e vai para produção. Duas semanas depois o pipeline de extração começa a devolver datas no formato errado algumas vezes por dia, e ninguém liga isso à troca de modelo porque "4 bits é praticamente sem perda, todo mundo diz".

Às vezes é quase sem perda. Às vezes não é, e o único jeito de saber é medir contra o modelo de onde você partiu. Este post cobre o que a quantização realmente faz com os números (formatos, escalas, zero points, granularidade), por que ativações são muito mais difíceis que pesos, o que GPTQ, AWQ, os k-quants do GGUF e o NF4 fazem de diferente, quanto custa o KV cache, e a parte que a maioria dos tutoriais pula: como medir o que você perdeu. A parte prática quantiza uma camada real do SmolLM2-135M em NumPy, faz fake quantization do modelo inteiro em dezesseis configurações e dá nota para cada uma, e termina com uma calculadora de memória. Todos os números abaixo saem dessas execuções.

## O problema e o contexto

Um LLM é basicamente matrizes. O SmolLM2-135M tem 30 blocos transformer com sete camadas lineares cada, e essas 210 matrizes de pesos guardam cerca de 80% dos parâmetros; num modelo de 8B a fatia fica mais perto de 87%. Em BF16, cada parâmetro custa 2 bytes, então os pesos de um modelo de 8B custam uns 15 GiB antes de você processar um único token.

Isso pesa duas vezes. Primeiro, memória: os pesos, o KV cache e algum espaço de trabalho precisam caber na GPU. Segundo, velocidade: gerar um token com batch size 1 lê todos os pesos da memória da GPU uma vez, e no hardware atual é essa leitura, e não a aritmética, que dita o ritmo. A decodificação é limitada pela banda de memória, então um modelo guardado em 4 bits em vez de 16 lê um quarto dos bytes por token, e um bom kernel transforma isso em geração mais rápida.

A quantização é o caminho até lá: guardar números em menos bits e aceitar uma quantidade controlada de erro. O "controlada" é a parte que dá trabalho.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Fácil: converte os pesos para int8. Oito bits são oito bits, igual ao FP8, e o PyTorch faz isso numa linha.</span>
    </div>
  </div>
</div>

Converter um float para um tipo inteiro trunca o valor para um número inteiro. Os pesos de um modelo treinado ficam quase todos entre -0,5 e 0,5, então uma conversão direta transforma praticamente todos em 0 e o modelo em ruído. Quantização inteira precisa de uma **escala** que mapeie a faixa real dos valores na grade de inteiros, e escolher essa escala (como, a partir de quais valores, dividida por quantos deles) é o jogo todo. O FP8 também é outro bicho: é um formato de ponto flutuante, com um expoente que dá a ele uma faixa ampla e precisão relativa, enquanto o INT8 são 256 degraus igualmente espaçados. Mesma quantidade de bytes, comportamento diferente.

## Mergulho na arquitetura

### Formatos numéricos: o que os bits compram

Formatos de ponto flutuante dividem seus bits em sinal, expoente (faixa) e mantissa (precisão):

- **FP32**: 8 bits de expoente, 23 de mantissa. Pesos mestres do treino, raramente guardado para inferência.
- **FP16**: 5 bits de expoente, 10 de mantissa, maior valor 65.504. Preciso, mas a faixa estreita pode estourar nas ativações.
- **BF16**: 8 bits de expoente (a mesma faixa do FP32), 7 de mantissa. A maioria dos checkpoints abertos sai nele, o SmolLM2 inclusive.
- **FP8**: duas variantes definidas em [FP8 Formats for Deep Learning](https://arxiv.org/abs/2209.05433) (Micikevicius et al., 2022). O E4M3 tem 4 bits de expoente e 3 de mantissa, abre mão dos infinitos para chegar a um máximo de 448, e é o usado para pesos e ativações; o E5M2 troca precisão por faixa (máximo de 57.344) e é usado principalmente para gradientes.

Formatos inteiros não têm expoente. O INT8 tem 256 níveis igualmente espaçados, o INT4 tem 16, o INT3 tem 8. A diferença que importa: o tamanho do degrau de um float cresce com a magnitude do número, então valores pequenos mantêm resolução fina ao lado de valores grandes. Uma grade inteira tem um único tamanho de degrau para tudo que cobre, definido pela escala. Por isso o FP8 tolera surpreendentemente bem uma única escala para o tensor inteiro e o INT4 não tolera de jeito nenhum, como as medições abaixo mostram.

### Escala e zero point

A quantização simétrica mapeia `[-max|x|, +max|x|]` na faixa de inteiros com sinal:

```text title="simétrica"
qmax  = 2^(bits-1) - 1              # 127 for INT8, 7 for INT4
scale = max(|x|) / qmax
q     = clamp(round(x / scale), -qmax, qmax)
x'    = q * scale                   # what the model computes with
```

A quantização assimétrica mapeia `[min(x), max(x)]` na faixa sem sinal e guarda um **zero point**, o inteiro que representa o zero real:

```text title="assimétrica"
scale = (max(x) - min(x)) / (2^bits - 1)
zero  = round(-min(x) / scale)
q     = clamp(round(x / scale) + zero, 0, 2^bits - 1)
x'    = (q - zero) * scale
```

A simétrica é mais simples e mais rápida (sem zero point no loop interno) e não desperdiça nada quando os valores estão centrados no zero, que é mais ou menos o caso dos pesos. A assimétrica usa a grade inteira quando os valores estão deslocados, e por isso ajuda em 4 bits ou menos, onde cada um dos 16 níveis conta. O erro por valor é no máximo meio degrau, `scale / 2`, então tudo se resume a manter a escala pequena, e a escala é definida pelo maior valor que ela precisa cobrir.

### Granularidade: quem divide uma escala

As mesmas fórmulas funcionam em qualquer bloco de valores. A escolha do bloco é a decisão mais importante do esquema inteiro:

<div id="quantize-granularity-slot"></div>

**Per-tensor** usa uma escala para a matriz inteira. Não custa nada para guardar e é trivial de implementar, e um único valor grande estica o degrau de todos os outros pesos. **Per-channel** dá a cada linha de saída da matriz de pesos a sua própria escala (16 bits extras por linha, desprezível), então um valor grande só deixa mais grossa a própria linha. **Group-wise** vai além e dá a cada sequência de 32, 64 ou 128 pesos consecutivos dentro de uma linha a sua própria escala. Com uma escala FP16 por grupo de 128, são `16 / 128 = 0.125` bits extras por peso; com grupos de 32, meio bit. Todo formato sério de 4 bits é group-wise por isso: com 16 níveis você não pode deixar um outlier distante definir o tamanho do seu degrau.

Para ativações, os eixos equivalentes são per-tensor (uma escala para o batch inteiro) e **per-token** (uma escala por linha da matriz de ativações, calculada na hora).

### Por que as ativações são a parte difícil

Os pesos ficam fixos depois do treino, têm mais ou menos formato de sino e podem ser quantizados offline com todo o tempo do mundo. As ativações são produzidas de novo para cada entrada, e elas têm outliers.

O [LLM.int8()](https://arxiv.org/abs/2208.07339) (Dettmers et al., 2022) é o paper que deixou isso concreto. Em transformers acima de uns 6,7B parâmetros, um punhado de dimensões ocultas carrega valores muito maiores que o resto, de forma sistemática, na maioria das camadas e para a maioria dos tokens. Ativações INT8 per-tensor então falham: a escala precisa cobrir o outlier, e os valores comuns colapsam em poucos níveis em torno do zero. A correção do paper é uma decomposição de precisão mista: as dimensões de feature em que algum valor atinge o limiar de 6,0 são separadas e multiplicadas em FP16, e o resto passa por INT8 com escalas por linha para as ativações e por coluna para os pesos (quantização vector-wise). Mais de 99,9% dos valores continuam sendo multiplicados em 8 bits, e funciona com 175B parâmetros sem degradação mensurável.

Um segundo tipo de outlier vem por cima disso: as [massive activations](https://arxiv.org/abs/2402.17762) (Sun et al., 2024), alguns valores isolados até 100.000 vezes maiores que o típico, presos em tokens específicos como o primeiro, que funcionam como termos de bias fixos dos quais o modelo depende. Você não consegue cortá-los sem quebrar o modelo, e eles arruínam qualquer escala que dividam.

Você não precisa de um modelo de 7B para ver os dois. No SmolLM2-135M, a entrada do `down_proj` da camada 28 tem magnitude mediana de 0,17, um canal perto de 39 em absolutamente todo token, e um valor de 2.589 na posição 0.

O [SmoothQuant](https://arxiv.org/abs/2211.10438) (Xiao et al., 2022) vai por outro caminho. Uma camada linear calcula `X W^T`, então dividir o canal de entrada `j` das ativações por um fator `s_j` e multiplicar a coluna `j` dos pesos pelo mesmo fator deixa a saída inalterada. Escolha

```text title="fator de suavização"
s_j = max(|X_j|)^alpha / max(|W_j|)^(1 - alpha)
```

e os outliers das ativações encolhem enquanto os pesos absorvem parte da faixa deles. Pesos são fáceis de quantizar, então aguentam. Com `alpha = 0.5` a dificuldade é dividida por igual; o paper usa 0,5 na maioria dos modelos e 0,75 no GLM-130B, cujos outliers são mais severos. Depois disso tudo vira W8A8 simples (pesos de 8 bits, ativações de 8 bits), que roda nos tensor cores INT8 sem a contabilidade de precisão mista. Os fatores são calculados uma vez, offline, a partir de dados de calibração, e incorporados aos pesos da camada anterior.

<div id="quantize-outliers-slot"></div>

Os números desse diagrama vêm do script NumPy mais abaixo, sobre as ativações reais daquela camada.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Se meia dúzia de outliers estraga a escala, corta eles. São 0,1% dos valores, o modelo nem vai sentir falta.</span>
    </div>
  </div>
</div>

Cortar é a primeira coisa que todo mundo tenta, e a mesma camada mostra por que não funciona. Corte toda ativação acima do percentil 99,9, exatamente 0,10% dos valores (tudo acima de 17,85), e a saída da posição 0 fica 98,5% errada enquanto todos os outros tokens ainda carregam 25% de erro: o canal 1095 fica perto de 39 em todo token, então é cortado em todos eles. Corte só os 0,01% maiores (acima de 45,09) e o canal 1095 sobrevive, os outros tokens caem para 1,9% de erro, e a posição 0 continua 97% errada, porque o 2.589 dela é justamente o valor cortado. O artigo das massive activations encontrou o mesmo em escala real: zerar esses poucos valores destrói a perplexidade do modelo, porque a atenção os usa como bias fixos. Os outliers são raros e carregam sinal. O que precisa mudar é quem divide uma escala com eles, e LLM.int8(), SmoothQuant e a quantização só dos pesos são três jeitos de organizar isso. O script do corte está na parte prática.

### Métodos só de pesos: GPTQ, AWQ e os formatos de arquivo

A maioria dos deploys locais e muitos em produção contornam as ativações por completo: quantizam só os pesos (W4A16, pesos de 4 bits com ativações de 16 bits), desquantizam dentro do kernel de matmul e calculam em BF16. A decodificação é limitada pela memória, então é da leitura de pesos de 4 bits que vem a velocidade; as ativações ficam em 16 bits e os outliers delas deixam de importar. O trabalho passa a ser escolher os valores de 4 bits melhor do que o arredondamento simples escolhe.

O **GPTQ** ([Frantar et al., 2022](https://arxiv.org/abs/2210.17323)) quantiza uma camada por vez usando um pequeno conjunto de calibração. Ele percorre as colunas de pesos, quantiza uma, mede o erro que introduziu e ajusta as colunas ainda não quantizadas para compensar, usando informação de segunda ordem aproximada (a inversa da Hessiana do erro de reconstrução da camada, montada a partir das entradas de calibração). O paper quantiza modelos de 175B parâmetros em cerca de quatro horas de GPU para 3 ou 4 bits com perda de acurácia desprezível.

O **AWQ** ([Lin et al., 2023](https://arxiv.org/abs/2306.00978), melhor paper do MLSys 2024) parte da observação de que cerca de 1% dos pesos importa muito mais que o resto, e de que você os encontra olhando para as **ativações**, e não para os pesos: canais de entrada com ativações grandes multiplicam tudo que passa por eles. Em vez de manter esses pesos em precisão maior, o AWQ escala os canais salientes para cima antes da quantização (e as ativações para baixo pelo mesmo fator, de novo a identidade do SmoothQuant), buscando a escala por camada. Sem backpropagation e sem reconstrução, ele sofre menos overfitting no conjunto de calibração.

Os **k-quants do GGUF** são os formatos do llama.cpp, introduzidos no [PR #1684](https://github.com/ggml-org/llama.cpp/pull/1684). São group-wise em dois níveis: super-blocos de 256 pesos divididos em blocos de 16 ou 32, com as próprias escalas dos blocos quantizadas para 6 ou 8 bits. O Q4_K custa 4,5 bits por peso, o Q5_K 5,5, o Q6_K 6,5625, o Q3_K 3,4375. Os nomes com sufixo, como Q4_K_M, são misturas: gastam mais bits (Q6_K) em alguns tensores de atenção e feed-forward e mantêm o tensor de saída num tipo de precisão maior.

O **NF4** vem do [QLoRA](https://arxiv.org/abs/2305.14314) (Dettmers et al., 2023). Seus 16 níveis não são igualmente espaçados: são quantis de uma distribuição normal, o que combina melhor com pesos de distribuição normal do que uma grade uniforme, em blocos de 64 pesos. A double quantization então quantiza as próprias escalas por bloco, cortando o custo delas de 0,5 para 0,127 bit por parâmetro. O NF4 foi feito para permitir o fine-tuning de um modelo de 65B numa única GPU de 48 GB; o bitsandbytes desquantiza para BF16 antes do matmul, então ele economiza mais memória do que tempo.

### O KV cache é um segundo problema do tamanho de um modelo

Cada token no contexto mantém um vetor de chave e um de valor por camada e por head de KV. Os bytes somam assim:

```text title="tamanho do kv cache"
bytes per token = 2 (K and V) x layers x kv_heads x head_dim x bytes per value
```

No Llama 3.1 8B isso dá `2 x 32 x 8 x 128 x 2 = 128 KiB` por token em BF16: 1 GiB para uma conversa de 8K tokens, e um motor de serving segura isso para cada requisição simultânea. Quantizar o cache ataca diretamente o tamanho do contexto e o batch size. O vLLM suporta cache em FP8 (`kv_cache_dtype="fp8"`), com uma única escala por tensor ou por head de atenção quando calibrado. O [KIVI](https://arxiv.org/abs/2402.02750) (Liu et al., 2024) desce até 2 bits ao perceber que as chaves têm canais outliers (então quantize por canal) e os valores não (então quantize por token), e relata 2,6 vezes menos memória de pico.

### Medindo o que você perdeu

A **perplexidade** é a exponencial da média da log-verossimilhança negativa do próximo token correto sobre um texto separado para teste. É barata, não precisa de rótulos e pega um modelo quebrado na hora. Também é uma média sobre dezenas de milhares de tokens, a maioria fácil (pontuação, a segunda metade de uma palavra, a próxima palavra óbvia). Um modelo quantizado pode acertar esses e perder os tokens raros que carregam fatos, e a média quase não se mexe. A perplexidade também não significa nada entre tokenizers diferentes, então compare um modelo apenas com as próprias versões quantizadas.

Duas métricas comparam o modelo quantizado com o original diretamente, token a token. A **divergência KL** entre as duas distribuições de próximo token mede o quanto as crenças do modelo quantizado se afastaram, tenha a resposta principal mudado ou não. A **concordância top-1** (a ferramenta de perplexidade do llama.cpp mostra como "Same top p" ao lado da KL) conta quantas vezes os dois modelos escolheriam o mesmo próximo token. O [Accuracy is Not All You Need](https://arxiv.org/abs/2407.09141) (Dutta et al., 2024) mostrou por que elas importam: modelos comprimidos com praticamente a mesma acurácia de benchmark do baseline ainda **trocam** uma parcela significativa das respostas individuais de certas para erradas (e outras de erradas para certas, o que esconde o estrago no agregado), e a divergência KL e as trocas acompanham a degradação que os usuários de fato percebem em geração livre.

Depois vêm as **avaliações de tarefa**: as tarefas que você realmente roda, pontuadas do jeito que você pontua. Como checagem pública de sanidade eu uso o LAMBADA (prever a última palavra de um trecho, match exato num decode greedy, um teste afiado de contexto de longo alcance) e o HellaSwag (escolher a continuação certa entre quatro). No seu próprio sistema, são os seus prompts e o seu avaliador.

<div id="quantize-eval-loop-slot"></div>

## Implementação na prática

Tudo abaixo roda na CPU de um notebook, num ambiente Python 3.12 com `torch` 2.11, `transformers` 5.17 e `numpy` 2.5. O modelo é o [HuggingFaceTB/SmolLM2-135M](https://huggingface.co/HuggingFaceTB/SmolLM2-135M) (269 MB de pesos em BF16), pequeno o bastante para quantizar e avaliar dezesseis vezes numa tarde, e um modelo real de arquitetura Llama com os mesmos tipos de outliers dos modelos grandes. O texto de teste é o split de teste do WikiText-2, e os conjuntos de tarefa são os primeiros 1.000 exemplos do LAMBADA (a versão da OpenAI) e do split de validação do HellaSwag, baixados como JSON pelo datasets server do Hugging Face.

### Quantizar, depois desquantizar

Todo experimento aqui é **fake quantization**: arredondar os valores para a grade de inteiros e mapeá-los de volta para float na mesma hora. O modelo então calcula em FP32 exatamente com os valores que um kernel INT4 ou INT8 de verdade veria, então a acurácia está certa mesmo que nada fique mais rápido. Uma função cobre todos os esquemas deste post:

```python title="quantize.py"
import numpy as np


def fake_quant(x: np.ndarray, bits: int, symmetric: bool = True, granularity: str | int = "tensor") -> np.ndarray:
    """Quantize to `bits`-bit integers and immediately dequantize back to float.

    granularity: "tensor" (one scale), "row" (one scale per row: per output
    channel for a weight, per token for an activation) or an int group size
    (one scale per run of that many consecutive values inside a row).
    """
    if granularity == "tensor":
        blocks = x.reshape(1, -1)
    elif granularity == "row":
        blocks = x.reshape(x.shape[0], -1)
    else:
        blocks = x.reshape(-1, granularity)

    if symmetric:
        qmax = 2 ** (bits - 1) - 1
        scale = np.abs(blocks).max(axis=1, keepdims=True) / qmax
        scale[scale == 0] = 1.0
        q = np.clip(np.round(blocks / scale), -qmax, qmax)
        dequant = q * scale
    else:
        qmax = 2**bits - 1
        low = blocks.min(axis=1, keepdims=True)
        high = blocks.max(axis=1, keepdims=True)
        scale = (high - low) / qmax
        scale[scale == 0] = 1.0
        zero_point = np.round(-low / scale)
        q = np.clip(np.round(blocks / scale) + zero_point, 0, qmax)
        dequant = (q - zero_point) * scale

    return dequant.reshape(x.shape).astype(x.dtype)


def rel_error(reference: np.ndarray, approx: np.ndarray) -> float:
    return float(np.linalg.norm(reference - approx) / np.linalg.norm(reference))


def bits_per_weight(bits: int, symmetric: bool, granularity: str | int, shape: tuple[int, int]) -> float:
    # One FP16 scale per block, plus a `bits`-wide zero point when asymmetric.
    block = shape[0] * shape[1] if granularity == "tensor" else shape[1] if granularity == "row" else granularity
    return bits + (16 + (0 if symmetric else bits)) / block
```

O modo `"row"` é per-channel para uma matriz de pesos (cada linha é um canal de saída) e per-token para uma matriz de ativações (cada linha é um token). Um tamanho de grupo reorganiza cada linha em sequências de valores consecutivos. Desquantizar para float mantém todo o resto do pipeline inalterado.

### Uma matriz de pesos real

Isto pega o peso do `down_proj` da camada 28 e as ativações que o alimentam (512 tokens do WikiText-2):

```python title="extract_layer.py"
import numpy as np
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL = "HuggingFaceTB/SmolLM2-135M"
LAYER = 28

tokenizer = AutoTokenizer.from_pretrained(MODEL)
model = AutoModelForCausalLM.from_pretrained(MODEL, dtype=torch.float32).eval()
down_proj = model.model.layers[LAYER].mlp.down_proj

text = open("data/wikitext2_test.txt", encoding="utf-8").read()
ids = tokenizer(text[:20000], return_tensors="pt").input_ids[:, :512]

captured = {}
down_proj.register_forward_hook(lambda mod, inp, out: captured.update(x=inp[0][0].numpy()))
with torch.no_grad():
    model(ids)

np.savez("down_proj_l28.npz", w=down_proj.weight.detach().numpy(), x=captured["x"])
print("W", down_proj.weight.shape, "X", captured["x"].shape)
```

```text title="saída"
W torch.Size([576, 1536]) X (512, 1536)
```

Depois quantiza o peso em doze configurações. "Weight err" é o erro relativo de Frobenius da matriz, `||W - W'|| / ||W||`; "output err" é o mesmo para a saída da camada `X W^T`, que é o que a próxima camada de fato recebe. A segunda parte planta um peso com dez vezes o máximo do tensor, como um outlier faria, e verifica o estrago nas *outras* linhas:

```python title="weights_demo.py"
import numpy as np

from quantize import bits_per_weight, fake_quant, rel_error

data = np.load("down_proj_l28.npz")
w = data["w"]
# Position 0 carries a massive activation (see below) and would dominate the output norm.
x = data["x"][1:]
y = x @ w.T

SETTINGS = [
    (8, True, "tensor"),
    (8, True, "row"),
    (4, True, "tensor"),
    (4, False, "tensor"),
    (4, True, "row"),
    (4, False, "row"),
    (4, True, 128),
    (4, False, 128),
    (4, True, 32),
    (4, False, 32),
    (3, False, 128),
    (3, False, 32),
]


def label(bits, symmetric, granularity):
    kind = "sym" if symmetric else "asym"
    where = {"tensor": "per-tensor", "row": "per-channel"}.get(granularity, f"group {granularity}")
    return f"INT{bits} {kind:<4} {where}"


print(f"W {w.shape}, |w| max {np.abs(w).max():.3f}, std {w.std():.4f}")
print(f"{'setting':<26} {'bits/w':>6} {'weight err':>10} {'output err':>10}")
for bits, symmetric, granularity in SETTINGS:
    wq = fake_quant(w, bits, symmetric, granularity)
    bpw = bits_per_weight(bits, symmetric, granularity, w.shape)
    print(f"{label(bits, symmetric, granularity):<26} {bpw:>6.2f} {rel_error(w, wq):>10.2%} {rel_error(y, x @ wq.T):>10.2%}")

print("\nOne weight set to 10x the tensor max, at row 7, column 100")
spiked = w.copy()
spiked[7, 100] = 10 * np.abs(w).max()
others = np.ones(w.shape[0], dtype=bool)
others[7] = False
print(f"{'setting':<26} {'err, other rows':>15} {'err, row 7':>10}")
for bits, symmetric, granularity in [(8, True, "tensor"), (8, True, "row"), (4, True, "row"), (4, True, 32)]:
    wq = fake_quant(spiked, bits, symmetric, granularity)
    print(
        f"{label(bits, symmetric, granularity):<26} "
        f"{rel_error(spiked[others], wq[others]):>15.2%} {rel_error(spiked[7], wq[7]):>10.2%}"
    )
```

```text title="saída"
W (576, 1536), |w| max 5.812, std 0.2001
setting                    bits/w weight err output err
INT8 sym  per-tensor         8.00      6.60%      8.76%
INT8 sym  per-channel        8.01      0.90%      1.20%
INT4 sym  per-tensor         4.00     93.29%     74.03%
INT4 asym per-tensor         4.00     70.83%     60.46%
INT4 sym  per-channel        4.01     15.81%     19.61%
INT4 asym per-channel        4.01     13.79%     18.31%
INT4 sym  group 128          4.12     12.09%     16.21%
INT4 asym group 128          4.16     10.26%     13.45%
INT4 sym  group 32           4.50      9.85%     13.29%
INT4 asym group 32           4.62      8.17%     10.92%
INT3 asym group 128          3.15     21.97%     26.86%
INT3 asym group 32           3.59     17.48%     22.40%

One weight set to 10x the tensor max, at row 7, column 100
setting                    err, other rows err, row 7
INT8 sym  per-tensor                64.62%      8.71%
INT8 sym  per-channel                0.90%      8.71%
INT4 sym  per-channel               15.80%     13.39%
INT4 sym  group 32                   9.85%      2.43%
```

O que isso diz:

- **INT8 per-channel sai quase de graça** (0,90% de erro nos pesos), e per-tensor é sete vezes pior com os mesmos 8 bits. O máximo dos pesos é 5,8 contra um desvio padrão de 0,2, e o per-tensor deixa esse único máximo definir o degrau de todo mundo.
- **INT4 per-tensor é destruído**: 93% de erro. O degrau é `5.8 / 7 = 0.83`, quatro vezes o peso típico, então quase tudo arredonda para zero. A versão assimétrica mal ajuda.
- **Os grupos cumprem o que prometem.** O INT4 vai de 15,8% (per-channel) para 12,1% com grupos de 128 e 9,9% com grupos de 32, por 0,125 e 0,5 bit extra por peso. Grupos assimétricos tiram mais 1,5 a 2 pontos.
- **3 bits mais ou menos dobram o erro de 4 bits**, mesmo com grupos pequenos.
- **O outlier plantado** leva o erro nas linhas intocadas de 0,90% para 64,6% com INT8 per-tensor, e as deixa exatamente onde estavam com per-channel. É o diagrama de granularidade, medido.

O erro de saída é maior que o erro dos pesos porque as ativações não são uniformes: o canal 1095, aquele que está sempre perto de 39, multiplica por 39 cada erro de arredondamento da coluna 1095 dos pesos.

### Outliers de ativação, medidos

Mesma camada, agora quantizando as ativações também:

```python title="activations_demo.py"
import numpy as np

from quantize import fake_quant, rel_error

data = np.load("down_proj_l28.npz")
w, x = data["w"], data["x"]
y = x @ w.T

abs_x = np.abs(x)
channel_max = abs_x.max(axis=0)
print(f"X {x.shape}: median |x| {np.median(abs_x):.3f}, max {abs_x.max():.1f} at position {abs_x.max(axis=1).argmax()}")
for c in np.argsort(-np.median(abs_x, axis=0))[:2]:
    print(f"channel {c}: median |x| over tokens {np.median(abs_x[:, c]):.1f}")

wq8 = fake_quant(w, 8, True, "row")


def report(name, y_approx):
    print(f"{name:<44} all {rel_error(y, y_approx):>7.2%}   pos 1+ {rel_error(y[1:], y_approx[1:]):>7.2%}")


print("\nW8A8, weights INT8 per-channel in every row below")
report("A8 per-tensor", fake_quant(x, 8, True, "tensor") @ wq8.T)
report("A8 per-token", fake_quant(x, 8, True, "row") @ wq8.T)

# LLM.int8(): feature dimensions with any |x| >= 6 stay in FP16, the rest go through INT8.
outliers = channel_max >= 6.0
x_int8 = fake_quant(np.where(outliers, 0, x), 8, True, "row")
w_int8 = fake_quant(np.where(outliers, 0, w), 8, True, "row")
y_mixed = x_int8 @ w_int8.T + x[:, outliers] @ w[:, outliers].T
report(f"LLM.int8() decomposition ({outliers.sum()} FP16 dims)", y_mixed)

# SmoothQuant: divide activation channel j by s_j and multiply weight column j by s_j.
for alpha in (0.5, 0.8):
    s = channel_max**alpha / np.abs(w).max(axis=0) ** (1 - alpha)
    xs, ws = x / s, w * s
    ws8 = fake_quant(ws, 8, True, "row")
    report(f"SmoothQuant a={alpha}, A8 per-tensor", fake_quant(xs, 8, True, "tensor") @ ws8.T)
    report(f"SmoothQuant a={alpha}, A8 per-token", fake_quant(xs, 8, True, "row") @ ws8.T)
```

```text title="saída"
X (512, 1536): median |x| 0.174, max 2589.6 at position 0
channel 1095: median |x| over tokens 38.7
channel 625: median |x| over tokens 15.7

W8A8, weights INT8 per-channel in every row below
A8 per-tensor                                all  21.26%   pos 1+  75.28%
A8 per-token                                 all   2.35%   pos 1+   7.68%
LLM.int8() decomposition (407 FP16 dims)     all   0.24%   pos 1+   0.86%
SmoothQuant a=0.5, A8 per-tensor             all  11.17%   pos 1+  39.55%
SmoothQuant a=0.5, A8 per-token              all   0.79%   pos 1+   2.54%
SmoothQuant a=0.8, A8 per-tensor             all   2.08%   pos 1+   7.35%
SmoothQuant a=0.8, A8 per-token              all   1.30%   pos 1+   4.61%
```

"All" é o erro sobre os 512 tokens e "pos 1+" pula a posição 0, cuja massive activation faz a saída dela ser 96% da norma total e esconderia todo o resto. Lendo a coluna "pos 1+":

- **Ativações INT8 per-tensor são inutilizáveis: 75% de erro.** A escala precisa cobrir 2.589, então o degrau fica em torno de 20, e um valor mediano de 0,17 não chega nem perto de um degrau.
- **Escalas per-token ajudam muito (7,7%)**, porque a posição 0 ganha a própria escala, mas o canal 1095 ainda define o degrau de todos os outros tokens.
- **A decomposição do LLM.int8() é a mais precisa (0,86%)**, e aqui ela mostra o seu custo: com o limiar de 6,0 do paper, 407 das 1.536 dimensões desta camada contam como outliers e rodam em FP16. O limiar foi escolhido para modelos da classe do OPT; num modelo pequeno com outra escala de ativação, "0,1% dos valores" vira um quarto do matmul.
- **SmoothQuant com `alpha = 0.5` e ativações per-token chega a 2,5% com todas as dimensões em INT8.** Com uma escala de ativação per-tensor ele ainda sofre (39,6%), porque a posição 0 continua dominando uma escala compartilhada; empurrar mais da dificuldade para os pesos (`alpha = 0.8`) derruba o per-tensor para 7,4%.

É por isso que as receitas W8A8 de produção usam escalas de ativação dinâmicas per-token, ou suavização, ou as duas, e por isso tantos deploys quantizam só os pesos.

### O corte, medido

O script por trás dos números de corte do mergulho na arquitetura, na mesma camada e nos mesmos 512 tokens:

```python title="clip_demo.py"
import numpy as np

from quantize import fake_quant, rel_error

data = np.load("down_proj_l28.npz")
w, x = data["w"], data["x"]
y = x @ w.T
wq8 = fake_quant(w, 8, True, "row")

for pct in (99.9, 99.99):
    limit = np.percentile(np.abs(x), pct)
    clipped = np.clip(x, -limit, limit)
    share = (np.abs(x) > limit).mean()
    y_clip = clipped @ w.T
    y_q = fake_quant(clipped, 8, True, "tensor") @ wq8.T
    print(f"clip at the {pct}th percentile (|x| <= {limit:.2f}, {share:.2%} of values)")
    print(f"  clipping alone      all {rel_error(y, y_clip):>7.2%}   pos 0 {rel_error(y[:1], y_clip[:1]):>7.2%}   pos 1+ {rel_error(y[1:], y_clip[1:]):>7.2%}")
    print(f"  + A8 per-tensor     all {rel_error(y, y_q):>7.2%}   pos 0 {rel_error(y[:1], y_q[:1]):>7.2%}   pos 1+ {rel_error(y[1:], y_q[1:]):>7.2%}")
```

```text title="saída"
clip at the 99.9th percentile (|x| <= 17.85, 0.10% of values)
  clipping alone      all  94.79%   pos 0  98.53%   pos 1+  25.05%
  + A8 per-tensor     all  94.79%   pos 0  98.53%   pos 1+  25.14%
clip at the 99.99th percentile (|x| <= 45.09, 0.01% of values)
  clipping alone      all  92.85%   pos 0  96.78%   pos 1+   1.85%
  + A8 per-tensor     all  92.87%   pos 0  96.77%   pos 1+   9.07%
```

Somar INT8 por tensor ao corte de 0,01% leva os outros tokens de volta a 9,1%: uma escala compartilhada ainda precisa cobrir o canal 1095. Cortar troca um problema de quantização por um problema de correção, e aqui perde nos dois.

### O modelo inteiro, de dezesseis jeitos

Agora o modelo em si. O `evaluate.py` restaura os pesos originais, aplica uma configuração a todas as 210 camadas lineares dos blocos transformer (os embeddings, compartilhados com o LM head neste modelo, ficam em BF16, como a maioria das receitas de 4 bits os mantém) e dá a nota:

- perplexidade sobre 32 janelas de 1.024 tokens do teste do WikiText-2 (32.736 previsões);
- divergência KL e concordância top-1 contra a distribuição de próximo token do baseline, nas 4 primeiras janelas (4.092 tokens);
- acurácia no LAMBADA (match greedy exato da última palavra inteira) e no HellaSwag (log-verossimilhança normalizada pelo tamanho dos quatro finais, o `acc_norm` de sempre).

As configurações W8A8 acrescentam um hook que faz fake quantization de toda entrada linear; as configurações de KV cache fazem fake quantization da saída de `k_proj` e `v_proj` por token e por head (64 valores dividem uma escala). Essa é a chave antes do RoPE, que também é o que o [KVQuant](https://arxiv.org/abs/2401.18079) quantiza.

```python title="evaluate.py"
import json
import os
import re
import sys
import time

import numpy as np
import torch
import torch.nn.functional as F
from transformers import AutoModelForCausalLM, AutoTokenizer

from quantize import fake_quant

MODEL = "HuggingFaceTB/SmolLM2-135M"
WINDOW, N_WINDOWS, KL_WINDOWS = 1024, 32, 4
torch.manual_seed(0)
torch.set_num_threads(8)

tokenizer = AutoTokenizer.from_pretrained(MODEL)
model = AutoModelForCausalLM.from_pretrained(MODEL, dtype=torch.float32).eval()
# The checkpoint is BF16, so keeping the originals in BF16 is lossless and halves the copy.
original = {name: p.detach().to(torch.bfloat16) for name, p in model.named_parameters()}

wiki_ids = tokenizer(open("data/wikitext2_test.txt", encoding="utf-8").read(), return_tensors="pt").input_ids[0]
windows = wiki_ids[: WINDOW * N_WINDOWS].view(N_WINDOWS, WINDOW)
lambada = json.load(open("data/lambada_1000.json", encoding="utf-8"))
hellaswag = json.load(open("data/hellaswag_val_1000.json", encoding="utf-8"))


def linear_layers(m):
    return [(name, mod) for name, mod in m.named_modules() if isinstance(mod, torch.nn.Linear) and ".layers." in name]


def fp8_e4m3(w: torch.Tensor) -> torch.Tensor:
    scale = w.abs().max() / 448.0
    return (w / scale).to(torch.float8_e4m3fn).to(torch.float32) * scale


def apply(setting: dict) -> list:
    with torch.no_grad():
        for name, p in model.named_parameters():
            p.copy_(original[name].float())
    hooks = []
    for name, mod in linear_layers(model):
        w = mod.weight.data
        if setting.get("w") == "fp8":
            mod.weight.data = fp8_e4m3(w)
        elif "w" in setting:
            bits, sym, gran = setting["w"]
            mod.weight.data = torch.from_numpy(fake_quant(w.numpy(), bits, sym, gran))
        if "a" in setting:
            bits, gran = setting["a"]

            def quant_input(module, args, bits=bits, gran=gran):
                x = args[0]
                flat = x.reshape(-1, x.shape[-1]).numpy()
                return (torch.from_numpy(fake_quant(flat, bits, True, gran)).view_as(x),)

            hooks.append(mod.register_forward_pre_hook(quant_input))
        if "kv" in setting and name.endswith(("k_proj", "v_proj")):
            bits = setting["kv"]

            def quant_output(module, args, out, bits=bits):
                head_dim = model.config.head_dim
                return torch.from_numpy(fake_quant(out.reshape(-1, head_dim).numpy(), bits, True, "row")).view_as(out)

            hooks.append(mod.register_forward_hook(quant_output))
    return hooks


@torch.no_grad()
def wikitext_metrics(save_reference: bool = False):
    """Perplexity on every window; KL divergence and top-1 agreement against the baseline on the first KL_WINDOWS."""
    if save_reference:
        ref = np.lib.format.open_memmap("ref_logprobs.npy", "w+", np.float16, (KL_WINDOWS, WINDOW - 1, model.config.vocab_size))
    else:
        ref = np.load("ref_logprobs.npy", mmap_mode="r")
    nll, kl, agree, kl_count = 0.0, 0.0, 0, 0
    for i in range(N_WINDOWS):
        batch = windows[i : i + 1]
        logp = F.log_softmax(model(batch).logits[0, :-1].float(), dim=-1)
        nll += -logp.gather(-1, batch[0, 1:].unsqueeze(-1)).sum().item()
        if i < KL_WINDOWS:
            if save_reference:
                ref[i] = logp.numpy().astype(np.float16)
            ref_logp = torch.from_numpy(np.asarray(ref[i], dtype=np.float32))
            kl += (ref_logp.exp() * (ref_logp - logp)).sum().item()
            agree += (logp.argmax(-1) == ref_logp.argmax(-1)).sum().item()
            kl_count += WINDOW - 1
        del logp
    if save_reference:
        ref.flush()
    return {"ppl": float(np.exp(nll / (N_WINDOWS * (WINDOW - 1)))), "kl": kl / kl_count, "top1_agree": agree / kl_count}


def pad(seqs):
    width = max(len(s) for s in seqs)
    ids = torch.zeros(len(seqs), width, dtype=torch.long)
    mask = torch.zeros(len(seqs), width, dtype=torch.long)
    for row, s in enumerate(seqs):
        ids[row, : len(s)] = torch.tensor(s)
        mask[row, : len(s)] = 1
    return ids, mask


@torch.no_grad()
def continuation_logprobs(pairs, batch_size=8):
    """Sum of log-probs of each continuation given its context, and whether every continuation token is the argmax."""
    results = []
    for i in range(0, len(pairs), batch_size):
        chunk = pairs[i : i + batch_size]
        seqs = [ctx + cont for ctx, cont in chunk]
        ids, mask = pad(seqs)
        logits = model(ids, attention_mask=mask).logits
        for row, (ctx, cont) in enumerate(chunk):
            positions = torch.arange(len(ctx) - 1, len(ctx) + len(cont) - 1)
            target = torch.tensor(cont)
            token_logp = F.log_softmax(logits[row, positions].float(), dim=-1)
            results.append((token_logp.gather(-1, target.unsqueeze(-1)).sum().item(), bool((token_logp.argmax(-1) == target).all())))
    return results


def lambada_accuracy():
    pairs = []
    for row in lambada:
        text = row["text"]
        cut = text.rindex(" ")
        pairs.append((tokenizer(text[:cut]).input_ids, tokenizer(text[cut:]).input_ids))
    return float(np.mean([greedy for _, greedy in continuation_logprobs(pairs)]))


def hellaswag_clean(text):
    text = text.strip().replace(" [title]", ". ")
    return re.sub(r"\[.*?\]", "", text).replace("  ", " ")


def hellaswag_accuracy():
    pairs, lengths, labels = [], [], []
    for row in hellaswag:
        ctx = row["ctx_a"] + " " + row["ctx_b"].capitalize()
        query = tokenizer(hellaswag_clean(row["activity_label"] + ": " + ctx)).input_ids
        for ending in row["endings"]:
            ending = " " + hellaswag_clean(ending)
            pairs.append((query, tokenizer(ending).input_ids))
            lengths.append(len(ending))
        labels.append(int(row["label"]))
    scores = np.array([lp for lp, _ in continuation_logprobs(pairs)]) / np.array(lengths)
    return float(np.mean(scores.reshape(-1, 4).argmax(1) == np.array(labels)))


SETTINGS = {
    "baseline (BF16 weights)": {},
    "FP8 E4M3 per-tensor": {"w": "fp8"},
    "INT8 sym per-tensor": {"w": (8, True, "tensor")},
    "INT8 sym per-channel": {"w": (8, True, "row")},
    "INT4 sym per-tensor": {"w": (4, True, "tensor")},
    "INT4 sym per-channel": {"w": (4, True, "row")},
    "INT4 asym per-channel": {"w": (4, False, "row")},
    "INT4 sym group 64": {"w": (4, True, 64)},
    "INT4 asym group 64": {"w": (4, False, 64)},
    "INT4 asym group 32": {"w": (4, False, 32)},
    "INT3 asym group 64": {"w": (3, False, 64)},
    "INT3 asym group 32": {"w": (3, False, 32)},
    "W8A8 per-channel / per-tensor": {"w": (8, True, "row"), "a": (8, "tensor")},
    "W8A8 per-channel / per-token": {"w": (8, True, "row"), "a": (8, "row")},
    "KV cache INT8": {"kv": 8},
    "KV cache INT4": {"kv": 4},
}

if __name__ == "__main__":
    out_path = os.environ.get("RESULTS", "results.json")
    try:
        results = json.load(open(out_path))
    except FileNotFoundError:
        results = {}
    only = sys.argv[1:]
    for name, setting in SETTINGS.items():
        if name in results or (only and name not in only):
            continue
        start = time.time()
        hooks = apply(setting)
        row = wikitext_metrics(save_reference=not setting)
        row["lambada"] = lambada_accuracy()
        row["hellaswag"] = hellaswag_accuracy()
        for h in hooks:
            h.remove()
        results[name] = row
        json.dump(results, open(out_path, "w"), indent=1)
        print(f"{name:<32} ppl {row['ppl']:8.3f}  kl {row['kl']:.4f}  top1 {row['top1_agree']:.2%}  "
              f"lambada {row['lambada']:.1%}  hellaswag {row['hellaswag']:.1%}  ({time.time() - start:.0f}s)", flush=True)
```

```text title="terminal"
python evaluate.py
python report.py
```

```text title="saída"
setting                                   PPL      KL top-1 same  LAMBADA HellaSwag
baseline (BF16 weights)                 16.88  0.0000     100.0%    43.3%     44.4%
FP8 E4M3 per-tensor                     17.05  0.0123      93.6%    42.7%     44.2%
INT8 sym per-tensor                     17.55  0.0453      88.6%    42.2%     44.8%
INT8 sym per-channel                    16.96  0.0036      97.1%    43.1%     44.3%
INT4 sym per-tensor              4,160,947.94 12.3475       1.7%     0.0%     28.0%
INT4 sym per-channel                    38.12  0.8719      52.8%    21.1%     39.0%
INT4 asym per-channel                   28.06  0.4932      63.8%    26.2%     41.6%
INT4 sym group 64                       24.18  0.3437      69.1%    24.4%     44.4%
INT4 asym group 64                      21.70  0.2524      72.3%    31.8%     43.6%
INT4 asym group 32                      20.37  0.1845      75.8%    35.8%     45.9%
INT3 asym group 64                      67.10  1.3826      42.4%    10.0%     40.1%
INT3 asym group 32                      46.32  1.0187      48.4%    13.9%     42.7%
W8A8 per-channel / per-tensor           30.17  0.5456      61.3%    20.6%     39.9%
W8A8 per-channel / per-token            17.59  0.0422      91.4%    41.8%     45.1%
KV cache INT8                           16.89  0.0005      98.8%    43.0%     44.3%
KV cache INT4                           21.03  0.2242      75.7%    30.6%     42.9%
```

Lendo de cima para baixo:

- **A linha de base não é exatamente zero** (KL 0,000001, 99,98% de concordância) porque a distribuição de referência fica guardada em FP16 para caber em disco. Esse é o piso de ruído da comparação.
- **Pesos em 8 bits são seguros, e a granularidade ainda aparece.** INT8 por canal mexe 0,5% na perplexidade e mantém 97,1% das escolhas top-1, com o LAMBADA dentro do ruído. INT8 por tensor é claramente pior (KL 0,045, 88,6% de concordância), e FP8 por tensor fica entre os dois: o expoente dá passos mais finos aos pesos pequenos, coisa que uma única escala INT8 não consegue.
- **INT4 por tensor é um modelo morto**: perplexidade na casa dos milhões, LAMBADA em zero, HellaSwag em 28%, quando chutar dá 25%.
- **4 bits com grupos é utilizável, e as métricas discordam sobre o quanto.** A melhor linha de 4 bits, grupos assimétricos de 32, aumenta a perplexidade em 21% e concorda com a linha de base em três tokens de cada quatro. O LAMBADA perde 7,5 pontos (de 43,3% para 35,8%), e o HellaSwag *sobe* 1,5.
- **O HellaSwag mal percebe o estrago até o modelo quebrar.** INT4 simétrico com grupos de 64 marca exatamente os 44,4% da linha de base enquanto o LAMBADA cai 19 pontos e a perplexidade sobe 43%. Escolher um de quatro finais por verossimilhança aguenta muito ruído; reproduzir a última palavra exata de um trecho, não. Com 1.000 exemplos, o erro padrão de cada tarefa fica em torno de 1,6 ponto, então uma diferença abaixo de 3 pontos não diz nada em nenhuma direção.
- **3 bits quebra um modelo deste tamanho** com arredondamento simples: perplexidade entre 46 e 67, LAMBADA caindo para 10% e 14%.
- **O W8A8 vive ou morre pela escala das ativações**, como a camada isolada previu. Ativações por tensor quase dobram a perplexidade e cortam o LAMBADA pela metade; ativações por token ficam perto do INT8 só nos pesos.
- **Um KV cache em INT8 sai de graça** (KL 0,0005, LAMBADA 43,0%). **Em INT4, não**, pelo menos por token como aqui: o LAMBADA cai para 30,6%. As keys têm canais outliers, e é por isso que o KIVI quantiza keys por canal e values por token.

Duas ressalvas mantêm isso honesto. Toda linha de 4 e 3 bits usa arredondamento para o mais próximo, a linha de base que GPTQ e AWQ foram feitos para superar, então um build de 4 bits de verdade deve ficar bem acima dessas linhas. E um modelo de 135M é muito mais frágil que um de 8B; os próprios resultados do artigo do GPTQ mostram modelos maiores perdendo menos com o mesmo número de bits. Leia os números absolutos como o pior caso. O que se aproveita é o método: uma linha de base, o mesmo texto, KL e concordância ao lado da perplexidade, e pelo menos uma tarefa que exige respostas exatas.

### A calculadora de memória

O último script responde à pergunta que abriu este post: o que cabe onde. Ele conta os parâmetros a partir dos valores do `config.json` de cada modelo (conferidos com os totais publicados: o Llama 3.1 8B dá 8,03B), mantém os embeddings e o LM head em BF16 e aplica o custo real de cada formato em bits por peso, com escalas e zero points incluídos:

```python title="memory.py"
from dataclasses import dataclass

GIB = 1024**3


@dataclass
class Config:
    name: str
    hidden: int
    intermediate: int
    layers: int
    heads: int
    kv_heads: int
    vocab: int
    head_dim: int = 0

    def __post_init__(self):
        self.head_dim = self.head_dim or self.hidden // self.heads

    @property
    def block_params(self) -> int:
        attn = 2 * self.hidden * self.heads * self.head_dim + 2 * self.hidden * self.kv_heads * self.head_dim
        return self.layers * (attn + 3 * self.hidden * self.intermediate)

    @property
    def embedding_params(self) -> int:
        return 2 * self.vocab * self.hidden  # input embeddings + untied LM head

    def kv_bytes_per_token(self, bytes_per_value: float) -> float:
        return 2 * self.layers * self.kv_heads * self.head_dim * bytes_per_value


# Bits per weight for the transformer blocks, scales and zero points included.
FORMATS = {
    "BF16": 16,
    "INT8 or FP8": 8,
    "INT4 g128 (GPTQ/AWQ)": 4 + (16 + 4) / 128,
    "NF4 + double quant": 4 + 0.127,
    "GGUF Q4_K": 4.5,
    "INT3 g128": 3 + (16 + 3) / 128,
}

MODELS = [
    Config("Llama 3.1 8B", 4096, 14336, 32, 32, 8, 128256),
    Config("Qwen2.5 14B", 5120, 13824, 48, 40, 8, 152064),
    Config("Qwen2.5 32B", 5120, 27648, 64, 40, 8, 152064),
    Config("Llama 3.1 70B", 8192, 28672, 80, 64, 8, 128256),
]


def weights_gib(cfg: Config, block_bits: float, embedding_bits: float = 16) -> float:
    return (cfg.block_params * block_bits + cfg.embedding_params * embedding_bits) / 8 / GIB


def max_context(cfg: Config, gpu_gib: float, block_bits: float, kv_bytes: float, reserve_gib: float = 1.5) -> int:
    free = (gpu_gib - reserve_gib - weights_gib(cfg, block_bits)) * GIB
    return max(0, int(free // cfg.kv_bytes_per_token(kv_bytes)))


if __name__ == "__main__":
    print(f"{'model':<14} {'params':>7} {'embed':>6} {'KV/token':>9}")
    for cfg in MODELS:
        total = cfg.block_params + cfg.embedding_params
        print(f"{cfg.name:<14} {total / 1e9:>6.2f}B {cfg.embedding_params / total:>6.1%} {cfg.kv_bytes_per_token(2) / 1024:>6.0f} KiB")

    print("\nweights in GiB (embeddings and LM head kept in BF16)")
    print(f"{'format':<22}" + "".join(f"{cfg.name:>15}" for cfg in MODELS))
    for fmt, bits in FORMATS.items():
        print(f"{fmt:<22}" + "".join(f"{weights_gib(cfg, bits):>15.1f}" for cfg in MODELS))

    for gpu in (24, 8):
        print(f"\n{gpu} GiB GPU, 1.5 GiB reserved: KV cache tokens that fit, all requests combined (BF16 KV / FP8 KV)")
        for fmt in ("BF16", "INT8 or FP8", "INT4 g128 (GPTQ/AWQ)"):
            cells = []
            for cfg in MODELS:
                bf16 = max_context(cfg, gpu, FORMATS[fmt], 2)
                fp8 = max_context(cfg, gpu, FORMATS[fmt], 1)
                cells.append("-" if bf16 == 0 and fp8 == 0 else f"{bf16 // 1000}k / {fp8 // 1000}k")
            print(f"{fmt:<22}" + "".join(f"{c:>15}" for c in cells))
```

```text title="saída"
model           params  embed  KV/token
Llama 3.1 8B     8.03B  13.1%    128 KiB
Qwen2.5 14B     14.77B  10.5%    192 KiB
Qwen2.5 32B     32.76B   4.8%    256 KiB
Llama 3.1 70B   70.55B   3.0%    320 KiB

weights in GiB (embeddings and LM head kept in BF16)
format                   Llama 3.1 8B    Qwen2.5 14B    Qwen2.5 32B  Llama 3.1 70B
BF16                             15.0           27.5           61.0          131.4
INT8 or FP8                       8.5           15.2           32.0           67.7
INT4 g128 (GPTQ/AWQ)              5.3            9.3           18.0           37.0
NF4 + double quant                5.3            9.2           17.9           36.8
GGUF Q4_K                         5.6            9.8           19.2           39.8
INT3 g128                         4.5            7.7           14.3           29.0

24 GiB GPU, 1.5 GiB reserved: KV cache tokens that fit, all requests combined (BF16 KV / FP8 KV)
BF16                       61k / 123k              -              -              -
INT8 or FP8               115k / 230k      39k / 79k              -              -
INT4 g128 (GPTQ/AWQ)      140k / 281k     72k / 144k      18k / 36k              -

8 GiB GPU, 1.5 GiB reserved: KV cache tokens that fit, all requests combined (BF16 KV / FP8 KV)
BF16                                -              -              -              -
INT8 or FP8                         -              -              -              -
INT4 g128 (GPTQ/AWQ)         9k / 19k              -              -              -
```

A reserva de 1,5 GiB é uma suposição minha para o contexto CUDA, o espaço de trabalho de ativações do motor e a fragmentação; meça a sua, ela varia com o motor e o batch size. O orçamento de KV é dividido por tudo que está em andamento: 61K tokens são uma conversa de 61K tokens ou trinta de 2K.

Três coisas saltam aos olhos. **Os embeddings não encolhem** a menos que você os quantize também: no Llama 3.1 8B eles são 13% dos parâmetros e 2 GiB dos 5,3 GiB do total em 4 bits. **Em 24 GiB, o 8B em BF16 funciona mas aperta o cache**, INT8 ou FP8 dobram o espaço, e KV em FP8 dobra de novo, o que para um motor de serving significa concorrência. **Em 8 GiB, pesos de 4 bits são o único jeito de um modelo de 8B caber**, com espaço para uns 9K tokens de cache em BF16, ou 19K com cache em FP8. Um modelo de 14B não cabe em 8 GiB nem com 3 bits depois de contar o cache e a reserva. O mesmo trade-off aparece na busca vetorial: guardar embeddings em int8 ou binário corta a memória de 4 a 32 vezes com um custo mensurável de recall, como mostrei em [Seu banco vetorial está lento por causa destas 5 configurações](/pt-br/blog/vector-database-performance-settings/).

## Checagem de realidade em produção

### Quantização simulada mede precisão, não velocidade

Tudo acima calcula em FP32 com valores arredondados, então não diz nada sobre latência. A velocidade vem de kernels que leem pesos empacotados em 4 ou 8 bits e os dequantizam nos registradores, e esses kernels dependem do hardware e do formato: matmuls em FP8 precisam de tensor cores FP8 (NVIDIA Ada, Hopper e mais novas), e kernels de 4 bits só para pesos, como o Marlin, que o vLLM usa da Ampere em diante, são o que transforma W4A16 em decodificação mais rápida. O tamanho do batch também muda a resposta. A quantização só dos pesos ajuda mais em batches pequenos, onde a decodificação é limitada pela memória; com muita concorrência, as matmuls passam a ser limitadas pela computação, o trabalho de dequantizar aparece, e FP8 ou W8A8, que também aceleram a conta, muitas vezes servem mais tokens por segundo. Faça o benchmark na concorrência que você realmente roda.

### Use um método de verdade, e meça assim

Arredondar para o mais próximo é o piso. Para servir em GPU, use checkpoints GPTQ ou AWQ (o llm-compressor gera os dois para o vLLM) ou FP8 em GPUs da classe Hopper. No llama.cpp, gere k-quants com uma matriz de importância do `llama-imatrix`, que dá aos formatos dele a calibração que GPTQ e AWQ têm. Depois repita a comparação acima contra o seu próprio modelo sem quantização. O `llama-perplexity` do llama.cpp faz a parte do KL por você: salve os logits do modelo base uma vez com `--kl-divergence-base` e rode cada arquivo quantizado com `--kl-divergence` para ter divergência KL, concordância do token mais provável e perplexidade lado a lado.

### Calibre com o que você serve

GPTQ, AWQ, SmoothQuant, matrizes de importância e as escalas de ativação ou de KV em FP8 aprendem com texto de calibração. Se esse texto é página web genérica em inglês e você serve contratos em português ou extração de JSON, os canais que importam para o seu tráfego nunca foram os medidos. Calibre com algumas centenas de amostras de prompts reais e avalie com outra amostra.

### Trate como qualquer outra troca de modelo

Um modelo quantizado é um modelo novo. Passe por ele as mesmas avaliações de uma troca de modelo: o seu conjunto de tarefas, pontuado pelo seu avaliador, contra a versão sem quantização nas mesmas entradas, mais a contagem de viradas, quantas respostas passaram de certas para erradas. O bug do formato de data da abertura é a cara de uma virada em produção: a qualidade agregada quase não mexeu, e um campo quebrou algumas vezes por dia. Se o avaliador é um modelo, calibre-o antes ([Um LLM-as-a-judge em que dá para confiar: calibre o avaliador antes de acreditar na nota](/pt-br/blog/llm-as-judge-calibration/) mostra como). Mantenha o modelo sem quantização pronto para deploy, para que voltar atrás seja uma mudança de configuração.

### Builds baixados são escolhas de outra pessoa

Um arquivo de 4 bits do hub carrega decisões que você não tomou: o método, o tamanho do grupo, os dados de calibração, quais tensores ficaram em precisão maior. Prefira checkpoints quantizados publicados pelos autores do modelo ou por um pipeline que você conhece, leia a receita e meça o arquivo do mesmo jeito que mediria um feito por você.

### Teste o KV cache no tamanho de contexto real

Um cache de 8 bits saiu quase de graça aqui; abaixo de 8 bits, as keys precisam de tratamento por canal. Os erros no cache também se acumulam com o tamanho, já que cada token novo presta atenção em todas as keys quantizadas antes dele, então teste um cache quantizado nos tamanhos de contexto que você serve, não em prompts curtos.

De volta ao time com uma GPU de 24 GB. O build de 4 bits pode muito bem ter sido a escolha certa; o que faltou foi a comparação. Uma tarde rodando os próprios prompts de extração no modelo BF16 e no de 4 bits, com divergência KL e um diff campo a campo das saídas, teria mostrado o problema das datas antes dos usuários. Quantize, e rode essa comparação em todo build antes de ele ir para produção.
