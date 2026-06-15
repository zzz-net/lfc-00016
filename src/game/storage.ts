import { SaveData, GameState, STORAGE_KEYS, ArchiveData, ARCHIVE_VERSION } from './types';

const generateId = (): string => Math.random().toString(36).substring(2, 11);

const MAX_SAVES = 5;

export const saveGame = (
  slot: number,
  name: string,
  gameState: GameState,
  history: GameState[]
): SaveData | null => {
  try {
    if (slot < 0 || slot >= MAX_SAVES) {
      console.error('Invalid save slot');
      return null;
    }

    const saves = listSaves();
    const now = Date.now();

    const saveData: SaveData = {
      id: generateId(),
      name: name || `存档 ${slot + 1}`,
      createdAt: now,
      updatedAt: now,
      gameState: JSON.parse(JSON.stringify(gameState)),
      history: JSON.parse(JSON.stringify(history)),
    };

    saves[slot] = saveData;

    localStorage.setItem(STORAGE_KEYS.SAVES, JSON.stringify(saves));
    return saveData;
  } catch (e) {
    console.error('Save failed:', e);
    return null;
  }
};

export const autoSave = (gameState: GameState, history: GameState[]): void => {
  try {
    const saveData: SaveData = {
      id: generateId(),
      name: '自动存档',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      gameState: JSON.parse(JSON.stringify(gameState)),
      history: JSON.parse(JSON.stringify(history)),
    };
    localStorage.setItem(STORAGE_KEYS.AUTO_SAVE, JSON.stringify(saveData));
  } catch (e) {
    console.error('Auto save failed:', e);
  }
};

export const loadGame = (slot: number): SaveData | null => {
  try {
    if (slot < 0 || slot >= MAX_SAVES) {
      console.error('Invalid save slot');
      return null;
    }

    const saves = listSaves();
    const save = saves[slot];

    if (!save) return null;

    return JSON.parse(JSON.stringify(save));
  } catch (e) {
    console.error('Load failed:', e);
    return null;
  }
};

export const loadAutoSave = (): SaveData | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE);
    if (!data) return null;
    return JSON.parse(data);
  } catch (e) {
    console.error('Load auto save failed:', e);
    return null;
  }
};

export const listSaves = (): (SaveData | null)[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SAVES);
    if (!data) return new Array(MAX_SAVES).fill(null);

    const saves = JSON.parse(data);
    return saves.slice(0, MAX_SAVES);
  } catch (e) {
    console.error('List saves failed:', e);
    return new Array(MAX_SAVES).fill(null);
  }
};

export const deleteSave = (slot: number): boolean => {
  try {
    if (slot < 0 || slot >= MAX_SAVES) {
      console.error('Invalid save slot');
      return false;
    }

    const saves = listSaves();
    saves[slot] = null;
    localStorage.setItem(STORAGE_KEYS.SAVES, JSON.stringify(saves));
    return true;
  } catch (e) {
    console.error('Delete save failed:', e);
    return false;
  }
};

export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export interface ArchiveValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  hasSlotConflicts: boolean;
  hasUnsavedCurrentState: boolean;
  conflictingSlots: number[];
  archiveData: ArchiveData | null;
}

const isValidPosition = (obj: unknown): obj is { x: number; y: number } => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as Record<string, unknown>).x === 'number' &&
    typeof (obj as Record<string, unknown>).y === 'number'
  );
};

const isValidGameState = (obj: unknown): obj is GameState => {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  if (!isValidPosition(o.playerPosition)) return false;
  if (!Array.isArray(o.events)) return false;
  if (!Array.isArray(o.obstacles)) return false;
  if (typeof o.turn !== 'number') return false;
  if (typeof o.score !== 'number') return false;
  if (typeof o.isGameOver !== 'boolean') return false;
  if (!Array.isArray(o.logs)) return false;
  return true;
};

const isValidSaveData = (obj: unknown): obj is SaveData => {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  if (typeof o.id !== 'string') return false;
  if (typeof o.name !== 'string') return false;
  if (typeof o.createdAt !== 'number') return false;
  if (typeof o.updatedAt !== 'number') return false;
  if (!isValidGameState(o.gameState)) return false;
  if (!Array.isArray(o.history)) return false;
  return true;
};

export const validateArchive = (
  jsonString: string
): ArchiveValidationResult => {
  const result: ArchiveValidationResult = {
    valid: false,
    errors: [],
    warnings: [],
    hasSlotConflicts: false,
    hasUnsavedCurrentState: false,
    conflictingSlots: [],
    archiveData: null,
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    result.errors.push('JSON 格式损坏，无法解析');
    return result;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    result.errors.push('存档包根元素不是对象');
    return result;
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.version !== 'number') {
    result.errors.push('缺少版本号字段');
    return result;
  }

  if (obj.version > ARCHIVE_VERSION) {
    result.errors.push(
      `存档包版本 ${obj.version} 高于当前支持的版本 ${ARCHIVE_VERSION}，请更新应用`
    );
    return result;
  }

  if (obj.version < ARCHIVE_VERSION) {
    result.warnings.push(
      `存档包版本 ${obj.version} 低于当前版本 ${ARCHIVE_VERSION}，部分字段可能缺失，将使用默认值填充`
    );
  }

  if (!isValidGameState(obj.currentGameState)) {
    result.errors.push('currentGameState 字段无效或缺失');
    return result;
  }

  if (!Array.isArray(obj.currentHistory)) {
    result.errors.push('currentHistory 字段无效或缺失');
    return result;
  }

  for (let i = 0; i < obj.currentHistory.length; i++) {
    if (!isValidGameState(obj.currentHistory[i])) {
      result.errors.push(`currentHistory[${i}] 不是有效的 GameState`);
      return result;
    }
  }

  if (!Array.isArray(obj.saves)) {
    result.errors.push('saves 字段无效或缺失');
    return result;
  }

  if (obj.saves.length > MAX_SAVES) {
    result.errors.push(`saves 数组长度 ${obj.saves.length} 超过最大槽位数 ${MAX_SAVES}`);
    return result;
  }

  for (let i = 0; i < obj.saves.length; i++) {
    const slot = obj.saves[i];
    if (slot !== null && !isValidSaveData(slot)) {
      result.errors.push(`saves[${i}] 不是有效的 SaveData`);
      return result;
    }
  }

  if (obj.autoSave !== null && !isValidSaveData(obj.autoSave)) {
    result.errors.push('autoSave 字段无效');
    return result;
  }

  const archiveData: ArchiveData = {
    version: obj.version as number,
    exportedAt: (obj.exportedAt as number) || Date.now(),
    currentGameState: obj.currentGameState as GameState,
    currentHistory: obj.currentHistory as GameState[],
    saves: (obj.saves as (SaveData | null)[]).concat(
      new Array(Math.max(0, MAX_SAVES - (obj.saves as unknown[]).length)).fill(null)
    ),
    autoSave: obj.autoSave as SaveData | null,
  };

  const existingSaves = listSaves();
  const conflictingSlots: number[] = [];
  for (let i = 0; i < MAX_SAVES; i++) {
    if (archiveData.saves[i] !== null && existingSaves[i] !== null) {
      conflictingSlots.push(i);
    }
  }

  const currentAutoSave = loadAutoSave();
  const hasUnsavedCurrentState = currentAutoSave !== null;

  result.valid = true;
  result.hasSlotConflicts = conflictingSlots.length > 0;
  result.hasUnsavedCurrentState = hasUnsavedCurrentState;
  result.conflictingSlots = conflictingSlots;
  result.archiveData = archiveData;

  return result;
};

export const exportArchive = (
  currentGameState: GameState,
  currentHistory: GameState[]
): string => {
  const saves = listSaves();
  const autoSaveData = loadAutoSave();

  const archive: ArchiveData = {
    version: ARCHIVE_VERSION,
    exportedAt: Date.now(),
    currentGameState: JSON.parse(JSON.stringify(currentGameState)),
    currentHistory: currentHistory.map((s) => JSON.parse(JSON.stringify(s))),
    saves: saves.map((s) => (s ? JSON.parse(JSON.stringify(s)) : null)),
    autoSave: autoSaveData ? JSON.parse(JSON.stringify(autoSaveData)) : null,
  };

  return JSON.stringify(archive, null, 2);
};

export const commitArchiveImport = (archiveData: ArchiveData): boolean => {
  const backupSaves = localStorage.getItem(STORAGE_KEYS.SAVES);
  const backupAutoSave = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE);

  try {
    const saves = archiveData.saves.slice(0, MAX_SAVES);
    while (saves.length < MAX_SAVES) {
      saves.push(null);
    }
    localStorage.setItem(STORAGE_KEYS.SAVES, JSON.stringify(saves));

    if (archiveData.autoSave) {
      localStorage.setItem(STORAGE_KEYS.AUTO_SAVE, JSON.stringify(archiveData.autoSave));
    } else {
      localStorage.removeItem(STORAGE_KEYS.AUTO_SAVE);
    }

    return true;
  } catch (e) {
    console.error('Import archive failed, rolling back:', e);
    try {
      if (backupSaves !== null) {
        localStorage.setItem(STORAGE_KEYS.SAVES, backupSaves);
      } else {
        localStorage.removeItem(STORAGE_KEYS.SAVES);
      }
      if (backupAutoSave !== null) {
        localStorage.setItem(STORAGE_KEYS.AUTO_SAVE, backupAutoSave);
      } else {
        localStorage.removeItem(STORAGE_KEYS.AUTO_SAVE);
      }
    } catch (rollbackError) {
      console.error('Rollback also failed:', rollbackError);
    }
    return false;
  }
};
