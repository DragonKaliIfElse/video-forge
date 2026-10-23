# O que já existe pronto (pesquisa de 2026-10)

Antes de escrever componente novo, verifique aqui. Muita coisa boa é MIT e
instalável como *source* (você fica com o código).

---

## 1. Onda — 70 componentes + 18 transições (MIT) ⭐ mais relevante

`degueba/onda` · https://remotion.onda.video/components

```bash
npx ondajs add fade-in        # copia .tsx + schema + README para o seu projeto
```

Instala como **source** (não é dependência runtime). Categorias:

| Categoria | Nº | Destaques |
|---|---|---|
| Entrances | 15 | fade, slide, scale, rotate, mask, blur, typewriter, word-stagger, matrix-decode |
| Interface | 15 | code-block, terminal, browser-frame, device-frame, cursor, pricing-card, kanban, bento-grid |
| Graphics | 12 | underline, highlight, callout, draw-on, shimmer-sweep, rgb-glitch-text, confetti, bounding-box |
| Data | 7 | counters, bar, line, pie, progress, timeline, captions |
| Scenes | 7 | title card, lower third, stat card, quote card, chapter card, end card, logo sting |
| Atmosphere | 5 | mesh-gradient, **dynamic-grid**, gradient-shift, **grain-overlay**, vignette |
| Cinematic | 5 | **Ken Burns**, parallax, shake, spotlight, marquee |
| Media | 4 | video-clip, audio-clip, audio-visualizer, captions |
| Transitions | 18 | crossFade, morph, wipe, clockWipe, iris, flip, slide, push, depthPush, zoom, chromaticAberration, gridPixelate, glassWipe, typeMask, devicePullback, expandMorph, blur, dipToColor |

### A motion language deles (vale copiar os números)

Fonte: `lib/motion.ts` — tokens fechados, nenhum componente inventa valores.

```ts
DURATION = { instant: 6, fast: 10, base: 18, slow: 24, slower: 30, hold: 45 } // frames @30fps
STAGGER = 4                    // frames entre irmãos
OVERSHOOT = 0.03               // 3% no heroReveal
SPRING_SMOOTH = { damping: 200, stiffness: 100, mass: 1 }   // casa
SPRING_SNAPPY = { damping: 120, stiffness: 180, mass: 1 }   // contadores
HOUSE_EASE = cubic-bezier(0.16, 1, 0.3, 1)
SHUTTER = { angle: 180, samples: 10 }   // motion blur
```

Regras deles (docs/motion-language.md):
- **Spring sobre `interpolate`** para posição/escala/rotação.
- Escala/rotação nunca com ease linear.
- Entradas 18–28 frames; saídas 12–18 (mais rápidas que a entrada).
- **Travel pequeno**: 12–24px, não 80px.
- Stagger 3–5 frames.
- Sempre `extrapolateLeft/Right: 'clamp'`.
- "Quando em dúvida, mais calmo e minimal, não mais chamativo."

**Comparação com as nossas referências:** as deles são mais lentas (base 0.6s)
porque são para vídeo institucional. As referências de talking-head usam
**entradas de 6–8 frames** (0.2–0.27s) — mais rápidas, ritmo de corte de fala.
Não misture: escolha uma cadência por projeto.

---

## 2. Text Behind Subject — o efeito-assinatura, pronto

- **21st.dev** (MIT): `21st.dev/@21st/components/text-behind-subject`
  `npx shadcn@latest add "https://21st.dev/r/21st/text-behind-subject?api_key=..."`
  Requer API key do 21st (plano grátis tem limite diário).
- **hyperframes** (`heygen-com/hyperframes`): guia completo de remoção de fundo
  para o padrão text-behind-subject. O melhor material técnico que achei.

### Receita técnica do hyperframes (o que importa)

```bash
npx hyperframes remove-background subject.mp4 -o transparent.webm   # VP9 alpha
npx hyperframes remove-background subject.mp4 -o transparent.mov    # ProRes 4444
npx hyperframes remove-background subject.mp4 -o subject.webm \
  --background-output plate.webm                                     # cutout + placa
```

Modelo: `u2net_human_seg` (Apache-2.0).

**Qualidade (`--quality`)** controla só o CRF do VP9:
`fast`=30 · `balanced`=18 (default) · `best`=12.
Use `best` quando o cutout fica sobre o **próprio** mp4 de origem
(é o caso de text-behind-subject), senão aparece shift de cor/borda.

**As 2 regras não óbvias:**
1. Envolva o vídeo do cutout num `<div>` **sem** atributos de timing e anime a
   `opacity` do wrapper — nunca do `<video>`. Frameworks forçam `opacity:1` em
   clipes ativos e isso sobrescreve silenciosamente a sua animação.
2. Os **dois** vídeos devem começar em t=0 (`data-start=0`, `data-media-start=0`)
   para decodificar em sincronia. Montar o cutout depois causa seek e
   desalinhamento de 1 frame no corte.

**Camadas (`--background-output`)** — para conteúdo entre pessoa e fundo:

| Arquivo | Alpha | Uso |
|---|---|---|
| `subject.webm` | máscara (pessoa opaca) | camada de cima |
| `plate.webm` | máscara inversa (fundo opaco, buraco na pessoa) | camada de baixo |

É **hole-cut, não inpaint**: o buraco é transparente, precisa de algo opaco
embaixo. Para "sala vazia" de verdade precisa de inpainter (LaMa, ProPainter,
E2FGVI) — outro problema.

**Template canônico de 3 camadas:**
```
z=1  plate.webm      (entorno opaco, silhueta transparente)
z=2  TEXTO/GRAFICOS  (vive entre as camadas)  ← o efeito
z=3  subject.webm    (pessoa flutua por cima)
```

### Como fazer isso no Remotion (sem hyperframes)

O equivalente com o que já temos:
1. `tools/segment.py` gera a máscara por frame (MediaPipe Selfie Segmenter).
2. FFmpeg compõe `subject.webm` (VP9 `yuva420p`) e `plate` (máscara invertida).
3. No Remotion, três camadas na ordem acima. Texto em `z=2`; nada de mascarar
   vídeo por frame no browser (já pagamos esse erro: 2745 PNGs → 404 no bundle).

---

## 3. Outras fontes úteis

| Fonte | O que tem | Licença |
|---|---|---|
| `remocn.dev/docs/typography` | catálogo de tipografia kinética: reveals, highlights, glitch, marquee, **trim paths em glifos reais**, type on a path, striped type | registry |
| `21st.dev` | catálogo grande de componentes de vídeo (precisa API key) | MIT |
| `agent-motion.com` | `data-table`, `animated-counter`, `progress-ring` | MIT |
| `counterscale`/Element Remotion | captions, charts, number counter | oficial |

---

## 4. O que o ecossistema pi já resolve (não reimplementar)

| Necessidade | Ferramenta pi | Observação |
|---|---|---|
| Edição não-destrutiva + proveniência | `pi-media` (`edit_apply`, `render`, `review`) | EDL imutável, hash, receipt |
| Contato visual/waveform | `media_contact_sheet`, `media_audio_analyze` | visual, não prova emoção |
| ASR/TTS local | `pi-speech` | apps desktop; checar se estão no ar |
| Corte semântico de talking-head | `pi-talking-head` | word boundaries, B-roll, BGM |
| Transcrição barata / word timestamps | `speech_transcribe` | se indisponível → `faster-whisper` (script nosso) |
| Detecção de cena | `media_scene_detect` | **precisa FFmpeg com ONNX runtime** — ausente nesta máquina |

**Limite:** pi-media faz corte/EDL/proveniência; **não faz motion design**.
Animações são Remotion. A ponte é: pi-media decide o EDL → Remotion desenha →
`review` valida. Não tente fazer animação dentro do pi-media.

---

## 5. Decisão recomendada

1. **Kits de terceiros** (`npx ondajs add ...`) para o que é commodity:
   entrances, transitions, browser-frame, captions, grain, vignette.
2. **Nosso `motion-kit.tsx`** para o que é assinatura das referências e não
   existe pronto: `GiantBehindText` (text-behind-subject com nossa segmentação),
   `DotGrid` + `Sparkle`, `BrandCard` com linha invertida, `CounterSlam` com
   fantasma, `ChipRow` irregular, `DocCaption` com kicker+âncora, `ViewfinderFrame`.
3. **Adotar os tokens do Onda** (`DURATION`, `STAGGER`, `HOUSE_EASE`) mas com uma
   variante "talking-head" mais rápida (`ENTRY_FAST = 7` frames) porque nossas
   referências cortam no ritmo da fala.

---

## Fontes

- https://github.com/degueba/onda · https://remotion.onda.video/components
- https://github.com/heygen-com/hyperframes (skills/media-use/.../remove-background.md)
- https://21st.dev/@21st/components/text-behind-subject
- https://remocn.dev/docs/typography
- https://agent-motion.com/components/data-table
- https://www.remotion.dev/elements/captions · /elements/data
