import React, { useEffect, useRef } from 'react';
import { ScrollText, Move, Star, AlertCircle, Settings, XCircle } from 'lucide-react';
import { LogEntry, LevelSource } from '../game/types';

interface LogPanelProps {
  logs: LogEntry[];
  isReplaying: boolean;
  levelSource?: LevelSource;
}

export const LogPanel: React.FC<LogPanelProps> = ({ logs, isReplaying, levelSource }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogIcon = (action: string) => {
    switch (action) {
      case 'move':
        return <Move className="w-4 h-4 text-blue-400" />;
      case 'capture':
        return <Star className="w-4 h-4 text-yellow-400" />;
      case 'system':
        return <Settings className="w-4 h-4 text-purple-400" />;
      case 'gameover':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'illegal':
        return <AlertCircle className="w-4 h-4 text-orange-400" />;
      default:
        return <ScrollText className="w-4 h-4 text-slate-400" />;
    }
  };

  const getLogStyle = (action: string) => {
    switch (action) {
      case 'move':
        return 'bg-blue-500/10 border-blue-500/30';
      case 'capture':
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 'system':
        return 'bg-purple-500/10 border-purple-500/30';
      case 'gameover':
        return 'bg-red-500/10 border-red-500/30';
      case 'illegal':
        return 'bg-orange-500/10 border-orange-500/30 animate-pulse';
      default:
        return 'bg-slate-500/10 border-slate-500/30';
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getSourceLabel = (source: LevelSource | undefined) => {
    switch (source) {
      case 'official':
        return { text: '官方', className: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
      case 'workshop-draft':
        return { text: '草稿', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' };
      case 'workshop-published':
        return { text: '已发布', className: 'bg-green-500/20 text-green-300 border-green-500/30' };
      default:
        return null;
    }
  };

  const getSourceHeaderLabel = (source: LevelSource | undefined) => {
    switch (source) {
      case 'official':
        return { text: '官方局', className: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
      case 'workshop-draft':
        return { text: '草稿局', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' };
      case 'workshop-published':
        return { text: '已发布局', className: 'bg-green-500/20 text-green-300 border-green-500/30' };
      default:
        return null;
    }
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur rounded-xl border border-slate-700 shadow-lg flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
        <ScrollText className="w-5 h-5 text-cyan-400" />
        <h3 className="text-slate-200 font-medium">操作日志</h3>
        <div className="flex-1 flex items-center gap-2">
          {(() => {
            const label = getSourceHeaderLabel(levelSource);
            return label ? (
              <span className={`text-xs px-2 py-0.5 rounded border ${label.className}`}>
                {label.text}
              </span>
            ) : null;
          })()}
        </div>
        {isReplaying && (
          <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded">
            回放模式
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[300px]"
      >
        {logs.length === 0 ? (
          <div className="text-slate-500 text-sm text-center py-8">
            暂无操作记录
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              className={`
                p-2 rounded-lg border text-sm
                ${getLogStyle(log.action)}
                transition-all duration-200
              `}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5">{getLogIcon(log.action)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-500 font-mono">
                      回合 {log.turn}
                    </span>
                    <span className="text-xs text-slate-600">
                      {formatTime(log.timestamp)}
                    </span>
                    {log.levelSource && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded border ${
                          getSourceLabel(log.levelSource)?.className || ''
                        }`}
                        title={log.levelName || ''}
                      >
                        {getSourceLabel(log.levelSource)?.text || ''}
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-1 ${
                      log.action === 'illegal'
                        ? 'text-orange-300'
                        : log.action === 'gameover'
                          ? 'text-red-300'
                          : log.action === 'capture'
                            ? 'text-yellow-300'
                            : 'text-slate-300'
                    }`}
                  >
                    {log.message}
                  </p>
                  {log.scoreChange !== undefined && log.scoreChange !== 0 && (
                    <span
                      className={`text-xs font-mono ${
                        log.scoreChange > 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {log.scoreChange > 0 ? '+' : ''}
                      {log.scoreChange} 分
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
