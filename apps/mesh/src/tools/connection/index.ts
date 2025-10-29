/**
 * Connection Management Tools
 * 
 * Export all connection-related tools
 */

export { CONNECTION_CREATE } from './create';
export { CONNECTION_LIST } from './list';
export { CONNECTION_GET } from './get';
export { CONNECTION_DELETE } from './delete';
export { CONNECTION_TEST } from './test';

// Tool registry for connection management
export const CONNECTION_TOOLS = [
  'CONNECTION_CREATE',
  'CONNECTION_LIST',
  'CONNECTION_GET',
  'CONNECTION_DELETE',
  'CONNECTION_TEST',
] as const;

