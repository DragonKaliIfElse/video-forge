"""Gera as camadas alpha do efeito text-behind-subject (receita hyperframes).

  subject.webm — RGB do vídeo, alpha = máscara  (pessoa opaca)
  plate.webm   — RGB do vídeo, alpha = inverso  (entorno opaco, buraco na pessoa)

Usa `alphamerge` (a máscara entra como canal alpha). O `geq` do FFmpeg não
aceita duas entradas, então aplicar inversão é feito na própria máscara.

Uso: python tools/make_layers.py [PUBLIC_DIR]
"""
import subprocess
import sys
from pathlib import Path

PUB = Path(sys.argv[1] if len(sys.argv) > 1 else "/home/an4tm4n/projetos/video-sem-espelho/public")
VIDEO = PUB / "cut.mp4"
MASKS = PUB / "mask-cut"
W, H = 1280, 720


def build(invert: bool, out: Path) -> None:
    invert_filter = ",negate" if invert else ""
    fc = (
        f"[1:v]format=gray,scale={W}:{H}{invert_filter}[m];"
        f"[0:v]format=rgba[fg];"
        f"[fg][m]alphamerge[out]"
    )
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error",
         "-i", str(VIDEO), "-framerate", "30", "-i", str(MASKS / "%05d.png"),
         "-filter_complex", fc, "-map", "[out]",
         "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
         "-crf", "18", "-b:v", "0", "-auto-alt-ref", "0",
         "-shortest", str(out)],
        check=True,
    )
    mb = out.stat().st_size / 1024 / 1024
    print(f"✓ {out.name}  {mb:.1f} MB")


print(f"vídeo: {VIDEO}")
print(f"máscaras: {len(list(MASKS.glob('*.png')))}")
build(invert=False, out=PUB / "subject.webm")
build(invert=True, out=PUB / "plate.webm")
