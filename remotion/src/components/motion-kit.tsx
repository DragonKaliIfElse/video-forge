// ===========================================================================
// KIT DE MOTION — padrões extraídos por engenharia reversa (ver catalog.md)
// Todos os números vêm de medição em frames nativos 854x480.
// ===========================================================================
import React from 'react';
import {Video} from '@remotion/media';
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// ---------------------------------------------------------------------------
// Tokens do estilo (medidos)
// ---------------------------------------------------------------------------
export const T = {
  bg: '#0a0a0a',
  brand: '#01a6a2',
  brandSoft: 'rgba(1,166,162,0.14)',
  text: '#fbf9f8',
  textDim: 'rgba(255,255,255,0.65)',
  cardLight: '#ebfafc',
  dotGrid: 'rgba(255,255,255,0.085)',
  dotGridOnColor: 'rgba(0,0,0,0.06)',
  EASE_OUT: Easing.out(Easing.exp),
  EASE_SOFT: Easing.bezier(0.16, 1, 0.3, 1),
  FONT: '"Inter", "Montserrat", system-ui, sans-serif',
} as const;

// ---------------------------------------------------------------------------
// Tokens de cadência — dois regimes, escolha UM por projeto (ver ecosystem.md)
// ---------------------------------------------------------------------------
// "institucional": ritmo calmo do Onda (base 18f/0.6s). Bom para institucional.
// "talking-head": ritmo de corte de fala, medido nas referências (7f/~0.23s).
export const ENTRY = {
  institutional: {fast: 10, base: 18, slow: 24, stagger: 4},
  'talking-head': {fast: 6, base: 7, slow: 10, stagger: 5},
} as const;
export type EntryRegime = keyof typeof ENTRY;

// A1 — Dot Grid ------------------------------------------------------------
export const DotGrid: React.FC<{
  readonly color?: string;
  readonly size?: number;
  readonly opacity?: number;
}> = ({color = T.dotGrid, size = 32, opacity = 1}) => (
  <AbsoluteFill
    style={{
      backgroundImage: `radial-gradient(circle, ${color} 1px, transparent 1px)`,
      backgroundSize: `${size}px ${size}px`,
      opacity,
      pointerEvents: 'none',
    }}
  />
);

// A2 — Sparkle (estrela de 4 pontas, com brilho pulsante) -------------------
export const Sparkle: React.FC<{
  readonly x: number | string;
  readonly y: number | string;
  readonly size?: number;
  readonly phase?: number;
  readonly color?: string;
}> = ({x, y, size = 28, phase = 0, color = '#ffffff'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pulse = interpolate(
    Math.sin(((frame + phase) / (fps * 1.4)) * Math.PI * 2),
    [-1, 1],
    [0.35, 1],
  );
  return (
    <svg
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        opacity: pulse,
        filter: `drop-shadow(0 0 10px ${color})`,
      }}
      viewBox="0 0 24 24"
    >
      <path
        d="M12 1c.7 5.6 2.7 7.6 8.3 8.3v1.4C14.7 11.4 12.7 13.4 12 19c-.7-5.6-2.7-7.6-8.3-8.3v-1.4C9.3 8.6 11.3 6.6 12 1z"
        fill={color}
      />
    </svg>
  );
};

// A3 — Caixa tracejada (etiqueta) -----------------------------------------
export const DashedChip: React.FC<{
  readonly children: React.ReactNode;
  readonly from?: number;
  readonly durationInFrames?: number;
  readonly style?: React.CSSProperties;
}> = ({children, from = 0, durationInFrames, style}) => {
  const frame = useCurrentFrame();
  const {height} = useVideoConfig();
  const local = frame - from;
  if (local < 0) return null;
  if (durationInFrames !== undefined && local > durationInFrames) return null;

  const inn = interpolate(local, [0, 7], [0, 1], {
    easing: T.EASE_OUT,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        display: 'inline-block',
        border: '2px dashed rgba(255,255,255,0.78)',
        borderRadius: 8,
        padding: '7px 20px',
        fontSize: 0.032 * height,
        fontWeight: 700,
        color: T.text,
        fontFamily: T.FONT,
        opacity: inn,
        scale: interpolate(inn, [0, 1], [0.94, 1]),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// P01 / A4 — Texto gigante ATRÁS do sujeito --------------------------------
// O sujeito é recortado (máscara por frame); este texto vive atrás dele.
export const GiantBehindText: React.FC<{
  readonly text: string;
  readonly from?: number;
  readonly durationInFrames?: number;
  readonly sizeRatio?: number;
  readonly color?: string;
}> = ({text, from = 0, durationInFrames, sizeRatio = 0.24, color = T.text}) => {
  const frame = useCurrentFrame();
  const {height} = useVideoConfig();
  const local = frame - from;
  if (local < 0) return null;
  if (durationInFrames !== undefined && local > durationInFrames) return null;

  const inn = interpolate(local, [0, 6], [0, 1], {
    easing: T.EASE_OUT,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 0.06 * height,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontFamily: T.FONT,
          fontWeight: 800,
          fontSize: sizeRatio * height,
          lineHeight: 0.95,
          letterSpacing: '-0.05em',
          color,
          whiteSpace: 'nowrap',
          opacity: inn,
          scale: interpolate(inn, [0, 1], [0.9, 1]),
          textAlign: 'center',
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

// P02 — Punch Word (com ghost trail) --------------------------------------
export const PunchWord: React.FC<{
  readonly text: string;
  readonly from?: number;
  readonly durationInFrames?: number;
}> = ({text, from = 0, durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps, height} = useVideoConfig();
  const local = frame - from;
  if (local < 0) return null;
  if (durationInFrames !== undefined && local > durationInFrames) return null;

  const t = spring({frame: local, fps, config: {damping: 200}, durationInFrames: 8});
  const ghosts = local < 4 ? [6, 12, 18] : [];

  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {ghosts.map((dx, i) => (
        <div
          key={dx}
          style={{
            position: 'absolute',
            fontFamily: T.FONT,
            fontWeight: 800,
            fontSize: 0.16 * height,
            letterSpacing: '-0.03em',
            color: T.text,
            opacity: [0.25, 0.15, 0.08][i],
            translate: `${i % 2 ? -dx : dx}px 0px`,
          }}
        >
          {text}
        </div>
      ))}
      <div
        style={{
          fontFamily: T.FONT,
          fontWeight: 800,
          fontSize: 0.16 * height,
          letterSpacing: '-0.03em',
          color: T.text,
          opacity: interpolate(t, [0, 1], [0, 1]),
          scale: interpolate(t, [0, 1], [1.12, 1]),
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

// P03 — Card chapado (cor de marca) ---------------------------------------
export const BrandCard: React.FC<{
  readonly lines: readonly {text: string; size?: number; inverted?: boolean}[];
  readonly from?: number;
  readonly durationInFrames?: number;
  readonly color?: string;
  readonly sparkles?: boolean;
}> = ({lines, from = 0, durationInFrames, color = T.brand, sparkles = true}) => {
  const frame = useCurrentFrame();
  const {height} = useVideoConfig();
  const local = frame - from;
  if (local < 0) return null;
  if (durationInFrames !== undefined && local > durationInFrames) return null;

  return (
    <AbsoluteFill style={{backgroundColor: color, justifyContent: 'center', alignItems: 'center'}}>
      <DotGrid color={T.dotGridOnColor} />
      {sparkles ? (
        <>
          <Sparkle x="12%" y="26%" size={30} />
          <Sparkle x="86%" y="30%" size={26} phase={18} />
        </>
      ) : null}
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8}}>
        {lines.map((line, i) => {
          const start = i * 4;
          const p = interpolate(local, [start, start + 8], [0, 1], {
            easing: T.EASE_SOFT,
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={i}
              style={{
                fontFamily: T.FONT,
                fontWeight: 800,
                fontSize: (line.size ?? 0.055) * height,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                color: line.inverted ? '#0a0a0a' : T.text,
                opacity: p,
                translate: `0px ${(1 - p) * 20}px`,
                textAlign: 'center',
              }}
            >
              {line.text}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// P04 — Counter Slam (número antigo fica fantasma atrás) ------------------
export const CounterSlam: React.FC<{
  readonly from?: number;
  readonly values: readonly number[]; // valores sucessivos (ex.: [25, 30])
  readonly suffix?: string;
  readonly label?: string;
}> = ({from = 0, values, suffix = '', label}) => {
  const frame = useCurrentFrame();
  const {fps, height} = useVideoConfig();
  const local = frame - from;
  if (local < 0) return null;

  const perValue = Math.round(fps * 0.9);
  const idx = Math.min(values.length - 1, Math.floor(local / perValue));
  const localIdx = local - idx * perValue;
  const current = values[idx];
  const previous = idx > 0 ? values[idx - 1] : null;
  const ghost = previous !== null ? interpolate(localIdx, [0, 8], [0.35, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }) : 0;
  const inP = interpolate(localIdx, [0, 7], [0, 1], {
    easing: T.EASE_OUT,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', textAlign: 'center'}}>
        {previous !== null ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              fontFamily: T.FONT,
              fontWeight: 900,
              fontSize: 0.20 * height,
              lineHeight: 1,
              color: T.text,
              opacity: ghost,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {previous}
            {suffix}
          </div>
        ) : null}
        <div
          style={{
            fontFamily: T.FONT,
            fontWeight: 900,
            fontSize: 0.20 * height,
            lineHeight: 1,
            color: T.text,
            letterSpacing: '-0.04em',
            fontVariantNumeric: 'tabular-nums',
            opacity: inP,
            scale: interpolate(inP, [0, 1], [1.1, 1]),
          }}
        >
          {current}
          {suffix}
        </div>
        {label ? (
          <div
            style={{
              marginTop: 10,
              fontFamily: T.FONT,
              fontWeight: 700,
              fontSize: 0.03 * height,
              color: T.textDim,
              opacity: interpolate(localIdx, [4, 10], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            {label}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// P05 — Chip Row ----------------------------------------------------------
export const ChipRow: React.FC<{
  readonly items: readonly {text: string; x: number | string; y: number | string}[];
  readonly from?: number;
}> = ({items, from = 0}) => {
  const frame = useCurrentFrame();
  const {fps, height} = useVideoConfig();

  return (
    <AbsoluteFill>
      {items.map((item, i) => {
        const start = from + i * 5;
        const local = frame - start;
        if (local < 0) return null;
        const s = spring({frame: local, fps, config: {damping: 200}, durationInFrames: 8});
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: item.x,
              top: item.y,
              padding: '8px 18px',
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.14)',
              fontFamily: T.FONT,
              fontWeight: 600,
              fontSize: 0.030 * height,
              color: T.text,
              opacity: s,
              scale: interpolate(s, [0, 1], [0.92, 1]),
            }}
          >
            {item.text}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// P09 — Legenda documental (sem caixa, com palavra-âncora colorida) -------
export const DocCaption: React.FC<{
  readonly kicker?: string;
  readonly parts: readonly {text: string; accent?: boolean}[];
  readonly widthRatio?: number;
}> = ({kicker, parts, widthRatio = 0.78}) => {
  const {height, width} = useVideoConfig();
  const accent = '#f0827a';

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 0.12 * height,
      }}
    >
      <div style={{width: widthRatio * width, textAlign: 'center'}}>
        {kicker ? (
          <div
            style={{
              fontFamily: T.FONT,
              fontWeight: 600,
              fontSize: 0.017 * height,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.8)',
              marginBottom: 10,
              textShadow: '0 2px 12px rgba(0,0,0,0.9)',
            }}
          >
            {kicker}
          </div>
        ) : null}
        <div
          style={{
            fontFamily: T.FONT,
            fontWeight: 500,
            fontSize: 0.030 * height,
            lineHeight: 1.35,
            color: '#ffffff',
            textShadow: '0 2px 12px rgba(0,0,0,0.85)',
          }}
        >
          {parts.map((p, i) => (
            <span key={i} style={{color: p.accent ? accent : '#ffffff', fontWeight: p.accent ? 700 : 500}}>
              {p.text}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// P11 — Letterbox + viewfinder -------------------------------------------
export const ViewfinderFrame: React.FC<{
  readonly letterboxRatio?: number;
  readonly label?: string;
}> = ({letterboxRatio = 0.12, label}) => {
  const {height, width} = useVideoConfig();
  const bar = letterboxRatio * height;
  const inset = 0.035 * Math.min(width, height);
  const markLen = 18;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: bar, backgroundColor: '#000'}} />
      <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: bar, backgroundColor: '#000'}} />
      <div
        style={{
          position: 'absolute',
          inset: `${bar + inset}px ${inset}px`,
          border: '2px solid rgba(255,255,255,0.85)',
        }}
      />
      {[
        {k: 'tl', left: inset + 10, top: bar + inset + 10},
        {k: 'tr', right: inset + 10, top: bar + inset + 10},
        {k: 'bl', left: inset + 10, bottom: bar + inset + 10},
        {k: 'br', right: inset + 10, bottom: bar + inset + 10},
      ].map((c) => {
        const isTop = c.k[0] === 't';
        const isLeft = c.k[1] === 'l';
        return (
          <div key={c.k} style={{position: 'absolute', left: c.left, right: c.right, top: c.top, bottom: c.bottom}}>
            <div
              style={{
                width: markLen,
                height: 2,
                backgroundColor: 'rgba(255,255,255,0.85)',
                position: 'absolute',
                [isLeft ? 'left' : 'right']: 0,
                [isTop ? 'top' : 'bottom']: 0,
              }}
            />
            <div
              style={{
                width: 2,
                height: markLen,
                backgroundColor: 'rgba(255,255,255,0.85)',
                position: 'absolute',
                [isLeft ? 'left' : 'right']: 0,
                [isTop ? 'top' : 'bottom']: 0,
              }}
            />
          </div>
        );
      })}
      {label ? (
        <div
          style={{
            position: 'absolute',
            left: inset + 18,
            bottom: bar + inset + 14,
            fontFamily: T.FONT,
            fontWeight: 700,
            fontSize: 0.019 * height,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.75)',
          }}
        >
          {label}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// P06 — Logo lockup ------------------------------------------------------
export const LogoLockup: React.FC<{
  readonly symbol: React.ReactNode;
  readonly name: string;
  readonly taglines?: readonly string[];
}> = ({symbol, name, taglines = []}) => {
  const frame = useCurrentFrame();
  const {fps, height} = useVideoConfig();
  const sym = spring({frame, fps, config: {damping: 200}, durationInFrames: 12});
  const nameP = interpolate(frame, [4, 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', gap: 14}}>
      <div style={{opacity: sym, scale: interpolate(sym, [0, 1], [0.8, 1])}}>{symbol}</div>
      <div
        style={{
          fontFamily: T.FONT,
          fontWeight: 800,
          fontSize: 0.05 * height,
          color: T.text,
          opacity: nameP,
        }}
      >
        {name}
      </div>
      {taglines.map((t, i) => {
        const p = interpolate(frame, [8 + i * 4, 16 + i * 4], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const isLast = i === taglines.length - 1;
        return (
          <div
            key={i}
            style={{
              fontFamily: T.FONT,
              fontWeight: 600,
              fontSize: 0.026 * height,
              color: isLast ? T.brand : 'rgba(255,255,255,0.6)',
              opacity: p,
            }}
          >
            {t}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// Registro no Studio (props editáveis) -----------------------------------
export const GiantText = Interactive.create({
  Component: ({text, style}: {text: string; style?: React.CSSProperties}) => (
    <div
      style={{
        fontFamily: T.FONT,
        fontWeight: 800,
        fontSize: '24vh',
        letterSpacing: '-0.05em',
        color: T.text,
        ...style,
      }}
    >
      {text}
    </div>
  ),
  componentName: '<GiantText>',
  schema: {text: {type: 'string', default: 'QUATRO ANOS', hiddenFromList: false}},
});

// ===========================================================================
// A4+ — Text Behind Subject (o efeito-assinatura), com 3 camadas
// ===========================================================================
// Receita derivada do hyperframes (ver ecosystem.md):
//   z1 plate    — entorno opaco, buraco na silhueta (máscara invertida)
//   z2 conteúdo — texto/gráfico vive entre as camadas  ← o efeito
//   z3 subject  — pessoa recortada (máscara), por cima
//
// NÃO mascarar vídeo por frame no browser (2745 PNGs = 404 no bundle).
// Gere `subject.webm` (VP9 alpha) e `plate.webm` antes, ou use as duas
// variantes abaixo se preferir compor com um único vídeo de origem.
export const TextBehindSubject: React.FC<{
  /** vídeo da pessoa já recortado em VP9 com alpha */
  readonly subjectSrc: string;
  /** entorno opaco com buraco na silhueta (máscara invertida). Opcional. */
  readonly plateSrc?: string;
  readonly children: React.ReactNode;
  readonly subjectMuted?: boolean;
}> = ({subjectSrc, plateSrc, children, subjectMuted = true}) => {
  return (
    <AbsoluteFill>
      {plateSrc ? (
        <AbsoluteFill>
          <Video src={plateSrc} muted objectFit="cover" style={{width: '100%', height: '100%'}} />
        </AbsoluteFill>
      ) : null}
      {/* z2: conteúdo entre as camadas */}
      <AbsoluteFill>{children}</AbsoluteFill>
      {/* z3: pessoa por cima */}
      <AbsoluteFill>
        <Video
          src={subjectSrc}
          muted={subjectMuted}
          objectFit="cover"
          style={{width: '100%', height: '100%'}}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Variante simples: um único vídeo de fundo + texto na frente.
// NÃO é o efeito real (o texto não passa atrás da pessoa) — serve só para
// quando não há segmentação disponível. Nome honesto de propósito.
export const TextOverVideo: React.FC<{
  readonly videoSrc: string;
  readonly children: React.ReactNode;
}> = ({videoSrc, children}) => {
  return (
    <AbsoluteFill>
      <Video src={videoSrc} objectFit="cover" style={{width: '100%', height: '100%'}} />
      <AbsoluteFill>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};
