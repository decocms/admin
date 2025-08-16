// Central export of tool factories for the seo-ecommerce app.
// Following deco.chat pattern: each tool exported as a factory (env => Tool).
// Add new tool factories to this array so they are automatically registered in main.ts.

import { createLinkAnalyzerTool } from './link-analyzer';
import { createPageSpeedTool } from './pagespeed';
import { createSeoAuditTool } from './seo-audit';

export const toolFactories = [
  createLinkAnalyzerTool,
  createPageSpeedTool,
  createSeoAuditTool,
];

export * from './link-analyzer';
export * from './pagespeed';
export * from './seo-audit';
