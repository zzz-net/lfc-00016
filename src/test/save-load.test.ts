/**
 * 存档/读档链路回归测试
 * 
 * 复现场景：
 * 1. 创建一个失败的游戏状态
 * 2. 保存到存档槽位
 * 3. 开始新游戏（改变状态）
 * 4. 读取失败存档
 * 5. 验证自动存档已更新
 * 6. 模拟刷新页面，验证启动时能恢复失败状态
 */

import { useGameStore } from '../hooks/useGameState';
import { GameState, GameEvent, Position, SaveData, STORAGE_KEYS } from '../game/types';
import { saveGame, loadGame, autoSave, loadAutoSave, listSaves } from '../game/storage';

const createFailedGameState = (): { gameState: GameState; history: GameState[] } => {
  const playerPosition: Position = { x: 3, y: 3 };
  const obstacles: Position[] = [
    { x: 1, y: 0 }, { x: 2, y: 1 }, { x: 0, y: 2 }
  ];
  
  const events: GameEvent[] = [
    { id: 'e1', position: { x: 5, y: 5 }, type: 'normal', score: 10 },
  ];

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

describe('存档/读档链路测试', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('读取失败存档后，自动存档应同步更新，刷新后仍能恢复失败状态', () => {
    const { initGame, loadFromSlot } = useGameStore.getState();
    
    const { gameState: failedState, history: failedHistory } = createFailedGameState();
    console.log('创建的失败状态:', { 
      turn: failedState.turn, 
      score: failedState.score, 
      isGameOver: failedState.isGameOver,
      reason: failedState.gameOverReason 
    });

    const saveResult = saveGame(0, '失败存档', failedState, failedHistory);
    expect(saveResult).not.toBeNull();
    console.log('保存存档成功:', saveResult?.name);

    const savedInStorage = loadGame(0);
    expect(savedInStorage).not.toBeNull();
    expect(savedInStorage?.gameState.isGameOver).toBe(true);
    expect(savedInStorage?.gameState.score).toBe(-5);
    expect(savedInStorage?.gameState.turn).toBe(15);

    initGame();
    const stateAfterNewGame = useGameStore.getState();
    console.log('新游戏状态:', { 
      turn: stateAfterNewGame.gameState.turn, 
      score: stateAfterNewGame.gameState.score,
      isGameOver: stateAfterNewGame.gameState.isGameOver 
    });
    expect(stateAfterNewGame.gameState.turn).toBe(1);
    expect(stateAfterNewGame.gameState.score).toBe(0);
    expect(stateAfterNewGame.gameState.isGameOver).toBe(false);

    const autoSaveBeforeLoad = loadAutoSave();
    console.log('读档前自动存档:', { 
      turn: autoSaveBeforeLoad?.gameState.turn,
      score: autoSaveBeforeLoad?.gameState.score 
    });

    const loadResult = loadFromSlot(0);
    expect(loadResult).toBe(true);

    const stateAfterLoad = useGameStore.getState();
    console.log('读档后状态:', { 
      turn: stateAfterLoad.gameState.turn, 
      score: stateAfterLoad.gameState.score,
      isGameOver: stateAfterLoad.gameState.isGameOver,
      reason: stateAfterLoad.gameState.gameOverReason 
    });
    expect(stateAfterLoad.gameState.turn).toBe(15);
    expect(stateAfterLoad.gameState.score).toBe(-5);
    expect(stateAfterLoad.gameState.isGameOver).toBe(true);
    expect(stateAfterLoad.gameState.gameOverReason).toBe('游戏结束：分数为负');
    expect(stateAfterLoad.history.length).toBe(14);
    expect(stateAfterLoad.gameState.logs.length).toBe(4);

    const autoSaveAfterLoad = loadAutoSave();
    console.log('读档后自动存档:', { 
      turn: autoSaveAfterLoad?.gameState.turn,
      score: autoSaveAfterLoad?.gameState.score,
      isGameOver: autoSaveAfterLoad?.gameState.isGameOver 
    });
    expect(autoSaveAfterLoad).not.toBeNull();
    expect(autoSaveAfterLoad?.gameState.turn).toBe(15);
    expect(autoSaveAfterLoad?.gameState.score).toBe(-5);
    expect(autoSaveAfterLoad?.gameState.isGameOver).toBe(true);
    expect(autoSaveAfterLoad?.gameState.gameOverReason).toBe('游戏结束：分数为负');
    expect(autoSaveAfterLoad?.history.length).toBe(14);

    console.log('=== 模拟页面刷新，重新初始化 store ===');
    
    const autoSaveData = loadAutoSave();
    expect(autoSaveData).not.toBeNull();
    
    useGameStore.setState({
      gameState: autoSaveData!.gameState,
      history: autoSaveData!.history,
      isReplaying: false,
      replayIndex: 0,
      lastIllegalMessage: null,
      preReplayState: null,
      preReplayHistory: null,
    });

    const stateAfterRefresh = useGameStore.getState();
    console.log('刷新后状态:', { 
      turn: stateAfterRefresh.gameState.turn, 
      score: stateAfterRefresh.gameState.score,
      isGameOver: stateAfterRefresh.gameState.isGameOver,
      reason: stateAfterRefresh.gameState.gameOverReason,
      logCount: stateAfterRefresh.gameState.logs.length 
    });

    expect(stateAfterRefresh.gameState.turn).toBe(15);
    expect(stateAfterRefresh.gameState.score).toBe(-5);
    expect(stateAfterRefresh.gameState.isGameOver).toBe(true);
    expect(stateAfterRefresh.gameState.gameOverReason).toBe('游戏结束：分数为负');
    expect(stateAfterRefresh.gameState.logs.length).toBe(4);
    expect(stateAfterRefresh.history.length).toBe(14);
  });

  it('非法移动不应改变任何状态', () => {
    const playerPosition: Position = { x: 0, y: 0 };
    const obstacles: Position[] = [{ x: 1, y: 0 }];
    const events: GameEvent[] = [{ id: 'e1', position: { x: 0, y: 1 }, type: 'normal', score: 10 }];
    
    const initialState: GameState = {
      playerPosition,
      events,
      obstacles,
      turn: 5,
      score: 30,
      isGameOver: false,
      logs: [{ turn: 1, action: 'system', message: '测试', timestamp: Date.now() }],
    };

    useGameStore.setState({
      gameState: initialState,
      history: [initialState],
      isReplaying: false,
      replayIndex: 0,
      lastIllegalMessage: null,
      preReplayState: null,
      preReplayHistory: null,
    });

    const stateBefore = useGameStore.getState();
    const eventsBefore = stateBefore.gameState.events.map(e => ({ ...e, position: { ...e.position } }));
    const turnBefore = stateBefore.gameState.turn;
    const scoreBefore = stateBefore.gameState.score;
    const historyLengthBefore = stateBefore.history.length;

    console.log('非法移动前:', { turn: turnBefore, score: scoreBefore, eventCount: eventsBefore.length });

    const { move } = useGameStore.getState();
    move('right');

    const stateAfter = useGameStore.getState();
    console.log('非法移动后:', { 
      turn: stateAfter.gameState.turn, 
      score: stateAfter.gameState.score,
      eventCount: stateAfter.gameState.events.length,
      illegalMessage: stateAfter.lastIllegalMessage 
    });

    expect(stateAfter.gameState.turn).toBe(turnBefore);
    expect(stateAfter.gameState.score).toBe(scoreBefore);
    expect(stateAfter.history.length).toBe(historyLengthBefore);
    expect(stateAfter.gameState.events.length).toBe(eventsBefore.length);
    expect(stateAfter.lastIllegalMessage).toBe('非法移动：不能穿过障碍物');
    
    stateAfter.gameState.events.forEach((e, i) => {
      expect(e.position.x).toBe(eventsBefore[i].position.x);
      expect(e.position.y).toBe(eventsBefore[i].position.y);
    });
  });

  it('捕获后撤销应恢复事件和分数', () => {
    const playerPosition: Position = { x: 0, y: 0 };
    const obstacles: Position[] = [];
    const events: GameEvent[] = [{ id: 'e1', position: { x: 1, y: 0 }, type: 'bonus', score: 30 }];
    
    const initialState: GameState = {
      playerPosition,
      events,
      obstacles,
      turn: 1,
      score: 0,
      isGameOver: false,
      logs: [{ turn: 1, action: 'system', message: '测试', timestamp: Date.now() }],
    };

    useGameStore.setState({
      gameState: initialState,
      history: [],
      isReplaying: false,
      replayIndex: 0,
      lastIllegalMessage: null,
      preReplayState: null,
      preReplayHistory: null,
    });

    const { move, undo } = useGameStore.getState();
    
    move('right');
    
    const stateAfterMove = useGameStore.getState();
    console.log('捕获后:', { 
      turn: stateAfterMove.gameState.turn, 
      score: stateAfterMove.gameState.score,
      eventCount: stateAfterMove.gameState.events.length 
    });
    expect(stateAfterMove.gameState.score).toBe(30);
    expect(stateAfterMove.gameState.events.length).toBe(0);
    expect(stateAfterMove.history.length).toBe(1);

    undo();

    const stateAfterUndo = useGameStore.getState();
    console.log('撤销后:', { 
      turn: stateAfterUndo.gameState.turn, 
      score: stateAfterUndo.gameState.score,
      eventCount: stateAfterUndo.gameState.events.length,
      eventPos: stateAfterUndo.gameState.events[0]?.position 
    });
    expect(stateAfterUndo.gameState.turn).toBe(1);
    expect(stateAfterUndo.gameState.score).toBe(0);
    expect(stateAfterUndo.gameState.events.length).toBe(1);
    expect(stateAfterUndo.gameState.events[0].position.x).toBe(1);
    expect(stateAfterUndo.gameState.events[0].position.y).toBe(0);
    expect(stateAfterUndo.history.length).toBe(0);
  });
});

export {};
