#!/usr/bin/env python3
"""forge.py — pipeline unificado do Video Forge.

Um comando encadeia tudo: transcrição → corte de silêncio → máscaras →
tracking → assets para o Remotion.

Exemplos:
    # pipeline completo a partir de um vídeo falado
    python forge.py run input/gravacao.mp4 --project meu-video

    # só a parte de análise (sem gerar assets)
    python forge.py analyze input/gravacao.mp4

    # listar o que cada etapa produz
    python forge.py steps

    # verificar ambiente (venv, modelos, ffmpeg, node)
    python forge.py doctor

Saídas (dentro de <workspace>/):
    transcript.json  words.json  cuts.json  silences.json
    cut.mp4  tracking.jsonl  hands.json  masks/  text-behind.mp4
    assets/  (pronto para copiar para public/ do Remotion)
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SKILL = ROOT.parent

# ---------------------------------------------------------------- helpers
def log(msg: str) -> None:
    print(f"\033[36m▸\033[0m {msg}", flush=True)


def ok(msg: str) -> None:
    print(f"\033[32m✓\033[0m {msg}", flush=True)


def warn(msg: str) -> None:
    print(f"\033[33m!\033[0m {msg}", flush=True)


def die(msg: str) -> None:
    print(f"\033[31m✗\033[0m {msg}", file=sys.stderr)
    raise SystemExit(1)


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=True, **kw)


def py(script: str, *args: str, cwd: Path | None = None) -> None:
    """Roda um script do pacote com o Python atual."""
    run([sys.executable, str(SKILL / "scripts" / script), *args], cwd=cwd or Path.cwd())


def probe(path: Path) -> dict:
    out = run(
        ["ffprobe", "-v", "error", "-show_entries",
         "stream=codec_type,width,height,r_frame_rate", "-show_entries",
         "format=duration", "-of", "json", str(path)],
        capture_output=True, text=True,
    ).stdout
    return json.loads(out)


# ---------------------------------------------------------------- doctor
REQUIRED_MODELS = {
    "hand_landmarker.task": "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    "pose_landmarker.task": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    "selfie_segmenter.tflite": "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite",
}

PY_DEPS = ["faster_whisper", "mediapipe", "cv2", "numpy"]


def cmd_doctor(args: argparse.Namespace) -> int:
    problems = 0
    log("verificando ambiente")

    # ffmpeg
    try:
        v = run(["ffmpeg", "-version"], capture_output=True, text=True).stdout.split("\n")[0]
        ok(f"ffmpeg — {v[:60]}")
    except (FileNotFoundError, subprocess.CalledProcessError):
        warn("ffmpeg não encontrado no PATH")
        problems += 1

    # node
    try:
        v = run(["node", "--version"], capture_output=True, text=True).stdout.strip()
        ok(f"node — {v}")
    except (FileNotFoundError, subprocess.CalledProcessError):
        warn("node não encontrado (necessário só para o Remotion)")
        problems += 1

    # deps python
    missing = []
    for dep in PY_DEPS:
        try:
            __import__(dep)
        except ImportError:
            missing.append(dep)
    if missing:
        warn(f"deps Python faltando: {', '.join(missing)}")
        print("    instale com:")
        print("      uv venv --python 3.12 .venv")
        print("      uv pip install --python .venv/bin/python faster-whisper "
              '"mediapipe==0.10.14" "numpy<2" opencv-python')
        print("    (mediapipe 1.1.x foi morto por OOM nesta máquina; fixe 0.10.14)")
        problems += 1
    else:
        import mediapipe
        import numpy
        ok(f"python deps — mediapipe {mediapipe.__version__}, numpy {numpy.__version__}")

    # modelos
    models_dir = Path(args.models_dir)
    if models_dir.exists():
        have = {p.name for p in models_dir.iterdir()}
        falta = [m for m in REQUIRED_MODELS if m not in have]
        if falta:
            warn(f"modelos faltando em {models_dir}: {', '.join(falta)}")
            print("    baixe com:")
            for m in falta:
                print(f"      curl -sL -o {models_dir}/{m} '{REQUIRED_MODELS[m]}'")
            problems += 1
        else:
            ok(f"modelos — {len(REQUIRED_MODELS)} presentes em {models_dir}")
    else:
        warn(f"{models_dir} não existe")
        problems += 1

    print()
    if problems:
        warn(f"{problems} ponto(s) de atenção")
    else:
        ok("ambiente pronto")
    return 0 if problems == 0 else 1


# ---------------------------------------------------------------- steps
STEPS = [
    ("probe", "metadados + hash da fonte", ""),
    ("transcribe", "faster-whisper com word timestamps", "transcript.json"),
    ("plan-cuts", "Silero VAD + proteção de palavra", "cuts.json, silences.json"),
    ("apply-cuts", "concat dos trechos mantidos", "cut.mp4"),
    ("words", "palavras remapeadas para o tempo final", "words.json"),
    ("segment", "silhueta do sujeito por frame", "masks/"),
    ("track", "21 pontos de mão + pose", "tracking.jsonl, hands.json"),
    ("text-behind", "pré-compõe vídeo + texto + recorte", "text-behind.mp4"),
    ("assets", "reúne tudo em assets/ para o Remotion", "assets/"),
]


def cmd_steps(args: argparse.Namespace) -> int:
    print("etapas do pipeline:\n")
    for i, (name, desc, out) in enumerate(STEPS, 1):
        print(f"  {i}. \033[1m{name:14s}\033[0m {desc}")
        if out:
            print(f"     {'':14s} → {out}")
    print()
    print("pule etapas com --skip track,segment  (economiza ~15 min)")
    return 0


# ---------------------------------------------------------------- assets
def build_assets(ws: Path) -> None:
    """Monta assets/ no formato que o Remotion espera em public/."""
    assets = ws / "assets"
    assets.mkdir(exist_ok=True)
    for name in ("cut.mp4", "text-behind.mp4"):
        src = ws / name
        if src.exists():
            shutil.copy2(src, assets / name)
    for name in ("words.json", "hands.json", "cuts.json"):
        src = ws / name
        if src.exists():
            shutil.copy2(src, assets / name)
    ok(f"assets prontos em {assets}")


# ---------------------------------------------------------------- run
def cmd_run(args: argparse.Namespace) -> int:
    src = Path(args.source).resolve()
    if not src.exists():
        die(f"fonte não encontrada: {src}")

    ws = Path(args.project).resolve()
    ws.mkdir(parents=True, exist_ok=True)
    (ws / "work").mkdir(exist_ok=True)
    os.chdir(ws)

    skip = {s.strip() for s in (args.skip or "").split(",") if s.strip()}
    models_dir = Path(args.models_dir).resolve()

    # 1. probe
    meta = probe(src)
    vs = next(s for s in meta["streams"] if s["codec_type"] == "video")
    dur = float(meta["format"]["duration"])
    log(f"fonte: {src.name} — {vs['width']}x{vs['height']} {dur:.1f}s")

    # 2. áudio
    wav = ws / "work" / "audio.wav"
    if not wav.exists():
        log("extraindo áudio 16k mono")
        run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vn",
             "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(wav)])
    ok(f"áudio: {wav.name}")

    # 3. transcrição
    if "transcribe" not in skip:
        log(f"transcrevendo (whisper, lang={args.lang})")
        if not (ws / "transcript.json").exists():
            py("transcribe.py", str(wav), str(args.min_silence_ms), cwd=ws)
        else:
            warn("transcript.json já existe — pulando")
        ok("transcrição pronta")
    else:
        warn("transcrição pulada (--skip)")

    # 4. cortes
    if "plan-cuts" not in skip:
        log(f"planejando cortes (silêncio >= {args.min_silence_ms}ms)")
        py("plan_cuts.py", str(wav), "transcript.json",
           str(args.min_silence_ms), str(src), cwd=ws)
        ok("plano de corte pronto")
    else:
        warn("cortes pulados (--skip)")

    # 5. aplicar cortes
    if (ws / "cuts.json").exists() and "apply-cuts" not in skip:
        log("aplicando cortes")
        py("apply_cuts.py", str(ws), "--source", str(src), cwd=ws)
        ok("cut.mp4 gerado")
    elif not (ws / "cuts.json").exists():
        warn("sem cuts.json — usando a fonte inteira")
        shutil.copy2(src, ws / "cut.mp4")

    # 6. palavras remapeadas
    log("remapeando palavras para o tempo final")
    run([sys.executable, str(SKILL / "scripts" / "make_words.py"), str(ws)])

    # 7. máscaras
    if "segment" not in skip:
        log("segmentando sujeito (pode levar ~8 min/100s)")
        masks = ws / "masks"
        if not masks.exists() or not list(masks.glob("*.png")):
            py("segment.py", str(ws / "cut.mp4"), str(masks),
               cwd=ws, )
            ok("máscaras prontas")
        else:
            warn("masks/ já existe — pulando")
    else:
        warn("segmentação pulada (--skip)")

    # 8. tracking
    if "track" not in skip:
        log("rastreando mãos + pose (pode levar ~12 min/100s)")
        if not (ws / "tracking.jsonl").exists():
            run([sys.executable, str(SKILL / "scripts" / "track.py"),
                 str(ws / "cut.mp4"), str(ws / "tracking.jsonl"), "1"])
        run([sys.executable, str(SKILL / "scripts" / "make_hands.py"), str(ws)])
        ok("tracking pronto")
    else:
        warn("tracking pulado (--skip)")

    # 9. text-behind
    if (ws / "masks").exists() and "text-behind" not in skip:
        log("pré-compondo efeito text-behind-subject")
        pubs = ws / "assets"
        pubs.mkdir(exist_ok=True)
        shutil.copy2(ws / "cut.mp4", pubs / "cut.mp4")
        if not (pubs / "mask-cut").exists():
            shutil.copytree(ws / "masks", pubs / "mask-cut")
        run([sys.executable, str(SKILL / "scripts" / "bake_text_behind.py"), str(pubs)])
        ok("text-behind.mp4 gerado")

    # 10. assets
    build_assets(ws)

    print()
    ok(f"projeto pronto: {ws}")
    print(f"\n  próximo passo:")
    print(f"    cp {ws}/assets/* ../remotion/public/")
    print(f"    cd ../remotion && npm run dev")
    print(f"\n  e edite src/Main.tsx (CUES) com os tempos que você quer animar.")
    return 0


def cmd_analyze(args: argparse.Namespace) -> int:
    """Só análise: transcrição + cortes + relatório (sem assets)."""
    ns = argparse.Namespace(**vars(args))
    ns.skip = "segment,track,text-behind"
    return cmd_run(ns)


# ---------------------------------------------------------------- main
def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Veja também: docs/WORKFLOW.md",
    )
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_doctor = sub.add_parser("doctor", help="verifica ambiente")
    p_doctor.add_argument("--models-dir", default=os.environ.get("FORGE_MODELS", "models"))
    p_doctor.set_defaults(fn=cmd_doctor)

    p_steps = sub.add_parser("steps", help="lista as etapas")
    p_steps.set_defaults(fn=cmd_steps)

    for name, fn, help_ in [
        ("run", cmd_run, "pipeline completo"),
        ("analyze", cmd_analyze, "só análise (sem máscaras/tracking)"),
    ]:
        p = sub.add_parser(name, help=help_)
        p.add_argument("source", help="vídeo de entrada")
        p.add_argument("--project", required=True, help="diretório do workspace")
        p.add_argument("--lang", default="pt", help="idioma do ASR (default pt)")
        p.add_argument("--min-silence-ms", type=int, default=100,
                       help="duração mínima de silêncio para cortar (default 100)")
        p.add_argument("--skip", default="", help="etapas a pular, ex: track,segment")
        p.add_argument("--models-dir", default=os.environ.get("FORGE_MODELS", "models"))
        p.set_defaults(fn=fn)

    args = ap.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    raise SystemExit(main())
