"""Extrai landmarks da mão + pose por frame, gravando em disco em streaming.

Memória constante: escreve cada frame como uma linha JSON (JSONL) e converte no fim.
Uso: python tools/track.py input/gravacao.mp4 input/tracking.jsonl [step]
"""
import json
import os
import sys
from pathlib import Path

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

VIDEO = Path(sys.argv[1] if len(sys.argv) > 1 else "cut.mp4")
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "tracking.jsonl")
STEP = int(sys.argv[3]) if len(sys.argv) > 3 else 1  # analisa 1 a cada N frames
MODELS = Path(os.environ.get("FORGE_MODELS", "models"))

hand = vision.HandLandmarker.create_from_options(
    vision.HandLandmarkerOptions(
        base_options=mp_python.BaseOptions(
            model_asset_path=str(MODELS / "hand_landmarker.task")),
        running_mode=vision.RunningMode.VIDEO,
        num_hands=2,
        min_hand_detection_confidence=0.4,
        min_hand_presence_confidence=0.4,
        min_tracking_confidence=0.4,
    )
)
pose = vision.PoseLandmarker.create_from_options(
    vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(
            model_asset_path=str(MODELS / "pose_landmarker.task")),
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.4,
        min_pose_presence_confidence=0.4,
        min_tracking_confidence=0.4,
    )
)

cap = cv2.VideoCapture(str(VIDEO))
fps = cap.get(cv2.CAP_PROP_FPS) or 30
w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
print(f"→ {VIDEO}: {w}x{h} @ {fps}fps step={STEP}", flush=True)

idx = 0
written = 0
hand_frames = 0
with OUT.open("w", encoding="utf-8") as fh:
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if idx % STEP == 0:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            ts_ms = int(idx * 1000 / fps)

            hr = hand.detect_for_video(mp_img, ts_ms)
            pr = pose.detect_for_video(mp_img, ts_ms)

            entry = {"f": idx, "t": round(idx * 1000 / fps), "hands": [], "pose": None}
            for hi, lms in enumerate(hr.hand_landmarks):
                handed, score = "unknown", 0.0
                if hi < len(hr.handedness) and hr.handedness[hi]:
                    handed = hr.handedness[hi][0].category_name
                    score = round(float(hr.handedness[hi][0].score), 3)
                entry["hands"].append({
                    "h": handed, "s": score,
                    "p": [[round(float(p.x), 5), round(float(p.y), 5),
                           round(float(p.z), 5)] for p in lms],
                })
            if pr.pose_landmarks:
                entry["pose"] = [[round(float(p.x), 5), round(float(p.y), 5),
                                  round(float(p.visibility), 3)]
                                 for p in pr.pose_landmarks[0]]

            if entry["hands"]:
                hand_frames += 1
            fh.write(json.dumps(entry, separators=(",", ":")) + "\n")
            written += 1
            if written % 150 == 0:
                fh.flush()
                print(f"  {written} analisados (frame {idx}) mão={hand_frames}",
                      flush=True)
        idx += 1

cap.release()
hand.close()
pose.close()
print(f"✓ {written} frames analisados | com mão: {hand_frames} "
      f"({hand_frames/max(1,written)*100:.1f}%)")
print(f"✓ {OUT}")
