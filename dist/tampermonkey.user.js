// ==UserScript==
// @name         Keyboard Navigation
// @namespace    mg-nx-forge
// @description  Keyboard-driven hint labels for interactive elements
// @version      0.0.1
//
// @match        *://*/*
// @grant        none
// @run-at       document-idle
//
// @author       -
// ==/UserScript==
var KeyboardControl = (function(exports) {
	Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
	//#region src/index.ts
	var DEFAULT_SELECTOR = [
		"button",
		"input",
		"select",
		"textarea",
		"a[href]",
		"[role=\"button\"]",
		"[role=\"switch\"]",
		"[contenteditable]:not([contenteditable=\"false\"])",
		"[tabindex]:not([tabindex=\"-1\"])"
	].join(",");
	var ALPHABET = "abcdefghijklmnopqrstuvwxyz";
	var HINT_W = 30;
	var HINT_H = 22;
	function shuffleArray(arr) {
		const result = [...arr];
		for (let i = result.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[result[i], result[j]] = [result[j], result[i]];
		}
		return result;
	}
	function generateHints(count) {
		if (count <= 26) return shuffleArray(ALPHABET.split("")).slice(0, count);
		const combos = [];
		for (const a of ALPHABET) for (const b of ALPHABET) combos.push(a + b);
		return shuffleArray(combos).slice(0, count);
	}
	function scanInteractiveElements(customSelector) {
		const selector = customSelector ?? DEFAULT_SELECTOR;
		const elements = document.querySelectorAll(selector);
		const result = [];
		for (const el of elements) {
			const rect = el.getBoundingClientRect();
			if (rect.width === 0 || rect.height === 0) continue;
			result.push({
				element: el,
				hint: "",
				rect
			});
		}
		const hints = generateHints(result.length);
		for (let i = 0; i < result.length; i++) result[i].hint = hints[i] ?? "";
		return resolveCollisions(result);
	}
	function isElementVisible(el) {
		const rect = el.getBoundingClientRect();
		return rect.width > 0 && rect.height > 0;
	}
	function resolveCollisions(elements) {
		if (elements.length === 0) return [];
		const result = elements.map((e) => ({
			...e,
			offsetX: 0,
			offsetY: 0
		}));
		const placed = [];
		const positions = [
			{
				dx: 0,
				dy: 0
			},
			{
				dx: 1,
				dy: 0
			},
			{
				dx: 0,
				dy: 1
			},
			{
				dx: 1,
				dy: 1
			},
			{
				dx: 0,
				dy: -1
			},
			{
				dx: 1,
				dy: -1
			},
			{
				dx: -1,
				dy: 0
			},
			{
				dx: -1,
				dy: 1
			},
			{
				dx: -1,
				dy: -1
			}
		];
		for (const item of result) {
			let placedOk = false;
			for (const pos of positions) {
				const ox = pos.dx * 34;
				const oy = pos.dy * 26;
				const left = item.rect.left + ox;
				const top = item.rect.top + oy;
				const right = left + 30;
				const bottom = top + 22;
				if (!placed.some((p) => left < p.right && right > p.left && top < p.bottom && bottom > p.top)) {
					item.offsetX = ox;
					item.offsetY = oy;
					placed.push({
						left,
						top,
						right,
						bottom
					});
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
					right: item.rect.left + 30,
					bottom: item.rect.top + 22
				});
			}
		}
		return result;
	}
	function updateRects(elements) {
		return resolveCollisions(elements.map((item) => {
			const rect = item.element.getBoundingClientRect();
			return {
				...item,
				rect
			};
		}));
	}
	function matchShortcut(event, shortcut) {
		const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
		const altMatch = !!shortcut.alt === event.altKey;
		const ctrlMatch = !!shortcut.ctrl === event.ctrlKey;
		const shiftMatch = !!shortcut.shift === event.shiftKey;
		const metaMatch = !!shortcut.meta === event.metaKey;
		return keyMatch && altMatch && ctrlMatch && shiftMatch && metaMatch;
	}
	function focusElement(element) {
		if (!(element instanceof HTMLElement)) return;
		element.focus();
		element.scrollIntoView({
			behavior: "smooth",
			block: "nearest"
		});
		const keyHandler = (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				element.click();
				document.removeEventListener("keydown", keyHandler, true);
			}
		};
		document.addEventListener("keydown", keyHandler, true);
		const blurHandler = () => {
			document.removeEventListener("keydown", keyHandler, true);
		};
		element.addEventListener("blur", blurHandler, { once: true });
	}
	var KeyboardControlEngine = class {
		config;
		_isActive = false;
		_hintedElements = [];
		_currentFilter = "";
		_isTwoLetterMode = false;
		_overlayRoot = null;
		_listeners = /* @__PURE__ */ new Set();
		_onKeyDown = null;
		_onScrollResize = null;
		constructor(config) {
			this.config = {
				shortcut: config?.shortcut ?? {
					key: "\\",
					ctrl: true
				},
				selector: config?.selector ?? DEFAULT_SELECTOR
			};
		}
		get state() {
			const filtered = this._currentFilter ? this._hintedElements.map((item) => ({
				...item,
				filteredOut: !item.hint.startsWith(this._currentFilter)
			})) : this._hintedElements.map((item) => ({
				...item,
				filteredOut: false
			}));
			return {
				isActive: this._isActive,
				hintedElements: this._hintedElements,
				currentFilter: this._currentFilter,
				isTwoLetterMode: this._isTwoLetterMode,
				filteredHintedElements: filtered
			};
		}
		subscribe(fn) {
			this._listeners.add(fn);
			return () => this._listeners.delete(fn);
		}
		notify() {
			const state = this.state;
			for (const fn of this._listeners) fn(state);
		}
		activate() {
			if (this._isActive) return;
			const elements = scanInteractiveElements(this.config.selector);
			if (elements.length === 0) return;
			this._isActive = true;
			this._hintedElements = elements;
			this._currentFilter = "";
			this._isTwoLetterMode = elements.length > 26;
			this.renderOverlay();
			this.notify();
		}
		deactivate() {
			if (!this._isActive) return;
			this._isActive = false;
			this._hintedElements = [];
			this._currentFilter = "";
			this._isTwoLetterMode = false;
			this.removeOverlay();
			this.notify();
		}
		mount() {
			this._onKeyDown = (event) => {
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
				if (event.key === "Escape") {
					this.deactivate();
					return;
				}
				if (event.key.length !== 1 || !/^[a-zA-Z]$/.test(event.key)) return;
				const char = event.key.toLowerCase();
				const elements = this._hintedElements;
				const twoLetter = this._isTwoLetterMode;
				const filter = this._currentFilter;
				if (!twoLetter) {
					const match = elements.find((e) => e.hint === char);
					if (match) focusElement(match.element);
					this.deactivate();
					return;
				}
				if (!filter) {
					this._currentFilter = char;
					this.renderOverlay();
					this.notify();
					return;
				}
				const fullHint = filter + char;
				const match = elements.find((e) => e.hint === fullHint);
				if (match) focusElement(match.element);
				this.deactivate();
			};
			document.addEventListener("keydown", this._onKeyDown, true);
		}
		unmount() {
			if (this._onKeyDown) {
				document.removeEventListener("keydown", this._onKeyDown, true);
				this._onKeyDown = null;
			}
			this.deactivate();
			this._listeners.clear();
		}
		renderOverlay() {
			this.removeOverlay();
			const root = document.createElement("div");
			root.style.cssText = "position:fixed;inset:0;z-index:2147483646;pointer-events:none;";
			const filtered = this.state.filteredHintedElements;
			for (const item of filtered) {
				const hintEl = document.createElement("div");
				hintEl.style.cssText = [
					`position:fixed`,
					`left:${item.rect.left + (item.offsetX ?? 0)}px`,
					`top:${item.rect.top + (item.offsetY ?? 0)}px`,
					`z-index:2147483647`,
					`pointer-events:none`,
					`opacity:${item.filteredOut ? .15 : 1}`,
					`transition:opacity 80ms ease`
				].join(";");
				const inner = document.createElement("span");
				inner.style.cssText = [
					"display:inline-flex",
					"align-items:center",
					"justify-content:center",
					"min-width:22px",
					"height:22px",
					"padding:0 4px",
					"background:#1a1a1a",
					"color:#ffffff",
					"font-size:12px",
					"font-family:ui-monospace,monospace",
					"font-weight:700",
					"line-height:1",
					"letter-spacing:0.5px",
					"border:1px solid #444",
					"border-radius:3px",
					"box-shadow:0 1px 3px rgba(0,0,0,0.4)"
				].join(";");
				inner.textContent = this._isTwoLetterMode && this._currentFilter ? item.hint.slice(1) : item.hint;
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
			window.addEventListener("scroll", this._onScrollResize, true);
			window.addEventListener("resize", this._onScrollResize);
		}
		removeOverlay() {
			if (this._overlayRoot) {
				this._overlayRoot.remove();
				this._overlayRoot = null;
			}
			if (this._onScrollResize) {
				window.removeEventListener("scroll", this._onScrollResize, true);
				window.removeEventListener("resize", this._onScrollResize);
				this._onScrollResize = null;
			}
		}
	};
	//#endregion
	exports.ALPHABET = ALPHABET;
	exports.DEFAULT_SELECTOR = DEFAULT_SELECTOR;
	exports.HINT_H = HINT_H;
	exports.HINT_W = HINT_W;
	exports.KeyboardControlEngine = KeyboardControlEngine;
	exports.focusElement = focusElement;
	exports.generateHints = generateHints;
	exports.isElementVisible = isElementVisible;
	exports.matchShortcut = matchShortcut;
	exports.resolveCollisions = resolveCollisions;
	exports.scanInteractiveElements = scanInteractiveElements;
	exports.updateRects = updateRects;
	return exports;
})({});


const engine = new KeyboardControl.KeyboardControlEngine();
engine.mount();