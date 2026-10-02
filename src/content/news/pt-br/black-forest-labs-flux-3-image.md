---
title: Black Forest Labs lança o FLUX 3 Image, com saída em 4K e edições posicionadas por coordenadas
summary: O modelo de imagem da família FLUX 3 gera e edita pelo mesmo endpoint, combina até dez imagens de referência e permite posicionar ou alterar elementos com caixas delimitadoras. Custa US$ 0,048 por imagem em 1K, metade disso até 8 de outubro, e os pesos abertos foram prometidos para as próximas semanas.
date: '2026-10-02'
order: 0
category: ai
publisher: Black Forest Labs
sourceUrl: 'https://docs.bfl.ai/flux_3/flux3_image_overview'
image: /news/black-forest-labs-flux-3-image/cover.webp?v=1
sources:
  - url: 'https://docs.bfl.ai/flux_3/flux3_image_overview'
    label: 'Black Forest Labs: documentação do FLUX 3 Image'
  - url: 'https://bfl.ai/pricing'
    label: 'Black Forest Labs: preços da API'
  - url: 'https://the-decoder.com/black-forest-labs-launches-flux-3-image-with-multi-step-editing-that-leaves-the-rest-of-your-picture-alone/'
    label: 'The Decoder: Black Forest Labs lança o Flux 3 Image'
  - url: 'https://alphasignal.ai/news/black-forest-labs-flux-3-image-lets-developers-place-objects-with-exact'
    label: 'AlphaSignal: FLUX 3 Image permite posicionar objetos com coordenadas exatas'
  - url: 'https://openrouter.ai/black-forest-labs/flux-3-image'
    label: 'OpenRouter: preços do FLUX.3 Image por resolução'
lead:
  - 'A Black Forest Labs lançou na quinta-feira o FLUX 3 Image, o lado de imagem da família FLUX 3 que a empresa anunciou em julho junto com modelos de vídeo, áudio e robótica. Um único endpoint da API faz texto para imagem e edição, aceita até dez imagens de referência numa requisição e gera nativamente em faixas fixas de 768 pixels até 4K, cerca de 16,8 megapixels, sem uma etapa separada de upscaling. Segundo a empresa, a faixa mais alta pode levar alguns minutos por imagem.'
  - 'A imagem padrão em 1K custa US$ 0,048, sobe para US$ 0,10 em 2K e US$ 0,607 em 4K, e todas as faixas saem pela metade do preço até 8 de outubro. O modelo está no playground e na API da BFL, uma licença comercial cobre rodar os pesos no seu próprio hardware, e uma versão com pesos abertos foi prometida para "as próximas semanas", sem data.'
---

## Editando com coordenadas

O recurso que separa o FLUX 3 Image da maioria das APIs de imagem é o sistema de layout. Uma requisição pode descrever cada elemento da cena com um nome, uma legenda e uma caixa delimitadora numa grade normalizada de 0 a 1000, escrita como `[y0, x0, y1, x1]`, então as mesmas coordenadas valem em qualquer proporção. Para editar, você marca as caixas que devem mudar (remover, adicionar, trocar, recolorir ou mover um elemento) e caixas "âncora" para o que precisa ficar, e o modelo regenera só essas regiões. As referências são citadas no prompt pela posição, então "a jaqueta da terceira imagem na pessoa da caixa 2" é uma instrução válida. Não existe campo de prompt negativo; a documentação manda descrever o que se quer no lugar.

Isso faz dele uma ferramenta mais para trabalho de produção do que para prompts avulsos: fotos de produto em que só a cor muda, peças de anúncio com o texto em posições fixas, um personagem que se mantém igual ao longo de uma campanha. Os próprios exemplos da BFL mostram os pixels fora das caixas editadas iguais aos da entrada, com 68% a 94% de cada imagem idêntica nos casos documentados.

## O que ainda não dá para ver

O lançamento veio sem números para avaliá-lo. A BFL não publicou benchmark do FLUX 3 Image, nem precisão medida do layout, nem latência, nem taxa de preservação além dos exemplos, então as promessas de posicionamento preciso e de pixels intocados só se confirmam testando. Os pesos abertos também pesam mais do que o normal aqui: o FLUX virou padrão para geração de imagem local porque as versões anteriores saíram com modelos abertos, e os pesos do FLUX 3 Dev prometidos em julho ainda não foram liberados. A concorrência está perto: a versão 4.5 do Ideogram também gira em torno de edição, e o Ideogram também promete pesos abertos.
