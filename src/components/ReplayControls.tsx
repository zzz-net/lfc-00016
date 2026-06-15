import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface ReplayControlsProps {
  isReplaying: boolean;
  currentTurn: number;
  totalTurns: number;
  onPrev: () => boolean;
  onNext: () => boolean;
  onExit: () => void;
  onJumpToTurn: (turn: number) => void;
}

export const ReplayControls: React.FC<ReplayControlsProps> = ({
  isReplaying,
  currentTurn,
  totalTurns,
  onPrev,
  onNext,
  onExit,
  onJumpToTurn,
}) => {
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isAutoPlaying && isReplaying) {
      intervalRef.current = window.setInterval(() => {
        const hasNext = onNext();
        if (!hasNext) {
          setIsAutoPlaying(false);
        }
      }, speed);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAutoPlaying, isReplaying, speed, onNext]);

  useEffect(() => {
    if (!isReplaying) {
      setIsAutoPlaying(false);
    }
  }, [isReplaying]);

  const toggleAutoPlay = () => {
    setIsAutoPlaying(!isAutoPlaying);
  };

  if (!isReplaying) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-slate-800/95 backdrop-blur rounded-xl border border-purple-500/50 shadow-2xl shadow-purple-500/20 px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="text-purple-300 font-medium">
            回放模式
            <span className="ml-2 text-sm text-slate-400">
              回合 {currentTurn} / {totalTurns}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onPrev}
              className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
              title="上一回合"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              onClick={toggleAutoPlay}
              className={`p-2 rounded-lg transition-colors ${
                isAutoPlaying
                  ? 'bg-purple-600 text-white'
                  : 'hover:bg-slate-700 text-slate-300 hover:text-white'
              }`}
              title={isAutoPlaying ? '暂停' : '自动播放'}
            >
              {isAutoPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={onNext}
              className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
              title="下一回合"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">速度:</span>
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-300 focus:outline-none focus:border-purple-500"
            >
              <option value={2000}>0.5x</option>
              <option value={1000}>1x</option>
              <option value={500}>2x</option>
              <option value={250}>4x</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={totalTurns}
              value={currentTurn}
              onChange={(e) => onJumpToTurn(Number(e.target.value))}
              className="w-32 accent-purple-500"
            />
          </div>

          <button
            onClick={() => {
              setIsAutoPlaying(false);
              onExit();
            }}
            className="p-2 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
            title="退出回放"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
