import React, { useState, useMemo } from 'react';
import {
  History,
  Clock,
  GitCompare,
  RotateCcw,
  Copy,
  Download,
  Upload,
  Trash2,
  Edit3,
  Check,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  Info,
  FileJson,
  Tag,
} from 'lucide-react';
import {
  VersionSnapshot,
  LevelTimeline,
  LevelDiff,
  TimelineLogEntry,
  SnapshotSource,
  TimelineActionType,
  BOARD_SIZE,
  Position,
  CustomLevel,
} from '../game/types';
import {
  deleteVersionSnapshot,
  renameVersionSnapshot,
  rollbackToSnapshot,
  rollbackSnapshotAsNewLevel,
  exportSingleSnapshot,
  exportFullTimeline,
  createVersionSnapshot,
} from '../game/workshopStorage';

interface TimelinePanelProps {
  levelId: string | null;
  currentLevel: CustomLevel;
  timeline: LevelTimeline | null;
  onSnapshotCreated?: (snap: VersionSnapshot) => void;
  onRollback?: (level: CustomLevel) => void;
  onLevelChanged?: (level: CustomLevel) => void;
  onRequestClose?: () => void;
}

const getSourceLabel = (source: SnapshotSource): { text: string; color: string } => {
  switch (source) {
    case 'manual-save': return { text: '手动保存', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
    case 'playtest-return': return { text: '试玩返回', color: 'bg-green-500/20 text-green-300 border-green-500/30' };
    case 'pre-publish': return { text: '发布前', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
    case 'manual-snapshot': return { text: '快照', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
    case 'rollback': return { text: '回滚', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' };
    case 'import': return { text: '导入', color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' };
    default: return { text: source, color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
  }
};

const getActionLabel = (action: TimelineActionType): string => {
  switch (action) {
    case 'snapshot-create': return '创建快照';
    case 'snapshot-rename': return '重命名快照';
    case 'snapshot-delete': return '删除快照';
    case 'rollback': return '回滚版本';
    case 'rollback-to-new': return '另存为新关卡';
    case 'conflict-merge': return '冲突-合并';
    case 'conflict-overwrite': return '冲突-覆盖';
    case 'conflict-rename': return '冲突-另存';
    case 'recovery': return '恢复';
    case 'export-single': return '导出单版本';
    case 'export-full': return '导出全历史';
    default: return action;
  }
};

const DiffView: React.FC<{ diff: LevelDiff | null | undefined }> = ({ diff }) => {
  if (!diff || diff.totalChanges === 0) {
    return (
      <div className="text-xs text-slate-500 italic">
        与上一版本无差异
      </div>
    );
  }

  const items: { label: string; value: string; color: string }[] = [];
  if (diff.nameChanged) items.push({ label: '名称', value: '已修改', color: 'text-yellow-400' });
  if (diff.descriptionChanged) items.push({ label: '描述', value: '已修改', color: 'text-yellow-400' });
  if (diff.playerStartChanged) items.push({ label: '起点', value: '已移动', color: 'text-green-400' });
  if (diff.obstaclesAdded.length > 0) items.push({ label: '障碍+', value: `${diff.obstaclesAdded.length}`, color: 'text-orange-400' });
  if (diff.obstaclesRemoved.length > 0) items.push({ label: '障碍-', value: `${diff.obstaclesRemoved.length}`, color: 'text-orange-400' });
  if (diff.eventsAdded.length > 0) items.push({ label: '事件+', value: `${diff.eventsAdded.length}`, color: 'text-blue-400' });
  if (diff.eventsRemoved.length > 0) items.push({ label: '事件-', value: `${diff.eventsRemoved.length}`, color: 'text-blue-400' });
  if (diff.eventsModified.length > 0) items.push({ label: '事件~', value: `${diff.eventsModified.length}`, color: 'text-blue-400' });

  return (
    <div className="space-y-1">
      {items.map((it, i) => (
        <div key={i} className="flex items-center justify-between text-xs">
          <span className="text-slate-500">{it.label}</span>
          <span className={it.color}>{it.value}</span>
        </div>
      ))}
    </div>
  );
};

const MiniSnapshotBoard: React.FC<{ level: CustomLevel; size?: number }> = ({ level, size = 60 }) => {
  const cellSize = size / BOARD_SIZE;
  const posEq = (a: Position, b: Position) => a.x === b.x && a.y === b.y;
  return (
    <div className="relative bg-slate-900 rounded overflow-hidden border border-slate-700 flex-shrink-0" style={{ width: size, height: size }}>
      {Array.from({ length: BOARD_SIZE }).map((_, y) =>
        Array.from({ length: BOARD_SIZE }).map((_, x) => {
          const pos = { x, y };
          const isEven = (x + y) % 2 === 0;
          const isPlayer = posEq(level.playerStart, pos);
          const isObstacle = level.obstacles.some((o) => posEq(o, pos));
          const ev = level.events.find((e) => posEq(e.position, pos));
          let bg = isEven ? 'bg-slate-800' : 'bg-slate-700';
          if (isPlayer) bg = 'bg-green-400';
          else if (isObstacle) bg = 'bg-gray-500';
          else if (ev?.type === 'normal') bg = 'bg-orange-500';
          else if (ev?.type === 'bonus') bg = 'bg-yellow-400';
          else if (ev?.type === 'danger') bg = 'bg-red-500';
          return (
            <div
              key={`${x}-${y}`}
              className={`absolute ${bg}`}
              style={{ left: x * cellSize, top: y * cellSize, width: cellSize, height: cellSize }}
            />
          );
        })
      )}
    </div>
  );
};

export const TimelinePanel: React.FC<TimelinePanelProps> = ({
  levelId,
  currentLevel,
  timeline,
  onSnapshotCreated,
  onRollback,
  onLevelChanged,
}) => {
  const [expandedSnapId, setExpandedSnapId] = useState<string | null>(null);
  const [editingSnapId, setEditingSnapId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNote, setEditNote] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [showNewSnapshot, setShowNewSnapshot] = useState(false);
  const [newSnapName, setNewSnapName] = useState('');
  const [newSnapNote, setNewSnapNote] = useState('');
  const [rollbackConfirm, setRollbackConfirm] = useState<{ snap: VersionSnapshot; mode: 'overwrite' | 'new' } | null>(null);
  const [newLevelName, setNewLevelName] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const snapshots = useMemo(() => {
    if (!timeline) return [];
    return [...timeline.snapshots].sort((a, b) => b.createdAt - a.createdAt);
  }, [timeline]);

  const logs = useMemo(() => {
    if (!timeline) return [];
    return [...timeline.logs].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
  }, [timeline]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleCreateSnapshot = () => {
    if (!levelId) return;
    const snap = createVersionSnapshot({
      levelId,
      levelData: currentLevel,
      source: 'manual-snapshot',
      name: newSnapName.trim() || undefined,
      note: newSnapNote.trim() || undefined,
    });
    if (snap) {
      showToast('快照创建成功', 'success');
      onSnapshotCreated?.(snap);
      setShowNewSnapshot(false);
      setNewSnapName('');
      setNewSnapNote('');
    } else {
      showToast('快照创建失败', 'error');
    }
  };

  const handleRename = (snapId: string) => {
    if (!levelId) return;
    const ok = renameVersionSnapshot(levelId, snapId, editName.trim(), editNote.trim() || undefined);
    if (ok) {
      showToast('已重命名', 'success');
      onLevelChanged?.(currentLevel);
    } else {
      showToast('重命名失败', 'error');
    }
    setEditingSnapId(null);
  };

  const handleDelete = (snap: VersionSnapshot) => {
    if (!levelId) return;
    if (!window.confirm(`确定删除快照「${snap.name}」吗？`)) return;
    const ok = deleteVersionSnapshot(levelId, snap.id);
    if (ok) {
      showToast('已删除', 'success');
      if (expandedSnapId === snap.id) setExpandedSnapId(null);
      onLevelChanged?.(currentLevel);
    } else {
      showToast('删除失败', 'error');
    }
  };

  const handleConfirmRollback = () => {
    if (!rollbackConfirm || !levelId) return;
    const { snap, mode } = rollbackConfirm;

    if (mode === 'overwrite') {
      const res = rollbackToSnapshot(levelId, snap.id);
      if (res.success && res.level) {
        showToast(`已回滚到「${snap.name}」`, 'success');
        onRollback?.(res.level);
      } else {
        showToast(res.error || '回滚失败', 'error');
      }
    } else {
      const finalName = newLevelName.trim() || `${snap.name} (副本)`;
      const res = rollbackSnapshotAsNewLevel(levelId, snap.id, finalName);
      if (res.success && res.level) {
        showToast(`已另存为「${res.level.name}」`, 'success');
        onLevelChanged?.(currentLevel);
      } else {
        showToast(res.error || '另存失败', 'error');
      }
    }
    setRollbackConfirm(null);
    setNewLevelName('');
  };

  const handleExportSingle = (snap: VersionSnapshot) => {
    if (!levelId) return;
    const json = exportSingleSnapshot(levelId, snap.id);
    if (!json) {
      showToast('导出失败', 'error');
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snapshot-${snap.name.replace(/[^\w\u4e00-\u9fa5]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('已导出单版本', 'success');
  };

  const handleExportFull = () => {
    if (!levelId) return;
    const json = exportFullTimeline(levelId);
    if (!json) {
      showToast('导出失败', 'error');
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeline-${currentLevel.name.replace(/[^\w\u4e00-\u9fa5]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('已导出完整时间线', 'success');
  };

  return (
    <div className="bg-slate-800/90 backdrop-blur rounded-xl border border-slate-700 shadow-lg h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-cyan-400" />
          <h3 className="text-slate-200 font-medium">版本时间线</h3>
          {timeline && (
            <span className="text-xs text-slate-500">
              {timeline.snapshots.length} 个快照
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowNewSnapshot(true)}
            disabled={!levelId}
            className="p-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white transition-colors"
            title="新建快照"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportFull}
            disabled={!levelId || !timeline || timeline.snapshots.length === 0}
            className="p-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-slate-300 hover:text-white transition-colors"
            title="导出完整时间线"
          >
            <FileJson className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowLogs((s) => !s)}
            className={`p-1.5 rounded transition-colors ${
              showLogs ? 'bg-purple-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white'
            }`}
            title={showLogs ? '返回快照' : '查看日志'}
          >
            {showLogs ? <History className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {toast && (
        <div className={`mx-3 mt-2 px-3 py-1.5 rounded text-xs ${
          toast.type === 'success' ? 'bg-green-500/20 border border-green-500/30 text-green-300' : 'bg-red-500/20 border border-red-500/30 text-red-300'
        }`}>
          {toast.msg}
        </div>
      )}

      {showNewSnapshot && (
        <div className="mx-3 mt-2 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-cyan-300 text-sm">
            <Plus className="w-4 h-4" />
            新建快照
          </div>
          <input
            type="text"
            value={newSnapName}
            onChange={(e) => setNewSnapName(e.target.value)}
            placeholder="快照名称（可选）"
            className="w-full px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <input
            type="text"
            value={newSnapNote}
            onChange={(e) => setNewSnapNote(e.target.value)}
            placeholder="备注（可选）"
            className="w-full px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setShowNewSnapshot(false); setNewSnapName(''); setNewSnapNote(''); }}
              className="flex-1 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreateSnapshot}
              className="flex-1 px-2 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"
            >
              创建
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {!levelId && (
          <div className="text-center text-slate-500 text-sm py-8">
            保存关卡后可查看时间线
          </div>
        )}

        {levelId && !showLogs && snapshots.length === 0 && (
          <div className="text-center text-slate-500 text-sm py-8">
            暂无快照，点击顶部「+」创建
          </div>
        )}

        {levelId && !showLogs && snapshots.map((snap) => {
          const srcLabel = getSourceLabel(snap.source);
          const expanded = expandedSnapId === snap.id;
          const editing = editingSnapId === snap.id;
          const isCurrent = timeline?.currentSnapshotId === snap.id;

          return (
            <div
              key={snap.id}
              className={`rounded-lg border transition-all ${
                isCurrent ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-slate-700 bg-slate-700/30 hover:border-slate-600'
              }`}
            >
              <div
                className="p-2.5 cursor-pointer"
                onClick={() => setExpandedSnapId(expanded ? null : snap.id)}
              >
                <div className="flex items-start gap-2.5">
                  <MiniSnapshotBoard level={snap.levelData} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {editing ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 min-w-0 px-1.5 py-0.5 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-cyan-500"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm font-medium text-white truncate">
                          {snap.name}
                        </span>
                      )}
                      {isCurrent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          当前
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${srcLabel.color}`}>
                        {srcLabel.text}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                      <Clock className="w-3 h-3" />
                      {new Date(snap.createdAt).toLocaleString('zh-CN', {
                        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                      })}
                      {snap.diffFromParent && snap.diffFromParent.totalChanges > 0 && (
                        <span className="text-slate-400">
                          · {snap.diffFromParent.totalChanges} 处变更
                        </span>
                      )}
                    </div>
                    {snap.note && !editing && (
                      <div className="mt-1 text-[11px] text-slate-400 truncate">
                        <Tag className="w-3 h-3 inline mr-1" />{snap.note}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {expanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </div>
              </div>

              {expanded && (
                <div className="px-2.5 pb-2.5 space-y-2.5 border-t border-slate-700/50 pt-2.5">
                  {editing ? (
                    <div className="space-y-2">
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">快照名称</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">备注</label>
                        <input
                          type="text"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingSnapId(null); }}
                          className="flex-1 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
                        >
                          取消
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRename(snap.id); }}
                          className="flex-1 px-2 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded"
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="p-2 bg-slate-800/60 rounded border border-slate-700/50">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1.5">
                          <GitCompare className="w-3 h-3" /> 与上一版本差异
                        </div>
                        <DiffView diff={snap.diffFromParent} />
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingSnapId(snap.id); setEditName(snap.name); setEditNote(snap.note || ''); }}
                          className="px-2 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" /> 重命名
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleExportSingle(snap); }}
                          className="px-2 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center gap-1"
                        >
                          <Download className="w-3 h-3" /> 导出
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRollbackConfirm({ snap, mode: 'overwrite' }); }}
                          className="px-2 py-1.5 text-xs bg-orange-600/90 hover:bg-orange-500 text-white rounded flex items-center justify-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> 回滚
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRollbackConfirm({ snap, mode: 'new' }); setNewLevelName(`${snap.name} (副本)`); }}
                          className="px-2 py-1.5 text-xs bg-green-600/90 hover:bg-green-500 text-white rounded flex items-center justify-center gap-1"
                        >
                          <Copy className="w-3 h-3" /> 另存为
                        </button>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(snap); }}
                        className="w-full px-2 py-1.5 text-xs bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 text-red-300 rounded flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> 删除此快照
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {levelId && showLogs && (
          <div className="space-y-1.5">
            {logs.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-8">暂无操作日志</div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="p-2 rounded-lg bg-slate-700/30 border border-slate-700/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-300">
                      {getActionLabel(log.action)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(log.timestamp).toLocaleString('zh-CN', {
                        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{log.message}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {rollbackConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl border border-slate-600 shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-700 flex items-center gap-2">
              {rollbackConfirm.mode === 'overwrite' ? (
                <RotateCcw className="w-5 h-5 text-orange-400" />
              ) : (
                <Copy className="w-5 h-5 text-green-400" />
              )}
              <h3 className="text-white font-medium">
                {rollbackConfirm.mode === 'overwrite' ? '确认回滚' : '另存为新关卡'}
              </h3>
            </div>
            <div className="p-5 space-y-3.5">
              <div className="flex items-center gap-3">
                <MiniSnapshotBoard level={rollbackConfirm.snap.levelData} size={56} />
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{rollbackConfirm.snap.name}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(rollbackConfirm.snap.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>

              {rollbackConfirm.mode === 'overwrite' ? (
                <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <p className="text-xs text-orange-300">
                    ⚠ 将用此版本覆盖当前草稿内容，当前未保存的修改会丢失。编辑器的撤销/重做栈将保留。
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">新关卡名称</label>
                  <input
                    type="text"
                    value={newLevelName}
                    onChange={(e) => setNewLevelName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={() => { setRollbackConfirm(null); setNewLevelName(''); }}
                  className="flex-1 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmRollback}
                  className={`flex-1 px-3 py-2 text-sm text-white rounded-lg transition-colors ${
                    rollbackConfirm.mode === 'overwrite'
                      ? 'bg-orange-600 hover:bg-orange-500'
                      : 'bg-green-600 hover:bg-green-500'
                  }`}
                >
                  {rollbackConfirm.mode === 'overwrite' ? '确认回滚' : '创建副本'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelinePanel;
