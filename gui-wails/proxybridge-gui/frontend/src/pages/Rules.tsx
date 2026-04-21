import React, { useState, useEffect, useRef } from 'react';
import './Rules.css';
import { ProxyRule } from '../types';

interface RulesProps {
  rules: ProxyRule[];
  onAddRule: (rule: Omit<ProxyRule, 'id'>) => void;
  onDeleteRule: (id: number) => void;
  onToggleRule: (id: number) => void;
  onEditRule: (rule: ProxyRule) => void;
  prefillTemplate?: {
    processName: string;
    targetHosts: string;
    targetPorts: string;
    protocol: 'TCP' | 'UDP' | 'BOTH';
    action: 'PROXY' | 'DIRECT' | 'BLOCK';
  };
}

export function Rules({
  rules,
  onAddRule,
  onDeleteRule,
  onToggleRule,
  onEditRule,
  prefillTemplate,
}: RulesProps) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    processName: '*',
    targetHosts: '*',
    targetPorts: '*',
    protocol: 'TCP' as 'TCP' | 'UDP' | 'BOTH',
    action: 'PROXY' as 'PROXY' | 'DIRECT' | 'BLOCK',
  });

  // When parent pushes a prefill template, open and prefill the form
  useEffect(() => {
    if (prefillTemplate) {
      setForm({
        processName: prefillTemplate.processName || '*',
        targetHosts: prefillTemplate.targetHosts || '*',
        targetPorts: prefillTemplate.targetPorts || '*',
        protocol: prefillTemplate.protocol || 'TCP',
        action: prefillTemplate.action || 'PROXY',
      });
      setShowForm(true);
      setEditingId(null);
    }
  }, [prefillTemplate]);

  // Scroll form into view when it opens
  useEffect(() => {
    if (showForm && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [showForm]);

  function openAddForm() {
    setForm({ processName: '', targetHosts: '*', targetPorts: '*', protocol: 'TCP', action: 'PROXY' });
    setEditingId(null);
    setShowForm(true);
  }

  function openEditForm(rule: ProxyRule) {
    setForm({
      processName: rule.processName,
      targetHosts: rule.targetHosts,
      targetPorts: rule.targetPorts,
      protocol: rule.protocol,
      action: rule.action,
    });
    setEditingId(rule.id);
    setShowForm(true);
  }

  function handleSave() {
    if (!form.processName.trim()) return;
    if (editingId !== null) {
      onEditRule({ id: editingId, ...form, enabled: rules.find((r) => r.id === editingId)?.enabled ?? true });
    } else {
      onAddRule({ ...form, enabled: true });
    }
    setShowForm(false);
    setEditingId(null);
  }

  function handleClose() {
    setShowForm(false);
    setEditingId(null);
  }

  const filtered = rules.filter(
    (r) =>
      r.processName.toLowerCase().includes(search.toLowerCase()) ||
      r.targetHosts.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="rules-page">
      {/* Toolbar */}
      <div className="rules-toolbar">
        <div className="rules-toolbar-left">
          <input
            className="search-input"
            placeholder="Search rules…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {rules.length > 0 && (
            <span className="conn-count">{filtered.length} / {rules.length}</span>
          )}
        </div>
        <div className="rules-toolbar-right">
          <button className="btn btn-secondary btn-sm">Import</button>
          <button className="btn btn-secondary btn-sm">Export</button>
          <button className="btn btn-primary btn-sm" onClick={openAddForm}>
            + Add Rule
          </button>
        </div>
      </div>

      {/* Slide-in Form Panel */}
      {showForm && (
        <div className="rule-form-panel" ref={formRef}>
          <div className="rule-form-header">
            <span className="rule-form-title">
              {editingId !== null ? 'Edit Rule' : 'New Rule'}
            </span>
            <button className="rule-form-close" onClick={handleClose}>×</button>
          </div>
          <div className="rule-form-grid">
            <div className="form-group">
              <label className="form-label">Process</label>
              <input
                value={form.processName}
                onChange={(e) => setForm({ ...form, processName: e.target.value })}
                placeholder="e.g. chrome, *"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Target Hosts</label>
              <input
                value={form.targetHosts}
                onChange={(e) => setForm({ ...form, targetHosts: e.target.value })}
                placeholder="* or google.com"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Target Ports</label>
              <input
                value={form.targetPorts}
                onChange={(e) => setForm({ ...form, targetPorts: e.target.value })}
                placeholder="* or 443 or 80;8080"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Protocol</label>
              <select
                value={form.protocol}
                onChange={(e) => setForm({ ...form, protocol: e.target.value as typeof form.protocol })}
              >
                <option value="TCP">TCP</option>
                <option value="UDP">UDP</option>
                <option value="BOTH">BOTH</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Action</label>
              <select
                value={form.action}
                onChange={(e) => setForm({ ...form, action: e.target.value as typeof form.action })}
              >
                <option value="PROXY">PROXY</option>
                <option value="DIRECT">DIRECT</option>
                <option value="BLOCK">BLOCK</option>
              </select>
            </div>
          </div>
          <div className="rule-form-actions">
            <button className="btn btn-secondary btn-sm" onClick={handleClose}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>
              {editingId !== null ? 'Update Rule' : 'Save Rule'}
            </button>
          </div>
        </div>
      )}

      {/* Rules Table */}
      <div className="rules-table-wrapper">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">⊞</div>
            <div className="empty-state-text">
              {rules.length === 0
                ? 'No rules yet. Add one to get started.'
                : 'No rules match your search.'}
            </div>
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
                      <button className="action-btn" onClick={() => openEditForm(rule)}>Edit</button>
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
