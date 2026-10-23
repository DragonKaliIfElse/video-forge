# Referências

## Referências analisadas (engenharia reversa)

Localização: `~/pi_video/ref/`

| Arquivo | Título | Specs | O que ensinou |
|---|---|---|---|
| `ref-motion.mp4` | EDIÇÃO MOTION COM CLAUDE OPUS 5.5 | 854×480, 23.98fps, 17:52 | texto gigante atrás do sujeito, dot grid, sparkles, caixa tracejada, cards de marca `#01a6a2`, contador com fantasma, chips |
| `ref-edicao.mp4` | Você não precisa saber editar vídeos | 854×480, 30fps, 10:35 | legenda documental sem caixa, letterbox + viewfinder, kicker em caps, palavra-âncora rosa/verde |

Análise completa em [`catalog.md`](./catalog.md). Frames nativos amostrados em
`~/pi_video/ref/nat-*.png`; contact sheets em `~/pi_video/ref/sheet-*/`.

## Docs locais (skill `remotion-best-practices`)

Base: `~/.pi/skills/remotion-best-practices/`

| Tema | Arquivo |
|---|---|
| Legendas (transcrever/exibir/importar SRT) | `remotion-captions/*.md` |
| Transições | `remotion-markup/transitions.md` |
| Efeitos WebGL | `remotion-markup/effects.md` |
| Animação (interpolate, easing, perceptual-scale) | `remotion-markup/timing.md` |
| Timeline de clipes | `remotion-markup/video-editing.md` |
| Vídeo embutido | `remotion-markup/embedding-videos.md` |
| Crop/zoom em região | `remotion-markup/cropping.md` |
| Multi-cena | `remotion-markup/multi-scene-video.md` |
| Layout e safe area | `remotion-create/video-layout.md` |
| Render | `remotion-render/REFERENCE.md` |

## Elements oficiais (copiar o .tsx)

- Legendas: https://www.remotion.dev/elements/captions/
  (Basic, Rounded, Moving Pill, Popping Word, Word Highlight)
- Dados: https://www.remotion.dev/elements/data/
  (Horizontal/Vertical Bar Chart, Line Chart, Pie Chart, Number Counter)
- Formas: `@remotion/shapes` · linhas animadas: `@remotion/paths`

## APIs-chave

- `createTikTokStyleCaptions()` — pagina tokens estilo TikTok
  (`combineTokensWithinMilliseconds`, `breakOnSilenceAfterMilliseconds`)
- Tipo `Caption` (`@remotion/captions`): **`text` leva espaço antes da palavra**
- `fitText()` (`@remotion/layout-utils`) — ajusta fonte ao container
- `loadFont()` (`@remotion/google-fonts/*`) — determinístico no render

## Componentes de terceiros (opcional)

- Agent Motion `data-table` (MIT): `npx @agent-motion/cli add data-table@0.3.1`
- catálogo: https://agent-motion.com/

## Templates

- `npx create-video@latest --tiktok` — vídeo + legendas palavra-a-palavra
- galeria: https://www.remotion.dev/templates

## Ferramentas locais do ambiente

| Ferramenta | Uso |
|---|---|
| FFmpeg 9.0.2 | decode, encode, concat, máscaras, pré-composição |
| `~/pi_video/.venv` | faster-whisper, mediapipe 0.10.14, opencv, numpy<2 |
| `~/pi_video/models/` | hand_landmarker, pose_landmarker, selfie_segmenter |
| pi-media (`media_*`) | probe, contact sheet, áudio EBU R128, render/review |
| pi-speech (`speech_*`) | ASR/TTS local (apps desktop — checar se estão no ar) |

> `media_scene_detect` exige FFmpeg com ONNX Runtime — o build desta máquina
> não tem. Alternativa usada: `ffmpeg -vf "select='gt(scene,0.25)',showinfo"`
> para cortes grosseiros, e `reverse_engineer.py` para triagem por conteúdo.

## Origem dos exemplos deste pacote

- `examples-v2/motion-kit.tsx` — implementação dos padrões medidos nas duas
  referências (números em `catalog.md`).
- `examples/01` — Element "Word Highlight Captions" + ponte pi-speech→`Caption[]`.
- `examples/05` — Element "Number Counter".
- `examples/06` — Element "Vertical Bar Chart".
- `examples/07` — `SlideInPresentation` e `LightLeakOverlay` são os padrões do
  docs oficial de transições.
