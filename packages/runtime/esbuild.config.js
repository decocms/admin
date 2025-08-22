import esbuild from 'esbuild';

const buildConfig = {
  entryPoints: {
    'index': './src/index.ts',
    'd1': './src/d1-store.ts',
    'proxy': './src/proxy.ts',
    'client': './src/client.ts',
    'mastra': './src/mastra.ts',
    'drizzle': './src/drizzle.ts',
    'resources': './src/resources.ts',
  },
  bundle: true,
  format: 'esm',
  target: 'es2022',
  platform: 'neutral',
  outdir: './dist',
  external: [
    // External dependencies that shouldn't be bundled
    '@cloudflare/workers-types',
    'zod',
    '@mastra/core',
    '@modelcontextprotocol/sdk',
    '@deco/mcp',
    '@mastra/cloudflare-d1',
    'jose',
    'zod-to-json-schema',
    '@dmitryrechkin/json-schema-to-zod',
    'drizzle-orm',
    'cloudflare:workers',
    'node:async_hooks',
  ],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  minify: false, // Set to true for production builds
  sourcemap: true,
  metafile: true,
  // Ensure proper module resolution
  mainFields: ['module', 'main'],
  conditions: ['import', 'module'],
};

// Build function
async function build() {
  try {
    const result = await esbuild.build(buildConfig);
    console.log('Build completed successfully');
    console.log('Output files:', result.outputFiles?.map(f => f.path) || 'No output files');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Watch mode for development
if (process.argv.includes('--watch')) {
  const context = await esbuild.context(buildConfig);
  await context.watch();
  console.log('Watching for changes...');
} else {
  build();
}

export default buildConfig;
