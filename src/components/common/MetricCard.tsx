import React from 'react';
import { LucideIcon, TrendingUp } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trendText?: string;
  icon: LucideIcon;
  sparklineData?: number[];
  chartColor?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trendText = '+18.4% this week',
  icon: Icon,
  sparklineData = [12, 19, 15, 27, 24, 34, 42],
  chartColor = '#0F4C5C',
}) => {
  // Generate SVG path for sparkline
  const max = Math.max(...sparklineData);
  const min = Math.min(...sparklineData);
  const range = max - min || 1;
  const width = 120;
  const height = 36;
  const points = sparklineData
    .map((val, idx) => {
      const x = (idx / (sparklineData.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-soft hover:shadow-card transition-shadow flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</span>
          <h3 className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{value}</h3>
        </div>
        <div className="w-10 h-10 rounded-xl bg-teal-brand/10 text-teal-brand flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        {/* Positive Trend Pill */}
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
          <TrendingUp className="w-3 h-3" />
          <span>{trendText}</span>
        </div>

        {/* Mock Sparkline SVG */}
        <div className="w-[90px] h-[28px]">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id={`grad-${title.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColor} stopOpacity="0.25" />
                <stop offset="100%" stopColor={chartColor} stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <polyline
              fill="none"
              stroke={chartColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          </svg>
        </div>
      </div>

      {subtitle && <p className="text-[11px] text-slate-400 mt-1.5">{subtitle}</p>}
    </div>
  );
};
