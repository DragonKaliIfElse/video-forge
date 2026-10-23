// Cues extraídos da fala real (tempo no vídeo final, em ms).
// Fonte: transcrição faster-whisper + VAD Silero + mapeamento após cortes.
export const CUES = {
  // "Quando eu estalar esse dedo agora..." -> animação começa no estalo
  snapAt: 10200,
  // "eu consiga editar o fundo, coloque um fundo todo roxo"
  bodyMaskOn: 14600,
  purpleOn: 16400,
  purpleOff: 22600,
  // "Agora pode voltar... as legendas de tudo que eu estou falando"
  restoreNormal: 23550,
  captionsOn: 30700,
  captionsOff: 37830,
  // "reduz a imagem desse vídeo e mostra aqui do lado"
  shrinkAt: 40700,
  // "uma tabela de tudo que a gente consegue fazer"
  tableOn: 45400,
  tableOff: 55500,
  // "voltar a imagem no normal"
  unshrinkAt: 56000,
  // "mapear a minha mão ... todos os dedos e todos os pontos"
  handTrackOn: 62900,
  handTrackOff: 75700,
  // "aquela mesma tabela ... no meio da minha mão"
  handTableOn: 79400,
  end: 91600,
} as const;

export type Feature = {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly status: 'ok' | 'novo';
};

// Tabela mostrada no vídeo (ao lado da miniatura e dentro da mão).
// O status reflete o que este projeto realmente entrega.
export const FEATURES: readonly Feature[] = [
  {id: 'corte-silencio', label: 'Corte de silêncio (VAD)', category: 'Edição', status: 'ok'},
  {id: 'legendas', label: 'Legendas palavra a palavra', category: 'Legenda', status: 'ok'},
  {id: 'titulos', label: 'Títulos animados', category: 'Título', status: 'ok'},
  {id: 'miniatura', label: 'Vídeo em miniatura (PiP)', category: 'Layout', status: 'ok'},
  {id: 'tabela', label: 'Tabela dinâmica', category: 'Dados', status: 'ok'},
  {id: 'graficos', label: 'Gráficos e contadores', category: 'Dados', status: 'ok'},
  {id: 'transicoes', label: 'Transições (fade/slide/wipe)', category: 'Transição', status: 'ok'},
  {id: 'corpo', label: 'Recorte de corpo + fundo', category: 'Máscara', status: 'ok'},
  {id: 'mao', label: 'Tracking de mão (21 pontos)', category: 'Rastreio', status: 'novo'},
  {id: 'tabela-anchor', label: 'Conteúdo ancorado na mão', category: 'Rastreio', status: 'novo'},
];
