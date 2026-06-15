import { create } from 'zustand';
import { GameState, Direction, SaveData } from '../game/types';
import { createInitialState, movePlayer, cloneState } from '../game/gameEngine';
import { saveGame, loadGame, autoSave, loadAutoSave } from '../game/storage';

interface GameStore {
  gameState: GameState;
  history: GameState[];
  isReplaying: boolean;
  replayIndex: number;
  lastIllegalMessage: string | null;
  preReplayState: GameState | null;
  preReplayHistory: GameState[] | null;
  initGame: () => void;
  move: (direction: Direction) => void;
  undo: () => void;
  saveToSlot: (slot: number, name: string) => boolean;
  loadFromSlot: (slot: number) => boolean;
  loadFromAutoSave: () => boolean;
  startReplay: () => void;
  nextReplayStep: () => boolean;
  prevReplayStep: () => boolean;
  endReplay: () => void;
  jumpToReplayTurn: (turn: number) => void;
  clearIllegalMessage: () => void;
}

const getInitialState = (): { gameState: GameState; history: GameState[] } => {
  try {
    const autoSaveData = loadAutoSave();
    if (autoSaveData) {
      return {
        gameState: autoSaveData.gameState,
        history: autoSaveData.history,
      };
    }
  } catch (e) {
    console.error('Failed to load auto save on init:', e);
  }
  return {
    gameState: createInitialState(),
    history: [],
  };
};

const initial = getInitialState();

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: initial.gameState,
  history: initial.history,
  isReplaying: false,
  replayIndex: 0,
  lastIllegalMessage: null,
  preReplayState: null,
  preReplayHistory: null,

  initGame: () => {
    const initial = createInitialState();
    set({
      gameState: initial,
      history: [],
      isReplaying: false,
      replayIndex: 0,
      lastIllegalMessage: null,
      preReplayState: null,
      preReplayHistory: null,
    });
    autoSave(initial, []);
  },

  move: (direction: Direction) => {
    const { gameState, history, isReplaying } = get();
    if (isReplaying) return;
    if (gameState.isGameOver) return;

    const stateBeforeMove = cloneState(gameState);
    const { newState, logs } = movePlayer(gameState, direction);

    const illegalLog = logs.find((l) => l.action === 'illegal');
    if (illegalLog) {
      set({
        gameState: newState,
        lastIllegalMessage: illegalLog.message,
      });
      return;
    }

    const newHistory = [...history, stateBeforeMove];

    set({
      gameState: newState,
      history: newHistory,
      lastIllegalMessage: null,
    });

    autoSave(newState, newHistory);
  },

  undo: () => {
    const { history, isReplaying } = get();
    if (isReplaying) return;
    if (history.length === 0) return;

    const previousState = history[history.length - 1];
    const newHistory = history.slice(0, -1);

    set({
      gameState: previousState,
      history: newHistory,
      lastIllegalMessage: null,
      preReplayState: null,
      preReplayHistory: null,
    });

    autoSave(previousState, newHistory);
  },

  saveToSlot: (slot: number, name: string): boolean => {
    const { gameState, history } = get();
    const result = saveGame(slot, name, gameState, history);
    return result !== null;
  },

  loadFromSlot: (slot: number): boolean => {
    const saveData = loadGame(slot);
    if (!saveData) return false;

    const newState = cloneState(saveData.gameState);
    const newHistory = saveData.history.map(cloneState);

    set({
      gameState: newState,
      history: newHistory,
      isReplaying: false,
      replayIndex: 0,
      lastIllegalMessage: null,
      preReplayState: null,
      preReplayHistory: null,
    });

    autoSave(newState, newHistory);
    return true;
  },

  loadFromAutoSave: (): boolean => {
    const saveData = loadAutoSave();
    if (!saveData) return false;

    const newState = cloneState(saveData.gameState);
    const newHistory = saveData.history.map(cloneState);

    set({
      gameState: newState,
      history: newHistory,
      isReplaying: false,
      replayIndex: 0,
      lastIllegalMessage: null,
      preReplayState: null,
      preReplayHistory: null,
    });

    autoSave(newState, newHistory);
    return true;
  },

  startReplay: () => {
    const { history, gameState } = get();
    if (history.length === 0) return;

    const initialState = history[0];
    set({
      isReplaying: true,
      replayIndex: 0,
      gameState: initialState,
      preReplayState: cloneState(gameState),
      preReplayHistory: history.map(cloneState),
    });
  },

  nextReplayStep: (): boolean => {
    const { history, isReplaying, replayIndex, preReplayState, preReplayHistory } = get();
    if (!isReplaying) return false;
    if (replayIndex >= history.length) return false;

    const nextIndex = replayIndex + 1;
    if (nextIndex < history.length) {
      set({
        replayIndex: nextIndex,
        gameState: history[nextIndex],
      });
      return true;
    } else {
      set({
        isReplaying: false,
        replayIndex: 0,
        gameState: preReplayState ? cloneState(preReplayState) : history[history.length - 1],
        history: preReplayHistory ? preReplayHistory.map(cloneState) : history,
        preReplayState: null,
        preReplayHistory: null,
      });
      return false;
    }
  },

  prevReplayStep: (): boolean => {
    const { history, isReplaying, replayIndex } = get();
    if (!isReplaying) return false;
    if (replayIndex <= 0) return false;

    const prevIndex = replayIndex - 1;
    set({
      replayIndex: prevIndex,
      gameState: history[prevIndex],
    });
    return true;
  },

  endReplay: () => {
    const { history, preReplayState, preReplayHistory } = get();
    if (history.length === 0) return;

    const finalState = preReplayState ? cloneState(preReplayState) : history[history.length - 1];
    const finalHistory = preReplayHistory ? preReplayHistory.map(cloneState) : history;
    set({
      isReplaying: false,
      replayIndex: 0,
      gameState: finalState,
      history: finalHistory,
      preReplayState: null,
      preReplayHistory: null,
    });
  },

  jumpToReplayTurn: (turn: number) => {
    const { history, isReplaying } = get();
    if (!isReplaying) return;
    if (turn < 1 || turn > history.length) return;

    const targetIndex = turn - 1;
    set({
      replayIndex: targetIndex,
      gameState: history[targetIndex],
    });
  },

  clearIllegalMessage: () => {
    set({ lastIllegalMessage: null });
  },
}));
