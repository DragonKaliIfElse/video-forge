# Arquitetura — por que cada peça existe

O sistema tem três camadas com fronteiras nítidas. Misturá-las causou a maior
parte dos problemas.

```
┌─────────────────────────────────────────────────────────────┐
│  1. ANÁLISE  (Python, CPU/GPU)                              │
│     áudio → fala → cortes → máscaras → landmarks            │
│     FFmpeg + faster-whisper + MediaPipe                     │
└──────────────────────────┬──────────────────────────────────┘
                           │  JSON + MP4 (assets)
┌──────────────────────────▼──────────────────────────────────┐
│  2. COMPOSIÇÃO  (TypeScript/React)                          │
│     cues → camadas → animação → frames                      │
│     Remotion                                                 │
└──────────────────────────┬──────────────────────────────────┘
                           │  MP4
┌──────────────────────────▼──────────────────────────────────┐
│  3. ENTREGA  (proveniência)                                 │
│     revisão técnica, hash, receipt                          │
│     pi-media (review / render)                              │
└─────────────────────────────────────────────────────────────┘
```

**Contrato entre camadas:** a análise só produz **dados**. A composição só
**desenha**. A entrega só **verifica**. Nenhuma camada chama a outra por dentro.

---

## Por que Python para análise

- `faster-whisper`, `mediapipe` e `opencv` são Python-first.
- FFmpeg faz o trabalho pesado; Python orquestra.
- Streaming para disco (JSONL) mantém memória constante em vídeos longos —
  acumular 3000 frames de landmarks em RAM matou o processo (OOM).

## Por que Remotion para composição

- Animação em React é determinística por frame: `useCurrentFrame()` → mesmo
  output sempre. Isso torna o render reproduzível e o preview fiel.
- Props editáveis no Studio permitem ajustar sem recompilar.
- Alternativa (FFmpeg puro) não faz tipografia com easing, nem 21 pontos
  animados, nem layout responsivo.

## Por que FFmpeg pré-compõe o text-behind

Três motivos, todos medidos:

1. **Bundle**: 2750 PNGs em `public/` → 404 em arquivos que existem no disco.
2. **Alpha**: a build de VP9 daqui descarta transparência silenciosamente.
3. **Render**: um `<Video>` opaco renderiza muito mais rápido que 2750
   operações de máscara CSS por frame.

O custo é rigidez: mudar o texto do efeito exige re-render em FFmpeg. Aceitável
porque o texto atrás do sujeito é definido no roteiro, não ajustado no Studio.

---

## Fluxo de dados

```
video.mp4
   │
   ├─ ffmpeg → work/audio.wav (16k mono)
   │            │
   │            ├─ faster-whisper → transcript.json  {words: [{text, beginMs, endMs}]}
   │            └─ Silero VAD    → silences.json     [{startMs, endMs, durationMs}]
   │                    │
   │                    └─ plan_cuts → cuts.json     {regions: [{startMs,endMs,outStartMs,outEndMs}]}
   │
   ├─ apply_cuts → cut.mp4  (concat dos trechos)
   │
   ├─ make_words → words.json  (palavras no tempo de SAÍDA)
   │
   ├─ segment → masks/NNNNN.png  (pessoa=0, fundo=255 → inverter!)
   │
   ├─ track → tracking.jsonl → make_hands → hands.json  (subsample 2 = 15fps)
   │
   └─ bake_text_behind → text-behind.mp4  (pré-composto)
            │
            ▼
      assets/  →  remotion/public/
            │
            ▼
      Remotion (Main.tsx + CUES + motion-kit)
            │
            ▼
      final.mp4
```

### Formatos, e por quê

| Arquivo | Formato | Por quê |
|---|---|---|
| `transcript.json` | `{words:[{text,beginMs,endMs}]}` | compatível com pi-speech e `@remotion/captions` |
| `cuts.json` | regiões **a manter** (não a cortar) | mais fácil de validar; complemento é trivial |
| `words.json` | `{durationMs, words}` | já no tempo final, pronto para legendas |
| `hands.json` | `{durationMs, frames:[{t,hands,pose}]}` | subsample reduz 5 MB → 2 MB |
| `tracking.jsonl` | 1 linha/frame | streaming: memória constante |

---

## Decisões de design do kit

### Tokens fechados

Todo número (duração, stagger, easing) vem de `T` e `ENTRY`. Nenhum componente
inventa valores. É o que faz o conjunto parecer uma linguagem e não uma coleção.

Fonte: a "motion language" do [Onda](ECOSYSTEM.md), adaptada — eles usam
`base: 18f` (0.6s) para institucional; nossas referências de talking-head usam
`base: 7f` (0.23s) porque o corte segue a fala.

### Dois regimes de cadência

```ts
ENTRY['institutional'] = {fast:10, base:18, slow:24, stagger:4}
ENTRY['talking-head']  = {fast:6,  base:7,  slow:10, stagger:5}
```

Escolha um por projeto. Misturar faz o vídeo parecer inconsistente.

### Componentes como fonte, não dependência

`motion-kit.tsx` é copiado para `src/components/`, não instalado como pacote.
Você pode editar. Foi a razão de não usarmos só `ondajs`: precisávamos de
componentes que não existem (text-behind com nossa segmentação, caption
documental, ancoragem em mão).

---

## Onde a automação para (de propósito)

| Automatizado | Manual |
|---|---|
| transcrição | escolher **qual padrão** para cada fala |
| detecção de silêncio | aprovar os cortes |
| remapeamento de tempo | definir os CUES (ms) |
| máscaras e landmarks | compor a cena |
| pré-composição do efeito | revisar o frame renderizado |

A parte manual é **julgamento editorial**: qual palavra merece impacto, quando
a mão deve ancorar conteúdo. Automatizar isso produz vídeo genérico.

---

## Limites conhecidos

1. **`make_layers.py`** (VP9 alpha) não funciona nesta build de FFmpeg. Ficou
   no repositório como referência do que *seria* o caminho ideal.
2. **CUES manuais** — não há script de "fala → cue". O `WORKFLOW.md` mostra o
   snippet que agrupa frases e imprime os tempos.
3. **Um projeto por vez** — `Main.tsx` tem CUES hardcoded por vídeo.
   Generalizar exigiria CUES em JSON por projeto (melhoria futura).
4. **Só talking-head** — o pipeline assume um sujeito principal na câmera.
   Multi-câmera ou b-roll puro precisa de outra abordagem.
