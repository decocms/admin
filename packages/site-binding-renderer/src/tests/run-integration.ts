#!/usr/bin/env bun
import { readFileSync } from 'fs';
import { join } from 'path';

// Read cookie from .cookie.mcp file
const cookieFile = join(process.cwd(), '../../.cookie.mcp');
const cookieContent = readFileSync(cookieFile, 'utf-8');
const cookieLine = cookieContent.split('\n')[0];
const cookie = cookieLine.split('=', 2)[1]; // Extract value after DECOCMS_GUI_COOKIE=

// Set environment variable
process.env.MCP_SERVER_TOKEN = cookie;

// Import and run the tests
import('./integration.test.ts');
