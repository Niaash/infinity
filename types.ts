
export type Color = string;

export interface BlockShape {
  id: string;
  shape: number[][]; // 0 or 1
  color: Color;
}

export interface GridCell {
  color: Color | null;
  clearing?: boolean;
}

export interface RankEntry {
  rank: number;
  name: string;
  level: number;
  score: number;
  isPlayer?: boolean;
}

export interface GameState {
  level: number;
  score: number;
  targetScore: number;
  movesRemaining: number;
  totalMoves: number;
  coins: number;
  grid: GridCell[][];
  blockPool: BlockShape[];
  powerups: {
    bomb: number;
    lineClear: number;
    shuffle: number;
  };
}

export enum GameView {
  START = 'START',
  HOW_TO_PLAY = 'HOW_TO_PLAY',
  PLAYING = 'PLAYING',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
  OUT_OF_MOVES = 'OUT_OF_MOVES',
  RANKING = 'RANKING'
}
