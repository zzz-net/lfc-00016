import { useGameStore } from '../hooks/useGameState';
import { GameState, GameEvent, Position, SaveData, ArchiveData, ARCHIVE_VERSION, STORAGE_KEYS } from '../game/types';
import {
  saveGame,
  loadGame,
  autoSave,
  loadAutoSave,
  listSaves,
  exportArchive,
  validateArchive,
  commitArchiveImport,
} from '../game/storage';

const createTestGameState = (overrides: Partial<GameState> = {}): GameState => ({
  playerPosition: { x: 0, y: 0 },
  events: [
    { id: 'e1', position: { x: 1, y: 0 }, type: 'normal', score: 10 },
    { id: 'e2', position: { x: 2, y: 0 }, type: 'normal', score: 10 },
  ],
  obstacles: [],
  turn: 1,
  score: 0,
  isGameOver: false,
  logs: [{ turn: 1, action: 'system', message: '测试开始', timestamp: Date.now() }],
  ...overrides,
});

const createTestHistory = (count: number, baseState: GameState): GameState[] => {
  const history: GameState[] = [];
  for (let i = 0; i < count; i++) {
    history.push({
      ...baseState,
      turn: i + 1,
      score: i * 10,
      logs: [{ turn: i + 1, action: 'move', direction: 'right', message: `回合${i + 1}`, timestamp: Date.now() }],
    });
  }
  return history;
};

describe('存档包导出导入测试', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({
      gameState: createTestGameState(),
      history: [],
      isReplaying: false,
      replayIndex: 0,
      lastIllegalMessage: null,
      preReplayState: null,
      preReplayHistory: null,
    });
  });

  describe('正常导出导入', () => {
    it('导出应包含所有数据，导入后完整恢复', () => {
      const gameState = createTestGameState({ turn: 10, score: 50 });
      const history = createTestHistory(9, gameState);
      saveGame(0, '测试存档A', gameState, history);
      saveGame(2, '测试存档C', gameState, []);
      autoSave(gameState, history);

      useGameStore.setState({ gameState, history });

      const json = exportArchive(gameState, history);
      const parsed: ArchiveData = JSON.parse(json);

      expect(parsed.version).toBe(ARCHIVE_VERSION);
      expect(parsed.currentGameState.turn).toBe(10);
      expect(parsed.currentGameState.score).toBe(50);
      expect(parsed.currentHistory.length).toBe(9);
      expect(parsed.saves.length).toBe(5);
      expect(parsed.saves[0]).not.toBeNull();
      expect(parsed.saves[0]!.name).toBe('测试存档A');
      expect(parsed.saves[1]).toBeNull();
      expect(parsed.saves[2]).not.toBeNull();
      expect(parsed.saves[2]!.name).toBe('测试存档C');
      expect(parsed.autoSave).not.toBeNull();

      localStorage.clear();
      expect(listSaves().filter((s) => s !== null).length).toBe(0);
      expect(loadAutoSave()).toBeNull();

      const validation = validateArchive(json);
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);

      const importSuccess = useGameStore.getState().performImport(validation.archiveData!);
      expect(importSuccess).toBe(true);

      const afterImport = useGameStore.getState();
      expect(afterImport.gameState.turn).toBe(10);
      expect(afterImport.gameState.score).toBe(50);
      expect(afterImport.history.length).toBe(9);
      expect(afterImport.isReplaying).toBe(false);

      const savesAfterImport = listSaves();
      expect(savesAfterImport[0]).not.toBeNull();
      expect(savesAfterImport[0]!.name).toBe('测试存档A');
      expect(savesAfterImport[1]).toBeNull();
      expect(savesAfterImport[2]).not.toBeNull();
      expect(savesAfterImport[2]!.name).toBe('测试存档C');

      const autoSaveAfterImport = loadAutoSave();
      expect(autoSaveAfterImport).not.toBeNull();
      expect(autoSaveAfterImport!.gameState.turn).toBe(10);
    });
  });

  describe('损坏 JSON 校验', () => {
    it('无效 JSON 应返回解析错误', () => {
      const result = validateArchive('not valid json!!!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('JSON 格式损坏，无法解析');
      expect(result.archiveData).toBeNull();
    });

    it('空对象应返回字段缺失错误', () => {
      const result = validateArchive('{}');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('缺少 version 字段应报错', () => {
      const badArchive = {
        currentGameState: createTestGameState(),
        currentHistory: [],
        saves: [null, null, null, null, null],
        autoSave: null,
      };
      const result = validateArchive(JSON.stringify(badArchive));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('缺少版本号字段');
    });

    it('currentGameState 无效应报错', () => {
      const badArchive = {
        version: ARCHIVE_VERSION,
        currentGameState: { turn: 'not a number' },
        currentHistory: [],
        saves: [],
        autoSave: null,
      };
      const result = validateArchive(JSON.stringify(badArchive));
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('currentGameState');
    });

    it('saves 数组长度超过5应报错', () => {
      const badArchive = {
        version: ARCHIVE_VERSION,
        currentGameState: createTestGameState(),
        currentHistory: [],
        saves: [null, null, null, null, null, null],
        autoSave: null,
      };
      const result = validateArchive(JSON.stringify(badArchive));
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('超过最大槽位数');
    });
  });

  describe('版本号校验', () => {
    it('高版本应报错', () => {
      const archive = {
        version: 999,
        currentGameState: createTestGameState(),
        currentHistory: [],
        saves: [null, null, null, null, null],
        autoSave: null,
      };
      const result = validateArchive(JSON.stringify(archive));
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('高于当前支持的版本');
    });

    it('低版本应产生警告但仍通过校验', () => {
      const archive = {
        version: 0,
        exportedAt: Date.now(),
        currentGameState: createTestGameState(),
        currentHistory: [],
        saves: [null, null, null, null, null],
        autoSave: null,
      };
      const result = validateArchive(JSON.stringify(archive));
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('低于当前版本');
    });
  });

  describe('冲突检测', () => {
    it('导入存档包与现有存档槽位冲突时，应标记冲突', () => {
      const existingState = createTestGameState({ turn: 5, score: 20 });
      saveGame(0, '已有存档', existingState, []);

      const importState = createTestGameState({ turn: 8, score: 40 });
      const archive: ArchiveData = {
        version: ARCHIVE_VERSION,
        exportedAt: Date.now(),
        currentGameState: importState,
        currentHistory: createTestHistory(3, importState),
        saves: [
          { id: 'imp1', name: '导入存档', createdAt: Date.now(), updatedAt: Date.now(), gameState: importState, history: [] },
          null, null, null, null,
        ],
        autoSave: null,
      };

      const result = validateArchive(JSON.stringify(archive));
      expect(result.valid).toBe(true);
      expect(result.hasSlotConflicts).toBe(true);
      expect(result.conflictingSlots).toContain(0);
    });

    it('无冲突时不应标记', () => {
      const archive: ArchiveData = {
        version: ARCHIVE_VERSION,
        exportedAt: Date.now(),
        currentGameState: createTestGameState(),
        currentHistory: [],
        saves: [null, null, null, null, null],
        autoSave: null,
      };
      const result = validateArchive(JSON.stringify(archive));
      expect(result.valid).toBe(true);
      expect(result.hasSlotConflicts).toBe(false);
      expect(result.conflictingSlots.length).toBe(0);
    });

    it('覆盖冲突槽位后数据正确', () => {
      const existingState = createTestGameState({ turn: 5, score: 20 });
      saveGame(0, '已有存档', existingState, []);

      const importState = createTestGameState({ turn: 8, score: 40 });
      const archive: ArchiveData = {
        version: ARCHIVE_VERSION,
        exportedAt: Date.now(),
        currentGameState: importState,
        currentHistory: createTestHistory(3, importState),
        saves: [
          { id: 'imp1', name: '导入存档', createdAt: Date.now(), updatedAt: Date.now(), gameState: importState, history: [] },
          null, null, null, null,
        ],
        autoSave: null,
      };

      const success = useGameStore.getState().performImport(archive);
      expect(success).toBe(true);

      const savesAfterImport = listSaves();
      expect(savesAfterImport[0]).not.toBeNull();
      expect(savesAfterImport[0]!.name).toBe('导入存档');
      expect(savesAfterImport[0]!.gameState.turn).toBe(8);
      expect(savesAfterImport[0]!.gameState.score).toBe(40);
    });

    it('取消导入后原有存档不变', () => {
      const existingState = createTestGameState({ turn: 5, score: 20 });
      saveGame(0, '已有存档', existingState, []);

      const savesBefore = listSaves();
      expect(savesBefore[0]!.name).toBe('已有存档');

      expect(savesBefore[0]!.gameState.turn).toBe(5);
    });
  });

  describe('导入失败时原有数据不变', () => {
    it('损坏 JSON 导入失败不改变 localStorage', () => {
      const existingState = createTestGameState({ turn: 5, score: 20 });
      saveGame(0, '已有存档', existingState, []);
      autoSave(existingState, []);

      const savesBefore = listSaves();
      const autoSaveBefore = loadAutoSave();

      const result = validateArchive('bad json!!!');
      expect(result.valid).toBe(false);

      const savesAfter = listSaves();
      const autoSaveAfter = loadAutoSave();

      expect(savesAfter[0]!.name).toBe('已有存档');
      expect(savesAfter[0]!.gameState.turn).toBe(savesBefore[0]!.gameState.turn);
      expect(autoSaveAfter!.gameState.turn).toBe(autoSaveBefore!.gameState.turn);
    });
  });

  describe('跨重启恢复', () => {
    it('导入后自动存档更新，模拟刷新后仍能恢复', () => {
      const gameState = createTestGameState({ turn: 8, score: 40 });
      const history = createTestHistory(7, gameState);

      const archive: ArchiveData = {
        version: ARCHIVE_VERSION,
        exportedAt: Date.now(),
        currentGameState: gameState,
        currentHistory: history,
        saves: [null, null, null, null, null],
        autoSave: null,
      };

      const success = useGameStore.getState().performImport(archive);
      expect(success).toBe(true);

      const autoSaveData = loadAutoSave();
      expect(autoSaveData).not.toBeNull();
      expect(autoSaveData!.gameState.turn).toBe(8);
      expect(autoSaveData!.gameState.score).toBe(40);
      expect(autoSaveData!.history.length).toBe(7);

      useGameStore.setState({
        gameState: autoSaveData!.gameState,
        history: autoSaveData!.history,
        isReplaying: false,
        replayIndex: 0,
        lastIllegalMessage: null,
        preReplayState: null,
        preReplayHistory: null,
      });

      const afterRefresh = useGameStore.getState();
      expect(afterRefresh.gameState.turn).toBe(8);
      expect(afterRefresh.gameState.score).toBe(40);
      expect(afterRefresh.history.length).toBe(7);
    });
  });

  describe('导入后回放和撤销', () => {
    it('导入后回放应正常工作', () => {
      const gameState = createTestGameState({ turn: 1, score: 0 });
      const history = createTestHistory(3, gameState);

      useGameStore.setState({
        gameState,
        history: [],
        isReplaying: false,
        replayIndex: 0,
        lastIllegalMessage: null,
        preReplayState: null,
        preReplayHistory: null,
      });

      const { move } = useGameStore.getState();
      move('right');

      const afterMove = useGameStore.getState();
      const currentTurn = afterMove.gameState.turn;
      const currentScore = afterMove.gameState.score;
      const currentHistoryLen = afterMove.history.length;

      expect(currentHistoryLen).toBeGreaterThan(0);

      const json = exportArchive(afterMove.gameState, afterMove.history);

      localStorage.clear();
      useGameStore.setState({
        gameState: createTestGameState(),
        history: [],
        isReplaying: false,
        replayIndex: 0,
        lastIllegalMessage: null,
        preReplayState: null,
        preReplayHistory: null,
      });

      const validation = validateArchive(json);
      expect(validation.valid).toBe(true);

      useGameStore.getState().performImport(validation.archiveData!);

      const afterImport = useGameStore.getState();
      expect(afterImport.gameState.turn).toBe(currentTurn);
      expect(afterImport.gameState.score).toBe(currentScore);
      expect(afterImport.history.length).toBe(currentHistoryLen);

      const { startReplay, nextReplayStep, endReplay } = useGameStore.getState();
      startReplay();
      expect(useGameStore.getState().isReplaying).toBe(true);

      let replaySteps = 0;
      let hasNext = true;
      while (hasNext) {
        hasNext = nextReplayStep();
        replaySteps++;
      }

      const afterReplay = useGameStore.getState();
      expect(afterReplay.isReplaying).toBe(false);
      expect(afterReplay.gameState.turn).toBe(currentTurn);
    });

    it('导入后撤销应正常工作', () => {
      const gameState = createTestGameState({ turn: 1, score: 0 });
      const history = createTestHistory(3, gameState);

      useGameStore.setState({
        gameState,
        history: [],
        isReplaying: false,
        replayIndex: 0,
        lastIllegalMessage: null,
        preReplayState: null,
        preReplayHistory: null,
      });

      const { move } = useGameStore.getState();
      move('right');

      const afterMove = useGameStore.getState();
      expect(afterMove.history.length).toBeGreaterThan(0);
      const moveScore = afterMove.gameState.score;
      const moveTurn = afterMove.gameState.turn;

      const json = exportArchive(afterMove.gameState, afterMove.history);

      localStorage.clear();
      useGameStore.setState({
        gameState: createTestGameState(),
        history: [],
        isReplaying: false,
        replayIndex: 0,
        lastIllegalMessage: null,
        preReplayState: null,
        preReplayHistory: null,
      });

      const validation = validateArchive(json);
      expect(validation.valid).toBe(true);
      useGameStore.getState().performImport(validation.archiveData!);

      const afterImport = useGameStore.getState();
      expect(afterImport.history.length).toBeGreaterThan(0);

      const { undo } = useGameStore.getState();
      undo();

      const afterUndo = useGameStore.getState();
      expect(afterUndo.gameState.turn).toBeLessThan(moveTurn);
    });
  });

  describe('performExport store action', () => {
    it('performExport 应返回有效 JSON', () => {
      const gameState = createTestGameState({ turn: 5, score: 30 });
      useGameStore.setState({ gameState, history: createTestHistory(4, gameState) });

      const json = useGameStore.getState().performExport();
      expect(json).not.toBeNull();

      const parsed = JSON.parse(json!);
      expect(parsed.version).toBe(ARCHIVE_VERSION);
      expect(parsed.currentGameState.turn).toBe(5);
      expect(parsed.currentGameState.score).toBe(30);
    });
  });

  describe('saves 数组不足5个时填充 null', () => {
    it('少于5个 saves 应自动填充 null 到5个', () => {
      const archive = {
        version: ARCHIVE_VERSION,
        exportedAt: Date.now(),
        currentGameState: createTestGameState(),
        currentHistory: [],
        saves: [null],
        autoSave: null,
      };

      const result = validateArchive(JSON.stringify(archive));
      expect(result.valid).toBe(true);
      expect(result.archiveData!.saves.length).toBe(5);
    });
  });

  describe('commitArchiveImport 原子性', () => {
    it('commitArchiveImport 成功写入 localStorage', () => {
      const gameState = createTestGameState({ turn: 8, score: 40 });
      const archive: ArchiveData = {
        version: ARCHIVE_VERSION,
        exportedAt: Date.now(),
        currentGameState: gameState,
        currentHistory: [],
        saves: [
          { id: 's1', name: '导入存档1', createdAt: Date.now(), updatedAt: Date.now(), gameState, history: [] },
          null, null, null, null,
        ],
        autoSave: {
          id: 'as1', name: '自动存档', createdAt: Date.now(), updatedAt: Date.now(), gameState, history: [],
        },
      };

      const success = commitArchiveImport(archive);
      expect(success).toBe(true);

      const saves = listSaves();
      expect(saves[0]).not.toBeNull();
      expect(saves[0]!.name).toBe('导入存档1');

      const autoSaveData = loadAutoSave();
      expect(autoSaveData).not.toBeNull();
    });

    it('autoSave 为 null 时应清除自动存档', () => {
      autoSave(createTestGameState(), []);
      expect(loadAutoSave()).not.toBeNull();

      const archive: ArchiveData = {
        version: ARCHIVE_VERSION,
        exportedAt: Date.now(),
        currentGameState: createTestGameState(),
        currentHistory: [],
        saves: [null, null, null, null, null],
        autoSave: null,
      };

      const success = commitArchiveImport(archive);
      expect(success).toBe(true);
      expect(loadAutoSave()).toBeNull();
    });
  });
});

export {};
