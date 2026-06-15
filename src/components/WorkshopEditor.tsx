import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Save,
  X,
  Play,
  Trash2,
  Eraser,
  Square,
  Star,
  AlertCircle,
  CircleUser,
  Layers,
  Info,
  CheckCircle,
  Undo2,
  Redo2,
  History,
  Camera,
} from 'lucide-react';
import {
  CustomLevel,
  Position,
  BOARD_SIZE,
  EditorTool,
  GameEvent,
  VersionSnapshot,
  LevelTimeline,
} from '../game/types';
import {
  createEmptyLevel,
  validateLevel,
  createGameEventForEditor,
  createWorkshopLevel,
  updateWorkshopLevel,
  NameConflictAction,
  createVersionSnapshot,
  getLevelTimeline,
  saveUnsavedEditorDraft,
  loadUnsavedEditorDraft,
  clearUnsavedEditorDraft,
  setLastEditingLevel,
} from '../game/workshopStorage';
import { TimelinePanel } from './TimelinePanel';

interface WorkshopEditorProps {
  initialLevel?: CustomLevel;
  onBack: () => void;
  onSave: (level: CustomLevel) => void;
  onPlay: (level: CustomLevel) => void;
}

const posEquals = (a: Position, b: Position): boolean => a.x === b.x && a.y === b.y;

const deepCloneLevel = (lvl: CustomLevel): CustomLevel => JSON.parse(JSON.stringify(lvl));

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

interface ToolOption {
  tool: EditorTool;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const MAX_HISTORY = 50;

export const WorkshopEditor: React.FC<WorkshopEditorProps> = ({
  initialLevel,
  onBack,
  onSave,
  onPlay,
}) => {
  const isEditing = !!initialLevel && !!initialLevel.id;
  const initialLevelRef = useRef(initialLevel);

  const [level, setLevel] = useState<CustomLevel>(() => {
    if (initialLevel) return deepCloneLevel(initialLevel);
    const savedDraft = loadUnsavedEditorDraft(null);
    if (savedDraft?.levelData) return deepCloneLevel(savedDraft.levelData);
    return createEmptyLevel();
  });

  const [editorHistory, setEditorHistory] = useState<CustomLevel[]>(() => {
    if (initialLevel) return [];
    const savedDraft = loadUnsavedEditorDraft(null);
    return savedDraft?.editorHistory || [];
  });
  const [editorFuture, setEditorFuture] = useState<CustomLevel[]>(() => {
    if (initialLevel) return [];
    const savedDraft = loadUnsavedEditorDraft(null);
    return savedDraft?.editorFuture || [];
  });

  const [selectedTool, setSelectedTool] = useState<EditorTool>('obstacle');
  const [showNameConflict, setShowNameConflict] = useState<{
    existing: CustomLevel;
    type: 'create' | 'update';
    pendingLevel: CustomLevel;
  } | null>(null);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
  } | null>(null);
  const [showTimeline, setShowTimeline] = useState<boolean>(!!(initialLevel && initialLevel.id));
  const [timeline, setTimeline] = useState<LevelTimeline | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const levelId = level.id || initialLevel?.id || null;

  const refreshTimeline = useCallback(() => {
    if (levelId) {
      setTimeline(getLevelTimeline(levelId));
    }
  }, [levelId]);

  useEffect(() => {
    refreshTimeline();
  }, [refreshTimeline]);

  useEffect(() => {
    const key = initialLevelRef.current?.id || null;
    saveUnsavedEditorDraft(key, level, editorHistory, editorFuture);
    if (levelId) {
      setLastEditingLevel(levelId, level);
    }
  }, [level, editorHistory, editorFuture, levelId]);

  const showNotification = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 2500);
    },
    []
  );

  const pushHistory = useCallback((prevLevel: CustomLevel) => {
    setEditorHistory((prev) => {
      const next = [...prev, deepCloneLevel(prevLevel)];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setEditorFuture([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (editorHistory.length === 0) return;
    const prev = editorHistory[editorHistory.length - 1];
    setEditorFuture((f) => [deepCloneLevel(level), ...f]);
    setEditorHistory((h) => h.slice(0, -1));
    setLevel(deepCloneLevel(prev));
    setValidationResult(null);
  }, [editorHistory, level]);

  const handleRedo = useCallback(() => {
    if (editorFuture.length === 0) return;
    const next = editorFuture[0];
    setEditorHistory((h) => [...h, deepCloneLevel(level)]);
    setEditorFuture((f) => f.slice(1));
    setLevel(deepCloneLevel(next));
    setValidationResult(null);
  }, [editorFuture, level]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);

  const tools: ToolOption[] = [
    { tool: 'empty', label: '橡皮擦', icon: <Eraser className="w-5 h-5" />, color: 'bg-slate-700 hover:bg-slate-600' },
    { tool: 'player', label: '玩家起点', icon: <CircleUser className="w-5 h-5" />, color: 'bg-green-700 hover:bg-green-600' },
    { tool: 'obstacle', label: '障碍物', icon: <Square className="w-5 h-5" />, color: 'bg-gray-600 hover:bg-gray-500' },
    { tool: 'normal', label: '普通事件', icon: <Layers className="w-5 h-5" />, color: 'bg-orange-600 hover:bg-orange-500' },
    { tool: 'bonus', label: '奖励事件', icon: <Star className="w-5 h-5" />, color: 'bg-yellow-600 hover:bg-yellow-500' },
    { tool: 'danger', label: '危险事件', icon: <AlertCircle className="w-5 h-5" />, color: 'bg-red-600 hover:bg-red-500' },
  ];

  const updateName = useCallback((name: string) => {
    setLevel((prev) => {
      pushHistory(prev);
      return { ...prev, name };
    });
    setValidationResult(null);
  }, [pushHistory]);

  const updateDescription = useCallback((description: string) => {
    setLevel((prev) => {
      pushHistory(prev);
      return { ...prev, description };
    });
  }, [pushHistory]);

  const handleCellClick = useCallback(
    (pos: Position) => {
      setLevel((prev) => {
        const next = { ...prev };
        next.obstacles = prev.obstacles.filter((o) => !posEquals(o, pos));
        next.events = prev.events.filter((e) => !posEquals(e.position, pos));

        switch (selectedTool) {
          case 'empty':
            pushHistory(prev);
            return next;
          case 'player':
            pushHistory(prev);
            next.playerStart = { ...pos };
            return next;
          case 'obstacle':
            pushHistory(prev);
            next.obstacles = [...next.obstacles, { ...pos }];
            return next;
          case 'normal':
          case 'bonus':
          case 'danger': {
            if (posEquals(prev.playerStart, pos)) {
              return prev;
            }
            pushHistory(prev);
            const newEvent: GameEvent = createGameEventForEditor(selectedTool, pos);
            next.events = [...next.events, newEvent];
            return next;
          }
          default:
            return prev;
        }
      });
      setValidationResult(null);
    },
    [selectedTool, pushHistory]
  );

  const getCellContent = useCallback(
    (pos: Position) => {
      const isPlayer = posEquals(level.playerStart, pos);
      const isObstacle = level.obstacles.some((o) => posEquals(o, pos));
      const event = level.events.find((e) => posEquals(e.position, pos));
      return { isPlayer, isObstacle, event };
    },
    [level]
  );

  const handleManualSnapshot = useCallback(() => {
    if (!levelId) {
      showNotification('请先保存关卡再创建快照', 'error');
      return;
    }
    const snap = createVersionSnapshot({
      levelId,
      levelData: level,
      source: 'manual-snapshot',
    });
    if (snap) {
      showNotification('已创建手动快照', 'success');
      refreshTimeline();
    } else {
      showNotification('快照创建失败', 'error');
    }
  }, [levelId, level, refreshTimeline, showNotification]);

  const handleSave = useCallback(() => {
    const result = validateLevel(level);
    setValidationResult(result);
    if (!result.valid) return;

    if (isEditing) {
      const updated = updateWorkshopLevel(level.id, {
        name: level.name,
        description: level.description,
        playerStart: level.playerStart,
        obstacles: level.obstacles,
        events: level.events,
      });
      if (updated) {
        createVersionSnapshot({
          levelId: updated.id,
          levelData: updated,
          source: 'manual-save',
        });
        clearUnsavedEditorDraft(updated.id);
        refreshTimeline();
        onSave(updated);
      }
    } else {
      const created = createWorkshopLevel({
        name: level.name,
        description: level.description,
        playerStart: level.playerStart,
        obstacles: level.obstacles,
        events: level.events,
        onNameConflict: (existing) => {
          setShowNameConflict({
            existing,
            type: 'create',
            pendingLevel: { ...level, id: '', createdAt: 0, updatedAt: 0 },
          });
          return 'rename';
        },
      });
      if (created && created.name === level.name) {
        createVersionSnapshot({
          levelId: created.id,
          levelData: created,
          source: 'manual-save',
        });
        clearUnsavedEditorDraft(null);
        setLevel(created);
        refreshTimeline();
        onSave(created);
      } else if (created) {
        createVersionSnapshot({
          levelId: created.id,
          levelData: created,
          source: 'manual-save',
        });
        clearUnsavedEditorDraft(null);
        setLevel(created);
        refreshTimeline();
        onSave(created);
      }
    }
  }, [level, isEditing, onSave, refreshTimeline]);

  const handleConflict = useCallback(
    (action: NameConflictAction) => {
      if (!showNameConflict) return;

      const result = createWorkshopLevel({
        name: showNameConflict.pendingLevel.name,
        description: showNameConflict.pendingLevel.description,
        playerStart: showNameConflict.pendingLevel.playerStart,
        obstacles: showNameConflict.pendingLevel.obstacles,
        events: showNameConflict.pendingLevel.events,
        onNameConflict: () => action,
      });

      setShowNameConflict(null);
      if (result) {
        createVersionSnapshot({
          levelId: result.id,
          levelData: result,
          source: 'manual-save',
        });
        clearUnsavedEditorDraft(null);
        setLevel(result);
        refreshTimeline();
        onSave(result);
      }
    },
    [showNameConflict, onSave, refreshTimeline]
  );

  const handlePlay = useCallback(() => {
    const result = validateLevel(level);
    setValidationResult(result);
    if (!result.valid) return;

    let finalLevel = level;
    if (!level.id) {
      const created = createWorkshopLevel({
        name: level.name,
        description: level.description,
        playerStart: level.playerStart,
        obstacles: level.obstacles,
        events: level.events,
        onNameConflict: () => 'rename',
      });
      if (created) finalLevel = created;
    }

    if (finalLevel.id) {
      createVersionSnapshot({
        levelId: finalLevel.id,
        levelData: finalLevel,
        source: 'playtest-return',
        note: '试玩前快照',
      });
    }

    onPlay(finalLevel);
  }, [level, onPlay]);

  const handleRollback = useCallback(
    (restored: CustomLevel) => {
      setLevel((prev) => {
        pushHistory(prev);
        return deepCloneLevel(restored);
      });
      refreshTimeline();
      showNotification('已回滚到选中版本，撤销栈保留', 'success');
    },
    [pushHistory, refreshTimeline, showNotification]
  );

  const clearBoard = useCallback(() => {
    setLevel((prev) => {
      pushHistory(prev);
      return {
        ...prev,
        obstacles: [],
        events: [],
        playerStart: { x: 0, y: 0 },
      };
    });
    setValidationResult(null);
  }, [pushHistory]);

  const handleClose = useCallback(() => {
    const key = initialLevelRef.current?.id || null;
    clearUnsavedEditorDraft(key);
    onBack();
  }, [onBack]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
      <div className="bg-slate-800 rounded-xl border border-slate-600 shadow-2xl w-full max-w-[1400px] mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              {isEditing ? '编辑关卡' : '新建关卡'}
            </h2>
            <button
              onClick={() => setShowTimeline((s) => !s)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1.5 ${
                showTimeline
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
              disabled={!levelId}
              title={levelId ? '切换时间线面板' : '保存关卡后可查看时间线'}
            >
              <History className="w-3.5 h-3.5" />
              时间线
              {timeline && (
                <span className="text-[10px] bg-slate-900/40 px-1.5 py-0.5 rounded">
                  {timeline.snapshots.length}
                </span>
              )}
            </button>
            {levelId && (
              <button
                onClick={handleManualSnapshot}
                className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors flex items-center gap-1.5"
                title="创建手动快照"
              >
                <Camera className="w-3.5 h-3.5" />
                快照
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 mr-2">
              <button
                onClick={handleUndo}
                disabled={editorHistory.length === 0}
                className="p-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed rounded text-slate-300 hover:text-white transition-colors"
                title={`撤销 (Ctrl+Z) - ${editorHistory.length} 步`}
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleRedo}
                disabled={editorFuture.length === 0}
                className="p-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed rounded text-slate-300 hover:text-white transition-colors"
                title={`重做 (Ctrl+Y) - ${editorFuture.length} 步`}
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {toast && (
          <div className={`mx-6 mt-3 px-4 py-2 rounded-lg text-sm ${
            toast.type === 'success'
              ? 'bg-green-500/20 border border-green-500/30 text-green-300'
              : 'bg-red-500/20 border border-red-500/30 text-red-300'
          }`}>
            {toast.message}
          </div>
        )}

        <div className="p-6 grid gap-6" style={{ gridTemplateColumns: showTimeline ? '1fr 320px 300px' : '1fr 320px' }}>
          <div className="flex flex-col items-center">
            <div className="w-full max-w-[450px]">
              <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-cyan-500/20 rounded-xl blur-xl" />
              <div className="relative bg-slate-900 p-2 rounded-lg border-2 border-slate-600 shadow-2xl">
                <div className="flex flex-col gap-0">
                  {Array.from({ length: BOARD_SIZE }).map((_, y) => (
                    <div key={y} className="grid grid-cols-8 gap-0">
                      {Array.from({ length: BOARD_SIZE }).map((_, x) => {
                        const pos = { x, y };
                        const { isPlayer, isObstacle, event } = getCellContent(pos);
                        const isEvenCell = (x + y) % 2 === 0;

                        return (
                          <div
                            key={`${x}-${y}`}
                            className={`
                              relative w-full aspect-square flex items-center justify-center
                              cursor-pointer transition-all duration-150
                              ${isEvenCell ? 'bg-slate-800' : 'bg-slate-700'}
                              border border-slate-600/50
                              hover:border-cyan-500/50 hover:bg-slate-600
                            `}
                            onClick={() => handleCellClick(pos)}
                          >
                            {isObstacle && !isPlayer && !event && (
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
                                  shadow-lg
                                  text-white font-bold text-lg
                                `}
                              >
                                {getEventIcon(event.type)}
                              </div>
                            )}

                            {isPlayer && (
                              <div className="w-4/5 h-4/5 rounded-full bg-green-400 shadow-lg shadow-green-400/60 flex items-center justify-center">
                                <div className="w-3/5 h-3/5 rounded-full bg-green-300 flex items-center justify-center">
                                  <span className="text-green-800 font-bold text-xl">●</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 text-xs text-slate-500">
              点击格子放置当前工具选中的元素，橡皮擦工具可清除 · Ctrl+Z 撤销 · Ctrl+Y 重做
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">关卡名称</label>
              <input
                type="text"
                value={level.name}
                onChange={(e) => updateName(e.target.value)}
                placeholder="输入关卡名称"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">关卡描述（可选）</label>
              <textarea
                value={level.description || ''}
                onChange={(e) => updateDescription(e.target.value)}
                placeholder="输入关卡描述"
                rows={2}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>

            <div className="border-t border-slate-700 pt-4">
              <h3 className="text-slate-300 font-medium text-sm uppercase tracking-wider mb-3">
                工具选择
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {tools.map((t) => (
                  <button
                    key={t.tool}
                    onClick={() => setSelectedTool(t.tool)}
                    className={`
                      px-3 py-2 flex items-center gap-2 rounded-lg border
                      text-white text-sm transition-all duration-150
                      ${selectedTool === t.tool
                        ? `${t.color} border-cyan-500 ring-2 ring-cyan-500/30`
                        : `${t.color} border-transparent opacity-70 hover:opacity-100`
                      }
                    `}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-700 pt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">障碍数量</span>
                <span className="text-white font-mono">{level.obstacles.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">普通事件</span>
                <span className="text-orange-400 font-mono">
                  {level.events.filter((e) => e.type === 'normal').length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">奖励事件</span>
                <span className="text-yellow-400 font-mono">
                  {level.events.filter((e) => e.type === 'bonus').length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">危险事件</span>
                <span className="text-red-400 font-mono">
                  {level.events.filter((e) => e.type === 'danger').length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">玩家起点</span>
                <span className="text-green-400 font-mono">
                  ({level.playerStart.x}, {level.playerStart.y})
                </span>
              </div>
              <div className="flex items-center justify-between text-xs border-t border-slate-700/50 pt-2 mt-2">
                <span className="text-slate-500">撤销栈</span>
                <span className="text-slate-400 font-mono">
                  {editorHistory.length} ← / {editorFuture.length} →
                </span>
              </div>
            </div>

            {validationResult && !validationResult.valid && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-300 space-y-1">
                    {validationResult.errors.map((e, i) => (
                      <p key={i}>{e}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-slate-700 pt-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={clearBoard}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-slate-500 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  清空棋盘
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-slate-500 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  返回
                </button>
              </div>
              <button
                onClick={handleSave}
                className="w-full px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isEditing ? '保存修改（创建快照）' : '保存关卡（创建快照）'}
              </button>
              <button
                onClick={handlePlay}
                className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                保存并试玩（创建快照）
              </button>
            </div>
          </div>

          {showTimeline && (
            <div className="h-[600px]">
              <TimelinePanel
                levelId={levelId}
                currentLevel={level}
                timeline={timeline}
                onSnapshotCreated={refreshTimeline}
                onRollback={handleRollback}
                onLevelChanged={refreshTimeline}
              />
            </div>
          )}
        </div>
      </div>

      {showNameConflict && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl border border-slate-600 shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Info className="w-5 h-5 text-yellow-400" />
                关卡名称冲突
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-300">
                已存在同名关卡：<span className="text-cyan-400 font-medium">{showNameConflict.existing.name}</span>
              </p>
              <p className="text-sm text-slate-400">
                创建时间：{new Date(showNameConflict.existing.createdAt).toLocaleString('zh-CN')}
              </p>
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-300">
                  请选择处理方式：
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleConflict('rename')}
                  className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  另存为新关卡
                </button>
                <button
                  onClick={() => handleConflict('overwrite')}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  覆盖现有
                </button>
              </div>
              <button
                onClick={() => setShowNameConflict(null)}
                className="w-full px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
