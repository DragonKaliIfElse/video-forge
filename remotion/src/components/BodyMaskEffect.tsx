// Efeito "recortar o corpo e trocar o fundo" (pedido no vídeo aos ~14.6s).
// Usa a máscara de silhueta gerada pelo MediaPipe Selfie Segmenter (1 PNG por frame).
// O fundo roxo entra com uma borda luminosa (glow) animada.
import {Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, Easing} from 'remotion';
import React from 'react';

type BodyMaskProps = {
  /** frame de saída onde o efeito começa */
  readonly startFrame: number;
  readonly endFrame: number;
  /** duração total do vídeo em frames (para achar o índice da máscara) */
  readonly timelineStartFrame?: number;
  readonly purple?: string;
};

export const BodyMaskEffect: React.FC<BodyMaskProps> = ({
  startFrame,
  endFrame,
  timelineStartFrame = 0,
  purple = '#7c3aed',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = frame - startFrame;
  if (local < 0) return null;

  const dur = endFrame - startFrame;
  const ease = Easing.bezier(0.16, 1, 0.3, 1);

  // entrada/saída suaves
  const enter = interpolate(local, [0, 0.35 * fps], [0, 1], {
    easing: ease,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exit = interpolate(local, [dur - 0.4 * fps, dur], [1, 0], {
    easing: ease,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const vis = Math.min(enter, exit);

  // índice global da máscara (as máscaras foram geradas no tempo de SAÍDA)
  const globalFrame = frame + timelineStartFrame;
  const maskPath = staticFile(`masks/${String(globalFrame).padStart(5, '0')}.png`);

  return (
    <>
      {/* Fundo roxo atrás de tudo */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 50% 45%, ${purple} 0%, #3b0764 70%, #1e0533 100%)`,
          opacity: vis,
        }}
      />
      {/* Silhueta da pessoa recortada (o vídeo aparece só dentro da máscara) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: vis,
          WebkitMaskImage: `url('${maskPath}')`,
          maskImage: `url('${maskPath}')`,
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
          filter: 'drop-shadow(0 0 24px rgba(167,139,250,0.75))',
        }}
      />
      {/* Borda/glow animado acompanhando o contorno */}
      <Img
        src={maskPath}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: vis * 0.35,
          filter: 'blur(6px) brightness(1.8) drop-shadow(0 0 12px #a78bfa)',
          mixBlendMode: 'screen',
        }}
      />
    </>
  );
};

// Versão simples: aplica a máscara num <Img> do próprio frame do vídeo
export const MaskedVideo: React.FC<{
  readonly videoSrc: string;
  readonly maskSrc: string;
  readonly style?: React.CSSProperties;
}> = ({videoSrc, maskSrc, style}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      WebkitMaskImage: `url('${maskSrc}')`,
      maskImage: `url('${maskSrc}')`,
      WebkitMaskSize: '100% 100%',
      maskSize: '100% 100%',
      ...style,
    }}
  >
    <Img src={videoSrc} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
  </div>
);
