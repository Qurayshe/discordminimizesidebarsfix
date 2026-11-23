// ==UserScript==
// @name         Discord Minimize Sidebars (optimized)
// @namespace    qurayshe.github.io/qudiscordsidemin
// @version      0.1
// @description  Highly performant Discord sidebar minimization with GPU compositing and no reflows. Should work on all Discord web versions (stable, PTB, canary). Includes a lightweight settings modal for customization.
// @author       Qurayshe
// @match        https://discord.com/channels/*
// @match        https://discord.com/store/*
// @match        https://discord.com/guild-discovery*
// @match        https://ptb.discord.com/channels/*
// @match        https://ptb.discord.com/store/*
// @match        https://ptb.discord.com/guild-discovery*
// @match        https://canary.discord.com/channels/*
// @match        https://canary.discord.com/store/*
// @match        https://canary.discord.com/guild-discovery*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'dms_fast_config_v1';

    const DEFAULT_CONFIG = {
        duration: '0.25s',
        delay: '0.75s',

        // Channels sidebar
        cWork: true,
        cSelSide: true,
        cOpa: '0',
        cVisWidth: '0px',

        // Servers (guilds) sidebar
        gWork: true,
        gSelSide: true,
        gOpa: '0',
        gVisWidth: '5px',

        // User panel
        uFade: false,
        ufOpa: '0',
        uSmlSty: true,
        uAbs: false,
        uaWidth: '300px',
        uaMinLeft: '-290px',

        // Top bar
        tWork: true,
        tOpa: '0',
        tVisHeight: '5px',
    };

    function loadConfig() {
        try {
            const saved = GM_getValue(STORAGE_KEY, null);
            return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG };
        } catch {
            return { ...DEFAULT_CONFIG };
        }
    }

    let config = loadConfig();
    let styleEl = null;

    function buildCSS(cfg) {
        const dur = cfg.duration;
        const del = cfg.delay;
        const triggerWidth = cfg.gWork && cfg.cWork
            ? `max(${cfg.gVisWidth || '0px'}, ${cfg.cVisWidth || '0px'}, 5px)`
            : cfg.gWork
                ? (cfg.gVisWidth || '5px')
                : (cfg.cVisWidth || '5px');

        const parts = [];

        parts.push(`
            :root {
                --dms-duration: ${dur};
                --dms-delay: ${del};
                --dms-c-opa: ${cfg.cOpa};
                --dms-g-opa: ${cfg.gOpa};
                --dms-uf-opa: ${cfg.ufOpa};
                --dms-t-opa: ${cfg.tOpa};
                --dms-t-vis-height: ${cfg.tVisHeight};
                --dms-trigger-width: ${triggerWidth};
            }
        `);

        // Keep sidebar overflow visible so GPU-translated panels can slide out cleanly
        parts.push(`
            .dms-content {
                position: relative;
            }

            .dms-sidebar {
                position: relative;
                height: 100%;
                overflow: visible !important;
                z-index: 101;
            }
        `);

        // When both sidebars are minimized, treat the entire .dms-sidebar (servers +
        // channels + user panel) as a single GPU-composited entity.
        // Static negative margin-right collapses its layout footprint to --dms-trigger-width
        // (zero chat reflow), while keeping .dms-sidebar in normal flow so guilds,
        // channels, scrolling, and the user panel keep their exact native Discord layout.
        if (cfg.cWork && cfg.gWork) {
            parts.push(`
                .dms-sidebar {
                    position: relative;
                    height: 100%;
                    overflow: visible !important;
                    flex-shrink: 0 !important;
                    margin-right: calc(var(--dms-trigger-width) - var(--dms-sidebar-full-width, 312px)) !important;
                    z-index: 101;
                    will-change: transform, opacity;
                    transform: translateX(0);
                    opacity: 1;
                    pointer-events: auto;
                    transition: transform var(--dms-duration) ease, opacity var(--dms-duration) ease;
                }

                body:not(.dms-has-channel-context):not(.dms-has-guild-context):not(.dms-has-profile-popout)
                .dms-sidebar:not(:hover):not(:focus-within) {
                    transform: translateX(calc(var(--dms-trigger-width) - var(--dms-sidebar-full-width, 312px)));
                    opacity: var(--dms-c-opa);
                    transition: transform var(--dms-duration) ease var(--dms-delay), opacity var(--dms-duration) ease var(--dms-delay);
                }

                body:not(.dms-has-channel-context):not(.dms-has-guild-context):not(.dms-has-profile-popout)
                .dms-sidebar:not(:hover):not(:focus-within) > * {
                    pointer-events: none;
                }
            `);
        } else {
            // Channel sidebar only (GPU-composited transform + opacity overlay)
            if (cfg.cWork) {
                const cTrigger = cfg.cSelSide
                    ? `body:not(.dms-has-channel-context) .dms-sidebar:not(:hover):not(:focus-within) .dms-sidebar-list:not(:hover):not(:focus-within)`
                    : `body:not(.dms-has-channel-context) .dms-sidebar-list:not(:hover):not(:focus-within)`;

                parts.push(`
                    .dms-sidebar-list {
                        position: absolute !important;
                        top: 0;
                        bottom: 0;
                        left: 100%;
                        z-index: 1;
                        will-change: transform, opacity;
                        contain: layout style;
                        transform: translateX(0);
                        opacity: 1;
                        pointer-events: auto;
                        transition: transform var(--dms-duration) ease, opacity var(--dms-duration) ease;
                    }

                    ${cTrigger} {
                        transform: translateX(-100%);
                        opacity: var(--dms-c-opa);
                        pointer-events: none;
                        transition: transform var(--dms-duration) ease var(--dms-delay), opacity var(--dms-duration) ease var(--dms-delay);
                    }
                `);
            }

            // Guilds (servers) sidebar only (GPU-composited transform + opacity overlay)
            if (cfg.gWork) {
                const gTrigger = cfg.gSelSide
                    ? `body:not(.dms-has-guild-context) .dms-sidebar:not(:hover):not(:focus-within) .dms-guilds:not(:hover):not(:focus-within)`
                    : `body:not(.dms-has-guild-context) .dms-guilds:not(:hover):not(:focus-within)`;

                parts.push(`
                    .dms-guilds {
                        position: absolute !important;
                        top: 0;
                        bottom: 0;
                        left: 0;
                        z-index: 2;
                        will-change: transform, opacity;
                        contain: layout style;
                        transform: translateX(0);
                        opacity: 1;
                        pointer-events: auto;
                        transition: transform var(--dms-duration) ease, opacity var(--dms-duration) ease;
                    }

                    ${gTrigger} {
                        transform: translateX(calc(-100% + ${cfg.gVisWidth || '5px'}));
                        opacity: var(--dms-g-opa);
                        pointer-events: none;
                        transition: transform var(--dms-duration) ease var(--dms-delay), opacity var(--dms-duration) ease var(--dms-delay);
                    }
                `);
            }
        }

        // User Panel: Fade
        if (cfg.uFade) {
            parts.push(`
                .dms-panels {
                    will-change: opacity;
                    transition: opacity var(--dms-duration) ease;
                }

                body:not(.dms-has-channel-context):not(.dms-has-guild-context):not(.dms-has-profile-popout)
                .dms-sidebar:not(:hover):not(:focus-within) .dms-panels:not(:hover):not(:focus-within) {
                    opacity: var(--dms-uf-opa);
                    transition: opacity var(--dms-duration) ease var(--dms-delay);
                }
            `);
        }

        // User Panel: Squeezed style
        if (cfg.uSmlSty) {
            parts.push(`
                .dms-panels:not(:hover) {
                    overflow: auto;
                    scrollbar-width: none;
                }

                .dms-panels:not(:hover) .dms-avatar-wrapper {
                    z-index: 1;
                    min-width: 40px;
                }
            `);
        }

        // User Panel: Floating Ball (uses transform instead of animating left + width)
        if (cfg.uAbs) {
            parts.push(`
                .dms-panels {
                    position: absolute !important;
                    width: ${cfg.uaWidth};
                    left: 0;
                    z-index: 3;
                    will-change: transform;
                    transform: translateX(0);
                    transition: transform var(--dms-duration) ease;
                }

                body:not(.dms-has-profile-popout) .dms-panels:not(:hover):not(:focus-within) {
                    transform: translateX(${cfg.uaMinLeft});
                    transition: transform var(--dms-duration) ease var(--dms-delay);
                }

                .dms-sidebar-list > * {
                    padding-bottom: 0;
                }

                .dms-guilds {
                    margin-bottom: 0;
                }
            `);
        }

        // Top Bar: Static grid height on .dms-base (inherits naturally, NO & * bomb)
        // + GPU-translated overlay .dms-bar (NO grid-template-rows animation, NO :has())
        if (cfg.tWork) {
            parts.push(`
                .dms-base {
                    --custom-app-top-bar-height: var(--dms-t-vis-height);
                    position: relative;
                }

                .dms-bar {
                    --custom-app-top-bar-height: var(--dms-bar-full-height, 32px);
                    height: var(--dms-bar-full-height, 32px) !important;
                    min-height: var(--dms-bar-full-height, 32px) !important;
                    position: absolute !important;
                    top: 0;
                    left: 0;
                    right: 0;
                    z-index: 102;
                    background: var(--background-base-lowest, var(--background-tertiary, #1e1f22));
                    will-change: transform, opacity;
                    transform: translateY(0);
                    opacity: 1;
                    transition: transform var(--dms-duration) ease, opacity var(--dms-duration) ease;
                }

                .dms-bar:not(:hover):not(:focus-within) {
                    transform: translateY(calc(-100% + var(--dms-t-vis-height)));
                    opacity: var(--dms-t-opa);
                    transition: transform var(--dms-duration) ease var(--dms-delay), opacity var(--dms-duration) ease var(--dms-delay);
                }
            `);
        }

        return parts.join('\n');
    }

    function applyStyles() {
        const css = buildCSS(config);
        if (!styleEl) {
            styleEl = GM_addStyle(css);
        } else {
            styleEl.textContent = css;
        }
    }

    // Cached DOM references so we don't re-query on every mutation
    const refs = {
        base: null,
        sidebar: null,
        sidebarList: null,
        guilds: null,
        panels: null,
        bar: null,
        avatarWrapper: null,
    };

    function queryFirst(root, selectors) {
        for (const sel of selectors) {
            const el = root.querySelector(sel);
            if (el) return el;
        }
        return null;
    }

    function tagElement(key, className, finder) {
        const current = refs[key];
        if (current && current.isConnected) {
            if (!current.classList.contains(className)) {
                current.classList.add(className);
            }
            return current;
        }
        const found = finder();
        if (found) {
            found.classList.add(className);
            refs[key] = found;
        } else {
            refs[key] = null;
        }
        return refs[key];
    }

    function syncDiscordDOM() {
        const base = tagElement('base', 'dms-base', () =>
            queryFirst(document, ['[class*="base_"]', '[class*="-app"] [class*="-base"]'])
        );
        if (!base) return;

        const sidebar = tagElement('sidebar', 'dms-sidebar', () =>
            queryFirst(base, ['[class*="sidebar_"]', '[class*="-sidebar"]'])
        );

        if (sidebar) {
            if (!document.documentElement.style.getPropertyValue('--dms-sidebar-full-width')) {
                const w = sidebar.offsetWidth;
                if (w > 100) {
                    document.documentElement.style.setProperty('--dms-sidebar-full-width', `${w}px`);
                }
            }
            if (sidebar.parentElement && !sidebar.parentElement.classList.contains('dms-content')) {
                sidebar.parentElement.classList.add('dms-content');
            }
            tagElement('sidebarList', 'dms-sidebar-list', () =>
                queryFirst(sidebar, ['[class*="sidebarList_"]', '[class*="-sidebarList"]'])
            );
            tagElement('guilds', 'dms-guilds', () =>
                queryFirst(sidebar, ['[class*="guilds_"]', '[class*="-guilds"]'])
            );
            const panels = tagElement('panels', 'dms-panels', () =>
                queryFirst(sidebar, ['[class*="panels_"]', '[class*="-panels"]'])
            );
            if (panels && config.uSmlSty) {
                tagElement('avatarWrapper', 'dms-avatar-wrapper', () =>
                    queryFirst(panels, ['[class*="avatarWrapper_"]', '[class*="-avatarWrapper"]'])
                );
            }
        }

        if (config.tWork) {
            const bar = tagElement('bar', 'dms-bar', () => {
                // Prefer direct child bar_ of base
                for (const child of base.children) {
                    const cls = child.className;
                    if (typeof cls === 'string' && (cls.includes('bar_') || cls.includes('-bar'))) {
                        return child;
                    }
                }
                return null;
            });
            if (bar && !document.documentElement.style.getPropertyValue('--dms-bar-full-height')) {
                const rootHeight = getComputedStyle(document.documentElement)
                    .getPropertyValue('--custom-app-top-bar-height')
                    .trim();
                if (rootHeight) {
                    document.documentElement.style.setProperty('--dms-bar-full-height', rootHeight);
                }
            }
        }

        // O(1) context-menu / popout state flags on body (replaces body:has(...))
        const body = document.body;
        if (body) {
            body.classList.toggle('dms-has-channel-context', Boolean(document.getElementById('channel-context')));
            body.classList.toggle('dms-has-guild-context', Boolean(document.getElementById('guild-context')));
            body.classList.toggle('dms-has-profile-popout', Boolean(document.querySelector('.user-profile-popout')));
        }
    }

    // Coalesce DOM syncs to at most once per animation frame
    let rafPending = false;
    function scheduleSync() {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
            rafPending = false;
            syncDiscordDOM();
        });
    }

    // Lightweight settings modal
    function openSettingsModal() {
        const existing = document.getElementById('dms-settings-overlay');
        if (existing) {
            existing.remove();
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'dms-settings-overlay';
        overlay.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:99999',
            'background:rgba(0,0,0,0.65)', 'display:flex',
            'align-items:center', 'justify-content:center',
            'font-family:var(--font-primary, sans-serif)', 'color:#f2f3f5',
        ].join(';');

        const box = document.createElement('div');
        box.style.cssText = [
            'background:#2b2d31', 'border-radius:8px', 'padding:20px',
            'width:420px', 'max-width:92vw', 'max-height:85vh', 'overflow-y:auto',
            'box-shadow:0 8px 24px rgba(0,0,0,0.45)', 'font-size:14px',
        ].join(';');

        const fields = [
            { key: 'duration', label: 'Transition Duration', type: 'text' },
            { key: 'delay', label: 'Collapse Delay', type: 'text' },
            { key: 'cWork', label: 'Channels - Minimize', type: 'checkbox' },
            { key: 'cSelSide', label: 'Channels - Whole Sidebar as Triggerzone', type: 'checkbox' },
            { key: 'cOpa', label: 'Channels - Minimized Opacity', type: 'text' },
            { key: 'gWork', label: 'Servers - Minimize', type: 'checkbox' },
            { key: 'gSelSide', label: 'Servers - Whole Sidebar as Triggerzone', type: 'checkbox' },
            { key: 'gVisWidth', label: 'Servers - Visible Strip Width', type: 'text' },
            { key: 'gOpa', label: 'Servers - Minimized Opacity', type: 'text' },
            { key: 'uFade', label: 'User Panel - Fade when minimized', type: 'checkbox' },
            { key: 'ufOpa', label: 'User Panel - Faded Opacity', type: 'text' },
            { key: 'uSmlSty', label: 'User Panel - Squeezed Style', type: 'checkbox' },
            { key: 'uAbs', label: 'User Panel - Floating Ball', type: 'checkbox' },
            { key: 'uaWidth', label: 'User Panel - Floating Width', type: 'text' },
            { key: 'uaMinLeft', label: 'User Panel - Floating Offset', type: 'text' },
            { key: 'tWork', label: 'Top Bar - Hide', type: 'checkbox' },
            { key: 'tVisHeight', label: 'Top Bar - Visible Strip Height', type: 'text' },
            { key: 'tOpa', label: 'Top Bar - Minimized Opacity', type: 'text' },
        ];

        const title = document.createElement('h3');
        title.textContent = 'Discord Minimize Sidebars (Fast)';
        title.style.cssText = 'margin:0 0 14px 0;font-size:16px;font-weight:600;';
        box.appendChild(title);

        const inputs = {};
        for (const f of fields) {
            const row = document.createElement('label');
            row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:12px;';

            const span = document.createElement('span');
            span.textContent = f.label;
            row.appendChild(span);

            const input = document.createElement('input');
            input.type = f.type;
            if (f.type === 'checkbox') {
                input.checked = Boolean(config[f.key]);
            } else {
                input.value = String(config[f.key] ?? '');
                input.style.cssText = 'background:#1e1f22;color:#f2f3f5;border:1px solid #3f4147;border-radius:4px;padding:4px 8px;width:110px;';
            }
            inputs[f.key] = { input, type: f.type };
            row.appendChild(input);
            box.appendChild(row);
        }

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:16px;';

        const resetBtn = document.createElement('button');
        resetBtn.textContent = 'Reset';
        resetBtn.style.cssText = 'background:#4e5058;color:#fff;border:none;border-radius:4px;padding:6px 12px;cursor:pointer;';
        resetBtn.onclick = () => {
            config = { ...DEFAULT_CONFIG };
            GM_setValue(STORAGE_KEY, JSON.stringify(config));
            applyStyles();
            overlay.remove();
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'background:#4e5058;color:#fff;border:none;border-radius:4px;padding:6px 12px;cursor:pointer;';
        cancelBtn.onclick = () => overlay.remove();

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.style.cssText = 'background:#5865f2;color:#fff;border:none;border-radius:4px;padding:6px 14px;cursor:pointer;font-weight:600;';
        saveBtn.onclick = () => {
            for (const [k, meta] of Object.entries(inputs)) {
                config[k] = meta.type === 'checkbox' ? meta.input.checked : meta.input.value.trim();
            }
            GM_setValue(STORAGE_KEY, JSON.stringify(config));
            applyStyles();
            syncDiscordDOM();
            overlay.remove();
        };

        btnRow.append(resetBtn, cancelBtn, saveBtn);
        box.appendChild(btnRow);
        overlay.appendChild(box);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
        document.body.appendChild(overlay);
    }

    // Initialize
    applyStyles();
    syncDiscordDOM();

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });

    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('Configure Minimize Sidebars', openSettingsModal);
    }
})();
