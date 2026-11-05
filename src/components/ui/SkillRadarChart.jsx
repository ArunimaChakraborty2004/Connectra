import React, { useState } from 'react';
import { vectorizeSkills } from '../../lib/skillGraph';

/**
 * 4-Dimensional Engineering Domain Radar / Spider Chart
 * Axes:
 * 1. Frontend (North / -90°)
 * 2. Backend (East / 0°)
 * 3. DevOps (South / 90°)
 * 4. Cybersecurity (West / 180°)
 *
 * Visualizes project requirement vector vs candidate skill vector.
 */
export default function SkillRadarChart({
  requiredSkills = '',
  candidateSkills = '',
  size = 240,
  showLegend = true,
  className = '',
}) {
  const [hoveredAxis, setHoveredAxis] = useState(null);

  // Vectorize both skill sets into 4D components in [0, 1]
  const reqVec = vectorizeSkills(requiredSkills);
  const candVec = vectorizeSkills(candidateSkills);

  // Chart geometry
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.36;

  // Axes definition: Angle in radians (0 at North, clockwise)
  const axes = [
    { key: 'frontend', label: 'Frontend', angle: -Math.PI / 2, align: 'middle', baseline: 'auto', dy: -10 },
    { key: 'backend', label: 'Backend', angle: 0, align: 'start', baseline: 'middle', dx: 10 },
    { key: 'devops', label: 'DevOps', angle: Math.PI / 2, align: 'middle', baseline: 'hanging', dy: 10 },
    { key: 'cybersecurity', label: 'Security', angle: Math.PI, align: 'end', baseline: 'middle', dx: -10 },
  ];

  // Helper to compute SVG (x, y) given an axis and normalized weight [0..1]
  const getPoint = (axisIndex, weight) => {
    const angle = axes[axisIndex].angle;
    const r = Math.max(0.08, Math.min(1.0, weight)) * maxR;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  // Convert a vector to an SVG polygon points string
  const toPolygonPoints = (vec) => {
    return axes
      .map((ax, idx) => {
        const pt = getPoint(idx, vec[ax.key] || 0.05);
        return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      })
      .join(' ');
  };

  const reqPolygon = toPolygonPoints(reqVec);
  const candPolygon = toPolygonPoints(candVec);

  // Grid levels (25%, 50%, 75%, 100%)
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible"
        >
          {/* Subtle Outer Glow Filter */}
          <defs>
            <radialGradient id="radarGridGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(249, 115, 22, 0.08)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          {/* Background Ambient Glow */}
          <circle cx={cx} cy={cy} r={maxR * 1.1} fill="url(#radarGridGlow)" />

          {/* Concentric Grid Polygons */}
          {gridLevels.map((lvl, lIdx) => {
            const pts = axes
              .map((_, aIdx) => {
                const pt = getPoint(aIdx, lvl);
                return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
              })
              .join(' ');
            return (
              <polygon
                key={lIdx}
                points={pts}
                fill="none"
                stroke="currentColor"
                strokeWidth={lIdx === gridLevels.length - 1 ? '1.2' : '0.8'}
                strokeDasharray={lIdx === gridLevels.length - 1 ? 'none' : '3 3'}
                className="text-stone-300 dark:text-stone-700/60"
              />
            );
          })}

          {/* Radial Axis Lines */}
          {axes.map((ax, aIdx) => {
            const outer = getPoint(aIdx, 1.0);
            return (
              <line
                key={aIdx}
                x1={cx}
                y1={cy}
                x2={outer.x}
                y2={outer.y}
                stroke="currentColor"
                strokeWidth="1"
                className="text-stone-300 dark:text-stone-700/80"
              />
            );
          })}

          {/* Project Requirement Polygon (Orange) */}
          <polygon
            points={reqPolygon}
            fill="rgba(249, 115, 22, 0.22)"
            stroke="#ea580c"
            strokeWidth="1.8"
            strokeLinejoin="round"
            className="transition-all duration-300"
          />

          {/* Candidate Profile Polygon (Emerald) */}
          <polygon
            points={candPolygon}
            fill="rgba(16, 185, 129, 0.3)"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinejoin="round"
            className="transition-all duration-300"
          />

          {/* Vertex Markers for Project Requirement (Orange Dots) */}
          {axes.map((ax, aIdx) => {
            const pt = getPoint(aIdx, reqVec[ax.key] || 0.05);
            return (
              <circle
                key={`req-pt-${aIdx}`}
                cx={pt.x}
                cy={pt.y}
                r="3.5"
                fill="#ea580c"
                stroke="#ffffff"
                strokeWidth="1"
                className="drop-shadow-xs"
              />
            );
          })}

          {/* Vertex Markers for Candidate Skills (Emerald Dots) */}
          {axes.map((ax, aIdx) => {
            const pt = getPoint(aIdx, candVec[ax.key] || 0.05);
            return (
              <circle
                key={`cand-pt-${aIdx}`}
                cx={pt.x}
                cy={pt.y}
                r="4.5"
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth="1.5"
                className="drop-shadow-sm cursor-pointer hover:r-6 transition-all"
                onMouseEnter={() => setHoveredAxis(ax.key)}
                onMouseLeave={() => setHoveredAxis(null)}
              />
            );
          })}

          {/* Center Origin Dot */}
          <circle cx={cx} cy={cy} r="2.5" fill="currentColor" className="text-stone-400 dark:text-stone-600" />

          {/* Axis Labels & Values */}
          {axes.map((ax, aIdx) => {
            const outer = getPoint(aIdx, 1.0);
            const labelX = outer.x + (ax.dx || 0);
            const labelY = outer.y + (ax.dy || 0);
            const reqVal = Math.round((reqVec[ax.key] || 0) * 100);
            const candVal = Math.round((candVec[ax.key] || 0) * 100);
            const isHovered = hoveredAxis === ax.key;

            return (
              <g key={`lbl-${aIdx}`} className="cursor-default">
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={ax.align}
                  alignmentBaseline={ax.baseline}
                  className={`text-[10px] font-bold tracking-tight transition-colors ${
                    isHovered
                      ? 'fill-orange-600 dark:fill-orange-400 font-extrabold'
                      : 'fill-stone-600 dark:fill-stone-300'
                  }`}
                >
                  {ax.label}
                </text>
                <text
                  x={labelX}
                  y={labelY + (ax.dy && ax.dy < 0 ? -11 : 11)}
                  textAnchor={ax.align}
                  className="text-[9px] font-mono fill-stone-400 dark:fill-stone-500"
                >
                  {candVal}% / {reqVal}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend & Synergy Balance Note */}
      {showLegend && (
        <div className="w-full flex items-center justify-between gap-2 pt-2 px-1 text-[11px] border-t border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block shrink-0 shadow-2xs" />
            <span className="text-stone-600 dark:text-stone-300 font-medium">Project Needs</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0 shadow-2xs" />
            <span className="text-stone-600 dark:text-stone-300 font-medium">Your Profile</span>
          </div>
        </div>
      )}
    </div>
  );
}
