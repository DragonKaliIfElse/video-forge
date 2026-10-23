// Carrega os dados gerados pelo pipeline Python (public/*.json).
import {useEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';

export type Word = {text: string; beginMs: number; endMs: number};
export type HandPoint = [number, number, number];
export type HandFrame = {
  t: number;
  hands: {h: string; p: HandPoint[]}[];
  pose: [number, number, number][] | null;
};

type ProjectData = {
  words: Word[];
  hands: HandFrame[];
  durationMs: number;
};

const load = async (): Promise<ProjectData> => {
  const [words, hands] = await Promise.all([
    fetch(staticFile('words.json')).then((r) => r.json()),
    fetch(staticFile('hands.json')).then((r) => r.json()),
  ]);
  return {
    words: words.words as Word[],
    durationMs: words.durationMs as number,
    hands: hands.frames as HandFrame[],
  };
};

export const useProjectData = (): ProjectData | null => {
  const [data, setData] = useState<ProjectData | null>(null);
  const [handle] = useState(() => delayRender('carregando dados'));

  useEffect(() => {
    load()
      .then((d) => {
        setData(d);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e instanceof Error ? e : new Error(String(e))));
  }, [handle]);

  return data;
};

// Mão mais próxima de um instante (busca binária no JSON subsampleado a 5fps)
export const handAt = (frames: HandFrame[], tMs: number): HandFrame | null => {
  if (!frames.length) return null;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t < tMs) lo = mid + 1;
    else hi = mid;
  }
  const a = frames[Math.max(0, lo - 1)];
  const b = frames[lo];
  return Math.abs(a.t - tMs) <= Math.abs(b.t - tMs) ? a : b;
};
