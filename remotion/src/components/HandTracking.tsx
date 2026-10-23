// Tracking de mão: desenha os 21 pontos e o esqueleto sobre a mão real.
// Pedido no vídeo aos ~62.9s ("mapear a minha mão e identificar todos os dedos").
import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {handAt, type HandFrame} from '../lib/useData';

// conexões do esqueleto (índices do MediaPipe hand_landmarker)
const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],            // polegar
  [0, 5], [5, 6], [6, 7], [7, 8],            // indicador
  [5, 9], [9, 10], [10, 11], [11, 12],       // médio
  [9, 13], [13, 14], [14, 15], [15, 16],     // anelar
  [13, 17], [17, 18], [18, 19], [19, 20],    // mínimo
  [0, 17],                                   // palma
];

type HandOverlayProps = {
  readonly frames: HandFrame[];
  readonly width: number;
  readonly height: number;
  readonly color?: string;
  readonly showLabels?: boolean;
  readonly fadeInFrames?: number;
  /** ms para somar (o frame dentro de <Sequence> é local) */
  readonly offsetMs?: number;
};

export const HandOverlay: React.FC<HandOverlayProps> = ({
  frames,
  width,
  height,
  color = '#22d3ee',
  showLabels = false,
  fadeInFrames = 8,
  offsetMs = 0,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tMs = ((frame / fps) * 1000) + offsetMs;
  const hf = handAt(frames, tMs);
  if (!hf) return null;

  const alpha = interpolate(frame, [0, fadeInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const scale = Math.min(width, height) / 720; // espessura proporcional

  return (
    <svg
      style={{position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: alpha}}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="handGlow">
          <feGaussianBlur stdDeviation={3 * scale} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {hf.hands.map((hand, hi) => {
        const pts = hand.p.map(([x, y]) => [x * width, y * height] as const);
        return (
          <g key={hi} filter="url(#handGlow)">
            {CONNECTIONS.map(([a, b], ci) => (
              <line
                key={ci}
                x1={pts[a][0]}
                y1={pts[a][1]}
                x2={pts[b][0]}
                y2={pts[b][1]}
                stroke={color}
                strokeWidth={3.5 * scale}
                strokeLinecap="round"
                opacity={0.85}
              />
            ))}
            {pts.map(([x, y], pi) => {
              const tip = [4, 8, 12, 16, 20].includes(pi);
              const r = (tip ? 7 : pi === 0 ? 8 : 4.5) * scale;
              return (
                <g key={pi}>
                  <circle cx={x} cy={y} r={r + 2.5 * scale} fill={color} opacity={0.25} />
                  <circle cx={x} cy={y} r={r} fill={tip ? '#f472b6' : color} />
                  {showLabels ? (
                    <text
                      x={x + 10 * scale}
                      y={y - 8 * scale}
                      fill="#ffffff"
                      fontSize={13 * scale}
                      fontFamily="Inter, sans-serif"
                      fontWeight={700}
                      opacity={0.9}
                    >
                      {pi}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
};

// Caixa de conteúdo ancorada entre as mãos, com AUTO-FIT.
// Requisito: o conteúdo NUNCA é cortado — ele é escalado para caber no espaço
// disponível entre as palmas. A caixa estica/encolhe junto com a distância.
export const HandAnchoredBox: React.FC<{
  readonly frames: HandFrame[];
  readonly width: number;
  readonly height: number;
  readonly children: React.ReactNode;
  /** fração máxima da menor dimensão da tela (teto, não tamanho fixo) */
  readonly maxSizeRatio?: number;
  /** quanto do vão entre as mãos pode ser ocupado (0..1) */
  readonly gapFill?: number;
  readonly offsetY?: number;
  readonly offsetMs?: number;
  readonly anchor?: 'between' | 'single';
  /** tamanho de design do conteúdo (px). Usado para calcular a escala. */
  readonly contentWidth?: number;
  readonly contentHeight?: number;
}> = ({
  frames,
  width,
  height,
  children,
  maxSizeRatio = 0.62,
  gapFill = 0.94,
  offsetY = -0.02,
  offsetMs = 0,
  anchor = 'between',
  contentWidth = 520,
  contentHeight = 460,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const hf = handAt(frames, ((frame / fps) * 1000) + offsetMs);
  if (!hf || !hf.hands.length) return null;

  // base da palma (9) com fallback no pulso (0)
  const palms = hf.hands.map((h) => h.p[9] ?? h.p[0]);
  const twoHands = palms.length >= 2;

  const cx =
    anchor === 'between' && twoHands
      ? ((palms[0][0] + palms[1][0]) / 2) * width
      : palms[0][0] * width;
  const cy =
    anchor === 'between' && twoHands
      ? ((palms[0][1] + palms[1][1]) / 2) * height
      : palms[0][1] * height;

  // --- espaço disponível ---
  // horizontal: vão entre as palmas (ou teto da tela se uma mão só)
  // vertical: sempre limitado pela tela, com margem para a moldura
  const gapPx = twoHands
    ? Math.hypot(
        (palms[1][0] - palms[0][0]) * width,
        (palms[1][1] - palms[0][1]) * height,
      )
    : Math.min(width, height) * maxSizeRatio;

  const availW = Math.min(
    twoHands ? gapPx * gapFill : Math.min(width, height) * maxSizeRatio,
    width * 0.78,                     // nunca maior que a tela
  );
  const availH = Math.min(
    height * 0.80,                    // margem vertical (letterbox)
    availW * (contentHeight / contentWidth) * 1.35,
  );

  // --- auto-fit: escala o conteúdo para caber SEM cortar ---
  const scale = Math.min(availW / contentWidth, availH / contentHeight);
  const boxW = contentWidth * scale;
  const boxH = contentHeight * scale;

  // posiciona centrado nas mãos, sem sair da tela
  const left = Math.max(10, Math.min(width - boxW - 10, cx - boxW / 2));
  const wantedTop = cy - boxH / 2 + offsetY * height;
  const top = Math.max(height * 0.04, Math.min(height * 0.96 - boxH, wantedTop));

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: boxW,
        height: boxH,
        borderRadius: 18 * Math.min(1, scale),
        overflow: 'hidden',
        boxShadow: '0 18px 60px rgba(0,0,0,0.55), 0 0 0 2px rgba(34,211,238,0.55)',
        backgroundColor: 'rgba(15,23,42,0.94)',
      }}
    >
      {/* o conteúdo é desenhado no tamanho de design e escalado como um todo:
          assim nenhuma linha é cortada, só reduzida */}
      <div
        style={{
          width: contentWidth,
          height: contentHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
};
