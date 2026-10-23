// examples/06-vertical-bar-chart.tsx
// Gráfico de barras animado (crescimento com spring + rótulo sobe com clip).
// Fonte oficial: remotion.dev/elements/data/vertical-bar-chart/ (simplificado)
// Outros Elements prontos: horizontal-bar-chart, line-chart, pie-chart
// (https://www.remotion.dev/elements/data/). Para gráficos complexos use
// @remotion/paths (drawsvg) e @remotion/shapes.
import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';

const growthEasing = Easing.spring({
  damping: 14.5,
  mass: 0.8,
  overshootClamping: false,
  stiffness: 100,
});

export type Bar = {label: string; value: number; highlighted?: boolean};

const BarColumn: React.FC<{
  readonly bar: Bar;
  readonly maxValue: number;
  readonly animationDelay: number;
}> = ({bar, maxValue, animationDelay}) => {
  const frame = useCurrentFrame();
  const start = 22 + animationDelay;
  const end = start + 16 + Math.round((bar.value / maxValue) * 8);

  const growthProgress =
    frame >= end
      ? 1
      : interpolate(frame, [start, end], [0, 1], {
          easing: growthEasing,
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

  const labelProgress = interpolate(frame, [end - 8, end + 2], [0, 1], {
    easing: growthEasing,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 20, width: 280}}>
      <div style={{display: 'flex', alignItems: 'flex-end', flex: 1}}>
        <div
          style={{
            height: `${(bar.value / maxValue) * 90}%`,
            position: 'relative',
            width: '100%',
          }}
        >
          {/* valor sobe com clip (overflow hidden até terminar) */}
          <div
            style={{
              bottom: `calc(${growthProgress * 100}% + 12px)`,
              left: 0,
              width: '100%',
              position: 'absolute',
              overflow: frame < end ? 'hidden' : 'visible',
            }}
          >
            <div style={{translate: `0 ${(1 - labelProgress) * 100}%`}}>
              <Interactive.Div
                name="Value"
                style={{
                  fontSize: 48,
                  fontWeight: 800,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                {bar.value}
              </Interactive.Div>
            </div>
          </div>
          {/* barra cresce */}
          <div
            style={{
              bottom: 0,
              height: `${growthProgress * 100}%`,
              width: '100%',
              position: 'absolute',
            }}
          >
            <Interactive.Div
              name="Bar"
              style={{
                backgroundColor: bar.highlighted ? '#2563eb' : '#b9c0ca',
                borderRadius: '12px 12px 0 0',
                height: '100%',
                width: '100%',
              }}
            />
          </div>
        </div>
      </div>
      {/* rótulo sobe com clip */}
      <div style={{overflow: frame < end ? 'hidden' : 'visible'}}>
        <div style={{translate: `0 ${(1 - growthProgress) * 100}%`}}>
          <Interactive.Div
            name="Label"
            style={{fontSize: 40, fontWeight: 700, textAlign: 'center'}}
          >
            {bar.label}
          </Interactive.Div>
        </div>
      </div>
    </div>
  );
};

const VerticalBarChartInner: React.FC<{
  readonly data?: readonly Bar[];
  readonly style?: React.CSSProperties;
}> = ({
  data = [
    {label: 'Etapa A', value: 34},
    {label: 'Etapa B', value: 89},
    {label: 'Etapa C', value: 163, highlighted: true},
  ],
  style,
}) => {
  const maxValue = Math.max(...data.map((d) => d.value));
  return (
    <Interactive.Div
      name="Background"
      showInTimeline={false}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f6f7',
        height: '100%',
        width: '100%',
        padding: 56,
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          width: 1080,
          height: '100%',
          position: 'relative',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {/* linha de base */}
        <div
          style={{
            bottom: 68,
            left: 0,
            position: 'absolute',
            width: '100%',
            height: 3,
            backgroundColor: '#c5cad2',
            zIndex: 1,
          }}
        />
        {data.map((bar, i) => (
          <BarColumn
            key={bar.label}
            bar={bar}
            maxValue={maxValue}
            animationDelay={i * 24}
          />
        ))}
      </div>
    </Interactive.Div>
  );
};

export const VerticalBarChart = Interactive.create({
  Component: VerticalBarChartInner,
  componentName: '<VerticalBarChart>',
});
