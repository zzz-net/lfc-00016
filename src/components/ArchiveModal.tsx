import React, { useState, useRef } from 'react';
import {
  X,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  Info,
  FileWarning,
} from 'lucide-react';
import { ArchiveData } from '../game/types';
import { validateArchive, ArchiveValidationResult } from '../game/storage';

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => string | null;
  onImport: (archiveData: ArchiveData) => boolean;
}

type ImportPhase = 'idle' | 'validated' | 'success' | 'error';

export const ArchiveModal: React.FC<ArchiveModalProps> = ({
  isOpen,
  onClose,
  onExport,
  onImport,
}) => {
  const [importPhase, setImportPhase] = useState<ImportPhase>('idle');
  const [validationResult, setValidationResult] =
    useState<ArchiveValidationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [importFileText, setImportFileText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setImportPhase('idle');
    setValidationResult(null);
    setErrorMessage('');
    setSuccessMessage('');
    setImportFileText('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleExport = () => {
    const json = onExport();
    if (!json) {
      setErrorMessage('导出失败，请重试');
      return;
    }

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patrol-chess-archive-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportFileText(text);
      const result = validateArchive(text);
      setValidationResult(result);

      if (!result.valid) {
        setImportPhase('error');
        setErrorMessage(result.errors.join('；'));
      } else {
        setImportPhase('validated');
        setErrorMessage('');
      }
    };
    reader.onerror = () => {
      setImportPhase('error');
      setErrorMessage('无法读取文件');
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (!validationResult?.archiveData) return;

    const success = onImport(validationResult.archiveData);
    if (success) {
      setImportPhase('success');
      setSuccessMessage('存档包已成功导入！当前局面、所有存档和回放历史均已恢复。');
    } else {
      setImportPhase('error');
      setErrorMessage('导入失败，原有存档和当前局面未受影响。');
    }
  };

  const handleCancelImport = () => {
    resetState();
  };

  const handleRetryImport = () => {
    resetState();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl border border-slate-600 shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Download className="w-5 h-5 text-cyan-400" />
            存档包管理
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-slate-200 font-medium mb-3 flex items-center gap-2">
              <Download className="w-4 h-4 text-cyan-400" />
              导出存档包
            </h3>
            <p className="text-sm text-slate-400 mb-3">
              将当前局面、5 个手动存档、自动存档、回放日志和撤销历史一起备份为 JSON 文件。
            </p>
            <button
              onClick={handleExport}
              className="w-full px-4 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              导出存档包
            </button>
          </div>

          <div className="border-t border-slate-700 pt-6">
            <h3 className="text-slate-200 font-medium mb-3 flex items-center gap-2">
              <Upload className="w-4 h-4 text-cyan-400" />
              导入存档包
            </h3>
            <p className="text-sm text-slate-400 mb-3">
              从 JSON 文件恢复所有存档和游戏进度。导入前会检查文件完整性和冲突。
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
              disabled={importPhase === 'validated'}
              className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-slate-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              选择存档包文件
            </button>
          </div>

          {importPhase === 'error' && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <FileWarning className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 font-medium">导入失败</p>
                  <p className="text-sm text-red-400 mt-1">{errorMessage}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    原有存档和当前局面未受影响。
                  </p>
                </div>
              </div>
              <button
                onClick={handleRetryImport}
                className="mt-3 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
              >
                重新选择文件
              </button>
            </div>
          )}

          {importPhase === 'validated' && validationResult && (
            <div className="space-y-4">
              {validationResult.warnings.length > 0 && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-yellow-300 font-medium">注意事项</p>
                      {validationResult.warnings.map((w, i) => (
                        <p key={i} className="text-sm text-yellow-400 mt-1">
                          {w}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-300 space-y-1">
                    <p>
                      存档包内容：回合 {validationResult.archiveData?.currentGameState.turn}，
                      分数 {validationResult.archiveData?.currentGameState.score}，
                      撤销步数 {validationResult.archiveData?.currentHistory.length}
                    </p>
                    <p>
                      包含{' '}
                      {validationResult.archiveData?.saves.filter((s) => s !== null).length}{' '}
                      个手动存档
                      {validationResult.archiveData?.autoSave ? '和自动存档' : '（无自动存档）'}
                    </p>
                  </div>
                </div>
              </div>

              {(validationResult.hasSlotConflicts || validationResult.hasUnsavedCurrentState) && (
                <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-orange-300 font-medium">检测到冲突</p>
                      {validationResult.hasSlotConflicts && (
                        <p className="text-sm text-orange-400 mt-1">
                          以下存档槽位已有存档将被覆盖：{' '}
                          {validationResult.conflictingSlots.map((s) => `存档 ${s + 1}`).join('、')}
                        </p>
                      )}
                      {validationResult.hasUnsavedCurrentState && (
                        <p className="text-sm text-orange-400 mt-1">
                          当前游戏进度将被替换为存档包中的局面。
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-2">
                        继续导入将覆盖上述内容，取消则保留原有数据不变。
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleCancelImport}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                >
                  取消导入
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="flex-1 px-4 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  确认导入
                </button>
              </div>
            </div>
          )}

          {importPhase === 'success' && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-green-300 font-medium">导入成功</p>
                  <p className="text-sm text-green-400 mt-1">{successMessage}</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="mt-3 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors"
              >
                完成
              </button>
            </div>
          )}
        </div>

        {importPhase !== 'validated' && importPhase !== 'success' && (
          <div className="px-6 py-4 border-t border-slate-700 flex justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              关闭
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
