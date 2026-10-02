---
title: Black Forest Labs releases FLUX 3 Image, with 4K output and edits placed by coordinates
summary: The image model of the FLUX 3 family generates and edits through one endpoint, combines up to ten reference images and lets developers place or change elements with bounding boxes. It costs $0.048 per 1K image, half that until October 8, and open weights are promised within weeks.
date: '2026-10-02'
order: 0
category: ai
publisher: Black Forest Labs
sourceUrl: 'https://docs.bfl.ai/flux_3/flux3_image_overview'
image: /news/black-forest-labs-flux-3-image/cover.webp?v=1
sources:
  - url: 'https://docs.bfl.ai/flux_3/flux3_image_overview'
    label: 'Black Forest Labs: FLUX 3 Image documentation'
  - url: 'https://bfl.ai/pricing'
    label: 'Black Forest Labs: API pricing'
  - url: 'https://the-decoder.com/black-forest-labs-launches-flux-3-image-with-multi-step-editing-that-leaves-the-rest-of-your-picture-alone/'
    label: 'The Decoder: Black Forest Labs launches Flux 3 Image'
  - url: 'https://alphasignal.ai/news/black-forest-labs-flux-3-image-lets-developers-place-objects-with-exact'
    label: 'AlphaSignal: FLUX 3 Image lets developers place objects with exact coordinates'
  - url: 'https://openrouter.ai/black-forest-labs/flux-3-image'
    label: 'OpenRouter: FLUX.3 Image pricing by resolution'
lead:
  - 'Black Forest Labs released FLUX 3 Image on Thursday, the image side of the FLUX 3 family it announced in July alongside video, audio and robotics models. A single API endpoint handles text-to-image and editing, takes up to ten reference images in one request and renders natively at fixed tiers from 768 pixels up to 4K, about 16.8 megapixels, without a separate upscaling pass. The company says the highest tier can take several minutes per image.'
  - 'The default 1K image costs $0.048, rising to $0.10 at 2K and $0.607 at 4K, and every tier is half price through October 8. The model is available in the BFL playground and API, a commercial license covers running the weights on your own hardware, and an open-weight version is promised "within weeks", without a date.'
---

## Editing with coordinates

The feature that sets FLUX 3 Image apart from most image APIs is its layout system. A request can describe each element of a scene with a name, a caption and a bounding box on a normalized 0 to 1000 grid, written as `[y0, x0, y1, x1]`, so the same coordinates work at any aspect ratio. To edit, you mark the boxes to change (remove, add, replace, recolor or move an element) and "anchor" boxes for what must stay, and the model regenerates only those regions. The references are cited in the prompt by position, so "the jacket from the third image on the person in box 2" is a valid instruction. There is no negative prompt field; the documentation tells users to describe what they want instead.

That makes it a tool for production work more than for one-off prompts: product photos where only the color changes, ad layouts with copy in fixed places, a character kept consistent across a campaign. BFL's own examples show the pixels outside the edited boxes matching the input, with between 68% and 94% of each image left identical in the cases it documents.

## What it doesn't show yet

The release comes without numbers to judge it by. BFL published no benchmark for FLUX 3 Image, no measured layout accuracy, no latency figures and no preservation rate beyond its examples, so the claims about precise placement and untouched pixels can only be checked by trying it. The open weights also matter more than usual here: FLUX became a default for local image generation because earlier versions shipped open models, and the FLUX 3 Dev weights promised in July have not been released yet. The competition is close behind: Ideogram's version 4.5 is also built around editing, and Ideogram is also promising open weights.
