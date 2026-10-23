# Video Forge

**Edição de vídeo falado com código**: corta silêncios por VAD neural, anima com
motion design medido por engenharia reversa, e entrega um MP4 reproduzível.

Feito para *talking-head* (você falando para a câmera) que vira vídeo com
legendas, texto atrás do corpo, miniaturas, tabelas e tracking de mão.

```
  vídeo falado  →  forge.py  →  assets  →  Remotion  →  MP4
                   (corta,      (json,      (anima)
                    transcreve,  vídeo,
                    segmenta,    máscaras)
                    rastreia)
```

---

## O que tem aqui

| Pasta | Conteúdo |
|---|---|
| `skills/video-anim-recipes/` | **A skill completa**: catálogo de padrões medidos, kit de componentes Remotion, scripts de pipeline e de engenharia reversa |
| `remotion/` | Projeto Remotion pronto (composição `Main` + `KitDemo`) |
| `docs/` | Workflow, arquitetura, lições aprendidas, catálogo de padrões |
| `.github/` | CI (lint + typecheck) |

---

## Começar em 5 minutos

```bash
# 1. dependências de Python (uma vez)
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python faster-whisper "mediapipe==0.10.14" "numpy<2" opencv-python

# 2. modelos (uma vez, ~13 MB)
mkdir -p models
curl -sL -o models/hand_landmarker.task     https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
curl -sL -o models/pose_landmarker.task     https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
curl -sL -o models/selfie_segmenter.tflite  https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite

# 3. checar ambiente
.venv/bin/python skills/video-anim-recipes/scripts/forge.py doctor

# 4. rodar o pipeline
.venv/bin/python skills/video-anim-recipes/scripts/forge.py run \
    meu-video.mp4 --project workspaces/meu-video

# 5. animar
cp workspaces/meu-video/assets/* remotion/public/
cd remotion && npm i && npm run dev
```

> **Por que `mediapipe==0.10.14`?** A versão 1.1.x foi morta por OOM ao criar o
> `HandLandmarker` nesta máquina (exit 137). Com `0.10.14` + `numpy<2` funciona.

---

## As duas metades

### 1. Pipeline (`forge.py`)

```bash
forge.py steps                                    # lista as etapas
forge.py run VIDEO --project WS                   # completo
forge.py analyze VIDEO --project WS               # só transcrição + cortes
forge.py run VIDEO --project WS --skip track,segment   # economiza ~15 min
```

| Etapa | O que faz | Saída |
|---|---|---|
| probe | metadados + hash | — |
| transcribe | faster-whisper com word timestamps | `transcript.json` |
| plan-cuts | Silero VAD + proteção de palavra | `cuts.json` |
| apply-cuts | concat dos trechos mantidos | `cut.mp4` |
| words | remapeia palavras para o tempo final | `words.json` |
| segment | silhueta do sujeito por frame | `masks/` |
| track | 21 pontos de mão + pose | `hands.json` |
| text-behind | pré-compõe texto atrás do sujeito | `text-behind.mp4` |
| assets | reúne tudo para o Remotion | `assets/` |

### 2. Kit de animação (`skills/.../examples-v2/motion-kit.tsx`)

13 componentes implementando os padrões medidos em duas referências reais:

`GiantBehindText` · `TextBehindSubject` · `PunchWord` · `BrandCard` ·
`CounterSlam` · `ChipRow` · `LogoLockup` · `DocCaption` · `ViewfinderFrame` ·
`DotGrid` · `Sparkle` · `DashedChip` · `HandOverlay`/`HandAnchoredBox`

Leia [`docs/CATALOG.md`](docs/CATALOG.md) para os números medidos.

---

## Documentação

- [`docs/WORKFLOW.md`](docs/WORKFLOW.md) — o processo ponta a ponta, com decisões
- [`docs/CATALOG.md`](docs/CATALOG.md) — 11 padrões de motion com medidas reais
- [`docs/LESSONS.md`](docs/LESSONS.md) — 15 armadilhas e suas causas
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — por que cada peça existe
- [`docs/ECOSYSTEM.md`](docs/ECOSYSTEM.md) — o que já existe pronto (use antes de escrever)
- [`docs/REVERSE-ENGINEERING.md`](docs/REVERSE-ENGINEERING.md) — extrair estilo de um vídeo de referência

---

## Estado

Funcional e validado: pipeline rodou em vídeo de 104s → 91.6s com 35 cortes,
2751 máscaras, 92.7% de detecção de mão, e 6 animações ancoradas na fala.

Ainda em refinamento:
- `make_layers.py` (VP9 com alpha) não funciona nesta build de FFmpeg — use
  `bake_text_behind.py`, que pré-compõe em MP4
- CUES de cada vídeo ainda são mapeados à mão (não há script de "fala → cue")

Contribuições e ajustes são bem-vindos — o objetivo é refinar com uso real.

## Licença

MIT
