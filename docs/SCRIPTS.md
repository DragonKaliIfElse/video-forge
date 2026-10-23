# Scripts

Duas famílias: **análise de referência** (sem dependências além de numpy+ffmpeg)
e **pipeline de vídeo falado** (precisa de venv com faster-whisper e mediapipe).

## A. Análise de referência

Sem dependências Python além de `numpy`. Só precisa de `ffmpeg` no PATH.

| Script | Para quê | Exemplo |
|---|---|---|
| `reverse_engineer.py` | triagem de vídeo longo: quais frames têm animação, paleta e tipo de cada um | `python reverse_engineer.py REF.mp4 --samples 24 --out triagem.md` |
| `analyze_motion.py` | medição fina: paleta (k-means), curva de entrada/saída, bordas | `python analyze_motion.py REF.mp4 --from 23.2 --to 25.6` |

```bash
# triagem inicial
python reverse_engineer.py ~/ref.mp4 --samples 20 --out /tmp/triagem.md \
  --frames-dir /tmp/ref-frames

# medir uma animação específica (frames até estabilizar + largura de pico)
python analyze_motion.py ~/ref.mp4 --from 23.2 --to 25.6 --thresh 240

# paleta de um card de marca
python analyze_motion.py ~/ref.mp4 --palette-at 23.3

# moldura / letterbox
python analyze_motion.py ~/ref.mp4 --probe-border 10
```

**Por que frame nativo e não contact sheet:** um thumb de 320px de uma fonte
480p desloca paleta e tamanho. Cor medida em thumb não serve para token de design.

## B. Pipeline de vídeo falado

Precisa de venv (exemplo em `~/pi_video/.venv`):

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python faster-whisper "mediapipe==0.10.14" "numpy<2" opencv-python
```

> `mediapipe` 1.1.x foi morto por OOM ao criar o landmarker nesta máquina.
> `0.10.14` + `numpy<2` funciona. Fixe essas versões.

| Script | Faz | Ordem |
|---|---|---|
| `transcribe.py` | faster-whisper com word timestamps → `transcript.json` | 1 |
| `plan_cuts.py` | Silero VAD + proteção de palavra → `cuts.json`, `silences.json` | 2 |
| `apply_cuts.py` | aplica cortes via concat demuxer → `cut.mp4` | 3 |
| `segment.py` | silhueta do sujeito por frame (selfie segmenter) → `masks/*.png` | opcional |
| `track.py` | 21 pontos de mão + pose por frame → `tracking.jsonl` | opcional |

```bash
V=.venv/bin/python
$V transcribe.py input/video.wav 100
$V plan_cuts.py input/video.wav input/transcript.json 100
$V apply_cuts.py
$V segment.py     # para o efeito "texto atrás do sujeito"
$V track.py input/video.mp4 input/tracking.jsonl
```

### Notas de operação

- **`transcribe.py`** decodifica via FFmpeg e passa array para o modelo — evita
  a incompatibilidade PyAV/`metadata_errors` do faster-whisper.
- **`plan_cuts.py`** usa Silero VAD (neural), não energia RMS. Heurística de
  energia classificou 62% da fala como silêncio na prática; VAD não.
  Rejeita corte que engole >50% de uma palavra transcrita.
- **`apply_cuts.py`** gera um arquivo por trecho e concatena (mais robusto que
  um filter_complex com 35 entradas). Depois normalize com `-vf fps=30` — o
  concat demuxer deixa `r_frame_rate` estranho no container.
- **`track.py`** grava JSONL em streaming (memória constante). Rodar com step=1
  custou ~12 min para 100s em CPU.
- **`segment.py`**: `category_mask` já vem 0/255 (255=pessoa). Não compare `== 1`.

## C. Efeito text-behind-subject

| Script | Faz |
|---|---|
| `segment.py` | máscara por frame (**pessoa=0 preto, fundo=255**) |
| `bake_text_behind.py` | pré-compõe vídeo + texto + recorte → MP4 opaco |
| `make_layers.py` | tenta gerar subject/plate em VP9 alpha (ver aviso) |

```bash
V=.venv/bin/python
$V segment.py public/cut.mp4 public/mask-cut     # 1. máscara
$V bake_text_behind.py public                     # 2. pré-compõe
```

**Aviso VP9:** a build 9.0.2 desta máquina **descarta o alpha** no encode VP9
(`pix_fmt` sai `yuv420p`, decoder devolve alpha=255). `make_layers.py` roda mas
o resultado é opaco. Para WebM transparente seria preciso outra build de FFmpeg
ou `ffmpeg -c:v libvpx-vp9 -pix_fmt yuva420p` com `-auto-alt-ref 0` **e** um
encoder que respeite alpha. Enquanto isso, `bake_text_behind.py` é o caminho
confiável: compõe tudo em FFmpeg e entrega MP4.

## Descobertas que custam tempo (não repetir)

1. **A máscara é invertida.** MediaPipe Selfie Segmenter: **pessoa = 0**,
   fundo = 255. Sem `negate`, o recorte pega a parede e o texto fica na frente.
2. **`geq` aceita uma entrada só.** Use `alphamerge`.
3. **VP9 desta build perde alpha.** Pré-componha em MP4.
4. **Nunca** 2000+ PNGs em `public/` para máscara por frame (404 no bundle).
   Pré-componha ou use um vídeo de máscara.
5. **`useCurrentFrame()` em `<Sequence>` é local** — some o offset.
6. Sempre extraia **um frame** do efeito antes de compor 90s.
