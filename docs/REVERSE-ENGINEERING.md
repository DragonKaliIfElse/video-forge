# Engenharia reversa de estilo

Como extrair o vocabulário visual de um vídeo de referência e transformá-lo em
componentes. Processo usado para analisar duas referências reais e produzir o
[`CATALOG.md`](CATALOG.md).

---

## A regra que muda tudo: use frame NATIVO

**Um contact sheet engana.** Um thumbnail de 320px de uma fonte 480p desloca a
cor (compressão + downscale) e o tamanho da tipografia. Cor medida em thumb não
serve como token de design.

Descobri isso tarde: havia anotado `#14b8a6` como cor de marca; medindo no
frame nativo era `#01a6a2`. E só no frame nativo apareceram o **grid de pontos**,
os **sparkles**, o **texto atrás da pessoa** e a **caixa tracejada** — nada
disso era visível no thumb.

---

## Passo 1 — Triagem

Para vídeos longos (10–18 min), primeiro descubra **onde** há animação:

```bash
python scripts/reverse_engineer.py ref.mp4 --samples 24 \
  --out /tmp/triagem.md --frames-dir /tmp/frames
```

Saída: tabela com, por amostra, o **tipo** (`texto-sobre-escuro`,
`card-colorido`, `monocromatico`, `fundo-claro`), a paleta top-4 e o bounding
box do conteúdo claro.

```
  23.30s  card-colorido    claro=0.02 escuro=0.02 cor=0.96  #01a6a2 #00a4a0 #022b2a
  33.50s  texto-sobre-escuro claro=0.09 escuro=0.74 cor=0.06 #08090c #1d191a #fcfbfb
```

`card-colorido` com `cor=0.96` = tela chapada de marca. `texto-sobre-escuro`
com `claro=0.09` = texto grande. Já dá para priorizar o que abrir.

---

## Passo 2 — Medir a animação

```bash
python scripts/analyze_motion.py ref.mp4 --from 23.2 --to 25.6 --thresh 240
```

Três medidas de uma vez:

### a) Paleta (k-means em RGB)
Não é leitura de um pixel: agrupa em 6 clusters e reporta a fração.
```bash
python scripts/analyze_motion.py ref.mp4 --palette-at 23.3
# #01a6a2  90.4%   ← a cor de marca, dominante no card
# #ebfafc   2.0%   ← o branco do texto
```

### b) Curva de movimento
O bounding box do conteúdo claro **por frame** revela a entrada:
```
f000 w=503   ← 1º frame com conteúdo
f005 w=626   ← crescendo
f008 w=635   ← pico
f009 w=636 ...
  entrada ≈ 8 frames (334ms) até estabilizar
  largura de pico: 716px (84% da largura)
```
Isso te dá **duração da entrada** (8 frames) e **tamanho** (84% da largura)
sem adivinhar.

### c) Bordas
```bash
python scripts/analyze_motion.py ref.mp4 --probe-border 10
# cantos, colunas claras na linha do meio (moldura?), linhas claras na coluna do meio
```
Foi assim que a moldura/viewfinder da referência E apareceu.

---

## Passo 3 — Ler o frame nativo

Para tipografia, caixa, borda, sombra — só olhando.

```bash
ffmpeg -y -ss 33.5 -i ref.mp4 -frames:v 1 ref/nat-33.5.png
```

Depois extraia os detalhes com medição:

```python
# cor de um pixel específico
img[240, 427]           # → [1, 166, 162]  = #01a6a2

# onde está o texto? bbox dos pixels claros
mask = img.min(axis=2) > 200
ys, xs = np.where(mask)  # → dá x0,x1,y0,y1 e o tamanho em % do frame
```

---

## Passo 4 — Registrar no catálogo

Cada padrão entra em `CATALOG.md` com **números**, não adjetivos:

```markdown
### P01 — Giant Behind (texto atrás do sujeito)
- tamanho: 0.24×h (~115px @480p), bold 800, caixa alta, letter-spacing -0.05em
- posição: baseline em 0.30×h, centralizado; ATRÁS do sujeito
- entrada: scale 0.9→1 + opacity 0→1 em 6 frames, Easing.out(expo)
- saída: corte seco
- visto: "PER…NHO", "QUATRO ANOS", "DESCULPA", "MUITO BOM"
```

"bonito e impactante" não é implementável. "0.24×h, 6 frames, expo" é.

---

## Passo 5 — Implementar e validar

1. Componente em `motion-kit.tsx` com props.
2. Renderize um frame no instante certo e compare com a referência.
3. Se divergir, meça de novo — não "ajuste no olho" sem número.

---

## O que NÃO copiar das referências

Nem tudo que aparece deve virar componente. Coisas que identifiquei e
**descartei** por serem circunstanciais:

- Dissolve entre cenas de fala (a referência usa corte seco; o dissolve era
  acidente de edição)
- Zoom lento tipo Ken Burns (uma vez só, sem propósito narrativo)
- Emojis e setas desenhadas (datam rápido)
- Transições 3D (flip, clock wipe) — a referência que tem é institucional, não
  talking-head

Registrar o que **não** entra é tão importante quanto o que entra: evita o
catálogo virar um depósito.

---

## Ferramentas

| Script | Quando usar |
|---|---|
| `reverse_engineer.py` | triagem de vídeo longo (>5 min) |
| `analyze_motion.py --palette-at T` | cor de marca / paleta de um card |
| `analyze_motion.py --from T --to T` | duração e tamanho de uma animação |
| `analyze_motion.py --probe-border T` | moldura, letterbox, padding |
| `ffmpeg -ss T -frames:v 1` | tipografia, caixa, sombra (olho humano) |

## Limites

- **Motor de animação**: consigo medir entrada e tamanho; `Easing` exato é
  inferido pelo formato da curva (`expo` vs `spring`). Para precisão total,
  extraia ~10 frames consecutivos e compare a curva.
- **Fontes**: identifico o peso e o comportamento tipográfico, não a família.
  Chute informado por semelhança (ex.: "parece Inter Bold / Montserrat").
- **Áudio/SFX**: não analisado por esses scripts (o `media_audio_analyze` do
  pi-media cobre loudness e waveform, não reconhecimento de SFX).
