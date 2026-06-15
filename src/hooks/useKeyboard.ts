import { useEffect } from 'react';
import { Direction } from '../game/types';

interface UseKeyboardProps {
  onMove: (direction: Direction) => void;
  onUndo: () => void;
  onNewGame: () => void;
  disabled?: boolean;
}

export const useKeyboard = ({
  onMove,
  onUndo,
  onNewGame,
  disabled = false,
}: UseKeyboardProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          onMove('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          onMove('down');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          onMove('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          onMove('right');
          break;
        case 'z':
        case 'Z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onUndo();
          }
          break;
        case 'n':
        case 'N':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onNewGame();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onMove, onUndo, onNewGame, disabled]);
};
