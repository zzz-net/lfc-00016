import React from 'react';
import { Position, GameEvent } from '../game/types';

interface CellProps {
  position: Position;
  isPlayer: boolean;
  isObstacle: boolean;
  event: GameEvent | undefined;
  isHovered: boolean;
  onClick: () => void;
}

const getEventColor = (type: string) => {
  switch (type) {
    case 'normal':
      return 'bg-orange-500 shadow-orange-500/50';
    case 'bonus':
      return 'bg-yellow-400 shadow-yellow-400/50';
    case 'danger':
      return 'bg-red-500 shadow-red-500/50';
    default:
      return 'bg-gray-500';
  }
};

const getEventIcon = (type: string) => {
  switch (type) {
    case 'normal':
      return '◆';
    case 'bonus':
      return '★';
    case 'danger':
      return '☠';
    default:
      return '●';
  }
};

export const Cell: React.FC<CellProps> = ({
  position,
  isPlayer,
  isObstacle,
  event,
  isHovered,
  onClick,
}) => {
  const isEvenCell = (position.x + position.y) % 2 === 0;

  return (
    <div
      onClick={onClick}
      className={`
        relative w-full aspect-square flex items-center justify-center
        cursor-pointer transition-all duration-200
        ${isEvenCell ? 'bg-slate-800' : 'bg-slate-700'}
        ${isHovered ? 'bg-slate-600' : ''}
        ${isObstacle ? 'bg-gray-600' : ''}
        border border-slate-600/50
        hover:border-cyan-500/50
      `}
    >
      {isObstacle && (
        <div className="absolute inset-1 bg-gray-500 rounded opacity-80">
          <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-600 rounded flex items-center justify-center">
            <span className="text-gray-700 text-lg font-bold">▓</span>
          </div>
        </div>
      )}

      {event && !isPlayer && (
        <div
          className={`
            w-4/5 h-4/5 rounded-full flex items-center justify-center
            ${getEventColor(event.type)}
            shadow-lg animate-pulse
            text-white font-bold text-lg
            transition-transform hover:scale-110
          `}
        >
          {getEventIcon(event.type)}
        </div>
      )}

      {isPlayer && (
        <div className="w-4/5 h-4/5 rounded-full bg-green-400 shadow-lg shadow-green-400/60 flex items-center justify-center animate-pulse">
          <div className="w-3/5 h-3/5 rounded-full bg-green-300 flex items-center justify-center">
            <span className="text-green-800 font-bold text-xl">●</span>
          </div>
        </div>
      )}
    </div>
  );
};
