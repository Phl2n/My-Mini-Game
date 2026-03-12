/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, Play, Pause, ArrowRight, ArrowLeft, ArrowUp } from 'lucide-react';

// --- Constants & Types ---

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const MOVE_SPEED = 5;
const GROUND_HEIGHT = 40;

type GameState = 'START' | 'PLAYING' | 'GAMEOVER' | 'WIN';

interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  type: 'player' | 'platform' | 'enemy' | 'goal' | 'coin';
}

interface Player extends Entity {
  vx: number;
  vy: number;
  isJumping: boolean;
  score: number;
}

interface Platform extends Entity {}
interface Enemy extends Entity {
  vx: number;
  range: number;
  startX: number;
}
interface Coin extends Entity {
  collected: boolean;
}

// --- Game Component ---

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const requestRef = useRef<number>(null);

  // Game state refs for the loop
  const playerRef = useRef<Player>({
    x: 50,
    y: CANVAS_HEIGHT - GROUND_HEIGHT - 40,
    width: 32,
    height: 32,
    vx: 0,
    vy: 0,
    isJumping: false,
    color: '#ef4444', // Red Bear
    type: 'player',
    score: 0
  });

  const platformsRef = useRef<Platform[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const coinsRef = useRef<Coin[]>([]);
  const bushesRef = useRef<{ x: number, y: number, size: number }[]>([]);
  const goalRef = useRef<Entity | null>(null);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const cameraX = useRef(0);

  // --- Level Generation ---

  const initLevel = (lvl: number) => {
    cameraX.current = 0;
    playerRef.current = {
      ...playerRef.current,
      x: 50,
      y: CANVAS_HEIGHT - GROUND_HEIGHT - 40,
      vx: 0,
      vy: 0,
      isJumping: false,
      score: playerRef.current.score
    };

    // Base ground
    const platforms: Platform[] = [
      { x: 0, y: CANVAS_HEIGHT - GROUND_HEIGHT, width: 3000, height: GROUND_HEIGHT, color: '#4ade80', type: 'platform' }
    ];

    // Bushes
    bushesRef.current = [
      { x: 100, y: CANVAS_HEIGHT - GROUND_HEIGHT, size: 20 },
      { x: 350, y: CANVAS_HEIGHT - GROUND_HEIGHT, size: 25 },
      { x: 700, y: CANVAS_HEIGHT - GROUND_HEIGHT, size: 18 },
      { x: 1000, y: CANVAS_HEIGHT - GROUND_HEIGHT, size: 30 },
      { x: 1500, y: CANVAS_HEIGHT - GROUND_HEIGHT, size: 22 },
      { x: 1900, y: CANVAS_HEIGHT - GROUND_HEIGHT, size: 28 },
    ];

    // Platforms
    const levelPlatforms: Platform[] = [
      { x: 200, y: 280, width: 100, height: 20, color: '#fbbf24', type: 'platform' },
      { x: 400, y: 220, width: 100, height: 20, color: '#fbbf24', type: 'platform' },
      { x: 600, y: 160, width: 100, height: 20, color: '#fbbf24', type: 'platform' },
      { x: 850, y: 250, width: 150, height: 20, color: '#fbbf24', type: 'platform' },
      { x: 1100, y: 180, width: 100, height: 20, color: '#fbbf24', type: 'platform' },
      { x: 1300, y: 280, width: 200, height: 20, color: '#fbbf24', type: 'platform' },
      { x: 1600, y: 200, width: 100, height: 20, color: '#fbbf24', type: 'platform' },
      { x: 1800, y: 120, width: 100, height: 20, color: '#fbbf24', type: 'platform' },
    ];
    platformsRef.current = [...platforms, ...levelPlatforms];

    // Enemies
    enemiesRef.current = [
      { x: 500, y: CANVAS_HEIGHT - GROUND_HEIGHT - 30, width: 30, height: 30, color: '#ef4444', type: 'enemy', vx: 2, range: 100, startX: 500 },
      { x: 900, y: 220, width: 30, height: 30, color: '#ef4444', type: 'enemy', vx: 2, range: 50, startX: 900 },
      { x: 1400, y: CANVAS_HEIGHT - GROUND_HEIGHT - 30, width: 30, height: 30, color: '#ef4444', type: 'enemy', vx: 3, range: 150, startX: 1400 },
    ];

    // Coins
    coinsRef.current = [
      { x: 235, y: 240, width: 15, height: 15, color: '#fcd34d', type: 'coin', collected: false },
      { x: 435, y: 180, width: 15, height: 15, color: '#fcd34d', type: 'coin', collected: false },
      { x: 635, y: 120, width: 15, height: 15, color: '#fcd34d', type: 'coin', collected: false },
      { x: 1135, y: 140, width: 15, height: 15, color: '#fcd34d', type: 'coin', collected: false },
      { x: 1835, y: 80, width: 15, height: 15, color: '#fcd34d', type: 'coin', collected: false },
    ];

    // Goal
    goalRef.current = { x: 2200, y: CANVAS_HEIGHT - GROUND_HEIGHT - 60, width: 40, height: 60, color: '#3b82f6', type: 'goal' };
  };

  // --- Game Loop Logic ---

  const update = () => {
    if (gameState !== 'PLAYING') return;

    const player = playerRef.current;

    // Movement
    if (keysRef.current['ArrowLeft'] || keysRef.current['a']) {
      player.vx = -MOVE_SPEED;
    } else if (keysRef.current['ArrowRight'] || keysRef.current['d']) {
      player.vx = MOVE_SPEED;
    } else {
      player.vx = 0;
    }

    if ((keysRef.current['ArrowUp'] || keysRef.current['w'] || keysRef.current[' ']) && !player.isJumping) {
      player.vy = JUMP_FORCE;
      player.isJumping = true;
    }

    // Apply Gravity
    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;

    // Boundary checks
    if (player.x < 0) player.x = 0;

    // Collision Detection: Platforms
    let onPlatform = false;
    platformsRef.current.forEach(plat => {
      if (
        player.x < plat.x + plat.width &&
        player.x + player.width > plat.x &&
        player.y + player.height > plat.y &&
        player.y + player.height < plat.y + plat.height + player.vy
      ) {
        player.y = plat.y - player.height;
        player.vy = 0;
        player.isJumping = false;
        onPlatform = true;
      }
    });

    // Fall off check
    if (player.y > CANVAS_HEIGHT) {
      setGameState('GAMEOVER');
    }

    // Enemies update & collision
    enemiesRef.current.forEach(enemy => {
      enemy.x += enemy.vx;
      if (Math.abs(enemy.x - enemy.startX) > enemy.range) {
        enemy.vx *= -1;
      }

      // Simple AABB collision
      if (
        player.x < enemy.x + enemy.width &&
        player.x + player.width > enemy.x &&
        player.y < enemy.y + enemy.height &&
        player.y + player.height > enemy.y
      ) {
        // Stomp check
        if (player.vy > 0 && player.y + player.height < enemy.y + enemy.height / 2) {
          // Kill enemy
          enemiesRef.current = enemiesRef.current.filter(e => e !== enemy);
          player.vy = JUMP_FORCE / 1.5;
          setScore(s => s + 50);
        } else {
          setGameState('GAMEOVER');
        }
      }
    });

    // Coins collection
    coinsRef.current.forEach(coin => {
      if (!coin.collected &&
        player.x < coin.x + coin.width &&
        player.x + player.width > coin.x &&
        player.y < coin.y + coin.height &&
        player.y + player.height > coin.y
      ) {
        coin.collected = true;
        setScore(s => s + 10);
      }
    });

    // Goal check
    const goal = goalRef.current;
    if (goal &&
      player.x < goal.x + goal.width &&
      player.x + player.width > goal.x &&
      player.y < goal.y + goal.height &&
      player.y + player.height > goal.y
    ) {
      setGameState('WIN');
    }

    // Camera follow
    if (player.x > CANVAS_WIDTH / 2) {
      cameraX.current = player.x - CANVAS_WIDTH / 2;
    }
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background
    ctx.fillStyle = '#bae6fd'; // Sky blue
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    ctx.translate(-cameraX.current, 0);

    // Draw Platforms
    platformsRef.current.forEach(plat => {
      ctx.fillStyle = plat.color;
      ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
      // Grass top
      if (plat.type === 'platform' && plat.color === '#4ade80') {
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(plat.x, plat.y, plat.width, 5);
      }
    });

    // Draw Bushes
    bushesRef.current.forEach(bush => {
      ctx.fillStyle = '#15803d'; // Dark green
      // Draw three overlapping circles for a bush effect
      ctx.beginPath();
      ctx.arc(bush.x, bush.y - bush.size / 2, bush.size / 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bush.x - bush.size / 2, bush.y - bush.size / 3, bush.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bush.x + bush.size / 2, bush.y - bush.size / 3, bush.size / 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Coins
    coinsRef.current.forEach(coin => {
      if (!coin.collected) {
        ctx.fillStyle = coin.color;
        ctx.beginPath();
        ctx.arc(coin.x + coin.width / 2, coin.y + coin.height / 2, coin.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d97706';
        ctx.stroke();
      }
    });

    // Draw Goal
    const goal = goalRef.current;
    if (goal) {
      ctx.fillStyle = goal.color;
      ctx.fillRect(goal.x, goal.y, goal.width, goal.height);
      // Flag
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(goal.x + goal.width - 5, goal.y, 5, goal.height);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(goal.x + goal.width - 5, goal.y);
      ctx.lineTo(goal.x + goal.width - 25, goal.y + 10);
      ctx.lineTo(goal.x + goal.width - 5, goal.y + 20);
      ctx.fill();
    }

    // Draw Enemies
    enemiesRef.current.forEach(enemy => {
      ctx.fillStyle = enemy.color;
      ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
      // Eyes
      ctx.fillStyle = 'white';
      ctx.fillRect(enemy.x + 5, enemy.y + 5, 5, 5);
      ctx.fillRect(enemy.x + enemy.width - 10, enemy.y + 5, 5, 5);
    });

    // Draw Player (Bear)
    const p = playerRef.current;
    ctx.fillStyle = p.color;
    // Body
    ctx.fillRect(p.x, p.y, p.width, p.height);
    // Ears
    ctx.fillRect(p.x - 5, p.y - 5, 10, 10);
    ctx.fillRect(p.x + p.width - 5, p.y - 5, 10, 10);
    // Eyes
    ctx.fillStyle = 'black';
    ctx.fillRect(p.x + 5, p.y + 8, 4, 4);
    ctx.fillRect(p.x + p.width - 9, p.y + 8, 4, 4);
    // Nose
    ctx.fillRect(p.x + p.width / 2 - 2, p.y + 16, 4, 4);

    ctx.restore();
  };

  const loop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    update();
    draw(ctx);

    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState]);

  const startGame = () => {
    setScore(0);
    initLevel(1);
    setGameState('PLAYING');
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden border-8 border-stone-800 relative">
        {/* HUD */}
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 pointer-events-none">
          <div className="bg-stone-800/80 backdrop-blur-sm px-4 py-2 rounded-full text-white font-mono flex items-center gap-4">
            <span className="text-yellow-400 font-bold">SCORE: {score.toString().padStart(6, '0')}</span>
            <span className="text-blue-400 font-bold">LEVEL: {level}</span>
          </div>
        </div>

        {/* Game Canvas */}
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-auto block bg-sky-200"
        />

        {/* Overlays */}
        <AnimatePresence>
          {gameState === 'START' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/90 flex flex-col items-center justify-center text-white p-8 z-20"
            >
              <motion.h1
                initial={{ y: -50 }}
                animate={{ y: 0 }}
                className="text-7xl font-black mb-4 tracking-tighter text-yellow-400 italic"
              >
                GM BEAR
              </motion.h1>
              <p className="text-xl mb-8 opacity-80 text-center max-w-md">
                Help GM Bear reach the blue flag! Collect coins and stomp on red enemies.
              </p>
              <div className="grid grid-cols-2 gap-8 mb-12 text-sm opacity-60">
                <div className="flex items-center gap-2">
                  <ArrowLeft size={16} /> <ArrowRight size={16} /> Move
                </div>
                <div className="flex items-center gap-2">
                  <ArrowUp size={16} /> Jump
                </div>
              </div>
              <button
                onClick={startGame}
                className="group relative px-12 py-4 bg-yellow-400 text-stone-900 rounded-full font-bold text-2xl hover:bg-yellow-300 transition-all flex items-center gap-2"
              >
                <Play fill="currentColor" /> START GAME
              </button>
            </motion.div>
          )}

          {gameState === 'GAMEOVER' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-red-900/90 flex flex-col items-center justify-center text-white z-20"
            >
              <h2 className="text-6xl font-black mb-2 text-red-200">GAME OVER</h2>
              <p className="text-2xl mb-8">Score: {score}</p>
              <button
                onClick={startGame}
                className="px-8 py-3 bg-white text-red-900 rounded-full font-bold text-xl hover:bg-red-100 transition-all flex items-center gap-2"
              >
                <RotateCcw size={24} /> TRY AGAIN
              </button>
            </motion.div>
          )}

          {gameState === 'WIN' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-blue-900/90 flex flex-col items-center justify-center text-white z-20"
            >
              <Trophy size={80} className="text-yellow-400 mb-4" />
              <h2 className="text-6xl font-black mb-2 text-blue-200">YOU WIN!</h2>
              <p className="text-2xl mb-8">Final Score: {score}</p>
              <button
                onClick={startGame}
                className="px-8 py-3 bg-yellow-400 text-blue-900 rounded-full font-bold text-xl hover:bg-yellow-300 transition-all flex items-center gap-2"
              >
                <Play fill="currentColor" /> PLAY AGAIN
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Controls Info */}
      <div className="mt-8 text-stone-500 flex gap-8 text-sm font-medium uppercase tracking-widest">
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
          <kbd className="bg-stone-100 px-2 py-1 rounded border border-stone-300">WASD</kbd> or <kbd className="bg-stone-100 px-2 py-1 rounded border border-stone-300">ARROWS</kbd> to move
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
          <kbd className="bg-stone-100 px-2 py-1 rounded border border-stone-300">SPACE</kbd> to jump
        </div>
      </div>
    </div>
  );
}
