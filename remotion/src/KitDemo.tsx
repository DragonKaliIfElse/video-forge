// DEMO do motion-kit: reproduz os 6 padrões extraídos das referências.
// Serve como prova visual de que o kit implementa o catálogo.
import React from 'react';
import {AbsoluteFill, Sequence, useVideoConfig} from 'remotion';
import {
  BrandCard,
  ChipRow,
  CounterSlam,
  DashedChip,
  DocCaption,
  DotGrid,
  GiantBehindText,
  LogoLockup,
  PunchWord,
  Sparkle,
  ViewfinderFrame,
} from './components/motion-kit';

const S = ({from, dur, children}: {from: number; dur: number; children: React.ReactNode}) => (
  <Sequence from={from} durationInFrames={dur} layout="none">
    {children}
  </Sequence>
);

const Dark = ({children}: {children: React.ReactNode}) => (
  <AbsoluteFill style={{backgroundColor: '#0a0a0a'}}>
    <DotGrid />
    {children}
  </AbsoluteFill>
);

export const KitDemo: React.FC = () => {
  const {fps} = useVideoConfig();
  const f = (s: number) => Math.round(s * fps);

  return (
    <AbsoluteFill style={{backgroundColor: '#0a0a0a'}}>
      {/* P01 — texto gigante atrás (aqui sem recorte: só o texto) */}
      <S from={0} dur={f(1.6)}>
        <Dark>
          <GiantBehindText text="PRIMEIRO" />
          <Sparkle x="13%" y="26%" size={30} />
          <Sparkle x="85%" y="28%" size={26} phase={18} />
        </Dark>
      </S>

      {/* P02 — punch com ghost trail */}
      <S from={f(1.6)} dur={f(1.1)}>
        <Dark>
          <PunchWord text="RUIM" />
        </Dark>
      </S>

      {/* P03 — card de marca com 3 níveis + destaque invertido */}
      <S from={f(2.7)} dur={f(2.6)}>
        <BrandCard
          lines={[
            {text: 'Sem editor de vídeo', size: 0.032},
            {text: 'em 30 min', size: 0.11},
            {text: 'com IA', size: 0.055, inverted: true},
          ]}
        />
      </S>

      {/* P04 — contador com fantasma + etiqueta tracejada */}
      <S from={f(5.3)} dur={f(2.2)}>
        <BrandCard
          lines={[]}
          sparkles
        />
        <CounterSlam values={[25, 30]} suffix=" min" label="de edição" />
        <div style={{position: 'absolute', top: '12%', width: '100%', textAlign: 'center'}}>
          <DashedChip>Sem editor de vídeo</DashedChip>
        </div>
      </S>

      {/* P05 — chips irregulares */}
      <S from={f(7.5)} dur={f(2.4)}>
        <Dark>
          <ChipRow
            items={[
              {text: 'Não', x: '18%', y: '30%'},
              {text: 'também', x: '62%', y: '26%'},
              {text: 'pouco', x: '24%', y: '58%'},
              {text: 'Consegue?', x: '66%', y: '62%'},
              {text: 'como é que faz', x: '40%', y: '78%'},
            ]}
          />
        </Dark>
      </S>

      {/* P09 — legenda documental com palavra-âncora */}
      <S from={f(9.9)} dur={f(2.6)}>
        <Dark>
          <DocCaption
            kicker="Todas as animações deste vídeo"
            parts={[
              {text: 'não foram feitas por um '},
              {text: 'editor profissional', accent: true},
              {text: ' e sim por uma IA'},
            ]}
          />
        </Dark>
      </S>

      {/* P06 — lockup de marca */}
      <S from={f(12.5)} dur={f(2.4)}>
        <Dark>
          <LogoLockup
            symbol={
              <svg width={110} height={110} viewBox="0 0 24 24">
                <rect x="3" y="3" width="6" height="18" rx="1" fill="#01a6a2" />
                <rect x="11" y="3" width="6" height="18" rx="1" fill="#01a6a2" opacity="0.75" />
                <rect x="19" y="3" width="3" height="18" rx="1" fill="#01a6a2" opacity="0.5" />
              </svg>
            }
            name="Motion Kit"
            taglines={['componentes medidos por engenharia reversa', 'para vídeo falado']}
          />
        </Dark>
      </S>

      <ViewfinderFrame letterboxRatio={0.06} label="motion kit" />
    </AbsoluteFill>
  );
};
