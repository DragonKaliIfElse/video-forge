---
name: video-anim-recipes
description: Sistema de motion design para vídeo — kit de componentes Remotion com padrões medidos por engenharia reversa (texto gigante atrás do sujeito, cards de marca, contadores, chips, legendas documentais, viewfinder), mais scripts de análise de referência (paleta, curva de animação, triagem de frames). Use ao criar legendas/títulos animados, vídeo em miniatura, quadros/tabelas dinâmicas, transições, ou ao analisar um vídeo de referência para extrair seu estilo.
---

# Video Anim Recipes

Sistema de motion design em três camadas:

- **`ecosystem.md`** — **leia primeiro.** O que já existe pronto (Onda com 70
  componentes MIT, Text Behind Subject, hyperframes) e o que os pacotes pi já
  resolvem. Evita reimplementar.
- **`catalog.md`** — 11 padrões com números medidos (tamanho, easing, frames de
  entrada, cores). É a fonte de verdade do estilo.
- **`examples-v2/motion-kit.tsx`** — componentes Remotion que implementam o
  catálogo. Copie para `src/components/` e use.
- **`examples/`** — receitas anteriores (legendas karaokê, tabela, gráfico,
  transições, miniatura). Ainda válidas para conteúdo explicativo/dados.
- **`scripts/`** — ferramentas para analisar uma referência nova.

## Antes de escrever componente novo

Verifique `ecosystem.md`. Regra prática:

```bash
npx ondajs add fade-in          # commodity: entrances, transitions, browser-frame...
npx ondajs add dynamic-grid     # fundo pontilhado (equivale ao nosso DotGrid)
```

Use o nosso `motion-kit.tsx` só para o que é **assinatura das referências** e não
existe pronto: `GiantBehindText`, `TextBehindSubject`, `BrandCard` (linha
invertida), `CounterSlam` (com fantasma), `ChipRow` irregular, `DocCaption`,
`ViewfinderFrame`.

> Animações são Remotion. pi-media faz corte/EDL/proveniência e revisão —
> não tente fazer motion design dentro do pi-media.

## Cadência: escolha um regime

```ts
ENTRY['institutional'] = {fast:10, base:18, slow:24, stagger:4}   // ritmo calmo (Onda)
ENTRY['talking-head']  = {fast:6,  base:7,  slow:10, stagger:5}   // ritmo de corte de fala
```

As referências analisadas (talking-head) usam **6–8 frames** (~230ms) de entrada,
bem mais rápido que o `base: 18` do Onda (0.6s). Não misture regimes no mesmo vídeo.

> **Repositório:** este pacote vive em `video-forge`. O pipeline executável
> (`forge.py`), o projeto Remotion pronto e a documentação longa estão na raiz.
> Comece por `README.md` e `docs/WORKFLOW.md`.

## Início rápido

```bash
# 1. criar projeto
npx create-video@latest --yes --blank --no-tailwind meu-video && cd meu-video
npm i
npx remotion add @remotion/media @remotion/transitions @remotion/captions \
  @remotion/google-fonts @remotion/layout-utils

# 2. copiar o kit
cp ~/.pi/skills/video-anim-recipes/examples-v2/motion-kit.tsx src/components/

# 3. abrir o Studio ANTES de construir
npm run dev
```

## Qual padrão usar

| Situação na fala | Padrão | Componente |
|---|---|---|
| palavra-chave única e enfática | texto gigante atrás do sujeito | `<GiantBehindText>` |
| impacto rápido, 1 palavra | punch com ghost trail | `<PunchWord>` |
| afirmação de 3 níveis / tese | card de marca chapado | `<BrandCard>` |
| número / resultado | contador com fantasma | `<CounterSlam>` |
| lista de ideias | chips irregulares | `<ChipRow>` |
| assinatura de marca | lockup | `<LogoLockup>` |
| narração contínua | legenda documental | `<DocCaption>` |
| prova visual / comparação | card de UI / split | `examples/` + `<BrandCard>` |
| moldura de assinatura | viewfinder + letterbox | `<ViewfinderFrame>` |
| fundo | dot grid | `<DotGrid>` |
| enfeite | sparkles | `<Sparkle>` |
| etiqueta | caixa tracejada | `<DashedChip>` |

## Leis do estilo (medidas — não são preferência)

1. **Corte seco.** Nenhum dissolve entre cenas de fala. A transição é o corte.
2. **Entradas 6–8 frames** (~330ms), `Easing.out(expo)` ou spring `damping 200`.
3. **Saídas quase não existem** — o corte seguinte substitui.
4. **Stagger 4–6 frames** entre irmãos.
5. **Cada elemento vive 1.0–2.6s.**
6. **Uma ideia por frame.** Nunca dois elementos competindo.
7. **Texto gigante ocupa 0.22–0.30 da altura** (~84% da largura quando frase).
8. **Dot grid sempre** sobre fundo escuro (`32px`, `rgba(255,255,255,.085)`).
9. **Cor de marca única** repetida em todos os cards (medido: `#01a6a2`).
10. **Safe area 4%**.

## Tokens (`T` em motion-kit.tsx)

```ts
bg: '#0a0a0a'  brand: '#01a6a2'  text: '#fbf9f8'
textDim: 'rgba(255,255,255,0.65)'  cardLight: '#ebfafc'
EASE_OUT: Easing.out(Easing.exp)  EASE_SOFT: Easing.bezier(0.16,1,0.3,1)
```

## Analisar uma referência nova

```bash
# triagem: quais frames têm animação?
python scripts/reverse_engineer.py REF.mp4 --samples 24 --out triagem.md

# medição: paleta + curva de entrada de um trecho
python scripts/analyze_motion.py REF.mp4 --from 23.2 --to 25.6 --thresh 240

# paleta de um instante específico (card de marca)
python scripts/analyze_motion.py REF.mp4 --palette-at 23.3

# bordas: detecta moldura / letterbox / padding
python scripts/analyze_motion.py REF.mp4 --probe-border 10
```

**Regra de ouro:** nunca ler cor ou tipografia de um contact sheet (thumb). Um
thumb de 320px de uma fonte 480p desloca a paleta e o tamanho. Sempre abra o
frame **nativo**.

Depois de medir, registre o padrão em `catalog.md` com os números reais
(tamanho em % da altura, frames de entrada, easing, hex).

## Pipeline de vídeo falado (cortes + animações)

1. **Transcrever** com word timestamps → define onde cada palavra é falada.
2. **Cortar silêncios** com VAD neural (Silero), protegendo o núcleo das palavras.
3. **Mapear cues**: para cada pedido do roteiro, o ms exato em que é dito.
4. **Animar** com o kit, uma `Sequence` por cue.
5. **Render** e revisar.

> Scripts prontos do pipeline (transcrição, VAD, tracking de mão, segmentação
> de sujeito) ficam em `~/pi_video/tools/`. O `catalog.md` explica o efeito
> "texto atrás do sujeito", que usa a segmentação.

## Pegadinhas do Remotion já pagas

- **`useCurrentFrame()` dentro de `<Sequence>` é LOCAL.** Some o offset ao
  calcular tempo absoluto (legendas, tracking, máscara por frame).
- `Interactive.create`: `layout: 'absolute-fill'` só quando o componente **não**
  aceita `style`; campos de schema exigem `hiddenFromList`; props não podem se
  chamar `from`, `name`, `durationInFrames`, `trimBefore`, `playbackRate`,
  `loop`, `freeze`, `hidden`.
- `<Video>` de `@remotion/media`: `objectFit` é **prop**, não vai no `style`.
- Vídeo em layout flex empilha e sai da tela: use `position:'absolute', left:0, top:0`
  antes de animar `scale`/`translate`.
- Coluna de gráfico com barras em `%` precisa de `height:'100%'`.
- `scale` animado precisa de `output: 'perceptual-scale'`.
- **Nunca** coloque milhares de PNGs em `public/` para máscara por frame
  (404 no bundle). Pré-componha em FFmpeg e entregue um MP4, ou use WebM.
- Render com efeitos WebGL: `Config.setChromiumOpenGlRenderer('angle')`.

## Estrutura

```
video-anim-recipes/
├── SKILL.md              ← este arquivo (roteador)
├── catalog.md            ← 11 padrões com números medidos
├── ecosystem.md          ← o que já existe pronto (ler primeiro)
├── references.md         ← docs oficiais, Elements, templates
├── examples-v2/
│   └── motion-kit.tsx    ← componentes do catálogo (copiar p/ src/)
├── examples/
│   ├── 01-captions-word-highlight.tsx
│   ├── 02-title-lower-third.tsx
│   ├── 03-video-miniature.tsx
│   ├── 04-dynamic-table.tsx
│   ├── 05-number-counter.tsx
│   ├── 06-vertical-bar-chart.tsx
│   └── 07-transitions-mix.tsx
└── scripts/
    ├── analyze_motion.py     ← paleta + curva de animação (frame nativo)
    └── reverse_engineer.py   ← triagem de vídeo longo → relatório .md
```

## Text behind subject (o efeito mais pedido)

Modelo de **3 camadas** (receita do hyperframes, detalhes em `ecosystem.md`):

```
z1  plate.webm     entorno opaco, buraco na silhueta (máscara invertida)
z2  TEXTO          vive entre as camadas        ← o efeito
z3  subject.webm   pessoa recortada (VP9 alpha)
```

```tsx
<TextBehindSubject subjectSrc={staticFile('subject.webm')} plateSrc={staticFile('plate.webm')}>
  <GiantBehindText text="QUATRO ANOS" />
</TextBehindSubject>
```

Duas regras não óbvias:
1. Anime `opacity` do **wrapper**, nunca do `<video>` (frameworks forçam
   `opacity:1` em clipes ativos e sobrescrevem silenciosamente).
2. Os dois vídeos começam em t=0 para decodificar em sincronia. Montar o cutout
   depois causa seek e 1 frame de desalinhamento no corte.
3. Se o cutout fica sobre o **próprio** mp4 de origem, encode em qualidade
   máxima — senão aparece shift de cor na borda.

Como gerar o `subject.webm` sem hyperframes: `scripts/segment.py` (máscara por
frame) + FFmpeg para VP9 `yuva420p`. **Nunca** mascare por frame no browser.

## Como evoluir o catálogo

1. Rode `reverse_engineer.py` na referência nova → veja quais frames são animação.
2. Rode `analyze_motion.py` em cada trecho → meça entrada, pico, paleta.
3. Abra o frame nativo (PNG) para ler tipografia, caixa, borda.
4. Acrescente um padrão em `catalog.md` (nome, onde foi visto, números, regra).
5. Implemente em `motion-kit.tsx` como componente com props.
6. Anote desvios em "Pegadinhas" se algo quebrar na prática.
