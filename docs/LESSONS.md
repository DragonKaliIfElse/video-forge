# Lições aprendidas — armadilhas e suas causas reais

Cada item aqui custou tempo de debug. Nenhum é teórico.

---

## 1. A máscara do MediaPipe é invertida

**Sintoma:** o "texto atrás do sujeito" aparece na **frente** da pessoa, e o
recorte pega a parede.

**Causa:** o `Selfie Segmenter` escreve **pessoa = 0 (preto)** e **fundo = 255
(branco)**. O `alphamerge` do FFmpeg usa luminância como alpha — sem inverter,
o alpha fica no fundo.

```ffmpeg
# ERRADO — recorta o fundo
[1:v]format=gray,scale=1280:720[m]; [fg][m]alphamerge[subject]
# CERTO
[1:v]format=gray,scale=1280:720,negate[m]; [fg][m]alphamerge[subject]
```

**Como verificar em 3 segundos:**
```bash
ffmpeg -i masks/00000.png -f rawvideo -pix_fmt gray - | head -c 1000000 | xxd | head
# ou no Python: m = imagem; print('pessoa =', 'BRANCO' if m[centro] > 128 else 'PRETO')
```

---

## 2. FFmpeg desta build perde alpha no VP9

**Sintoma:** `ffmpeg -c:v libvpx-vp9 -pix_fmt yuva420p` produz `pix_fmt=yuv420p`;
o decoder devolve `alpha=255` em todos os pixels. O WebM "transparente" não tem
transparência.

**Causa:** build 9.0.2 do sistema; o encoder descarta o plano alpha
silenciosamente (não erro, só perde).

**Solução:** não depender de WebM transparente. Pré-componha o efeito em
FFmpeg (`bake_text_behind.py`) e entregue MP4 opaco ao Remotion. Mais rápido
de renderizar também.

---

## 3. `geq` aceita uma entrada só

**Sintoma:** `More input link labels specified for filter 'geq' than it has inputs: 2 > 1`

**Causa:** eu tentei passar vídeo + máscara no `geq` para combinar alpha.

**Solução:** `alphamerge` (a máscara entra como canal alpha). O `geq` fica só
para transformar o próprio frame.

---

## 4. `useCurrentFrame()` dentro de `<Sequence>` é LOCAL

**Sintoma:** legendas dessincronizadas; máscara buscando o PNG errado (404);
tracking de mão olhando o instante errado.

**Causa:** `<Sequence from={300}>` faz o frame interno começar em 0.

**Solução:** some o offset ao calcular tempo absoluto. O kit expõe `offsetMs`
para isso:
```tsx
const local = useCurrentFrame();
const tMs = (local / fps) * 1000 + offsetMs;
```

---

## 5. Milhares de PNGs em `public/` estouram o bundle

**Sintoma:** frames aleatórios falham com `404 Not Found` para
`/masks/00440.png` — o arquivo existe no disco mas o dev server não serve.

**Causa:** 2745 arquivos em `public/`; o bundler/static server não escala.

**Solução:** pré-componha em um MP4 (`bake_text_behind.py`) ou em um único
vídeo de máscara. Nunca um PNG por frame no browser.

---

## 6. Energia RMS não é detecção de silêncio

**Sintoma:** a heurística de energia classificou **62% da fala** como silêncio.
Cortaria metade do vídeo.

**Causa:** limiar adaptativo por percentil (p10 ruído, p90 fala) com
`sqrt(noise*speech)` cai no meio da distribuição da fala.

**Solução:** **Silero VAD** (neural, vem no `faster-whisper`). Ele distingue
consoante fraca de silêncio. Custo: zero (já é dependência).

```python
from faster_whisper.vad import get_speech_timestamps, VadOptions
speech = get_speech_timestamps(audio, VadOptions(min_silence_duration_ms=100), 16000)
```

---

## 7. Timestamp do Whisper é frouxo

**Sintoma:** ao cortar silêncio, quase todo corte "invadia" uma palavra
transcrita — bloqueando 40 de 45 cortes.

**Causa:** o Whisper estica o `endMs` da palavra sobre o silêncio seguinte.

**Solução:** o VAD é a fonte de borda; o Whisper só protege o **núcleo**.
Regra aplicada: rejeitar o corte só se ele engolir **>50%** de uma palavra.

---

## 8. `faster-whisper` quebra com PyAV novo

**Sintoma:** `TypeError: open() got an unexpected keyword argument 'metadata_errors'`

**Causa:** `faster-whisper` passa kwargs de API antiga do PyAV.

**Solução:** decodifique com FFmpeg e passe o **array** para o modelo:
```python
raw = subprocess.run(["ffmpeg","-i",f,"-f","f32le","-ac","1","-ar","16000","-"],
                     capture_output=True).stdout
audio = np.frombuffer(raw, dtype=np.float32)
segments, _ = model.transcribe(audio, language="pt", word_timestamps=True)
```

---

## 9. `mediapipe` 1.1.x morre por OOM

**Sintoma:** processo morto com exit **137** ao criar o `HandLandmarker`. Sem
traceback, sem mensagem.

**Causa:** alocação de memória na inicialização da versão 1.1.1 nesta máquina.

**Solução:** fixe `mediapipe==0.10.14` + `numpy<2`. Ganho: funciona.

---

## 10. `concat` demuxer deixa `r_frame_rate` estranho

**Sintoma:** `ffprobe` reporta `240/1` fps no vídeo concatenado.

**Causa:** metadata de time_base do concat.

**Solução:** remuxe com fps explícito:
```bash
ffmpeg -i cut.mp4 -vf fps=30 -c:v libx264 -crf 18 cut30.mp4
```
Os frames estavam corretos (2748 @ 30fps) — era só metadata. Mas o Remotion
prefere o valor explícito.

---

## 11. `filter_complex` com 35 entradas falha

**Sintoma:** `Error linking filters: Media type mismatch` ao tentar cortar e
concatenar tudo num filtro só.

**Causa:** conflito de labels quando se mistura `trim/atrim` + `concat`.

**Solução:** extraia cada trecho como arquivo e use o **concat demuxer**.
É sequencial, debugável e aguenta centenas de trechos.

---

## 12. Vídeo em flex layout sai da tela

**Sintoma:** a miniatura simplesmente não aparecia.

**Causa:** `<Video>` dentro de `<AbsoluteFill>` com `display:flex` entra no
fluxo e é posicionado abaixo da área visível.

**Solução:** `position:'absolute', left:0, top:0` antes de animar
`scale`/`translate`. `AbsoluteFill` não garante posicionamento dos filhos.

---

## 13. Coluna de gráfico colapsa

**Sintoma:** barras do gráfico com altura zero.

**Causa:** `height: '85%'` dentro de um flex container sem altura definida.

**Solução:** `height:'100%'` no container da coluna. Percentual precisa de pai
com altura resolvida.

---

## 14. `objectFit` não vai no `style` do `<Video>`

**Sintoma:** warning `@remotion/no-object-fit-on-media-video`, vídeo esticado.

**Solução:** `<Video objectFit="cover" />` como **prop**, não `style={{objectFit}}`.

---

## 15. `Interactive.create` tem 4 regras não óbvias

1. `layout:'absolute-fill'` só pode quando o componente **não aceita `style`**.
2. Campos de `schema` exigem `hiddenFromList`.
3. Props **não** podem se chamar `from`, `name`, `durationInFrames`,
   `trimBefore`, `playbackRate`, `loop`, `freeze`, `hidden` — são reservados.
   Use `startAt`/`endAt`.
4. O componente vira uma `Sequence`: `useVideoConfig().durationInFrames` dentro
   dele é a duração **do próprio elemento**, não da composição.

---

## 16. `drawtext` não reduz o texto entre execuções

**Sintoma:** ajustei `fontsize` e o render não mudou.

**Causa:** eu estava olhando um frame de um MP4 **antigo** (nome de saída
diferente, cópia esquecida em `out/`).

**Lição:** sempre confirme o arquivo pelo `mtime`/`sha256` antes de julgar um
frame. `ls -la` no arquivo que você está olhando.

---

## 17. Tabela corta linhas

**Sintoma:** 10 linhas, só 5 aparecem.

**Causa:** `contentHeight` menor que a altura real (`header 63 + 10×row 59 +
gaps ≈ 780px`).

**Solução:** meça e use **auto-fit**:
```ts
const scale = Math.min(availW / contentWidth, availH / contentHeight);
// desenhe no tamanho de design, escale o wrapper — nada é cortado
```
