import React, { useEffect, useRef, useState } from 'react';
import './Dashboard.css';
import { AppStats } from '../types';

interface DashboardProps {
  stats: AppStats;
  proxyConfig: { host: string; port: number; type: string } | null;
  isRunning: boolean;
}

// Animated counter hook
function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const startValRef = useRef<number>(0);

  useEffect(() => {
    startValRef.current = value;
    startRef.current = 0;
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(Math.round(startValRef.current + (target - startValRef.current) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);

  return value;
}

function StatCard({ label, value, color, delay }: {
  label: string; value: number; color: string; delay: number;
}) {
  const animated = useCountUp(value);
  return (
    <div className={`stat-card stat-card-${color}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="stat-icon">
        <div className="stat-icon-glow" />
        <div className="stat-icon-inner">{STAT_ICONS[color]}</div>
      </div>
      <div className="stat-body">
        <div className="stat-value">{animated.toLocaleString()}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

const STAT_ICONS: Record<string, string> = {
  total: '⬡',
  proxy:  '◈',
  direct: '◎',
  block:  '⊘',
};

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

function DonutChart({ segments, total }: { segments: DonutSegment[]; total: number }) {
  const r = 46;
  const cx = 56;
  const cy = 56;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const paths = segments
    .filter((s) => s.value > 0)
    .map((seg) => {
      const pct = total > 0 ? seg.value / total : 0;
      const dashLen = pct * circumference;
      const dashGap = circumference - dashLen;
      const el = { ...seg, dashArray: `${dashLen} ${dashGap}`, offset };
      offset += dashLen;
      return el;
    });

  return (
    <div className="donut-container">
      <div className="donut-chart">
        <svg className="donut-svg" width="112" height="112" viewBox="0 0 112 112">
          {/* track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-tertiary)" strokeWidth="10" />
          {/* segments */}
          {paths.map((p, i) => (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={p.color}
              strokeWidth="10"
              strokeDasharray={p.dashArray}
              strokeDashoffset={-p.offset + circumference * 0.25}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)' }}
            />
          ))}
        </svg>
        <div className="donut-center">
          <span className="donut-total">{total.toLocaleString()}</span>
          <span className="donut-label">total</span>
        </div>
      </div>
      <div className="donut-legend">
        {segments.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <div key={s.label} className="legend-item">
              <div className="legend-dot" style={{ background: s.color }} />
              <div className="legend-info">
                <span className="legend-name">{s.label}</span>
                <span className="legend-value">{s.value.toLocaleString()}</span>
              </div>
              <span className="legend-pct">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DistributionBar({ label, count, total, color }: {
  label: string; count: number; total: number; color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="dist-bar-row">
      <div className="dist-bar-label">
        <span>{label}</span>
      </div>
      <div className="dist-bar-track">
        <div
          className="dist-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="dist-bar-pct">{pct.toFixed(1)}%</span>
    </div>
  );
}

export function Dashboard({ stats, proxyConfig, isRunning }: DashboardProps) {
  const segments: DonutSegment[] = [
    { label: 'Proxy',  value: stats.proxyConnections,  color: 'var(--color-proxy)' },
    { label: 'Direct', value: stats.directConnections,  color: 'var(--color-direct)' },
    { label: 'Blocked',value: stats.blockedConnections, color: 'var(--color-block)' },
  ];

  return (
    <div className="dashboard">
      {/* Stats */}
      <div className="stats-grid">
        <StatCard label="Total Connections" value={stats.totalConnections} color="total" delay={0} />
        <StatCard label="Via Proxy"         value={stats.proxyConnections}  color="proxy"  delay={60} />
        <StatCard label="Direct"            value={stats.directConnections}  color="direct" delay={120} />
        <StatCard label="Blocked"           value={stats.blockedConnections} color="block"  delay={180} />
      </div>

      {/* Bottom row */}
      <div className="dashboard-bottom">
        {/* Proxy Status */}
        <div className="glass-card">
          <div className="card-header">
            <span className="card-title">Proxy Status</span>
            <span className={`badge ${isRunning ? 'badge-running' : 'badge-stopped'}`}>
              {isRunning ? '● Active' : '○ Inactive'}
            </span>
          </div>
          <div className="card-body">
            {proxyConfig ? (
              <div className="proxy-info">
                <div className="proxy-info-row">
                  <span className="proxy-info-label">Type</span>
                  <span className="tag tag-proxy">{proxyConfig.type}</span>
                </div>
                <div className="proxy-info-row">
                  <span className="proxy-info-label">Endpoint</span>
                  <span className="proxy-info-value">{proxyConfig.host}:{proxyConfig.port}</span>
                </div>
                <div className="proxy-info-row">
                  <span className="proxy-info-label">Active Rules</span>
                  <span className="proxy-info-value">{stats.activeRules}</span>
                </div>
                <div className="proxy-info-row">
                  <span className="proxy-info-label">Uptime</span>
                  <span className="proxy-info-value">{stats.uptime}</span>
                </div>
              </div>
            ) : (
              <p className="proxy-info-empty">No proxy configured — go to Settings.</p>
            )}
          </div>
        </div>

        {/* Traffic Distribution */}
        <div className="glass-card">
          <div className="card-header">
            <span className="card-title">Traffic Distribution</span>
          </div>
          <div className="card-body">
            {stats.totalConnections > 0 ? (
              <DonutChart segments={segments} total={stats.totalConnections} />
            ) : (
              <div className="distribution-bars">
                {segments.map((s) => (
                  <DistributionBar key={s.label} label={s.label} count={s.value} total={1} color={s.color} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
