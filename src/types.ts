export type GameMode = 'classic' | 'time';

export interface BlockData {
  id: string;
  value: number;
}

export type Grid = (BlockData | null)[][];

export interface GameState {
  grid: Grid;
  targetSum: number;
  selectedIndices: { r: number; c: number }[];
  score: number;
  level: number;
  gameOver: boolean;
  mode: GameMode;
  timeLeft: number;
  isPaused: boolean;
}
