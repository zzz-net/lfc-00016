import React, { useState } from 'react';
import { Cell } from './Cell';
import { GameState, Position, BOARD_SIZE, Direction } from '../game/types';
import { validateMove, getNextPosition } from '../game/gameEngine';

interface BoardProps {
  gameState: GameState;
  onMove: (direction: Direction) => void;
  disabled?: boolean;
}

const posEquals = (a: Position, b: Position): boolean => a.x === b.x && a.y === b.y;

export const Board: React.FC<BoardProps> = ({ gameState, onMove, disabled }) => {
  const [hoveredCell, setHoveredCell] = useState<Position | null>(null);

  const handleCellClick = (pos: Position) => {
    if (disabled || gameState.isGameOver) return;

    const { playerPosition } = gameState;
    const dx = pos.x - playerPosition.x;
    const dy = pos.y - playerPosition.y;

    if (Math.abs(dx) + Math.abs(dy) !== 1) return;

    let direction: Direction | null = null;
    if (dx === 1) direction = 'right';
    else if (dx === -1) direction = 'left';
    else if (dy === 1) direction = 'down';
    else if (dy === -1) direction = 'up';

    if (direction) {
      onMove(direction);
    }
  };

  const getEventAt = (pos: Position) => {
    return gameState.events.find((e) => posEquals(e.position, pos));
  };

  const isObstacle = (pos: Position) => {
    return gameState.obstacles.some((o) => posEquals(o, pos));
  };

  const isValidMoveTarget = (pos: Position) => {
    if (disabled || gameState.isGameOver) return false;
    const { playerPosition } = gameState;
    const dx = pos.x - playerPosition.x;
    const dy = pos.y - playerPosition.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return false;

    let direction: Direction;
    if (dx === 1) direction = 'right';
    else if (dx === -1) direction = 'left';
    else if (dy === 1) direction = 'down';
    else direction = 'up';

    return validateMove(gameState, direction).valid;
  };

  const renderBoard = () => {
    const rows = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      const cells = [];
      for (let x = 0; x < BOARD_SIZE; x++) {
        const pos = { x, y };
        const isPlayer = posEquals(gameState.playerPosition, pos);
        const event = getEventAt(pos);
        const obstacle = isObstacle(pos);
        const isHovered = hoveredCell ? posEquals(hoveredCell, pos) : false;
        const isValidTarget = isValidMoveTarget(pos);

        cells.push(
          <div
            key={`${x}-${y}`}
            className={`relative ${isValidTarget ? 'ring-2 ring-cyan-400 ring-opacity-50' : ''}`}
            onMouseEnter={() => setHoveredCell(pos)}
            onMouseLeave={() => setHoveredCell(null)}
          >
            <Cell
              position={pos}
              isPlayer={isPlayer}
              isObstacle={obstacle}
              event={event}
              isHovered={isHovered}
              onClick={() => handleCellClick(pos)}
            />
          </div>
        );
      }
      rows.push(
        <div key={y} className="grid grid-cols-8 gap-0">
          {cells}
        </div>
      );
    }
    return rows;
  };

  return (
    <div className="relative">
      <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-cyan-500/20 rounded-xl blur-xl" />
      <div className="relative bg-slate-900 p-2 rounded-lg border-2 border-slate-600 shadow-2xl">
        <div className="flex flex-col gap-0">
          {renderBoard()}
        </div>
      </div>
      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-slate-500">
        点击相邻格子或使用方向键/WASD移动
      </div>
    </div>
  );
};
