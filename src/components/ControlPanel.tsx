import React from 'react';
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Plus,
  Save,
  FolderOpen,
  Play,
} from 'lucide-react';
import { Direction } from '../game/types';

interface ControlPanelProps {
  onMove: (direction: Direction) => void;
  onUndo: () => void;
  onNewGame: () => void;
  onSave: () => void;
  onLoad: () => void;
  onReplay: () => void;
  canUndo: boolean;
  disabled: boolean;
  isReplaying: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  onMove,
  onUndo,
  onNewGame,
  onSave,
  onLoad,
  onReplay,
  canUndo,
  disabled,
  isReplaying,
}) => {
  const DirectionButton: React.FC<{
    direction: Direction;
    icon: React.ReactNode;
    label: string;
  }> = ({ direction, icon, label }) => (
    <button
      onClick={() => onMove(direction)}
      disabled={disabled}
      className={`
        w-14 h-14 flex items-center justify-center rounded-lg
        bg-slate-700 hover:bg-slate-600 active:bg-slate-500
        border border-slate-600 hover:border-cyan-500/50
        text-white font-bold text-xl
        transition-all duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        hover:shadow-lg hover:shadow-cyan-500/20
        active:scale-95
      `}
      title={label}
    >
      {icon}
    </button>
  );

  const ActionButton: React.FC<{
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'danger';
  }> = ({ onClick, icon, label, disabled: btnDisabled, variant = 'secondary' }) => {
    const variantClasses = {
      primary:
        'bg-cyan-600 hover:bg-cyan-500 border-cyan-500 hover:border-cyan-400 hover:shadow-cyan-500/30',
      secondary:
        'bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-slate-500',
      danger:
        'bg-red-600 hover:bg-red-500 border-red-500 hover:border-red-400',
    };

    return (
      <button
        onClick={onClick}
        disabled={btnDisabled}
        className={`
          flex-1 min-w-[100px] px-4 py-3 flex items-center justify-center gap-2 rounded-lg
          border text-white font-medium
          transition-all duration-150
          disabled:opacity-50 disabled:cursor-not-allowed
          hover:shadow-lg active:scale-95
          ${variantClasses[variant]}
        `}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur rounded-xl p-4 border border-slate-700 shadow-lg space-y-4">
      <h3 className="text-slate-300 font-medium text-sm uppercase tracking-wider mb-2">
        移动控制
      </h3>

      <div className="flex flex-col items-center gap-1">
        <DirectionButton direction="up" icon={<ArrowUp className="w-6 h-6" />} label="向上 (W/↑)" />
        <div className="flex gap-1">
          <DirectionButton direction="left" icon={<ArrowLeft className="w-6 h-6" />} label="向左 (A/←)" />
          <div className="w-14 h-14" />
          <DirectionButton direction="right" icon={<ArrowRight className="w-6 h-6" />} label="向右 (D/→)" />
        </div>
        <DirectionButton direction="down" icon={<ArrowDown className="w-6 h-6" />} label="向下 (S/↓)" />
      </div>

      <div className="text-xs text-slate-500 text-center mt-2">
        键盘: WASD 或 方向键
      </div>

      <div className="border-t border-slate-700 pt-4">
        <h3 className="text-slate-300 font-medium text-sm uppercase tracking-wider mb-3">
          操作
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            onClick={onNewGame}
            icon={<Plus className="w-4 h-4" />}
            label="新游戏"
            variant="primary"
          />
          <ActionButton
            onClick={onUndo}
            icon={<RotateCcw className="w-4 h-4" />}
            label="撤销"
            disabled={!canUndo || isReplaying}
          />
          <ActionButton
            onClick={onSave}
            icon={<Save className="w-4 h-4" />}
            label="保存"
            disabled={isReplaying}
          />
          <ActionButton
            onClick={onLoad}
            icon={<FolderOpen className="w-4 h-4" />}
            label="读取"
          />
        </div>
        <div className="mt-2">
          <ActionButton
            onClick={onReplay}
            icon={<Play className="w-4 h-4" />}
            label="回放日志"
            disabled={!canUndo}
            variant="secondary"
          />
        </div>
      </div>

      <div className="text-xs text-slate-500 space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-orange-500" />
          <span>普通事件 +10分</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-yellow-400" />
          <span>奖励事件 +30分</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span>危险事件 -20分 (游戏结束)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-400" />
          <span>巡逻单位 (玩家)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-gray-500" />
          <span>障碍物 (不可通过)</span>
        </div>
      </div>
    </div>
  );
};
