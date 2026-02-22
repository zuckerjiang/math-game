/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  RotateCcw, 
  Play, 
  Pause, 
  Timer, 
  Zap, 
  ChevronRight,
  AlertTriangle,
  Info
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { 
  GRID_ROWS, 
  GRID_COLS, 
  INITIAL_ROWS, 
  TARGET_MIN, 
  TARGET_MAX, 
  TIME_MODE_SECONDS, 
  SCORE_PER_BLOCK,
  SCORE_BONUS_COMBO
} from './constants';
import { BlockData, Grid, GameMode, GameState } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const createEmptyGrid = (): Grid => 
  Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));

const generateRandomBlock = (): BlockData => ({
  id: generateId(),
  value: Math.floor(Math.random() * 9) + 1,
});

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    grid: createEmptyGrid(),
    targetSum: 0,
    selectedIndices: [],
    score: 0,
    level: 1,
    gameOver: false,
    mode: 'classic',
    timeLeft: TIME_MODE_SECONDS,
    isPaused: true,
  });

  const [showMenu, setShowMenu] = useState(true);
  const [lastClearedCount, setLastClearedCount] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const generateTarget = useCallback(() => {
    return Math.floor(Math.random() * (TARGET_MAX - TARGET_MIN + 1)) + TARGET_MIN;
  }, []);

  // Helper to generate a new row
  const getNextRowGrid = (currentGrid: Grid): { grid: Grid; gameOver: boolean } => {
    if (currentGrid[0].some(cell => cell !== null)) {
      return { grid: currentGrid, gameOver: true };
    }
    const newGrid = [...currentGrid.map(row => [...row])];
    for (let r = 0; r < GRID_ROWS - 1; r++) {
      newGrid[r] = newGrid[r + 1];
    }
    newGrid[GRID_ROWS - 1] = Array.from({ length: GRID_COLS }, () => generateRandomBlock());
    return { grid: newGrid, gameOver: false };
  };

  const addNewRow = useCallback(() => {
    setGameState(prev => {
      const { grid, gameOver } = getNextRowGrid(prev.grid);
      return { 
        ...prev, 
        grid, 
        gameOver, 
        isPaused: gameOver ? true : prev.isPaused,
        timeLeft: TIME_MODE_SECONDS 
      };
    });
  }, []);

  const initGame = (mode: GameMode) => {
    const emptyGrid = createEmptyGrid();
    // Fill bottom rows
    for (let r = GRID_ROWS - INITIAL_ROWS; r < GRID_ROWS; r++) {
      emptyGrid[r] = Array.from({ length: GRID_COLS }, () => generateRandomBlock());
    }

    setGameState({
      grid: emptyGrid,
      targetSum: Math.floor(Math.random() * (TARGET_MAX - TARGET_MIN + 1)) + TARGET_MIN,
      selectedIndices: [],
      score: 0,
      level: 1,
      gameOver: false,
      mode,
      timeLeft: TIME_MODE_SECONDS,
      isPaused: false,
    });
    setShowMenu(false);
  };

  const handleBlockClick = (r: number, c: number) => {
    if (gameState.gameOver || gameState.isPaused) return;

    const block = gameState.grid[r][c];
    if (!block) return;

    setGameState(prev => {
      const isSelected = prev.selectedIndices.some(idx => idx.r === r && idx.c === c);
      let newSelected = [...prev.selectedIndices];

      if (isSelected) {
        newSelected = newSelected.filter(idx => !(idx.r === r && idx.c === c));
      } else {
        newSelected.push({ r, c });
      }

      const currentSum = newSelected.reduce((sum, idx) => sum + (prev.grid[idx.r][idx.c]?.value || 0), 0);

      if (currentSum === prev.targetSum) {
        // Success! Clear blocks
        let newGrid = [...prev.grid.map(row => [...row])];
        newSelected.forEach(idx => {
          newGrid[idx.r][idx.c] = null;
        });

        // Apply gravity
        for (let col = 0; col < GRID_COLS; col++) {
          const columnBlocks = [];
          for (let row = 0; row < GRID_ROWS; row++) {
            if (newGrid[row][col]) columnBlocks.push(newGrid[row][col]);
          }
          for (let row = GRID_ROWS - 1; row >= 0; row--) {
            newGrid[row][col] = columnBlocks.pop() || null;
          }
        }

        const bonus = newSelected.length > 3 ? SCORE_BONUS_COMBO : 0;
        const points = (newSelected.length * SCORE_PER_BLOCK) + bonus;
        
        // If classic mode, add a row immediately after gravity
        let gameOver = prev.gameOver;
        if (prev.mode === 'classic') {
          const result = getNextRowGrid(newGrid);
          newGrid = result.grid;
          gameOver = result.gameOver;
        }

        return {
          ...prev,
          grid: newGrid,
          selectedIndices: [],
          targetSum: generateTarget(),
          score: prev.score + points,
          level: Math.floor((prev.score + points) / 500) + 1,
          timeLeft: TIME_MODE_SECONDS,
          gameOver,
          isPaused: gameOver ? true : prev.isPaused
        };
      } else if (currentSum > prev.targetSum) {
        return { ...prev, selectedIndices: [] };
      }

      return { ...prev, selectedIndices: newSelected };
    });
  };

  // Timer logic for Time Mode
  useEffect(() => {
    if (gameState.mode === 'time' && !gameState.isPaused && !gameState.gameOver) {
      timerRef.current = setInterval(() => {
        setGameState(prev => {
          if (prev.timeLeft <= 1) {
            const { grid, gameOver } = getNextRowGrid(prev.grid);
            return { 
              ...prev, 
              grid, 
              gameOver, 
              isPaused: gameOver ? true : prev.isPaused,
              timeLeft: TIME_MODE_SECONDS 
            };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState.mode, gameState.isPaused, gameState.gameOver]);

  const currentSum = gameState.selectedIndices.reduce(
    (sum, idx) => sum + (gameState.grid[idx.r][idx.c]?.value || 0), 
    0
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-start md:justify-center p-4 md:p-8 bg-game-bg select-none">
      {/* Background Decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-game-accent rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-game-danger rounded-full blur-[120px]" />
      </div>

      {showMenu ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-8 rounded-3xl max-w-md w-full text-center z-10"
        >
          <div className="mb-8">
            <div className="w-20 h-20 bg-game-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-game-accent/30">
              <Zap className="w-10 h-10 text-game-accent" />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tighter text-white mb-2">数字堆叠</h1>
            <p className="text-slate-400 text-sm">组合数字以达到目标和。不要让方块堆积到顶部！</p>
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => initGame('classic')}
              className="w-full group relative flex items-center justify-between p-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all"
            >
              <div className="text-left">
                <div className="font-bold text-white flex items-center gap-2">
                  经典模式
                  <span className="text-[10px] px-1.5 py-0.5 bg-game-accent/20 text-game-accent rounded border border-game-accent/30">无尽</span>
                </div>
                <div className="text-xs text-slate-500">每次消除后新增一行</div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
            </button>

            <button 
              onClick={() => initGame('time')}
              className="w-full group relative flex items-center justify-between p-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all"
            >
              <div className="text-left">
                <div className="font-bold text-white flex items-center gap-2">
                  计时模式
                  <span className="text-[10px] px-1.5 py-0.5 bg-game-danger/20 text-game-danger rounded border border-game-danger/30">紧张</span>
                </div>
                <div className="text-xs text-slate-500">每 {TIME_MODE_SECONDS} 秒新增一行</div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center gap-6 text-slate-500 text-xs">
            <div className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              <span>点击选择</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>求和 = 目标</span>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-6 items-center lg:items-start justify-center z-10 py-12">
          
          {/* Left Panel: Stats & Controls */}
          <div className="w-full lg:w-64 flex lg:flex-col gap-3 lg:gap-4 order-2 lg:order-1">
            <div className="flex-1 glass-panel p-4 lg:p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-1 lg:mb-4">
                <span className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-widest">得分</span>
                <Trophy className="w-3 h-3 lg:w-4 lg:h-4 text-game-warning" />
              </div>
              <div className="text-xl lg:text-3xl font-mono font-bold text-white tabular-nums">
                {gameState.score.toLocaleString()}
              </div>
            </div>

            <div className="flex-1 glass-panel p-4 lg:p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-1 lg:mb-4">
                <span className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-widest">模式</span>
                {gameState.mode === 'time' ? <Timer className="w-3 h-3 lg:w-4 lg:h-4 text-game-danger" /> : <Zap className="w-3 h-3 lg:w-4 lg:h-4 text-game-accent" />}
              </div>
              <div className="text-sm lg:text-xl font-bold text-white capitalize">
                {gameState.mode === 'classic' ? '经典' : '计时'}
              </div>
            </div>

            <div className="flex gap-2 lg:flex-col">
              <button 
                onClick={() => setGameState(p => ({ ...p, isPaused: !p.isPaused }))}
                className="flex-1 glass-panel p-3 lg:p-4 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2 font-bold text-xs lg:text-sm"
              >
                {gameState.isPaused ? <Play className="w-3 h-3 lg:w-4 lg:h-4" /> : <Pause className="w-3 h-3 lg:w-4 lg:h-4" />}
                <span className="hidden sm:inline">{gameState.isPaused ? "继续" : "暂停"}</span>
              </button>
              <button 
                onClick={() => setShowMenu(true)}
                className="glass-panel p-3 lg:p-4 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center"
              >
                <RotateCcw className="w-3 h-3 lg:w-4 lg:h-4" />
              </button>
            </div>
          </div>

          {/* Center: Game Board */}
          <div className="relative order-1 lg:order-2">
            {/* Target Display */}
            <div className="absolute -top-14 left-0 right-0 flex items-center justify-center gap-4">
              <div className="glass-panel px-4 py-2 rounded-xl flex items-center gap-4 border-game-accent/30">
                <div className="text-center">
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">目标</div>
                  <div className="text-2xl font-mono font-black text-game-accent leading-none">{gameState.targetSum}</div>
                </div>
                <div className="h-6 w-px bg-white/10" />
                <div className="text-center">
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">当前</div>
                  <div className={cn(
                    "text-2xl font-mono font-black transition-colors leading-none",
                    currentSum > gameState.targetSum ? "text-game-danger" : 
                    currentSum === gameState.targetSum ? "text-game-success" : "text-white"
                  )}>
                    {currentSum}
                  </div>
                </div>
              </div>
            </div>

            {/* Grid */}
            <div className="glass-panel p-2 rounded-2xl border-2 border-white/5 bg-black/40">
              <div 
                className="grid gap-1.5"
                style={{ 
                  gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
                  width: 'min(85vw, 340px)',
                }}
              >
                {gameState.grid.map((row, r) => (
                  row.map((block, c) => {
                    const isSelected = gameState.selectedIndices.some(idx => idx.r === r && idx.c === c);
                    const isDangerRow = r === 0 && block !== null;

                    return (
                      <motion.div 
                        key={block ? block.id : `empty-${r}-${c}`}
                        layout
                        initial={block ? { scale: 0, opacity: 0 } : false}
                        animate={block ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        onClick={() => handleBlockClick(r, c)}
                        className={cn(
                          "relative aspect-square rounded-xl flex items-center justify-center text-2xl font-mono font-black transition-all cursor-pointer",
                          block 
                            ? "bg-white/10 border-2 border-white/10 text-white hover:bg-white/20 hover:scale-105 active:scale-95" 
                            : "bg-white/5 border border-white/5 pointer-events-none",
                          isSelected && "bg-game-accent border-game-accent text-game-bg shadow-[0_0_20px_rgba(122,162,247,0.5)] scale-110 z-10",
                          isDangerRow && "animate-danger border-game-danger bg-game-danger/20"
                        )}
                      >
                        {block && (
                          <span className="drop-shadow-md">
                            {block.value}
                          </span>
                        )}
                      </motion.div>
                    );
                  })
                ))}
              </div>
            </div>

            {/* Overlays */}
            <AnimatePresence>
              {gameState.isPaused && !gameState.gameOver && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex items-center justify-center bg-game-bg/60 backdrop-blur-sm rounded-2xl"
                >
                  <button 
                    onClick={() => setGameState(p => ({ ...p, isPaused: false }))}
                    className="w-20 h-20 bg-game-accent rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
                  >
                    <Play className="w-10 h-10 text-white fill-current" />
                  </button>
                </motion.div>
              )}

              {gameState.gameOver && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 z-30 flex items-center justify-center bg-game-bg/90 backdrop-blur-md rounded-2xl p-8 text-center"
                >
                  <div className="space-y-6">
                    <div className="w-16 h-16 bg-game-danger/20 rounded-2xl flex items-center justify-center mx-auto border border-game-danger/30">
                      <AlertTriangle className="w-8 h-8 text-game-danger" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-white mb-2">游戏结束</h2>
                      <p className="text-slate-400 text-sm">方块堆积到了顶部！</p>
                    </div>
                    <div className="py-4 border-y border-white/5">
                      <div className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">最终得分</div>
                      <div className="text-4xl font-mono font-bold text-game-warning">{gameState.score}</div>
                    </div>
                    <button 
                      onClick={() => initGame(gameState.mode)}
                      className="w-full py-4 bg-game-accent hover:bg-game-accent/90 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-5 h-5" />
                      再试一次
                    </button>
                    <button 
                      onClick={() => setShowMenu(true)}
                      className="w-full py-4 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl transition-colors"
                    >
                      返回主菜单
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Panel: How to Play (Desktop) */}
          <div className="hidden lg:block w-64 space-y-4">
            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">游戏玩法</h3>
              <ul className="space-y-4 text-sm text-slate-400">
                <li className="flex gap-3">
                  <div className="w-5 h-5 rounded bg-game-accent/20 flex items-center justify-center text-[10px] font-bold text-game-accent shrink-0 mt-0.5">1</div>
                  <p>选择数字，使其总和等于 <span className="text-game-accent font-bold">目标数字</span>。</p>
                </li>
                <li className="flex gap-3">
                  <div className="w-5 h-5 rounded bg-game-accent/20 flex items-center justify-center text-[10px] font-bold text-game-accent shrink-0 mt-0.5">2</div>
                  <p>消除方块，防止堆栈触及 <span className="text-game-danger font-bold">顶部</span>。</p>
                </li>
                <li className="flex gap-3">
                  <div className="w-5 h-5 rounded bg-game-accent/20 flex items-center justify-center text-[10px] font-bold text-game-accent shrink-0 mt-0.5">3</div>
                  <p>一次消除 4 个以上方块可获得 <span className="text-game-warning font-bold">连击奖励</span>！</p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="fixed bottom-4 left-0 right-0 text-center text-[10px] text-slate-600 font-mono uppercase tracking-[0.2em] pointer-events-none">
        数字堆叠 引擎 v1.0 // 东京之夜 主题
      </div>
    </div>
  );
}
