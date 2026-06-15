import {
  Position,
  Direction,
  GameState,
  GameEvent,
  LogEntry,
  BOARD_SIZE,
  EVENT_SCORES,
  MAX_TURNS,
  WIN_SCORE,
  CustomLevel,
  LevelSource,
} from './types';

const generateId = (): string => Math.random().toString(36).substring(2, 11);

const posEquals = (a: Position, b: Position): boolean => a.x === b.x && a.y === b.y;

const isInBounds = (pos: Position): boolean =>
  pos.x >= 0 && pos.x < BOARD_SIZE && pos.y >= 0 && pos.y < BOARD_SIZE;

const getRandomEmptyPosition = (
  occupied: Position[],
  exclude: Position[] = []
): Position | null => {
  const allPositions: Position[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const pos = { x, y };
      if (
        !occupied.some((p) => posEquals(p, pos)) &&
        !exclude.some((p) => posEquals(p, pos))
      ) {
        allPositions.push(pos);
      }
    }
  }
  if (allPositions.length === 0) return null;
  return allPositions[Math.floor(Math.random() * allPositions.length)];
};

const stampLogWithLevel = (
  log: LogEntry,
  source: LevelSource,
  levelId?: string,
  levelName?: string
): LogEntry => ({
  ...log,
  levelSource: source,
  levelId,
  levelName,
});

export const createInitialState = (): GameState => {
  const playerPosition: Position = { x: 0, y: 0 };
  const obstacles: Position[] = [];
  const occupied: Position[] = [playerPosition];

  const obstacleCount = Math.floor(Math.random() * 5) + 8;
  for (let i = 0; i < obstacleCount; i++) {
    const pos = getRandomEmptyPosition(occupied);
    if (pos) {
      obstacles.push(pos);
      occupied.push(pos);
    }
  }

  const events: GameEvent[] = [];
  for (let i = 0; i < 3; i++) {
    const pos = getRandomEmptyPosition(occupied);
    if (pos) {
      events.push({
        id: generateId(),
        position: pos,
        type: 'normal',
        score: EVENT_SCORES.normal,
      });
      occupied.push(pos);
    }
  }

  const bonusPos = getRandomEmptyPosition(occupied);
  if (bonusPos) {
    events.push({
      id: generateId(),
      position: bonusPos,
      type: 'bonus',
      score: EVENT_SCORES.bonus,
    });
    occupied.push(bonusPos);
  }

  const source: LevelSource = 'official';
  const initialLog: LogEntry = stampLogWithLevel(
    {
      turn: 1,
      action: 'system',
      message: '游戏开始！移动巡逻单位捕获事件点获得分数。',
      timestamp: Date.now(),
    },
    source
  );

  return {
    playerPosition,
    events,
    obstacles,
    turn: 1,
    score: 0,
    isGameOver: false,
    logs: [initialLog],
    levelSource: source,
  };
};

export const createStateFromCustomLevel = (level: CustomLevel): GameState => {
  const source: LevelSource = level.status === 'published' ? 'workshop-published' : 'workshop-draft';
  const statusLabel = level.status === 'published' ? '已发布' : '草稿';
  const initialLog: LogEntry = stampLogWithLevel(
    {
      turn: 1,
      action: 'system',
      message: `工坊${statusLabel}关卡「${level.name}」v${level.version} 开始！移动巡逻单位捕获事件点获得分数。`,
      timestamp: Date.now(),
    },
    source,
    level.id,
    level.name
  );

  return {
    playerPosition: JSON.parse(JSON.stringify(level.playerStart)),
    events: level.events.map((e) => ({
      ...e,
      position: { ...e.position },
    })),
    obstacles: level.obstacles.map((o) => ({ ...o })),
    turn: 1,
    score: 0,
    isGameOver: false,
    logs: [initialLog],
    levelSource: source,
    levelId: level.id,
    levelName: level.name,
  };
};

export const getNextPosition = (pos: Position, direction: Direction): Position => {
  switch (direction) {
    case 'up':
      return { x: pos.x, y: pos.y - 1 };
    case 'down':
      return { x: pos.x, y: pos.y + 1 };
    case 'left':
      return { x: pos.x - 1, y: pos.y };
    case 'right':
      return { x: pos.x + 1, y: pos.y };
  }
};

export const validateMove = (
  state: GameState,
  direction: Direction
): { valid: boolean; reason?: string } => {
  if (state.isGameOver) {
    return { valid: false, reason: '游戏已结束' };
  }

  const nextPos = getNextPosition(state.playerPosition, direction);

  if (!isInBounds(nextPos)) {
    return { valid: false, reason: '非法移动：不能移出棋盘' };
  }

  if (state.obstacles.some((o) => posEquals(o, nextPos))) {
    return { valid: false, reason: '非法移动：不能穿过障碍物' };
  }

  return { valid: true };
};

export const captureEventsAt = (
  state: GameState,
  position: Position
): { captured: GameEvent[]; remaining: GameEvent[]; scoreChange: number } => {
  const captured = state.events.filter((e) => posEquals(e.position, position));
  const remaining = state.events.filter((e) => !posEquals(e.position, position));
  const scoreChange = captured.reduce((sum, e) => sum + e.score, 0);
  return { captured, remaining, scoreChange };
};

const getAdjacentPositions = (pos: Position): Position[] => {
  const directions: Direction[] = ['up', 'down', 'left', 'right'];
  return directions
    .map((d) => getNextPosition(pos, d))
    .filter((p) => isInBounds(p));
};

export const processSystemTurn = (state: GameState): {
  newState: GameState;
  log: LogEntry | null;
} => {
  let events = [...state.events];
  const occupied = [state.playerPosition, ...state.obstacles];
  const systemLogs: string[] = [];

  const moveRoll = Math.random();
  if (moveRoll < 0.5 && events.length > 0) {
    const eventToMove = events[Math.floor(Math.random() * events.length)];
    const adjacent = getAdjacentPositions(eventToMove.position).filter(
      (p) =>
        !occupied.some((o) => posEquals(o, p)) &&
        !events.some((e) => e.id !== eventToMove.id && posEquals(e.position, p))
    );

    if (adjacent.length > 0) {
      const newPos = adjacent[Math.floor(Math.random() * adjacent.length)];
      events = events.map((e) =>
        e.id === eventToMove.id ? { ...e, position: newPos } : e
      );
      systemLogs.push(`事件点移动`);
    }
  }

  const spawnRoll = Math.random();
  if (spawnRoll < 0.3) {
    const occupiedPositions = [
      state.playerPosition,
      ...state.obstacles,
      ...events.map((e) => e.position),
    ];
    const newPos = getRandomEmptyPosition(occupiedPositions);
    if (newPos) {
      const typeRoll = Math.random();
      let type: 'normal' | 'bonus' | 'danger' = 'normal';
      if (typeRoll < 0.15) type = 'danger';
      else if (typeRoll < 0.3) type = 'bonus';

      events.push({
        id: generateId(),
        position: newPos,
        type,
        score: EVENT_SCORES[type],
      });
      systemLogs.push(
        `生成${type === 'normal' ? '普通' : type === 'bonus' ? '奖励' : '危险'}事件`
      );
    }
  }

  const log: LogEntry | null =
    systemLogs.length > 0
      ? stampLogWithLevel(
          {
            turn: state.turn,
            action: 'system',
            message: `系统回合：${systemLogs.join('，')}`,
            timestamp: Date.now(),
          },
          state.levelSource,
          state.levelId,
          state.levelName
        )
      : null;

  return {
    newState: {
      ...state,
      events,
    },
    log,
  };
};

export const checkGameOver = (
  state: GameState
): { isOver: boolean; reason?: string } => {
  if (state.score < 0) {
    return { isOver: true, reason: '游戏结束：分数为负' };
  }

  if (state.turn > MAX_TURNS && state.score < WIN_SCORE) {
    return { isOver: true, reason: `游戏结束：${MAX_TURNS}回合内未达到${WIN_SCORE}分` };
  }

  if (state.score >= WIN_SCORE) {
    return { isOver: true, reason: `胜利！分数达到${WIN_SCORE}分` };
  }

  return { isOver: false };
};

export const movePlayer = (
  state: GameState,
  direction: Direction
): {
  newState: GameState;
  logs: LogEntry[];
} => {
  const { levelSource, levelId, levelName } = state;
  const stamp = (log: LogEntry): LogEntry =>
    stampLogWithLevel(log, levelSource, levelId, levelName);

  const validation = validateMove(state, direction);
  if (!validation.valid) {
    const illegalLog: LogEntry = stamp({
      turn: state.turn,
      action: 'illegal',
      direction,
      message: validation.reason || '非法移动',
      timestamp: Date.now(),
    });
    return {
      newState: {
        ...state,
        logs: [...state.logs, illegalLog],
      },
      logs: [illegalLog],
    };
  }

  const from = { ...state.playerPosition };
  const to = getNextPosition(from, direction);
  const newLogs: LogEntry[] = [];

  const moveLog: LogEntry = stamp({
    turn: state.turn,
    action: 'move',
    direction,
    from,
    to,
    message: `向${direction === 'up' ? '上' : direction === 'down' ? '下' : direction === 'left' ? '左' : '右'}移动`,
    timestamp: Date.now(),
  });
  newLogs.push(moveLog);

  const { captured, remaining, scoreChange } = captureEventsAt(state, to);

  let newState: GameState = {
    ...state,
    playerPosition: to,
    events: remaining,
    score: state.score + scoreChange,
    logs: [...state.logs, moveLog],
  };

  if (captured.length > 0) {
    captured.forEach((event) => {
      const captureLog: LogEntry = stamp({
        turn: state.turn,
        action: 'capture',
        to,
        capturedEvent: event,
        scoreChange: event.score,
        message: `捕获${event.type === 'normal' ? '普通' : event.type === 'bonus' ? '奖励' : '危险'}事件，${event.score > 0 ? '+' : ''}${event.score}分`,
        timestamp: Date.now(),
      });
      newLogs.push(captureLog);
      newState.logs.push(captureLog);
    });
  }

  const dangerEvent = captured.find((e) => e.type === 'danger');
  if (dangerEvent) {
    newState.isGameOver = true;
    newState.gameOverReason = '游戏结束：捕获了危险事件';
    const gameOverLog: LogEntry = stamp({
      turn: state.turn,
      action: 'gameover',
      message: newState.gameOverReason,
      timestamp: Date.now(),
    });
    newLogs.push(gameOverLog);
    newState.logs.push(gameOverLog);
    return { newState, logs: newLogs };
  }

  const gameOverCheck = checkGameOver(newState);
  if (gameOverCheck.isOver) {
    newState.isGameOver = true;
    newState.gameOverReason = gameOverCheck.reason;
    const gameOverLog: LogEntry = stamp({
      turn: state.turn,
      action: 'gameover',
      message: gameOverCheck.reason!,
      timestamp: Date.now(),
    });
    newLogs.push(gameOverLog);
    newState.logs.push(gameOverLog);
    return { newState, logs: newLogs };
  }

  const { newState: afterSystem, log: systemLog } = processSystemTurn(newState);
  newState = afterSystem;
  if (systemLog) {
    newLogs.push(systemLog);
    newState.logs.push(systemLog);
  }

  newState.turn = state.turn + 1;

  return { newState, logs: newLogs };
};

export const cloneState = (state: GameState): GameState => {
  return {
    ...state,
    playerPosition: { ...state.playerPosition },
    events: state.events.map((e) => ({ ...e, position: { ...e.position } })),
    obstacles: state.obstacles.map((o) => ({ ...o })),
    logs: state.logs.map((l) => ({
      ...l,
      from: l.from ? { ...l.from } : undefined,
      to: l.to ? { ...l.to } : undefined,
      capturedEvent: l.capturedEvent
        ? { ...l.capturedEvent, position: { ...l.capturedEvent.position } }
        : undefined,
    })),
  };
};
