import React from 'react';
import './Dashboard.css';
import { AppStats } from '../types';

interface DashboardProps {
  stats: AppStats;
  proxyConfig: { host: string; port: number; type: string } | null;
  isRunning: boolean;
}

export function Dashboard({ stats, proxyConfig, isRunning }: DashboardProps) {
  return (
    <div className="dashboard">
      {/* Stats Cards */}
      <div className="stats-grid">
        <StatCard
          label="Total Connections"
          value={stats.totalConnections.toLocaleString()}
          icon="⟫"
          color="blue"
        />
        <StatCard
          label="Via Proxy"
          value={stats.proxyConnections.toLocaleString()}
          icon="◈"
          color="proxy"
        />
        <StatCard
          label="Direct"
          value={stats.directConnections.toLocaleString()}
          icon="◎"
          color="direct"
        />
        <StatCard
          label="Blocked"
          value={stats.blockedConnections.toLocaleString()}
          icon="⊘"
          color="block"
        />
      </div>

      {/* Bottom row */}
      <div className="dashboard-bottom">
        {/* Proxy Status */}
        <div className="card proxy-status-card">
          <div className="card-header">
            <span className="card-title">Proxy Status</span>
            <span className={`badge ${isRunning ? 'badge-running' : 'badge-stopped'}`}>
              {isRunning ? '● Active' : '○ Inactive'}
            </span>
          </div>
          <div className="proxy-info">
            {proxyConfig ? (
              <>
                <div className="proxy-info-row">
                  <span className="proxy-info-label">Type</span>
                  <span className="tag tag-proxy">{proxyConfig.type}</span>
                </div>
                <div className="proxy-info-row">
                  <span className="proxy-info-label">Endpoint</span>
                  <span className="mono text-secondary">
                    {proxyConfig.host}:{proxyConfig.port}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-muted">No proxy configured</div>
            )}
          </div>
          <div className="card-footer">
            <span className="text-muted" style={{ fontSize: 12 }}>
              Active Rules: {stats.activeRules}
            </span>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Uptime: {stats.uptime}
            </span>
          </div>
        </div>

        {/* Connection Distribution */}
        <div className="card distribution-card">
          <div className="card-header">
            <span className="card-title">Traffic Distribution</span>
          </div>
          <div className="distribution-bars">
            <DistributionBar
              label="Proxy"
              count={stats.proxyConnections}
              total={stats.totalConnections}
              color="var(--color-proxy)"
            />
            <DistributionBar
              label="Direct"
              count={stats.directConnections}
              total={stats.totalConnections}
              color="var(--color-direct)"
            />
            <DistributionBar
              label="Blocked"
              count={stats.blockedConnections}
              total={stats.totalConnections}
              color="var(--color-block)"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: {
  label: string; value: string; icon: string; color: string;
}) {
  return (
    <div className={`stat-card stat-card-${color}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-body">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
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
        <span className="text-secondary" style={{ fontSize: 12 }}>{count}</span>
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
