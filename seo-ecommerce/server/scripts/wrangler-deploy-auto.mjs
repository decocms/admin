#!/usr/bin/env node
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const proc = spawn('wrangler', ['deploy', ...args], { stdio: ['pipe','inherit','inherit'] });

proc.stdin.write('y\n');
proc.stdin.end();

proc.on('exit', (code)=>{
  if(code!==0){
    console.error(`[wrangler-deploy-auto] Failed with code ${code}`);
    process.exit(code);
  }
});
