export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  default?: unknown;
}

export interface ToolParameters {
  type: string;
  properties: Record<string, ToolParameter>;
  required: string[];
}

export interface Tool<TParams = unknown, TSettings = unknown, TResult = unknown> {
  name: string;
  description: string;
  parameters: ToolParameters;
  execute: (params: TParams, settings: TSettings) => Promise<TResult>;
} 