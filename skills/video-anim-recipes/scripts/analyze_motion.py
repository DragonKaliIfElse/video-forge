#!/usr/bin/env python3
"""analyze_motion.py — mede paleta e movimento a partir de frames NATIVOS.

Por que existe: contact sheets (thumbnails) enganam. Numa referência 480p, ler
cor ou tipografia de um thumb de 320px dá valores errados. Este script lê o
frame nativo e mede:

  1. PALETA dominante por k-means em RGB (ignora JPEG noise)
  2. CURVA DE MOVIMENTO: bounding box do conteúdo claro por frame, que revela
     entrada/saída (scale, slide) e a duração real de cada animação
  3. COR DE UM PIXEL: para conferir bordas/moldura/letterbox

Uso:
  python analyze_motion.py VIDEO --from 0.3 --to 2.2
  python analyze_motion.py VIDEO --palette-at 23.3
  python analyze_motion.py VIDEO --from 0 --to 1 --thresh 200
  python analyze_motion.py VIDEO --probe-border 10

Saída: JSON em --out (default: motion-probe.json) + relatório no stdout.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np


def probe_size(path: Path) -> tuple[int, int, float]:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height,r_frame_rate",
         "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout.strip().split(",")
    w, h = int(out[0]), int(out[1])
    num, den = out[2].split("/")
    fps = float(num) / float(den or 1)
    return w, h, fps


def read_frames(path: Path, t0: float, t1: float, w: int, h: int) -> np.ndarray:
    """Lê frames como RGB24 via FFmpeg (sem depender de PyAV/OpenCV)."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", f"{t0:.3f}", "-to", f"{t1:.3f}",
         "-i", str(path), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True, check=True,
    ).stdout
    n = len(raw) // (w * h * 3)
    if n == 0:
        return np.zeros((0, h, w, 3), dtype=np.uint8)
    return np.frombuffer(raw, dtype=np.uint8)[: n * w * h * 3].reshape(n, h, w, 3)


def kmeans_palette(img: np.ndarray, k: int = 6, iters: int = 12) -> list[dict]:
    """Paleta dominante sem dependências externas."""
    px = img.reshape(-1, 3).astype(np.float32)
    if len(px) > 60_000:
        px = px[:: len(px) // 60_000]
    rng = np.random.default_rng(0)
    centers = px[rng.choice(len(px), min(k, len(px)), replace=False)].copy()
    labels = np.zeros(len(px), dtype=int)
    for _ in range(iters):
        d = ((px[:, None, :] - centers[None, :, :]) ** 2).sum(2)
        labels = d.argmin(1)
        for i in range(len(centers)):
            m = labels == i
            if m.any():
                centers[i] = px[m].mean(0)
    counts = np.bincount(labels, minlength=len(centers))
    order = counts.argsort()[::-1]
    return [
        {
            "hex": "#" + "".join(f"{int(round(v)):02x}" for v in centers[i]),
            "rgb": [int(round(v)) for v in centers[i]],
            "share": round(float(counts[i] / counts.sum()), 4),
        }
        for i in order
    ]


def motion_curve(frames: np.ndarray, thresh: int) -> list[dict]:
    """Bounding box do conteúdo claro por frame = assinatura da animação."""
    rows = []
    for i, f in enumerate(frames):
        mask = f.min(axis=2) > thresh
        area = int(mask.sum())
        if area < 50:
            rows.append({"i": i, "w": 0, "h": 0, "area": 0})
            continue
        ys, xs = np.where(mask)
        rows.append({
            "i": i,
            "w": int(xs.max() - xs.min() + 1),
            "h": int(ys.max() - ys.min() + 1),
            "area": area,
            "x0": int(xs.min()), "x1": int(xs.max()),
            "y0": int(ys.min()), "y1": int(ys.max()),
            "cx": round(float(xs.mean()), 1),
            "cy": round(float(ys.mean()), 1),
        })
    return rows


def summarize_curve(curve: list[dict]) -> dict:
    """Extrai entrada/saída: quanto tempo o conteúdo leva para estabilizar."""
    live = [r for r in curve if r["area"] > 0]
    if not live:
        return {"framesWithContent": 0}
    peak_w = max(r["w"] for r in live)
    peak_area = max(r["area"] for r in live)
    # estabiliza quando w atinge 97% do pico
    settle = next((r["i"] for r in live if r["w"] >= 0.97 * peak_w), live[0]["i"])
    return {
        "framesWithContent": len(live),
        "firstFrame": live[0]["i"],
        "settleFrame": settle,
        "entryFrames": settle - live[0]["i"],
        "peakWidth": peak_w,
        "peakArea": peak_area,
        "widthSeries": [r["w"] for r in live],
    }


def probe_border(path: Path, t: float, w: int, h: int) -> dict:
    """Amostra cantos e bordas — detecta moldura, letterbox, padding."""
    f = read_frames(path, t, t + 0.05, w, h)
    if len(f) == 0:
        return {"error": "frame não decodificado"}
    img = f[0]
    return {
        "corners": {
            "tl": img[0, 0].tolist(), "tr": img[0, -1].tolist(),
            "bl": img[-1, 0].tolist(), "br": img[-1, -1].tolist(),
        },
        "rowMiddleBrightCols": np.where(img[h // 2].min(axis=1) > 200)[0][:10].tolist(),
        "colMiddleBrightRows": np.where(img[:, w // 2].min(axis=1) > 200)[0][:10].tolist(),
        "topRowMean": [round(float(v), 1) for v in img[0].mean(axis=0)],
        "bottomRowMean": [round(float(v), 1) for v in img[-1].mean(axis=0)],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video", type=Path)
    ap.add_argument("--from", dest="t0", type=float, default=0.0)
    ap.add_argument("--to", dest="t1", type=float, default=None)
    ap.add_argument("--thresh", type=int, default=200, help="limiar de 'conteúdo claro' (0-255)")
    ap.add_argument("--palette-at", type=float, default=None, help="mede paleta só neste instante")
    ap.add_argument("--k", type=int, default=6, help="números de clusters da paleta")
    ap.add_argument("--probe-border", type=float, default=None, metavar="T")
    ap.add_argument("--out", type=Path, default=Path("motion-probe.json"))
    ap.add_argument("--no-json", action="store_true")
    args = ap.parse_args()

    if not args.video.exists():
        print(f"erro: {args.video} não existe", file=sys.stderr)
        return 1

    w, h, fps = probe_size(args.video)
    print(f"{args.video.name}  {w}x{h} @ {fps:.3f}fps\n")

    report: dict = {"video": str(args.video), "width": w, "height": h, "fps": round(fps, 3)}

    # --- paleta ---
    if args.palette_at is not None:
        t0, t1 = args.palette_at, args.palette_at + 0.1
    else:
        t0 = args.t0
        t1 = args.t1 if args.t1 is not None else t0 + 1.0
    frames = read_frames(args.video, t0, t1, w, h)
    if len(frames) == 0:
        print("erro: nenhum frame no intervalo", file=sys.stderr)
        return 1

    mid = frames[len(frames) // 2]
    pal = kmeans_palette(mid, args.k)
    report["palette"] = pal
    print(f"== PALETA @ {t0:.2f}s ==")
    for c in pal:
        bar = "#" * int(30 * c["share"])
        print(f"  {c['hex']}  {c['share']*100:5.1f}%  {bar}")

    # --- curva de movimento ---
    if args.palette_at is None:
        curve = motion_curve(frames, args.thresh)
        summ = summarize_curve(curve)
        report["motion"] = summ
        report["curve"] = curve
        print(f"\n== MOVIMENTO ({len(frames)} frames) ==")
        peak = summ.get("peakWidth") or 1
        for r in curve:
            if r["w"] == 0:
                continue
            bar = "#" * int(44 * r["w"] / peak)
            print(f"  f{r['i']:03d} w={r['w']:4d} h={r['h']:4d} area={r['area']:6d} {bar}")
        if "entryFrames" in summ:
            print(f"\n  entrada ≈ {summ['entryFrames']} frames "
                  f"({summ['entryFrames']/fps*1000:.0f}ms) até estabilizar")
            print(f"  largura de pico: {summ['peakWidth']}px "
                  f"({summ['peakWidth']/w*100:.0f}% da largura)")

    # --- bordas ---
    if args.probe_border is not None:
        b = probe_border(args.video, args.probe_border, w, h)
        report["border"] = b
        print(f"\n== BORDAS @ {args.probe_border:.2f}s ==")
        print(f"  cantos: {b['corners']}")

    if not args.no_json:
        args.out.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"\n✓ {args.out}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
