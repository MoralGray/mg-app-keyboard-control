// # ==========================================================================
// # Types
// # ==========================================================================

export interface KeyboardControlConfig {
    shortcut: {
        key: string;
        alt?: boolean;
        ctrl?: boolean;
        shift?: boolean;
        meta?: boolean;
    };
    selector?: string;
}

export interface HintedElement {
    element: Element;
    hint: string;
    rect: DOMRect;
    offsetX?: number;
    offsetY?: number;
    url?: string;
}

export interface KeyboardControlState {
    isActive: boolean;
    hintedElements: HintedElement[];
    currentFilter: string;
    isTwoLetterMode: boolean;
}

export const DEFAULT_SELECTOR = [
    'button',
    'input',
    'select',
    'textarea',
    'a[href]',
    '[role="button"]',
    '[role="switch"]',
    '[contenteditable]:not([contenteditable="false"])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

export const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

// # ==========================================================================
// # Engine Types
// # ==========================================================================

export interface EngineConfig {
    shortcut?: { key: string; alt?: boolean; ctrl?: boolean; shift?: boolean; meta?: boolean };
    selector?: string;
}

export interface EngineState {
    isActive: boolean;
    hintedElements: HintedElement[];
    currentFilter: string;
    isTwoLetterMode: boolean;
    filteredHintedElements: (HintedElement & { filteredOut: boolean })[];
}

// # ==========================================================================
// # Utils
// # ==========================================================================

export const HINT_W = 30;
export const HINT_H = 22;
const GAP = 4;

export function generateHints(count: number): string[] {
    if (count <= 26) {
        return ALPHABET.split('').slice(0, count);
    }

    const combos: string[] = [];
    for (const a of ALPHABET) {
        for (const b of ALPHABET) {
            combos.push(a + b);
            if (combos.length === count) {
                return combos;
            }
        }
    }

    return combos;
}

export function scanInteractiveElements(customSelector?: string): HintedElement[] {
    const selector = customSelector ?? DEFAULT_SELECTOR;
    const elements = document.querySelectorAll(selector);
    const result: HintedElement[] = [];

    for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            continue;
        }
        result.push({ element: el, hint: '', rect });
    }

    const textLinks = scanTextLinks();
    result.push(...textLinks);

    const hints = generateHints(result.length);

    for (let i = 0; i < result.length; i++) {
        result[i].hint = hints[i] ?? '';
    }

    applyBiggestInputHint(result);

    return resolveCollisions(result);
}

function scanTextLinks(): HintedElement[] {
    const result: HintedElement[] = [];
    const urlRegex = /https?:\/\/\S+/g;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);

    let node: Text | null = walker.nextNode() as Text | null;
    while (node) {
        if (node.parentElement?.closest('a[href]')) {
            node = walker.nextNode() as Text | null;
            continue;
        }

        const text = node.textContent || '';
        let match: RegExpExecArray | null = urlRegex.exec(text);
        while (match) {
            const url = match[0];
            const range = document.createRange();
            range.setStart(node, match.index);
            range.setEnd(node, match.index + url.length);

            const rect = range.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                result.push({
                    element: node.parentElement || document.body,
                    hint: '',
                    rect,
                    url,
                });
            }

            match = urlRegex.exec(text);
        }

        node = walker.nextNode() as Text | null;
    }

    return result;
}

function applyBiggestInputHint(elements: HintedElement[]): void {
    const inputs = elements.filter((e) => e.element.tagName === 'INPUT');
    if (inputs.length === 0) {
        return;
    }

    inputs.sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height);

    const isOneLetter = elements.length <= 26;

    let labels: string[];
    if (inputs.length === 1 && isOneLetter) {
        labels = ['i'];
    } else {
        labels = ['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i8', 'i9', 'i0'];
    }

    for (let idx = 0; idx < inputs.length; idx++) {
        const hint = labels[idx] || 'i0';
        const targetIdx = elements.indexOf(inputs[idx]);
        const existingIdx = elements.findIndex((e) => e.hint === hint);

        if (existingIdx >= 0 && existingIdx !== targetIdx) {
            const tmp = elements[existingIdx].hint;
            elements[existingIdx].hint = elements[targetIdx].hint;
            elements[targetIdx].hint = tmp;
        } else {
            elements[targetIdx].hint = hint;
        }
    }
}

export function isElementVisible(el: Element): boolean {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

export function resolveCollisions(elements: HintedElement[]): HintedElement[] {
    if (elements.length === 0) {
        return [];
    }
    const result = elements.map((e) => ({ ...e, offsetX: 0, offsetY: 0 }));

    type Placed = { left: number; top: number; right: number; bottom: number };
    const placed: Placed[] = [];

    const positions = [
        { dx: 0, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 1, dy: 1 },
        { dx: 0, dy: -1 },
        { dx: 1, dy: -1 },
        { dx: -1, dy: 0 },
        { dx: -1, dy: 1 },
        { dx: -1, dy: -1 },
    ];

    for (const item of result) {
        let placedOk = false;
        for (const pos of positions) {
            const ox = pos.dx * (HINT_W + GAP);
            const oy = pos.dy * (HINT_H + GAP);
            const left = item.rect.left + ox;
            const top = item.rect.top + oy;
            const right = left + HINT_W;
            const bottom = top + HINT_H;

            const overlaps = placed.some((p) => left < p.right && right > p.left && top < p.bottom && bottom > p.top);

            if (!overlaps) {
                item.offsetX = ox;
                item.offsetY = oy;
                placed.push({ left, top, right, bottom });
                placedOk = true;
                break;
            }
        }

        if (!placedOk) {
            item.offsetX = 0;
            item.offsetY = 0;
            placed.push({
                left: item.rect.left,
                top: item.rect.top,
                right: item.rect.left + HINT_W,
                bottom: item.rect.top + HINT_H,
            });
        }
    }

    return result;
}

export function updateRects(elements: HintedElement[]): HintedElement[] {
    const updated = elements.map((item) => {
        const rect = item.element.getBoundingClientRect();
        return { ...item, rect };
    });
    return resolveCollisions(updated);
}

export function matchShortcut(
    event: KeyboardEvent,
    shortcut: { key: string; alt?: boolean; ctrl?: boolean; shift?: boolean; meta?: boolean }
): boolean {
    const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
    const altMatch = !!shortcut.alt === event.altKey;
    const ctrlMatch = !!shortcut.ctrl === event.ctrlKey;
    const shiftMatch = !!shortcut.shift === event.shiftKey;
    const metaMatch = !!shortcut.meta === event.metaKey;
    return keyMatch && altMatch && ctrlMatch && shiftMatch && metaMatch;
}

let _activeFocusCleanup: (() => void) | null = null;

export function focusElement(item: HintedElement): void {
    const element = item.element;
    if (!(element instanceof HTMLElement)) {
        return;
    }

    if (_activeFocusCleanup) {
        _activeFocusCleanup();
    }

    element.focus();
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    if (item.url) {
        element.style.outline = '2px solid #4A90D9';
        element.style.outlineOffset = '2px';
    }

    const cleanup = () => {
        document.removeEventListener('keydown', keyHandler, true);
        document.removeEventListener('keydown', tabHandler, true);
        document.removeEventListener('mousedown', mouseHandler, true);
        element.removeEventListener('blur', blurHandler);
        if (item.url) {
            element.style.outline = '';
            element.style.outlineOffset = '';
        }
        if (_activeFocusCleanup === cleanup) {
            _activeFocusCleanup = null;
        }
    };

    const keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            cleanup();
            if (item.url) {
                window.open(item.url, '_blank');
            } else {
                element.click();
            }
        }
    };

    const tabHandler = (e: KeyboardEvent) => {
        if (e.key === 'Tab' || e.key === 'Escape') {
            cleanup();
        }
    };

    const mouseHandler = () => {
        cleanup();
    };

    document.addEventListener('keydown', keyHandler, true);
    document.addEventListener('keydown', tabHandler, true);
    document.addEventListener('mousedown', mouseHandler, true);

    const blurHandler = () => {
        cleanup();
    };
    element.addEventListener('blur', blurHandler, { once: true });

    _activeFocusCleanup = cleanup;
}

// # ==========================================================================
// # Engine
// # ==========================================================================

type Listener = (state: EngineState) => void;

export class KeyboardControlEngine {
    private config: Required<EngineConfig>;
    private _isActive = false;
    private _hintedElements: HintedElement[] = [];
    private _currentFilter = '';
    private _isTwoLetterMode = false;
    private _overlayRoot: HTMLDivElement | null = null;
    private _listeners: Set<Listener> = new Set();
    private _onKeyDown: ((e: KeyboardEvent) => void) | null = null;
    private _onScrollResize: (() => void) | null = null;
    private _isSettingsOpen = false;
    private _settingsModalRoot: HTMLDivElement | null = null;

    constructor(config?: EngineConfig) {
        this.config = {
            shortcut: config?.shortcut ?? { key: '\\', ctrl: true },
            selector: config?.selector ?? DEFAULT_SELECTOR,
        };
    }

    get state(): EngineState {
        const filtered = this._currentFilter
            ? this._hintedElements.map((item) => ({
                  ...item,
                  filteredOut: !item.hint.startsWith(this._currentFilter),
              }))
            : this._hintedElements.map((item) => ({ ...item, filteredOut: false }));

        return {
            isActive: this._isActive,
            hintedElements: this._hintedElements,
            currentFilter: this._currentFilter,
            isTwoLetterMode: this._isTwoLetterMode,
            filteredHintedElements: filtered,
        };
    }

    subscribe(fn: Listener): () => void {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }

    private notify(): void {
        const state = this.state;
        for (const fn of this._listeners) {
            fn(state);
        }
    }

    activate(): void {
        if (this._isActive) {
            return;
        }
        const elements = scanInteractiveElements(this.config.selector);
        if (elements.length === 0) {
            return;
        }

        this._isActive = true;
        this._hintedElements = elements;
        this._currentFilter = '';
        this._isTwoLetterMode = elements.length > 26;

        this.renderOverlay();
        this.notify();
    }

    deactivate(): void {
        if (!this._isActive) {
            return;
        }
        this._isActive = false;
        this._hintedElements = [];
        this._currentFilter = '';
        this._isTwoLetterMode = false;
        this.removeOverlay();
        this.notify();
    }

    mount(): void {
        this._onKeyDown = (event: KeyboardEvent) => {
            if (this._isSettingsOpen) {
                return;
            }

            if (matchShortcut(event, { key: '\\', ctrl: true, shift: true })) {
                event.preventDefault();
                event.stopPropagation();
                this.openSettings();
                return;
            }

            if (!this._isActive) {
                if (matchShortcut(event, this.config.shortcut)) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.activate();
                }
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            if (event.key === 'Escape') {
                this.deactivate();
                return;
            }

            if (event.key.length !== 1 || !/^[a-zA-Z0-9]$/.test(event.key)) {
                return;
            }

            const char = event.key.toLowerCase();
            const elements = this._hintedElements;
            const filter = this._currentFilter;

            const newFilter = filter + char;
            const exactMatch = elements.find((e) => e.hint === newFilter);

            if (exactMatch) {
                focusElement(exactMatch);
                this.deactivate();
                return;
            }

            const hasLonger = elements.some((e) => e.hint.startsWith(newFilter) && e.hint.length > newFilter.length);
            if (hasLonger) {
                this._currentFilter = newFilter;
                this.renderOverlay();
                this.notify();
                return;
            }

            this.deactivate();
        };

        document.addEventListener('keydown', this._onKeyDown, true);
    }

    unmount(): void {
        if (this._onKeyDown) {
            document.removeEventListener('keydown', this._onKeyDown, true);
            this._onKeyDown = null;
        }
        if (this._isSettingsOpen) {
            this.closeSettings();
        }
        this.deactivate();
        this._listeners.clear();
    }

    private renderOverlay(): void {
        this.removeOverlay();

        const root = document.createElement('div');
        root.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;';

        const filtered = this.state.filteredHintedElements;

        for (const item of filtered) {
            const hintEl = document.createElement('div');
            hintEl.style.cssText = [
                `position:fixed`,
                `left:${item.rect.left + (item.offsetX ?? 0)}px`,
                `top:${item.rect.top + (item.offsetY ?? 0)}px`,
                `z-index:2147483647`,
                `pointer-events:none`,
                `opacity:${item.filteredOut ? 0.15 : 1}`,
                `transition:opacity 80ms ease`,
            ].join(';');

            const inner = document.createElement('span');
            inner.style.cssText = [
                'display:inline-flex',
                'align-items:center',
                'justify-content:center',
                'min-width:22px',
                'height:22px',
                'padding:0 4px',
                'background:#1a1a1a',
                'color:#ffffff',
                'font-size:12px',
                'font-family:ui-monospace,monospace',
                'font-weight:700',
                'line-height:1',
                'letter-spacing:0.5px',
                'border:1px solid #444',
                'border-radius:3px',
                'box-shadow:0 1px 3px rgba(0,0,0,0.4)',
            ].join(';');
            inner.textContent =
                this._isTwoLetterMode && this._currentFilter ? item.hint.slice(this._currentFilter.length) : item.hint;

            hintEl.appendChild(inner);
            root.appendChild(hintEl);
        }

        document.body.appendChild(root);
        this._overlayRoot = root;

        this._onScrollResize = () => {
            requestAnimationFrame(() => {
                const updated = updateRects(this._hintedElements);
                this._hintedElements = updated;
                this.renderOverlay();
                this.notify();
            });
        };

        window.addEventListener('scroll', this._onScrollResize, true);
        window.addEventListener('resize', this._onScrollResize);
    }

    private removeOverlay(): void {
        if (this._overlayRoot) {
            this._overlayRoot.remove();
            this._overlayRoot = null;
        }
        if (this._onScrollResize) {
            window.removeEventListener('scroll', this._onScrollResize, true);
            window.removeEventListener('resize', this._onScrollResize);
            this._onScrollResize = null;
        }
    }

    private openSettings(): void {
        if (this._isSettingsOpen) {
            return;
        }
        this._isSettingsOpen = true;

        if (this._isActive) {
            this.deactivate();
        }

        const fmt = (s: { key: string; ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean }) => {
            const parts: string[] = [];
            if (s.ctrl) {
                parts.push('Ctrl');
            }
            if (s.alt) {
                parts.push('Alt');
            }
            if (s.shift) {
                parts.push('Shift');
            }
            if (s.meta) {
                parts.push('Meta');
            }
            parts.push(s.key);
            return parts.join('+');
        };

        const backdrop = document.createElement('div');
        backdrop.style.cssText =
            'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText =
            'background:#fff;color:#000;padding:24px;border-radius:8px;min-width:300px;font-family:system-ui,sans-serif;font-size:14px;';

        const title = document.createElement('div');
        title.textContent = 'Keyboard Control Settings';
        title.style.cssText = 'font-weight:700;margin-bottom:16px;font-size:16px;';

        const label = document.createElement('div');
        label.textContent = 'Press new shortcut combination:';
        label.style.cssText = 'margin-bottom:8px;';

        const display = document.createElement('div');
        display.textContent = fmt(this.config.shortcut);
        display.style.cssText =
            'padding:8px 12px;border:1px solid #ccc;border-radius:4px;margin-bottom:16px;min-height:20px;background:#f5f5f5;';
        display.tabIndex = 0;

        const helpText = document.createElement('div');
        helpText.textContent = 'Press any key combo or Escape to cancel';
        helpText.style.cssText = 'font-size:12px;color:#666;margin-bottom:12px;';

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.style.cssText = 'padding:6px 16px;cursor:pointer;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'padding:6px 16px;cursor:pointer;';

        let captured: { key: string; ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean } | null = null;

        const captureHandler = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === 'Escape') {
                close();
                return;
            }
            captured = {
                key: e.key,
                ctrl: e.ctrlKey || false,
                alt: e.altKey || false,
                shift: e.shiftKey || false,
                meta: e.metaKey || false,
            };
            display.textContent = fmt(captured);
        };

        modal.addEventListener('keydown', captureHandler);

        const close = () => {
            this._isSettingsOpen = false;
            backdrop.remove();
            this._settingsModalRoot = null;
        };

        saveBtn.addEventListener('click', () => {
            if (captured) {
                this.config.shortcut = captured;
            }
            close();
        });

        cancelBtn.addEventListener('click', close);

        modal.appendChild(title);
        modal.appendChild(label);
        modal.appendChild(display);
        modal.appendChild(helpText);
        modal.appendChild(btnRow);
        btnRow.appendChild(saveBtn);
        btnRow.appendChild(cancelBtn);
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
        this._settingsModalRoot = backdrop;

        modal.focus();
    }

    private closeSettings(): void {
        if (this._settingsModalRoot) {
            this._settingsModalRoot.remove();
            this._settingsModalRoot = null;
        }
        this._isSettingsOpen = false;
    }
}
