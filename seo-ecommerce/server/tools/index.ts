// Central export of tool factories for the seo-ecommerce app.
// Following deco.chat pattern: each tool exported as a factory (env => Tool).
// Add new tool factories to this array so they are automatically registered in main.ts.

import { createLinkAnalyzerTool } from './link-analyzer';

export const toolFactories = [
  createLinkAnalyzerTool,
];

export * from './link-analyzer';
