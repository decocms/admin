#!/usr/bin/env node
// Auto deploy helper for wrangler that (a) prefers local binary, (b) falls back to npx, (c) forces CI mode to skip confirmation
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
// Remove our own flags before passing to wrangler
const passThroughArgs = args.filter(a => a !== '--verbose');

const isWin = process.platform === 'win32';
const localBin = path.resolve(process.cwd(), 'node_modules', '.bin', isWin ? 'wrangler.cmd' : 'wrangler');
const npxCmd = isWin ? 'npx.cmd' : 'npx';

function log(...m){ if(verbose) console.log('[wrangler-deploy-auto]', ...m); }

function pickCommand(){
  if(fs.existsSync(localBin)) return { cmd: localBin, args: ['deploy', ...passThroughArgs] };
  if(!process.env.NO_NPX_FALLBACK) return { cmd: npxCmd, args: ['wrangler','deploy', ...passThroughArgs] };
  return { cmd: isWin ? 'wrangler.cmd' : 'wrangler', args: ['deploy', ...passThroughArgs] };
}

let { cmd, args: cmdArgs } = pickCommand();
log('platform', process.platform, 'node', process.version);
log('chosen', cmd, cmdArgs.join(' '));

// Ensure CI mode so wrangler **skips** confirmation prompt
const env = { ...process.env, CI: process.env.CI || '1' };

function run(currentCmd, currentArgs, attempt){
  let spawnCmd = currentCmd;
  let spawnArgs = currentArgs;
  // Workaround for sporadic Windows spawn EINVAL when executing .cmd directly under Node 20
  if(isWin && /\.cmd$/i.test(currentCmd)){
    spawnArgs = ['/c', currentCmd, ...currentArgs];
    spawnCmd = process.env.COMSPEC || 'C:/Windows/System32/cmd.exe';
  }
  log(`spawning (attempt ${attempt})`, spawnCmd, spawnArgs.join(' '));
  const proc = spawn(spawnCmd, spawnArgs, { stdio: ['inherit','inherit','inherit'], env });
  proc.on('error', (e)=>{
    console.error('[wrangler-deploy-auto] spawn error', e);
    if(attempt === 1){
      // Fallback path: try npx if not already
      if(currentCmd !== npxCmd && !process.env.NO_NPX_FALLBACK){
        console.warn('[wrangler-deploy-auto] retrying with npx fallback');
        run(npxCmd, ['wrangler','deploy', ...passThroughArgs], 2);
        return;
      }
    }
    process.exit(1);
  });
  proc.on('exit', (code)=>{
    if(code!==0){
      console.error(`[wrangler-deploy-auto] Failed with code ${code}`);
      process.exit(code);
    } else {
      log('deploy success');
    }
  });
}

run(cmd, cmdArgs, 1);
