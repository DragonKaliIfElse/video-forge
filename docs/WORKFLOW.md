# Workflow — do vídeo bruto ao vídeo animado

Processo completo, na ordem em que as decisões precisam ser tomadas. Cada passo
tem um **porquê** — não é receita cega.

---

## Passo 0 — Antes de tudo: entenda o vídeo

```bash
# metadados
ffprobe -v error -show_entries stream=codec_type,width,height,r_frame_rate \
  -show_entries format=duration -of json video.mp4

# dezenas de frames nativos para triagem (NÃO contact sheet: thumb engana cor)
python skills/video-anim-recipes/scripts/reverse_engineer.py video.mp4 \
  --samples 24 --out /tmp/triagem.md --frames-dir /tmp/frames
```

**Decisão:** é talking-head (pessoa falando) ou outro formato? Este pipeline é
otimizado para talking-head. Para b-roll sem fala, pule direto ao Remotion.

---

## Passo 1 — Pipeline automático

```bash
.venv/bin/python skills/video-anim-recipes/scripts/forge.py run \
    video.mp4 --project workspaces/meu-video
```

Isso roda 9 etapas (~25 min para 100s de vídeo em CPU). Para iterar rápido
enquanto você ainda está decidindo o estilo:

```bash
# só análise: transcrição + cortes, sem máscaras/tracking (~2 min)
... forge.py analyze video.mp4 --project workspaces/meu-video
```

### O que cada etapa faz e por quê

| Etapa | Por quê |
|---|---|
| **transcribe** | word timestamps são a base de tudo: legendas, cortes e cues |
| **plan-cuts** | Silero VAD (neural) em vez de energia RMS — energia classificou 62% da fala como silêncio na prática |
| **apply-cuts** | concat demuxer por trecho; um filter_complex com 35 entradas falha no linking |
| **words** | as palavras precisam do tempo de **saída**, não de origem |
| **segment** | máscara por frame para o "texto atrás do sujeito" |
| **track** | 21 pontos de mão para overlay e ancoragem de conteúdo |
| **text-behind** | pré-compõe em FFmpeg: mascarar no browser estoura o bundle |
| **assets** | junta tudo no formato que o Remotion espera |

---

## Passo 2 — Corte: confira antes de aceitar

O VAD propõe cortes; **você aprova**. Verifique:

```bash
python - <<'EOF'
import json, subprocess, numpy as np
cuts = json.load(open('workspaces/meu-video/cuts.json'))
print(f"{len(cuts['regions'])} regiões | "
      f"cortado {cuts['removedMs']/1000:.2f}s de {cuts['sourceDurationMs']/1000:.2f}s")
# amostra de energia nas junções: energia alta antes = possível fala cortada
EOF
```

Regras que o `plan_cuts.py` já aplica:
- rejeita corte que engole >50% de uma palavra transcrita
- mantém 60ms de respiro nas bordas
- usa o **Silero VAD** como fonte de borda (o timestamp do Whisper é frouxo)

> Cuidado com o instinto de "100ms é agressivo". Foi validado: 35 cortes em
> 104s, 12.4s removidos, sem perda audível.

---

## Passo 3 — Mapear os CUES (a parte manual)

Aqui a automação para. Você precisa decidir **onde** vai cada animação.

```bash
cd workspaces/meu-video
python - <<'EOF'
import json
w = json.load(open('words.json'))['words']
# agrupa em frases por pausa > 400ms
g, cur = [], []
for x in w:
    if cur and x['beginMs'] - cur[-1]['endMs'] > 400:
        g.append(cur); cur = []
    cur.append(x)
if cur: g.append(cur)
for s in g:
    print(f"[{s[0]['beginMs']/1000:6.2f}-{s[-1]['endMs']/1000:6.2f}] "
          f"{' '.join(i['text'] for i in s)}")
EOF
```

Saída típica:
```
[  0.92-  8.10] Ok, estou gravando esse vídeo aqui para testar todas as transições
[  8.88- 13.85] quando eu estalar esse dedo agora, eu quero que todo o recorte...
[ 14.61- 22.61] ele seja cortado e eu consiga editar o fundo, coloque um roxo...
```

Agora escolha o padrão para cada trecho, seguindo [`CATALOG.md`](CATALOG.md):

| O que a fala faz | Padrão sugerido |
|---|---|
| nomeia um conceito com força | `GiantBehindText` atrás do sujeito |
| uma palavra de impacto | `PunchWord` |
| afirma tese em 3 níveis | `BrandCard` |
| dá um número | `CounterSlam` |
| lista ideias | `ChipRow` |
| narra continuamente | `DocCaption` |
| pede prova visual | miniatura + `DynamicTable` |
| fala de mãos/dedos | `HandOverlay` + `HandAnchoredBox` |

**Regra:** a animação dura 1.0–2.6s e começa **na palavra**, não no início da frase.

---

## Passo 4 — Editar a composição

```bash
cp workspaces/meu-video/assets/* remotion/public/
cd remotion && npm run dev
```

Edite `src/lib/data.ts` (CUES + lista de recursos) e `src/Main.tsx`
(`<Sequence>` por cue).

```ts
export const CUES = {
  bodyMaskOn: 14600,   // ms no vídeo final
  purpleOff: 22600,
  captionsOn: 30700,
  // ...
} as const;
```

**Pegadinha:** dentro de `<Sequence>`, `useCurrentFrame()` é **local**. Some o
offset ao calcular tempo absoluto (o kit já expõe `offsetMs`).

---

## Passo 5 — Render e revisão

```bash
npx remotion render Main out/final.mp4

# revisão técnica com proveniência (se estiver no ecossistema pi-media)
media_probe out/final.mp4
review out/final.mp4
```

Verificação visual obrigatória — extraia um frame de cada cue:

```bash
for t in 19 34 50 66 86; do
  ffmpeg -y -v error -ss $t -i out/final.mp4 -frames:v 1 /tmp/f_$t.png
done
```

E olhe. Screenshot é a única forma honesta de saber se a animação está certa.

---

## Ciclo de refinamento

1. Rode o pipeline em um vídeo **real** (não fixture).
2. Anote tudo que doeu.
3. Se for um bug → `docs/LESSONS.md`.
4. Se for um padrão novo → `docs/CATALOG.md` + `motion-kit.tsx`.
5. Se for uma decisão de processo → este arquivo.

O objetivo não é um sistema "completo" no papel, é um sistema que **já foi
usado** e por isso tem as cicatrizes documentadas.

---

## Quando pular etapas

| Situação | Comando |
|---|---|
| só quero ver a transcrição | `forge.py analyze ...` |
| não preciso de mão nem texto atrás | `--skip track,segment,text-behind` |
| já tenho `cut.mp4` | `--skip transcribe,plan-cuts,apply-cuts` |
| vídeo sem fala (b-roll) | pule o pipeline inteiro, vá ao Remotion |
| máscara já existe | `--skip segment` |
