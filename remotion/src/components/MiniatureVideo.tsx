// examples/03-video-miniature.tsx
// "Tela em miniatura": o vídeo enche a tela e depois encolhe para um canto
// (PiP) liberando espaço para tabela/gráfico, com fundo desfocado do próprio vídeo.
// Requer: npx remotion add @remotion/media
import {Video} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

type MiniatureVideoProps = {
  readonly src: string;
  /** frame em que a miniaturização começa */
  readonly shrinkAtFrame: number;
  /** duração da animação em segundos */
  readonly shrinkDurationSec?: number;
  /** canto de destino */
  readonly corner?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
};

export const MiniatureVideo: React.FC<MiniatureVideoProps> = ({
  src,
  shrinkAtFrame,
  shrinkDurationSec = 0.7,
  corner = 'bottom-right',
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  const p = interpolate(
    frame,
    [shrinkAtFrame, shrinkAtFrame + shrinkDurationSec * fps],
    [0, 1],
    {
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );

  // Tela cheia → miniatura ~32% da largura, no canto escolhido
  const miniWidth = width * 0.32;
  const miniHeight = (miniWidth * 9) / 16;
  const margin = width * 0.035;

  const xTarget =
    corner === 'bottom-right' || corner === 'top-right'
      ? width - miniWidth - margin
      : margin;
  const yTarget =
    corner === 'bottom-right' || corner === 'bottom-left'
      ? height - miniHeight - margin
      : margin;

  // scale perceptual: a percepção de tamanho é log, não linear
  const scale = interpolate(p, [0, 1], [1, miniWidth / width], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    output: 'perceptual-scale',
  });
  // Deslocamento do canto do vídeo para o canto de destino
  const x = interpolate(p, [0, 1], [0, xTarget], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(p, [0, 1], [0, yTarget], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const radius = interpolate(p, [0, 1], [0, 24]);
  const shadowOpacity = interpolate(p, [0, 1], [0, 0.5]);

  return (
    <AbsoluteFill>
      {/* Fundo: o mesmo vídeo, desfocado e escurecido, cobrindo a tela */}
      <Video
        name="Background blur"
        src={src}
        muted
        style={{
          width: '100%',
          height: '100%',
          filter: `blur(${interpolate(p, [0, 1], [0, 28])}px) brightness(${interpolate(p, [0, 1], [1, 0.45])})`,
          scale: 1.1, // esconde bordas do blur
        }}
        objectFit="cover"
      />

      {/* Vídeo principal: encolhe para o canto */}
      <Video
        name="Miniature"
        src={src}
        style={{
          width,
          height,
          transformOrigin: '0 0',
          scale,
          translate: `${x}px ${y}px`,
          borderRadius: radius,
          overflow: 'hidden',
          boxShadow: `0 ${16 * p}px ${64 * p}px rgba(0,0,0,${shadowOpacity})`,
          border: `${interpolate(p, [0, 1], [0, 4])}px solid rgba(255,255,255,0.9)`,
        }}
        objectFit="cover"
      />

      {/* Aqui entra o conteúdo que aparece no espaço liberado:
          <DynamicTable .../>, <VerticalBarChart .../>, <TitleBlock .../> */}
    </AbsoluteFill>
  );
};

// Uso:
// <MiniatureVideo src={staticFile('entrevista.mp4')} shrinkAtFrame={4 * fps} />
// Dica: mantenha o áudio apenas na camada principal (o fundo fica `muted`).
// Para reverter (mini → tela cheia) no fim, interpole p de 1 a 0.
