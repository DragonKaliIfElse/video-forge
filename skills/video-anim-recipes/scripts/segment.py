"""segment.py — máscara de silhueta do sujeito, um PNG por frame.

ATENÇÃO (custou horas de debug): o MediaPipe Selfie Segmenter escreve
**PESSOA = 0 (preto)** e **FUNDO = 255 (branco)**. Quem for usar a máscara como
alpha precisa INVERTER (`-vf negate` no FFmpeg).
NÃO presuma "255 = pessoa": verifique com
    ffmpeg -i masks/00000.png -f rawvideo -pix_fmt gray -

Saída: <outdir>/NNNNN.png (grayscale) + index.json com a cobertura por frame.
"""
import json
import os
import sys
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

VIDEO = Path(sys.argv[1] if len(sys.argv) > 1 else "cut.mp4")
OUTDIR = Path(sys.argv[2] if len(sys.argv) > 2 else "masks")
MODELS = Path(os.environ.get("FORGE_MODELS", "models"))
MODEL = MODELS / "selfie_segmenter.tflite"

OUTDIR.mkdir(parents=True, exist_ok=True)

if not MODEL.exists():
    raise SystemExit(
        f"modelo ausente: {MODEL}\n"
        f"  baixe: curl -sL -o {MODEL} "
        "https://storage.googleapis.com/mediapipe-models/image_segmenter/"
        "selfie_segmenter/float16/1/selfie_segmenter.tflite"
    )

seg = vision.ImageSegmenter.create_from_options(
    vision.ImageSegmenterOptions(
        base_options=mp_python.BaseOptions(model_asset_path=str(MODEL)),
        running_mode=vision.RunningMode.VIDEO,
        output_category_mask=True,
    )
)

cap = cv2.VideoCapture(str(VIDEO))
fps = cap.get(cv2.CAP_PROP_FPS) or 30
idx = 0
saved = 0
index = []
while True:
    ok, frame = cap.read()
    if not ok:
        break
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    res = seg.segment_for_video(mp_img, int(idx * 1000 / fps))
    mask = res.category_mask.numpy_view()
    # o category_mask já vem em 0/255 (255 = pessoa), sem categoria numérica
    person = mask.astype(np.uint8)
    name = f"{idx:05d}.png"
    cv2.imwrite(str(OUTDIR / name), person, [cv2.IMWRITE_PNG_COMPRESSION, 3])
    index.append({"frame": idx, "file": name,
                  "coverage": round(float(person.mean() / 255), 4)})
    saved += 1
    idx += 1
    if saved % 200 == 0:
        print(f"  {saved} máscaras", flush=True)

cap.release()
seg.close()
(OUTDIR / "index.json").write_text(
    json.dumps({"fps": fps, "count": saved, "frames": index},
               ensure_ascii=False), encoding="utf-8")
print(f"✓ {saved} máscaras em {OUTDIR}")
