
import { BlockShape } from './types';

export const GRID_SIZE = 10;
export const INITIAL_MOVES = 25;
export const INITIAL_TARGET = 800;

export const COLORS = [
  '#6366f1', // indigo-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
];

export const SHAPES: Omit<BlockShape, 'id' | 'color'>[] = [
  { shape: [[1]] },
  { shape: [[1, 1]] },
  { shape: [[1], [1]] },
  { shape: [[1, 1, 1]] },
  { shape: [[1], [1], [1]] },
  { shape: [[1, 1], [1, 1]] },
  { shape: [[1, 1, 1, 1]] },
  { shape: [[1], [1], [1], [1]] },
  { shape: [[1, 1, 1], [0, 1, 0]] },
  { shape: [[0, 1, 0], [1, 1, 1]] },
  { shape: [[1, 1], [0, 1]] },
  { shape: [[1, 1], [1, 0]] },
  { shape: [[1, 0], [1, 1]] },
  { shape: [[0, 1], [1, 1]] },
  { shape: [[1, 1, 1], [1, 0, 0]] },
  { shape: [[1, 1, 1], [0, 0, 1]] },
];

export const getRandomBlock = (): BlockShape => {
  const shapeIndex = Math.floor(Math.random() * SHAPES.length);
  const colorIndex = Math.floor(Math.random() * COLORS.length);
  return {
    ...SHAPES[shapeIndex],
    id: Math.random().toString(36).substr(2, 9),
    color: COLORS[colorIndex],
  };
};

export const MOCK_NAMES = [
  "ShadowMaster", "BlockKing", "PuzzlePro", "NeonGlider", "InfinityVoid",
  "CyberZen", "LogicLord", "Zenith", "Quantum", "Apex", "Nexus", "Vortex",
  "Solaris", "Luna", "Titan", "Echo", "Nova", "Pulse", "Rift", "Flux"
];
