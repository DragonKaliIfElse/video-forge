#!/usr/bin/env python3
"""make_hands.py — converte tracking.jsonl (streaming) em hands.json (para o Remotion).

Entrada: <ws>/tracking.jsonl com uma linha por frame analisado
Saída:   <ws>/hands.json  {durationMs, frames:[{t, hands:[{h,p}], pose}]}

Subsample padrão 2 (= 15fps a partir de 30fps): suficiente para overlay e
reduz o payload de ~5 MB para ~2 MB.
"""
import json
import sys
from pathlib import Path

ws = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
step = int(sys.argv[2]) if len(sys.argv) > 2 else 2

src = ws / "tracking.jsonl"
if not src.exists():
    print("tracking.jsonl não encontrado — pulando", file=sys.stderr)
    raise SystemExit(0)

frames = []
for line in src.read_text(encoding="utf-8").splitlines():
    if not line.strip():
        continue
    r = json.loads(line)
    if r["f"] % step:
        continue
    frames.append({
        "t": r["t"],
        "hands": [{"h": h["h"], "p": h["p"]} for h in r.get("hands", [])],
        "pose": r.get("pose"),
    })

dur = frames[-1]["t"] if frames else 0
out = {"durationMs": dur, "frames": frames}
(ws / "hands.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
mb = (ws / "hands.json").stat().st_size / 1024 / 1024
print(f"  {len(frames)} frames de mão → hands.json ({mb:.1f} MB)")
