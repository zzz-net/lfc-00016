import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Edit3,
  Trash2,
  Play,
  ArrowLeft,
  Download,
  Upload,
  Layers,
  Trophy,
  Clock,
  Target,
  FileWarning,
  CheckCircle,
  AlertTriangle,
  X,
  Info,
  Home,
} from 'lucide-react';
import { CustomLevel, WorkshopScore, Position, BOARD_SIZE } from '../game/types';
import {
  listWorkshopLevels,
  getWorkshopLevel,
  deleteWorkshopLevel,
  publishWorkshopLevel,
  unpublishWorkshopLevel,
  listWorkshopScores,
  getWorkshopScore,
  getLastEditingLevel,
  validateLevelJSON,
  importWorkshopLevels,
  exportWorkshopLevel,
  exportAllWorkshopLevels,
  NameConflictAction,
  LevelImportResult,
} from '../game/workshopStorage';
import { useGameStore } from '../hooks/useGameState';
import { WorkshopEditor } from '../components/WorkshopEditor';
import { formatDate } from '../game/storage';

type ImportPhase = 'idle' | 'selecting' | 'validated' | 'success' | 'error';
type ConflictResolution = Record<number, NameConflictAction>;

const MiniBoard: React.FC<{ level: CustomLevel; size?: number }> = ({
  level,
  size = 100,
}) => {
  const cellSize = size / BOARD_SIZE;
  const posEquals = (a: Position, b: Position) => a.x === b.x && a.y === b.y;

  return (
    <div
      className="relative bg-slate-900 rounded overflow-hidden border border-slate-600"
      style={{ width: size, height: size }}
    >
      {Array.from({ length: BOARD_SIZE }).map((_, y) =>
        Array.from({ length: BOARD_SIZE }).map((_, x) => {
          const pos = { x, y };
          const isEven = (x + y) % 2 === 0;
          const isPlayer = posEquals(level.playerStart, pos);
          const isObstacle = level.obstacles.some((o) => posEquals(o, pos));
          const event = level.events.find((e) => posEquals(e.position, pos));

          const getMiniColor = () => {
            if (isPlayer) return 'bg-green-400';
            if (isObstacle) return 'bg-gray-500';
            if (event?.type === 'normal') return 'bg-orange-500';
            if (event?.type === 'bonus') return 'bg-yellow-400';
            if (event?.type === 'danger') return 'bg-red-500';
            return isEven ? 'bg-slate-800' : 'bg-slate-700';
          };

          return (
            <div
              key={`${x}-${y}`}
              className={`absolute ${getMiniColor()}`}
              style={{
                left: x * cellSize,
                top: y * cellSize,
                width: cellSize,
                height: cellSize,
              }}
            />
          );
        })
      )}
    </div>
  );
};

export const WorkshopPage: React.FC = () => {
  const navigate = useNavigate();
  const { initWorkshopGame, exitWorkshopGame, isWorkshopMode, getCurrentLevelId } = useGameStore();

  const [levels, setLevels] = useState<CustomLevel[]>([]);
  const [scores, setScores] = useState<Record<string, WorkshopScore>>({});
  const [showEditor, setShowEditor] = useState(false);
  const [editingLevel, setEditingLevel] = useState<CustomLevel | undefined>(undefined);
  const [lastEditingInfo, setLastEditingInfo] = useState<{
    levelId: string | null;
    snapshot: CustomLevel | null;
  } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState<{ levelId: string; levelName: string } | null>(null);
  const [publishNote, setPublishNote] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'published'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPhase, setImportPhase] = useState<ImportPhase>('idle');
  const [importValidation, setImportValidation] = useState<ReturnType<
    typeof validateLevelJSON
  > | null>(null);
  const [conflicts, setConflicts] = useState<
    Array<{ index: number; incoming: CustomLevel; existing: CustomLevel }>
  >([]);
  const [conflictResolutions, setConflictResolutions] = useState<ConflictResolution>({});
  const [importResult, setImportResult] = useState<LevelImportResult | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const showNotification = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  const refreshData = useCallback(() => {
    setLevels(listWorkshopLevels());
    setScores(listWorkshopScores());
  }, []);

  useEffect(() => {
    refreshData();
    const lastEdit = getLastEditingLevel();
    if (lastEdit.levelId || lastEdit.snapshot) {
      setLastEditingInfo(lastEdit);
      if (isWorkshopMode()) {
        setShowResumePrompt(true);
      }
    }
  }, [refreshData, isWorkshopMode]);

  const handleNewLevel = useCallback(() => {
    setEditingLevel(undefined);
    setShowEditor(true);
  }, []);

  const handleEditLevel = useCallback(
    (level: CustomLevel) => {
      setEditingLevel(level);
      setShowEditor(true);
    },
    []
  );

  const handleSaveEditor = useCallback(
    (saved: CustomLevel) => {
      setShowEditor(false);
      setEditingLevel(undefined);
      refreshData();
      showNotification('关卡保存成功', 'success');
    },
    [refreshData, showNotification]
  );

  const handlePlayLevel = useCallback(
    (level: CustomLevel) => {
      initWorkshopGame(level, level);
      navigate('/');
    },
    [initWorkshopGame, navigate]
  );

  const handleBackToEditor = useCallback(() => {
    const levelId = getCurrentLevelId();
    if (levelId) {
      const level = getWorkshopLevel(levelId);
      if (level) {
        handleEditLevel(level);
      }
    } else if (lastEditingInfo?.snapshot) {
      setEditingLevel(lastEditingInfo.snapshot);
      setShowEditor(true);
    }
  }, [getCurrentLevelId, lastEditingInfo, handleEditLevel]);

  const handlePublishLevel = useCallback(
    (id: string) => {
      const level = getWorkshopLevel(id);
      if (!level) return;
      setPublishNote(level.versionNote || '');
      setShowPublishModal({ levelId: id, levelName: level.name });
    },
    []
  );

  const handleConfirmPublish = useCallback(() => {
    if (!showPublishModal) return;
    const result = publishWorkshopLevel(showPublishModal.levelId, publishNote);
    if (result) {
      refreshData();
      showNotification(`已发布：${result.name} v${result.version}`, 'success');
    } else {
      showNotification('发布失败', 'error');
    }
    setShowPublishModal(null);
    setPublishNote('');
  }, [showPublishModal, publishNote, refreshData, showNotification]);

  const handleUnpublishLevel = useCallback(
    (id: string) => {
      const result = unpublishWorkshopLevel(id);
      if (result) {
        refreshData();
        showNotification('已撤回发布', 'success');
      } else {
        showNotification('撤回失败', 'error');
      }
    },
    [refreshData, showNotification]
  );

  const handleDeleteLevel = useCallback(
    (id: string) => {
      const success = deleteWorkshopLevel(id);
      if (success) {
        refreshData();
        showNotification('关卡已删除', 'success');
      } else {
        showNotification('删除失败', 'error');
      }
      setShowDeleteConfirm(null);
    },
    [refreshData, showNotification]
  );

  const handleExportLevel = useCallback((level: CustomLevel) => {
    const json = exportWorkshopLevel(level);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `level-${level.name.replace(/[^\w\u4e00-\u9fa5]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleExportAll = useCallback(() => {
    const json = exportAllWorkshopLevels();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workshop-levels-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const resetImportState = useCallback(() => {
    setImportPhase('idle');
    setImportValidation(null);
    setConflicts([]);
    setConflictResolutions({});
    setImportResult(null);
    setImportErrors([]);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const validation = validateLevelJSON(text);
        setImportValidation(validation);

        if (!validation.valid) {
          setImportPhase('error');
          setImportErrors(validation.errors);
          return;
        }

        const existingLevels = listWorkshopLevels();
        const detectedConflicts: Array<{
          index: number;
          incoming: CustomLevel;
          existing: CustomLevel;
        }> = [];

        validation.levels.forEach((incoming, idx) => {
          const existing = existingLevels.find(
            (l) =>
              l.name.trim().toLowerCase() === incoming.name.trim().toLowerCase()
          );
          if (existing) {
            detectedConflicts.push({ index: idx, incoming, existing });
          }
        });

        setConflicts(detectedConflicts);

        if (detectedConflicts.length > 0) {
          const resolutions: ConflictResolution = {};
          detectedConflicts.forEach((c) => {
            resolutions[c.index] = 'rename';
          });
          setConflictResolutions(resolutions);
        }

        setImportPhase('validated');
      };
      reader.onerror = () => {
        setImportPhase('error');
        setImportErrors(['无法读取文件']);
      };
      reader.readAsText(file);
    },
    []
  );

  const handleConfirmImport = useCallback(() => {
    if (!importValidation) return;

    const result = importWorkshopLevels({
      levels: importValidation.levels,
      onConflict: (_incoming, _existing, index) => {
        return conflictResolutions[index] || 'rename';
      },
    });

    setImportResult(result);
    if (result.success) {
      setImportPhase('success');
      refreshData();
    } else {
      setImportPhase('error');
      setImportErrors(result.errors);
    }
  }, [importValidation, conflictResolutions, refreshData]);

  const inWorkshopMode = isWorkshopMode();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-6 max-w-6xl">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (inWorkshopMode) {
                    exitWorkshopGame();
                  }
                  navigate('/');
                }}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-400 hover:text-white transition-all"
                title={inWorkshopMode ? '退出工坊模式并返回首页' : '返回首页'}
              >
                <Home className="w-5 h-5" />
              </button>
              {inWorkshopMode && (
                <span className="px-3 py-1 bg-purple-600/30 border border-purple-500/50 text-purple-300 rounded-full text-sm font-medium">
                  工坊模式中
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {inWorkshopMode && (
                <button
                  onClick={handleBackToEditor}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <Edit3 className="w-4 h-4" />
                  回到工坊继续编辑
                </button>
              )}
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
              关卡工坊 Level Workshop
            </h1>
            <p className="text-slate-400">
              创建你的专属关卡，挑战自己或分享给朋友
            </p>
          </div>
        </header>

        {lastEditingInfo && !inWorkshopMode && showResumePrompt && (
          <div className="mb-6 p-4 bg-purple-600/10 border border-purple-500/30 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5 text-purple-400" />
                <div>
                  <p className="text-purple-300 font-medium">检测到上次编辑内容</p>
                  <p className="text-sm text-purple-400/80">
                    {lastEditingInfo.snapshot
                      ? `「${lastEditingInfo.snapshot.name}」`
                      : lastEditingInfo.levelId
                      ? `关卡 ID: ${lastEditingInfo.levelId.slice(0, 8)}`
                      : '未保存的编辑草稿'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowResumePrompt(false)}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
                >
                  忽略
                </button>
                <button
                  onClick={() => {
                    if (lastEditingInfo.snapshot) {
                      setEditingLevel(lastEditingInfo.snapshot);
                      setShowEditor(true);
                    } else if (lastEditingInfo.levelId) {
                      const lvl = getWorkshopLevel(lastEditingInfo.levelId);
                      if (lvl) handleEditLevel(lvl);
                    }
                    setShowResumePrompt(false);
                  }}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
                >
                  继续编辑
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-slate-800/80 backdrop-blur rounded-xl p-4 border border-slate-700 shadow-lg mb-6">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewLevel}
                className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                新建关卡
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-slate-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                导入关卡
              </button>
              <button
                onClick={handleExportAll}
                disabled={levels.length === 0}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-slate-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                导出全部
              </button>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filterStatus === 'all'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setFilterStatus('draft')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filterStatus === 'draft'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                草稿
              </button>
              <button
                onClick={() => setFilterStatus('published')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filterStatus === 'published'
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                已发布
              </button>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1">
                <Layers className="w-4 h-4" />
                共 {levels.length} 个关卡
              </span>
              <span className="flex items-center gap-1">
                <Trophy className="w-4 h-4" />
                {Object.values(scores).reduce((sum, s) => sum + s.plays, 0)} 次试玩
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {(() => {
            const filteredLevels = levels.filter((l) => {
              if (filterStatus === 'all') return true;
              return l.status === filterStatus;
            });
            return filteredLevels.length === 0 ? (
            <div className="bg-slate-800/60 backdrop-blur rounded-xl border border-slate-700 p-12 text-center">
              <Layers className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl text-slate-400 mb-2">工坊空空如也</h3>
              <p className="text-slate-500 mb-6">点击「新建关卡」开始创建你的第一个自定义关卡</p>
              <button
                onClick={handleNewLevel}
                className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                立即创建
              </button>
            </div>
            ) : (
            filteredLevels.map((level) => {
              const score = scores[level.id];
              return (
                <div
                  key={level.id}
                  className="bg-slate-800/80 backdrop-blur rounded-xl border border-slate-700 p-4 hover:border-slate-600 transition-all shadow-lg"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <MiniBoard level={level} size={96} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="text-lg font-bold text-white truncate flex items-center gap-2">
                            {level.name}
                            <span className="text-xs font-mono text-slate-500">
                              v{level.version}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded border ${
                                level.status === 'published'
                                  ? 'bg-green-500/20 text-green-300 border-green-500/30'
                                  : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                              }`}
                            >
                              {level.status === 'published' ? '已发布' : '草稿'}
                            </span>
                          </h3>
                          {level.description && (
                            <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                              {level.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(level.updatedAt)}
                            </span>
                            <span>障碍 {level.obstacles.length}</span>
                            <span className="text-orange-400">
                              普通 {level.events.filter((e) => e.type === 'normal').length}
                            </span>
                            <span className="text-yellow-400">
                              奖励 {level.events.filter((e) => e.type === 'bonus').length}
                            </span>
                            <span className="text-red-400">
                              危险 {level.events.filter((e) => e.type === 'danger').length}
                            </span>
                            <span className="text-green-400">
                              起点 ({level.playerStart.x},{level.playerStart.y})
                            </span>
                          </div>
                          {score && (
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                              <span className="flex items-center gap-1 text-slate-400">
                                <Target className="w-3 h-3" />
                                试玩 {score.plays} 次
                              </span>
                              {score.plays > 0 && (
                                <>
                                  <span className="text-green-400">
                                    胜利 {score.wins} 次
                                  </span>
                                  <span className="text-yellow-400">
                                    最高分 {score.bestScore}
                                  </span>
                                  <span className="text-cyan-400">
                                    上次 {score.lastScore}
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditLevel(level)}
                              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white transition-all"
                              title="编辑关卡"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePlayLevel(level)}
                              className="p-2 bg-green-600 hover:bg-green-500 rounded-lg border border-green-500 hover:border-green-400 text-white transition-all"
                              title="试玩关卡"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                            {level.status === 'draft' ? (
                              <button
                                onClick={() => handlePublishLevel(level.id)}
                                className="p-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg border border-emerald-500 hover:border-emerald-400 text-white transition-all"
                                title="发布关卡"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUnpublishLevel(level.id)}
                                className="p-2 bg-orange-600 hover:bg-orange-500 rounded-lg border border-orange-500 hover:border-orange-400 text-white transition-all"
                                title="撤回发布"
                              >
                                <AlertTriangle className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleExportLevel(level)}
                              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white transition-all"
                              title="导出关卡 JSON"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(level.id)}
                              className="p-2 bg-slate-700 hover:bg-red-600 rounded-lg border border-slate-600 hover:border-red-500 text-slate-300 hover:text-white transition-all"
                              title="删除关卡"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
            );
          })()}
        </div>
      </div>

      {showEditor && (
        <WorkshopEditor
          initialLevel={editingLevel}
          onBack={() => {
            setShowEditor(false);
            setEditingLevel(undefined);
          }}
          onSave={handleSaveEditor}
          onPlay={(level) => {
            setShowEditor(false);
            setEditingLevel(undefined);
            refreshData();
            handlePlayLevel(level);
          }}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl border border-slate-600 shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="text-lg font-bold text-white">确认删除</h3>
            </div>
            <div className="p-6">
              <p className="text-slate-300 mb-2">确定要删除这个关卡吗？</p>
              <p className="text-sm text-slate-500">此操作不可恢复，关卡配置和所有试玩成绩将一并删除。</p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => handleDeleteLevel(showDeleteConfirm)}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl border border-slate-600 shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <h3 className="text-lg font-bold text-white">发布关卡</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-300">
                即将发布：<span className="text-cyan-400 font-medium">{showPublishModal.levelName}</span>
              </p>
              <div>
                <label className="block text-sm text-slate-400 mb-2">版本说明（可选）</label>
                <textarea
                  value={publishNote}
                  onChange={(e) => setPublishNote(e.target.value)}
                  placeholder="描述此版本的更新内容..."
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>
              <p className="text-xs text-slate-500">
                发布后版本号将自动递增，状态变为「已发布」。
              </p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowPublishModal(null);
                    setPublishNote('');
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmPublish}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
                >
                  确认发布
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
          <div className="bg-slate-800 rounded-xl border border-slate-600 shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-cyan-400" />
                导入关卡
              </h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  resetImportState();
                }}
                className="p-1 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {importPhase === 'idle' && (
                <>
                  <p className="text-sm text-slate-400">
                    支持导入单个关卡 JSON 文件或包含多个关卡的数组。导入前会检查文件完整性。
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-slate-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    选择 JSON 文件
                  </button>
                </>
              )}

              {importPhase === 'error' && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <FileWarning className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-300 font-medium">导入失败</p>
                      {importErrors.map((e, i) => (
                        <p key={i} className="text-sm text-red-400 mt-1">
                          {e}
                        </p>
                      ))}
                      <p className="text-xs text-slate-400 mt-2">
                        现有工坊关卡未受影响。
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={resetImportState}
                    className="mt-3 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                  >
                    重新选择
                  </button>
                </div>
              )}

              {importPhase === 'validated' && importValidation && (
                <>
                  {importValidation.warnings.length > 0 && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-yellow-300 space-y-1">
                          {importValidation.warnings.map((w, i) => (
                            <p key={i}>{w}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-300">
                        <p>检测到 {importValidation.levels.length} 个有效关卡</p>
                        {conflicts.length > 0 && (
                          <p className="mt-1 text-orange-300">
                            其中 {conflicts.length} 个与现有关卡同名
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {conflicts.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-400" />
                        冲突处理（逐个选择）
                      </h4>
                      {conflicts.map((c) => (
                        <div
                          key={c.index}
                          className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg"
                        >
                          <p className="text-sm text-orange-300 mb-2">
                            「{c.incoming.name}」已存在
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                setConflictResolutions((prev) => ({
                                  ...prev,
                                  [c.index]: 'rename',
                                }))
                              }
                              className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                conflictResolutions[c.index] === 'rename'
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              }`}
                            >
                              另存为新关卡
                            </button>
                            <button
                              onClick={() =>
                                setConflictResolutions((prev) => ({
                                  ...prev,
                                  [c.index]: 'overwrite',
                                }))
                              }
                              className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                conflictResolutions[c.index] === 'overwrite'
                                  ? 'bg-red-600 text-white'
                                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              }`}
                            >
                              覆盖现有
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={resetImportState}
                      className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      className="flex-1 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      确认导入
                    </button>
                  </div>
                </>
              )}

              {importPhase === 'success' && importResult && (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-green-300 font-medium">导入成功</p>
                      <p className="text-sm text-green-400 mt-1">
                        成功导入 {importResult.importedLevels.length} 个关卡
                      </p>
                      {importResult.warnings.length > 0 && (
                        <div className="mt-2 text-xs text-yellow-400 space-y-0.5">
                          {importResult.warnings.map((w, i) => (
                            <p key={i}>警告: {w}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      resetImportState();
                    }}
                    className="mt-3 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors"
                  >
                    完成
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg animate-slide-in ${
            toast.type === 'error'
              ? 'bg-red-600 border border-red-500'
              : 'bg-cyan-600 border border-cyan-500'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-white" />
          ) : (
            <CheckCircle className="w-5 h-5 text-white" />
          )}
          <span className="text-white font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default WorkshopPage;
