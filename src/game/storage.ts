import { SaveData, GameState, STORAGE_KEYS } from './types';

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
