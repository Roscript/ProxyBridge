import React from 'react';
import './Header.css';

interface HeaderProps {
  title: string;
  isRunning: boolean;
  onToggleRunning: () => void;
}

export function Header({ title, isRunning, onToggleRunning }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-left">
        <h1 className="header-title">{title}</h1>
      </div>

      <div className="header-right">
        <div className="status-indicator">
          <span className={`status-dot ${isRunning ? 'running' : 'stopped'}`} />
          <span className="status-text">
            {isRunning ? 'Running' : 'Stopped'}
          </span>
        </div>

        <button
          className={`toggle-btn ${isRunning ? 'btn-stop' : 'btn-start'}`}
          onClick={onToggleRunning}
        >
          {isRunning ? '■ Stop' : '▶ Start'}
        </button>
      </div>
    </header>
  );
}
