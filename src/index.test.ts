import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    ALPHABET,
    focusElement,
    generateHints,
    generateHintsCentered,
    isElementHidden,
    KeyboardControlEngine,
    LEFT_HAND_LETTERS,
    matchShortcut,
    RIGHT_HAND_LETTERS,
    scanInteractiveElements,
    scanInteractiveElementsCentered,
} from './index';

// # ========================================================================
// # Helpers
// # ========================================================================

const FIXTURE_PATH = resolve(__dirname, '../index.test.html');
const FIXTURE_HTML = readFileSync(FIXTURE_PATH, 'utf-8');

function mockRects(width = 100, height = 30): void {
    const rect = {
        x: 0,
        y: 0,
        width,
        height,
        top: 0,
        right: width,
        bottom: height,
        left: 0,
        toJSON() {
            return this;
        },
    };
    Element.prototype.getBoundingClientRect = () => rect;
    Range.prototype.getBoundingClientRect = () => rect;
}

function restoreRects(): void {
    delete (Element.prototype as unknown as Record<string, unknown>).getBoundingClientRect;
    delete (Range.prototype as unknown as Record<string, unknown>).getBoundingClientRect;
}

function setupTab(tabId: string): void {
    document.body.innerHTML = FIXTURE_HTML;
    document.querySelector('.tab-bar')?.remove();
    document.querySelector('h1')?.remove();
    document.querySelectorAll('script').forEach((s) => {
        s.remove();
    });
    document.querySelectorAll('.tab-content').forEach((tc) => {
        if (tc.id !== tabId) {
            tc.remove();
        }
    });
    const target = document.getElementById(tabId);
    if (target) {
        target.classList.add('active');
    }
    mockRects();
}

function populateButtons(containerId: string, count: number): void {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }
    for (let i = 1; i <= count; i++) {
        const btn = document.createElement('button');
        btn.textContent = `Btn${i}`;
        container.appendChild(btn);
    }
}

function createHiddenElements(): void {
    document.body.innerHTML = `
        <button id="vis-a">Visible Btn A</button>
        <button id="vis-b">Visible Btn B</button>
        <a id="vis-link" href="https://example.com">Visible Link</a>
        <button id="h-hidden" hidden>hidden attribute</button>
        <button id="h-display" style="display:none">display: none</button>
        <button id="h-visibility" style="visibility:hidden">visibility: hidden</button>
        <button id="h-opacity" style="opacity:0">opacity: 0</button>
        <button id="h-zero" style="width:0;height:0;overflow:hidden">zero-size</button>
    `;
    mockRects();
}

function mockScrollIntoView(): void {
    Element.prototype.scrollIntoView = () => {};
}

// # ========================================================================
// # Pure Functions
// # ========================================================================

describe('generateHints', () => {
    it('returns one-letter hints for ≤26 elements', () => {
        expect(generateHints(7)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    });

    it('returns full alphabet when count equals 26', () => {
        expect(generateHints(26)).toEqual(ALPHABET.split(''));
    });

    it('returns two-letter hints for >26 elements', () => {
        const hints = generateHints(48);
        expect(hints).toHaveLength(48);
        expect(hints[0]).toBe('aa');
        expect(hints[25]).toBe('az');
        expect(hints[26]).toBe('ba');
        expect(hints[47]).toBe('bv');
    });

    it('generates 3-letter combos for >676 elements', () => {
        const hints = generateHints(1000);
        expect(hints).toHaveLength(1000);
        expect(hints[0]).toBe('aaa');
    });

    it('returns empty array for count 0', () => {
        expect(generateHints(0)).toEqual([]);
    });

    it('uses custom alphabet when provided', () => {
        const hints = generateHints(4, '1234');
        expect(hints).toEqual(['1', '2', '3', '4']);
    });
});

describe('generateHintsCentered', () => {
    it('returns left-hand one-letter hints for ≤12 elements', () => {
        const hints = generateHintsCentered(7);
        expect(hints).toHaveLength(7);
        for (const h of hints) {
            expect(h).toHaveLength(1);
            expect(LEFT_HAND_LETTERS).toContain(h);
        }
    });

    it('returns 12 left-hand hints for exactly 12 elements', () => {
        const hints = generateHintsCentered(12);
        expect(hints).toHaveLength(12);
        expect(hints[0]).toBe('q');
        expect(hints[1]).toBe('w');
        expect(hints[11]).toBe('v');
    });

    it('returns two-letter hints for 13-26 elements', () => {
        const hints = generateHintsCentered(20);
        expect(hints).toHaveLength(20);
        expect(hints[0]).toHaveLength(2);
    });

    it('returns at least count elements', () => {
        const hints = generateHintsCentered(300);
        expect(hints).toHaveLength(300);
    });

    it('returns empty array for count 0', () => {
        expect(generateHintsCentered(0)).toEqual([]);
    });
});

describe('matchShortcut', () => {
    const shortcut = { key: '\\', ctrl: true };

    it('matches exact shortcut', () => {
        const event = new KeyboardEvent('keydown', { key: '\\', ctrlKey: true });
        expect(matchShortcut(event, shortcut)).toBe(true);
    });

    it('rejects wrong key', () => {
        const event = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true });
        expect(matchShortcut(event, shortcut)).toBe(false);
    });

    it('rejects missing modifier', () => {
        const event = new KeyboardEvent('keydown', { key: '\\', ctrlKey: false });
        expect(matchShortcut(event, shortcut)).toBe(false);
    });

    it('is case insensitive for key', () => {
        const event = new KeyboardEvent('keydown', { key: 'A', ctrlKey: true });
        expect(matchShortcut(event, { key: 'a', ctrl: true })).toBe(true);
    });

    it('matches with alt modifier', () => {
        const event = new KeyboardEvent('keydown', { key: 'x', altKey: true });
        expect(matchShortcut(event, { key: 'x', alt: true })).toBe(true);
    });

    it('matches with shift modifier', () => {
        const event = new KeyboardEvent('keydown', { key: 'X', shiftKey: true });
        expect(matchShortcut(event, { key: 'x', shift: true })).toBe(true);
    });

    it('matches with meta modifier', () => {
        const event = new KeyboardEvent('keydown', { key: 'z', metaKey: true });
        expect(matchShortcut(event, { key: 'z', meta: true })).toBe(true);
    });
});

describe('isElementHidden', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(restoreRects);

    it('returns true for element not in document', () => {
        const el = document.createElement('button');
        expect(isElementHidden(el)).toBe(true);
    });

    it('returns true for element with hidden attribute', () => {
        const btn = document.createElement('button');
        btn.hidden = true;
        document.body.appendChild(btn);
        expect(isElementHidden(btn)).toBe(true);
    });

    it('returns true for display:none', () => {
        const btn = document.createElement('button');
        btn.style.display = 'none';
        document.body.appendChild(btn);
        expect(isElementHidden(btn)).toBe(true);
    });

    it('returns true for visibility:hidden', () => {
        const btn = document.createElement('button');
        btn.style.visibility = 'hidden';
        document.body.appendChild(btn);
        expect(isElementHidden(btn)).toBe(true);
    });

    it('returns true for opacity:0', () => {
        const btn = document.createElement('button');
        btn.style.opacity = '0';
        document.body.appendChild(btn);
        expect(isElementHidden(btn)).toBe(true);
    });

    it('returns true for zero-size with overflow:hidden', () => {
        const btn = document.createElement('button');
        btn.style.width = '0';
        btn.style.height = '0';
        btn.style.overflow = 'hidden';
        document.body.appendChild(btn);
        expect(isElementHidden(btn)).toBe(true);
    });

    it('returns false for normal visible element', () => {
        mockRects();
        const btn = document.createElement('button');
        document.body.appendChild(btn);
        expect(isElementHidden(btn)).toBe(false);
    });

    it('returns true for element with zero bounding rect', () => {
        mockRects(0, 0);
        const btn = document.createElement('button');
        document.body.appendChild(btn);
        expect(isElementHidden(btn)).toBe(true);
    });
});

// # ========================================================================
// # Per-Tab Scan Tests
// # ========================================================================

describe('scanInteractiveElements — centered-1 tab (centered mode, 7 elements)', () => {
    beforeEach(() => setupTab('centered-1'));
    afterEach(restoreRects);

    it('scans exactly 7 elements', () => {
        const elements = scanInteractiveElementsCentered();
        expect(elements).toHaveLength(7);
    });

    it('all 7 hints are non-empty and unique', () => {
        const elements = scanInteractiveElementsCentered();
        const hints = elements.map((e) => e.hint);
        expect(new Set(hints).size).toBe(7);
        for (const h of hints) {
            expect(h).toBeTruthy();
        }
    });

    it('4 buttons get hints', () => {
        const elements = scanInteractiveElementsCentered();
        const buttons = elements.filter((e) => e.element.tagName === 'BUTTON');
        expect(buttons).toHaveLength(4);
    });

    it('2 links get hints', () => {
        const elements = scanInteractiveElementsCentered();
        const links = elements.filter((e) => e.element.tagName === 'A');
        expect(links).toHaveLength(2);
    });

    it('1 text link gets hint', () => {
        const elements = scanInteractiveElementsCentered();
        const textLinks = elements.filter((e) => e.url);
        expect(textLinks).toHaveLength(1);
    });

    it('hints are one letter only', () => {
        const elements = scanInteractiveElementsCentered();
        for (const e of elements) {
            expect(e.hint).toHaveLength(1);
        }
    });
});

describe('scanInteractiveElements — one-letter tab (13 elements)', () => {
    beforeEach(() => setupTab('one-letter'));
    afterEach(restoreRects);

    it('scans exactly 13 elements', () => {
        const elements = scanInteractiveElements();
        expect(elements).toHaveLength(13);
    });

    it('all hints are non-empty and unique', () => {
        const elements = scanInteractiveElements();
        const hints = elements.map((e) => e.hint);
        expect(new Set(hints).size).toBe(13);
        for (const h of hints) {
            expect(h).toBeTruthy();
        }
    });

    it('9 buttons get hints', () => {
        const elements = scanInteractiveElements();
        const buttons = elements.filter((e) => e.element.tagName === 'BUTTON');
        expect(buttons).toHaveLength(9);
    });

    it('1 input gets a hint', () => {
        const elements = scanInteractiveElements();
        const inputs = elements.filter((e) => e.element.tagName === 'INPUT');
        expect(inputs).toHaveLength(1);
    });

    it('largest input gets numeric hint "1"', () => {
        const elements = scanInteractiveElements();
        const input = elements.find((e) => e.element.tagName === 'INPUT');
        expect(input?.hint).toBe('1');
    });

    it('submit button gets hint "="', () => {
        const elements = scanInteractiveElements();
        const submit = elements.find(
            (e) => e.element.tagName === 'BUTTON' && e.element.getAttribute('type') === 'submit'
        );
        expect(submit?.hint).toBe('=');
    });

    it('2 links get hints', () => {
        const elements = scanInteractiveElements();
        const links = elements.filter((e) => e.element.tagName === 'A');
        expect(links).toHaveLength(2);
    });

    it('1 text link gets hint', () => {
        const elements = scanInteractiveElements();
        const textLinks = elements.filter((e) => e.url);
        expect(textLinks).toHaveLength(1);
    });

    it('snapshot: every hinted element exists in the DOM', () => {
        const elements = scanInteractiveElements();
        for (const e of elements) {
            expect(document.body.contains(e.element)).toBe(true);
        }
    });
});

describe('scanInteractiveElements — two-letter tab (48 elements)', () => {
    beforeEach(() => setupTab('two-letter'));
    afterEach(restoreRects);

    it('scans exactly 48 elements', () => {
        const elements = scanInteractiveElements();
        expect(elements).toHaveLength(48);
    });

    it('all hints are non-empty and unique', () => {
        const elements = scanInteractiveElements();
        const hints = elements.map((e) => e.hint);
        expect(new Set(hints).size).toBe(48);
        for (const h of hints) {
            expect(h).toBeTruthy();
        }
    });

    it('31 buttons get hints (3 submit + 28 regular)', () => {
        const elements = scanInteractiveElements();
        const buttons = elements.filter((e) => e.element.tagName === 'BUTTON');
        expect(buttons).toHaveLength(31);
    });

    it('3 inputs get hints', () => {
        const elements = scanInteractiveElements();
        const inputs = elements.filter((e) => e.element.tagName === 'INPUT');
        expect(inputs).toHaveLength(3);
    });

    it('1 select gets a hint', () => {
        const elements = scanInteractiveElements();
        const selects = elements.filter((e) => e.element.tagName === 'SELECT');
        expect(selects).toHaveLength(1);
    });

    it('2 textareas get hints', () => {
        const elements = scanInteractiveElements();
        const textareas = elements.filter((e) => e.element.tagName === 'TEXTAREA');
        expect(textareas).toHaveLength(2);
    });

    it('3 contenteditable divs get hints', () => {
        const elements = scanInteractiveElements();
        const editables = elements.filter((e) => e.element.getAttribute('contenteditable') === 'true');
        expect(editables).toHaveLength(3);
    });

    it('4 links get hints', () => {
        const elements = scanInteractiveElements();
        const links = elements.filter((e) => e.element.tagName === 'A');
        expect(links).toHaveLength(4);
    });

    it('2 text links (inline URLs) get hints', () => {
        const elements = scanInteractiveElements();
        const textLinks = elements.filter((e) => e.url !== undefined);
        expect(textLinks).toHaveLength(2);
    });

    it('2 role elements (button + switch) get hints', () => {
        const elements = scanInteractiveElements();
        const roles = elements.filter(
            (e) => e.element.getAttribute('role') === 'button' || e.element.getAttribute('role') === 'switch'
        );
        expect(roles).toHaveLength(2);
    });

    it('non-submit and non-input hints are two letters (two-letter mode)', () => {
        const elements = scanInteractiveElements();
        const twoLetterCandidates = elements.filter((e) => e.hint !== '=' && !/^\d+$/.test(e.hint));
        expect(twoLetterCandidates.length).toBeGreaterThan(0);
        for (const e of twoLetterCandidates) {
            expect(e.hint).toHaveLength(2);
        }
    });

    it('all 48 hints are unique including submit hint', () => {
        const elements = scanInteractiveElements();
        const hints = elements.map((e) => e.hint);
        expect(new Set(hints).size).toBe(48);
    });

    it('first hint is "=" (submit button gets priority)', () => {
        const elements = scanInteractiveElements();
        expect(elements[0].hint).toBe('=');
    });

    it('submit button gets hint "="', () => {
        const elements = scanInteractiveElements();
        const firstSubmit = elements.find(
            (e) => e.element.tagName === 'BUTTON' && e.element.getAttribute('type') === 'submit'
        );
        expect(firstSubmit?.hint).toBe('=');
    });
});

describe('scanInteractiveElements — hidden tab', () => {
    afterEach(restoreRects);

    it('scans all 8 elements when filterHidden=false', () => {
        setupTab('hidden');
        const elements = scanInteractiveElements();
        expect(elements).toHaveLength(8);
    });

    it('scans only 3 visible elements when filterHidden=true', () => {
        setupTab('hidden');
        const elements = scanInteractiveElements(undefined, true);
        expect(elements).toHaveLength(3);
    });

    it('excludes hidden attribute element when filtering', () => {
        setupTab('hidden');
        const elements = scanInteractiveElements(undefined, true);
        const hasHiddenAttr = elements.some((e) => e.element.hasAttribute('hidden'));
        expect(hasHiddenAttr).toBe(false);
    });

    it('excludes display:none element when filtering', () => {
        setupTab('hidden');
        const elements = scanInteractiveElements(undefined, true);
        const hasDisplayNone = elements.some(
            (e) => e.element instanceof HTMLElement && e.element.style.display === 'none'
        );
        expect(hasDisplayNone).toBe(false);
    });

    it('excludes visibility:hidden element when filtering', () => {
        setupTab('hidden');
        const elements = scanInteractiveElements(undefined, true);
        const hasVisHidden = elements.some(
            (e) => e.element instanceof HTMLElement && e.element.style.visibility === 'hidden'
        );
        expect(hasVisHidden).toBe(false);
    });

    it('excludes opacity:0 element when filtering', () => {
        setupTab('hidden');
        const elements = scanInteractiveElements(undefined, true);
        const hasOpacityZero = elements.some(
            (e) => e.element instanceof HTMLElement && e.element.style.opacity === '0'
        );
        expect(hasOpacityZero).toBe(false);
    });

    it('excludes zero-size element when filtering', () => {
        setupTab('hidden');
        const elements = scanInteractiveElements(undefined, true);
        const hasZeroSize = elements.some(
            (e) => e.element instanceof HTMLElement && e.element.style.width === '0' && e.element.style.height === '0'
        );
        expect(hasZeroSize).toBe(false);
    });
});

describe('scanInteractiveElements — hidden tab (inline fixture, precise mock)', () => {
    afterEach(restoreRects);

    it('isElementHidden returns true for each hidden element type', () => {
        createHiddenElements();
        const el = (id: string) => document.getElementById(id) as HTMLElement;
        expect(isElementHidden(el('h-hidden'))).toBe(true);
        expect(isElementHidden(el('h-display'))).toBe(true);
        expect(isElementHidden(el('h-visibility'))).toBe(true);
        expect(isElementHidden(el('h-opacity'))).toBe(true);
        expect(isElementHidden(el('h-zero'))).toBe(true);
    });

    it('isElementHidden returns false for visible elements', () => {
        createHiddenElements();
        const el = (id: string) => document.getElementById(id) as HTMLElement;
        expect(isElementHidden(el('vis-a'))).toBe(false);
        expect(isElementHidden(el('vis-b'))).toBe(false);
        expect(isElementHidden(el('vis-link'))).toBe(false);
    });

    it('scanInteractiveElements with filterHidden excludes all 5 hidden variants', () => {
        createHiddenElements();
        const elements = scanInteractiveElements(undefined, true);
        expect(elements).toHaveLength(3);
        const hintedIds = elements.map((e) => e.element.id);
        expect(hintedIds).toContain('vis-a');
        expect(hintedIds).toContain('vis-b');
        expect(hintedIds).toContain('vis-link');
    });

    it('scanInteractiveElements without filterHidden includes all elements', () => {
        createHiddenElements();
        const elements = scanInteractiveElements();
        expect(elements).toHaveLength(8);
    });
});

describe('scanInteractiveElements — many-inputs tab (101 inputs)', () => {
    beforeEach(() => setupTab('many-inputs'));
    afterEach(restoreRects);

    it('scans exactly 101 elements', () => {
        const elements = scanInteractiveElements();
        expect(elements).toHaveLength(101);
    });

    it('all 101 hints are unique', () => {
        const elements = scanInteractiveElements();
        const hints = elements.map((e) => e.hint);
        expect(new Set(hints).size).toBe(101);
    });

    it('all hinted elements are input elements', () => {
        const elements = scanInteractiveElements();
        for (const e of elements) {
            expect(e.element.tagName).toBe('INPUT');
        }
    });

    it('hints are numeric (001–101) due to biggest-input hint override', () => {
        const elements = scanInteractiveElements();
        for (const e of elements) {
            expect(e.hint).toMatch(/^\d{3}$/);
        }
    });

    it('first hint is "001"', () => {
        const elements = scanInteractiveElements();
        expect(elements[0].hint).toBe('001');
    });

    it('hint sequence covers 001 to 101 consecutively', () => {
        const elements = scanInteractiveElements();
        const hints = elements.map((e) => e.hint);
        for (let i = 1; i <= 101; i++) {
            const padded = i.toString().padStart(3, '0');
            expect(hints).toContain(padded);
        }
    });
});

describe('scanInteractiveElements — twohundred tab (200 buttons)', () => {
    beforeEach(() => {
        setupTab('twohundred');
        populateButtons('twohundred-container', 200);
    });
    afterEach(restoreRects);

    it('scans exactly 200 elements', () => {
        const elements = scanInteractiveElements();
        expect(elements).toHaveLength(200);
    });

    it('all hints are non-empty and unique', () => {
        const elements = scanInteractiveElements();
        const hints = elements.map((e) => e.hint);
        expect(new Set(hints).size).toBe(200);
        for (const h of hints) {
            expect(h).toBeTruthy();
        }
    });

    it('all hinted elements are buttons', () => {
        const elements = scanInteractiveElements();
        for (const e of elements) {
            expect(e.element.tagName).toBe('BUTTON');
        }
    });

    it('all hints are two letters (alphabet mode)', () => {
        const elements = scanInteractiveElements();
        for (const e of elements) {
            expect(e.hint).toHaveLength(2);
        }
    });

    it('starts with hint "aa" (alphabet mode)', () => {
        const elements = scanInteractiveElements();
        expect(elements[0].hint).toBe('aa');
    });
});

describe('scanInteractiveElementsCentered — twohundred tab (200 buttons)', () => {
    beforeEach(() => {
        setupTab('twohundred');
        populateButtons('twohundred-container', 200);
    });
    afterEach(restoreRects);

    it('scans exactly 200 elements', () => {
        const elements = scanInteractiveElementsCentered();
        expect(elements).toHaveLength(200);
    });

    it('all hints are non-empty and unique', () => {
        const elements = scanInteractiveElementsCentered();
        const hints = elements.map((e) => e.hint);
        expect(new Set(hints).size).toBe(200);
        for (const h of hints) {
            expect(h).toBeTruthy();
        }
    });

    it('all hints are two letters (centered L2+R2)', () => {
        const elements = scanInteractiveElementsCentered();
        for (const e of elements) {
            expect(e.hint).toHaveLength(2);
        }
    });

    it('first 144 hints use left-hand letters (L2)', () => {
        const elements = scanInteractiveElementsCentered();
        for (let i = 0; i < 144; i++) {
            for (const ch of elements[i].hint) {
                expect(LEFT_HAND_LETTERS).toContain(ch);
            }
        }
    });

    it('remaining 56 hints use right-hand letters (R2)', () => {
        const elements = scanInteractiveElementsCentered();
        for (let i = 144; i < 200; i++) {
            for (const ch of elements[i].hint) {
                expect(RIGHT_HAND_LETTERS).toContain(ch);
            }
        }
    });
});

describe('scanInteractiveElements — thousand tab (1000 buttons)', () => {
    beforeEach(() => {
        setupTab('thousand');
        populateButtons('thousand-container', 1000);
    });
    afterEach(restoreRects);

    it('scans exactly 1000 elements', () => {
        const elements = scanInteractiveElements();
        expect(elements).toHaveLength(1000);
    });

    it('all hints are non-empty and unique', () => {
        const elements = scanInteractiveElements();
        const hints = elements.map((e) => e.hint);
        expect(new Set(hints).size).toBe(1000);
        for (const h of hints) {
            expect(h).toBeTruthy();
        }
    });

    it('all hinted elements are buttons', () => {
        const elements = scanInteractiveElements();
        for (const e of elements) {
            expect(e.element.tagName).toBe('BUTTON');
        }
    });

    it('all hints are three letters (alphabet mode)', () => {
        const elements = scanInteractiveElements();
        for (const e of elements) {
            expect(e.hint).toHaveLength(3);
        }
    });

    it('starts with hint "aaa" (alphabet mode)', () => {
        const elements = scanInteractiveElements();
        expect(elements[0].hint).toBe('aaa');
    });
});

describe('scanInteractiveElementsCentered — thousand tab (1000 buttons)', () => {
    beforeEach(() => {
        setupTab('thousand');
        populateButtons('thousand-container', 1000);
    });
    afterEach(restoreRects);

    it('scans exactly 1000 elements', () => {
        const elements = scanInteractiveElementsCentered();
        expect(elements).toHaveLength(1000);
    });

    it('all hints are non-empty and unique', () => {
        const elements = scanInteractiveElementsCentered();
        const hints = elements.map((e) => e.hint);
        expect(new Set(hints).size).toBe(1000);
        for (const h of hints) {
            expect(h).toBeTruthy();
        }
    });

    it('all hints are three letters (centered L3)', () => {
        const elements = scanInteractiveElementsCentered();
        for (const e of elements) {
            expect(e.hint).toHaveLength(3);
        }
    });

    it('all 1000 hints use only left-hand letters', () => {
        const elements = scanInteractiveElementsCentered();
        for (const e of elements) {
            for (const ch of e.hint) {
                expect(LEFT_HAND_LETTERS).toContain(ch);
            }
        }
    });
});

// # ========================================================================
// # Engine Integration Tests
// # ========================================================================

describe('KeyboardControlEngine', () => {
    afterEach(restoreRects);

    describe('constructor', () => {
        it('creates engine with default config', () => {
            const engine = new KeyboardControlEngine();
            expect(engine.state.isActive).toBe(false);
            expect(engine.state.hintedElements).toEqual([]);
            expect(engine.state.currentFilter).toBe('');
            expect(engine.state.isTwoLetterMode).toBe(false);
        });

        it('accepts custom shortcut config', () => {
            const engine = new KeyboardControlEngine({
                shortcut: { key: 'a', alt: true },
            });
            expect(engine).toBeDefined();
        });

        it('accepts custom selector', () => {
            const engine = new KeyboardControlEngine({
                selector: 'button',
            });
            expect(engine).toBeDefined();
        });
    });

    describe('state', () => {
        it('returns the correct shape when inactive', () => {
            const engine = new KeyboardControlEngine();
            const state = engine.state;
            expect(state).toHaveProperty('isActive', false);
            expect(state).toHaveProperty('hintedElements');
            expect(state).toHaveProperty('currentFilter', '');
            expect(state).toHaveProperty('isTwoLetterMode', false);
            expect(state).toHaveProperty('filteredHintedElements');
            expect(state).toHaveProperty('uppercaseHints');
            expect(state).toHaveProperty('layout');
            expect(state).toHaveProperty('hintMode');
        });

        it('filteredHintedElements has filteredOut=false when no filter', () => {
            const engine = new KeyboardControlEngine();
            for (const item of engine.state.filteredHintedElements) {
                expect(item.filteredOut).toBe(false);
            }
        });
    });

    describe('activate / deactivate', () => {
        beforeEach(() => setupTab('one-letter'));

        it('activate sets isActive to true and scans elements', () => {
            const engine = new KeyboardControlEngine();
            engine.activate();
            expect(engine.state.isActive).toBe(true);
            expect(engine.state.hintedElements.length).toBeGreaterThan(0);
        });

        it('activate sets isTwoLetterMode correctly for 13 elements', () => {
            const engine = new KeyboardControlEngine();
            engine.activate();
            expect(engine.state.isTwoLetterMode).toBe(false);
        });

        it('deactivate resets state', () => {
            const engine = new KeyboardControlEngine();
            engine.activate();
            engine.deactivate();
            expect(engine.state.isActive).toBe(false);
            expect(engine.state.hintedElements).toEqual([]);
            expect(engine.state.currentFilter).toBe('');
        });

        it('double activate is a no-op', () => {
            const engine = new KeyboardControlEngine();
            engine.activate();
            const hints1 = engine.state.hintedElements;
            engine.activate();
            expect(engine.state.isActive).toBe(true);
            expect(engine.state.hintedElements).toEqual(hints1);
        });

        it('double deactivate is a no-op', () => {
            const engine = new KeyboardControlEngine();
            engine.activate();
            engine.deactivate();
            engine.deactivate();
            expect(engine.state.isActive).toBe(false);
        });
    });

    describe('activate with two-letter tab', () => {
        beforeEach(() => setupTab('two-letter'));

        it('activate with a submit present sets isTwoLetterMode based on non-submit hints', () => {
            const engine = new KeyboardControlEngine();
            engine.activate();
            expect(engine.state.isTwoLetterMode).toBe(true);
        });

        it('non-submit and non-input hints are two-letter for >26 elements', () => {
            const engine = new KeyboardControlEngine();
            engine.activate();
            const hints = engine.state.hintedElements.map((e) => e.hint);
            const twoLetterCandidates = hints.filter((h) => h !== '=' && !/^\d+$/.test(h));
            for (const h of twoLetterCandidates) {
                expect(h).toHaveLength(2);
            }
        });

        it('all hints are unique', () => {
            const engine = new KeyboardControlEngine();
            engine.activate();
            const hints = engine.state.hintedElements.map((e) => e.hint);
            expect(new Set(hints).size).toBe(hints.length);
        });
    });

    describe('activate with many-inputs tab', () => {
        beforeEach(() => setupTab('many-inputs'));

        it('scans all 101 inputs', () => {
            const engine = new KeyboardControlEngine();
            engine.activate();
            expect(engine.state.hintedElements).toHaveLength(101);
            expect(engine.state.isTwoLetterMode).toBe(true);
        });
    });

    describe('activate with hidden tab and filterHidden', () => {
        beforeEach(() => setupTab('hidden'));

        it('with filterHidden=false scans 8 elements', () => {
            const engine = new KeyboardControlEngine();
            engine.setFilterHidden(false);
            engine.activate();
            expect(engine.state.hintedElements).toHaveLength(8);
        });

        it('with filterHidden=true scans only visible elements', () => {
            const engine = new KeyboardControlEngine();
            engine.setFilterHidden(true);
            engine.activate();
            expect(engine.state.hintedElements).toHaveLength(3);
        });
    });

    describe('subscriptions', () => {
        beforeEach(() => setupTab('one-letter'));

        it('notifies listeners on activate', () => {
            const engine = new KeyboardControlEngine();
            const listener = vi.fn();
            engine.subscribe(listener);
            engine.activate();
            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
        });

        it('notifies listeners on deactivate', () => {
            const engine = new KeyboardControlEngine();
            engine.activate();
            const listener = vi.fn();
            engine.subscribe(listener);
            engine.deactivate();
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
        });

        it('unsubscribe removes listener', () => {
            const engine = new KeyboardControlEngine();
            const listener = vi.fn();
            const unsub = engine.subscribe(listener);
            unsub();
            engine.activate();
            expect(listener).not.toHaveBeenCalled();
        });

        it('supports multiple listeners', () => {
            const engine = new KeyboardControlEngine();
            const a = vi.fn();
            const b = vi.fn();
            engine.subscribe(a);
            engine.subscribe(b);
            engine.activate();
            expect(a).toHaveBeenCalledTimes(1);
            expect(b).toHaveBeenCalledTimes(1);
        });
    });

    describe('mount / unmount', () => {
        beforeEach(() => {
            setupTab('one-letter');
            mockScrollIntoView();
        });

        afterEach(() => {
            restoreRects();
        });

        it('mount registers keydown listener', () => {
            const engine = new KeyboardControlEngine();
            const keydownSpy = vi.spyOn(document, 'addEventListener');
            engine.mount();
            expect(keydownSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true);
            engine.unmount();
            keydownSpy.mockRestore();
        });

        it('unmount removes keydown listener', () => {
            const engine = new KeyboardControlEngine();
            const keydownSpy = vi.spyOn(document, 'removeEventListener');
            engine.mount();
            engine.unmount();
            expect(keydownSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true);
            keydownSpy.mockRestore();
        });

        it('unmount deactivates if active', () => {
            const engine = new KeyboardControlEngine();
            engine.mount();
            engine.activate();
            expect(engine.state.isActive).toBe(true);
            engine.unmount();
            expect(engine.state.isActive).toBe(false);
        });
    });
});

// # ========================================================================
// # focusElement Tests
// # ========================================================================

describe('focusElement', () => {
    beforeEach(() => {
        document.body.innerHTML = '<button id="test-btn">Click Me</button>';
        mockRects();
        mockScrollIntoView();
    });

    afterEach(restoreRects);

    it('focuses the element', () => {
        const btn = document.getElementById('test-btn') as HTMLElement;
        const focusSpy = vi.spyOn(btn, 'focus');
        focusElement({
            element: btn,
            hint: 'a',
            rect: btn.getBoundingClientRect(),
        });
        expect(focusSpy).toHaveBeenCalled();
        focusSpy.mockRestore();
    });

    it('returns early for non-HTMLElement', () => {
        const el = document.createAttribute('test');
        expect(() =>
            focusElement({
                element: el as unknown as Element,
                hint: 'a',
                rect: new DOMRect(),
            })
        ).not.toThrow();
    });
});
