import React from 'react';
import { Trophy, Clock, Target, AlertTriangle, CheckCircle, Layers } from 'lucide-react';
import { GameState, MAX_TURNS, WIN_SCORE } from '../game/types';

interface StatusBarProps {
  gameState: GameState;
  isReplaying: boolean;
  replayIndex: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  gameState,
  isReplaying,
  replayIndex,
}) => {
  const getStatusBadge = () => {
    if (isReplaying) {
      return (
        <div className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 border border-purple-500/50 rounded-lg">
          <Target className="w-5 h-5 text-purple-400" />
          <span className="text-purple-300 font-medium">
            回放中 ({replayIndex + 1}/{gameState.turn})
          </span>
        </div>
      );
    }

    if (gameState.isGameOver) {
      const isWin = gameState.score >= WIN_SCORE;
      return (
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
            isWin
              ? 'bg-green-600/20 border-green-500/50'
              : 'bg-red-600/20 border-red-500/50'
          }`}
        >
          {isWin ? (
            <CheckCircle className="w-5 h-5 text-green-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-400" />
          )}
          <span
            className={`font-medium ${isWin ? 'text-green-300' : 'text-red-300'}`}
          >
            {gameState.gameOverReason}
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-cyan-600/20 border border-cyan-500/50 rounded-lg">
        <Target className="w-5 h-5 text-cyan-400" />
        <span className="text-cyan-300 font-medium">进行中</span>
      </div>
    );
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur rounded-xl p-4 border border-slate-700 shadow-lg">
      {gameState.levelSource === 'workshop' && gameState.levelName && (
        <div className="mb-3 px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-lg inline-flex items-center gap-2">
          <Layers className="w-4 h-4 text-purple-400" />
          <span className="text-purple-300 text-sm font-medium">
            工坊关卡：{gameState.levelName}
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-blue-400" />
            <div>
              <div className="text-xs text-slate-400">回合</div>
              <div className="text-2xl font-bold text-white font-mono">
                {gameState.turn}
                <span className="text-sm text-slate-500">/{MAX_TURNS}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <div>
              <div className="text-xs text-slate-400">分数</div>
              <div
                className={`text-2xl font-bold font-mono ${
                  gameState.score >= WIN_SCORE
                    ? 'text-green-400'
                    : gameState.score < 0
                      ? 'text-red-400'
                      : 'text-white'
                }`}
              >
                {gameState.score}
                <span className="text-sm text-slate-500">/{WIN_SCORE}</span>
              </div>
            </div>
          </div>
        </div>

        {getStatusBadge()}
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>进度</span>
          <span>{Math.min(100, Math.round((gameState.score / WIN_SCORE) * 100))}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              gameState.score >= WIN_SCORE
                ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                : gameState.score < 0
                  ? 'bg-gradient-to-r from-red-500 to-red-400'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-400'
            }`}
            style={{
              width: `${Math.max(0, Math.min(100, (gameState.score / WIN_SCORE) * 100))}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
