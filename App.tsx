
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GameView, GameState, GridCell, BlockShape, RankEntry } from './types';
import { GRID_SIZE, INITIAL_MOVES, INITIAL_TARGET, getRandomBlock, MOCK_NAMES } from './constants';
import { soundService } from './services/SoundService';
import { voiceService } from './services/VoiceService';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings as SettingsIcon, 
  RotateCcw, 
  Trophy, 
  X,
  Volume2,
  VolumeX,
  Columns,
  Music,
  ChevronRight,
  Medal,
  Info,
  Layers,
  Maximize,
  Target,
  CheckCircle2,
  ArrowRight,
  Coins,
  Shuffle,
  Star,
  Activity,
  History,
  Scan,
  Download,
  Smartphone
} from 'lucide-react';

const createEmptyGrid = (): GridCell[][] => 
  Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null).map(() => ({ color: null })));

const App: React.FC = () => {
  // Persistence
  const [highScore, setHighScore] = useState<number>(() => Number(localStorage.getItem('blockora_highscore') || 0));
  const [highestLevel, setHighestLevel] = useState<number>(() => Number(localStorage.getItem('blockora_highlevel') || 1));
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => localStorage.getItem('blockora_sound') !== 'false');
  const [musicEnabled, setMusicEnabled] = useState<boolean>(() => localStorage.getItem('blockora_music') !== 'false');

  // Session Stats
  const [sessionMaxLevel, setSessionMaxLevel] = useState<number>(1);

  // View & UI
  const [view, setView] = useState<GameView>(GameView.START);
  const [showSettings, setShowSettings] = useState(false);
  const [showDownloadInfo, setShowDownloadInfo] = useState(false);
  const [claimedRewards, setClaimedRewards] = useState<string[]>([]);

  // Game Logic
  const [gameState, setGameState] = useState<GameState>(() => ({
    level: 1,
    score: 0,
    targetScore: INITIAL_TARGET,
    movesRemaining: INITIAL_MOVES,
    totalMoves: INITIAL_MOVES,
    coins: 100,
    grid: createEmptyGrid(),
    blockPool: [getRandomBlock(), getRandomBlock(), getRandomBlock()],
    powerups: { bomb: 0, lineClear: 0, shuffle: 2 }
  }));

  // Dragging State (Performance optimized)
  const [draggingBlockIndex, setDraggingBlockIndex] = useState<number | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragVisualRef = useRef<HTMLDivElement>(null);
  const [snapPreview, setSnapPreview] = useState<{ r: number, c: number } | null>(null);
  const [dragPos, setDragPos] = useState({ x: -1000, y: -1000 });
  
  const gridRef = useRef<HTMLDivElement>(null);

  // Sound & Voice sync
  useEffect(() => {
    soundService.setEnabled(soundEnabled);
    localStorage.setItem('blockora_sound', soundEnabled.toString());
  }, [soundEnabled]);

  useEffect(() => {
    soundService.setMusicEnabled(musicEnabled);
    localStorage.setItem('blockora_music', musicEnabled.toString());
  }, [musicEnabled]);

  // Ranking generation
  const rankings = useMemo(() => {
    const list: RankEntry[] = MOCK_NAMES.map((name, i) => ({
      rank: i + 1,
      name,
      level: Math.max(1, 50 - i + Math.floor(Math.random() * 5)),
      score: Math.max(0, (50 - i) * 1000 + Math.floor(Math.random() * 500))
    }));
    
    list.push({
      rank: 0,
      name: "You (Guest)",
      level: highestLevel,
      score: highScore,
      isPlayer: true
    });

    return list.sort((a, b) => b.score - a.score).slice(0, 100).map((r, i) => ({ ...r, rank: i + 1 }));
  }, [highScore, highestLevel]);

  // Infinite Level Logic
  const startNextLevel = useCallback(() => {
    soundService.playClick();
    setClaimedRewards([]);
    setGameState(prev => {
      const nextLvl = prev.level + 1;
      const nextTarget = Math.floor(INITIAL_TARGET * Math.pow(1.3, nextLvl - 1));
      const nextMoves = Math.max(15, INITIAL_MOVES - Math.floor(nextLvl / 4));
      
      if (nextLvl > sessionMaxLevel) setSessionMaxLevel(nextLvl);
      
      return {
        ...prev,
        level: nextLvl,
        grid: createEmptyGrid(),
        movesRemaining: nextMoves,
        totalMoves: nextMoves,
        targetScore: nextTarget,
        blockPool: [getRandomBlock(), getRandomBlock(), getRandomBlock()]
      };
    });
    voiceService.speak(`Mission level ${gameState.level + 1} initiated.`);
    setView(GameView.PLAYING);
  }, [sessionMaxLevel, gameState.level]);

  const retryCurrentLevel = useCallback(() => {
    soundService.playClick();
    setGameState(prev => ({
      ...prev,
      score: 0,
      movesRemaining: Math.max(15, INITIAL_MOVES - Math.floor(prev.level / 4)),
      grid: createEmptyGrid(),
      blockPool: [getRandomBlock(), getRandomBlock(), getRandomBlock()]
    }));
    voiceService.speak("System reset. Let's try again.");
    setView(GameView.PLAYING);
  }, []);

  const terminateMission = useCallback(() => {
    soundService.playClick();
    setGameState({
      level: 1,
      score: 0,
      targetScore: INITIAL_TARGET,
      movesRemaining: INITIAL_MOVES,
      totalMoves: INITIAL_MOVES,
      coins: 100,
      grid: createEmptyGrid(),
      blockPool: [getRandomBlock(), getRandomBlock(), getRandomBlock()],
      powerups: { bomb: 0, lineClear: 0, shuffle: 2 }
    });
    setSessionMaxLevel(1);
    setClaimedRewards([]);
    setShowSettings(false);
    setView(GameView.START);
  }, []);

  const checkPlacement = useCallback((grid: GridCell[][], shape: number[][], r: number, c: number): boolean => {
    for (let i = 0; i < shape.length; i++) {
      for (let j = 0; j < shape[i].length; j++) {
        if (shape[i][j] === 1) {
          const nr = r + i;
          const nc = c + j;
          if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE || grid[nr][nc].color !== null) {
            return false;
          }
        }
      }
    }
    return true;
  }, []);

  const handlePointerDown = (e: React.PointerEvent, index: number) => {
    if (view !== GameView.PLAYING) return;
    setDraggingBlockIndex(index);
    soundService.playPickUp();
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isTouch = e.pointerType === 'touch';
    
    dragOffsetRef.current = {
      x: rect.width / 2,
      y: isTouch ? rect.height * 1.6 : rect.height / 2
    };

    setDragPos({ x: e.clientX, y: e.clientY });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingBlockIndex === null) return;
    
    setDragPos({ x: e.clientX, y: e.clientY });

    if (!gridRef.current) return;
    const gridRect = gridRef.current.getBoundingClientRect();
    const cellSize = gridRect.width / GRID_SIZE;
    const block = gameState.blockPool[draggingBlockIndex];
    const logicalX = e.clientX - dragOffsetRef.current.x;
    const logicalY = e.clientY - dragOffsetRef.current.y;
    
    const gridCol = Math.round((logicalX - gridRect.left) / cellSize);
    const gridRow = Math.round((logicalY - gridRect.top) / cellSize);

    if (checkPlacement(gameState.grid, block.shape, gridRow, gridCol)) {
      if (!snapPreview || snapPreview.r !== gridRow || snapPreview.c !== gridCol) {
        setSnapPreview({ r: gridRow, c: gridCol });
      }
    } else {
      if (snapPreview) setSnapPreview(null);
    }
  };

  const handlePointerUp = () => {
    if (draggingBlockIndex === null) return;
    
    soundService.playPlace();
    
    if (snapPreview) {
      const { r, c } = snapPreview;
      const block = gameState.blockPool[draggingBlockIndex];
      
      const newGrid = gameState.grid.map(row => row.map(cell => ({ ...cell })));
      for (let i = 0; i < block.shape.length; i++) {
        for (let j = 0; j < block.shape[i].length; j++) {
          if (block.shape[i][j] === 1) {
            newGrid[r + i][c + j].color = block.color;
          }
        }
      }

      let rowsToClear: number[] = [];
      let colsToClear: number[] = [];
      for (let i = 0; i < GRID_SIZE; i++) {
        if (newGrid[i].every(cell => cell.color !== null)) rowsToClear.push(i);
        if (newGrid.every(row => row[i].color !== null)) colsToClear.push(i);
      }

      let pointsEarned = block.shape.flat().filter(x => x === 1).length * 10;
      const linesCount = rowsToClear.length + colsToClear.length;
      if (linesCount > 0) {
        soundService.playClear();
        pointsEarned += linesCount * 150 * linesCount;
        rowsToClear.forEach(rowIdx => newGrid[rowIdx] = Array(GRID_SIZE).fill(null).map(() => ({ color: null })));
        colsToClear.forEach(colIdx => newGrid.forEach(row => row[colIdx] = { color: null }));
      }

      const newPool = [...gameState.blockPool];
      newPool[draggingBlockIndex] = getRandomBlock();
      const nextScore = gameState.score + pointsEarned;
      const nextMoves = gameState.movesRemaining - 1;

      if (nextScore > highScore) setHighScore(nextScore);
      if (gameState.level > highestLevel) setHighestLevel(gameState.level);

      setGameState(prev => ({
        ...prev,
        grid: newGrid,
        score: nextScore,
        movesRemaining: nextMoves,
        blockPool: newPool
      }));

      if (nextScore >= gameState.targetScore) {
        soundService.playSuccess();
        voiceService.speak("Mission objective achieved.");
        setView(GameView.LEVEL_COMPLETE);
      } else if (nextMoves <= 0) {
        soundService.playFail();
        voiceService.speak("System failure. Moves depleted.");
        setView(GameView.OUT_OF_MOVES);
      }
    }

    setDraggingBlockIndex(null);
    setSnapPreview(null);
    setDragPos({ x: -1000, y: -1000 });
  };

  const collectReward = (type: string, amount: number) => {
    if (claimedRewards.includes(type)) return;
    soundService.playSuccess();
    setClaimedRewards(prev => [...prev, type]);
    if (type === 'coins') setGameState(prev => ({ ...prev, coins: prev.coins + amount }));
  };

  const handleShuffle = () => {
    if (gameState.coins < 50) return;
    soundService.playClick();
    voiceService.speak("Refreshing pieces.");
    setGameState(prev => ({
      ...prev,
      coins: prev.coins - 50,
      blockPool: [getRandomBlock(), getRandomBlock(), getRandomBlock()]
    }));
  };

  return (
    <div className="fixed inset-0 bg-[#020617] text-slate-100 flex items-center justify-center p-0 sm:p-4 font-sans selection:bg-indigo-500/30 overflow-hidden select-none">
      
      {/* Immersive Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <motion.div 
          animate={{ opacity: [0.1, 0.2, 0.1], scale: [1, 1.05, 1] }} 
          transition={{ duration: 15, repeat: Infinity }}
          className="absolute inset-0 bg-gradient-to-tr from-indigo-900/40 via-transparent to-blue-900/40"
        />
      </div>

      <div className="relative z-10 w-full max-w-[480px] h-[100dvh] sm:h-[90dvh] bg-slate-900/50 backdrop-blur-3xl sm:rounded-[3rem] overflow-hidden shadow-2xl border-x border-white/5 flex flex-col">
        
        {/* Persistent Stats Bar */}
        {view === GameView.PLAYING && (
          <div className="p-4 sm:p-5 pb-2 space-y-3 sm:space-y-4 shrink-0">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shadow-inner group">
                  <Star className="w-5 h-5 text-amber-400 group-hover:scale-125 transition-transform" />
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.4em] text-slate-500 font-black">SECTOR LEVEL {gameState.level}</p>
                  <p className="text-xl sm:text-2xl font-black text-white">{gameState.score.toLocaleString()}</p>
                </div>
              </div>
              <button onClick={() => { soundService.playClick(); setShowSettings(true); }} className="p-2.5 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/20 active:scale-90 transition-all text-slate-400">
                <SettingsIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            
            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex justify-between text-[9px] uppercase font-black tracking-widest px-1">
                <span className="text-slate-500 flex items-center"><Target className="w-3.5 h-3.5 mr-1.5"/> GOAL: {gameState.targetScore}</span>
                <span className="text-indigo-400">{Math.min(100, Math.floor((gameState.score / gameState.targetScore) * 100))}%</span>
              </div>
              <div className="h-3 w-full bg-slate-950/80 rounded-full overflow-hidden border border-white/5 p-[1.5px]">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (gameState.score / gameState.targetScore) * 100)}%` }}
                  className="h-full bg-gradient-to-r from-indigo-600 via-blue-500 to-cyan-400 bg-[length:200%_100%] animate-[gradient_3s_linear_infinite] rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" 
                />
              </div>
            </div>

            <div className="flex justify-between items-center px-1">
              <div className="px-3 py-1.5 sm:px-4 sm:py-2 bg-indigo-500/10 rounded-xl border border-indigo-500/30 flex items-center space-x-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="text-[9px] sm:text-[11px] font-black text-cyan-400 uppercase tracking-widest">{gameState.movesRemaining} CYCLES</span>
              </div>
              <div className="flex items-center space-x-2 text-amber-400 bg-amber-400/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-amber-400/30">
                <Coins className="w-4 h-4" />
                <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-widest">{gameState.coins}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col relative overflow-hidden">
        <AnimatePresence mode="wait">
          {view === GameView.START && (
            <motion.div 
              key="start"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center p-8 space-y-12 text-center"
            >
              <div className="relative">
                <motion.div 
                  animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-20 opacity-40 blur-[90px] bg-indigo-600 rounded-full"
                />
                
                <div className="relative p-12 sm:p-14 bg-white/5 rounded-[4rem] sm:rounded-[5rem] border border-white/10 shadow-2xl overflow-hidden backdrop-blur-2xl">
                  <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-blue-400/50 rounded-tl-3xl m-3" />
                  <div className="relative flex flex-col items-center justify-center z-10">
                    <div className="text-6xl sm:text-7xl font-black italic text-white tracking-tighter leading-none mb-3 drop-shadow-[0_0_20px_rgba(59,130,246,0.8)]">VAR</div>
                    <div className="w-24 sm:w-32 h-1.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent mb-8 opacity-90" />
                    <Layers className="w-16 h-16 sm:w-20 sm:h-20 text-blue-400/80" />
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h1 className="text-6xl sm:text-7xl font-black tracking-tighter text-white italic drop-shadow-[0_0_30px_rgba(255,255,255,0.4)] leading-none">BLOCKORA</h1>
                <h2 className="text-2xl sm:text-3xl font-light tracking-[0.8em] text-blue-400 uppercase opacity-90">INFINITY</h2>
              </div>

              <div className="w-full space-y-5 px-4 max-sm-xs">
                <button 
                  onClick={() => { 
                    soundService.playClick(); 
                    voiceService.speak("Welcome to Blackora Infinity. I am your guide, ready for deployment."); 
                    setView(GameView.PLAYING); 
                  }}
                  className="w-full py-6 sm:py-7 bg-white text-slate-900 rounded-[2.5rem] sm:rounded-[3.5rem] font-black text-2xl sm:text-3xl uppercase tracking-widest shadow-[0_15px_50px_rgba(255,255,255,0.2)] active:scale-95 transition-all"
                >
                  START
                </button>
                <div className="flex gap-4">
                  <button 
                    onClick={() => { soundService.playClick(); setView(GameView.RANKING); }}
                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-slate-200 rounded-3xl font-black uppercase tracking-widest text-[10px] sm:text-[11px] flex items-center justify-center gap-2 border border-white/10"
                  >
                    <Medal className="w-5 h-5 text-amber-400" />
                    RANKS
                  </button>
                  <button 
                    onClick={() => { soundService.playClick(); setView(GameView.HOW_TO_PLAY); }}
                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-slate-200 rounded-3xl font-black uppercase tracking-widest text-[10px] sm:text-[11px] flex items-center justify-center gap-2 border border-white/10"
                  >
                    <Info className="w-5 h-5 text-blue-400" />
                    GUIDE
                  </button>
                </div>
                <button 
                  onClick={() => setShowDownloadInfo(true)}
                  className="w-full py-3.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 border border-indigo-600/30 active:scale-95 transition-all"
                >
                  <Smartphone className="w-4 h-4" />
                  INSTALL APP
                </button>
              </div>
            </motion.div>
          )}

          {view === GameView.PLAYING && (
            <motion.div 
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col p-4 sm:p-6 pb-2 h-full overflow-hidden"
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              {/* Grid Container - Adjusted for better mobile scaling */}
              <div className="flex-1 flex items-center justify-center py-4 w-full h-full min-h-0">
                <div 
                  ref={gridRef}
                  id="game-grid"
                  className="aspect-square w-full max-w-[min(100%,calc(100dvh-350px))] grid grid-cols-10 gap-[1px] sm:gap-[2px] p-2 bg-slate-950/40 rounded-[2rem] sm:rounded-[3rem] border border-white/10 relative shadow-[inset_0_0_60px_rgba(255,255,255,0.02)]"
                >
                  {gameState.grid.map((row, r) => 
                    row.map((cell, c) => {
                      const isGhost = snapPreview && 
                        r >= snapPreview.r && 
                        r < snapPreview.r + (gameState.blockPool[draggingBlockIndex!]?.shape.length || 0) &&
                        c >= snapPreview.c &&
                        c < snapPreview.c + (gameState.blockPool[draggingBlockIndex!]?.shape[0].length || 0) &&
                        gameState.blockPool[draggingBlockIndex!].shape[r - snapPreview.r][c - snapPreview.c] === 1;

                      return (
                        <div 
                          key={`${r}-${c}`}
                          className="aspect-square rounded-[2px] sm:rounded-[4px] transition-all duration-200 relative overflow-hidden"
                          style={{ 
                            backgroundColor: cell.color || (isGhost ? `${gameState.blockPool[draggingBlockIndex!].color}44` : 'rgba(255, 255, 255, 0.04)'),
                            border: isGhost ? `1px solid ${gameState.blockPool[draggingBlockIndex!].color}aa` : 'none'
                          }}
                        >
                           {cell.color && <div className="absolute top-0 left-0 w-full h-[40%] bg-white/15 pointer-events-none" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Pieces Dock - Optimized for layout stability */}
              <div className="bg-slate-950/40 backdrop-blur-3xl rounded-[2.5rem] sm:rounded-[3.5rem] px-6 sm:px-10 py-4 sm:py-6 flex justify-between items-center gap-4 border border-white/10 h-24 sm:h-32 mb-4 shrink-0 shadow-2xl relative z-10">
                {gameState.blockPool.map((block, i) => (
                  <div 
                    key={block.id}
                    className="flex-1 flex items-center justify-center h-full relative"
                  >
                    {draggingBlockIndex !== i && (
                      <motion.div 
                        onPointerDown={(e) => handlePointerDown(e, i)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className="cursor-grab active:cursor-grabbing p-1 touch-none"
                        style={{
                          display: 'grid',
                          gridTemplateRows: `repeat(${block.shape.length}, 1fr)`,
                          gridTemplateColumns: `repeat(${block.shape[0].length}, 1fr)`,
                          gap: '2px',
                        }}
                      >
                        {block.shape.map((row, r) => 
                          row.map((cell, c) => (
                            <div 
                              key={`${r}-${c}`}
                              className="w-3 h-3 sm:w-4 sm:h-4 rounded-[1px] sm:rounded-[2px]"
                              style={{ 
                                backgroundColor: cell === 1 ? block.color : 'transparent',
                                opacity: cell === 1 ? 1 : 0
                              }}
                            />
                          ))
                        )}
                      </motion.div>
                    )}
                  </div>
                ))}

                {/* Smooth Drag Visual */}
                {draggingBlockIndex !== null && (
                  <div 
                    ref={dragVisualRef}
                    className="fixed pointer-events-none z-[1000] will-change-transform"
                    style={{ 
                      left: 0,
                      top: 0,
                      transform: `translate(${dragPos.x - dragOffsetRef.current.x}px, ${dragPos.y - dragOffsetRef.current.y}px)`
                    }}
                  >
                    <div 
                      style={{
                        display: 'grid',
                        gridTemplateRows: `repeat(${gameState.blockPool[draggingBlockIndex].shape.length}, 1fr)`,
                        gridTemplateColumns: `repeat(${gameState.blockPool[draggingBlockIndex].shape[0].length}, 1fr)`,
                        gap: '2px',
                      }}
                    >
                      {gameState.blockPool[draggingBlockIndex].shape.map((row, r) => 
                        row.map((cell, c) => (
                          <div 
                            key={`${r}-${c}`}
                            className="w-[32px] h-[32px] sm:w-[38px] sm:h-[38px] rounded-lg shadow-2xl border border-white/20"
                            style={{ 
                              backgroundColor: cell === 1 ? gameState.blockPool[draggingBlockIndex].color : 'transparent',
                              opacity: cell === 1 ? 0.95 : 0
                            }}
                          >
                             {cell === 1 && <div className="absolute inset-0 bg-white/20 rounded-lg pointer-events-none" style={{ height: '35%' }} />}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Powerups Area */}
              <div className="pb-4 sm:pb-8 flex justify-center shrink-0">
                 <button 
                  onClick={handleShuffle}
                  className="flex flex-col items-center gap-1 group transition-all active:scale-90"
                 >
                   <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 group-hover:bg-indigo-600/20 group-hover:border-indigo-500/50 shadow-xl backdrop-blur-md">
                     <Shuffle className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-400" />
                   </div>
                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest group-hover:text-indigo-400 transition-colors">REFRESH (50)</span>
                 </button>
              </div>
            </motion.div>
          )}

          {view === GameView.LEVEL_COMPLETE && (
            <motion.div 
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center p-8 sm:p-12 text-center space-y-10"
            >
              <div className="w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-[2.5rem] sm:rounded-[3rem] flex items-center justify-center shadow-xl animate-bounce">
                <Trophy className="w-10 h-10 sm:w-14 sm:h-14 text-white" />
              </div>
              <div className="space-y-3">
                <h2 className="text-3xl sm:text-4xl font-black text-white italic tracking-tighter">SUCCESS</h2>
                <p className="text-indigo-400 font-black uppercase tracking-[0.5em] text-[10px] sm:text-sm">Sector Level {gameState.level} Cleared</p>
              </div>
              
              <div className="w-full max-w-sm p-5 sm:p-7 bg-slate-900/80 rounded-[2.5rem] border border-white/10 flex justify-between items-center shadow-2xl">
                 <div className="flex items-center space-x-4">
                   <div className="w-10 h-10 sm:w-14 sm:h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center border border-amber-500/30">
                     <Coins className="w-6 h-6 sm:w-8 sm:h-8 text-amber-500" />
                   </div>
                   <div className="text-left leading-tight">
                     <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Bonus</p>
                     <p className="text-xl sm:text-3xl font-black text-white">+50</p>
                   </div>
                 </div>
                 <button 
                  disabled={claimedRewards.includes('coins')}
                  onClick={() => collectReward('coins', 50)}
                  className={`px-6 py-3 sm:px-8 sm:py-4 rounded-3xl font-black uppercase tracking-widest text-[10px] sm:text-[12px] transition-all ${claimedRewards.includes('coins') ? 'bg-white/5 text-slate-500' : 'bg-amber-500 text-slate-900 shadow-amber-500/30 hover:scale-105 active:scale-95'}`}
                 >
                   {claimedRewards.includes('coins') ? 'CLAIMED' : 'CLAIM'}
                 </button>
              </div>

              <button 
                onClick={startNextLevel}
                className="w-full max-w-sm py-5 sm:py-7 bg-white text-slate-900 rounded-[2rem] sm:rounded-[2.5rem] font-black text-xl sm:text-2xl uppercase tracking-widest flex items-center justify-center gap-4 active:scale-95 transition-all shadow-2xl"
              >
                NEXT LEVEL <ChevronRight className="w-7 h-7 sm:w-9 sm:h-9" />
              </button>
            </motion.div>
          )}

          {view === GameView.OUT_OF_MOVES && (
            <motion.div 
              key="fail"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center p-8 sm:p-12 text-center space-y-12"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-rose-500/10 rounded-[2rem] flex items-center justify-center border-2 border-rose-500/40 shadow-xl">
                <X className="w-10 h-10 sm:w-14 sm:h-14 text-rose-500" />
              </div>
              
              <div className="space-y-3">
                <h2 className="text-4xl sm:text-5xl font-black text-white italic tracking-tighter leading-none">OUT OF MOVES</h2>
                <p className="text-rose-400 font-black uppercase tracking-[0.5em] text-[10px] sm:text-sm italic">TRY AGAIN</p>
              </div>
              
              <div className="w-full max-w-sm grid grid-cols-2 gap-4">
                <div className="bg-slate-900/80 rounded-[2rem] p-5 border border-white/10 flex flex-col items-center justify-center space-y-2">
                  <Target className="w-5 h-5 text-indigo-400" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Final Net</span>
                  <p className="text-xl sm:text-3xl font-black text-white">{gameState.score.toLocaleString()}</p>
                </div>
                <div className="bg-slate-900/80 rounded-[2rem] p-5 border border-white/10 flex flex-col items-center justify-center space-y-2">
                  <History className="w-5 h-5 text-blue-400" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Max Level</span>
                  <p className="text-xl sm:text-3xl font-black text-white">{sessionMaxLevel}</p>
                </div>
              </div>
              
              <div className="w-full space-y-4 px-4 max-sm-sm">
                <button 
                  onClick={retryCurrentLevel}
                  className="w-full py-5 sm:py-7 bg-white text-slate-900 rounded-[2rem] sm:rounded-[2.5rem] font-black text-xl sm:text-2xl uppercase tracking-widest flex items-center justify-center gap-4 active:scale-95 transition-all shadow-2xl"
                >
                  <RotateCcw className="w-6 h-6 sm:w-8 sm:h-8" />
                  RETRY
                </button>
                <button 
                  onClick={() => setView(GameView.START)}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-slate-400 rounded-[1.5rem] font-black uppercase tracking-[0.4em] text-[10px] border border-white/10"
                >
                  MAIN MENU
                </button>
              </div>
            </motion.div>
          )}

          {view === GameView.RANKING && (
            <motion.div 
              key="ranking"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="absolute inset-0 flex flex-col p-6 sm:p-10"
            >
              <div className="flex items-center gap-5 mb-8 shrink-0">
                <button onClick={() => setView(GameView.START)} className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/15 border border-white/15 text-white">
                  <ChevronRight className="w-6 h-6 rotate-180" />
                </button>
                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Ranking</h2>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-3 space-y-4 custom-scrollbar pb-10">
                {rankings.map((entry) => (
                  <div 
                    key={`${entry.name}-${entry.rank}`}
                    className={`flex items-center justify-between p-5 rounded-[2.5rem] border transition-all ${entry.isPlayer ? 'bg-indigo-600/20 border-indigo-500/50 shadow-xl' : 'bg-slate-900/80 border-white/10'}`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${entry.rank === 1 ? 'bg-amber-400 text-slate-900 shadow-xl' : entry.rank === 2 ? 'bg-slate-300 text-slate-900' : entry.rank === 3 ? 'bg-orange-400 text-slate-900' : 'text-slate-500 bg-white/10'}`}>
                        {entry.rank}
                      </div>
                      <div>
                        <p className={`text-sm sm:text-lg font-black ${entry.isPlayer ? 'text-white' : 'text-white/90'}`}>{entry.name}</p>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Level {entry.level}</p>
                      </div>
                    </div>
                    <p className="text-lg font-black text-white">{entry.score.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {view === GameView.HOW_TO_PLAY && (
            <motion.div 
              key="howto"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="absolute inset-0 flex flex-col p-6 sm:p-10"
            >
              <div className="flex items-center gap-5 mb-10 shrink-0">
                <button onClick={() => setView(GameView.START)} className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/15 border border-white/15 text-white">
                  <ChevronRight className="w-6 h-6 rotate-180" />
                </button>
                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Guide</h2>
              </div>
              
              <div className="flex-1 space-y-10 overflow-y-auto custom-scrollbar pb-10 pr-3">
                <section className="flex items-start gap-5">
                  <div className="w-14 h-14 bg-indigo-500/20 rounded-[1.5rem] flex items-center justify-center text-indigo-400 border border-indigo-500/40 shrink-0">
                    <Maximize className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-white font-black uppercase text-sm mb-2 tracking-widest">Placement</h3>
                    <p className="text-[11px] sm:text-[14px] text-slate-400 font-medium leading-relaxed">Synthesize pieces into the grid matrix. Every placement consumes one energy cycle. Target must be met before cycles reach zero.</p>
                  </div>
                </section>

                <section className="flex items-start gap-5">
                  <div className="w-14 h-14 bg-cyan-500/20 rounded-[1.5rem] flex items-center justify-center text-cyan-400 border border-cyan-500/40 shrink-0">
                    <Columns className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-white font-black uppercase text-sm mb-2 tracking-widest">Clear Lines</h3>
                    <p className="text-[11px] sm:text-[14px] text-slate-400 font-medium leading-relaxed">Full horizontal or vertical arrays trigger dissolution. Clearing multiple lines simultaneously boosts score exponentially.</p>
                  </div>
                </section>

                <section className="flex items-start gap-5">
                  <div className="w-14 h-14 bg-amber-500/20 rounded-[1.5rem] flex items-center justify-center text-amber-400 border border-amber-500/40 shrink-0">
                    <Shuffle className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-white font-black uppercase text-sm mb-2 tracking-widest">Refresh</h3>
                    <p className="text-[11px] sm:text-[14px] text-slate-400 font-medium leading-relaxed">Utilize earned credits to refresh your current piece pool. Critical for navigating complex grid configurations.</p>
                  </div>
                </section>
              </div>
              
              <button 
                onClick={() => setView(GameView.START)}
                className="mt-6 py-5 sm:py-7 bg-white text-slate-900 rounded-[2rem] sm:rounded-[2.5rem] font-black text-xl uppercase tracking-widest active:scale-95 transition-all shrink-0"
              >
                RETURN
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        </div>

        {/* Fully Opaque Settings Interface */}
        <AnimatePresence>
          {showSettings && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="absolute inset-0 bg-slate-950 z-[2000] flex flex-col p-8 sm:p-12 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-12 shrink-0">
                <h2 className="text-3xl font-black text-white italic tracking-tighter">SETTINGS</h2>
                <button 
                  onClick={() => setShowSettings(false)} 
                  className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 active:scale-90 transition-all text-white shadow-xl"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between p-6 bg-slate-900 rounded-[2.5rem] border border-white/10">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-white/5 rounded-2xl">
                      {soundEnabled ? <Volume2 className="w-6 h-6 text-indigo-400" /> : <VolumeX className="w-6 h-6 text-slate-500" />}
                    </div>
                    <span className="font-black uppercase tracking-[0.3em] text-[11px] text-white">Sounds</span>
                  </div>
                  <button 
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`w-16 h-9 rounded-full transition-all relative border border-white/20 ${soundEnabled ? 'bg-indigo-600 shadow-xl' : 'bg-slate-800'}`}
                  >
                    <motion.div 
                      animate={{ x: soundEnabled ? 32 : 6 }}
                      className="absolute top-1 left-0 w-7 h-7 bg-white rounded-full shadow-2xl" 
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-6 bg-slate-900 rounded-[2.5rem] border border-white/10">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-white/5 rounded-2xl">
                      <Music className={`w-6 h-6 ${musicEnabled ? 'text-violet-400' : 'text-slate-500'}`} />
                    </div>
                    <span className="font-black uppercase tracking-[0.3em] text-[11px] text-white">Music</span>
                  </div>
                  <button 
                    onClick={() => setMusicEnabled(!musicEnabled)}
                    className={`w-16 h-9 rounded-full transition-all relative border border-white/20 ${musicEnabled ? 'bg-violet-600 shadow-xl' : 'bg-slate-800'}`}
                  >
                    <motion.div 
                      animate={{ x: musicEnabled ? 32 : 6 }}
                      className="absolute top-1 left-0 w-7 h-7 bg-white rounded-full shadow-2xl" 
                    />
                  </button>
                </div>

                <div className="pt-10 flex flex-col gap-4">
                   <button 
                    onClick={terminateMission}
                    className="w-full py-6 bg-rose-600/15 hover:bg-rose-600/25 text-rose-500 border border-rose-500/40 rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-[11px] transition-all flex items-center justify-center gap-4 active:scale-95"
                   >
                     <Scan className="w-5 h-5" />
                     QUIT GAME
                   </button>
                   <button 
                    onClick={() => setShowSettings(false)}
                    className="w-full py-6 bg-slate-800 border-2 border-white/10 text-white rounded-[2.5rem] font-black uppercase tracking-[0.4em] text-[11px] hover:bg-slate-700 transition-all active:scale-95 shadow-2xl"
                   >
                     CONTINUE
                   </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showDownloadInfo && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/98 backdrop-blur-3xl z-[3000] flex flex-col p-8 items-center justify-center text-center"
            >
              <div className="w-20 h-20 bg-indigo-500/20 rounded-3xl flex items-center justify-center mb-8 border border-indigo-500/40">
                <Smartphone className="w-10 h-10 text-indigo-400" />
              </div>
              <h2 className="text-2xl font-black text-white italic mb-6 uppercase tracking-tighter">Install App</h2>
              <div className="space-y-6 text-slate-400 text-sm mb-12">
                <p className="leading-relaxed">To play in fullscreen like a real app:</p>
                <div className="bg-slate-900/80 p-6 rounded-[2rem] border border-white/10 text-left space-y-4">
                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-slate-900 font-black shrink-0">1</div>
                    <p><span className="text-white font-bold uppercase tracking-wider">iOS:</span> Share -> "Add to Home Screen"</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-slate-900 font-black shrink-0">2</div>
                    <p><span className="text-white font-bold uppercase tracking-wider">Android:</span> Menu -> "Install app"</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setShowDownloadInfo(false)}
                className="w-full max-w-xs py-5 bg-white text-slate-900 rounded-[2rem] font-black uppercase tracking-widest active:scale-95 transition-all shadow-2xl"
              >
                GOT IT
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default App;
