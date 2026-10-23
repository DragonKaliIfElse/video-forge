#!/usr/bin/env python3
"""reverse_engineer.py — pipeline de engenharia reversa de um vídeo de referência.

Encadeia: metadados → amostragem de frames nativos → paleta por cena →
detecção de conteúdo (texto/UI) → relatório em Markdown pronto para virar
entrada de catálogo.

Diferente de um contact sheet: cada amostra é um frame NATIVO em resolução
cheia, e cada amostra vem com paleta medida, para que cor e tipografia não
sejam adivinhadas a partir de thumbnail.

Uso:
  python reverse_engineer.py VIDEO --out relatorio.md
  python reverse_engineer.py VIDEO --timestamps 0.5,1.6,23.3,33.5
  python reverse_engineer.py VIDEO --samples 24 --out rel.md   # amostragem uniforme

Requer: ffmpeg no PATH. Sem dependências Python além de numpy.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np


def ffprobe(path: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries",
         "stream=index,codec_type,codec_name,width,height,r_frame_rate,nb_frames,duration",
         "-show_entries", "format=duration,bit_rate",
         "-of", "json", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout
    return json.loads(out)


def grab(path: Path, t: float, w: int, h: int) -> np.ndarray | None:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", str(path),
         "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True,
    ).stdout
    if len(raw) < w * h * 3:
        return None
    return np.frombuffer(raw, dtype=np.uint8)[: w * h * 3].reshape(h, w, 3)


def palette(img: np.ndarray, k: int = 5) -> list[dict]:
    px = img.reshape(-1, 3).astype(np.float32)
    if len(px) > 50_000:
        px = px[:: len(px) // 50_000]
    rng = np.random.default_rng(0)
    c = px[rng.choice(len(px), min(k, len(px)), replace=False)].copy()
    lab = np.zeros(len(px), dtype=int)
    for _ in range(10):
        d = ((px[:, None, :] - c[None, :, :]) ** 2).sum(2)
        lab = d.argmin(1)
        for i in range(len(c)):
            m = lab == i
            if m.any():
                c[i] = px[m].mean(0)
    cnt = np.bincount(lab, minlength=len(c))
    order = cnt.argsort()[::-1]
    return [
        {"hex": "#" + "".join(f"{int(round(v)):02x}" for v in c[i]),
         "share": round(float(cnt[i] / cnt.sum()), 3)}
        for i in order
    ]


def content_metrics(img: np.ndarray) -> dict:
    """Heurísticas para classificar o frame."""
    h, w, _ = img.shape
    bright = (img.min(axis=2) > 190)
    dark = (img.max(axis=2) < 40)
    sat = img.max(axis=2).astype(np.int16) - img.min(axis=2).astype(np.int16)
    color_share = float((sat > 60).mean())
    bright_share = float(bright.mean())
    dark_share = float(dark.mean())

    bbox = None
    if bright.sum() > 200:
        ys, xs = np.where(bright)
        bbox = {
            "x0": int(xs.min()), "x1": int(xs.max()),
            "y0": int(ys.min()), "y1": int(ys.max()),
            "widthPct": round(float((xs.max() - xs.min() + 1) / w), 3),
            "heightPct": round(float((ys.max() - ys.min() + 1) / h), 3),
        }

    # classificação grosseira, suficiente para triagem humana
    kind = "video"
    if dark_share > 0.45 and bright_share > 0.02:
        kind = "texto-sobre-escuro"
    elif color_share > 0.55:
        kind = "card-colorido"
    elif bright_share > 0.25:
        kind = "fundo-claro"
    elif color_share < 0.12:
        kind = "monocromatico"

    return {
        "kind": kind,
        "brightShare": round(bright_share, 3),
        "darkShare": round(dark_share, 3),
        "colorShare": round(color_share, 3),
        "brightBbox": bbox,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video", type=Path)
    ap.add_argument("--timestamps", type=str, default=None,
                    help="lista separada por vírgula (segundos)")
    ap.add_argument("--samples", type=int, default=12, help="amostras uniformes se sem --timestamps")
    ap.add_argument("--out", type=Path, default=None, help="relatório .md")
    ap.add_argument("--json-out", type=Path, default=None)
    ap.add_argument("--frames-dir", type=Path, default=None,
                    help="salva PNGs nativos das amostras neste diretório")
    args = ap.parse_args()

    if not args.video.exists():
        print(f"erro: {args.video} não existe", file=sys.stderr)
        return 1

    meta = ffprobe(args.video)
    vstream = next(s for s in meta["streams"] if s["codec_type"] == "video")
    w, h = int(vstream["width"]), int(vstream["height"])
    num, den = vstream["r_frame_rate"].split("/")
    fps = float(num) / float(den or 1)
    dur = float(meta["format"]["duration"])

    if args.timestamps:
        times = [float(t.strip()) for t in args.timestamps.split(",") if t.strip()]
    else:
        n = max(1, args.samples)
        times = [round(dur * (i + 0.5) / n, 2) for i in range(n)]

    print(f"{args.video.name}  {w}x{h} @ {fps:.2f}fps  {dur:.1f}s")
    print(f"amostras: {len(times)}\n")

    rows = []
    if args.frames_dir:
        args.frames_dir.mkdir(parents=True, exist_ok=True)

    for t in times:
        img = grab(args.video, t, w, h)
        if img is None:
            print(f"  {t:7.2f}s  (falhou)")
            continue
        pal = palette(img)
        cm = content_metrics(img)
        rows.append({"t": t, "palette": pal, **cm})
        if args.frames_dir:
            subprocess.run(
                ["ffmpeg", "-y", "-v", "error", "-ss", f"{t:.3f}", "-i", str(args.video),
                 "-frames:v", "1", str(args.frames_dir / f"f_{t:08.2f}.png")],
                check=True,
            )
        print(f"  {t:7.2f}s  {cm['kind']:22s} claro={cm['brightShare']:.2f} "
              f"escuro={cm['darkShare']:.2f} cor={cm['colorShare']:.2f}  "
              f"{' '.join(c['hex'] for c in pal[:3])}")

    if args.out:
        lines = [
            f"# Engenharia reversa — {args.video.name}",
            "",
            f"- resolução: **{w}×{h}**",
            f"- fps: **{fps:.2f}**",
            f"- duração: **{dur:.1f}s**",
            f"- amostras: **{len(rows)}**",
            "",
            "| t (s) | tipo | claro | escuro | cor | paleta (top 4) | bbox texto |",
            "|---|---|---|---|---|---|---|",
        ]
        for r in rows:
            bb = r["brightBbox"]
            bbs = f"{bb['widthPct']}×{bb['heightPct']} @ ({bb['x0']},{bb['y0']})" if bb else "—"
            pal = " ".join(f"`{c['hex']}`" for c in r["palette"][:4])
            lines.append(
                f"| {r['t']:.2f} | {r['kind']} | {r['brightShare']:.2f} | "
                f"{r['darkShare']:.2f} | {r['colorShare']:.2f} | {pal} | {bbs} |"
            )
        lines += [
            "",
            "## Como usar este relatório",
            "",
            "1. Marque na coluna **tipo** quais frames contêm animação (não fala pura).",
            "2. Para cada um, rode `analyze_motion.py VIDEO --from T --to T+2` para medir",
            "   a curva de entrada (frames até estabilizar) e a largura de pico.",
            "3. Registre o padrão no `catalog.md` com os números medidos.",
            "",
        ]
        args.out.write_text("\n".join(lines), encoding="utf-8")
        print(f"\n✓ {args.out}")

    if args.json_out:
        args.json_out.write_text(json.dumps(
            {"video": str(args.video), "width": w, "height": h, "fps": fps,
             "duration": dur, "samples": rows}, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"✓ {args.json_out}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
