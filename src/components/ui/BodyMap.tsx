'use client';

import React, { useMemo } from 'react';

interface BodyMapProps {
  highlightedMuscles?: string[];
  volumeData?: Record<string, number>;
  size?: 'sm' | 'md' | 'lg';
}

const MUSCLE_COLORS: Record<string, string> = {
  Borst: '#3b82f6',     // blue-500
  Rug: '#a855f7',       // purple-500
  Benen: '#ef4444',     // red-500
  Schouders: '#eab308', // yellow-500
  Armen: '#f97316',     // orange-500
  Core: '#22c55e',      // green-500
  Billen: '#ec4899',    // pink-500
};

const DARK_COLOR = '#27272a'; // zinc-800
const LIGHT_COLOR = '#3f3f46'; // zinc-700

const SIZE_CONFIG = {
  sm: { width: 120, height: 240, strokeWidth: 1 },
  md: { width: 160, height: 320, strokeWidth: 1.2 },
  lg: { width: 200, height: 400, strokeWidth: 1.5 },
};

export const BodyMap: React.FC<BodyMapProps> = ({
  highlightedMuscles = [],
  volumeData = {},
  size = 'md',
}) => {
  const config = SIZE_CONFIG[size];
  const highlightedSet = new Set(highlightedMuscles);

  const getMuscleColor = (muscleGroup: string): string => {
    if (!highlightedSet.has(muscleGroup)) {
      return DARK_COLOR;
    }
    return MUSCLE_COLORS[muscleGroup] || DARK_COLOR;
  };

  const getMuscleOpacity = (muscleGroup: string): number => {
    if (!volumeData || !volumeData[muscleGroup]) {
      return highlightedSet.has(muscleGroup) ? 1 : 1;
    }
    const maxVolume = Math.max(...Object.values(volumeData));
    return Math.max(0.4, volumeData[muscleGroup] / maxVolume);
  };

  const getGlowClass = (muscleGroup: string): string => {
    return highlightedSet.has(muscleGroup) ? 'animate-pulse' : '';
  };

  // Scalable SVG viewBox and path coordinates
  const viewBoxWidth = 200;
  const viewBoxHeight = 400;

  return (
    <div className={`flex justify-center items-center ${getGlowClass('')}`}>
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        width={config.width}
        height={config.height}
        className="drop-shadow-lg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="glow-borst">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-rug">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-benen">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-schouders">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-armen">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-core">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-billen">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.7; }
            }
            .muscle-pulse {
              animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }
          `}</style>
        </defs>

        {/* Background */}
        <rect width={viewBoxWidth} height={viewBoxHeight} fill="#09090b" opacity="0.3" />

        {/* Head */}
        <circle cx="100" cy="35" r="18" fill={LIGHT_COLOR} stroke={LIGHT_COLOR} strokeWidth={config.strokeWidth} />

        {/* Neck */}
        <rect x="92" y="52" width="16" height="12" fill={LIGHT_COLOR} />

        {/* Left Shoulder (Schouders) */}
        <ellipse
          cx="70"
          cy="70"
          rx="16"
          ry="20"
          fill={getMuscleColor('Schouders')}
          opacity={getMuscleOpacity('Schouders')}
          stroke={getMuscleColor('Schouders')}
          strokeWidth={config.strokeWidth}
          filter={highlightedSet.has('Schouders') ? 'url(#glow-schouders)' : ''}
          className={highlightedSet.has('Schouders') ? 'muscle-pulse' : ''}
        />

        {/* Right Shoulder (Schouders) */}
        <ellipse
          cx="130"
          cy="70"
          rx="16"
          ry="20"
          fill={getMuscleColor('Schouders')}
          opacity={getMuscleOpacity('Schouders')}
          stroke={getMuscleColor('Schouders')}
          strokeWidth={config.strokeWidth}
          filter={highlightedSet.has('Schouders') ? 'url(#glow-schouders)' : ''}
          className={highlightedSet.has('Schouders') ? 'muscle-pulse' : ''}
        />

        {/* Left Arm (Armen) */}
        <path
          d="M 56 90 Q 45 120 42 160 L 58 160 Q 60 120 72 90"
          fill={getMuscleColor('Armen')}
          opacity={getMuscleOpacity('Armen')}
          stroke={getMuscleColor('Armen')}
          strokeWidth={config.strokeWidth}
          filter={highlightedSet.has('Armen') ? 'url(#glow-armen)' : ''}
          className={highlightedSet.has('Armen') ? 'muscle-pulse' : ''}
        />

        {/* Right Arm (Armen) */}
        <path
          d="M 144 90 Q 155 120 158 160 L 142 160 Q 140 120 128 90"
          fill={getMuscleColor('Armen')}
          opacity={getMuscleOpacity('Armen')}
          stroke={getMuscleColor('Armen')}
          strokeWidth={config.strokeWidth}
          filter={highlightedSet.has('Armen') ? 'url(#glow-armen)' : ''}
          className={highlightedSet.has('Armen') ? 'muscle-pulse' : ''}
        />

        {/* Chest (Borst) */}
        <path
          d="M 80 75 Q 100 75 120 75 L 120 140 Q 100 145 80 140 Z"
          fill={getMuscleColor('Borst')}
          opacity={getMuscleOpacity('Borst')}
          stroke={getMuscleColor('Borst')}
          strokeWidth={config.strokeWidth}
          filter={highlightedSet.has('Borst') ? 'url(#glow-borst)' : ''}
          className={highlightedSet.has('Borst') ? 'muscle-pulse' : ''}
        />

        {/* Core/Abs (Core) */}
        <path
          d="M 85 145 L 115 145 L 115 210 Q 100 215 85 210 Z"
          fill={getMuscleColor('Core')}
          opacity={getMuscleOpacity('Core')}
          stroke={getMuscleColor('Core')}
          strokeWidth={config.strokeWidth}
          filter={highlightedSet.has('Core') ? 'url(#glow-core)' : ''}
          className={highlightedSet.has('Core') ? 'muscle-pulse' : ''}
        />

        {/* Back (Rug) - Left side indication */}
        <path
          d="M 75 80 Q 65 110 68 150 L 83 150 Q 82 115 88 80"
          fill={getMuscleColor('Rug')}
          opacity={getMuscleOpacity('Rug') * 0.6}
          stroke={getMuscleColor('Rug')}
          strokeWidth={config.strokeWidth}
          filter={highlightedSet.has('Rug') ? 'url(#glow-rug)' : ''}
          className={highlightedSet.has('Rug') ? 'muscle-pulse' : ''}
        />

        {/* Back (Rug) - Right side indication */}
        <path
          d="M 125 80 Q 135 110 132 150 L 117 150 Q 118 115 112 80"
          fill={getMuscleColor('Rug')}
          opacity={getMuscleOpacity('Rug') * 0.6}
          stroke={getMuscleColor('Rug')}
          strokeWidth={config.strokeWidth}
          filter={highlightedSet.has('Rug') ? 'url(#glow-rug)' : ''}
          className={highlightedSet.has('Rug') ? 'muscle-pulse' : ''}
        />

        {/* Glutes/Billen */}
        <ellipse
          cx="85"
          cy="215"
          rx="14"
          ry="18"
          fill={getMuscleColor('Billen')}
          opacity={getMuscleOpacity('Billen')}
          stroke={getMuscleColor('Billen')}
          strokeWidth={config.strokeWidth}
          filter={highlightedSet.has('Billen') ? 'url(#glow-billen)' : ''}
          className={highlightedSet.has('Billen') ? 'muscle-pulse' : ''}
        />

        <ellipse
          cx="115"
          cy="215"
          rx="14"
          ry="18"
          fill={getMuscleColor('Billen')}
          opacity={getMuscleOpacity('Billen')}
          stroke={getMuscleColor('Billen')}
          strokeWidth={config.strokeWidth}
          filter={highlightedSet.has('Billen') ? 'url(#glow-billen)' : ''}
          className={highlightedSet.has('Billen') ? 'muscle-pulse' : ''}
        />

        {/* Left Leg (Benen) - Quad */}
        <path
          d="M 82 235 L 78 310 L 92 310 L 90 235"
          fill={getMuscleColor('Benen')}
          opacity={getMuscleOpacity('Benen')}
          stroke={getMuscleColor('Benen')}
          strokeWidth={config.strokeWidth}
          filter={highlightedSet.has('Benen') ? 'url(#glow-benen)' : ''}
          className={highlightedSet.has('Benen') ? 'muscle-pulse' : ''}
        />

        {/* Left Leg (Benen) - Calf */}
        <path
          d="M 78 310 L 76 380 L 88 380 L 92 310"
          fill={getMuscleColor('Benen')}
          opacity={getMuscleOpacity('Benen') * 0.8}
          stroke={getMuscleColor('Benen')}
          strokeWidth={config.strokeWidth}
          filter={highlightedSet.has('Benen') ? 'url(#glow-benen)' : ''}
          className={highlightedSet.has('Benen') ? 'muscle-pulse' : ''}
        />

        {/* Right Leg (Benen) - Quad */}
        <path
          d="M 118 235 L 122 310 L 108 310 L 110 235"
          fill={getMuscleColor('Benen')}
          opacity={getMuscleOpacity('Benen')}
          stroke={getMuscleColor('Benen')}
          strokeWidth={config.strokeWidth}
          filter={highlightedSet.has('Benen') ? 'url(#glow-benen)' : ''}
          className={highlightedSet.has('Benen') ? 'muscle-pulse' : ''}
        />

        {/* Right Leg (Benen) - Calf */}
        <path
          d="M 122 310 L 124 380 L 112 380 L 108 310"
          fill={getMuscleColor('Benen')}
          opacity={getMuscleOpacity('Benen') * 0.8}
          stroke={getMuscleColor('Benen')}
          strokeWidth={config.strokeWidth}
          filter={highlightedSet.has('Benen') ? 'url(#glow-benen)' : ''}
          className={highlightedSet.has('Benen') ? 'muscle-pulse' : ''}
        />

        {/* Feet */}
        <rect x="74" y="380" width="8" height="12" fill={LIGHT_COLOR} rx="2" />
        <rect x="118" y="380" width="8" height="12" fill={LIGHT_COLOR} rx="2" />
      </svg>
    </div>
  );
};

export default BodyMap;
