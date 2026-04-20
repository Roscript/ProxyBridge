import React, { useState, useRef, useEffect } from 'react';
import './Connections.css';
import { ConnectionLog } from '../types';

interface ConnectionsProps {
  connections: ConnectionLog[];
  maxDisplay?: number;
}

export function Connections({ connections, maxDisplay = 500 }: ConnectionsProps) {
  const [filter, setFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = connections.filter((c) => {
    const matchText =
      !filter ||
      c.processName.toLowerCase().includes(filter.toLowerCase()) ||
      c.destIp.includes(filter) ||
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

  return (
    <div className="connections-page">
      {/* Toolbar */}
      <div className="conn-toolbar">
        <div className="conn-toolbar-left">
          <input
            className="search-input"
            placeholder="Filter process, IP, port..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select
            className="filter-select"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="ALL">All Actions</option>
            <option value="PROXY">Proxy</option>
            <option value="DIRECT">Direct</option>
            <option value="BLOCK">Block</option>
          </select>
        </div>
        <div className="conn-toolbar-right">
          <label className="auto-scroll-toggle">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            <span>Auto-scroll</span>
          </label>
          <span className="conn-count">{filtered.length} connections</span>
        </div>
      </div>

      {/* Connection List */}
      <div className="conn-list" ref={listRef}>
        {display.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">⇄</div>
            <div className="empty-state-text">No connections yet. Start the proxy to see traffic.</div>
          </div>
        ) : (
          display.map((conn) => (
            <div key={conn.id} className={`conn-row conn-action-${conn.action.toLowerCase()}`}>
              <span className={`conn-action-badge tag-${conn.action.toLowerCase()}`}>
                {conn.action}
              </span>
              <span className="conn-time mono">{conn.timestamp}</span>
              <span className="conn-process truncate">{conn.processName}</span>
              <span className="conn-pid text-muted">PID {conn.pid}</span>
              <span className="conn-arrow">→</span>
              <span className="conn-dest mono">{conn.destIp}:{conn.destPort}</span>
              <span className="conn-proxy text-muted">{conn.proxyInfo}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
