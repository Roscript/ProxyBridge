import React from 'react';
import './Settings.css';
import { ProxyConfig } from '../types';

interface SettingsProps {
  proxyConfig: ProxyConfig | null;
  onSaveProxy: (config: ProxyConfig) => void;
  onTestConnection: (host: string, port: number) => Promise<string>;
}

export function Settings({ proxyConfig, onSaveProxy, onTestConnection }: SettingsProps) {
  const [form, setForm] = React.useState<ProxyConfig>(
    proxyConfig ?? { type: 'SOCKS5', host: '127.0.0.1', port: 1080, username: '', password: '' }
  );
  const [testResult, setTestResult] = React.useState<string | null>(null);
  const [testLoading, setTestLoading] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (proxyConfig) setForm(proxyConfig);
  }, [proxyConfig]);

  async function handleTest() {
    setTestLoading(true);
    setTestResult(null);
    try {
      const result = await onTestConnection(form.host, form.port);
      setTestResult(result);
    } catch (e: any) {
      setTestResult('Error: ' + e.message);
    } finally {
      setTestLoading(false);
    }
  }

  function handleSave() {
    onSaveProxy(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="settings-page">
      <div className="settings-section">
        <h2 className="settings-section-title">Proxy Configuration</h2>
        <div className="card settings-card">
          <div className="settings-grid">
            <div className="form-group">
              <label>Proxy Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
              >
                <option value="SOCKS5">SOCKS5</option>
                <option value="HTTP">HTTP</option>
              </select>
            </div>
            <div className="form-group">
              <label>Host</label>
              <input
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                placeholder="127.0.0.1 or proxy.example.com"
              />
            </div>
            <div className="form-group">
              <label>Port</label>
              <input
                type="number"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 0 })}
                placeholder="1080"
              />
            </div>
            <div className="form-group">
              <label>Username <span className="text-muted">(optional)</span></label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Leave empty for no auth"
              />
            </div>
            <div className="form-group">
              <label>Password <span className="text-muted">(optional)</span></label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
          </div>

          {testResult !== null && (
            <div className={`test-result ${testResult.startsWith('Error') ? 'test-error' : 'test-success'}`}>
              {testResult}
            </div>
          )}

          <div className="settings-actions">
            <button className="btn btn-secondary" onClick={handleTest} disabled={testLoading}>
              {testLoading ? 'Testing...' : 'Test Connection'}
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              {saved ? '✓ Saved' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2 className="settings-section-title">Options</h2>
        <div className="card settings-card">
          <div className="options-list">
            <OptionToggle label="Route DNS through proxy" description="Affects DNS requests made by matched processes" />
            <OptionToggle label="Route localhost through proxy" description="Allow proxying connections to 127.0.0.1" />
            <OptionToggle label="Start with Windows" description="Launch ProxyBridge when system starts" />
            <OptionToggle label="Traffic logging" description="Record all connection events" />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2 className="settings-section-title">About</h2>
        <div className="card settings-card">
          <div className="about-info">
            <div className="about-row">
              <span className="text-secondary">Version</span>
              <span className="mono">3.2.0</span>
            </div>
            <div className="about-row">
              <span className="text-secondary">Platform</span>
              <span className="mono">Windows / macOS / Linux</span>
            </div>
            <div className="about-row">
              <span className="text-secondary">License</span>
              <span className="mono">MIT</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionToggle({ label, description }: { label: string; description: string }) {
  const [enabled, setEnabled] = React.useState(false);
  return (
    <div className="option-row">
      <div className="option-info">
        <div className="option-label">{label}</div>
        <div className="option-desc text-muted">{description}</div>
      </div>
      <label className="toggle">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span className="toggle-slider" />
      </label>
    </div>
  );
}
