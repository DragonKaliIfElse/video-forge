#!/usr/bin/env python3
"""make_words.py — remapeia as palavras do transcript para o tempo do vídeo cortado.

Por que existe: depois dos cortes, o segundo 90 do original pode ser o 78 do
final. As legendas e o karaokê precisam do tempo de SAÍDA, não de origem.

Entrada: <ws>/transcript.json, <ws>/cuts.json
Saída:   <ws>/words.json  {durationMs, words:[{text, beginMs, endMs}]}
"""
import json
import sys
from pathlib import Path

ws = Path(sys.argv[1] if len(sys.argv) > 1 else ".")

transcript = json.loads((ws / "transcript.json").read_text(encoding="utf-8"))
cuts = json.loads((ws / "cuts.json").read_text(encoding="utf-8"))
regions = cuts["regions"]


def map_ms(t: int) -> int | None:
    for r in regions:
        if r["startMs"] <= t < r["endMs"]:
            return r["outStartMs"] + (t - r["startMs"])
    return None


def region_of(t: int) -> dict | None:
    for r in regions:
        if r["startMs"] <= t < r["endMs"]:
            return r
    return None


words = []
dropped = 0
for w in transcript["words"]:
    m0 = map_ms(w["beginMs"])
    if m0 is None:
        dropped += 1
        continue
    m1 = map_ms(w["endMs"])
    if m1 is None:
        r = region_of(w["beginMs"])
        m1 = min(m0 + (w["endMs"] - w["beginMs"]), r["outEndMs"] if r else m0 + 100)
    if m1 <= m0:
        m1 = m0 + 80
    words.append({"text": w["text"], "beginMs": round(m0), "endMs": round(m1)})

out = {"durationMs": cuts["keptMs"], "words": words}
(ws / "words.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
print(f"  {len(words)} palavras remapeadas ({dropped} descartadas nos cortes)")
print(f"  duração final: {cuts['keptMs']/1000:.2f}s")
