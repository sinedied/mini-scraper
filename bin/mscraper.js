#!/usr/bin/env node
import process from 'node:process';
import { run } from '../lib/cli.js';

try {
  await run();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
