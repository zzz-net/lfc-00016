import {
  CustomLevel,
  WorkshopState,
  WorkshopScore,
  STORAGE_KEYS,
  Position,
  GameEvent,
  BOARD_SIZE,
  EVENT_SCORES,
} from './types';

let __id_counter__ = 0;
const generateId = (): string => {
  __id_counter__ += 1;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 7);
  const seq = __id_counter__.toString(36);
  return `${ts}${rand}${seq}`;
};

const posEquals = (a: Position, b: Position): boolean => a.x === b.x && a.y === b.y;

const isInBounds = (pos: Position): boolean =>
  pos.x >= 0 && pos.x < BOARD_SIZE && pos.y >= 0 && pos.y < BOARD_SIZE;

const isValidPosition = (obj: unknown): obj is Position => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as Record<string, unknown>).x === 'number' &&
    typeof (obj as Record<string, unknown>).y === 'number'
  );
};

const isValidGameEvent = (obj: unknown): obj is GameEvent => {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  if (typeof o.id !== 'string') return false;
  if (!isValidPosition(o.position)) return false;
  if (o.type !== 'normal' && o.type !== 'bonus' && o.type !== 'danger') return false;
  if (typeof o.score !== 'number') return false;
  return true;
};

const isValidCustomLevel = (obj: unknown): obj is CustomLevel => {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  if (typeof o.id !== 'string') return false;
  if (typeof o.name !== 'string') return false;
  if (!isValidPosition(o.playerStart)) return false;
  if (!isInBounds(o.playerStart as Position)) return false;
  if (!Array.isArray(o.obstacles)) return false;
  for (const obs of o.obstacles) {
    if (!isValidPosition(obs) || !isInBounds(obs)) return false;
  }
  if (!Array.isArray(o.events)) return false;
  for (const ev of o.events) {
    if (!isValidGameEvent(ev)) return false;
  }
  if (typeof o.createdAt !== 'number') return false;
  if (typeof o.updatedAt !== 'number') return false;
  return true;
};

const isValidWorkshopScore = (obj: unknown): obj is WorkshopScore => {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  if (typeof o.levelId !== 'string') return false;
  if (typeof o.bestScore !== 'number') return false;
  if (typeof o.lastScore !== 'number') return false;
  if (typeof o.plays !== 'number') return false;
  if (typeof o.wins !== 'number') return false;
  if (typeof o.lastPlayedAt !== 'number') return false;
  return true;
};

const getEmptyWorkshopState = (): WorkshopState => ({
  levels: [],
  lastEditingLevelId: null,
  lastEditingSnapshot: null,
  scores: {},
});

export const loadWorkshopState = (): WorkshopState => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.WORKSHOP);
    if (!data) return getEmptyWorkshopState();

    const parsed = JSON.parse(data);
    const state: WorkshopState = getEmptyWorkshopState();

    if (Array.isArray(parsed.levels)) {
      for (const lvl of parsed.levels) {
        if (isValidCustomLevel(lvl)) {
          state.levels.push(lvl);
        }
      }
    }

    if (typeof parsed.lastEditingLevelId === 'string') {
      state.lastEditingLevelId = parsed.lastEditingLevelId;
    }

    if (parsed.lastEditingSnapshot && isValidCustomLevel(parsed.lastEditingSnapshot)) {
      state.lastEditingSnapshot = parsed.lastEditingSnapshot;
    }

    if (typeof parsed.scores === 'object' && parsed.scores !== null) {
      for (const key of Object.keys(parsed.scores)) {
        if (isValidWorkshopScore(parsed.scores[key])) {
          state.scores[key] = parsed.scores[key];
        }
      }
    }

    return state;
  } catch (e) {
    console.error('Load workshop state failed:', e);
    return getEmptyWorkshopState();
  }
};

export const saveWorkshopState = (state: WorkshopState): boolean => {
  try {
    localStorage.setItem(STORAGE_KEYS.WORKSHOP, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('Save workshop state failed:', e);
    return false;
  }
};

export const listWorkshopLevels = (): CustomLevel[] => {
  return loadWorkshopState().levels;
};

export const getWorkshopLevel = (id: string): CustomLevel | null => {
  const state = loadWorkshopState();
  return state.levels.find((l) => l.id === id) || null;
};

export type NameConflictAction = 'overwrite' | 'rename';

export interface CreateLevelOptions {
  name: string;
  description?: string;
  playerStart: Position;
  obstacles: Position[];
  events: GameEvent[];
  onNameConflict?: (existing: CustomLevel) => NameConflictAction;
}

const generateUniqueName = (baseName: string, existingNames: string[]): string => {
  if (!existingNames.includes(baseName)) return baseName;
  let counter = 1;
  while (existingNames.includes(`${baseName} (${counter})`)) {
    counter++;
  }
  return `${baseName} (${counter})`;
};

export const createWorkshopLevel = (options: CreateLevelOptions): CustomLevel | null => {
  try {
    const state = loadWorkshopState();
    const now = Date.now();
    const existingByName = state.levels.find(
      (l) => l.name.trim().toLowerCase() === options.name.trim().toLowerCase()
    );

    let finalName = options.name;

    if (existingByName) {
      if (options.onNameConflict) {
        const action = options.onNameConflict(existingByName);
        if (action === 'overwrite') {
          const idx = state.levels.findIndex((l) => l.id === existingByName.id);
          const updated: CustomLevel = {
            ...existingByName,
            name: finalName,
            description: options.description,
            playerStart: options.playerStart,
            obstacles: JSON.parse(JSON.stringify(options.obstacles)),
            events: JSON.parse(JSON.stringify(options.events)),
            updatedAt: now,
          };
          state.levels[idx] = updated;
          saveWorkshopState(state);
          return updated;
        } else {
          finalName = generateUniqueName(
            options.name,
            state.levels.map((l) => l.name)
          );
        }
      } else {
        return null;
      }
    }

    const level: CustomLevel = {
      id: generateId(),
      name: finalName,
      description: options.description,
      playerStart: JSON.parse(JSON.stringify(options.playerStart)),
      obstacles: JSON.parse(JSON.stringify(options.obstacles)),
      events: JSON.parse(JSON.stringify(options.events)),
      createdAt: now,
      updatedAt: now,
    };

    state.levels.push(level);
    saveWorkshopState(state);
    return level;
  } catch (e) {
    console.error('Create workshop level failed:', e);
    return null;
  }
};

export const updateWorkshopLevel = (
  id: string,
  updates: Partial<Omit<CustomLevel, 'id' | 'createdAt'>>
): CustomLevel | null => {
  try {
    const state = loadWorkshopState();
    const idx = state.levels.findIndex((l) => l.id === id);
    if (idx === -1) return null;

    const now = Date.now();
    const updated: CustomLevel = {
      ...state.levels[idx],
      ...updates,
      obstacles: updates.obstacles ? JSON.parse(JSON.stringify(updates.obstacles)) : state.levels[idx].obstacles,
      events: updates.events ? JSON.parse(JSON.stringify(updates.events)) : state.levels[idx].events,
      playerStart: updates.playerStart ? JSON.parse(JSON.stringify(updates.playerStart)) : state.levels[idx].playerStart,
      updatedAt: now,
    };

    state.levels[idx] = updated;
    saveWorkshopState(state);
    return updated;
  } catch (e) {
    console.error('Update workshop level failed:', e);
    return null;
  }
};

export const deleteWorkshopLevel = (id: string): boolean => {
  try {
    const state = loadWorkshopState();
    const beforeLen = state.levels.length;
    state.levels = state.levels.filter((l) => l.id !== id);
    if (state.lastEditingLevelId === id) {
      state.lastEditingLevelId = null;
      state.lastEditingSnapshot = null;
    }
    delete state.scores[id];
    saveWorkshopState(state);
    return state.levels.length < beforeLen;
  } catch (e) {
    console.error('Delete workshop level failed:', e);
    return false;
  }
};

export const setLastEditingLevel = (
  levelId: string | null,
  snapshot?: CustomLevel
): void => {
  try {
    const state = loadWorkshopState();
    state.lastEditingLevelId = levelId;
    state.lastEditingSnapshot = snapshot ? JSON.parse(JSON.stringify(snapshot)) : null;
    saveWorkshopState(state);
  } catch (e) {
    console.error('Set last editing level failed:', e);
  }
};

export const getLastEditingLevel = (): {
  levelId: string | null;
  snapshot: CustomLevel | null;
} => {
  const state = loadWorkshopState();
  return {
    levelId: state.lastEditingLevelId,
    snapshot: state.lastEditingSnapshot,
  };
};

export const recordWorkshopScore = (
  levelId: string,
  score: number,
  isWin: boolean
): WorkshopScore | null => {
  try {
    const state = loadWorkshopState();
    const existing = state.scores[levelId];
    const now = Date.now();

    const newScore: WorkshopScore = existing
      ? {
          ...existing,
          lastScore: score,
          bestScore: Math.max(existing.bestScore, score),
          plays: existing.plays + 1,
          wins: isWin ? existing.wins + 1 : existing.wins,
          lastPlayedAt: now,
        }
      : {
          levelId,
          bestScore: score,
          lastScore: score,
          plays: 1,
          wins: isWin ? 1 : 0,
          lastPlayedAt: now,
        };

    state.scores[levelId] = newScore;
    saveWorkshopState(state);
    return newScore;
  } catch (e) {
    console.error('Record workshop score failed:', e);
    return null;
  }
};

export const getWorkshopScore = (levelId: string): WorkshopScore | null => {
  const state = loadWorkshopState();
  return state.scores[levelId] || null;
};

export const listWorkshopScores = (): Record<string, WorkshopScore> => {
  return loadWorkshopState().scores;
};

export const createEmptyLevel = (name = '未命名关卡'): CustomLevel => ({
  id: '',
  name,
  description: '',
  playerStart: { x: 0, y: 0 },
  obstacles: [],
  events: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const validateLevel = (level: CustomLevel): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!level.name.trim()) {
    errors.push('关卡名称不能为空');
  }

  if (!isInBounds(level.playerStart)) {
    errors.push('玩家起始位置超出棋盘范围');
  }

  if (level.obstacles.some((o) => !isInBounds(o))) {
    errors.push('存在障碍物超出棋盘范围');
  }

  if (level.events.some((e) => !isInBounds(e.position))) {
    errors.push('存在事件位置超出棋盘范围');
  }

  if (level.obstacles.some((o) => posEquals(o, level.playerStart))) {
    errors.push('玩家起始位置与障碍物重叠');
  }

  if (level.events.some((e) => posEquals(e.position, level.playerStart))) {
    errors.push('玩家起始位置与事件点重叠');
  }

  const occupied = [...level.obstacles];
  for (const ev of level.events) {
    if (occupied.some((o) => posEquals(o, ev.position))) {
      errors.push('存在事件与障碍物或其他事件重叠');
      break;
    }
    occupied.push(ev.position);
  }

  return { valid: errors.length === 0, errors };
};

export interface LevelImportResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  importedLevels: CustomLevel[];
  conflicts: Array<{ incoming: CustomLevel; existing: CustomLevel }>;
}

export const validateLevelJSON = (jsonString: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  levels: CustomLevel[];
  singleLevel: boolean;
} => {
  const errors: string[] = [];
  const warnings: string[] = [];
  let levels: CustomLevel[] = [];
  let singleLevel = false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    errors.push('JSON 格式损坏，无法解析');
    return { valid: false, errors, warnings, levels, singleLevel };
  }

  if (isValidCustomLevel(parsed)) {
    levels = [parsed];
    singleLevel = true;
  } else if (Array.isArray(parsed)) {
    for (let i = 0; i < parsed.length; i++) {
      if (isValidCustomLevel(parsed[i])) {
        levels.push(parsed[i]);
      } else {
        warnings.push(`第 ${i + 1} 个关卡格式无效，已跳过`);
      }
    }
  } else if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.levels)) {
      for (let i = 0; i < obj.levels.length; i++) {
        if (isValidCustomLevel(obj.levels[i])) {
          levels.push(obj.levels[i]);
        } else {
          warnings.push(`levels[${i}] 格式无效，已跳过`);
        }
      }
    } else {
      errors.push('JSON 根元素既不是关卡对象也不是关卡数组');
    }
  } else {
    errors.push('JSON 根元素格式无效');
  }

  if (levels.length === 0 && errors.length === 0) {
    errors.push('未找到有效的关卡数据');
  }

  return { valid: errors.length === 0, errors, warnings, levels, singleLevel };
};

export interface ImportLevelsOptions {
  levels: CustomLevel[];
  onConflict?: (incoming: CustomLevel, existing: CustomLevel, index: number) => NameConflictAction;
}

export const importWorkshopLevels = (options: ImportLevelsOptions): LevelImportResult => {
  const result: LevelImportResult = {
    success: false,
    errors: [],
    warnings: [],
    importedLevels: [],
    conflicts: [],
  };

  const state = loadWorkshopState();
  const backup = localStorage.getItem(STORAGE_KEYS.WORKSHOP);

  try {
    options.levels.forEach((incoming, index) => {
      const validation = validateLevel(incoming);
      if (!validation.valid) {
        result.warnings.push(
          `第 ${index + 1} 个关卡「${incoming.name || '未命名'}」校验失败：${validation.errors.join('; ')}，已跳过`
        );
        return;
      }

      const existing = state.levels.find(
        (l) => l.name.trim().toLowerCase() === incoming.name.trim().toLowerCase()
      );

      if (existing) {
        result.conflicts.push({ incoming, existing });
        if (options.onConflict) {
          const action = options.onConflict(incoming, existing, index);
          if (action === 'overwrite') {
            const idx = state.levels.findIndex((l) => l.id === existing.id);
            const now = Date.now();
            state.levels[idx] = {
              ...incoming,
              id: existing.id,
              createdAt: existing.createdAt,
              updatedAt: now,
            };
            result.importedLevels.push(state.levels[idx]);
          } else {
            const uniqueName = generateUniqueName(
              incoming.name,
              state.levels.map((l) => l.name)
            );
            const now = Date.now();
            const newLevel: CustomLevel = {
              ...incoming,
              id: generateId(),
              name: uniqueName,
              createdAt: now,
              updatedAt: now,
            };
            state.levels.push(newLevel);
            result.importedLevels.push(newLevel);
          }
        } else {
          return;
        }
      } else {
        const now = Date.now();
        const newLevel: CustomLevel = {
          ...incoming,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };
        state.levels.push(newLevel);
        result.importedLevels.push(newLevel);
      }
    });

    saveWorkshopState(state);
    result.success = true;
  } catch (e) {
    console.error('Import workshop levels failed:', e);
    if (backup !== null) {
      try {
        localStorage.setItem(STORAGE_KEYS.WORKSHOP, backup);
      } catch (rb) {
        console.error('Rollback workshop state also failed:', rb);
      }
    }
    result.errors.push('导入过程中发生错误，原有工坊数据已回滚');
  }

  return result;
};

export const exportWorkshopLevel = (level: CustomLevel): string => {
  return JSON.stringify(
    {
      id: level.id,
      name: level.name,
      description: level.description || '',
      playerStart: level.playerStart,
      obstacles: level.obstacles,
      events: level.events,
      createdAt: level.createdAt,
      updatedAt: level.updatedAt,
      exportedAt: Date.now(),
    },
    null,
    2
  );
};

export const exportAllWorkshopLevels = (): string => {
  const state = loadWorkshopState();
  return JSON.stringify(
    {
      levels: state.levels.map((l) => ({
        id: l.id,
        name: l.name,
        description: l.description || '',
        playerStart: l.playerStart,
        obstacles: l.obstacles,
        events: l.events,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      })),
      scores: state.scores,
      exportedAt: Date.now(),
    },
    null,
    2
  );
};

export const createGameEventForEditor = (
  type: 'normal' | 'bonus' | 'danger',
  position: Position
): GameEvent => ({
  id: generateId(),
  position: { ...position },
  type,
  score: EVENT_SCORES[type],
});

export { generateId };
