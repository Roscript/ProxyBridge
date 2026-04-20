import React, { useState } from 'react';
import './Rules.css';
import { ProxyRule } from '../types';

interface RulesProps {
  rules: ProxyRule[];
  onAddRule: (rule: Omit<ProxyRule, 'id'>) => void;
  onDeleteRule: (id: number) => void;
  onToggleRule: (id: number) => void;
  onEditRule: (rule: ProxyRule) => void;
}

export function Rules({ rules, onAddRule, onDeleteRule, onToggleRule, onEditRule }: RulesProps) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [form, setForm] = useState({
    processName: '',
    targetHosts: '*',
    targetPorts: '*',
    protocol: 'TCP' as const,
    action: 'PROXY' as const,
  });

  const filtered = rules.filter((r) =>
    r.processName.toLowerCase().includes(search.toLowerCase()) ||
    r.targetHosts.toLowerCase().includes(search.toLowerCase())
  );

  function handleAdd() {
    if (!form.processName.trim()) return;
    onAddRule({ ...form, enabled: true });
    setForm({ processName: '', targetHosts: '*', targetPorts: '*', protocol: 'TCP', action: 'PROXY' });
    setShowForm(false);
  }

  return (
    <div className="rules-page">
      <div className="rules-toolbar">
        <div className="rules-toolbar-left">
          <input
            className="search-input"
            placeholder="Search rules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="rules-toolbar-right">
          <button className="btn btn-secondary">Import</button>
          <button className="btn btn-secondary">Export</button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Add Rule
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card rule-form">
          <div className="rule-form-grid">
            <div className="form-group">
              <label>Process</label>
              <input
                value={form.processName}
                onChange={(e) => setForm({ ...form, processName: e.target.value })}
                placeholder="e.g. chrome, *"
              />
            </div>
            <div className="form-group">
              <label>Target Hosts</label>
              <input
                value={form.targetHosts}
                onChange={(e) => setForm({ ...form, targetHosts: e.target.value })}
                placeholder="* or google.com"
              />
            </div>
            <div className="form-group">
              <label>Target Ports</label>
              <input
                value={form.targetPorts}
                onChange={(e) => setForm({ ...form, targetPorts: e.target.value })}
                placeholder="* or 443 or 80;8080"
              />
            </div>
            <div className="form-group">
              <label>Protocol</label>
              <select
                value={form.protocol}
                onChange={(e) => setForm({ ...form, protocol: e.target.value as any })}
              >
                <option value="TCP">TCP</option>
                <option value="UDP">UDP</option>
                <option value="BOTH">BOTH</option>
              </select>
            </div>
            <div className="form-group">
              <label>Action</label>
              <select
                value={form.action}
                onChange={(e) => setForm({ ...form, action: e.target.value as any })}
              >
                <option value="PROXY">PROXY</option>
                <option value="DIRECT">DIRECT</option>
                <option value="BLOCK">BLOCK</option>
              </select>
            </div>
          </div>
          <div className="rule-form-actions">
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd}>Save Rule</button>
          </div>
        </div>
      )}

      <div className="rules-table-wrapper">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">⊞</div>
            <div className="empty-state-text">No rules yet. Add one to get started.</div>
          </div>
        ) : (
          <table className="rules-table">
            <thead>
              <tr>
                <th className="rule-col-enabled">ON</th>
                <th className="rule-col-process">Process</th>
                <th className="rule-col-hosts">Target Hosts</th>
                <th className="rule-col-ports">Ports</th>
                <th className="rule-col-protocol">Protocol</th>
                <th className="rule-col-action">Action</th>
                <th className="rule-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rule) => (
                <tr key={rule.id} className={rule.enabled ? '' : 'disabled'}>
                  <td style={{ textAlign: 'center' }}>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => onToggleRule(rule.id)}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>{rule.processName}</td>
                  <td className="text-secondary" style={{ fontSize: 12 }}>{rule.targetHosts}</td>
                  <td className="mono text-secondary" style={{ fontSize: 12 }}>{rule.targetPorts}</td>
                  <td>
                    <span className={`tag ${rule.protocol === 'TCP' ? 'tag-tcp' : rule.protocol === 'UDP' ? 'tag-udp' : ''}`}>
                      {rule.protocol}
                    </span>
                  </td>
                  <td>
                    <span className={`tag tag-${rule.action.toLowerCase()}`}>
                      {rule.action}
                    </span>
                  </td>
                  <td>
                    <div className="action-cell">
                      <button className="action-btn" onClick={() => onEditRule(rule)}>Edit</button>
                      <button className="action-btn delete" onClick={() => onDeleteRule(rule.id)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
