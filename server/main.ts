import { withRuntime } from '@deco/workers-runtime';
import { linkAnalyzerTool } from './tools/link-analyzer';

// If tools need env, wrap them in factory functions; current tool is static.
const runtime = withRuntime({
  tools: [() => linkAnalyzerTool],
  workflows: [],
});

export default runtime;
