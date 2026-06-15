/**
 * 回放链路回归测试
 * 
 * 复现场景：
 * 1. 创建测试游戏状态（确保可以移动2次并捕获事件）
 * 2. 连续移动2次，捕获2个事件
 * 3. 进入回放模式
 * 4. 回放完整走完
 * 5. 验证结束后回到最新回合和正确分数
 */

import { useGameStore } from '../hooks/useGameState';
import { GameState, GameEvent, Position, Direction } from '../game/types';
import { cloneState } from '../game/gameEngine';

const createTestState = (): { gameState: GameState; history: GameState[] } => {
  const playerPosition: Position = { x: 0, y: 0 };
  const obstacles: Position[] = [];
  
  const events: GameEvent[] = [
    {
      id: 'event-1',
      position: { x: 1, y: 0 },
      type: 'normal',
      score: 10,
    },
    {
      id: 'event-2',
      position: { x: 2, y: 0 },
      type: 'normal',
      score: 10,
    },
  ];

  const initialState: GameState = {
    playerPosition,
    events,
    obstacles,
    turn: 1,
    score: 0,
    isGameOver: false,
    logs: [{
      turn: 1,
      action: 'system',
      message: '测试游戏开始',
      timestamp: Date.now(),
    }],
  };

  return { gameState: initialState, history: [] };
};

describe('回放链路测试', () => {
  beforeEach(() => {
    useGameStore.setState({
      gameState: createTestState().gameState,
      history: [],
      isReplaying: false,
      replayIndex: 0,
      lastIllegalMessage: null,
      preReplayState: null,
      preReplayHistory: null,
    });
  });

  it('连续2次捕获后回放完整走完，应回到最新回合和正确分数', () => {
    const { move, startReplay, nextReplayStep, endReplay } = useGameStore.getState();
    
    move('right');
    const stateAfter1st = useGameStore.getState();
    console.log('第1次移动后:', { turn: stateAfter1st.gameState.turn, score: stateAfter1st.gameState.score });
    expect(stateAfter1st.gameState.score).toBe(10);
    expect(stateAfter1st.gameState.turn).toBe(2);
    expect(stateAfter1st.history.length).toBe(1);

    move('right');
    const stateAfter2nd = useGameStore.getState();
    console.log('第2次移动后:', { turn: stateAfter2nd.gameState.turn, score: stateAfter2nd.gameState.score });
    expect(stateAfter2nd.gameState.score).toBe(20);
    expect(stateAfter2nd.gameState.turn).toBe(3);
    expect(stateAfter2nd.history.length).toBe(2);

    const finalTurn = stateAfter2nd.gameState.turn;
    const finalScore = stateAfter2nd.gameState.score;

    startReplay();
    const replayState = useGameStore.getState();
    console.log('进入回放:', { isReplaying: replayState.isReplaying, replayIndex: replayState.replayIndex });
    expect(replayState.isReplaying).toBe(true);
    expect(replayState.replayIndex).toBe(0);
    expect(replayState.preReplayState).not.toBeNull();
    expect(replayState.preReplayHistory).not.toBeNull();

    let hasNext = true;
    let steps = 0;
    while (hasNext) {
      hasNext = nextReplayStep();
      steps++;
      const s = useGameStore.getState();
      console.log(`回放步骤 ${steps}:`, { hasNext, isReplaying: s.isReplaying, turn: s.gameState.turn, score: s.gameState.score });
    }

    const afterReplayState = useGameStore.getState();
    console.log('回放结束后:', { 
      isReplaying: afterReplayState.isReplaying, 
      turn: afterReplayState.gameState.turn, 
      score: afterReplayState.gameState.score,
      historyLength: afterReplayState.history.length
    });

    expect(afterReplayState.isReplaying).toBe(false);
    expect(afterReplayState.gameState.turn).toBe(finalTurn);
    expect(afterReplayState.gameState.score).toBe(finalScore);
    expect(afterReplayState.history.length).toBe(2);
    expect(afterReplayState.preReplayState).toBeNull();
    expect(afterReplayState.preReplayHistory).toBeNull();
  });

  it('回放过程中点击退出，应回到最新回合和正确分数', () => {
    const { move, startReplay, nextReplayStep, endReplay } = useGameStore.getState();
    
    move('right');
    move('right');
    
    const stateBefore = useGameStore.getState();
    const finalTurn = stateBefore.gameState.turn;
    const finalScore = stateBefore.gameState.score;

    startReplay();
    nextReplayStep();
    
    const midReplay = useGameStore.getState();
    expect(midReplay.isReplaying).toBe(true);
    expect(midReplay.replayIndex).toBe(1);

    endReplay();
    
    const afterEnd = useGameStore.getState();
    console.log('手动退出回放后:', { 
      turn: afterEnd.gameState.turn, 
      score: afterEnd.gameState.score 
    });

    expect(afterEnd.isReplaying).toBe(false);
    expect(afterEnd.gameState.turn).toBe(finalTurn);
    expect(afterEnd.gameState.score).toBe(finalScore);
    expect(afterEnd.preReplayState).toBeNull();
  });
});

export {};
