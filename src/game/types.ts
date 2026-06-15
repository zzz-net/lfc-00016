export interface Position {
  x: number;
  y: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export type EventType = 'normal' | 'bonus' | 'danger';

export interface GameEvent {
  id: string;
  position: Position;
  type: EventType;
  score: number;
}

export type CellType = 'empty' | 'obstacle';

export interface Cell {
  position: Position;
  type: CellType;
}

export interface LogEntry {
  turn: number;
  action: 'move' | 'capture' | 'system' | 'gameover' | 'illegal';
  direction?: Direction;
  from?: Position;
  to?: Position;
  capturedEvent?: GameEvent;
  scoreChange?: number;
  message: string;
  timestamp: number;
}

export interface GameState {
  playerPosition: Position;
  events: GameEvent[];
  obstacles: Position[];
  turn: number;
  score: number;
  isGameOver: boolean;
  gameOverReason?: string;
  logs: LogEntry[];
}

export interface SaveData {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  gameState: GameState;
  history: GameState[];
}

export type GameAction =
  | { type: 'NEW_GAME' }
  | { type: 'MOVE'; direction: Direction }
  | { type: 'UNDO' }
  | { type: 'LOAD_SAVE'; saveData: SaveData }
  | { type: 'REPLAY_START' }
  | { type: 'REPLAY_NEXT' }
  | { type: 'REPLAY_END' };

export const BOARD_SIZE = 8;

export const STORAGE_KEYS = {
  SAVES: 'patrol_chess_saves',
  AUTO_SAVE: 'patrol_chess_auto',
  SETTINGS: 'patrol_chess_settings',
};

export const EVENT_SCORES = {
  normal: 10,
  bonus: 30,
  danger: -20,
};

export const MAX_TURNS = 50;
export const WIN_SCORE = 100;
