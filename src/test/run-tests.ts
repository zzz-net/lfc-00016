/**
 * 独立测试脚本 - 直接运行验证修复
 * 
 * 运行方式: npx tsx src/test/run-tests.ts
 */

import '../hooks/useGameState';
import { useGameStore } from '../hooks/useGameState';
import { GameState, GameEvent, Position, STORAGE_KEYS } from '../game/types';
import { saveGame, loadGame, autoSave, loadAutoSave } from '../game/storage';
import { cloneState } from '../game/gameEngine';

// 固定 Math.random，让 processSystemTurn 永远走"无变化"分支，消除测试随机性
const _originalRandom = Math.random;
Math.random = () => 0.95;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

// @ts-ignore
global.localStorage = localStorageMock;

let passed = 0;
let failed = 0;

const assert = (condition: boolean, message: string) => {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
  }
};

const createTestState = (): { gameState: GameState; history: GameState[] } => {
  const playerPosition: Position = { x: 0, y: 0 };
  const obstacles: Position[] = [];
  
  const events: GameEvent[] = [
    { id: 'event-1', position: { x: 1, y: 0 }, type: 'normal', score: 10 },
    { id: 'event-2', position: { x: 2, y: 0 }, type: 'normal', score: 10 },
  ];

  const initialState: GameState = {
    playerPosition,
    events,
    obstacles,
    turn: 1,
    score: 0,
    isGameOver: false,
    logs: [{ turn: 1, action: 'system', message: '测试游戏开始', timestamp: Date.now() }],
  };

  return { gameState: initialState, history: [] };
};

const createFailedGameState = (): { gameState: GameState; history: GameState[] } => {
  const playerPosition: Position = { x: 3, y: 3 };
  const obstacles: Position[] = [{ x: 1, y: 0 }, { x: 2, y: 1 }, { x: 0, y: 2 }];
  
  const events: GameEvent[] = [{ id: 'e1', position: { x: 5, y: 5 }, type: 'normal', score: 10 }];

  const failedState: GameState = {
    playerPosition,
    events,
    obstacles,
    turn: 15,
    score: -5,
    isGameOver: true,
    gameOverReason: '游戏结束：分数为负',
    logs: [
      { turn: 1, action: 'system', message: '游戏开始', timestamp: Date.now() - 100000 },
      { turn: 5, action: 'move', direction: 'right', message: '向右移动', timestamp: Date.now() - 80000 },
      { turn: 10, action: 'capture', message: '捕获危险事件，-20分', scoreChange: -20, timestamp: Date.now() - 40000 },
      { turn: 15, action: 'gameover', message: '游戏结束：分数为负', timestamp: Date.now() - 10000 },
    ],
  };

  const history: GameState[] = [];
  for (let i = 0; i < 14; i++) {
    history.push({
      ...failedState,
      turn: i + 1,
      score: i * 5 - 5,
      logs: failedState.logs.slice(0, i + 1),
    });
  }

  return { gameState: failedState, history };
};

console.log('\n' + '='.repeat(60));
console.log('巡逻棋 - 回归测试');
console.log('='.repeat(60));

// 测试1: 回放链路
console.log('\n📋 测试1: 回放链路 - 连续2次捕获后回放完整走完');
localStorage.clear();
const test1 = createTestState();
useGameStore.setState({
  gameState: test1.gameState,
  history: [],
  isReplaying: false,
  replayIndex: 0,
  lastIllegalMessage: null,
  preReplayState: null,
  preReplayHistory: null,
});

const { move, startReplay, nextReplayStep, endReplay } = useGameStore.getState();

move('right');
const state1 = useGameStore.getState();
assert(state1.gameState.score === 10, `第1次移动后分数应为10，实际${state1.gameState.score}`);
assert(state1.gameState.turn === 2, `第1次移动后回合应为2，实际${state1.gameState.turn}`);

move('right');
const state2 = useGameStore.getState();
assert(state2.gameState.score === 20, `第2次移动后分数应为20，实际${state2.gameState.score}`);
assert(state2.gameState.turn === 3, `第2次移动后回合应为3，实际${state2.gameState.turn}`);

const finalTurn = state2.gameState.turn;
const finalScore = state2.gameState.score;
const finalHistoryLength = state2.history.length;

startReplay();
const replayState = useGameStore.getState();
assert(replayState.isReplaying === true, '进入回放模式后 isReplaying 应为 true');
assert(replayState.preReplayState !== null, '进入回放模式后 preReplayState 不应为 null');
assert(replayState.preReplayHistory !== null, '进入回放模式后 preReplayHistory 不应为 null');

let hasNext = true;
let steps = 0;
while (hasNext) {
  hasNext = nextReplayStep();
  steps++;
}

const afterReplay = useGameStore.getState();
assert(afterReplay.isReplaying === false, `回放结束后 isReplaying 应为 false，实际${afterReplay.isReplaying}`);
assert(afterReplay.gameState.turn === finalTurn, `回放结束后回合应为${finalTurn}，实际${afterReplay.gameState.turn}`);
assert(afterReplay.gameState.score === finalScore, `回放结束后分数应为${finalScore}，实际${afterReplay.gameState.score}`);
assert(afterReplay.history.length === finalHistoryLength, `回放结束后 history 长度应为${finalHistoryLength}，实际${afterReplay.history.length}`);
assert(afterReplay.preReplayState === null, '回放结束后 preReplayState 应为 null');
assert(afterReplay.preReplayHistory === null, '回放结束后 preReplayHistory 应为 null');

// 测试2: 手动退出回放
console.log('\n📋 测试2: 回放链路 - 回放过程中手动退出');
localStorage.clear();
const test2 = createTestState();
useGameStore.setState({
  gameState: test2.gameState,
  history: [],
  isReplaying: false,
  replayIndex: 0,
  lastIllegalMessage: null,
  preReplayState: null,
  preReplayHistory: null,
});

const { move: move2, startReplay: startReplay2, nextReplayStep: nextReplayStep2, endReplay: endReplay2 } = useGameStore.getState();
move2('right');
move2('right');

const beforeReplay = useGameStore.getState();
const expectedTurn = beforeReplay.gameState.turn;
const expectedScore = beforeReplay.gameState.score;

startReplay2();
nextReplayStep2();

const midReplay = useGameStore.getState();
assert(midReplay.isReplaying === true, '回放中 isReplaying 应为 true');
assert(midReplay.replayIndex === 1, `回放索引应为1，实际${midReplay.replayIndex}`);

endReplay2();

const afterEnd = useGameStore.getState();
assert(afterEnd.isReplaying === false, `退出回放后 isReplaying 应为 false，实际${afterEnd.isReplaying}`);
assert(afterEnd.gameState.turn === expectedTurn, `退出回放后回合应为${expectedTurn}，实际${afterEnd.gameState.turn}`);
assert(afterEnd.gameState.score === expectedScore, `退出回放后分数应为${expectedScore}，实际${afterEnd.gameState.score}`);
assert(afterEnd.preReplayState === null, '退出回放后 preReplayState 应为 null');

// 测试3: 存档/读档链路
console.log('\n📋 测试3: 存档链路 - 读取失败存档后自动存档同步');
localStorage.clear();
const { initGame, loadFromSlot } = useGameStore.getState();

const { gameState: failedState, history: failedHistory } = createFailedGameState();
console.log(`  创建失败状态: 回合${failedState.turn}, 分数${failedState.score}, 失败状态${failedState.isGameOver}`);

const saveResult = saveGame(0, '失败存档', failedState, failedHistory);
assert(saveResult !== null, '保存存档应成功');

initGame();
const afterNewGame = useGameStore.getState();
assert(afterNewGame.gameState.turn === 1, `新游戏后回合应为1，实际${afterNewGame.gameState.turn}`);
assert(afterNewGame.gameState.score === 0, `新游戏后分数应为0，实际${afterNewGame.gameState.score}`);
assert(afterNewGame.gameState.isGameOver === false, '新游戏后 isGameOver 应为 false');

const autoSaveBefore = loadAutoSave();
console.log(`  读档前自动存档: 回合${autoSaveBefore?.gameState.turn}, 分数${autoSaveBefore?.gameState.score}`);

const loadResult = loadFromSlot(0);
assert(loadResult === true, '读取存档应成功');

const afterLoad = useGameStore.getState();
assert(afterLoad.gameState.turn === 15, `读档后回合应为15，实际${afterLoad.gameState.turn}`);
assert(afterLoad.gameState.score === -5, `读档后分数应为-5，实际${afterLoad.gameState.score}`);
assert(afterLoad.gameState.isGameOver === true, '读档后 isGameOver 应为 true');
assert(afterLoad.gameState.gameOverReason === '游戏结束：分数为负', `读档后失败原因应为'游戏结束：分数为负'，实际'${afterLoad.gameState.gameOverReason}'`);
assert(afterLoad.history.length === 14, `读档后 history 长度应为14，实际${afterLoad.history.length}`);
assert(afterLoad.gameState.logs.length === 4, `读档后 logs 长度应为4，实际${afterLoad.gameState.logs.length}`);

const autoSaveAfter = loadAutoSave();
assert(autoSaveAfter !== null, '读档后自动存档不应为 null');
assert(autoSaveAfter?.gameState.turn === 15, `读档后自动存档回合应为15，实际${autoSaveAfter?.gameState.turn}`);
assert(autoSaveAfter?.gameState.score === -5, `读档后自动存档分数应为-5，实际${autoSaveAfter?.gameState.score}`);
assert(autoSaveAfter?.gameState.isGameOver === true, '读档后自动存档 isGameOver 应为 true');
assert(autoSaveAfter?.gameState.gameOverReason === '游戏结束：分数为负', `读档后自动存档失败原因应为'游戏结束：分数为负'`);
assert(autoSaveAfter?.history.length === 14, `读档后自动存档 history 长度应为14，实际${autoSaveAfter?.history.length}`);
console.log(`  读档后自动存档: 回合${autoSaveAfter?.gameState.turn}, 分数${autoSaveAfter?.gameState.score}, 失败状态${autoSaveAfter?.gameState.isGameOver}`);

// 模拟页面刷新 - 使用新的 store 初始化
console.log('  模拟页面刷新...');
const autoSaveData = loadAutoSave();
assert(autoSaveData !== null, '模拟刷新前自动存档不应为 null');

// 重新初始化 store，模拟页面刷新
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
assert(afterRefresh.gameState.turn === 15, `刷新后回合应为15，实际${afterRefresh.gameState.turn}`);
assert(afterRefresh.gameState.score === -5, `刷新后分数应为-5，实际${afterRefresh.gameState.score}`);
assert(afterRefresh.gameState.isGameOver === true, '刷新后 isGameOver 应为 true');
assert(afterRefresh.gameState.gameOverReason === '游戏结束：分数为负', `刷新后失败原因应为'游戏结束：分数为负'`);
assert(afterRefresh.gameState.logs.length === 4, `刷新后 logs 长度应为4，实际${afterRefresh.gameState.logs.length}`);
assert(afterRefresh.history.length === 14, `刷新后 history 长度应为14，实际${afterRefresh.history.length}`);
console.log(`  刷新后状态: 回合${afterRefresh.gameState.turn}, 分数${afterRefresh.gameState.score}, 失败状态${afterRefresh.gameState.isGameOver}`);

// 测试4: 非法移动不应改变状态
console.log('\n📋 测试4: 非法移动 - 穿过障碍物');
localStorage.clear();
const obstacleState: GameState = {
  playerPosition: { x: 0, y: 0 },
  events: [{ id: 'e1', position: { x: 0, y: 1 }, type: 'normal', score: 10 }],
  obstacles: [{ x: 1, y: 0 }],
  turn: 5,
  score: 30,
  isGameOver: false,
  logs: [{ turn: 1, action: 'system', message: '测试', timestamp: Date.now() }],
};

useGameStore.setState({
  gameState: obstacleState,
  history: [obstacleState],
  isReplaying: false,
  replayIndex: 0,
  lastIllegalMessage: null,
  preReplayState: null,
  preReplayHistory: null,
});

const beforeIllegal = useGameStore.getState();
const turnBefore = beforeIllegal.gameState.turn;
const scoreBefore = beforeIllegal.gameState.score;
const eventsBefore = beforeIllegal.gameState.events.map(e => ({ ...e, position: { ...e.position } }));
const historyBefore = beforeIllegal.history.length;

const { move: moveIllegal } = useGameStore.getState();
moveIllegal('right');

const afterIllegal = useGameStore.getState();
assert(afterIllegal.gameState.turn === turnBefore, `非法移动后回合应不变，期望${turnBefore}，实际${afterIllegal.gameState.turn}`);
assert(afterIllegal.gameState.score === scoreBefore, `非法移动后分数应不变，期望${scoreBefore}，实际${afterIllegal.gameState.score}`);
assert(afterIllegal.history.length === historyBefore, `非法移动后 history 长度应不变，期望${historyBefore}，实际${afterIllegal.history.length}`);
assert(afterIllegal.gameState.events.length === eventsBefore.length, `非法移动后事件数量应不变`);
assert(afterIllegal.lastIllegalMessage === '非法移动：不能穿过障碍物', `非法移动提示应为'非法移动：不能穿过障碍物'，实际'${afterIllegal.lastIllegalMessage}'`);

// 测试5: 捕获后撤销应恢复事件和分数
console.log('\n📋 测试5: 撤销功能 - 捕获后撤销恢复事件和分数');
localStorage.clear();
const captureState: GameState = {
  playerPosition: { x: 0, y: 0 },
  events: [{ id: 'e1', position: { x: 1, y: 0 }, type: 'bonus', score: 30 }],
  obstacles: [],
  turn: 1,
  score: 0,
  isGameOver: false,
  logs: [{ turn: 1, action: 'system', message: '测试', timestamp: Date.now() }],
};

useGameStore.setState({
  gameState: captureState,
  history: [],
  isReplaying: false,
  replayIndex: 0,
  lastIllegalMessage: null,
  preReplayState: null,
  preReplayHistory: null,
});

const { move: moveCapture, undo: undoCapture } = useGameStore.getState();
moveCapture('right');

const afterCapture = useGameStore.getState();
assert(afterCapture.gameState.score === 30, `捕获后分数应为30，实际${afterCapture.gameState.score}`);
assert(afterCapture.gameState.events.length === 0, `捕获后事件应消失，实际剩余${afterCapture.gameState.events.length}个`);
assert(afterCapture.history.length === 1, `捕获后 history 长度应为1，实际${afterCapture.history.length}`);

undoCapture();

const afterUndo = useGameStore.getState();
assert(afterUndo.gameState.turn === 1, `撤销后回合应为1，实际${afterUndo.gameState.turn}`);
assert(afterUndo.gameState.score === 0, `撤销后分数应为0，实际${afterUndo.gameState.score}`);
assert(afterUndo.gameState.events.length === 1, `撤销后事件应恢复，实际${afterUndo.gameState.events.length}个`);
assert(afterUndo.gameState.events[0].position.x === 1, `撤销后事件位置x应为1，实际${afterUndo.gameState.events[0].position.x}`);
assert(afterUndo.gameState.events[0].position.y === 0, `撤销后事件位置y应为0，实际${afterUndo.gameState.events[0].position.y}`);
assert(afterUndo.history.length === 0, `撤销后 history 长度应为0，实际${afterUndo.history.length}`);

// 测试6: 启动时恢复自动存档
console.log('\n📋 测试6: 启动恢复 - 初始化时读取自动存档');
localStorage.clear();

const stateToSave = createFailedGameState();
autoSave(stateToSave.gameState, stateToSave.history);

const autoSaveLoaded = loadAutoSave();
assert(autoSaveLoaded !== null, '自动存档应能读取');
assert(autoSaveLoaded?.gameState.turn === 15, `自动存档回合应为15，实际${autoSaveLoaded?.gameState.turn}`);
assert(autoSaveLoaded?.gameState.score === -5, `自动存档分数应为-5，实际${autoSaveLoaded?.gameState.score}`);
assert(autoSaveLoaded?.gameState.isGameOver === true, '自动存档 isGameOver 应为 true');

console.log('\n' + '='.repeat(60));
console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}

export {};
