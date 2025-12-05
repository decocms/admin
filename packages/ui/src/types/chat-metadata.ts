export interface ChatModelConfig {
  id: string;
  connectionId: string;
  provider?: string | null;
}

export interface ChatAgentConfig {
  id?: string;
  title?: string;
  avatar?: string;
  description?: string;
  instructions?: string;
  tool_set?: Record<string, string[]>;
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
  thread_id?: string;
}
