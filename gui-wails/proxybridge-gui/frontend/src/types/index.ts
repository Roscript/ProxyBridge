// ProxyBridge Core API Types — mirrors ProxyBridge.h

export type ProxyType = 'HTTP' | 'SOCKS5';
export type RuleAction = 'PROXY' | 'DIRECT' | 'BLOCK';
export type RuleProtocol = 'TCP' | 'UDP' | 'BOTH';

export interface ProxyConfig {
  type: ProxyType;
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface ProxyRule {
  id: number;
  processName: string;
  targetHosts: string;
  targetPorts: string;
  protocol: RuleProtocol;
  action: RuleAction;
  enabled: boolean;
}

export interface ConnectionLog {
  id: string;
  timestamp: string;
  processName: string;
  pid: number;
  destIp: string;
  destPort: number;
  action: RuleAction;
  proxyInfo: string;
}

export interface AppStats {
  totalConnections: number;
  proxyConnections: number;
  directConnections: number;
  blockedConnections: number;
  activeRules: number;
  uptime: string;
}
