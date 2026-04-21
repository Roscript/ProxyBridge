import React, { useState, useRef, useEffect, useCallback } from 'react';
import './Connections.css';
import type { ConnectionLog } from '../types';
import type { RuleTemplate } from '../App';

interface ConnectionsProps {
  connections: ConnectionLog[];
  onQuickAddRule: (template: RuleTemplate) => void;
  maxDisplay?: number;
}

type FilterAction = 'ALL' | 'PROXY' | 'DIRECT' | 'BLOCK';

const ACTION_COLOR: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  PROXY:  { text: '#3fd6c0', bg: 'rgba(63,214,192,0.08)',  border: '#3fd6c0', glow: 'rgba(63,214,192,0.25)' },
  DIRECT: { text: '#8a8fa0', bg: 'rgba(138,143,160,0.08)', border: '#8a8fa0', glow: 'rgba(138,143,160,0.25)' },
  BLOCK:  { text: '#f05555', bg: 'rgba(240,85,85,0.08)',   border: '#f05555', glow: 'rgba(240,85,85,0.25)' },
};

// Tiny sparkline — shows recent connection density per second bucket
function Sparkline({ history }: { history: number[] }) {
  if (history.length < 2) return null;
  const max = Math.max(...history, 1);
  const w = 48, h = 20;
  const pts = history.map((v, i) => {
    const x = (i / (history.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} className="conn-sparkline" viewBox={`0 0 ${w} ${h}`}>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="var(--accent-blue)"
        strokeWidth="1.5"
        strokeOpacity="0.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Connections({ connections, onQuickAddRule, maxDisplay = 400 }: ConnectionsProps) {
  const [filter, setFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<FilterAction>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ conn: ConnectionLog; x: number; y: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build per-second connection count for sparkline
  const [tick, setTick] = useState(0);
  const historyRef = useRef<number[]>(Array(20).fill(0));
  const tickRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current++;
      historyRef.current.push(0);
      if (historyRef.current.length > 20) historyRef.current.shift();
      setTick(tickRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Count connections in last 1-second window
  const now = Date.now();
  const recentCount = connections.filter((c) => {
    try {
      const t = new Date(c.timestamp).getTime();
      return now - t < 1000;
    } catch {
      return false;
    }
  }).length;
  historyRef.current[historyRef.current.length - 1] = recentCount;

  const filtered = connections.filter((c) => {
    const matchText =
      !filter ||
      c.processName.toLowerCase().includes(filter.toLowerCase()) ||
      c.destIp.toLowerCase().includes(filter.toLowerCase()) ||
      c.destPort.toString().includes(filter);
    const matchAction = actionFilter === 'ALL' || c.action === actionFilter;
    return matchText && matchAction;
  });

  const display = filtered.slice(-maxDisplay);

  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [connections, autoScroll]);

  // ESC closes context menu
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    // slight delay so the click that opened the menu doesn't immediately close it
    const t = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => { document.removeEventListener('click', handler); clearTimeout(t); };
  }, [contextMenu]);

  const quickAdd = useCallback((conn: ConnectionLog, action: RuleTemplate['action']) => {
    const template: RuleTemplate = {
      processName: conn.processName.replace(/\.exe$/i, ''),
      targetHosts: conn.destIp,
      targetPorts: conn.destPort.toString(),
      protocol: 'TCP',
      action,
    };
    onQuickAddRule(template);
    setContextMenu(null);
  }, [onQuickAddRule]);

  const handleContextMenu = useCallback((e: React.MouseEvent, conn: ConnectionLog) => {
    e.preventDefault();
    setContextMenu({ conn, x: e.clientX, y: e.clientY });
  }, []);

  return (
    <div className="connections-page">
      {/* Toolbar */}
      <div className="conn-toolbar">
        <div className="conn-toolbar-left">
          <input
            className="search-input"
            placeholder="Filter process, IP, port…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select
            className="filter-select"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as FilterAction)}
          >
            <option value="ALL">All</option>
            <option value="PROXY">Proxy</option>
            <option value="DIRECT">Direct</option>
            <option value="BLOCK">Block</option>
          </select>
        </div>
        <div className="conn-toolbar-right">
          <Sparkline history={historyRef.current} />
          <span className="conn-live-indicator" title="Connections in last second">
            <span className="live-dot" />
            <span className="live-count">{recentCount}/s</span>
          </span>
          <label className="auto-scroll-toggle">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            <span>Auto-scroll</span>
          </label>
          <span className="conn-count">{filtered.length} / {connections.length}</span>
        </div>
      </div>

      {/* Connection List */}
      <div className="conn-list" ref={listRef}>
        {display.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">⇄</div>
            <div className="empty-state-text">
              No connections yet.{' '}
              <br />
              Start the proxy to see live traffic.
            </div>
          </div>
        ) : (
          display.map((conn) => {
            const ac = ACTION_COLOR[conn.action] || ACTION_COLOR.DIRECT;
            return (
              <div
                key={conn.id}
                className={`conn-row conn-action-${conn.action.toLowerCase()}`}
                onContextMenu={(e) => handleContextMenu(e, conn)}
              >
                {/* Left accent bar */}
                <div className="conn-accent" style={{ background: ac.border }} />

                {/* Action badge */}
                <span
                  className="conn-action-badge"
                  style={{
                    background: ac.bg,
                    color: ac.text,
                    borderColor: ac.border,
                  }}
                >
                  {conn.action}
                </span>

                {/* Time */}
                <span className="conn-time mono">{conn.timestamp.split(' ')[1] ?? conn.timestamp}</span>

                {/* Process name */}
                <span className="conn-process truncate" title={conn.processName}>
                  {conn.processName}
                </span>

                {/* PID */}
                <span className="conn-pid text-muted">PID {conn.pid}</span>

                {/* Arrow */}
                <span className="conn-arrow">→</span>

                {/* Destination */}
                <span className="conn-dest mono">{conn.destIp}:{conn.destPort}</span>

                {/* Proxy info */}
                <span className="conn-proxy text-muted truncate" title={conn.proxyInfo}>
                  {conn.proxyInfo}
                </span>

                {/* Quick-add buttons (appear on hover) */}
                <div className="conn-quick-actions">
                  <button
                    className="quick-btn quick-proxy"
                    title="Quick add: Route via Proxy"
                    onClick={() => quickAdd(conn, 'PROXY')}
                  >
                    + Proxy
                  </button>
                  <button
                    className="quick-btn quick-direct"
                    title="Quick add: Route Direct"
                    onClick={() => quickAdd(conn, 'DIRECT')}
                  >
                    + Direct
                  </button>
                  <button
                    className="quick-btn quick-block"
                    title="Quick add: Block this host"
                    onClick={() => quickAdd(conn, 'BLOCK')}
                  >
                    + Block
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-header">
            <span className="context-process">{contextMenu.conn.processName}</span>
            <span className="context-dest mono">{contextMenu.conn.destIp}:{contextMenu.conn.destPort}</span>
          </div>
          <div className="context-menu-divider" />
          <button className="context-item" onClick={() => quickAdd(contextMenu.conn, 'PROXY')}>
            <span className="context-dot" style={{ color: ACTION_COLOR.PROXY.text }}>●</span>
            Route via Proxy
          </button>
          <button className="context-item" onClick={() => quickAdd(contextMenu.conn, 'DIRECT')}>
            <span className="context-dot" style={{ color: ACTION_COLOR.DIRECT.text }}>●</span>
            Route Direct
          </button>
          <button className="context-item context-block" onClick={() => quickAdd(contextMenu.conn, 'BLOCK')}>
            <span className="context-dot" style={{ color: ACTION_COLOR.BLOCK.text }}>●</span>
            Block this host
          </button>
          <div className="context-menu-divider" />
          <button
            className="context-item context-sub"
            onClick={() => {
              quickAdd(contextMenu.conn, 'PROXY');
              setTimeout(() => document.dispatchEvent(new CustomEvent('open-rules-page')), 50);
            }}
          >
            → Edit in Rules panel
          </button>
        </div>
      )}
    </div>
  );
}
