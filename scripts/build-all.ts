import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');

const footerMake = () => {
    return `const engine = new KeyboardControl.KeyboardControlEngine();\nengine.mount();`;
};

function build() {
    execSync('npx vite build', { cwd: ROOT, stdio: 'inherit' });
}

const WRAPPERS = {
    'keyboard-control.js': { banner: '', footer: footerMake() },
    'violetmonkey.user.js': {
        banner: [
            '// ==UserScript==',
            '// @name        Keyboard Navigation',
            '// @namespace   mg-nx-forge',
            '// @icon',
            '// @version     0.0.1',
            '//',
            '// @match       *://*/*',
            '// @grant       GM_setValue',
            '// @grant       GM_getValue',
            '// @run-at      document-idle',
            '//',
            '// @author      -',
            '// @description',
            '// ==/UserScript==',
        ].join('\n'),
        footer: footerMake(),
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
            '// @grant        GM_setValue',
            '// @grant        GM_getValue',
            '// @run-at       document-idle',
            '//',
            '// @author       -',
            '// ==/UserScript==',
        ].join('\n'),
        footer: footerMake(),
    },
    'obsidian.script.js': { banner: '', footer: footerMake() },
    'userscript-url.txt': {
        banner: [
            '// ==UserScript==',
            '// @name        Keyboard Navigation',
            '// @namespace   mg-nx-forge',
            '// @icon',
            '// @version     0.0.1',
            '//',
            '// @match       *://*/*',
            '// @grant       GM_setValue',
            '// @grant       GM_getValue',
            '// @run-at      document-idle',
            '//',
            '// @author      -',
            '// @description',
            '// ==/UserScript==',
        ].join('\n'),
        footer: footerMake(),
    },
};

function wrap(raw: string, wrapper: { banner?: string; footer?: string; rawOnly?: boolean }) {
    if (wrapper.rawOnly) {
        return [wrapper.banner || '', wrapper.footer || ''].join('\n').trim();
    }
    const parts = [];
    if (wrapper.banner) {
        parts.push(wrapper.banner);
    }
    parts.push(raw);
    if (wrapper.footer) {
        parts.push(wrapper.footer);
    }
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
