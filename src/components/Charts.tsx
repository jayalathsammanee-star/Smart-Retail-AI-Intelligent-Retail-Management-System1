import React, { useState } from 'react';
import { formatCurrency, formatShortDate } from '../lib/api';

interface RevenuePoint {
  date: string;
  revenue: number;
  orders?: number;
  profit?: number;
}

export const RevenueAreaChart: React.FC<{
  data: RevenuePoint[];
  height?: number;
  showProfit?: boolean;
}> = ({ data, height = 230, showProfit = false }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-sm text-[#5B4B7A] dark:text-[#A799C9]">
        No revenue data available for this selection.
      </div>
    );
  }

  const width = 680;
  const padL = 52;
  const padR = 18;
  const padT = 18;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const maxVal = Math.max(10, ...data.map((d) => d.revenue)) * 1.12;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const barW = Math.max(6, Math.min(20, (innerW / Math.max(1, data.length)) * 0.52));

  const yPos = (val: number) => padT + innerH - (val / maxVal) * innerH;
  const xPos = (idx: number) => (data.length === 1 ? padL + innerW / 2 : padL + idx * stepX);

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i).toFixed(1)} ${yPos(d.revenue).toFixed(1)}`)
    .join(' ');

  const profitPath = showProfit
    ? data
        .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i).toFixed(1)} ${yPos(d.profit ?? 0).toFixed(1)}`)
        .join(' ')
    : '';

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(maxVal * t));
  const hovered = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <div className="relative w-full">
      {hovered && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#5B4B7A] dark:text-[#A799C9]">
          <span className="font-medium text-[#1E113A] dark:text-[#F5F3FF]">
            {formatShortDate(hovered.date)}
          </span>
          <div className="flex items-center gap-4 font-mono tabular-nums">
            <span className="text-[#6D28D9] dark:text-[#A78BFA]">
              Revenue: {formatCurrency(hovered.revenue)}
            </span>
            {typeof hovered.profit === 'number' && (
              <span className="text-[#059669] dark:text-[#34D399]">
                Profit: {formatCurrency(hovered.profit)}
              </span>
            )}
            {typeof hovered.orders === 'number' && (
              <span>Orders: {hovered.orders}</span>
            )}
          </div>
        </div>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible select-none"
        role="img"
        aria-label="Daily revenue chart"
      >
        {yTicks.map((tick, idx) => {
          const y = yPos(tick);
          return (
            <g key={idx}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                className="stroke-[#E9E2FA] dark:stroke-[#2A1F47]"
                strokeDasharray="3 3"
              />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-[#5B4B7A] dark:fill-[#A799C9] text-[10px] font-mono tabular-nums"
              >
                ${tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const cx = xPos(i);
          const barTop = yPos(d.revenue);
          const barH = Math.max(0, padT + innerH - barTop);
          const isHovered = hoverIdx === i;
          return (
            <g
              key={d.date}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              className="cursor-pointer"
            >
              <rect
                x={cx - barW / 2}
                y={barTop}
                width={barW}
                height={barH}
                rx={3}
                className={
                  isHovered
                    ? 'fill-[#7C3AED] dark:fill-[#8B5CF6]'
                    : 'fill-[#DDD6FE] dark:fill-[#3B1F6E]'
                }
              />
              {(i === 0 || i === data.length - 1 || i % Math.max(1, Math.floor(data.length / 5)) === 0) && (
                <text
                  x={cx}
                  y={height - 6}
                  textAnchor="middle"
                  className="fill-[#5B4B7A] dark:fill-[#A799C9] text-[10px] font-mono"
                >
                  {formatShortDate(d.date)}
                </text>
              )}
            </g>
          );
        })}

        <path
          d={linePath}
          fill="none"
          stroke="#5B21B6"
          strokeWidth={2.2}
          className="dark:stroke-[#C4B5FD] pointer-events-none"
        />

        {showProfit && profitPath && (
          <path
            d={profitPath}
            fill="none"
            stroke="#10B981"
            strokeWidth={2}
            strokeDasharray="4 3"
            className="pointer-events-none"
          />
        )}
      </svg>
    </div>
  );
};

interface ForecastPoint {
  date: string;
  actualRevenue: number | null;
  predictedRevenue: number;
  lowerBound: number;
  upperBound: number;
  isFuture: boolean;
}

export const ForecastBandChart: React.FC<{
  series: ForecastPoint[];
  height?: number;
}> = ({ series, height = 260 }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (series.length === 0) {
    return (
      <div className="h-[240px] flex items-center justify-center text-sm text-[#5B4B7A] dark:text-[#A799C9]">
        Insufficient history to compute forecast series.
      </div>
    );
  }

  const width = 760;
  const padL = 56;
  const padR = 20;
  const padT = 20;
  const padB = 30;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const maxVal =
    Math.max(
      10,
      ...series.map((s) => Math.max(s.upperBound, s.actualRevenue ?? 0, s.predictedRevenue))
    ) * 1.08;

  const xPos = (i: number) => padL + (i / Math.max(1, series.length - 1)) * innerW;
  const yPos = (v: number) => padT + innerH - (v / maxVal) * innerH;

  const bandPointsTop = series.map((s, i) => `${xPos(i).toFixed(1)},${yPos(s.upperBound).toFixed(1)}`);
  const bandPointsBot = [...series]
    .reverse()
    .map((s, revI) => {
      const idx = series.length - 1 - revI;
      return `${xPos(idx).toFixed(1)},${yPos(s.lowerBound).toFixed(1)}`;
    });
  const bandPolygon = [...bandPointsTop, ...bandPointsBot].join(' ');

  const predPath = series
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i).toFixed(1)} ${yPos(s.predictedRevenue).toFixed(1)}`)
    .join(' ');

  const actualPoints = series.filter((s) => s.actualRevenue !== null);
  const actualPath = actualPoints
    .map((s, idx) => {
      const origIdx = series.indexOf(s);
      return `${idx === 0 ? 'M' : 'L'} ${xPos(origIdx).toFixed(1)} ${yPos(s.actualRevenue ?? 0).toFixed(1)}`;
    })
    .join(' ');

  const splitIdx = series.findIndex((s) => s.isFuture);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(maxVal * t));
  const hovered = hoverIdx !== null ? series[hoverIdx] : null;

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-5 text-[#5B4B7A] dark:text-[#A799C9]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 bg-[#3B0764] dark:bg-[#F5F3FF]" />
            Actual Sales
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 bg-[#7C3AED]" />
            ML Predicted
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 bg-[#7C3AED]/20 border border-[#7C3AED]/40" />
            Confidence Interval
          </span>
        </div>
        {hovered && (
          <div className="flex items-center gap-4 font-mono tabular-nums text-[#1E113A] dark:text-[#F5F3FF]">
            <span>{formatShortDate(hovered.date)}</span>
            {hovered.actualRevenue !== null && (
              <span>Actual: {formatCurrency(hovered.actualRevenue)}</span>
            )}
            <span className="text-[#7C3AED] dark:text-[#A78BFA]">
              Forecast: {formatCurrency(hovered.predictedRevenue)}
            </span>
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible select-none"
        role="img"
        aria-label="Actual vs ML predicted sales forecast chart"
      >
        {yTicks.map((tick, idx) => {
          const y = yPos(tick);
          return (
            <g key={idx}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                className="stroke-[#E9E2FA] dark:stroke-[#2A1F47]"
                strokeDasharray="3 3"
              />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-[#5B4B7A] dark:fill-[#A799C9] text-[10px] font-mono tabular-nums"
              >
                ${tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick}
              </text>
            </g>
          );
        })}

        <polygon
          points={bandPolygon}
          className="fill-[#7C3AED]/15 dark:fill-[#8B5CF6]/20"
        />

        {splitIdx > 0 && (
          <g>
            <line
              x1={xPos(splitIdx)}
              y1={padT}
              x2={xPos(splitIdx)}
              y2={padT + innerH}
              stroke="#10B981"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
            <text
              x={xPos(splitIdx) + 6}
              y={padT + 12}
              className="fill-[#059669] dark:fill-[#34D399] text-[10px] font-medium"
            >
              Forecast Horizon
            </text>
          </g>
        )}

        <path d={predPath} fill="none" stroke="#7C3AED" strokeWidth={2.2} strokeDasharray="5 3" />
        <path
          d={actualPath}
          fill="none"
          stroke="#2E1065"
          strokeWidth={2.4}
          className="dark:stroke-[#F5F3FF]"
        />

        {series.map((s, i) => (
          <g key={s.date} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}>
            <rect
              x={xPos(i) - Math.max(4, innerW / series.length / 2)}
              y={padT}
              width={Math.max(8, innerW / series.length)}
              height={innerH}
              fill="transparent"
              className="cursor-crosshair"
            />
            {hoverIdx === i && (
              <circle
                cx={xPos(i)}
                cy={yPos(s.predictedRevenue)}
                r={4}
                className="fill-[#7C3AED] stroke-white dark:stroke-[#160F29]"
                strokeWidth={2}
              />
            )}
            {(i === 0 || i === series.length - 1 || i % Math.max(1, Math.floor(series.length / 6)) === 0) && (
              <text
                x={xPos(i)}
                y={height - 6}
                textAnchor="middle"
                className="fill-[#5B4B7A] dark:fill-[#A799C9] text-[10px] font-mono"
              >
                {formatShortDate(s.date)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};

export const HorizontalBarChart: React.FC<{
  items: Array<{ label: string; value: number; secondaryValue?: number; subLabel?: string }>;
  primaryColor?: string;
  formatValue?: (v: number) => string;
}> = ({ items, formatValue = formatCurrency }) => {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pct = Math.max(2, (item.value / max) * 100);
        return (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-[#1E113A] dark:text-[#F5F3FF] truncate">
                {item.label}
              </span>
              <span className="font-mono tabular-nums text-[#5B4B7A] dark:text-[#A799C9] shrink-0">
                {formatValue(item.value)}
                {item.subLabel ? ` · ${item.subLabel}` : ''}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-sm bg-[#EFEAFF] dark:bg-[#24193E] overflow-hidden">
              <div
                className="h-full rounded-sm bg-[#6D28D9] dark:bg-[#8B5CF6] transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const DonutMixChart: React.FC<{
  slices: Array<{ label: string; value: number; pct: number }>;
  centerTitle: string;
  centerValue: string;
}> = ({ slices, centerTitle, centerValue }) => {
  const colors = ['#5B21B6', '#8B5CF6', '#10B981', '#D97706', '#6366F1'];
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-36 h-36 shrink-0">
        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            strokeWidth="18"
            className="stroke-[#EFEAFF] dark:stroke-[#24193E]"
          />
          {slices.map((slice, idx) => {
            const len = (slice.value / total) * circumference;
            const dashArray = `${len} ${circumference - len}`;
            const dashOffset = -cumulativeOffset;
            cumulativeOffset += len;
            return (
              <circle
                key={slice.label}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={colors[idx % colors.length]}
                strokeWidth="18"
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] text-[#5B4B7A] dark:text-[#A799C9]">{centerTitle}</span>
          <span className="text-base font-bold font-mono tabular-nums text-[#1E113A] dark:text-[#F5F3FF]">
            {centerValue}
          </span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2.5">
        {slices.map((slice, idx) => (
          <div key={slice.label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: colors[idx % colors.length] }}
              />
              <span className="text-[#1E113A] dark:text-[#F5F3FF] truncate">{slice.label}</span>
            </div>
            <span className="font-mono tabular-nums text-[#5B4B7A] dark:text-[#A799C9]">
              {slice.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ClusterScatterChart: React.FC<{
  customers: Array<{
    customerId: number;
    name: string;
    frequency: number;
    monetary: number;
    segmentLabel: string;
  }>;
}> = ({ customers }) => {
  const colorByLabel: Record<string, string> = {
    'VIP Champions': '#6D28D9',
    'Loyal Regulars': '#10B981',
    'Growth Potential': '#8B5CF6',
    'At-Risk / Dormant': '#D97706',
  };

  const width = 460;
  const height = 220;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 30;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const maxFreq = Math.max(5, ...customers.map((c) => c.frequency)) * 1.1;
  const maxMon = Math.max(100, ...customers.map((c) => c.monetary)) * 1.1;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Customer RFM clusters">
      <line
        x1={padL}
        y1={padT + innerH}
        x2={width - padR}
        y2={padT + innerH}
        className="stroke-[#E9E2FA] dark:stroke-[#2A1F47]"
      />
      <line
        x1={padL}
        y1={padT}
        x2={padL}
        y2={padT + innerH}
        className="stroke-[#E9E2FA] dark:stroke-[#2A1F47]"
      />

      {customers.map((c) => {
        const cx = padL + (c.frequency / maxFreq) * innerW;
        const cy = padT + innerH - (c.monetary / maxMon) * innerH;
        const fill = colorByLabel[c.segmentLabel] ?? '#7C3AED';
        return (
          <g key={c.customerId}>
            <circle cx={cx} cy={cy} r={5.5} fill={fill} fillOpacity={0.82}>
              <title>{`${c.name} · ${c.segmentLabel} · ${c.frequency} orders · ${formatCurrency(c.monetary)}`}</title>
            </circle>
          </g>
        );
      })}

      <text
        x={padL + innerW / 2}
        y={height - 6}
        textAnchor="middle"
        className="fill-[#5B4B7A] dark:fill-[#A799C9] text-[10px]"
      >
        Purchase Frequency (Orders)
      </text>
      <text
        x={12}
        y={padT + innerH / 2}
        textAnchor="middle"
        transform={`rotate(-90 12 ${padT + innerH / 2})`}
        className="fill-[#5B4B7A] dark:fill-[#A799C9] text-[10px]"
      >
        Total Spend ($)
      </text>
    </svg>
  );
};
