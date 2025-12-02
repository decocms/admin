export interface ChatModelConfig {
  id: string;
  connectionId: string;
  provider?: string | null;
}

export interface ChatAgentConfig {
  id?: string;
  instructions?: string;
  tool_set?: Record<string, string[]>;
  avatar?: string;
  title?: string;
  description?: string | null;
  connectionId?: string;
  connectionName?: string;
}

export interface ChatUserConfig {
  name?: string;
  avatar?: string;
}

export interface Metadata {
  model?: ChatModelConfig;
  agent?: ChatAgentConfig;
  user?: ChatUserConfig;
  created_at?: string | Date;
}
