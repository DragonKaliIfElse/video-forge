#!/usr/bin/env python3
"""apply_cuts.py — aplica os cortes de silêncio e gera o vídeo final.

Estratégia: extrai cada trecho mantido como arquivo intermediário e concatena
(concat demuxer). É mais robusto que um filter_complex com 35 entradas, que
falha no linking de filtros.

Uso:
    python apply_cuts.py <workspace> [--source ORIGEM] [--out SAIDA]

Padrões dentro do workspace:
    <ws>/cuts.json   plano de corte (obrigatório)
    <ws>/cut.mp4     saída
A origem é deduzida de cuts.json (campo `source`) ou passada em --source.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("workspace", nargs="?", default=".")
ap.add_argument("--source", default=None, help="vídeo original (senão usa o de cuts.json)")
ap.add_argument("--out", default=None, help="saída (default: <ws>/cut.mp4)")
ap.add_argument("--fps", type=int, default=30)
args = ap.parse_args()

ws = Path(args.workspace).resolve()
cuts = json.loads((ws / "cuts.json").read_text(encoding="utf-8"))
regions = cuts["regions"]

src = Path(args.source) if args.source else Path(cuts.get("source", ""))
if not src.is_absolute():
    src = (ws / src) if src.name else None
if not src or not src.exists():
    # fallback: procura um vídeo no workspace
    cands = [p for p in ws.glob("*.mp4") if p.name != "cut.mp4"]
    if not cands:
        print("erro: não achei o vídeo de origem; use --source", file=sys.stderr)
        raise SystemExit(1)
    src = cands[0]

out = Path(args.out) if args.out else ws / "cut.mp4"
tmp = ws / "work" / "segs"
tmp.mkdir(parents=True, exist_ok=True)

print(f"origem: {src}")
print(f"regiões: {len(regions)}")

files = []
for i, r in enumerate(regions):
    seg = tmp / f"seg_{i:03d}.mp4"
    if not seg.exists():
        subprocess.run(
            ["ffmpeg", "-y", "-v", "error",
             "-ss", f"{r['startMs']/1000:.3f}", "-to", f"{r['endMs']/1000:.3f}",
             "-i", str(src),
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
             "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
             "-r", str(args.fps), str(seg)],
            check=True,
        )
    files.append(seg)
    if (i + 1) % 10 == 0:
        print(f"  {i+1}/{len(regions)} trechos", flush=True)

lst = tmp / "list.txt"
lst.write_text("".join(f"file '{f.resolve()}'\n" for f in files), encoding="utf-8")
subprocess.run(
    ["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0",
     "-i", str(lst), "-c", "copy", "-movflags", "+faststart", str(out)],
    check=True,
)

dur = float(subprocess.run(
    ["ffprobe", "-v", "error", "-show_entries", "format=duration",
     "-of", "csv=p=0", str(out)], capture_output=True, text=True).stdout.strip())
esperado = cuts["keptMs"] / 1000
print(f"✓ {out.name}  {dur:.2f}s (esperado {esperado:.2f}s)")
