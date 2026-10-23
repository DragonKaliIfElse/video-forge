// examples/02-title-lower-third.tsx
// Título animado (pop com spring) + subtítulo deslizando + barra que se desenha.
// Requer: npx remotion add @remotion/google-fonts
import {loadFont} from '@remotion/google-fonts/Inter';
import React from 'react';
import {
  Easing,
  Interactive,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const {fontFamily} = loadFont('normal', {
  weights: ['700', '800'],
  subsets: ['latin'],
});

type TitleBlockProps = {
  readonly title: string;
  readonly subtitle?: string;
};

const TitleBlockInner: React.FC<
  TitleBlockProps & {readonly style?: React.CSSProperties}
> = ({title, subtitle, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // Título: pop com spring (sem bounce: damping 200)
  const titleIn = spring({
    frame,
    fps,
    config: {damping: 200},
    durationInFrames: Math.round(0.3 * fps),
  });
  const titleScale = interpolate(titleIn, [0, 1], [0.85, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    output: 'perceptual-scale', // obrigatório em animações de scale
  });
  const titleOpacity = interpolate(frame, [0, 0.3 * fps], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Subtítulo: sobe 24px com atraso de 6 frames
  const subtitleProgress = interpolate(
    frame,
    [6, 6 + Math.round(0.3 * fps)],
    [0, 1],
    {
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );

  // Barra: desenha da esquerda para a direita
  const barWidth = interpolate(frame, [3, 3 + Math.round(0.4 * fps)], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        fontFamily,
        ...style,
      }}
    >
      <div
        style={{
          fontSize: 96,
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '-0.02em',
          lineHeight: 1.05,
          opacity: titleOpacity,
          scale: titleScale,
          translate: '0px 0px',
          textShadow: '0 4px 24px rgba(0,0,0,0.45)',
        }}
      >
        {title}
      </div>
      <div
        style={{
          height: 10,
          width: `${barWidth * 100}%`,
          maxWidth: 640,
          backgroundColor: '#2563eb',
          borderRadius: 6,
        }}
      />
      {subtitle ? (
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: '#e5e7eb',
            lineHeight: 1.2,
            opacity: subtitleProgress,
            translate: `0px ${(1 - subtitleProgress) * 24}px`,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
};

// Studio-editable: nome + schema deixam os campos editáveis na timeline.
// NOTA API (v4.0.536): NÃO use `layout: 'absolute-fill'` quando o componente
// aceita `style`; campos de schema precisam de `hiddenFromList`; e não use
// nomes de props reservados (from, name, durationInFrames, trimBefore,
// playbackRate, loop, freeze, hidden...).
export const TitleBlock = Interactive.create({
  Component: TitleBlockInner,
  componentName: '<TitleBlock>',
  schema: {
    title: {type: 'string', default: 'Título aqui', hiddenFromList: false},
    subtitle: {type: 'string', default: 'Subtítulo de apoio', hiddenFromList: false},
  },
});

// Uso com timing inline (um nó por elemento editável):
// <TitleBlock name="Title" title="Obra concluída" subtitle="Prazo: 12 meses" from={30} durationInFrames={90} />
