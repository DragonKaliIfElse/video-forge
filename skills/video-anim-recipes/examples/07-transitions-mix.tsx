// examples/07-transitions-mix.tsx
// Transições entre cenas/cortes: fade, slide com direção, wipe, apresentação
// custom, e overlay (light leak) que NÃO encurta a timeline.
// Requer: npx remotion add @remotion/transitions @remotion/effects
// Render com efeitos WebGL: Config.setChromiumOpenGlRenderer('angle')
import {lightLeak} from '@remotion/effects/light-leak';
import React from 'react';
import {
  AbsoluteFill,
  Interactive,
  interpolate,
  Solid,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {TransitionSeries, linearTiming, springTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {slide} from '@remotion/transitions/slide';
import {wipe} from '@remotion/transitions/wipe';

// ---------------------------------------------------------------------------
// Apresentação custom: o slide de exemplo do docs oficial
// ---------------------------------------------------------------------------
import type {TransitionPresentationComponentProps} from '@remotion/transitions';

export const SlideInPresentation = ({
  children,
  presentationDirection,
  presentationProgress,
}: TransitionPresentationComponentProps<Record<string, never>>) => {
  if (presentationDirection === 'exiting') return <>{children}</>;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          translate: `${(1 - presentationProgress) * 100}% 0`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Overlay de light leak (padrão do docs oficial; não encurta a timeline)
// ---------------------------------------------------------------------------
const LightLeakOverlayInner: React.FC<{readonly style?: React.CSSProperties}> = ({
  style,
}) => {
  const frame = useCurrentFrame();
  const {durationInFrames, width, height} = useVideoConfig();
  return (
    <Solid
      width={width}
      height={height}
      style={style}
      effects={[
        lightLeak({
          progress: interpolate(frame, [0, durationInFrames - 1], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }),
      ]}
    />
  );
};

export const LightLeakOverlay = Interactive.create({
  Component: LightLeakOverlayInner,
  layout: 'none',
});

// Cena placeholder — na prática, cada cena é um componente próprio
const Scene: React.FC<{readonly bg: string; readonly label: string}> = ({
  bg,
  label,
}) => (
  <AbsoluteFill
    style={{
      backgroundColor: bg,
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 84,
      color: '#fff',
    }}
  >
    {label}
  </AbsoluteFill>
);

// ---------------------------------------------------------------------------
// Timeline com os 4 tipos de enfeite de corte.
// Duração total = soma das cenas − soma das transições (overlays não contam).
// Exemplo: 60+60+60+60 − (15+20+15) = 190 frames @30fps
// ---------------------------------------------------------------------------
export const TransitionsMix: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence name="Abertura" durationInFrames={60}>
      <Scene bg="#111111" label="Abertura" />
    </TransitionSeries.Sequence>

    {/* fade com spring — orgânico, sem bounce */}
    <TransitionSeries.Transition
      presentation={fade()}
      timing={springTiming({config: {damping: 200}, durationInFrames: 15})}
    />

    <TransitionSeries.Sequence name="Conteúdo" durationInFrames={60}>
      <Scene bg="#243b53" label="Conteúdo" />
    </TransitionSeries.Sequence>

    {/* slide com direção */}
    <TransitionSeries.Transition
      presentation={slide({direction: 'from-left'})}
      timing={linearTiming({durationInFrames: 20})}
    />

    <TransitionSeries.Sequence name="Dados" durationInFrames={60}>
      <Scene bg="#382345" label="Dados" />
    </TransitionSeries.Sequence>

    {/* overlay NÃO encurta a timeline; pode ser combinado com transições
        (separe overlay e transição com uma cena entre eles) */}
    <TransitionSeries.Overlay durationInFrames={30}>
      <LightLeakOverlay name="Light leak" />
    </TransitionSeries.Overlay>

    {/* wipe */}
    <TransitionSeries.Transition
      presentation={wipe()}
      timing={linearTiming({durationInFrames: 15})}
    />

    <TransitionSeries.Sequence name="Encerramento" durationInFrames={60}>
      <Scene bg="#166534" label="Encerramento" />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);

// Tipos disponíveis: fade, slide, wipe, flip, clockWipe
// import {flip} from '@remotion/transitions/flip';
// import {clockWipe} from '@remotion/transitions/clock-wipe';
// Custom: presentation={{component: SlideInPresentation, props: {}}}
// Efeitos alternativos: pixelDissolve, venetianBlinds (@remotion/effects/...)
