// examples/05-number-counter.tsx
// Contador numérico animado. Fonte oficial: remotion.dev/elements/data/number-counter/
// Requer: npx remotion add @remotion/google-fonts
import {loadFont} from '@remotion/google-fonts/Inter';
import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

loadFont('normal', {subsets: ['latin'], weights: ['800']});

type NumberCounterProps = {
  // não use `from`/`to`: `from` é prop reservado de timing no Interactive.create
  readonly startAt?: number;
  readonly endAt: number;
  readonly prefix?: string;
  readonly suffix?: string;
};

const NumberCounterInner: React.FC<
  NumberCounterProps & {readonly style?: React.CSSProperties}
> = ({startAt = 0, endAt, prefix = '', suffix = '', style}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const progress = interpolate(frame, [0, durationInFrames * 0.75], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.exp), // rápido no início, assenta no fim
  });

  const current = Math.round(startAt + progress * (endAt - startAt));

  return (
    <Interactive.Div
      name="Container"
      showInTimeline={false}
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter',
        fontSize: 150,
        fontWeight: 800,
        color: '#171717',
        fontVariantNumeric: 'tabular-nums', // dígitos não "pulam"
        letterSpacing: '-0.03em',
        lineHeight: 1,
        ...style,
      }}
    >
      {prefix}
      {current.toLocaleString('pt-BR')}
      {suffix}
    </Interactive.Div>
  );
};

export const NumberCounter = Interactive.create({
  Component: NumberCounterInner,
  componentName: '<NumberCounter>',
  schema: {
    startAt: {type: 'number', default: 0, hiddenFromList: false},
    endAt: {type: 'number', default: 24813, hiddenFromList: false},
    prefix: {type: 'string', default: '', hiddenFromList: false},
    suffix: {type: 'string', default: '', hiddenFromList: false},
  },
});
