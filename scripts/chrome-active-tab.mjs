#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

function usage() {
  console.log(`Usage:
  node scripts/chrome-active-tab.mjs url
  node scripts/chrome-active-tab.mjs title
  node scripts/chrome-active-tab.mjs eval --script '<js>'
  node scripts/chrome-active-tab.mjs eval --script-file <file>
  node scripts/chrome-active-tab.mjs dump-links
`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { _: [] };
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return { command, args };
}

function runAppleScript(script) {
  return execFileSync('osascript', ['-e', script], { encoding: 'utf8' }).trim();
}

function activeTabProperty(property) {
  return runAppleScript(`
tell application "Google Chrome"
  if (count of windows) = 0 then error "Google Chrome has no open windows"
  return ${property} of active tab of front window
end tell
`);
}

function executeJavaScript(js) {
  const escaped = js.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return runAppleScript(`
tell application "Google Chrome"
  if (count of windows) = 0 then error "Google Chrome has no open windows"
  tell active tab of front window
    return execute javascript "${escaped}"
  end tell
end tell
`);
}

function dumpLinksScript() {
  return `
(() => {
  const nodes = Array.from(document.querySelectorAll('a, button'));
  const rows = nodes.map((node, index) => {
    const rect = node.getBoundingClientRect();
    const text = (node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim();
    const href = node.tagName === 'A' ? node.href || '' : '';
    return {
      index,
      tag: node.tagName.toLowerCase(),
      text,
      href,
      ariaLabel: node.getAttribute('aria-label') || '',
      title: node.getAttribute('title') || '',
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }).filter((row) => row.text || row.href || row.ariaLabel || row.title);
  return JSON.stringify(rows, null, 2);
})()
`.trim();
}

function main() {
  const { command, args } = parseArgs(process.argv.slice(2));
  if (!command || args.help) {
    usage();
    process.exit(command ? 0 : 1);
  }

  if (command === 'url') {
    console.log(activeTabProperty('URL'));
    return;
  }

  if (command === 'title') {
    console.log(activeTabProperty('title'));
    return;
  }

  if (command === 'eval') {
    const script = args.scriptFile ? fs.readFileSync(args.scriptFile, 'utf8') : args.script;
    if (!script) {
      throw new Error('eval requires --script or --script-file');
    }
    console.log(executeJavaScript(script));
    return;
  }

  if (command === 'dump-links') {
    console.log(executeJavaScript(dumpLinksScript()));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
