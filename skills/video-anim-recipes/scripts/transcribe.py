"""Transcreve com word-timestamps (faster-whisper) e detecta silêncios.

Saída:
  - transcript.json : formato compatível com pi-speech (words com beginMs/endMs)
  - silences.json   : intervalos de silêncio >= minSilenceMs
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

AUDIO = Path(sys.argv[1] if len(sys.argv) > 1 else "work/audio.wav")
MIN_SILENCE_MS = int(sys.argv[2]) if len(sys.argv) > 2 else 100
MIN_SPEECH_MS = 60  # ignora micro-picos abaixo disso
PAD_MS = 40  # margem de respiro mantida nas bordas de fala
SR = 16000


def decode(path: Path, sr: int = SR) -> np.ndarray:
    """Decodifica qualquer mídia em mono float32 via FFmpeg (evita PyAV)."""
    cmd = [
        "ffmpeg", "-v", "error", "-i", str(path),
        "-vn", "-ac", "1", "-ar", str(sr),
        "-f", "f32le", "-",
    ]
    out = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.float32).copy()


print(f"→ transcrevendo {AUDIO}", flush=True)
audio = decode(AUDIO)
model = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=8)
segments, info = model.transcribe(
    audio,
    language="pt",
    beam_size=5,
    word_timestamps=True,
    vad_filter=False,
    condition_on_previous_text=False,
)
print(f"  idioma={info.language} prob={info.language_probability:.2f}", flush=True)

words = []
for seg in segments:
    for w in seg.words or []:
        text = w.word.strip()
        if not text:
            continue
        words.append(
            {
                "text": text,
                "beginMs": round(w.start * 1000),
                "endMs": round(w.end * 1000),
                "probability": round(getattr(w, "probability", 0.0) or 0.0, 4),
            }
        )

print(f"  {len(words)} palavras", flush=True)

# --- Detecção de silêncio por energia (RMS em janelas de 10ms) ---
sr = SR

win = int(sr * 0.010)  # 10 ms
nwin = len(audio) // win
frames = audio[: nwin * win].reshape(nwin, win)
rms = np.sqrt((frames**2).mean(axis=1))

# limiar adaptativo: ruído de fundo (percentil 10) vs fala (percentil 90)
noise = float(np.percentile(rms, 10))
speech = float(np.percentile(rms, 90))
thresh = max(noise * 2.5, speech * 0.06, 0.0015)
print(f"  rms: noise={noise:.5f} speech={speech:.5f} thresh={thresh:.5f}", flush=True)

voiced = rms > thresh

# suaviza: fecha buracos curtos (<MIN_SPEECH_MS) dentro de fala
min_speech_wins = max(1, MIN_SPEECH_MS // 10)
i = 0
while i < len(voiced):
    if not voiced[i]:
        j = i
        while j < len(voiced) and not voiced[j]:
            j += 1
        if 0 < i and j < len(voiced) and (j - i) < min_speech_wins:
            voiced[i:j] = True
        i = j
    else:
        i += 1

# extrai silêncios >= MIN_SILENCE_MS
silences = []
i = 0
min_sil_wins = MIN_SILENCE_MS // 10
while i < len(voiced):
    if not voiced[i]:
        j = i
        while j < len(voiced) and not voiced[j]:
            j += 1
        if (j - i) >= min_sil_wins:
            silences.append(
                {
                    "startMs": i * 10,
                    "endMs": j * 10,
                    "durationMs": (j - i) * 10,
                }
            )
        i = j
    else:
        i += 1

total_ms = len(audio) / sr * 1000
removable_ms = sum(s["durationMs"] for s in silences)
print(
    f"  {len(silences)} silêncios >= {MIN_SILENCE_MS}ms "
    f"(total {removable_ms/1000:.2f}s de {total_ms/1000:.2f}s)",
    flush=True,
)

out_words = Path("transcript.json")
out_sil = Path("silences.json")
out_words.write_text(
    json.dumps(
        {
            "source": str(AUDIO),
            "language": info.language,
            "durationMs": round(total_ms),
            "words": words,
        },
        ensure_ascii=False,
        indent=2,
    ),
    encoding="utf-8",
)
out_sil.write_text(
    json.dumps(
        {
            "minSilenceMs": MIN_SILENCE_MS,
            "padMs": PAD_MS,
            "durationMs": round(total_ms),
            "silences": silences,
        },
        ensure_ascii=False,
        indent=2,
    ),
    encoding="utf-8",
)
print(f"✓ {out_words} e {out_sil}", flush=True)
