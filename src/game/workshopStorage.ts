import {
  CustomLevel,
  WorkshopState,
  WorkshopScore,
  STORAGE_KEYS,
  Position,
  GameEvent,
  BOARD_SIZE,
  EVENT_SCORES,
  VersionSnapshot,
  SnapshotSource,
  LevelDiff,
  LevelTimeline,
  TimelineLogEntry,
  TimelineActionType,
  WorkshopTimelineState,
  UnsavedEditorDraft,
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

const normalizeCustomLevel = (obj: CustomLevel): CustomLevel => {
  return {
    ...obj,
    status: (obj.status === 'published') ? 'published' : 'draft',
    version: typeof obj.version === 'string' && obj.version ? obj.version : '1.0.0',
    versionNote: typeof obj.versionNote === 'string' ? obj.versionNote : undefined,
    publishedAt: typeof obj.publishedAt === 'number' ? obj.publishedAt : undefined,
  };
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
          state.levels.push(normalizeCustomLevel(lvl));
        }
      }
    }

    if (typeof parsed.lastEditingLevelId === 'string') {
      state.lastEditingLevelId = parsed.lastEditingLevelId;
    }

    if (parsed.lastEditingSnapshot && isValidCustomLevel(parsed.lastEditingSnapshot)) {
      state.lastEditingSnapshot = normalizeCustomLevel(parsed.lastEditingSnapshot);
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
            status: 'draft',
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
      status: 'draft',
      version: '1.0.0',
      versionNote: '',
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
    const hasContentChanges =
      updates.playerStart !== undefined ||
      updates.obstacles !== undefined ||
      updates.events !== undefined ||
      updates.name !== undefined ||
      updates.description !== undefined;

    const updated: CustomLevel = {
      ...state.levels[idx],
      ...updates,
      obstacles: updates.obstacles ? JSON.parse(JSON.stringify(updates.obstacles)) : state.levels[idx].obstacles,
      events: updates.events ? JSON.parse(JSON.stringify(updates.events)) : state.levels[idx].events,
      playerStart: updates.playerStart ? JSON.parse(JSON.stringify(updates.playerStart)) : state.levels[idx].playerStart,
      status: hasContentChanges ? 'draft' : (updates.status || state.levels[idx].status),
      publishedAt: hasContentChanges ? undefined : (updates.publishedAt ?? state.levels[idx].publishedAt),
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

export const publishWorkshopLevel = (
  id: string,
  versionNote?: string
): CustomLevel | null => {
  try {
    const state = loadWorkshopState();
    const idx = state.levels.findIndex((l) => l.id === id);
    if (idx === -1) return null;

    const now = Date.now();
    const existing = state.levels[idx];
    const versionParts = existing.version.split('.').map((v) => parseInt(v) || 0);
    while (versionParts.length < 3) versionParts.push(0);
    versionParts[2] += 1;
    const newVersion = versionParts.join('.');

    const updated: CustomLevel = {
      ...existing,
      status: 'published',
      version: newVersion,
      versionNote: versionNote || existing.versionNote || '',
      publishedAt: now,
      updatedAt: now,
    };

    state.levels[idx] = updated;
    saveWorkshopState(state);
    return updated;
  } catch (e) {
    console.error('Publish workshop level failed:', e);
    return null;
  }
};

export const unpublishWorkshopLevel = (id: string): CustomLevel | null => {
  try {
    const state = loadWorkshopState();
    const idx = state.levels.findIndex((l) => l.id === id);
    if (idx === -1) return null;

    const now = Date.now();
    const updated: CustomLevel = {
      ...state.levels[idx],
      status: 'draft',
      publishedAt: undefined,
      updatedAt: now,
    };

    state.levels[idx] = updated;
    saveWorkshopState(state);
    return updated;
  } catch (e) {
    console.error('Unpublish workshop level failed:', e);
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
  status: 'draft',
  version: '1.0.0',
  versionNote: '',
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
            state.levels[idx] = normalizeCustomLevel({
              ...incoming,
              id: existing.id,
              createdAt: existing.createdAt,
              updatedAt: now,
            });
            result.importedLevels.push(state.levels[idx]);
          } else {
            const uniqueName = generateUniqueName(
              incoming.name,
              state.levels.map((l) => l.name)
            );
            const now = Date.now();
            const newLevel: CustomLevel = normalizeCustomLevel({
              ...incoming,
              id: generateId(),
              name: uniqueName,
              createdAt: now,
              updatedAt: now,
            });
            state.levels.push(newLevel);
            result.importedLevels.push(newLevel);
          }
        } else {
          return;
        }
      } else {
        const now = Date.now();
        const newLevel: CustomLevel = normalizeCustomLevel({
          ...incoming,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        });
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
      status: level.status,
      version: level.version,
      versionNote: level.versionNote || '',
      publishedAt: level.publishedAt,
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
        status: l.status,
        version: l.version,
        versionNote: l.versionNote || '',
        publishedAt: l.publishedAt,
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

const deepCloneLevel = (lvl: CustomLevel): CustomLevel => JSON.parse(JSON.stringify(lvl));

export const computeLevelDiff = (
  from: CustomLevel | null,
  to: CustomLevel
): LevelDiff => {
  const diff: LevelDiff = {
    playerStartChanged: false,
    obstaclesAdded: [],
    obstaclesRemoved: [],
    eventsAdded: [],
    eventsRemoved: [],
    eventsModified: [],
    nameChanged: false,
    descriptionChanged: false,
    totalChanges: 0,
  };

  if (!from) {
    diff.playerStartChanged = true;
    diff.obstaclesAdded = JSON.parse(JSON.stringify(to.obstacles));
    diff.eventsAdded = JSON.parse(JSON.stringify(to.events));
    diff.nameChanged = !!to.name;
    diff.descriptionChanged = !!to.description;
    diff.totalChanges =
      diff.obstaclesAdded.length +
      diff.eventsAdded.length +
      (diff.playerStartChanged ? 1 : 0) +
      (diff.nameChanged ? 1 : 0) +
      (diff.descriptionChanged ? 1 : 0);
    return diff;
  }

  diff.playerStartChanged = !posEquals(from.playerStart, to.playerStart);
  diff.nameChanged = from.name !== to.name;
  diff.descriptionChanged = (from.description || '') !== (to.description || '');

  for (const obs of to.obstacles) {
    if (!from.obstacles.some((o) => posEquals(o, obs))) {
      diff.obstaclesAdded.push({ ...obs });
    }
  }
  for (const obs of from.obstacles) {
    if (!to.obstacles.some((o) => posEquals(o, obs))) {
      diff.obstaclesRemoved.push({ ...obs });
    }
  }

  const fromEventMap = new Map(from.events.map((e) => [e.id, e]));
  const toEventMap = new Map(to.events.map((e) => [e.id, e]));

  for (const ev of to.events) {
    const prev = fromEventMap.get(ev.id);
    if (!prev) {
      diff.eventsAdded.push(JSON.parse(JSON.stringify(ev)));
    } else if (
      !posEquals(prev.position, ev.position) ||
      prev.type !== ev.type ||
      prev.score !== ev.score
    ) {
      diff.eventsModified.push(JSON.parse(JSON.stringify(ev)));
    }
  }
  for (const ev of from.events) {
    if (!toEventMap.has(ev.id)) {
      diff.eventsRemoved.push(JSON.parse(JSON.stringify(ev)));
    }
  }

  diff.totalChanges =
    diff.obstaclesAdded.length +
    diff.obstaclesRemoved.length +
    diff.eventsAdded.length +
    diff.eventsRemoved.length +
    diff.eventsModified.length +
    (diff.playerStartChanged ? 1 : 0) +
    (diff.nameChanged ? 1 : 0) +
    (diff.descriptionChanged ? 1 : 0);

  return diff;
};

const getEmptyTimelineState = (): WorkshopTimelineState => ({
  timelines: {},
  unsavedDrafts: {},
  activeDraftLevelId: null,
  lastRollbackInfo: null,
});

const isValidSnapshot = (obj: unknown): obj is VersionSnapshot => {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  if (typeof o.id !== 'string') return false;
  if (typeof o.levelId !== 'string') return false;
  if (typeof o.name !== 'string') return false;
  if (typeof o.source !== 'string') return false;
  if (typeof o.createdAt !== 'number') return false;
  if (!isValidCustomLevel(o.levelData)) return false;
  return true;
};

const isValidTimelineLog = (obj: unknown): obj is TimelineLogEntry => {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  if (typeof o.id !== 'string') return false;
  if (typeof o.levelId !== 'string') return false;
  if (typeof o.action !== 'string') return false;
  if (typeof o.message !== 'string') return false;
  if (typeof o.timestamp !== 'number') return false;
  return true;
};

const isValidUnsavedDraft = (obj: unknown): obj is UnsavedEditorDraft => {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  if (!Array.isArray(o.editorHistory)) return false;
  if (!Array.isArray(o.editorFuture)) return false;
  if (typeof o.savedAt !== 'number') return false;
  return true;
};

export const loadTimelineState = (): WorkshopTimelineState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WORKSHOP_TIMELINE);
    if (!raw) return getEmptyTimelineState();

    const parsed = JSON.parse(raw);
    const state: WorkshopTimelineState = getEmptyTimelineState();

    if (typeof parsed.timelines === 'object' && parsed.timelines !== null) {
      for (const key of Object.keys(parsed.timelines)) {
        const tl = parsed.timelines[key];
        if (typeof tl !== 'object' || tl === null) continue;
        const o = tl as Record<string, unknown>;
        if (typeof o.levelId !== 'string') continue;

        const snapshots: VersionSnapshot[] = [];
        if (Array.isArray(o.snapshots)) {
          for (const s of o.snapshots) {
            if (isValidSnapshot(s)) snapshots.push(s);
          }
        }
        snapshots.sort((a, b) => a.createdAt - b.createdAt);

        const logs: TimelineLogEntry[] = [];
        if (Array.isArray(o.logs)) {
          for (const l of o.logs) {
            if (isValidTimelineLog(l)) logs.push(l);
          }
        }
        logs.sort((a, b) => a.timestamp - b.timestamp);

        state.timelines[key] = {
          levelId: o.levelId,
          snapshots,
          currentSnapshotId: typeof o.currentSnapshotId === 'string' ? o.currentSnapshotId : null,
          lastRollbackSnapshotId: typeof o.lastRollbackSnapshotId === 'string' ? o.lastRollbackSnapshotId : null,
          logs,
          updatedAt: typeof o.updatedAt === 'number' ? o.updatedAt : Date.now(),
        };
      }
    }

    if (typeof parsed.unsavedDrafts === 'object' && parsed.unsavedDrafts !== null) {
      for (const key of Object.keys(parsed.unsavedDrafts)) {
        const d = parsed.unsavedDrafts[key];
        if (isValidUnsavedDraft(d)) {
          state.unsavedDrafts[key] = d;
        }
      }
    }

    if (typeof parsed.activeDraftLevelId === 'string') {
      state.activeDraftLevelId = parsed.activeDraftLevelId;
    }

    if (typeof parsed.lastRollbackInfo === 'object' && parsed.lastRollbackInfo !== null) {
      const r = parsed.lastRollbackInfo as Record<string, unknown>;
      if (typeof r.levelId === 'string' && typeof r.snapshotId === 'string' && typeof r.timestamp === 'number') {
        state.lastRollbackInfo = {
          levelId: r.levelId,
          snapshotId: r.snapshotId,
          timestamp: r.timestamp,
        };
      }
    }

    return state;
  } catch (e) {
    console.error('Load timeline state failed:', e);
    return getEmptyTimelineState();
  }
};

export const saveTimelineState = (state: WorkshopTimelineState): boolean => {
  try {
    localStorage.setItem(STORAGE_KEYS.WORKSHOP_TIMELINE, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('Save timeline state failed:', e);
    return false;
  }
};

export const getLevelTimeline = (levelId: string): LevelTimeline | null => {
  const state = loadTimelineState();
  return state.timelines[levelId] || null;
};

export const listAllTimelines = (): Record<string, LevelTimeline> => {
  return loadTimelineState().timelines;
};

const addTimelineLogInner = (
  state: WorkshopTimelineState,
  levelId: string,
  action: TimelineActionType,
  message: string,
  opts: { snapshotId?: string; targetSnapshotId?: string; details?: Record<string, unknown> } = {}
): void => {
  if (!state.timelines[levelId]) {
    state.timelines[levelId] = {
      levelId,
      snapshots: [],
      currentSnapshotId: null,
      lastRollbackSnapshotId: null,
      logs: [],
      updatedAt: Date.now(),
    };
  }
  const entry: TimelineLogEntry = {
    id: generateId(),
    levelId,
    action,
    message,
    timestamp: Date.now(),
    snapshotId: opts.snapshotId,
    targetSnapshotId: opts.targetSnapshotId,
    details: opts.details,
  };
  state.timelines[levelId].logs.push(entry);
  state.timelines[levelId].updatedAt = Date.now();
};

export interface CreateSnapshotOptions {
  levelId: string;
  levelData: CustomLevel;
  source: SnapshotSource;
  name?: string;
  note?: string;
}

const defaultSnapshotName = (source: SnapshotSource, n: number): string => {
  switch (source) {
    case 'manual-save': return `手动保存 #${n}`;
    case 'playtest-return': return `试玩返回 #${n}`;
    case 'pre-publish': return `发布前 #${n}`;
    case 'manual-snapshot': return `快照 #${n}`;
    case 'rollback': return `回滚点 #${n}`;
    case 'import': return `导入 #${n}`;
    default: return `版本 #${n}`;
  }
};

export const createVersionSnapshot = (options: CreateSnapshotOptions): VersionSnapshot | null => {
  try {
    const { levelId, levelData, source, note } = options;
    const state = loadTimelineState();

    if (!state.timelines[levelId]) {
      state.timelines[levelId] = {
        levelId,
        snapshots: [],
        currentSnapshotId: null,
        lastRollbackSnapshotId: null,
        logs: [],
        updatedAt: Date.now(),
      };
    }
    const tl = state.timelines[levelId];

    const parentSnapshotId = tl.currentSnapshotId;
    const parentSnapshot = parentSnapshotId
      ? tl.snapshots.find((s) => s.id === parentSnapshotId) || null
      : null;

    const existingSameSource = tl.snapshots.filter((s) => s.source === source).length;
    const snapName = options.name || defaultSnapshotName(source, existingSameSource + 1);

    const snapshot: VersionSnapshot = {
      id: generateId(),
      levelId,
      name: snapName,
      note,
      source,
      createdAt: Date.now(),
      parentSnapshotId,
      levelData: deepCloneLevel(levelData),
      diffFromParent: computeLevelDiff(parentSnapshot ? parentSnapshot.levelData : null, levelData),
    };

    tl.snapshots.push(snapshot);
    tl.currentSnapshotId = snapshot.id;
    tl.updatedAt = Date.now();

    addTimelineLogInner(
      state,
      levelId,
      'snapshot-create',
      `创建快照「${snapName}」(${source})`,
      { snapshotId: snapshot.id, details: { source, totalChanges: snapshot.diffFromParent?.totalChanges ?? 0 } }
    );

    saveTimelineState(state);
    return snapshot;
  } catch (e) {
    console.error('Create version snapshot failed:', e);
    return null;
  }
};

export const renameVersionSnapshot = (
  levelId: string,
  snapshotId: string,
  newName: string,
  newNote?: string
): boolean => {
  try {
    const state = loadTimelineState();
    const tl = state.timelines[levelId];
    if (!tl) return false;

    const idx = tl.snapshots.findIndex((s) => s.id === snapshotId);
    if (idx === -1) return false;

    const oldName = tl.snapshots[idx].name;
    tl.snapshots[idx] = {
      ...tl.snapshots[idx],
      name: newName,
      note: newNote !== undefined ? newNote : tl.snapshots[idx].note,
    };
    tl.updatedAt = Date.now();

    addTimelineLogInner(
      state,
      levelId,
      'snapshot-rename',
      `快照「${oldName}」重命名为「${newName}」`,
      { snapshotId }
    );

    saveTimelineState(state);
    return true;
  } catch (e) {
    console.error('Rename snapshot failed:', e);
    return false;
  }
};

export const deleteVersionSnapshot = (levelId: string, snapshotId: string): boolean => {
  try {
    const state = loadTimelineState();
    const tl = state.timelines[levelId];
    if (!tl) return false;

    const snap = tl.snapshots.find((s) => s.id === snapshotId);
    if (!snap) return false;

    tl.snapshots = tl.snapshots.filter((s) => s.id !== snapshotId);
    if (tl.currentSnapshotId === snapshotId) {
      tl.currentSnapshotId = tl.snapshots.length > 0
        ? tl.snapshots[tl.snapshots.length - 1].id
        : null;
    }
    tl.updatedAt = Date.now();

    addTimelineLogInner(
      state,
      levelId,
      'snapshot-delete',
      `删除快照「${snap.name}」`,
      { snapshotId }
    );

    saveTimelineState(state);
    return true;
  } catch (e) {
    console.error('Delete snapshot failed:', e);
    return false;
  }
};

export interface RollbackResult {
  success: boolean;
  level?: CustomLevel;
  snapshot?: VersionSnapshot;
  error?: string;
}

export const rollbackToSnapshot = (levelId: string, snapshotId: string): RollbackResult => {
  try {
    const state = loadTimelineState();
    const tl = state.timelines[levelId];
    if (!tl) return { success: false, error: '时间线不存在' };

    const snap = tl.snapshots.find((s) => s.id === snapshotId);
    if (!snap) return { success: false, error: '快照不存在' };

    const restoredLevel = deepCloneLevel(snap.levelData);
    tl.lastRollbackSnapshotId = snapshotId;
    tl.currentSnapshotId = snapshotId;
    tl.updatedAt = Date.now();

    state.lastRollbackInfo = {
      levelId,
      snapshotId,
      timestamp: Date.now(),
    };

    addTimelineLogInner(
      state,
      levelId,
      'rollback',
      `回滚到快照「${snap.name}」`,
      { snapshotId, targetSnapshotId: snapshotId }
    );

    saveTimelineState(state);

    const updated = updateWorkshopLevel(levelId, {
      name: restoredLevel.name,
      description: restoredLevel.description,
      playerStart: restoredLevel.playerStart,
      obstacles: restoredLevel.obstacles,
      events: restoredLevel.events,
    });

    return {
      success: true,
      level: updated || restoredLevel,
      snapshot: snap,
    };
  } catch (e) {
    console.error('Rollback to snapshot failed:', e);
    return { success: false, error: String(e) };
  }
};

export const rollbackSnapshotAsNewLevel = (
  levelId: string,
  snapshotId: string,
  newName: string
): RollbackResult => {
  try {
    const state = loadTimelineState();
    const tl = state.timelines[levelId];
    if (!tl) return { success: false, error: '时间线不存在' };

    const snap = tl.snapshots.find((s) => s.id === snapshotId);
    if (!snap) return { success: false, error: '快照不存在' };

    const existing = listWorkshopLevels();
    const finalName = generateUniqueName(newName, existing.map((l) => l.name));

    const created = createWorkshopLevel({
      name: finalName,
      description: snap.levelData.description,
      playerStart: snap.levelData.playerStart,
      obstacles: snap.levelData.obstacles,
      events: snap.levelData.events,
    });

    if (!created) return { success: false, error: '创建新关卡失败' };

    addTimelineLogInner(
      state,
      levelId,
      'rollback-to-new',
      `从快照「${snap.name}」另存为新关卡「${finalName}」`,
      { snapshotId, details: { newLevelId: created.id, newName: finalName } }
    );
    saveTimelineState(state);

    createVersionSnapshot({
      levelId: created.id,
      levelData: created,
      source: 'rollback',
      name: `从 ${snap.name} 派生`,
      note: `从关卡 ${levelId} 的快照派生`,
    });

    return { success: true, level: created, snapshot: snap };
  } catch (e) {
    console.error('Rollback as new level failed:', e);
    return { success: false, error: String(e) };
  }
};

export const getTimelineLogs = (levelId: string): TimelineLogEntry[] => {
  const tl = getLevelTimeline(levelId);
  if (!tl) return [];
  return [...tl.logs].sort((a, b) => b.timestamp - a.timestamp);
};

export const getLastRollbackInfo = (): WorkshopTimelineState['lastRollbackInfo'] => {
  return loadTimelineState().lastRollbackInfo;
};

export const saveUnsavedEditorDraft = (
  levelId: string | null,
  levelData: CustomLevel | null,
  editorHistory: CustomLevel[] = [],
  editorFuture: CustomLevel[] = []
): void => {
  try {
    const state = loadTimelineState();
    const key = levelId || '__new__';

    state.unsavedDrafts[key] = {
      levelId,
      levelData: levelData ? deepCloneLevel(levelData) : null,
      editorHistory: editorHistory.map(deepCloneLevel),
      editorFuture: editorFuture.map(deepCloneLevel),
      savedAt: Date.now(),
    };
    state.activeDraftLevelId = key;
    saveTimelineState(state);
  } catch (e) {
    console.error('Save unsaved draft failed:', e);
  }
};

export const loadUnsavedEditorDraft = (
  levelId: string | null
): UnsavedEditorDraft | null => {
  const state = loadTimelineState();
  const key = levelId || '__new__';
  return state.unsavedDrafts[key] || null;
};

export const clearUnsavedEditorDraft = (levelId: string | null): void => {
  try {
    const state = loadTimelineState();
    const key = levelId || '__new__';
    delete state.unsavedDrafts[key];
    if (state.activeDraftLevelId === key) {
      state.activeDraftLevelId = null;
    }
    saveTimelineState(state);
  } catch (e) {
    console.error('Clear unsaved draft failed:', e);
  }
};

export const getActiveDraftLevelId = (): string | null => {
  return loadTimelineState().activeDraftLevelId;
};

export interface TimelineImportConflict {
  type: 'level-name' | 'snapshot-name';
  incomingName: string;
  existingName?: string;
  incomingLevel?: CustomLevel;
  existingLevel?: CustomLevel;
}

export type TimelineImportAction = 'merge' | 'overwrite' | 'rename';

export interface TimelineExportSingleResult {
  version: number;
  exportedAt: number;
  kind: 'single-snapshot';
  levelId: string;
  snapshot: VersionSnapshot;
}

export interface TimelineExportFullResult {
  version: number;
  exportedAt: number;
  kind: 'full-timeline';
  levelId: string;
  level: CustomLevel;
  timeline: LevelTimeline;
}

export const exportSingleSnapshot = (levelId: string, snapshotId: string): string | null => {
  try {
    const tl = getLevelTimeline(levelId);
    if (!tl) return null;
    const snap = tl.snapshots.find((s) => s.id === snapshotId);
    if (!snap) return null;

    const payload: TimelineExportSingleResult = {
      version: 1,
      exportedAt: Date.now(),
      kind: 'single-snapshot',
      levelId,
      snapshot: JSON.parse(JSON.stringify(snap)),
    };

    const state = loadTimelineState();
    addTimelineLogInner(state, levelId, 'export-single', `导出快照「${snap.name}」`, { snapshotId });
    saveTimelineState(state);

    return JSON.stringify(payload, null, 2);
  } catch (e) {
    console.error('Export single snapshot failed:', e);
    return null;
  }
};

export const exportFullTimeline = (levelId: string): string | null => {
  try {
    const level = getWorkshopLevel(levelId);
    const tl = getLevelTimeline(levelId);
    if (!level || !tl) return null;

    const payload: TimelineExportFullResult = {
      version: 1,
      exportedAt: Date.now(),
      kind: 'full-timeline',
      levelId,
      level: JSON.parse(JSON.stringify(level)),
      timeline: JSON.parse(JSON.stringify(tl)),
    };

    const state = loadTimelineState();
    addTimelineLogInner(state, levelId, 'export-full', `导出完整时间线 (${tl.snapshots.length} 个快照)`, {});
    saveTimelineState(state);

    return JSON.stringify(payload, null, 2);
  } catch (e) {
    console.error('Export full timeline failed:', e);
    return null;
  }
};

export const validateTimelineJSON = (jsonString: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  kind: 'single-snapshot' | 'full-timeline' | null;
  snapshot?: VersionSnapshot;
  level?: CustomLevel;
  timeline?: LevelTimeline;
  levelId?: string;
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    errors.push('JSON 格式损坏，无法解析');
    return { valid: false, errors, warnings, kind: null };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    errors.push('根元素不是对象');
    return { valid: false, errors, warnings, kind: null };
  }

  const obj = parsed as Record<string, unknown>;
  if (typeof obj.version !== 'number') {
    errors.push('缺少 version 字段');
    return { valid: false, errors, warnings, kind: null };
  }

  if (obj.kind === 'single-snapshot') {
    if (!isValidSnapshot(obj.snapshot)) {
      errors.push('snapshot 字段无效');
      return { valid: false, errors, warnings, kind: null };
    }
    if (typeof obj.levelId !== 'string') {
      errors.push('levelId 字段无效');
      return { valid: false, errors, warnings, kind: null };
    }
    return {
      valid: true,
      errors,
      warnings,
      kind: 'single-snapshot',
      snapshot: obj.snapshot as VersionSnapshot,
      levelId: obj.levelId as string,
    };
  }

  if (obj.kind === 'full-timeline') {
    if (!isValidCustomLevel(obj.level)) {
      errors.push('level 字段无效');
      return { valid: false, errors, warnings, kind: null };
    }
    if (typeof obj.levelId !== 'string') {
      errors.push('levelId 字段无效');
      return { valid: false, errors, warnings, kind: null };
    }
    const tl = obj.timeline as Record<string, unknown> | undefined;
    if (!tl || typeof tl.levelId !== 'string' || !Array.isArray(tl.snapshots)) {
      errors.push('timeline 字段无效');
      return { valid: false, errors, warnings, kind: null };
    }
    const validSnaps: VersionSnapshot[] = [];
    for (const s of tl.snapshots) {
      if (isValidSnapshot(s)) validSnaps.push(s);
      else warnings.push('timeline 中存在无效快照，已跳过');
    }
    const validLogs: TimelineLogEntry[] = [];
    if (Array.isArray(tl.logs)) {
      for (const l of tl.logs) {
        if (isValidTimelineLog(l)) validLogs.push(l);
      }
    }
    return {
      valid: true,
      errors,
      warnings,
      kind: 'full-timeline',
      level: obj.level as CustomLevel,
      levelId: obj.levelId as string,
      timeline: {
        levelId: tl.levelId as string,
        snapshots: validSnaps,
        currentSnapshotId: typeof tl.currentSnapshotId === 'string' ? tl.currentSnapshotId : null,
        lastRollbackSnapshotId: typeof tl.lastRollbackSnapshotId === 'string' ? tl.lastRollbackSnapshotId : null,
        logs: validLogs,
        updatedAt: typeof tl.updatedAt === 'number' ? tl.updatedAt : Date.now(),
      },
    };
  }

  errors.push('未知的 kind 字段');
  return { valid: false, errors, warnings, kind: null };
};

export interface ImportTimelineOptions {
  jsonString: string;
  onLevelConflict?: (incoming: CustomLevel, existing: CustomLevel) => TimelineImportAction;
}

export interface ImportTimelineResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  importedLevel?: CustomLevel;
  importedSnapshotsCount: number;
  conflictAction?: TimelineImportAction;
}

export const importTimelineJSON = (options: ImportTimelineOptions): ImportTimelineResult => {
  const result: ImportTimelineResult = {
    success: false,
    errors: [],
    warnings: [],
    importedSnapshotsCount: 0,
  };

  const validation = validateTimelineJSON(options.jsonString);
  if (!validation.valid) {
    result.errors = validation.errors;
    result.warnings = validation.warnings;
    return result;
  }

  const backupWorkshop = localStorage.getItem(STORAGE_KEYS.WORKSHOP);
  const backupTimeline = localStorage.getItem(STORAGE_KEYS.WORKSHOP_TIMELINE);

  try {
    if (validation.kind === 'single-snapshot' && validation.snapshot) {
      const snapLevel = validation.snapshot.levelData;
      const existingByName = listWorkshopLevels().find(
        (l) => l.name.trim().toLowerCase() === snapLevel.name.trim().toLowerCase()
      );

      let finalLevel: CustomLevel | null = null;
      let action: TimelineImportAction = 'rename';

      if (existingByName && options.onLevelConflict) {
        action = options.onLevelConflict(snapLevel, existingByName);
        result.conflictAction = action;

        if (action === 'overwrite') {
          finalLevel = updateWorkshopLevel(existingByName.id, {
            name: snapLevel.name,
            description: snapLevel.description,
            playerStart: snapLevel.playerStart,
            obstacles: snapLevel.obstacles,
            events: snapLevel.events,
          });
        } else if (action === 'merge') {
          finalLevel = updateWorkshopLevel(existingByName.id, {
            name: snapLevel.name,
            description: snapLevel.description || existingByName.description,
            playerStart: snapLevel.playerStart,
            obstacles: snapLevel.obstacles,
            events: snapLevel.events,
          });
        } else {
          finalLevel = createWorkshopLevel({
            name: snapLevel.name,
            description: snapLevel.description,
            playerStart: snapLevel.playerStart,
            obstacles: snapLevel.obstacles,
            events: snapLevel.events,
            onNameConflict: () => 'rename',
          });
        }
      } else if (existingByName) {
        finalLevel = createWorkshopLevel({
          name: snapLevel.name,
          description: snapLevel.description,
          playerStart: snapLevel.playerStart,
          obstacles: snapLevel.obstacles,
          events: snapLevel.events,
          onNameConflict: () => 'rename',
        });
      } else {
        finalLevel = createWorkshopLevel({
          name: snapLevel.name,
          description: snapLevel.description,
          playerStart: snapLevel.playerStart,
          obstacles: snapLevel.obstacles,
          events: snapLevel.events,
        });
      }

      if (!finalLevel) {
        result.errors.push('创建或更新关卡失败');
        rollbackStorage(backupWorkshop, backupTimeline);
        return result;
      }

      if (action === 'overwrite') {
        const ts = loadTimelineState();
        if (ts.timelines[finalLevel.id]) {
          ts.timelines[finalLevel.id].snapshots = [];
          ts.timelines[finalLevel.id].logs = [];
          ts.timelines[finalLevel.id].currentSnapshotId = null;
          ts.timelines[finalLevel.id].lastRollbackSnapshotId = null;
        }
        saveTimelineState(ts);
      }

      const importedSnap = createVersionSnapshot({
        levelId: finalLevel.id,
        levelData: finalLevel,
        source: 'import',
        name: validation.snapshot.name || '导入快照',
        note: validation.snapshot.note,
      });

      if (importedSnap) {
        result.importedSnapshotsCount = 1;
      }
      result.importedLevel = finalLevel;
      result.warnings = validation.warnings;
      result.success = true;
      return result;
    }

    if (validation.kind === 'full-timeline' && validation.level && validation.timeline) {
      const incomingLevel = validation.level;
      const existingByName = listWorkshopLevels().find(
        (l) => l.name.trim().toLowerCase() === incomingLevel.name.trim().toLowerCase()
      );

      let finalLevel: CustomLevel | null = null;
      let action: TimelineImportAction = 'rename';

      if (existingByName && options.onLevelConflict) {
        action = options.onLevelConflict(incomingLevel, existingByName);
        result.conflictAction = action;

        if (action === 'overwrite' || action === 'merge') {
          finalLevel = updateWorkshopLevel(existingByName.id, {
            name: incomingLevel.name,
            description: incomingLevel.description,
            playerStart: incomingLevel.playerStart,
            obstacles: incomingLevel.obstacles,
            events: incomingLevel.events,
            status: incomingLevel.status,
            version: incomingLevel.version,
            versionNote: incomingLevel.versionNote,
          });
        } else {
          finalLevel = createWorkshopLevel({
            name: incomingLevel.name,
            description: incomingLevel.description,
            playerStart: incomingLevel.playerStart,
            obstacles: incomingLevel.obstacles,
            events: incomingLevel.events,
            onNameConflict: () => 'rename',
          });
        }
      } else if (existingByName) {
        finalLevel = createWorkshopLevel({
          name: incomingLevel.name,
          description: incomingLevel.description,
          playerStart: incomingLevel.playerStart,
          obstacles: incomingLevel.obstacles,
          events: incomingLevel.events,
          onNameConflict: () => 'rename',
        });
      } else {
        finalLevel = createWorkshopLevel({
          name: incomingLevel.name,
          description: incomingLevel.description,
          playerStart: incomingLevel.playerStart,
          obstacles: incomingLevel.obstacles,
          events: incomingLevel.events,
        });
      }

      if (!finalLevel) {
        result.errors.push('创建或更新关卡失败');
        rollbackStorage(backupWorkshop, backupTimeline);
        return result;
      }

      let count = 0;
      const tlState = loadTimelineState();
      if (!tlState.timelines[finalLevel.id]) {
        tlState.timelines[finalLevel.id] = {
          levelId: finalLevel.id,
          snapshots: [],
          currentSnapshotId: null,
          lastRollbackSnapshotId: null,
          logs: [],
          updatedAt: Date.now(),
        };
      }
      const tl = tlState.timelines[finalLevel.id];

      if (action === 'overwrite') {
        tl.snapshots = [];
        tl.logs = [];
        tl.currentSnapshotId = null;
        tl.lastRollbackSnapshotId = null;
      }

      for (const snap of validation.timeline.snapshots) {
        const newSnap: VersionSnapshot = {
          ...snap,
          id: generateId(),
          levelId: finalLevel.id,
          levelData: deepCloneLevel(finalLevel),
          parentSnapshotId: tl.snapshots.length > 0 ? tl.snapshots[tl.snapshots.length - 1].id : null,
          createdAt: snap.createdAt,
          source: 'import',
        };
        newSnap.levelData = deepCloneLevel(snap.levelData);
        newSnap.levelData.id = finalLevel.id;
        tl.snapshots.push(newSnap);
        count++;
      }
      tl.snapshots.sort((a, b) => a.createdAt - b.createdAt);
      if (tl.snapshots.length > 0) {
        tl.currentSnapshotId = tl.snapshots[tl.snapshots.length - 1].id;
      }
      tl.updatedAt = Date.now();

      addTimelineLogInner(
        tlState,
        finalLevel.id,
        action === 'overwrite' ? 'conflict-overwrite' : action === 'merge' ? 'conflict-merge' : 'conflict-rename',
        `导入时间线，${count} 个快照 (${action})`,
        { details: { count, action } }
      );

      saveTimelineState(tlState);

      result.importedLevel = finalLevel;
      result.importedSnapshotsCount = count;
      result.warnings = validation.warnings;
      result.success = true;
      return result;
    }

    result.errors.push('未识别的导入内容');
    rollbackStorage(backupWorkshop, backupTimeline);
    return result;
  } catch (e) {
    console.error('Import timeline failed:', e);
    result.errors.push(`导入失败: ${String(e)}`);
    rollbackStorage(backupWorkshop, backupTimeline);
    return result;
  }
};

const rollbackStorage = (backupWorkshop: string | null, backupTimeline: string | null): void => {
  try {
    if (backupWorkshop !== null) {
      localStorage.setItem(STORAGE_KEYS.WORKSHOP, backupWorkshop);
    } else {
      localStorage.removeItem(STORAGE_KEYS.WORKSHOP);
    }
    if (backupTimeline !== null) {
      localStorage.setItem(STORAGE_KEYS.WORKSHOP_TIMELINE, backupTimeline);
    } else {
      localStorage.removeItem(STORAGE_KEYS.WORKSHOP_TIMELINE);
    }
  } catch (e) {
    console.error('Rollback storage also failed:', e);
  }
};

export { generateId };
