import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Board } from '../components/Board';
import { StatusBar } from '../components/StatusBar';
import { ControlPanel } from '../components/ControlPanel';
import { LogPanel } from '../components/LogPanel';
import { SaveModal } from '../components/SaveModal';
import { ReplayControls } from '../components/ReplayControls';
import { useGameStore } from '../hooks/useGameState';
import { useKeyboard } from '../hooks/useKeyboard';
import { Direction } from '../game/types';

const Home: React.FC = () => {
  const {
    gameState,
    history,
    isReplaying,
    replayIndex,
    lastIllegalMessage,
    initGame,
    move,
    undo,
    saveToSlot,
    loadFromSlot,
    startReplay,
    nextReplayStep,
    prevReplayStep,
    endReplay,
    jumpToReplayTurn,
    clearIllegalMessage,
  } = useGameStore();

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveModalMode, setSaveModalMode] = useState<'save' | 'load'>('save');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }, []);

  useEffect(() => {
    if (lastIllegalMessage) {
      showNotification(lastIllegalMessage, 'error');
      const timer = setTimeout(() => {
        clearIllegalMessage();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [lastIllegalMessage, showNotification, clearIllegalMessage]);

  const handleMove = useCallback(
    (direction: Direction) => {
      move(direction);
    },
    [move]
  );

  const handleUndo = useCallback(() => {
    if (history.length > 0) {
      undo();
      showNotification('已撤销上一回合', 'success');
    }
  }, [undo, history.length, showNotification]);

  const handleNewGame = useCallback(() => {
    if (gameState.turn > 1 && !gameState.isGameOver) {
      if (!window.confirm('确定要开始新游戏吗？当前进度将丢失。')) {
        return;
      }
    }
    initGame();
    showNotification('新游戏已开始', 'success');
  }, [initGame, gameState.turn, gameState.isGameOver, showNotification]);

  const handleOpenSaveModal = useCallback(() => {
    setSaveModalMode('save');
    setShowSaveModal(true);
  }, []);

  const handleOpenLoadModal = useCallback(() => {
    setSaveModalMode('load');
    setShowSaveModal(true);
  }, []);

  const handleSave = useCallback(
    (slot: number, name: string) => {
      const success = saveToSlot(slot, name);
      if (success) {
        showNotification(`存档成功：${name}`, 'success');
        setShowSaveModal(false);
      } else {
        showNotification('存档失败', 'error');
      }
    },
    [saveToSlot, showNotification]
  );

  const handleLoad = useCallback(
    (slot: number) => {
      const success = loadFromSlot(slot);
      if (success) {
        showNotification('读取存档成功', 'success');
      } else {
        showNotification('读取存档失败', 'error');
      }
    },
    [loadFromSlot, showNotification]
  );

  const handleReplay = useCallback(() => {
    if (history.length > 0) {
      startReplay();
    }
  }, [startReplay, history.length]);

  useKeyboard({
    onMove: handleMove,
    onUndo: handleUndo,
    onNewGame: handleNewGame,
    disabled: isReplaying || gameState.isGameOver,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMDJiMzciIGZpbGwtb3BhY2l0eT0iMC40Ij48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnY0em0tOCAwaC0ydi00aDJ2NHptLTggMGgtMnYtNGgydjR6bTE2LTZoLTJ2LTRoMnY0em0tOCAwaC0ydi00aDJ2NHptLTggMGgtMnYtNGgydjR6bTE2LTZoLTJ2LTRoMnY0em0tOCAwaC0ydi00aDJ2NHptLTggMGgtMnYtNGgydjR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-6 max-w-7xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
            巡逻棋 Patrol Chess
          </h1>
          <p className="text-slate-400">
            规划巡逻路径，捕获事件点，避开危险！
          </p>
        </header>

        <StatusBar
          gameState={gameState}
          isReplaying={isReplaying}
          replayIndex={replayIndex}
        />

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="flex flex-col items-center">
            <div className="w-full max-w-[500px]">
              <Board
                gameState={gameState}
                onMove={handleMove}
                disabled={isReplaying}
              />
            </div>

            <div className="mt-10 w-full max-w-[500px]">
              <LogPanel logs={gameState.logs} isReplaying={isReplaying} />
            </div>
          </div>

          <div>
            <ControlPanel
              onMove={handleMove}
              onUndo={handleUndo}
              onNewGame={handleNewGame}
              onSave={handleOpenSaveModal}
              onLoad={handleOpenLoadModal}
              onReplay={handleReplay}
              canUndo={history.length > 0}
              disabled={isReplaying || gameState.isGameOver}
              isReplaying={isReplaying}
            />
          </div>
        </div>

        <footer className="mt-8 text-center text-slate-500 text-sm">
          <p>快捷键：WASD/方向键移动 | Ctrl+Z 撤销 | Ctrl+N 新游戏</p>
        </footer>
      </div>

      <SaveModal
        isOpen={showSaveModal}
        mode={saveModalMode}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSave}
        onLoad={handleLoad}
      />

      <ReplayControls
        isReplaying={isReplaying}
        currentTurn={replayIndex + 1}
        totalTurns={history.length}
        onPrev={prevReplayStep}
        onNext={nextReplayStep}
        onExit={endReplay}
        onJumpToTurn={jumpToReplayTurn}
      />

      {showToast && (
        <div
          className={`
            fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg
            animate-slide-in
            ${toastType === 'error'
              ? 'bg-red-600 border border-red-500'
              : 'bg-cyan-600 border border-cyan-500'
            }
          `}
        >
          {toastType === 'error' && <AlertTriangle className="w-5 h-5 text-white" />}
          <span className="text-white font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default Home;
