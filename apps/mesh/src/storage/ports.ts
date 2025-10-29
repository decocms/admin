/**
 * Storage Port Interfaces
 * 
 * These interfaces define the contracts for storage adapters.
 * Following the Ports & Adapters (Hexagonal Architecture) pattern.
 */

import type { MCPConnection, Project, OAuthConfig, ToolDefinition } from './types';

// ============================================================================
// Connection Storage Port
// ============================================================================

export interface CreateConnectionData {
  projectId: string | null; // null = organization-scoped, string = project-scoped
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
  list(projectId: string | null, scope?: 'all' | 'organization' | 'project'): Promise<MCPConnection[]>;
  update(id: string, data: UpdateConnectionData): Promise<MCPConnection>;
  delete(id: string): Promise<void>;
  testConnection(id: string): Promise<{ healthy: boolean; latencyMs: number }>;
}

// ============================================================================
// Project Storage Port
// ============================================================================

export interface CreateProjectData {
  slug: string; // URL-safe, unique within organization
  name: string;
  description?: string;
  ownerId: string;
}

export interface ProjectStoragePort {
  create(data: CreateProjectData): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  findBySlug(slug: string): Promise<Project | null>;
  list(userId?: string): Promise<Project[]>; // All projects or user's projects
  update(id: string, data: Partial<Project>): Promise<Project>;
  delete(id: string): Promise<void>;
}

