# Catálogo de animações — engenharia reversa (v2, medida em resolução nativa)

Fontes (`~/pi_video/ref/`), ambas 854×480:
- **REF-M** "EDIÇÃO MOTION COM CLAUDE OPUS 5.5" — 17:52 @ 23.976fps
- **REF-E** "Você não precisa saber editar vídeos" — 10:35 @ 30fps

> **Por que 480p importa:** os contact sheets foram extraídos a 320–480px de
> largura. Só ao abrir frames nativos apareceram o **grid de pontos**, os
> **sparkles**, o **texto gigante atrás da pessoa** e a **caixa tracejada**.
> Cores foram medidas com k-means em `tools/analyze_motion.py`.

---

## ASSINATURA VISUAL (o que faz o estilo ser o estilo)

### A1 — Dot Grid (fundo)
`background-image: radial-gradient(circle, rgba(255,255,255,.085) 1px, transparent 1px)`
`background-size: 32px 32px` sobre `#0a0a0a`. **Sempre presente** na REF-M.
Em cards chapados de cor, o grid continua a `rgba(0,0,0,.06)`.

### A2 — Sparkle (estrela de 4 pontas)
Dois sparkles flanqueando o assunto, ~28px, brancos com glow suave.
Variante: piscam (opacity .2→1) em ciclo de ~40 frames, dessincronizados.
Posição recorrente: (15%, 28%) e (85%, 28%).

### A3 — Caixa tracejada (dashed chip)
`border: 2px dashed rgba(255,255,255,.75)`, `border-radius: 8px`,
`padding: 8px 22px`, texto bold 0.032×h. Usada como etiqueta ("Editor do canal",
"Sem editor de vídeo").

### A4 — Texto gigante ATRÁS da pessoa ← o efeito-assinatura
A palavra ocupa 0.22–0.30 da altura do frame (≈110–145px em 480p),
**posicionada atrás do apresentador** (camada z-index inferior ao recorte).
O recorte da pessoa (rembg/mediapipe) fica na frente; a palavra aparece
"atravessada" pelo corpo. É o efeito mais reconhecível da REF-M.
→ Requer recorte de sujeito por frame (temos `segment.py`).

### A5 — Palavra-âncora colorida
Trecho de frase em turquesa `#0db3ae` dentro de texto branco
("esses **efeitos**", "editor **profissional**" em REF-E usa rosa `#f0827a`).

### A6 — Label de tempo/cena
Texto pequeno (0.026×h) num canto, frequentemente com fundo pílula
translúcido ou caixa tracejada: "Agora", "População agora", "Esses efeitos que eu falo".

---

## PALETAS MEDIDAS (k-means, frames nativos)

| | REF-M | REF-E |
|---|---|---|
| Fundo | `#090a0b` (60%) | `#0b0a08` / `#0e0c0a` |
| Marca | **`#01a6a2`** (turquesa real) | `#7dd3a0` verde-menta (texto), `#f0827a` rosa (destaque) |
| Texto | `#fbf9f8` | `#ffffff` |
| Card claro | `#ebfafc` | `#ffffff` |

---

## PADRÕES (com números medidos)

### P01 — Word Along / Giant Behind (A4)
- tamanho: **0.24×h** (~115px @480p), bold 800, caixa alta, `letter-spacing:-0.05em`
- posição: baseline em 0.30×h, centralizado; **atrás** do sujeito
- entrada: `scale 0.9→1` + `opacity 0→1` em **6 frames**, `Easing.out(expo)`
- saída: corte seco
- visto: "PER…NHO", "QUATRO ANOS", "DESCULPA", "MUITO BOM", "LE…GAL"

### P02 — Punch Word (frente, com ghost trail)
- tamanho: 0.16×h, bold, branco, centralizado na altura dos olhos
- entrada: 4 primeiros frames com 3 cópias em `opacity .25/.15/.08` e
  `translateX ∓6/∓12px` (rastro), depois only main
- easing: `Easing.out(expo)`, 8 frames

### P03 — Card Chapado (cor de marca)
- fundo: `#01a6a2` chapado + dot grid a `rgba(0,0,0,.06)`
- texto branco, 3 níveis: 0.028 / 0.055 / 0.11×h
- **destaque:** última palavra em preto `#0a0a0a` (contraste invertido)
- entrada: stagger 4 frames/linha, `translateY 20px→0`, `Easing.bezier(.16,1,.3,1)`
- sparkles nos cantos
- visto: "Sem editor de vídeo / em 30 min / qualidade de", "edições"

### P04 — Counter Slam
- número: 0.20×h, bold 900, **preto sobre card turquesa** ou branco sobre escuro
- transição de dígito: o número **antigo fica visível atrás** com
  `opacity .35` por ~8 frames enquanto o novo entra por cima
  (visto em "25"→"30": o 5 aparece fantasma na posição do 0)
- label: 0.03×h, `rgba(255,255,255,.65)`, entra 6 frames depois

### P05 — Chip Row (fila irregular)
- chip: 0.030×h, `padding 8px 18px`, `border-radius 999px`,
  fundo `rgba(255,255,255,.08)`, borda `rgba(255,255,255,.14)`
- entrada sequencial: 1 chip a cada 4–6 frames, `scale .92→1` spring
- layout manual (irregular de propósito), não grid

### P06 — Logo Lockup
- símbolo 0.13×h (entra `scale .8→1`), nome 0.05×h (+4 frames),
  tagline 0.026×h em `rgba(255,255,255,.6)` (+8 frames)
- última linha em cor de marca
- visto: ChatFunnel, Hype

### P07 — UI Card Flutuante
- screenshot real, `border-radius 10px`, `box-shadow 0 20px 60px rgba(0,0,0,.55)`
- 2 variantes: par lado a lado (gap 16px) ou solto num canto (30% da largura)
- entrada: `scale .9→1` + `translateY 28px→0`, spring `damping 200`
- rotação: `-2deg` na entrada → `0` (assenta)

### P08 — Split Compare
- 2 colunas 44%/44% (ou 60/40 com apresentador), gap 16px
- label uppercase 0.022×h com `letter-spacing .1em` acima de cada lado
- lado "pior": `filter: saturate(.4)`, `opacity .55` depois de 20 frames
- entrada: esquerda 4 frames antes

### P09 — Legenda Documental (REF-E)
- bottom 12%, largura máx 78%, centralizado
- texto 0.030×h, `weight 500` (não bold), `line-height 1.35`
- **sem caixa**: `text-shadow 0 2px 12px rgba(0,0,0,.85)`
- palavra-chave em cor (`#f0827a` rosa / `#7dd3a0` verde)
- kicker acima em caps 0.017×h com `letter-spacing .22em` (ex.: "TODAS AS ANIMAÇÕES E EDIÇÕES DESTE VÍDEO")
- troca de frase: crossfade 3 frames

### P10 — Typing / Highlight (fundo branco)
- fundo `#ffffff` (quebra total), texto preto 0.055×h
- digitação: 1–2 caracteres por frame
- caret: 3px × 1.2em, pisca 15 on / 15 off
- trecho seguinte: cor de marca com `background: cor 12%`, `padding 4px 10px`, `radius 6px`

### P11 — Letterbox + Viewfinder (REF-E, presente o vídeo inteiro)
- letterbox preto 12% topo/base (854×480 → área útil 854×384)
- moldura fina 2px `rgba(255,255,255,.85)` com inset 3.5%
- 4 marcas em "L" de 18px nos cantos (viewfinder)

---

## REGRAS DE RITMO (medidas)

- Cada elemento permanece **1.0–2.6s**; textos gigantes ~1.5s.
- Cortes de fala: **sem transição** (corte seco). Nenhum dissolve observado.
- Entradas são sempre **fast-out**: 6–10 frames, `Easing.out(expo)` ou spring `damping 200`.
- Saídas praticamente não existem: o próximo corte as substitui.
- Stagger entre irmãos: 4–6 frames.
- Densidade: 1 elemento novo a cada ~1.5s na REF-M; REF-E é mais contida
  (legenda fixa + destaque ocasional).

## Correções aprendidas implementando o kit

| Defeito | Correção |
|---|---|
| Sparkle saía minúsculo | o `viewBox` era 24×24 com path de ~15 unidades de altura e um `translate/scale` que reduzia; usar path que ocupe o viewBox inteiro |
| Moldura do viewfinder duplicada | desenhar as 4 marcas de canto com `position:absolute` + `left/right/top/bottom` explícitos por canto; um helper com `rotate()` deixava duas marcas sobrepostas na diagonal |
| Card de marca mais escuro que `#01a6a2` | framebuffer do Remotion compõe em sRGB; medir o **render final**, não o frame do Studio |
| Viewfinder em toda cena + no frame pai | instanciar **uma vez** no nível da composição, não dentro de cada cena |

## Correções de máscara e ancoragem (medidas na prática)

| Sintoma | Causa real | Correção |
|---|---|---|
| Texto aparece **na frente** do sujeito | `category_mask` do MediaPipe Selfie Segmenter tem **pessoa = 0 (preto)** e fundo = 255. O `alphamerge` usa luminância como alpha, então sem inverter o alpha fica no fundo | `format=gray,scale=W:H,negate` antes de `alphamerge` |
| Texto ilegível sobre a parede | texto branco sobre parede clara | usar cor de marca com `borderw` branco (ex.: `#01a6a2` + borda branca) |
| FFmpeg perde alpha em VP9 | esta build (`9.0.2`) ignora `yuva420p`: `ffprobe` reporta `yuv420p` e o decoder devolve alpha=255 em tudo | não depender de WebM transparente; **pré-compor em FFmpeg** e entregar MP4 opaco |
| `geq` falha com "more input link labels" | `geq` aceita **uma** entrada | usar `alphamerge` (máscara como canal alpha) |
| Tabela corta linhas | `contentHeight` menor que a altura real do conteúdo | medir: `header(63) + rows*row(59) + gaps` — 10 linhas ≈ 780px |
| Caixa some fora da tela | posição seguia a mão sem clamp | `Math.max(10, Math.min(width - boxW - 10, ...))` e idem no eixo Y |
| Conteúdo deve caber entre as mãos | escala fixa | **auto-fit**: `scale = min(availW/contentWidth, availH/contentHeight)`, desenhar no tamanho de design e escalar o wrapper |

## O QUE NÃO APARECE (não usar)
- Crossfade/dissolve entre cenas de fala
- Transições 3D (flip, clock-wipe)
- Ken Burns / zoom lento na câmera
- Emojis, setas, rough-notation
- Legendas karaokê palavra-a-palavra (REF-E usa P09; REF-M quase não legenda)
