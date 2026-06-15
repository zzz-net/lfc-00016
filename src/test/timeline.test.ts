/**
 * 关卡工坊 - 版本时间线专项测试
 *
 * 覆盖范围：
 * 1. 时间线 CRUD（快照创建、重命名、删除）
 * 2. 差异计算
 * 3. 回滚和另存为新关卡
 * 4. 跨重启恢复（时间线、草稿、撤销栈、最近回滚）
 * 5. 导入导出（单快照 / 完整时间线）
 * 6. 导入冲突处理（合并 / 覆盖 / 另存）
 * 7. 导入失败不污染现有数据（原子回滚）
 * 8. 日志分类
 * 9. 回滚后试玩再回编辑的一致性
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CustomLevel,
  BOARD_SIZE,
  STORAGE_KEYS,
  VersionSnapshot,
  LevelTimeline,
  SnapshotSource,
} from '../game/types';
import {
  createWorkshopLevel,
  updateWorkshopLevel,
  listWorkshopLevels,
  getWorkshopLevel,
  createEmptyLevel,
  createVersionSnapshot,
  renameVersionSnapshot,
  deleteVersionSnapshot,
  getLevelTimeline,
  listAllTimelines,
  rollbackToSnapshot,
  rollbackSnapshotAsNewLevel,
  getTimelineLogs,
  getLastRollbackInfo,
  saveUnsavedEditorDraft,
  loadUnsavedEditorDraft,
  clearUnsavedEditorDraft,
  getActiveDraftLevelId,
  computeLevelDiff,
  exportSingleSnapshot,
  exportFullTimeline,
  validateTimelineJSON,
  importTimelineJSON,
  TimelineImportAction,
  loadTimelineState,
  saveTimelineState,
  loadWorkshopState,
  saveWorkshopState,
  createGameEventForEditor,
  NameConflictAction,
} from '../game/workshopStorage';
import { createInitialState, createStateFromCustomLevel } from '../game/gameEngine';
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

const createTestLevel = (name = '时间线测试关卡', onConflict: NameConflictAction = 'rename'): CustomLevel => {
  const data = makeTestLevel(name);
  const created = createWorkshopLevel({
    name: data.name,
    description: data.description,
    playerStart: data.playerStart,
    obstacles: data.obstacles,
    events: data.events,
    onNameConflict: () => onConflict,
  });
  if (!created) throw new Error('无法创建测试关卡');
  return created;
};

describe('时间线 - 快照 CRUD', () => {
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

  it('创建快照应成功并返回快照对象', () => {
    const level = createTestLevel();
    const snap = createVersionSnapshot({
      levelId: level.id,
      levelData: level,
      source: 'manual-save',
      name: '初始版本',
      note: '第一次保存',
    });

    expect(snap).not.toBeNull();
    expect(snap?.id).toBeTruthy();
    expect(snap?.levelId).toBe(level.id);
    expect(snap?.name).toBe('初始版本');
    expect(snap?.note).toBe('第一次保存');
    expect(snap?.source).toBe('manual-save');
    expect(snap?.levelData).toBeTruthy();
    expect(snap?.levelData.obstacles.length).toBe(2);

    const tl = getLevelTimeline(level.id);
    expect(tl).not.toBeNull();
    expect(tl?.snapshots.length).toBe(1);
    expect(tl?.currentSnapshotId).toBe(snap?.id);
  });

  it('快照名称为空时应自动生成默认名称', () => {
    const level = createTestLevel();
    const snap1 = createVersionSnapshot({
      levelId: level.id,
      levelData: level,
      source: 'manual-save',
    });
    const snap2 = createVersionSnapshot({
      levelId: level.id,
      levelData: level,
      source: 'manual-save',
    });
    expect(snap1?.name).toBeTruthy();
    expect(snap2?.name).toBeTruthy();
    expect(snap1?.name).not.toBe(snap2?.name);
  });

  it('多来源快照应有正确的 source 标签', () => {
    const sources: SnapshotSource[] = ['manual-save', 'playtest-return', 'pre-publish', 'manual-snapshot', 'rollback', 'import'];
    const level = createTestLevel();
    for (const src of sources) {
      const snap = createVersionSnapshot({
        levelId: level.id,
        levelData: level,
        source: src,
      });
      expect(snap?.source).toBe(src);
    }
    const tl = getLevelTimeline(level.id);
    expect(tl?.snapshots.length).toBe(sources.length);
  });

  it('重命名快照应成功', () => {
    const level = createTestLevel();
    const snap = createVersionSnapshot({
      levelId: level.id,
      levelData: level,
      source: 'manual-save',
      name: '原名',
      note: '原备注',
    });
    if (!snap) throw new Error('快照创建失败');

    const ok = renameVersionSnapshot(level.id, snap.id, '新名字', '新备注');
    expect(ok).toBe(true);

    const tl = getLevelTimeline(level.id);
    const updated = tl?.snapshots.find((s) => s.id === snap.id);
    expect(updated?.name).toBe('新名字');
    expect(updated?.note).toBe('新备注');
  });

  it('删除快照应成功并正确处理 currentSnapshotId', () => {
    const level = createTestLevel();
    const snap1 = createVersionSnapshot({ levelId: level.id, levelData: level, source: 'manual-save', name: 'v1' });
    const snap2 = createVersionSnapshot({ levelId: level.id, levelData: level, source: 'manual-save', name: 'v2' });
    const snap3 = createVersionSnapshot({ levelId: level.id, levelData: level, source: 'manual-save', name: 'v3' });
    if (!snap1 || !snap2 || !snap3) throw new Error('快照创建失败');

    let tl = getLevelTimeline(level.id);
    expect(tl?.currentSnapshotId).toBe(snap3.id);

    deleteVersionSnapshot(level.id, snap3.id);
    tl = getLevelTimeline(level.id);
    expect(tl?.snapshots.length).toBe(2);
    expect(tl?.currentSnapshotId).toBe(snap2.id);

    deleteVersionSnapshot(level.id, snap1.id);
    tl = getLevelTimeline(level.id);
    expect(tl?.snapshots.length).toBe(1);
    expect(tl?.currentSnapshotId).toBe(snap2.id);

    deleteVersionSnapshot(level.id, snap2.id);
    tl = getLevelTimeline(level.id);
    expect(tl?.snapshots.length).toBe(0);
    expect(tl?.currentSnapshotId).toBeNull();
  });

  it('快照按创建时间升序存储（UI 层倒序展示）', () => {
    const level = createTestLevel();
    const names: string[] = [];
    for (let i = 0; i < 5; i++) {
      const snap = createVersionSnapshot({
        levelId: level.id,
        levelData: level,
        source: 'manual-save',
        name: `v${i}`,
      });
      names.push(`v${i}`);
      if (i < 4) {
        const delay = Date.now() + 2;
        while (Date.now() < delay) {}
      }
    }
    const tl = getLevelTimeline(level.id);
    const storedNames = tl?.snapshots.map((s) => s.name);
    expect(storedNames).toEqual(names);

    const uiOrder = [...(tl?.snapshots || [])].sort((a, b) => b.createdAt - a.createdAt);
    expect(uiOrder.map((s) => s.name)).toEqual([...names].reverse());

    for (let i = 1; i < (tl?.snapshots.length || 0); i++) {
      expect(tl!.snapshots[i].createdAt).toBeGreaterThanOrEqual(tl!.snapshots[i - 1].createdAt);
    }
  });
});

describe('时间线 - 差异计算', () => {
  beforeEach(() => localStorage.clear());

  it('相同关卡差异应为 0', () => {
    const lvl = makeTestLevel('相同');
    const diff = computeLevelDiff(lvl, lvl);
    expect(diff.totalChanges).toBe(0);
    expect(diff.obstaclesAdded.length).toBe(0);
    expect(diff.obstaclesRemoved.length).toBe(0);
    expect(diff.eventsAdded.length).toBe(0);
    expect(diff.eventsRemoved.length).toBe(0);
    expect(diff.eventsModified.length).toBe(0);
    expect(diff.nameChanged).toBe(false);
    expect(diff.descriptionChanged).toBe(false);
    expect(diff.playerStartChanged).toBe(false);
  });

  it('修改名称、描述、起点应被检测', () => {
    const a = makeTestLevel('原名', { description: '原描述', playerStart: { x: 0, y: 0 } });
    const b = makeTestLevel('新名', { description: '新描述', playerStart: { x: 5, y: 5 } });
    const diff = computeLevelDiff(a, b);
    expect(diff.nameChanged).toBe(true);
    expect(diff.descriptionChanged).toBe(true);
    expect(diff.playerStartChanged).toBe(true);
    expect(diff.totalChanges).toBe(3);
  });

  it('障碍增减应被检测', () => {
    const a = makeTestLevel('a', { obstacles: [{ x: 1, y: 1 }, { x: 2, y: 2 }] });
    const b = makeTestLevel('b', { obstacles: [{ x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }] });
    const diff = computeLevelDiff(a, b);
    expect(diff.obstaclesRemoved.length).toBe(1);
    expect(diff.obstaclesAdded.length).toBe(2);
    expect(diff.totalChanges).toBeGreaterThanOrEqual(4);
  });

  it('事件增删改应被检测', () => {
    const a = makeTestLevel('a', {
      events: [
        { id: 'e1', position: { x: 1, y: 0 }, type: 'normal', score: 10 },
        { id: 'e2', position: { x: 2, y: 0 }, type: 'normal', score: 10 },
        { id: 'e3', position: { x: 3, y: 0 }, type: 'bonus', score: 30 },
      ],
    });
    const b = makeTestLevel('b', {
      events: [
        { id: 'e1', position: { x: 1, y: 0 }, type: 'normal', score: 50 },
        { id: 'e3', position: { x: 3, y: 0 }, type: 'bonus', score: 30 },
        { id: 'e4', position: { x: 4, y: 0 }, type: 'danger', score: -20 },
      ],
    });
    const diff = computeLevelDiff(a, b);
    expect(diff.eventsAdded.length).toBe(1);
    expect(diff.eventsRemoved.length).toBe(1);
    expect(diff.eventsModified.length).toBe(1);
  });

  it('从 null 开始的差异应正确统计新增', () => {
    const lvl = makeTestLevel('新关卡');
    const diff = computeLevelDiff(null, lvl);
    expect(diff.obstaclesAdded.length).toBe(lvl.obstacles.length);
    expect(diff.eventsAdded.length).toBe(lvl.events.length);
    expect(diff.totalChanges).toBeGreaterThan(0);
  });
});

describe('时间线 - 回滚和另存为', () => {
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

  it('回滚到旧快照应恢复关卡数据并记录 rollback 日志', () => {
    const level = createTestLevel('回滚测试');
    const v1 = createVersionSnapshot({
      levelId: level.id,
      levelData: level,
      source: 'manual-save',
      name: 'v1',
    });
    if (!v1) throw new Error('v1 创建失败');

    const updatedLvl = updateWorkshopLevel(level.id, {
      name: 'v2名称',
      obstacles: [{ x: 7, y: 7 }, { x: 6, y: 6 }],
      events: [],
    });
    if (!updatedLvl) throw new Error('更新失败');
    const v2 = createVersionSnapshot({
      levelId: level.id,
      levelData: updatedLvl,
      source: 'manual-save',
      name: 'v2',
    });
    if (!v2) throw new Error('v2 创建失败');

    const result = rollbackToSnapshot(level.id, v1.id);
    expect(result.success).toBe(true);
    expect(result.level).not.toBeNull();
    expect(result.level?.obstacles.length).toBe(2);
    expect(result.level?.events.length).toBe(2);

    const restored = getWorkshopLevel(level.id);
    expect(restored?.name).toBe(level.name);
    expect(restored?.obstacles.length).toBe(2);
    expect(restored?.events.length).toBe(2);

    const rollbackInfo = getLastRollbackInfo();
    expect(rollbackInfo).not.toBeNull();
    expect(rollbackInfo?.levelId).toBe(level.id);
    expect(rollbackInfo?.snapshotId).toBe(v1.id);

    const logs = getTimelineLogs(level.id);
    const rollbackLogs = logs.filter((l) => l.action === 'rollback');
    expect(rollbackLogs.length).toBeGreaterThan(0);
  });

  it('另存为新关卡应保留原时间线且新关卡有独立快照', () => {
    const level = createTestLevel('原关卡');
    const v1 = createVersionSnapshot({
      levelId: level.id,
      levelData: level,
      source: 'manual-save',
      name: '原始版本',
    });
    if (!v1) throw new Error('v1 创建失败');

    const result = rollbackSnapshotAsNewLevel(level.id, v1.id, '新关卡名');
    expect(result.success).toBe(true);
    expect(result.level).not.toBeNull();
    expect(result.level?.id).not.toBe(level.id);
    expect(result.level?.name).toBe('新关卡名');

    const levels = listWorkshopLevels();
    expect(levels.length).toBe(2);

    const origTl = getLevelTimeline(level.id);
    expect(origTl?.snapshots.length).toBe(1);

    const newTl = getLevelTimeline(result.level!.id);
    expect(newTl).not.toBeNull();
    expect(newTl?.snapshots.length).toBeGreaterThanOrEqual(1);

    const origLogs = getTimelineLogs(level.id);
    const rollbackNewLogs = origLogs.filter((l) => l.action === 'rollback-to-new');
    expect(rollbackNewLogs.length).toBe(1);
  });

  it('回滚后再试玩再回编辑内容应一致', () => {
    const level = createTestLevel('流程测试');
    const v1 = createVersionSnapshot({
      levelId: level.id,
      levelData: level,
      source: 'manual-save',
      name: 'v1',
    });
    if (!v1) throw new Error('v1 创建失败');

    const updated = updateWorkshopLevel(level.id, {
      obstacles: [{ x: 5, y: 5 }],
    });
    if (!updated) throw new Error('更新失败');
    const v2 = createVersionSnapshot({
      levelId: level.id,
      levelData: updated,
      source: 'manual-save',
      name: 'v2',
    });
    if (!v2) throw new Error('v2 创建失败');

    const rb = rollbackToSnapshot(level.id, v1.id);
    expect(rb.success).toBe(true);

    const afterRollback = getWorkshopLevel(level.id);
    expect(afterRollback?.obstacles.length).toBe(level.obstacles.length);

    const playtestSnap = createVersionSnapshot({
      levelId: level.id,
      levelData: afterRollback!,
      source: 'playtest-return',
    });
    expect(playtestSnap).not.toBeNull();
    expect(playtestSnap?.levelData.obstacles.length).toBe(level.obstacles.length);

    const playtestLogs = getTimelineLogs(level.id);
    expect(playtestLogs.some((l) => l.action === 'snapshot-create')).toBe(true);
  });
});

describe('时间线 - 跨重启恢复', () => {
  beforeEach(() => localStorage.clear());

  it('时间线数据应从 localStorage 正确恢复', () => {
    const level = createTestLevel('持久化');
    createVersionSnapshot({ levelId: level.id, levelData: level, source: 'manual-save', name: 's1' });
    createVersionSnapshot({ levelId: level.id, levelData: level, source: 'manual-save', name: 's2' });

    const stateBefore = loadTimelineState();
    saveTimelineState(stateBefore);

    const stateAfter = loadTimelineState();
    expect(stateAfter.timelines[level.id]).not.toBeUndefined();
    expect(stateAfter.timelines[level.id].snapshots.length).toBe(2);
  });

  it('未保存草稿和撤销/重做栈应跨重启恢复', () => {
    const draftLvl = makeTestLevel('未保存草稿');
    const history = [
      makeTestLevel('历史1', { obstacles: [{ x: 1, y: 1 }] }),
      makeTestLevel('历史2', { obstacles: [{ x: 2, y: 2 }] }),
    ];
    const future = [
      makeTestLevel('未来1', { obstacles: [{ x: 3, y: 3 }] }),
    ];

    saveUnsavedEditorDraft(null, draftLvl, history, future);
    const recovered = loadUnsavedEditorDraft(null);

    expect(recovered).not.toBeNull();
    expect(recovered?.levelData?.name).toBe('未保存草稿');
    expect(recovered?.editorHistory.length).toBe(2);
    expect(recovered?.editorFuture.length).toBe(1);
    expect(recovered?.editorHistory[0].obstacles[0].x).toBe(1);
    expect(recovered?.editorFuture[0].obstacles[0].x).toBe(3);
  });

  it('有 ID 的草稿也应能持久化和清除', () => {
    const level = createTestLevel('已存在关卡');
    const modified = { ...level, name: '修改后未保存' };
    saveUnsavedEditorDraft(level.id, modified, [], []);

    const recovered = loadUnsavedEditorDraft(level.id);
    expect(recovered?.levelData?.name).toBe('修改后未保存');

    clearUnsavedEditorDraft(level.id);
    const afterClear = loadUnsavedEditorDraft(level.id);
    expect(afterClear).toBeNull();
  });

  it('最近回滚信息应被持久化', () => {
    const level = createTestLevel('回滚持久化');
    const v1 = createVersionSnapshot({
      levelId: level.id,
      levelData: level,
      source: 'manual-save',
      name: 'v1',
    });
    if (!v1) throw new Error('v1 创建失败');

    rollbackToSnapshot(level.id, v1.id);
    const info1 = getLastRollbackInfo();
    expect(info1).not.toBeNull();

    const ts = loadTimelineState();
    saveTimelineState(ts);
    const ts2 = loadTimelineState();

    expect(ts2.lastRollbackInfo?.snapshotId).toBe(v1.id);
  });

  it('损坏的 localStorage 不应导致崩溃（降级为空）', () => {
    localStorage.setItem(STORAGE_KEYS.WORKSHOP_TIMELINE, '{this is not valid json');
    const state = loadTimelineState();
    expect(state.timelines).toEqual({});
    expect(state.unsavedDrafts).toEqual({});
  });

  it('levelId 为 null 时 loadUnsavedEditorDraft 应读取新建草稿', () => {
    const newDraft = makeTestLevel('新建中关卡');
    saveUnsavedEditorDraft(null, newDraft, [], []);
    const loaded = loadUnsavedEditorDraft(null);
    expect(loaded?.levelData?.name).toBe('新建中关卡');
  });
});

describe('时间线 - 导入导出和冲突', () => {
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

  it('导出单个快照并重新导入应生成新关卡', () => {
    const level = createTestLevel('导出快照');
    const snap = createVersionSnapshot({
      levelId: level.id,
      levelData: level,
      source: 'manual-save',
      name: 'v1',
    });
    if (!snap) throw new Error('快照创建失败');

    const json = exportSingleSnapshot(level.id, snap.id);
    expect(json).not.toBeNull();
    expect(typeof json).toBe('string');

    const validation = validateTimelineJSON(json!);
    expect(validation.valid).toBe(true);
    expect(validation.kind).toBe('single-snapshot');

    localStorage.clear();
    const imported = importTimelineJSON({ jsonString: json! });
    expect(imported.success).toBe(true);
    expect(imported.importedSnapshotsCount).toBeGreaterThanOrEqual(1);

    const levels = listWorkshopLevels();
    expect(levels.length).toBe(1);
    expect(levels[0].name).toBe('导出快照');

    const tl = getLevelTimeline(levels[0].id);
    expect(tl?.snapshots.length).toBe(1);
  });

  it('导出完整时间线再导入应保留所有快照', () => {
    const level = createTestLevel('完整导出');
    const names = ['v1', 'v2', 'v3', 'v4'];
    for (const n of names) {
      const modified = { ...level, name: `完整导出-${n}` };
      createVersionSnapshot({
        levelId: level.id,
        levelData: modified,
        source: 'manual-save',
        name: n,
      });
    }

    const json = exportFullTimeline(level.id);
    expect(json).not.toBeNull();

    const validation = validateTimelineJSON(json!);
    expect(validation.valid).toBe(true);
    expect(validation.kind).toBe('full-timeline');
    expect(validation.timeline?.snapshots.length).toBe(4);

    localStorage.clear();
    const imported = importTimelineJSON({ jsonString: json! });
    expect(imported.success).toBe(true);
    expect(imported.importedSnapshotsCount).toBe(4);

    const levels = listWorkshopLevels();
    expect(levels.length).toBe(1);
    const tl = getLevelTimeline(levels[0].id);
    expect(tl?.snapshots.length).toBe(4);
  });

  it('导入同名关卡 - rename 策略应另存', () => {
    const existing = createTestLevel('同名关卡');
    const snap = createVersionSnapshot({
      levelId: existing.id,
      levelData: existing,
      source: 'manual-save',
      name: '原版本',
    });
    if (!snap) throw new Error('快照创建失败');

    const json = exportFullTimeline(existing.id);
    if (!json) throw new Error('导出失败');

    const result = importTimelineJSON({
      jsonString: json,
      onLevelConflict: () => 'rename',
    });
    expect(result.success).toBe(true);
    expect(result.conflictAction).toBe('rename');
    expect(listWorkshopLevels().length).toBe(2);
    expect(result.importedLevel?.name).toMatch(/同名关卡/);
  });

  it('导入同名关卡 - overwrite 策略应覆盖时间线', () => {
    const existing = createTestLevel('覆盖测试');
    createVersionSnapshot({
      levelId: existing.id,
      levelData: existing,
      source: 'manual-save',
      name: '原快照',
    });

    const other = createTestLevel('__other_temp_name__', 'rename');
    if (!other) throw new Error('other 创建失败');
    const otherWithSameName = updateWorkshopLevel(other.id, {
      name: '覆盖测试',
    });
    if (!otherWithSameName) throw new Error('重命名失败');

    createVersionSnapshot({
      levelId: other.id,
      levelData: otherWithSameName,
      source: 'manual-save',
      name: '新快照-1',
    });
    createVersionSnapshot({
      levelId: other.id,
      levelData: otherWithSameName,
      source: 'manual-save',
      name: '新快照-2',
    });

    const json = exportFullTimeline(other.id);
    if (!json) throw new Error('导出失败');

    const result = importTimelineJSON({
      jsonString: json,
      onLevelConflict: (_inc, _ex) => 'overwrite',
    });

    expect(result.success).toBe(true);
    expect(result.conflictAction).toBe('overwrite');
    const tl = getLevelTimeline(existing.id);
    expect(tl?.snapshots.length).toBe(2);
    expect(tl?.snapshots.map((s) => s.name)).toContain('新快照-1');
  });

  it('导入同名关卡 - merge 策略应合并时间线', () => {
    const existing = createTestLevel('合并测试');
    createVersionSnapshot({
      levelId: existing.id,
      levelData: existing,
      source: 'manual-save',
      name: '原始快照',
    });

    const other = createTestLevel('__other_temp_name_merge__', 'rename');
    if (!other) throw new Error('other 创建失败');
    const otherWithSameName = updateWorkshopLevel(other.id, {
      name: '合并测试',
    });
    if (!otherWithSameName) throw new Error('重命名失败');

    createVersionSnapshot({
      levelId: other.id,
      levelData: otherWithSameName,
      source: 'manual-save',
      name: '外部快照-A',
    });
    createVersionSnapshot({
      levelId: other.id,
      levelData: otherWithSameName,
      source: 'manual-save',
      name: '外部快照-B',
    });

    const json = exportFullTimeline(other.id);
    if (!json) throw new Error('导出失败');

    const result = importTimelineJSON({
      jsonString: json,
      onLevelConflict: () => 'merge',
    });
    expect(result.success).toBe(true);
    expect(result.conflictAction).toBe('merge');

    const tl = getLevelTimeline(existing.id);
    expect(tl?.snapshots.length).toBe(3);
    expect(tl?.snapshots.map((s) => s.name)).toContain('原始快照');
    expect(tl?.snapshots.map((s) => s.name)).toContain('外部快照-A');

    const logs = getTimelineLogs(existing.id);
    expect(logs.some((l) => l.action === 'conflict-merge')).toBe(true);
  });

  it('损坏的 JSON 导入失败不应污染现有数据', () => {
    const existing = createTestLevel('不应被污染');
    createVersionSnapshot({
      levelId: existing.id,
      levelData: existing,
      source: 'manual-save',
      name: '安全快照',
    });
    const levelsBefore = listWorkshopLevels().length;
    const tlBefore = getLevelTimeline(existing.id)?.snapshots.length ?? 0;
    const workshopBackup = localStorage.getItem(STORAGE_KEYS.WORKSHOP);
    const timelineBackup = localStorage.getItem(STORAGE_KEYS.WORKSHOP_TIMELINE);

    const badJson = '{ "version": 1, "kind": "full-timeline", "level": null }';
    const result = importTimelineJSON({ jsonString: badJson });
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    const levelsAfter = listWorkshopLevels().length;
    const tlAfter = getLevelTimeline(existing.id)?.snapshots.length ?? 0;
    expect(levelsAfter).toBe(levelsBefore);
    expect(tlAfter).toBe(tlBefore);

    expect(localStorage.getItem(STORAGE_KEYS.WORKSHOP)).toBe(workshopBackup);
    expect(localStorage.getItem(STORAGE_KEYS.WORKSHOP_TIMELINE)).toBe(timelineBackup);
  });

  it('完全无效 JSON 也不应污染', () => {
    const existing = createTestLevel('安全');
    const snap = createVersionSnapshot({
      levelId: existing.id,
      levelData: existing,
      source: 'manual-save',
      name: 's1',
    });
    const backupWorkshop = localStorage.getItem(STORAGE_KEYS.WORKSHOP);
    const backupTimeline = localStorage.getItem(STORAGE_KEYS.WORKSHOP_TIMELINE);

    const result = importTimelineJSON({ jsonString: 'not even json' });
    expect(result.success).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.WORKSHOP)).toBe(backupWorkshop);
    expect(localStorage.getItem(STORAGE_KEYS.WORKSHOP_TIMELINE)).toBe(backupTimeline);
  });
});

describe('时间线 - 日志分类', () => {
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

  it('各动作类型应有对应日志记录', () => {
    const level = createTestLevel('日志测试');
    const v1 = createVersionSnapshot({
      levelId: level.id,
      levelData: level,
      source: 'manual-save',
      name: 'v1',
    });
    if (!v1) throw new Error('v1 创建失败');

    renameVersionSnapshot(level.id, v1.id, 'v1-renamed');

    const v2 = createVersionSnapshot({
      levelId: level.id,
      levelData: level,
      source: 'manual-save',
      name: 'v2',
    });
    if (!v2) throw new Error('v2 创建失败');
    deleteVersionSnapshot(level.id, v2.id);

    rollbackToSnapshot(level.id, v1.id);
    rollbackSnapshotAsNewLevel(level.id, v1.id, '新副本');

    const logs = getTimelineLogs(level.id);
    const actions = logs.map((l) => l.action);
    expect(actions).toContain('snapshot-create');
    expect(actions).toContain('snapshot-rename');
    expect(actions).toContain('snapshot-delete');
    expect(actions).toContain('rollback');
    expect(actions).toContain('rollback-to-new');

    for (const log of logs) {
      expect(log.id).toBeTruthy();
      expect(log.timestamp).toBeGreaterThan(0);
      expect(typeof log.message).toBe('string');
      expect(log.message.length).toBeGreaterThan(0);
    }
  });
});
