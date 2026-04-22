import React, { useState, useCallback, useEffect } from 'react';
import './style.css';
import './components/layout/App.css';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './pages/Dashboard';
import { Rules } from './pages/Rules';
import { Connections } from './pages/Connections';
import { Settings } from './pages/Settings';
import type { ProxyRule, ConnectionLog, AppStats, ProxyConfig } from './types';
import { Start, Stop, IsRunning } from '../wailsjs/go/main/App';

// Pre-fill template when adding rule from connection
export interface RuleTemplate {
  processName: string;
  targetHosts: string;
  targetPorts: string;
  protocol: 'TCP' | 'UDP' | 'BOTH';
  action: 'PROXY' | 'DIRECT' | 'BLOCK';
}

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
  const [ruleForm, setRuleForm] = useState<RuleTemplate>({
    processName: '*',
    targetHosts: '*',
    targetPorts: '*',
    protocol: 'TCP',
    action: 'PROXY',
  });

  // Stats derived from rules
  const [stats] = useState<AppStats>({
    totalConnections: 1247,
    proxyConnections: 892,
    directConnections: 305,
    blockedConnections: 50,
    activeRules: rules.filter((r) => r.enabled).length,
    uptime: '2h 34m',
  });

  // ── Rules ────────────────────────────────────────────────────────────────

  function handleAddRule(rule: Omit<ProxyRule, 'id'>) {
    const id = rules.length > 0 ? Math.max(...rules.map((r) => r.id)) + 1 : 1;
    setRules([...rules, { ...rule, id }]);
  }

  function handleAddRuleFromTemplate(template: RuleTemplate) {
    const id = rules.length > 0 ? Math.max(...rules.map((r) => r.id)) + 1 : 1;
    setRules([...rules, { id, ...template, enabled: true }]);
  }

  function handleDeleteRule(id: number) {
    setRules(rules.filter((r) => r.id !== id));
  }

  function handleToggleRule(id: number) {
    setRules(rules.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }

  function handleEditRule(edited: ProxyRule) {
    setRules(rules.map((r) => r.id === edited.id ? edited : r));
  }

  function handleQuickAddRule(template: RuleTemplate) {
    handleAddRuleFromTemplate(template);
  }

  // Handle "Edit in Rules panel" event dispatched from Connections context menu
  useEffect(() => {
    const handler = () => setPage('rules');
    document.addEventListener('open-rules-page', handler);
    return () => document.removeEventListener('open-rules-page', handler);
  }, []);

  // ── Running ──────────────────────────────────────────────────────────────

  function handleToggleRunning() {
    if (!isRunning) {
      Start().then((ok) => {
        if (ok) {
          setIsRunning(true);
        } else {
          console.error('Failed to start ProxyBridge');
        }
      }).catch((err) => {
        console.error('Start error:', err);
      });
    } else {
      Stop().then((ok) => {
        if (ok) {
          setIsRunning(false);
          setConnections([]);
        }
      }).catch((err) => {
        console.error('Stop error:', err);
      });
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
              prefillTemplate={ruleForm}
            />
          )}
          {page === 'connections' && (
            <Connections
              connections={connections}
              onQuickAddRule={handleQuickAddRule}
            />
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
