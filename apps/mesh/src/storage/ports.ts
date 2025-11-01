/**
 * Storage Port Interfaces
 * 
 * These interfaces define the contracts for storage adapters.
 * Following the Ports & Adapters (Hexagonal Architecture) pattern.
 */

import type { MCPConnection, OAuthConfig } from './types';

// ============================================================================
// Connection Storage Port
// ============================================================================

export interface CreateConnectionData {
  organizationId: string; // All connections are organization-scoped
  createdById: string;
  name: string;
  description?: string;
  icon?: string;
  appName?: string;
  appId?: string;
  connection: {
    type: 'HTTP' | 'SSE' | 'Websocket';
    url: string;
    token?: string;
    headers?: Record<string, string>;
  };
  oauthConfig?: OAuthConfig; // OAuth config for downstream MCP
  metadata?: Record<string, any>;
}

export interface UpdateConnectionData {
  name?: string;
  description?: string;
  icon?: string;
  status?: 'active' | 'inactive' | 'error';
  connectionToken?: string;
  metadata?: Record<string, any>;
  tools?: Array<{ name: string; description?: string; inputSchema: object; outputSchema?: object }>;
  bindings?: string[];
}

export interface ConnectionStoragePort {
  create(data: CreateConnectionData): Promise<MCPConnection>;
  findById(id: string): Promise<MCPConnection | null>;
  list(organizationId: string): Promise<MCPConnection[]>;
  update(id: string, data: UpdateConnectionData): Promise<MCPConnection>;
  delete(id: string): Promise<void>;
  testConnection(id: string): Promise<{ healthy: boolean; latencyMs: number }>;
}

