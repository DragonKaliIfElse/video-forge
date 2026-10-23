// Composição final: vídeo real cortado (91.5s) + as animações pedidas na fala,
// cada uma no timestamp em que foi solicitada.
import React from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {Audio, Video} from '@remotion/media';
import {DynamicTable} from './components/DynamicTable';
import {HandAnchoredBox, HandOverlay} from './components/HandTracking';
import {TitleBlock} from './components/TitleBlock';
import {DocCaption, ViewfinderFrame} from './components/motion-kit';
import {CUES, FEATURES} from './lib/data';
import {useProjectData} from './lib/useData';

const ms = (v: number, fps: number) => Math.round((v / 1000) * fps);
// o pipeline gerou 2745 máscaras (0..2744); o vídeo tem alguns frames a mais
const MAX_MASK_FRAME = 2744;

// ---------- Cena 1: corpo recortado + fundo roxo ----------
export const PurpleEffect: React.FC<{masksBase: string; offsetFrames: number}> = ({
  masksBase,
  offsetFrames,
}) => {
  const local = useCurrentFrame(); // DENTRO do <Sequence> o frame é LOCAL
  const {fps} = useVideoConfig();
  // índice global da máscara, com clamp no último disponível
  const frame = Math.min(local + offsetFrames, MAX_MASK_FRAME);
  const maskSrc = `${masksBase}/${String(frame).padStart(5, '0')}.png`;
  const enter = interpolate(local, [0, 0.4 * fps], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 42%, #8b5cf6 0%, #6d28d9 45%, #2e1065 100%)',
          opacity: enter,
        }}
      />
      {/* camada com o vídeo mascarado pela silhueta */}
      <AbsoluteFill
        style={{
          WebkitMaskImage: `url('${maskSrc}')`,
          maskImage: `url('${maskSrc}')`,
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
        }}
      >
        <Video src={staticFile('cut.mp4')} muted objectFit="cover" style={{width: '100%', height: '100%'}} />
      </AbsoluteFill>
      {/* brilho no contorno */}
      <Img
        src={maskSrc}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.32 * enter,
          filter: 'blur(7px) brightness(2)',
          mixBlendMode: 'screen',
        }}
      />
    </>
  );
};

// ---------- Cena 2: miniatura + tabela ao lado ----------
const MiniatureScene: React.FC<{offsetMs: number}> = ({offsetMs}) => {
  const local = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const p = interpolate(local, [0, 0.75 * fps], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const miniW = width * 0.52;
  const miniH = (miniW * 9) / 16;

  return (
    <AbsoluteFill>
      {/* fundo: mesmo vídeo, desfocado e escurecido */}
      <Video
        src={staticFile('cut.mp4')}
        muted
        trimBefore={Math.round((offsetMs / 1000) * fps)}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          filter: `blur(${28 * p}px) brightness(${1 - 0.55 * p})`,
          scale: 1.08,
        }}
        objectFit="cover"
      />
      <Video
        src={staticFile('cut.mp4')}
        muted
        trimBefore={Math.round((offsetMs / 1000) * fps)}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width,
          height,
          transformOrigin: '0 0',
          scale: interpolate(p, [0, 1], [1, miniW / width], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            output: 'perceptual-scale',
          }),
          translate: `0px ${miniH * 0.62 * p}px`,
          borderRadius: interpolate(p, [0, 1], [0, 20]),
          boxShadow: '0 20px 70px rgba(0,0,0,0.6)',
        }}
      />
    </AbsoluteFill>
  );
};

export const Main: React.FC = () => {
  const {fps, width, height} = useVideoConfig();
  const globalFrame = useCurrentFrame(); // sempre no topo (regra dos hooks)
  const data = useProjectData();

  if (!data) {
    return <AbsoluteFill style={{backgroundColor: '#0f172a'}} />;
  }

  // o vídeo base fica invisível enquanto a cena da miniatura desenha
  const inTextBehind =
    globalFrame >= ms(CUES.bodyMaskOn, fps) && globalFrame < ms(CUES.purpleOff, fps);
  const inMiniature =
    globalFrame >= ms(CUES.shrinkAt, fps) && globalFrame < ms(CUES.unshrinkAt, fps);
  const baseOpacity = inTextBehind || inMiniature ? 0 : 1;

  // offsets: o vídeo toca do frame 0 ao fim; as animações entram por cima.
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      {/* áudio único de toda a timeline (os <Video> visuais ficam mudos) */}
      <Audio src={staticFile('cut.mp4')} />

      {/* ===== vídeo base visual (sempre presente; oculto na janela da miniatura) ===== */}
      <Video
        src={staticFile('cut.mp4')}
        muted
        objectFit="cover"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: baseOpacity,
        }}
      />

      {/* ===== 1. texto atrás do corpo (14.6s-22.6s) =====
          Pré-composto em FFmpeg (text-behind.mp4): vídeo + texto + recorte da
          pessoa por cima. Não mascarar por frame no browser. */}
      <Sequence
        from={ms(CUES.bodyMaskOn, fps)}
        durationInFrames={ms(CUES.purpleOff - CUES.bodyMaskOn, fps)}
        layout="none"
      >
        <Video
          src={staticFile('text-behind.mp4')}
          muted
          trimBefore={ms(CUES.bodyMaskOn, fps)}
          objectFit="cover"
          style={{width: '100%', height: '100%'}}
        />
      </Sequence>

      {/* ===== 2. legendas atrás do corpo (30.7s-37.8s) ===== */}
      <Sequence
        from={ms(CUES.captionsOn, fps)}
        durationInFrames={ms(CUES.captionsOff - CUES.captionsOn, fps)}
        layout="none"
      >
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 90}}>
          <DocCaption
            kicker="legendas de tudo que estou falando"
            parts={[
              {text: 'aparecendo aqui '},
              {text: 'atrás', accent: true},
              {text: ' de mim'},
            ]}
          />
        </AbsoluteFill>
      </Sequence>

      {/* ===== 3. miniatura + tabela ao lado (40.7s-56s) ===== */}
      <Sequence
        from={ms(CUES.shrinkAt, fps)}
        durationInFrames={ms(CUES.unshrinkAt - CUES.shrinkAt, fps)}
        layout="none"
      >
        <MiniatureScene offsetMs={CUES.shrinkAt} />
        <Sequence
          from={ms(CUES.tableOn - CUES.shrinkAt, fps)}
          durationInFrames={ms(CUES.tableOff - CUES.tableOn, fps)}
          layout="none"
        >
          <AbsoluteFill style={{left: 'auto', right: 40, top: 60, width: 600, height: 600, fontSize: 22}}>
            <DynamicTable
              name="Tabela de animações"
              columns={[
                {key: 'feature', label: 'Recurso', width: 2.4},
                {key: 'cat', label: 'Categoria', width: 1.3, align: 'center'},
                {key: 'st', label: 'Status', kind: 'badge', width: 1, align: 'center'},
              ]}
              rows={FEATURES.slice(0, 5).map((f) => ({
                feature: f.label,
                cat: f.category,
                st: f.status,
              }))}
              highlightColumn="feature"
              rowStaggerFrames={7}
              style={{fontSize: 21, backgroundColor: 'rgba(10,16,30,0.94)', color: '#f8fafc', padding: 14, borderRadius: 16}}
            />
          </AbsoluteFill>
        </Sequence>
      </Sequence>

      {/* ===== 4. tracking da mão com 21 pontos (62.9s-75.7s) ===== */}
      <Sequence
        from={ms(CUES.handTrackOn, fps)}
        durationInFrames={ms(CUES.handTrackOff - CUES.handTrackOn, fps)}
        layout="none"
      >
        <HandOverlay frames={data.hands} width={width} height={height} showLabels offsetMs={CUES.handTrackOn} />
        <AbsoluteFill style={{alignItems: 'center', top: 40, bottom: 'auto'}}>
          <TitleBlock
            title="21 pontos por mão"
            subtitle="Detecção em tempo real"
            durationInFrames={ms(CUES.handTrackOff - CUES.handTrackOn, fps)}
            style={{alignItems: 'center', height: 'auto', padding: 0}}
          />
        </AbsoluteFill>
      </Sequence>

      {/* ===== 5. tabela ancorada dentro da mão (79.4s-fim) ===== */}
      <Sequence
        from={ms(CUES.handTableOn, fps)}
        durationInFrames={ms(CUES.end - CUES.handTableOn, fps)}
        layout="none"
      >
        <HandOverlay frames={data.hands} width={width} height={height} color="#a78bfa" offsetMs={CUES.handTableOn} />
        <HandAnchoredBox
          frames={data.hands}
          width={width}
          height={height}
          maxSizeRatio={0.62}
          gapFill={0.94}
          anchor="between"
          offsetY={-0.02}
          offsetMs={CUES.handTableOn}
          contentWidth={560}
          contentHeight={780}
        >
          <div style={{padding: 12}}>
            <DynamicTable
              name="Tabela na mão"
              columns={[
                {key: 'feature', label: 'Recurso', width: 3.2},
                {key: 'st', label: 'Status', kind: 'badge', width: 1, align: 'center'},
              ]}
              rows={FEATURES.map((f) => ({feature: f.label, st: f.status}))}
              rowStaggerFrames={2}
              style={{fontSize: 19, color: '#f8fafc'}}
            />
          </div>
        </HandAnchoredBox>
      </Sequence>

      {/* assinatura visual: moldura + letterbox (padrão P11 das referências) */}
      <ViewfinderFrame letterboxRatio={0.055} label="motion kit" />

      {/* áudio separado é desnecessário: o <Video> já traz o áudio do cut.mp4 */}
    </AbsoluteFill>
  );
};
