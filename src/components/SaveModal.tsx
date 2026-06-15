import React, { useState, useEffect } from 'react';
import { X, Save, FolderOpen, Trash2, Clock, Trophy } from 'lucide-react';
import { listSaves, deleteSave, formatDate } from '../game/storage';
import { SaveData } from '../game/types';

interface SaveModalProps {
  isOpen: boolean;
  mode: 'save' | 'load';
  onClose: () => void;
  onSave: (slot: number, name: string) => void;
  onLoad: (slot: number) => void;
}

export const SaveModal: React.FC<SaveModalProps> = ({
  isOpen,
  mode,
  onClose,
  onSave,
  onLoad,
}) => {
  const [saves, setSaves] = useState<(SaveData | null)[]>([]);
  const [saveName, setSaveName] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSaves(listSaves());
      setSaveName('');
      setSelectedSlot(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (slot: number) => {
    const name = saveName.trim() || `存档 ${slot + 1}`;
    onSave(slot, name);
    setSaves(listSaves());
    setSelectedSlot(null);
    setSaveName('');
  };

  const handleDelete = (slot: number) => {
    if (window.confirm(`确定要删除存档 ${slot + 1} 吗？`)) {
      deleteSave(slot);
      setSaves(listSaves());
    }
  };

  const handleLoad = (slot: number) => {
    onLoad(slot);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl border border-slate-600 shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {mode === 'save' ? (
              <><Save className="w-5 h-5 text-cyan-400" /> 保存游戏</>
            ) : (
              <><FolderOpen className="w-5 h-5 text-cyan-400" /> 读取存档</>
            )}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {mode === 'save' && (
          <div className="px-6 py-4 border-b border-slate-700">
            <label className="block text-sm text-slate-400 mb-2">存档名称</label>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="输入存档名称（可选）"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        )}

        <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
          {saves.map((save, index) => (
            <div
              key={index}
              className={`
                p-4 rounded-lg border transition-all
                ${save
                  ? 'bg-slate-700/50 border-slate-600 hover:border-cyan-500/50'
                  : 'bg-slate-800/50 border-slate-700 border-dashed'
                }
                ${selectedSlot === index ? 'border-cyan-500 ring-2 ring-cyan-500/30' : ''}
              `}
            >
              {save ? (
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-slate-600 rounded-lg flex items-center justify-center">
                    <span className="text-xl font-bold text-slate-300">{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white truncate">{save.name}</h4>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(save.updatedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        {save.gameState.score} 分
                      </span>
                      <span>回合 {save.gameState.turn}</span>
                    </div>
                    {save.gameState.isGameOver && (
                      <span className="mt-1 inline-block text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
                        {save.gameState.gameOverReason}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {mode === 'save' ? (
                      <>
                        <button
                          onClick={() => handleSave(index)}
                          className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition-colors"
                        >
                          覆盖
                        </button>
                        <button
                          onClick={() => handleDelete(index)}
                          className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleLoad(index)}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition-colors"
                      >
                        读取
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-600">
                    <span className="text-xl font-bold text-slate-500">{index + 1}</span>
                  </div>
                  <div className="flex-1 text-slate-500">
                    空存档槽位
                  </div>
                  {mode === 'save' && (
                    <button
                      onClick={() => handleSave(index)}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      保存
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
