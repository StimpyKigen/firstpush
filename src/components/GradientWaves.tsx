import React, { useEffect, useRef } from 'react';

export interface GradientWavesProps {
  horizonColor?: string;
  waveColor?: string;
  crestColor?: string;
  amplitude?: number;
  fogDepth?: number;
  brightness?: number;
  opacity?: number;
  mouseInteraction?: boolean;
  grain?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (clean.length === 6) {
    const num = parseInt(clean, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}

export const GradientWaves: React.FC<GradientWavesProps> = ({
  horizonColor = '#cfd5dd',
  waveColor = '#afb6c2',
  crestColor = '#e0e4e9',
  amplitude = 2.8,
  fogDepth = 34,
  brightness = 1.0,
  opacity = 1,
  mouseInteraction = false,
  grain = false,
  className = '',
  style = {},
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 });
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = (canvas.width = container.clientWidth || 300);
    let height = (canvas.height = container.clientHeight || 300);
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const updateDimensions = () => {
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });
    resizeObserver.observe(container);

    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseInteraction || !container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        mouseRef.current.targetX = (e.clientX - rect.left) / rect.width;
        mouseRef.current.targetY = (e.clientY - rect.top) / rect.height;
      }
    };

    if (mouseInteraction) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
    }

    // Pre-generate subtle grain pattern if enabled
    let grainCanvas: HTMLCanvasElement | null = null;
    if (grain) {
      grainCanvas = document.createElement('canvas');
      grainCanvas.width = 128;
      grainCanvas.height = 128;
      const gCtx = grainCanvas.getContext('2d');
      if (gCtx) {
        const imgData = gCtx.createImageData(128, 128);
        for (let i = 0; i < imgData.data.length; i += 4) {
          const val = Math.floor(Math.random() * 255);
          imgData.data[i] = val;
          imgData.data[i + 1] = val;
          imgData.data[i + 2] = val;
          imgData.data[i + 3] = 18; // very subtle
        }
        gCtx.putImageData(imgData, 0, 0);
      }
    }

    let startTime = performance.now();

    const render = (now: number) => {
      const elapsed = (now - startTime) * 0.001;

      // Smooth mouse interpolation
      if (mouseInteraction) {
        mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
        mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Base background gradient: horizonColor fading to waveColor
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, horizonColor);
      bgGrad.addColorStop(Math.min(1, Math.max(0, fogDepth / 100)), waveColor);
      bgGrad.addColorStop(1, waveColor);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const ampScale = (amplitude / 3) * (height * 0.12);
      const mouseOffset = mouseInteraction ? (mouseRef.current.x - 0.5) * 1.5 : 0;

      // Wave parameters for 3 layered undulating ribbons
      const waveLayers = [
        {
          color: hexToRgba(waveColor, 0.45 * brightness),
          speed: 0.55,
          freq: 0.007,
          amp: ampScale * 1.25,
          baseY: height * 0.38,
          phase: 0.0,
        },
        {
          color: hexToRgba(crestColor, 0.65 * brightness),
          speed: 0.85,
          freq: 0.011,
          amp: ampScale * 1.0,
          baseY: height * 0.56,
          phase: 1.8,
        },
        {
          color: hexToRgba(crestColor, 0.85 * brightness),
          speed: 1.15,
          freq: 0.015,
          amp: ampScale * 0.75,
          baseY: height * 0.72,
          phase: 3.4,
        },
      ];

      for (let layerIndex = 0; layerIndex < waveLayers.length; layerIndex++) {
        const layer = waveLayers[layerIndex];
        ctx.beginPath();
        ctx.moveTo(0, height);

        const step = 8;
        for (let x = 0; x <= width + step; x += step) {
          const t = elapsed * layer.speed;
          const k1 = x * layer.freq + t + layer.phase + mouseOffset;
          const k2 = x * (layer.freq * 1.8) - t * 0.8 + layer.phase;

          const yWave = Math.sin(k1) * layer.amp + Math.cos(k2) * (layer.amp * 0.42);
          const y = layer.baseY + yWave;

          if (x === 0) {
            ctx.lineTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.lineTo(width, height);
        ctx.closePath();

        // Fill wave with gradient
        const waveGrad = ctx.createLinearGradient(0, layer.baseY - layer.amp, 0, height);
        waveGrad.addColorStop(0, hexToRgba(crestColor, 0.8 * brightness));
        waveGrad.addColorStop(0.3, layer.color);
        waveGrad.addColorStop(1, hexToRgba(horizonColor, 0.2));

        ctx.fillStyle = waveGrad;
        ctx.fill();

        // Subtle crest highlight stroke
        ctx.beginPath();
        for (let x = 0; x <= width + step; x += step) {
          const t = elapsed * layer.speed;
          const k1 = x * layer.freq + t + layer.phase + mouseOffset;
          const k2 = x * (layer.freq * 1.8) - t * 0.8 + layer.phase;
          const y = layer.baseY + Math.sin(k1) * layer.amp + Math.cos(k2) * (layer.amp * 0.42);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = hexToRgba(crestColor, Math.min(1, 0.45 * brightness));
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Atmospheric radial glow/brightness
      if (brightness !== 1.0) {
        const glow = ctx.createRadialGradient(
          width * 0.5,
          height * 0.3,
          width * 0.1,
          width * 0.5,
          height * 0.5,
          width * 0.7
        );
        glow.addColorStop(0, `rgba(255, 255, 255, ${Math.max(0, (brightness - 0.8) * 0.15)})`);
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
      }

      // Optional grain texture
      if (grain && grainCanvas) {
        const grainPattern = ctx.createPattern(grainCanvas, 'repeat');
        if (grainPattern) {
          ctx.fillStyle = grainPattern;
          ctx.fillRect(0, 0, width, height);
        }
      }

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      resizeObserver.disconnect();
      if (mouseInteraction) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [
    horizonColor,
    waveColor,
    crestColor,
    amplitude,
    fogDepth,
    brightness,
    mouseInteraction,
    grain,
  ]);

  return (
    <div
      ref={containerRef}
      className={`gradient-waves-container ${className}`}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: mouseInteraction ? 'auto' : 'none',
        opacity,
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

export default GradientWaves;
