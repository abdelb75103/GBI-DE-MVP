import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {BlueBackgroundShell} from './BlueBackgroundShell';
import {HeaderBrandLockup} from './HeaderBrandLockup';
import {publicationTimelineData} from './generated/publicationTimelineData';

const DATA = publicationTimelineData;
const TOTAL_PAPERS = DATA.reduce((sum, item) => sum + item.count, 0);
const EARLIEST_YEAR = DATA[0].year;
const LATEST_YEAR = DATA[DATA.length - 1].year;
const MAX_COUNT = Math.max(...DATA.map((item) => item.count));
const PAPERS_SINCE_2020 = DATA.filter((item) => item.year >= 2020).reduce((s, i) => s + i.count, 0);

const PEAK_YEARS = DATA.filter((item) => item.count === MAX_COUNT).map((item) => item.year);
const PEAK_LABEL = PEAK_YEARS.length > 1
  ? `${PEAK_YEARS[0]}–${String(PEAK_YEARS[PEAK_YEARS.length - 1]).slice(2)}`
  : String(PEAK_YEARS[0]);

const MILESTONES = [
  {year: 2006, title: 'Fuller et al.', note: 'Injury definitions consensus'},
  {year: 2020, title: 'IOC Consensus', note: 'Standardised burden reporting'},
  {year: 2023, title: 'Waldén et al.', note: 'Football-specific extension'},
];

// Three period bar colors
const barPeriods = {
  pre2006: 'rgba(100, 160, 220, 0.32)',      // muted steel blue
  post2006: 'rgba(120, 183, 255, 0.50)',      // medium blue
  post2020: 'rgba(139, 210, 255, 0.75)',      // bright cyan-blue
};

const colors = {
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.72)',
  textMuted: 'rgba(255, 255, 255, 0.40)',
  grid: 'rgba(255, 255, 255, 0.06)',
  axis: 'rgba(255, 255, 255, 0.14)',
  line: '#FFFFFF',
  lineSoft: 'rgba(139, 196, 255, 0.18)',
  glow: 'rgba(139, 196, 255, 0.18)',
  kpiBg: 'rgba(255, 255, 255, 0.09)',
  kpiBorder: 'rgba(255, 255, 255, 0.16)',
  kpiAccent: '#8BC4FF',
  kpiValue: '#FFFFFF',
  kpiLabel: 'rgba(255, 255, 255, 0.56)',
  msGold: '#D4A853',
  msGoldDot: 'rgba(212, 168, 83, 0.45)',
  msText: '#E8CC8A',
};

function getBarFill(year: number): string {
  if (year < 2006) return barPeriods.pre2006;
  if (year < 2020) return barPeriods.post2006;
  return barPeriods.post2020;
}

export const PapersTimelineSlide: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const titleReveal = spring({frame: frame - 6, fps, config: {damping: 18}});
  const kpiReveal = spring({frame: frame - 14, fps, config: {damping: 18}});
  const chartReveal = spring({frame: frame - 24, fps, config: {damping: 18}});
  const lineReveal = interpolate(frame, [32, 175], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const milestoneReveal = interpolate(frame, [155, 250], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const chartWidth = 1728;
  const chartHeight = 860;
  const axisLeft = 48;
  const axisBottom = 160; // room for milestone labels below x-axis
  const xAxisY = chartHeight - axisBottom;
  const usableWidth = chartWidth - axisLeft - 24;
  const usableHeight = chartHeight - axisBottom - 36;
  const step = usableWidth / (DATA.length - 1);

  const points = DATA.map((item, index) => ({
    year: item.year,
    count: item.count,
    x: axisLeft + index * step,
    y: xAxisY - (item.count / MAX_COUNT) * usableHeight,
  }));

  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(' ');

  const trackerIndex = lineReveal * (points.length - 1);
  const trackerLeftIndex = Math.floor(trackerIndex);
  const trackerRightIndex = Math.min(points.length - 1, trackerLeftIndex + 1);
  const trackerProgress = trackerIndex - trackerLeftIndex;
  const trackerX = interpolate(
    trackerProgress,
    [0, 1],
    [points[trackerLeftIndex].x, points[trackerRightIndex].x],
  );
  const trackerY = interpolate(
    trackerProgress,
    [0, 1],
    [points[trackerLeftIndex].y, points[trackerRightIndex].y],
  );

  const tickYears = DATA.filter(
    (item) =>
      item.year === EARLIEST_YEAR ||
      item.year === LATEST_YEAR ||
      (item.year % 5 === 0 && item.year !== 1975),
  );

  const kpiCardW = 184;
  const kpiCardH = 100;
  const kpiGap = 16;
  const kpiStartX = 64;
  const kpiStartY = 48;
  const kpiData = [
    {value: TOTAL_PAPERS.toString(), label: 'Total Papers', col: 0, row: 0},
    {value: '50', label: 'Years of Research', col: 1, row: 0},
    {value: MAX_COUNT.toString(), label: `Peak (${PEAK_LABEL})`, col: 0, row: 1},
    {value: PAPERS_SINCE_2020.toString(), label: 'Since 2020', col: 1, row: 1},
  ];

  // Milestone label positions below x-axis
  // 2006 and 2020 at the same level, 2023 lower
  const msRow1Y = xAxisY + 42;  // 2006 and 2020
  const msRow2Y = xAxisY + 100; // 2023

  return (
    <BlueBackgroundShell centerOverlay={<HeaderBrandLockup theme="blue" />} pitchVariant="halfway">
      <AbsoluteFill style={{padding: '0 0 0 0'}}>
        <div style={{display: 'flex', flexDirection: 'column', height: '100%', position: 'relative'}}>

          {/* Title */}
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 0,
              zIndex: 10,
              opacity: titleReveal,
              transform: `translateY(${interpolate(titleReveal, [0, 1], [14, 0])}px)`,
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 34,
                fontWeight: 700,
                lineHeight: 1.15,
                letterSpacing: '-0.03em',
                color: colors.textPrimary,
              }}
            >
              Development of the Literature Over Time
            </h1>
          </div>

          {/* Full-bleed chart */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 50,
              bottom: 0,
            }}
          >
            {/* Ambient glow */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `radial-gradient(circle at ${chartWidth * 0.65}px ${chartHeight * 0.32}px, ${colors.glow} 0%, rgba(139,196,255,0.04) 25%, transparent 50%)`,
                opacity: lineReveal * 0.85,
                pointerEvents: 'none',
              }}
            />

            <svg
              width={chartWidth}
              height={chartHeight}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              style={{display: 'block', width: '100%', height: '100%'}}
            >
              {/* Horizontal grid lines */}
              {[10, 20, 30, 40].map((tick) => {
                const y = xAxisY - (tick / MAX_COUNT) * usableHeight;
                return (
                  <g key={tick}>
                    <line
                      x1={axisLeft}
                      x2={chartWidth - 12}
                      y1={y}
                      y2={y}
                      stroke={colors.grid}
                      strokeWidth={1.5}
                    />
                    <text
                      x={axisLeft - 10}
                      y={y + 5}
                      fill={colors.textMuted}
                      fontSize={15}
                      fontWeight={600}
                      textAnchor="end"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {/* X-axis line */}
              <line
                x1={axisLeft}
                x2={chartWidth - 12}
                y1={xAxisY}
                y2={xAxisY}
                stroke={colors.axis}
                strokeWidth={2}
              />

              {/* Bars — three period shades */}
              {DATA.map((item, index) => {
                const point = points[index];
                const reveal = spring({
                  frame: frame - (30 + index * 2),
                  fps,
                  config: {damping: 18},
                });
                const barHeight = (item.count / MAX_COUNT) * usableHeight * chartReveal * reveal;
                const barY = xAxisY - barHeight;
                const barWidth = step < 22 ? Math.max(6, step - 3) : 16;
                return (
                  <rect
                    key={item.year}
                    x={point.x - barWidth / 2}
                    y={barY}
                    width={barWidth}
                    height={barHeight}
                    rx={barWidth / 2}
                    fill={getBarFill(item.year)}
                  />
                );
              })}

              {/* Year labels */}
              {tickYears.map((item) => {
                const point = points.find((entry) => entry.year === item.year);
                if (!point) return null;
                const isKey =
                  item.year % 10 === 0 ||
                  item.year === EARLIEST_YEAR ||
                  item.year === LATEST_YEAR;
                return (
                  <text
                    key={item.year}
                    x={point.x}
                    y={xAxisY + 28}
                    fill={isKey ? colors.textSecondary : colors.textMuted}
                    fontSize={isKey ? 16 : 14}
                    fontWeight={700}
                    textAnchor="middle"
                  >
                    {item.year}
                  </text>
                );
              })}

              {/* Animated line */}
              <g style={{clipPath: `inset(0 ${(1 - lineReveal) * 100}% 0 0)`}}>
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke={colors.lineSoft}
                  strokeWidth={18}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke={colors.line}
                  strokeWidth={5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </g>

              {/* Tracker dot */}
              <circle cx={trackerX} cy={trackerY} r={26} fill={colors.glow} opacity={lineReveal} />
              <circle cx={trackerX} cy={trackerY} r={9} fill={colors.line} opacity={lineReveal} />

              {/* ─── KPI cards ─── */}
              {kpiData.map((kpi, index) => {
                const kReveal = spring({
                  frame: frame - (14 + index * 5),
                  fps,
                  config: {damping: 18},
                });
                const cx = kpiStartX + kpi.col * (kpiCardW + kpiGap);
                const cy = kpiStartY + kpi.row * (kpiCardH + kpiGap);
                return (
                  <foreignObject
                    key={kpi.label}
                    x={cx}
                    y={cy}
                    width={kpiCardW}
                    height={kpiCardH}
                    opacity={kpiReveal * kReveal}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: 16,
                        background: colors.kpiBg,
                        border: `1px solid ${colors.kpiBorder}`,
                        borderLeft: `3px solid ${colors.kpiAccent}`,
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        padding: '0 20px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 42,
                          fontWeight: 700,
                          color: colors.kpiValue,
                          lineHeight: 1,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {kpi.value}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: colors.kpiLabel,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          marginTop: 6,
                        }}
                      >
                        {kpi.label}
                      </div>
                    </div>
                  </foreignObject>
                );
              })}

              {/* ─── Milestone markers — gold, below x-axis ─── */}
              {MILESTONES.map((milestone, index) => {
                const point = points.find((entry) => entry.year === milestone.year);
                if (!point) return null;
                const reveal = spring({
                  frame: frame - (158 + index * 16),
                  fps,
                  config: {damping: 16},
                });

                // 2006 and 2020 same row, 2023 lower row
                const labelY = index <= 1 ? msRow1Y : msRow2Y;
                const labelCenterY = labelY + 26; // vertical center of label text

                return (
                  <g key={milestone.year} opacity={milestoneReveal * reveal}>
                    {/* Gold diamond on x-axis */}
                    <polygon
                      points={`${point.x},${xAxisY - 7} ${point.x + 5},${xAxisY} ${point.x},${xAxisY + 7} ${point.x - 5},${xAxisY}`}
                      fill={colors.msGold}
                    />
                    {/* Dotted line from x-axis diamond DOWN to the label */}
                    <line
                      x1={point.x}
                      x2={point.x}
                      y1={xAxisY + 10}
                      y2={labelY - 2}
                      stroke={colors.msGoldDot}
                      strokeWidth={2}
                      strokeDasharray="4 4"
                    />
                    {/* Label below */}
                    <foreignObject
                      x={point.x - 120}
                      y={labelY}
                      width={240}
                      height={56}
                    >
                      <div style={{textAlign: 'center'}}>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: colors.msGold,
                            lineHeight: 1.15,
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {milestone.year} — {milestone.title}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: colors.msText,
                            lineHeight: 1.3,
                            marginTop: 3,
                            opacity: 0.75,
                          }}
                        >
                          {milestone.note}
                        </div>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </AbsoluteFill>
    </BlueBackgroundShell>
  );
};
