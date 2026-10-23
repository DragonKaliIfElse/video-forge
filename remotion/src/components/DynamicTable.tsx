// examples/04-dynamic-table.tsx
// Tabela dinâmica: linhas entram escalonadas (stagger), números contam até o
// valor, coluna de destaque anima. Self-contained, sem dependências extras.
// Alternativa pronta: npx @agent-motion/cli add data-table@0.3.1 (MIT)
import React from 'react';
import {Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

export type Column = {
  readonly key: string;
  readonly label: string;
  readonly align?: 'left' | 'center' | 'right';
  /** peso relativo da coluna */
  readonly width?: number;
  readonly kind?: 'text' | 'number' | 'badge';
};

export type Row = Record<string, string | number | boolean | null>;

type DynamicTableProps = {
  readonly columns: ReadonlyArray<Column>;
  readonly rows: ReadonlyArray<Row>;
  readonly highlightColumn?: string;
  readonly startFrame?: number;
  readonly rowStaggerFrames?: number;
};

const BADGE_COLORS: Record<string, string> = {
  ok: '#16a34a',
  atrasado: '#dc2626',
  andamento: '#f59e0b',
};

const DynamicTableInner: React.FC<
  DynamicTableProps & {readonly style?: React.CSSProperties}
> = ({
  columns,
  rows,
  highlightColumn,
  startFrame = 0,
  rowStaggerFrames = 6,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ease = Easing.bezier(0.16, 1, 0.3, 1);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        fontFamily: 'Inter, sans-serif',
        fontSize: 34,
        color: '#111827',
        ...style,
      }}
    >
      {/* Cabeçalho */}
      <div style={{display: 'flex', gap: 4}}>
        {columns.map((col, i) => {
          const headIn = interpolate(
            frame,
            [startFrame, startFrame + 0.3 * fps],
            [0, 1],
            {easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
          );
          return (
            <div
              key={col.key}
              style={{
                flex: col.width ?? 1,
                padding: '18px 24px',
                backgroundColor: '#111827',
                color: '#ffffff',
                fontWeight: 700,
                textAlign: col.align ?? 'left',
                borderRadius: i === 0 ? '12px 0 0 0' : i === columns.length - 1 ? '0 12px 0 0' : 0,
                opacity: headIn,
                translate: `0px ${(1 - headIn) * -16}px`,
              }}
            >
              {col.label}
            </div>
          );
        })}
      </div>

      {/* Linhas */}
      {rows.map((row, rowIndex) => {
        const rowStart = startFrame + 6 + rowIndex * rowStaggerFrames;
        const rowIn = interpolate(frame, [rowStart, rowStart + 0.35 * fps], [0, 1], {
          easing: ease,
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <div
            key={rowIndex}
            style={{
              display: 'flex',
              gap: 4,
              opacity: rowIn,
              translate: `0px ${(1 - rowIn) * 28}px`,
            }}
          >
            {columns.map((col) => {
              const raw = row[col.key];
              const isHighlight = col.key === highlightColumn;

              // Números contam até o valor
              let display: React.ReactNode;
              if (col.kind === 'number' && typeof raw === 'number') {
                const countIn = interpolate(
                  frame,
                  [rowStart, rowStart + 0.6 * fps],
                  [0, 1],
                  {
                    easing: Easing.out(Easing.exp),
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  },
                );
                display = Math.round(countIn * raw).toLocaleString('pt-BR');
              } else if (col.kind === 'badge') {
                const label = String(raw ?? '');
                display = (
                  <span
                    style={{
                      backgroundColor: BADGE_COLORS[label] ?? '#6b7280',
                      color: '#fff',
                      borderRadius: 999,
                      padding: '6px 18px',
                      fontSize: 26,
                      fontWeight: 700,
                    }}
                  >
                    {label}
                  </span>
                );
              } else if (typeof raw === 'boolean') {
                display = raw ? 'Sim' : 'Não';
              } else {
                display = raw === null || raw === undefined ? '—' : String(raw);
              }

              return (
                <div
                  key={col.key}
                  style={{
                    flex: col.width ?? 1,
                    padding: '16px 24px',
                    backgroundColor: isHighlight ? '#eff6ff' : rowIndex % 2 ? '#f9fafb' : '#ffffff',
                    color: isHighlight ? '#2563eb' : '#111827',
                    fontWeight: isHighlight ? 800 : 500,
                    textAlign: col.align ?? 'left',
                    borderRadius: '8px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {display}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export const DynamicTable = Interactive.create({
  Component: DynamicTableInner,
  componentName: '<DynamicTable>',
});
// NOTA API: sem `layout: 'absolute-fill'` (o componente aceita `style`);
// props não podem ter nomes reservados (from, name, durationInFrames...).

// Uso:
// <DynamicTable
//   name="Tabela orçamento"
//   startFrame={30}
//   highlightColumn="total"
//   columns={[
//     {key: 'etapa', label: 'Etapa', width: 2},
//     {key: 'prazo', label: 'Prazo', kind: 'badge', width: 1},
//     {key: 'custo', label: 'Custo (R$)', kind: 'number', align: 'right', width: 1.5},
//   ]}
//   rows={[
//     {etapa: 'Fundação', prazo: 'ok', custo: 128000},
//     {etapa: 'Estrutura', prazo: 'andamento', custo: 412500},
//     {etapa: 'Acabamento', prazo: 'atrasado', custo: 289000},
//   ]}
// />
