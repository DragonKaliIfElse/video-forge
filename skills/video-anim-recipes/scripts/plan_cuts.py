"""Plano de corte de silêncios usando Silero VAD (neural) + timestamps de palavra.

Por que VAD neural: o Silero (embutido no faster-whisper) classifica fala por
modelo treinado, não por energia — não confunde respiração/consoante fraca com
silêncio, e não corta sílaba. É o padrão atual (não heurística de RMS).

Regras:
  - corte apenas silêncios >= MIN_SILENCE_MS (padrão 100ms)
  - PAD de respiro mantido nas bordas de fala
  - segurança: nunca remove região coberta por palavra transcrita

Uso:
  python tools/plan_cuts.py input/gravacao.wav input/transcript.json 100
Saída: input/cuts.json (regiões a MANTER), input/silences.json (evidência)
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from faster_whisper.vad import VadOptions, get_speech_timestamps

AUDIO = Path(sys.argv[1] if len(sys.argv) > 1 else "work/audio.wav")
TRANSCRIPT = Path(sys.argv[2] if len(sys.argv) > 2 else "transcript.json")
MIN_SILENCE_MS = int(sys.argv[3]) if len(sys.argv) > 3 else 100
PAD_MS = 60
SR = 16000


def decode(path: Path, sr: int = SR) -> np.ndarray:
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-vn", "-ac", "1",
         "-ar", str(sr), "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(out, dtype=np.float32).copy()


audio = decode(AUDIO)
total_ms = round(len(audio) / SR * 1000)

# --- Silero VAD: fala com timestamps (amostras) ---
vad = VadOptions(
    threshold=0.5,
    neg_threshold=0.35,
    min_speech_duration_ms=100,
    min_silence_duration_ms=MIN_SILENCE_MS,
    speech_pad_ms=0,
)
speech_ts = get_speech_timestamps(audio, vad, sampling_rate=SR)
speech = [
    {"startMs": round(t["start"] / SR * 1000), "endMs": round(t["end"] / SR * 1000)}
    for t in speech_ts
]

# --- silêncios = complemento da fala ---
silences = []
cursor = 0
for s in speech:
    if s["startMs"] - cursor >= MIN_SILENCE_MS:
        silences.append({"startMs": cursor, "endMs": s["startMs"],
                         "durationMs": s["startMs"] - cursor})
    cursor = max(cursor, s["endMs"])
if total_ms - cursor >= MIN_SILENCE_MS:
    silences.append({"startMs": cursor, "endMs": total_ms,
                     "durationMs": total_ms - cursor})

# --- segurança: não engolir uma palavra ---
# Timestamps do Whisper são frouxos (esticam sobre o silêncio) e o Silero VAD é
# a fonte precisa de borda. Regra: rejeita o corte só se ele consumir mais de
# MAX_WORD_LOSS de uma palavra transcrita (protege sílaba sem bloquear tudo).
words = json.loads(TRANSCRIPT.read_text(encoding="utf-8"))["words"]
MAX_WORD_LOSS = 0.5

def word_loss(a: int, b: int) -> tuple[float, str]:
    worst, who = 0.0, ""
    for w in words:
        dur = max(1, w["endMs"] - w["beginMs"])
        ov = min(b, w["endMs"]) - max(a, w["beginMs"])
        if ov <= 0:
            continue
        frac = ov / dur
        if frac > worst:
            worst, who = frac, w["text"]
    return worst, who

safe = []
skipped = 0
for s in silences:
    cs = s["startMs"] + PAD_MS
    ce = s["endMs"] - PAD_MS
    if ce <= cs:
        skipped += 1
        continue
    loss, _who = word_loss(cs, ce)
    if loss > MAX_WORD_LOSS:
        skipped += 1
        continue
    safe.append(s)

# --- regiões a MANTER ---
keep = []
cursor = 0
for s in safe:
    cut_start = s["startMs"] + PAD_MS
    cut_end = s["endMs"] - PAD_MS
    if cut_start > cursor:
        keep.append({"startMs": cursor, "endMs": cut_start})
    cursor = max(cursor, cut_end)
if cursor < total_ms:
    keep.append({"startMs": cursor, "endMs": total_ms})
keep = [k for k in keep if k["endMs"] - k["startMs"] >= 150]

# acumula o tempo de SAÍDA: cada região mantida começa onde a anterior terminou.
# make_words.py depende disso para remapear as palavras.
acc = 0
for r in keep:
    r["outStartMs"] = acc
    acc += r["endMs"] - r["startMs"]
    r["outEndMs"] = acc

kept_ms = sum(k["endMs"] - k["startMs"] for k in keep)
removed_ms = total_ms - kept_ms
durs = sorted(s["durationMs"] for s in safe)

print(f"duração={total_ms/1000:.2f}s | fala={len(speech)} trechos")
print(f"silêncios>={MIN_SILENCE_MS}ms detectados={len(silences)} | "
      f"seguros={len(safe)} (pulados={skipped})")
if durs:
    print(f"durações: min={durs[0]}ms mediana={durs[len(durs)//2]}ms max={durs[-1]}ms")
print(f"mantido={kept_ms/1000:.2f}s ({kept_ms/total_ms*100:.1f}%) | "
      f"cortado={removed_ms/1000:.2f}s ({removed_ms/total_ms*100:.1f}%)")
print(f"{len(keep)} regiões mantidas")

Path("silences.json").write_text(json.dumps(
    {"minSilenceMs": MIN_SILENCE_MS, "padMs": PAD_MS, "durationMs": total_ms,
     "detected": silences, "applied": safe}, ensure_ascii=False, indent=2),
    encoding="utf-8")
Path("cuts.json").write_text(json.dumps(
    {"source": str(Path(sys.argv[4]) if len(sys.argv) > 4 else ""),
     "minSilenceMs": MIN_SILENCE_MS, "padMs": PAD_MS,
     "sourceDurationMs": total_ms, "keptMs": kept_ms, "removedMs": removed_ms,
     "regions": keep}, ensure_ascii=False, indent=2), encoding="utf-8")
print("✓ silences.json e cuts.json")
