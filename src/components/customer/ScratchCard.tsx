import React, { useRef, useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Trophy, Heart } from 'lucide-react';
import { playScratchSound, playWinChime, playTryAgainChime, unlockAudio } from '../../lib/audio';

interface ScratchCardProps {
  rewardName: string;
  imageUrl?: string | null;
  description?: string | null;
  isLoss?: boolean;
  onRevealed: () => void;
}

export const ScratchCard: React.FC<ScratchCardProps> = ({
  rewardName,
  imageUrl,
  description,
  isLoss = false,
  onRevealed,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isScratching, setIsScratching] = useState(false);
  const [isCleared, setIsCleared] = useState(false);
  const [hasScratched, setHasScratched] = useState(false);
  const hasScratchedRef = useRef(false);
  const moveCountRef = useRef(0);

  // Initialize Canvas Foil
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Draw metallic golden foil
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#D4AF37'); // Gold
    grad.addColorStop(0.3, '#F5D77F');
    grad.addColorStop(0.5, '#E5C158');
    grad.addColorStop(0.8, '#C59B27');
    grad.addColorStop(1, '#997300');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative stippling
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        Math.random() * 8 + 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Border inner frame
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // Foil text callouts
    ctx.fillStyle = '#4A3B00';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🪙 SCRATCH HERE', canvas.width / 2, canvas.height / 2 - 8);

    ctx.fillStyle = '#6B5400';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText('Rub with your finger to reveal prize', canvas.width / 2, canvas.height / 2 + 16);
  }, []);

  const completeReveal = () => {
    if (isCleared) return;
    setIsCleared(true);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    if (isLoss) {
      playTryAgainChime();
    } else {
      playWinChime();
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#F26419', '#0F4C5C', '#10B981', '#FFD700'],
        });
      } catch {
        // Ignored
      }
    }

    onRevealed();
  };

  const scratch = (clientX: number, clientY: number) => {
    if (isCleared) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Erase foil with destination-out
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 28, 0, Math.PI * 2);
    ctx.fill();

    // Mark as scratched
    if (!hasScratchedRef.current) {
      hasScratchedRef.current = true;
      setHasScratched(true);
    }
    moveCountRef.current += 1;

    // Haptics on mobile
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(20);
      } catch {
        // Ignored
      }
    }

    // Sound
    playScratchSound();

    // Safety threshold: if continuously scratching without lifting finger past ~35%
    if (moveCountRef.current % 12 === 0) {
      checkContinuousScratch(ctx, canvas);
    }
  };

  const checkContinuousScratch = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    if (isCleared) return;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    let transparentCount = 0;
    const step = 20;
    let sampledTotal = 0;
    for (let i = 3; i < pixels.length; i += 4 * step) {
      sampledTotal++;
      if (pixels[i] === 0) {
        transparentCount++;
      }
    }
    const percent = Math.round((transparentCount / sampledTotal) * 100);
    if (percent >= 35) {
      completeReveal();
    }
  };

  // Called when user lifts finger or releases mouse button
  const handleRelease = () => {
    setIsScratching(false);
    // If user has scratched even 1 stroke, automatically reveal completely on finger lift!
    if (hasScratchedRef.current && !isCleared) {
      completeReveal();
    }
  };

  return (
    <div className="relative w-full max-w-[340px] sm:max-w-[380px] h-[220px] sm:h-[240px] mx-auto select-none rounded-2xl overflow-hidden shadow-2xl border-4 border-amber-400/50 bg-gradient-to-br from-amber-500 via-yellow-400 to-amber-600 p-1">
      {/* Underlying Prize Card */}
      <div className="w-full h-full bg-white rounded-xl flex flex-col items-center justify-center p-3 text-center space-y-1.5 relative overflow-hidden">
        {/* Prize Image or Icon */}
        {imageUrl ? (
          <div className="relative">
            <img
              src={imageUrl}
              alt={rewardName}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-contain bg-slate-50 border-2 border-coral-brand/30 shadow-md animate-fadeIn p-1"
            />
            <div className="absolute -top-1.5 -right-1.5 bg-coral-brand text-white p-0.5 rounded-full">
              <Sparkles className="w-3 h-3" />
            </div>
          </div>
        ) : isLoss ? (
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-inner">
            <Heart className="w-6 h-6 animate-pulse" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-full bg-coral-light flex items-center justify-center text-coral-brand shadow-inner">
            <Trophy className="w-6 h-6 animate-bounce" />
          </div>
        )}

        <div>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isLoss ? 'text-amber-700' : 'text-coral-brand'}`}>
            {isLoss ? '🍀 BETTER LUCK NEXT TIME' : '🎉 CONGRATULATIONS!'}
          </span>
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
            {rewardName}
          </h3>
          {description && (
            <p className="text-[10px] text-slate-500 line-clamp-1 max-w-[260px] mx-auto mt-0.5">
              {description}
            </p>
          )}
        </div>

        {/* Release finger prompt under the foil */}
        {!isLoss ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200/80 rounded-lg text-amber-800">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            <span className="text-[10px] font-bold tracking-wide">
              {hasScratched ? 'Release finger to reveal prize!' : 'Rub to scratch'}
            </span>
          </div>
        ) : (
          <p className="text-[10px] text-slate-400 font-medium">
            Thank you for participating!
          </p>
        )}
      </div>

      {/* HTML5 Canvas Foil Mask */}
      <canvas
        ref={canvasRef}
        onMouseDown={(e) => {
          unlockAudio();
          setIsScratching(true);
          scratch(e.clientX, e.clientY);
        }}
        onMouseMove={(e) => {
          if (isScratching) scratch(e.clientX, e.clientY);
        }}
        onMouseUp={handleRelease}
        onMouseLeave={handleRelease}
        onTouchStart={(e) => {
          unlockAudio();
          setIsScratching(true);
          scratch(e.touches[0].clientX, e.touches[0].clientY);
        }}
        onTouchMove={(e) => {
          if (isScratching) scratch(e.touches[0].clientX, e.touches[0].clientY);
        }}
        onTouchEnd={handleRelease}
        onTouchCancel={handleRelease}
        className={`absolute inset-0 w-full h-full cursor-pointer touch-none transition-opacity duration-500 ${
          isCleared ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      />

      {/* Progress Indicator */}
      {!isCleared && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-black/60 backdrop-blur-sm text-white rounded-full text-[9px] font-semibold pointer-events-none">
          {hasScratched ? '✨ Release finger to reveal prize' : '🪙 Rub with your finger to scratch'}
        </div>
      )}
    </div>
  );
};
