import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = resolve(ROOT, 'dist');

function build() {
    execSync('npx vite build', { cwd: ROOT, stdio: 'inherit' });
}

const WRAPPERS = {
    'keyboard-control.js': { banner: '', footer: '' },
    'violetmonkey.user.js': {
        banner: [
            '// ==UserScript==',
            '// @name        Keyboard Navigation',
            '// @namespace   mg-nx-forge',
            '// @icon',
            '// @version     0.0.1',
            '//',
            '// @match       *://*/*',
            '// @grant       none',
            '// @run-at      document-idle',
            '//',
            '// @author      -',
            '// @description',
            '// ==/UserScript==',
        ].join('\n'),
        footer: [
            '',
            'const engine = new KeyboardControl.KeyboardControlEngine();',
            'engine.mount();',
        ].join('\n'),
    },
    'tampermonkey.user.js': {
        banner: [
            '// ==UserScript==',
            '// @name         Keyboard Navigation',
            '// @namespace    mg-nx-forge',
            '// @description  Keyboard-driven hint labels for interactive elements',
            '// @version      0.0.1',
            '//',
            '// @match        *://*/*',
            '// @grant        none',
            '// @run-at       document-idle',
            '//',
            '// @author       -',
            '// ==/UserScript==',
        ].join('\n'),
        footer: [
            '',
            'const engine = new KeyboardControl.KeyboardControlEngine();',
            'engine.mount();',
        ].join('\n'),
    },
    'obsidian.script.js': { banner: '', footer: '' },
};



function wrap(raw, wrapper) {
    const parts = [];
    if (wrapper.banner) parts.push(wrapper.banner);
    parts.push(raw);
    if (wrapper.footer) parts.push(wrapper.footer);
    return parts.join('\n');
}

function main() {
    mkdirSync(DIST, { recursive: true });
    build();

    const rawPath = resolve(DIST, 'keyboard-control.js');
    const raw = readFileSync(rawPath, 'utf-8');

    for (const [filename, wrapper] of Object.entries(WRAPPERS)) {
        const outPath = resolve(DIST, filename);
        writeFileSync(outPath, wrap(raw, wrapper), 'utf-8');
        console.log(`  → ${filename}`);
    }
}

main();