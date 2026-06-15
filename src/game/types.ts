export type LevelSource = 'official' | 'workshop-draft' | 'workshop-published';

export type LevelStatus = 'draft' | 'published';

export type SnapshotSource =
  | 'manual-save'
  | 'playtest-return'
  | 'pre-publish'
  | 'manual-snapshot'
  | 'rollback'
  | 'import';

export type TimelineActionType =
  | 'snapshot-create'
  | 'snapshot-rename'
  | 'snapshot-delete'
  | 'rollback'
  | 'rollback-to-new'
  | 'conflict-merge'
  | 'conflict-overwrite'
  | 'conflict-rename'
  | 'recovery'
  | 'export-single'
  | 'export-full';

export interface LevelDiff {
  playerStartChanged: boolean;
  obstaclesAdded: Position[];
  obstaclesRemoved: Position[];
  eventsAdded: GameEvent[];
  eventsRemoved: GameEvent[];
  eventsModified: GameEvent[];
  nameChanged: boolean;
  descriptionChanged: boolean;
  totalChanges: number;
}

export interface VersionSnapshot {
  id: string;
  levelId: string;
  name: string;
  note?: string;
  source: SnapshotSource;
  createdAt: number;
  parentSnapshotId: string | null;
  levelData: CustomLevel;
  diffFromParent?: LevelDiff | null;
}

export interface TimelineLogEntry {
  id: string;
  levelId: string;
  action: TimelineActionType;
  snapshotId?: string;
  targetSnapshotId?: string;
  message: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

export interface LevelTimeline {
  levelId: string;
  snapshots: VersionSnapshot[];
  currentSnapshotId: string | null;
  lastRollbackSnapshotId: string | null;
  logs: TimelineLogEntry[];
  updatedAt: number;
}

export interface UnsavedEditorDraft {
  levelId: string | null;
  levelData: CustomLevel | null;
  editorHistory: CustomLevel[];
  editorFuture: CustomLevel[];
  savedAt: number;
}

export interface WorkshopTimelineState {
  timelines: Record<string, LevelTimeline>;
  unsavedDrafts: Record<string, UnsavedEditorDraft>;
  activeDraftLevelId: string | null;
  lastRollbackInfo: {
    levelId: string;
    snapshotId: string;
    timestamp: number;
  } | null;
}

export interface WorkshopState {
  levels: CustomLevel[];
  lastEditingLevelId: string | null;
  lastEditingSnapshot: CustomLevel | null;
  scores: Record<string, WorkshopScore>;
  timeline?: WorkshopTimelineState;
}

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

export type EditorTool = 'empty' | 'obstacle' | 'normal' | 'bonus' | 'danger' | 'player';

export interface CustomLevel {
  id: string;
  name: string;
  description?: string;
  playerStart: Position;
  obstacles: Position[];
  events: GameEvent[];
  status: LevelStatus;
  version: string;
  versionNote?: string;
  publishedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface WorkshopScore {
  levelId: string;
  bestScore: number;
  lastScore: number;
  plays: number;
  wins: number;
  lastPlayedAt: number;
}

export interface WorkshopState {
  levels: CustomLevel[];
  lastEditingLevelId: string | null;
  lastEditingSnapshot: CustomLevel | null;
  scores: Record<string, WorkshopScore>;
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
  levelSource?: LevelSource;
  levelId?: string;
  levelName?: string;
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
  levelSource: LevelSource;
  levelId?: string;
  levelName?: string;
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
  WORKSHOP: 'patrol_chess_workshop',
  WORKSHOP_AUTO_SAVE: 'patrol_chess_workshop_auto',
  WORKSHOP_TIMELINE: 'patrol_chess_workshop_timeline',
};

export const EVENT_SCORES = {
  normal: 10,
  bonus: 30,
  danger: -20,
};

export const MAX_TURNS = 50;
export const WIN_SCORE = 100;
export const ARCHIVE_VERSION = 1;

export interface ArchiveData {
  version: number;
  exportedAt: number;
  currentGameState: GameState;
  currentHistory: GameState[];
  saves: (SaveData | null)[];
  autoSave: SaveData | null;
  workshopLevels?: CustomLevel[];
  workshopScores?: Record<string, WorkshopScore>;
}
