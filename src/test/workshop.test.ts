/**
 * 关卡工坊模块回归测试
 *
 * 复现场景：
 * 1. 创建、编辑、删除关卡
 * 2. 导入冲突处理（覆盖/另存）
 * 3. 跨重启恢复（工坊列表、最后编辑内容、试玩成绩）
 * 4. 试玩后回工坊继续修改
 * 5. 导入失败不污染现有关卡
 * 6. 日志区分官方局和工坊局
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CustomLevel,
  Position,
  BOARD_SIZE,
  GameEvent,
  STORAGE_KEYS,
  WIN_SCORE,
} from '../game/types';
import {
  createWorkshopLevel,
  updateWorkshopLevel,
  deleteWorkshopLevel,
  publishWorkshopLevel,
  unpublishWorkshopLevel,
  listWorkshopLevels,
  getWorkshopLevel,
  validateLevel,
  validateLevelJSON,
  importWorkshopLevels,
  exportWorkshopLevel,
  recordWorkshopScore,
  getWorkshopScore,
  listWorkshopScores,
  setLastEditingLevel,
  getLastEditingLevel,
  createEmptyLevel,
  createGameEventForEditor,
  loadWorkshopState,
  saveWorkshopState,
} from '../game/workshopStorage';
import { createInitialState, createStateFromCustomLevel, movePlayer, cloneState } from '../game/gameEngine';
import { useGameStore } from '../hooks/useGameState';

const makeTestLevel = (name: string, overrides: Partial<CustomLevel> = {}): CustomLevel => ({
  id: '',
  name,
  description: '',
  playerStart: { x: 0, y: 0 },
  obstacles: [
    { x: 2, y: 2 },
    { x: 3, y: 3 },
  ],
  events: [
    { id: 'e1', position: { x: 1, y: 0 }, type: 'normal', score: 10 },
    { id: 'e2', position: { x: 0, y: 1 }, type: 'bonus', score: 30 },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

describe('关卡工坊 CRUD 测试', () => {
  beforeEach(() => {
    localStorage.clear();
    // 重置 useGameStore
    useGameStore.setState({
      gameState: createInitialState(),
      history: [],
      isReplaying: false,
      replayIndex: 0,
      lastIllegalMessage: null,
      preReplayState: null,
      preReplayHistory: null,
    });
  });

  it('创建关卡应成功保存并返回带ID的关卡', () => {
    const levelData = makeTestLevel('测试关卡1');
    const result = createWorkshopLevel({
      name: levelData.name,
      playerStart: levelData.playerStart,
      obstacles: levelData.obstacles,
      events: levelData.events,
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBeTruthy();
    expect(result?.name).toBe('测试关卡1');
    expect(result?.obstacles.length).toBe(2);
    expect(result?.events.length).toBe(2);

    const listed = listWorkshopLevels();
    expect(listed.length).toBe(1);
    expect(listed[0].id).toBe(result?.id);
  });

  it('按ID读取关卡应与创建时一致', () => {
    const levelData = makeTestLevel('读取测试');
    const created = createWorkshopLevel({
      name: levelData.name,
      description: '测试描述',
      playerStart: levelData.playerStart,
      obstacles: levelData.obstacles,
      events: levelData.events,
    })!;

    const fetched = getWorkshopLevel(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.name).toBe('读取测试');
    expect(fetched?.description).toBe('测试描述');
    expect(fetched?.obstacles).toEqual(created.obstacles);
  });

  it('更新关卡应成功修改字段并保留ID', () => {
    const created = createWorkshopLevel({
      ...makeTestLevel('原名'),
    })!;

    const newObstacles = [{ x: 5, y: 5 }, { x: 6, y: 6 }];
    const updated = updateWorkshopLevel(created.id, {
      name: '修改后名称',
      description: '新增描述',
      obstacles: newObstacles,
      playerStart: { x: 1, y: 1 },
    });

    expect(updated).not.toBeNull();
    expect(updated?.id).toBe(created.id);
    expect(updated?.name).toBe('修改后名称');
    expect(updated?.description).toBe('新增描述');
    expect(updated?.obstacles).toEqual(newObstacles);
    expect(updated?.playerStart).toEqual({ x: 1, y: 1 });
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(created.createdAt);
  });

  it('删除关卡应移除列表并清除成绩', () => {
    const created = createWorkshopLevel({
      ...makeTestLevel('待删除'),
    })!;

    recordWorkshopScore(created.id, 50, false);
    expect(getWorkshopScore(created.id)).not.toBeNull();

    const deleteSuccess = deleteWorkshopLevel(created.id);
    expect(deleteSuccess).toBe(true);

    expect(listWorkshopLevels().length).toBe(0);
    expect(getWorkshopLevel(created.id)).toBeNull();
    expect(getWorkshopScore(created.id)).toBeNull();
  });

  it('validateLevel 应检测重叠和边界问题', () => {
    // 玩家与障碍物重叠
    const badLevel1 = makeTestLevel('坏关卡1', {
      playerStart: { x: 2, y: 2 },
      obstacles: [{ x: 2, y: 2 }],
    });
    expect(validateLevel(badLevel1).valid).toBe(false);
    expect(validateLevel(badLevel1).errors.length).toBeGreaterThan(0);

    // 玩家起点越界
    const badLevel2 = makeTestLevel('坏关卡2', {
      playerStart: { x: BOARD_SIZE, y: BOARD_SIZE },
    });
    expect(validateLevel(badLevel2).valid).toBe(false);

    // 事件与障碍物重叠
    const badLevel3 = makeTestLevel('坏关卡3', {
      obstacles: [{ x: 1, y: 0 }],
      events: [{ id: 'e1', position: { x: 1, y: 0 }, type: 'normal', score: 10 }],
    });
    expect(validateLevel(badLevel3).valid).toBe(false);

    // 空名称
    const badLevel4 = makeTestLevel('');
    expect(validateLevel(badLevel4).valid).toBe(false);

    // 好关卡应通过
    const goodLevel = makeTestLevel('好关卡');
    expect(validateLevel(goodLevel).valid).toBe(true);
    expect(validateLevel(goodLevel).errors.length).toBe(0);
  });
});

describe('关卡工坊 导入冲突处理 测试', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('创建同名关卡时无冲突处理器应返回null且不保存', () => {
    createWorkshopLevel({
      ...makeTestLevel('同名关卡'),
    })!;

    const result = createWorkshopLevel({
      ...makeTestLevel('同名关卡', { name: '同名关卡' }),
    });

    expect(result).toBeNull();
    expect(listWorkshopLevels().length).toBe(1);
  });

  it('创建同名关卡时选择覆盖应替换原有关卡内容', () => {
    const existing = createWorkshopLevel({
      ...makeTestLevel('冲突测试', {
        obstacles: [{ x: 0, y: 0 }],
      }),
    })!;

    const newObstacles = [{ x: 7, y: 7 }];
    const newEvents: GameEvent[] = [
      { id: 'new1', position: { x: 5, y: 5 }, type: 'danger', score: -20 },
    ];

    let capturedAction: string | null = null;
    const result = createWorkshopLevel({
      name: '冲突测试',
      description: '覆盖后的描述',
      playerStart: { x: 3, y: 3 },
      obstacles: newObstacles,
      events: newEvents,
      onNameConflict: () => {
        capturedAction = 'overwrite';
        return 'overwrite';
      },
    });

    expect(capturedAction).toBe('overwrite');
    expect(result).not.toBeNull();
    expect(result?.id).toBe(existing.id);
    expect(result?.obstacles).toEqual(newObstacles);
    expect(result?.playerStart).toEqual({ x: 3, y: 3 });
    expect(result?.description).toBe('覆盖后的描述');
    expect(listWorkshopLevels().length).toBe(1);
  });

  it('创建同名关卡时选择另存应生成新ID且名称带后缀', () => {
    const existing = createWorkshopLevel({
      ...makeTestLevel('冲突测试'),
    })!;

    let capturedAction: string | null = null;
    const result = createWorkshopLevel({
      ...makeTestLevel('冲突测试', { name: '冲突测试', obstacles: [{ x: 7, y: 7 }] }),
      onNameConflict: () => {
        capturedAction = 'rename';
        return 'rename';
      },
    });

    expect(capturedAction).toBe('rename');
    expect(result).not.toBeNull();
    expect(result?.id).not.toBe(existing.id);
    expect(result?.name).toMatch(/^冲突测试/);
    expect(result?.name).not.toBe('冲突测试');
    expect(listWorkshopLevels().length).toBe(2);
  });

  it('validateLevelJSON 应识别无效JSON并返回错误', () => {
    const invalid = validateLevelJSON('{ not valid json }');
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.length).toBeGreaterThan(0);
    expect(invalid.levels.length).toBe(0);
  });

  it('validateLevelJSON 应识别单个关卡对象', () => {
    const level = makeTestLevel('JSON单关卡', { id: 'testid' });
    const result = validateLevelJSON(JSON.stringify(level));
    expect(result.valid).toBe(true);
    expect(result.levels.length).toBe(1);
    expect(result.singleLevel).toBe(true);
    expect(result.levels[0].name).toBe('JSON单关卡');
  });

  it('validateLevelJSON 应识别关卡数组', () => {
    const l1 = makeTestLevel('L1', { id: 'id1' });
    const l2 = makeTestLevel('L2', { id: 'id2' });
    const result = validateLevelJSON(JSON.stringify([l1, l2]));
    expect(result.valid).toBe(true);
    expect(result.levels.length).toBe(2);
    expect(result.singleLevel).toBe(false);
  });

  it('导入失败时应回滚不污染现有数据', () => {
    const existing = createWorkshopLevel({
      ...makeTestLevel('原始关卡'),
    })!;

    const badLevelsJson = JSON.stringify([
      { name: '', playerStart: { x: 0, y: 0 }, obstacles: [], events: [] },
    ]);
    const validated = validateLevelJSON(badLevelsJson);
    expect(validated.valid).toBe(false);

    // 即使强行传入空名关卡，保存阶段也应不影响现有
    const stateBefore = localStorage.getItem(STORAGE_KEYS.WORKSHOP);
    try {
      importWorkshopLevels({
        levels: [{ ...makeTestLevel('', { id: '' }) }],
      });
    } catch {
      /* ignore */
    }
    const stateAfter = localStorage.getItem(STORAGE_KEYS.WORKSHOP);
    const listed = listWorkshopLevels();

    expect(listed.length).toBe(1);
    expect(listed[0].id).toBe(existing.id);
  });

  it('导入关卡时检测到冲突选择另存', () => {
    createWorkshopLevel({
      ...makeTestLevel('导入冲突A'),
    })!;

    const incoming: CustomLevel[] = [
      makeTestLevel('导入冲突A', {
        id: 'incoming1',
        obstacles: [{ x: 5, y: 5 }],
      }),
    ];

    const result = importWorkshopLevels({
      levels: incoming,
      onConflict: (_inc, _exist, _idx) => 'rename',
    });

    expect(result.success).toBe(true);
    expect(result.conflicts.length).toBe(1);
    expect(result.importedLevels.length).toBe(1);
    expect(listWorkshopLevels().length).toBe(2);
    expect(result.importedLevels[0].name).not.toBe('导入冲突A');
  });

  it('导入关卡时检测到冲突选择覆盖', () => {
    const existing = createWorkshopLevel({
      ...makeTestLevel('导入冲突B', { obstacles: [{ x: 0, y: 0 }] }),
    })!;

    const newObstacles = [{ x: 7, y: 7 }];
    const incoming: CustomLevel[] = [
      makeTestLevel('导入冲突B', {
        id: 'incoming2',
        obstacles: newObstacles,
      }),
    ];

    const result = importWorkshopLevels({
      levels: incoming,
      onConflict: () => 'overwrite',
    });

    expect(result.success).toBe(true);
    expect(result.importedLevels.length).toBe(1);
    expect(listWorkshopLevels().length).toBe(1);

    const after = getWorkshopLevel(existing.id)!;
    expect(after.obstacles).toEqual(newObstacles);
    expect(after.id).toBe(existing.id);
  });

  it('导入关卡时部分关卡格式无效应跳过并警告', () => {
    const l1 = makeTestLevel('有效关卡', { id: 'valid' });
    const jsonArray = [
      l1,
      { name: 'bad', playerStart: 'invalid' },
    ];
    const validated = validateLevelJSON(JSON.stringify(jsonArray));
    expect(validated.valid).toBe(true);
    expect(validated.warnings.length).toBeGreaterThan(0);
    expect(validated.levels.length).toBe(1);
  });
});

describe('关卡工坊 跨重启恢复 测试', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('跨重启应恢复工坊关卡列表', () => {
    createWorkshopLevel({ ...makeTestLevel('重启恢复A') });
    createWorkshopLevel({ ...makeTestLevel('重启恢复B') });

    const before = listWorkshopLevels();
    expect(before.length).toBe(2);

    // 模拟页面刷新：重新从 localStorage 读取
    const loaded = loadWorkshopState();
    expect(loaded.levels.length).toBe(2);
    expect(loaded.levels.map((l) => l.name)).toContain('重启恢复A');
    expect(loaded.levels.map((l) => l.name)).toContain('重启恢复B');
  });

  it('跨重启应恢复最后编辑内容', () => {
    const level = createWorkshopLevel({ ...makeTestLevel('最后编辑测试') })!;
    const snapshot = { ...level, obstacles: [{ x: 6, y: 6 }] };
    setLastEditingLevel(level.id, snapshot);

    const loaded = getLastEditingLevel();
    expect(loaded.levelId).toBe(level.id);
    expect(loaded.snapshot).not.toBeNull();
    expect(loaded.snapshot?.obstacles).toEqual([{ x: 6, y: 6 }]);
  });

  it('跨重启应恢复工坊关卡成绩记录', () => {
    const l1 = createWorkshopLevel({ ...makeTestLevel('成绩A') })!;
    const l2 = createWorkshopLevel({ ...makeTestLevel('成绩B') })!;

    recordWorkshopScore(l1.id, 120, true);
    recordWorkshopScore(l1.id, 60, false);
    recordWorkshopScore(l2.id, 80, false);

    // 重新读取
    const scores = listWorkshopScores();
    expect(Object.keys(scores).length).toBe(2);

    const s1 = getWorkshopScore(l1.id)!;
    expect(s1.plays).toBe(2);
    expect(s1.wins).toBe(1);
    expect(s1.bestScore).toBe(120);
    expect(s1.lastScore).toBe(60);

    const s2 = getWorkshopScore(l2.id)!;
    expect(s2.plays).toBe(1);
    expect(s2.wins).toBe(0);
    expect(s2.bestScore).toBe(80);
  });

  it('删除关卡应同时删除成绩和最后编辑记录', () => {
    const lvl = createWorkshopLevel({ ...makeTestLevel('待删除2') })!;
    recordWorkshopScore(lvl.id, 100, true);
    setLastEditingLevel(lvl.id, lvl);

    expect(getWorkshopScore(lvl.id)).not.toBeNull();
    expect(getLastEditingLevel().levelId).toBe(lvl.id);

    deleteWorkshopLevel(lvl.id);

    expect(getWorkshopScore(lvl.id)).toBeNull();
    const lastEdit = getLastEditingLevel();
    expect(lastEdit.levelId).toBeNull();
    expect(lastEdit.snapshot).toBeNull();
  });

  it('工坊状态损坏时 loadWorkshopState 应返回空状态而非崩溃', () => {
    localStorage.setItem(STORAGE_KEYS.WORKSHOP, '{这不是合法json]');
    const state = loadWorkshopState();
    expect(state.levels).toEqual([]);
    expect(state.lastEditingLevelId).toBeNull();
    expect(state.scores).toEqual({});
  });
});

describe('关卡工坊 试玩与回工坊 测试', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({
      gameState: createInitialState(),
      history: [],
      isReplaying: false,
      replayIndex: 0,
      lastIllegalMessage: null,
      preReplayState: null,
      preReplayHistory: null,
    });
  });

  it('createStateFromCustomLevel 应生成带有workshop标记的GameState', () => {
    const level = makeTestLevel('工坊关卡1', { id: 'lvl1', status: 'draft' });
    const state = createStateFromCustomLevel(level);

    expect(state.levelSource).toBe('workshop-draft');
    expect(state.levelId).toBe('lvl1');
    expect(state.levelName).toBe('工坊关卡1');
    expect(state.playerPosition).toEqual(level.playerStart);
    expect(state.obstacles).toEqual(level.obstacles);
    expect(state.events.length).toBe(level.events.length);
    expect(state.turn).toBe(1);
    expect(state.score).toBe(0);
    expect(state.logs[0].levelSource).toBe('workshop-draft');
    expect(state.logs[0].message).toContain('工坊');
  });

  it('createStateFromCustomLevel 已发布关卡应生成workshop-published标记', () => {
    const level = makeTestLevel('已发布关卡', { id: 'lvl-pub', status: 'published', version: '1.2.0' });
    const state = createStateFromCustomLevel(level);

    expect(state.levelSource).toBe('workshop-published');
    expect(state.logs[0].levelSource).toBe('workshop-published');
    expect(state.logs[0].message).toContain('已发布');
    expect(state.logs[0].message).toContain('v1.2.0');
  });

  it('官方关卡初始状态应标记为official', () => {
    const state = createInitialState();
    expect(state.levelSource).toBe('official');
    expect(state.levelId).toBeUndefined();
    expect(state.logs[0].levelSource).toBe('official');
  });

  it('工坊关卡移动后的日志应带有workshop标记', () => {
    const level: CustomLevel = {
      id: 'lvl-move',
      name: '移动测试关卡',
      playerStart: { x: 0, y: 0 },
      obstacles: [],
      events: [{ id: 'e1', position: { x: 1, y: 0 }, type: 'normal', score: 10 }],
      status: 'draft',
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    let state = createStateFromCustomLevel(level);

    const { newState } = movePlayer(state, 'right');
    expect(newState.logs.length).toBeGreaterThan(state.logs.length);

    const moveLog = newState.logs.find((l) => l.action === 'move')!;
    expect(moveLog.levelSource).toBe('workshop-draft');
    expect(moveLog.levelId).toBe('lvl-move');
    expect(moveLog.levelName).toBe('移动测试关卡');

    const captureLog = newState.logs.find((l) => l.action === 'capture');
    expect(captureLog).not.toBeUndefined();
    expect(captureLog?.levelSource).toBe('workshop-draft');
    expect(newState.score).toBe(10);
  });

  it('官方关卡移动后的日志应带有official标记', () => {
    const state = createInitialState();
    const { newState } = movePlayer(state, 'right');
    const moveLog = newState.logs.find((l) => l.action === 'move')!;
    expect(moveLog.levelSource).toBe('official');
  });

  it('试玩工坊关卡（失败）后应记录成绩', () => {
    const level: CustomLevel = {
      id: 'lvl-score',
      name: '成绩测试关卡',
      playerStart: { x: 0, y: 0 },
      obstacles: [],
      events: [{ id: 'e1', position: { x: 1, y: 0 }, type: 'danger', score: -20 }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const { initWorkshopGame, move, isWorkshopMode, getCurrentLevelId } = useGameStore.getState();
    initWorkshopGame(level, level);

    expect(isWorkshopMode()).toBe(true);
    expect(getCurrentLevelId()).toBe('lvl-score');

    move('right');

    const stateAfter = useGameStore.getState().gameState;
    expect(stateAfter.isGameOver).toBe(true);

    const score = getWorkshopScore('lvl-score')!;
    expect(score).not.toBeNull();
    expect(score.levelId).toBe('lvl-score');
    expect(score.plays).toBe(1);
    expect(score.wins).toBe(0);
    expect(score.lastScore).toBeLessThan(0);
  });

  it('试玩工坊关卡（胜利）后应记录成绩且wins+1', () => {
    const levelId = 'lvl-win';
    const level: CustomLevel = {
      id: levelId,
      name: '胜利测试',
      playerStart: { x: 0, y: 0 },
      obstacles: [],
      events: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const beforeState = {
      ...createStateFromCustomLevel(level),
      score: WIN_SCORE,
    };
    useGameStore.setState({ gameState: beforeState, history: [] });

    recordWorkshopScore(levelId, WIN_SCORE, true);
    const score = getWorkshopScore(levelId)!;
    expect(score.wins).toBe(1);
    expect(score.bestScore).toBe(WIN_SCORE);
    expect(score.plays).toBe(1);
  });

  it('initWorkshopGame 应调用 setLastEditingLevel 记录最后编辑', () => {
    const level: CustomLevel = {
      id: 'lvl-back',
      name: '回工坊测试',
      playerStart: { x: 0, y: 0 },
      obstacles: [],
      events: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const snapshot: CustomLevel = { ...level, description: '快照描述' };

    useGameStore.getState().initWorkshopGame(level, snapshot);
    const lastEdit = getLastEditingLevel();
    expect(lastEdit.levelId).toBe('lvl-back');
    expect(lastEdit.snapshot?.description).toBe('快照描述');
  });

  it('exitWorkshopGame 应清除最后编辑并返回官方模式', () => {
    const level = makeTestLevel('退出测试', { id: 'lvl-exit' });
    useGameStore.getState().initWorkshopGame(level, level);

    expect(useGameStore.getState().isWorkshopMode()).toBe(true);
    expect(getLastEditingLevel().levelId).toBe('lvl-exit');

    useGameStore.getState().exitWorkshopGame();

    expect(useGameStore.getState().isWorkshopMode()).toBe(false);
    const gs = useGameStore.getState().gameState;
    expect(gs.levelSource).toBe('official');
    expect(getLastEditingLevel().levelId).toBeNull();
  });

  it('工坊模式下撤销后 levelSource 标记不变', () => {
    const level: CustomLevel = {
      id: 'lvl-undo',
      name: '撤销测试',
      playerStart: { x: 0, y: 0 },
      obstacles: [],
      events: [{ id: 'e1', position: { x: 1, y: 0 }, type: 'normal', score: 10 }],
      status: 'draft',
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const { initWorkshopGame, move, undo, isWorkshopMode, gameState } = useGameStore.getState();
    initWorkshopGame(level, level);
    move('right');

    expect(isWorkshopMode()).toBe(true);
    expect(useGameStore.getState().gameState.score).toBe(10);

    undo();

    expect(isWorkshopMode()).toBe(true);
    expect(useGameStore.getState().gameState.levelSource).toBe('workshop-draft');
    expect(useGameStore.getState().gameState.levelId).toBe('lvl-undo');
  });
});

describe('关卡工坊 导入导出 JSON 测试', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exportWorkshopLevel 应输出可被 validateLevelJSON 识别的 JSON', () => {
    const level = createWorkshopLevel({
      ...makeTestLevel('导出测试', { description: '测试描述内容' }),
    })!;

    const json = exportWorkshopLevel(level);
    expect(json).toContain(level.name);
    expect(json).toContain('测试描述内容');

    const validated = validateLevelJSON(json);
    expect(validated.valid).toBe(true);
    expect(validated.singleLevel).toBe(true);
    expect(validated.levels[0].name).toBe(level.name);
    expect(validated.levels[0].obstacles.length).toBe(level.obstacles.length);
  });

  it('导出的 JSON 导入后关卡配置一致', () => {
    const obstacles: Position[] = [
      { x: 2, y: 3 },
      { x: 4, y: 5 },
      { x: 6, y: 7 },
    ];
    const events: GameEvent[] = [
      { id: 'a', position: { x: 0, y: 1 }, type: 'normal', score: 10 },
      { id: 'b', position: { x: 1, y: 0 }, type: 'bonus', score: 30 },
      { id: 'c', position: { x: 7, y: 7 }, type: 'danger', score: -20 },
    ];

    const created = createWorkshopLevel({
      name: '导出导入一致性',
      playerStart: { x: 3, y: 3 },
      obstacles,
      events,
    })!;

    const json = exportWorkshopLevel(created);
    const validated = validateLevelJSON(json);
    expect(validated.valid).toBe(true);

    const imported = importWorkshopLevels({
      levels: validated.levels,
      onConflict: () => 'rename',
    });

    expect(imported.success).toBe(true);
    const reimported = imported.importedLevels[0];
    expect(reimported.playerStart).toEqual({ x: 3, y: 3 });
    expect(reimported.obstacles.length).toBe(3);
    expect(reimported.events.length).toBe(3);
    expect(reimported.events.map((e) => e.type).sort()).toEqual(['bonus', 'danger', 'normal']);
  });
});

describe('关卡工坊 发布/撤回发布 测试', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('新创建的关卡默认状态为草稿', () => {
    const level = createWorkshopLevel({
      ...makeTestLevel('草稿测试'),
    })!;
    expect(level.status).toBe('draft');
    expect(level.version).toBe('1.0.0');
    expect(level.publishedAt).toBeUndefined();
  });

  it('发布草稿关卡应成功并递增版本号', () => {
    const level = createWorkshopLevel({
      ...makeTestLevel('发布测试'),
    })!;
    expect(level.status).toBe('draft');
    expect(level.version).toBe('1.0.0');

    const published = publishWorkshopLevel(level.id, '初始版本发布');
    expect(published).not.toBeNull();
    expect(published?.status).toBe('published');
    expect(published?.version).toBe('1.0.1');
    expect(published?.versionNote).toBe('初始版本发布');
    expect(published?.publishedAt).toBeDefined();
    expect(published?.updatedAt).toBeGreaterThanOrEqual(level.updatedAt);

    const fetched = getWorkshopLevel(level.id)!;
    expect(fetched.status).toBe('published');
    expect(fetched.version).toBe('1.0.1');
  });

  it('撤回已发布关卡应成功并恢复为草稿状态', () => {
    const level = createWorkshopLevel({
      ...makeTestLevel('撤回测试'),
    })!;
    publishWorkshopLevel(level.id);

    const published = getWorkshopLevel(level.id)!;
    expect(published.status).toBe('published');

    const unpublished = unpublishWorkshopLevel(level.id);
    expect(unpublished).not.toBeNull();
    expect(unpublished?.status).toBe('draft');
    expect(unpublished?.publishedAt).toBeUndefined();

    const fetched = getWorkshopLevel(level.id)!;
    expect(fetched.status).toBe('draft');
  });

  it('编辑已发布关卡后应重置为草稿状态', () => {
    const level = createWorkshopLevel({
      ...makeTestLevel('编辑测试'),
    })!;
    publishWorkshopLevel(level.id);

    const published = getWorkshopLevel(level.id)!;
    expect(published.status).toBe('published');

    const updated = updateWorkshopLevel(level.id, {
      description: '修改后的描述',
    });
    expect(updated?.status).toBe('draft');

    const fetched = getWorkshopLevel(level.id)!;
    expect(fetched.status).toBe('draft');
    expect(fetched.description).toBe('修改后的描述');
  });

  it('发布不存在的关卡应返回null', () => {
    const result = publishWorkshopLevel('non-existent-id');
    expect(result).toBeNull();
  });

  it('撤回不存在的关卡应返回null', () => {
    const result = unpublishWorkshopLevel('non-existent-id');
    expect(result).toBeNull();
  });

  it('多次发布应持续递增版本号', () => {
    const level = createWorkshopLevel({
      ...makeTestLevel('多版本测试'),
    })!;

    const v1 = publishWorkshopLevel(level.id, '版本1');
    expect(v1?.version).toBe('1.0.1');

    updateWorkshopLevel(level.id, { description: '修改' });

    const v2 = publishWorkshopLevel(level.id, '版本2');
    expect(v2?.version).toBe('1.0.2');
    expect(v2?.versionNote).toBe('版本2');
  });
});

describe('关卡工坊 跨重启恢复发布状态 测试', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('跨重启应恢复关卡的发布状态', () => {
    const l1 = createWorkshopLevel({
      ...makeTestLevel('草稿关卡'),
    })!;
    const l2 = createWorkshopLevel({
      ...makeTestLevel('已发布关卡'),
    })!;
    publishWorkshopLevel(l2.id, '发布测试');

    const before = listWorkshopLevels();
    expect(before.find((l) => l.id === l1.id)?.status).toBe('draft');
    expect(before.find((l) => l.id === l2.id)?.status).toBe('published');

    const loaded = loadWorkshopState();
    expect(loaded.levels.find((l) => l.id === l1.id)?.status).toBe('draft');
    expect(loaded.levels.find((l) => l.id === l2.id)?.status).toBe('published');
    expect(loaded.levels.find((l) => l.id === l2.id)?.version).toBe('1.0.1');
    expect(loaded.levels.find((l) => l.id === l2.id)?.publishedAt).toBeDefined();
  });

  it('旧版本无status字段的关卡导入后应默认为草稿', () => {
    const oldLevel: CustomLevel = {
      id: 'old-level',
      name: '旧版本关卡',
      playerStart: { x: 0, y: 0 },
      obstacles: [],
      events: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as CustomLevel;

    const json = JSON.stringify([oldLevel]);
    const validated = validateLevelJSON(json);
    expect(validated.valid).toBe(true);

    const result = importWorkshopLevels({ levels: validated.levels });
    expect(result.success).toBe(true);

    const imported = getWorkshopLevel(result.importedLevels[0].id)!;
    expect(imported.status).toBe('draft');
    expect(imported.version).toBe('1.0.0');
  });

  it('导出的JSON应包含status和version字段', () => {
    const level = createWorkshopLevel({
      ...makeTestLevel('导出字段测试'),
    })!;
    publishWorkshopLevel(level.id, '测试版本');

    const publishedLevel = getWorkshopLevel(level.id)!;
    const json = exportWorkshopLevel(publishedLevel);
    const parsed = JSON.parse(json);
    expect(parsed.status).toBe('published');
    expect(parsed.version).toBe('1.0.1');
    expect(parsed.versionNote).toBe('测试版本');
    expect(parsed.publishedAt).toBeDefined();
  });

  it('试玩已发布关卡日志应标记为workshop-published', () => {
    const level = createWorkshopLevel({
      ...makeTestLevel('已发布试玩', {
        events: [{ id: 'e1', position: { x: 1, y: 0 }, type: 'normal', score: 10 }],
      }),
    })!;
    publishWorkshopLevel(level.id);

    const published = getWorkshopLevel(level.id)!;
    expect(published.status).toBe('published');

    const state = createStateFromCustomLevel(published);
    expect(state.levelSource).toBe('workshop-published');
    expect(state.logs[0].levelSource).toBe('workshop-published');
    expect(state.logs[0].message).toContain('已发布');
  });

  it('isWorkshopMode 对草稿和已发布关卡都应返回true', () => {
    const draft = createWorkshopLevel({
      ...makeTestLevel('草稿模式'),
    })!;
    const published = createWorkshopLevel({
      ...makeTestLevel('已发布模式'),
    })!;
    publishWorkshopLevel(published.id);

    useGameStore.getState().initWorkshopGame(draft, draft);
    expect(useGameStore.getState().isWorkshopMode()).toBe(true);
    expect(useGameStore.getState().getLevelStatus()).toBe('draft');

    useGameStore.getState().initWorkshopGame(
      getWorkshopLevel(published.id)!,
      getWorkshopLevel(published.id)!
    );
    expect(useGameStore.getState().isWorkshopMode()).toBe(true);
    expect(useGameStore.getState().getLevelStatus()).toBe('published');
  });
});
