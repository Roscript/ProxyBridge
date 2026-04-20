import React, { useState } from 'react';
import './style.css';
import './components/layout/App.css';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './pages/Dashboard';
import { Rules } from './pages/Rules';
import { Connections } from './pages/Connections';
import { Settings } from './pages/Settings';
import type { ProxyRule, ConnectionLog, AppStats, ProxyConfig } from './types';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  rules: 'Proxy Rules',
  connections: 'Connections',
  settings: 'Settings',
};

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [isRunning, setIsRunning] = useState(false);
  const [rules, setRules] = useState<ProxyRule[]>([]);
  const [connections, setConnections] = useState<ConnectionLog[]>([]);
  const [proxyConfig, setProxyConfig] = useState<ProxyConfig | null>(null);

  // Mock stats (will come from Go backend)
  const [stats] = useState<AppStats>({
    totalConnections: 1247,
    proxyConnections: 892,
    directConnections: 305,
    blockedConnections: 50,
    activeRules: rules.filter((r) => r.enabled).length,
    uptime: '2h 34m',
  });

  function handleAddRule(rule: Omit<ProxyRule, 'id'>) {
    const id = rules.length > 0 ? Math.max(...rules.map((r) => r.id)) + 1 : 1;
    setRules([...rules, { ...rule, id }]);
  }

  function handleDeleteRule(id: number) {
    setRules(rules.filter((r) => r.id !== id));
  }

  function handleToggleRule(id: number) {
    setRules(rules.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }

  function handleEditRule(rule: ProxyRule) {
    // For now just toggle delete — edit modal would go here
    setRules(rules.map((r) => r.id === rule.id ? rule : r));
  }

  function handleToggleRunning() {
    setIsRunning(!isRunning);
    if (!isRunning) {
      setConnections([]);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar activePage={page} onNavigate={setPage} />
      <div className="app-main">
        <Header
          title={PAGE_TITLES[page]}
          isRunning={isRunning}
          onToggleRunning={handleToggleRunning}
        />
        <div className="app-content">
          {page === 'dashboard' && (
            <Dashboard
              stats={{ ...stats, activeRules: rules.filter((r) => r.enabled).length }}
              proxyConfig={proxyConfig}
              isRunning={isRunning}
            />
          )}
          {page === 'rules' && (
            <Rules
              rules={rules}
              onAddRule={handleAddRule}
              onDeleteRule={handleDeleteRule}
              onToggleRule={handleToggleRule}
              onEditRule={handleEditRule}
            />
          )}
          {page === 'connections' && (
            <Connections connections={connections} />
          )}
          {page === 'settings' && (
            <Settings
              proxyConfig={proxyConfig}
              onSaveProxy={setProxyConfig}
              onTestConnection={async (host, port) => 'Connection successful!'}
            />
          )}
        </div>
      </div>
    </div>
  );
}
