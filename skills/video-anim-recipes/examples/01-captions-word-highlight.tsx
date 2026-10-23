// examples/01-captions-word-highlight.tsx
// Legendas animadas palavra-a-palavra (estilo TikTok/karaoke).
// Base: Remotion Element "Word Highlight Captions" (remotion.dev/elements/captions).
// Requer: npx remotion add @remotion/captions @remotion/google-fonts @remotion/layout-utils
import type {Caption} from '@remotion/captions';
import {createTikTokStyleCaptions} from '@remotion/captions';
import {loadFont} from '@remotion/google-fonts/Montserrat';
import {fitText} from '@remotion/layout-utils';
import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';

// ---------------------------------------------------------------------------
// Ponte pi-speech → @remotion/captions
// O transcript do speech_transcribe tem palavras com beginMs/endMs.
// ATENÇÃO: o campo text precisa do espaço ANTES da palavra (delimitador!).
// ---------------------------------------------------------------------------
export const wordsToCaptions = (
  words: ReadonlyArray<{text: string; beginMs: number; endMs: number}>,
): Caption[] =>
  words.map((w, i) => ({
    text: i === 0 ? w.text : ` ${w.text}`,
    startMs: w.beginMs,
    endMs: w.endMs,
    timestampMs: (w.beginMs + w.endMs) / 2,
    confidence: null,
  }));

const fontWeight = '700';
const textColor = '#ffffff';
const highlightColor = '#2563eb';
const desiredFontSize = 80;

const {fontFamily} = loadFont('normal', {
  weights: [fontWeight],
  subsets: ['latin'],
});

const inInterval = (t: number, fromMs: number, toMs: number) =>
  t >= fromMs && t < toMs;

type WordHighlightCaptionsProps = {
  readonly captions: Caption[];
  readonly width?: number;
  readonly combineTokensWithinMilliseconds?: number;
};

export const WordHighlightCaptions: React.FC<WordHighlightCaptionsProps> = ({
  captions,
  width = 682,
  combineTokensWithinMilliseconds = 800,
}) => {
  const frame = useCurrentFrame();
  const {fps, width: compositionWidth} = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;

  const pages = useMemo(
    () =>
      createTikTokStyleCaptions({captions, combineTokensWithinMilliseconds})
        .pages,
    [captions, combineTokensWithinMilliseconds],
  );

  const pageIndex = pages.findIndex((p) =>
    inInterval(currentTimeMs, p.startMs, p.startMs + p.durationMs),
  );
  const page = pages[pageIndex];
  if (!page) return null;

  const tokenIndex = page.tokens.findIndex((t) =>
    inInterval(currentTimeMs, t.fromMs, t.toMs),
  );

  // Cabe a fonte na largura disponível: página e o maior token sozinho
  const availableWidth = width ?? compositionWidth;
  const fontSize = Math.min(
    desiredFontSize,
    fitText({
      fontFamily,
      fontWeight,
      text: page.text,
      validateFontIsLoaded: true,
      withinWidth: availableWidth,
    }).fontSize,
    ...page.tokens
      .map((t) => t.text.trim())
      .filter(Boolean)
      .map((text) =>
        fitText({
          fontFamily,
          fontWeight,
          text,
          validateFontIsLoaded: true,
          withinWidth: availableWidth,
        }).fontSize,
      ),
  );

  return (
    <div style={{width, display: 'flex', height: '100%', alignItems: 'center'}}>
      <div
        style={{
          color: textColor,
          fontFamily,
          fontSize,
          fontWeight,
          lineHeight: 1.5,
          textAlign: 'center',
          width: '100%',
          whiteSpace: 'pre', // preserva os espaços dos tokens
          paintOrder: 'stroke fill',
          WebkitTextStroke: `${fontSize / 7}px #000000`,
        }}
      >
        {page.tokens.map((token, i) => (
          <span
            key={`${page.startMs}-${token.fromMs}-${i}`}
            style={{
              color: i === tokenIndex ? highlightColor : textColor,
              display: 'inline-block',
              whiteSpace: 'pre',
            }}
          >
            {token.text}
          </span>
        ))}
      </div>
    </div>
  );
};

// Variantes prontas da galeria oficial (copiar o .tsx de cada página):
// - Basic Captions        https://www.remotion.dev/elements/captions/basic-captions/
// - Rounded Captions      https://www.remotion.dev/elements/captions/rounded-captions/
// - Moving Pill Captions  https://www.remotion.dev/elements/captions/moving-pill-captions/
// - Popping Word Captions https://www.remotion.dev/elements/captions/popping-word-captions/
