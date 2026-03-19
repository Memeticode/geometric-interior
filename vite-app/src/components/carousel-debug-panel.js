/**
 * Debug panel for carousel-dropdown-browser.
 * Toggle with Ctrl+Shift+D. Draggable floating window with minimize.
 * Exposes all carousel attributes with descriptions. Sections are collapsible.
 */

const PANEL_ID = 'cdb-debug-panel';

/** @param {HTMLElement} carousel - carousel-dropdown-browser element */
export function initCarouselDebugPanel(carousel) {
    if (!carousel) return;

    let panel = null;
    let body = null;
    let minimized = false;

    function toggle() {
        if (panel) { destroy(); return; }
        create();
    }

    function create() {
        panel = document.createElement('div');
        panel.id = PANEL_ID;
        Object.assign(panel.style, {
            position: 'fixed',
            top: '1rem',
            left: (window.innerWidth - 284) + 'px',
            zIndex: '100000',
            background: 'rgba(20, 20, 28, 0.92)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px',
            color: '#ccc',
            fontSize: '0.7rem',
            fontFamily: 'system-ui, sans-serif',
            width: '260px',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            userSelect: 'none',
            maxHeight: 'calc(100vh - 2rem)',
            display: 'flex',
            flexDirection: 'column',
        });

        // ── Title bar (drag handle + minimize) ──
        const titleBar = document.createElement('div');
        Object.assign(titleBar.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.45rem 0.75rem',
            cursor: 'grab',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: '0',
        });

        const titleText = document.createElement('span');
        titleText.textContent = 'Carousel Debug';
        Object.assign(titleText.style, {
            fontWeight: '600',
            fontSize: '0.7rem',
            letterSpacing: '0.04em',
            color: '#aaa',
            textTransform: 'uppercase',
            pointerEvents: 'none',
        });

        const titleBtns = document.createElement('span');
        Object.assign(titleBtns.style, { display: 'flex', gap: '0.25rem', alignItems: 'center' });

        // Refresh button
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '\u21bb'; // ↻
        refreshBtn.title = 'Re-layout carousel';
        Object.assign(refreshBtn.style, {
            background: 'none',
            border: 'none',
            color: '#888',
            fontSize: '0.85rem',
            lineHeight: '1',
            cursor: 'pointer',
            padding: '0 0.1rem',
        });
        refreshBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
        refreshBtn.addEventListener('click', () => {
            // Trigger a relayout by nudging arc-z back and forth
            const cur = carousel.getAttribute('arc-z') || '24';
            carousel.setAttribute('arc-z', cur);
        });

        // Minimize button
        const minBtn = document.createElement('button');
        minBtn.textContent = '\u2212'; // −
        Object.assign(minBtn.style, {
            background: 'none',
            border: 'none',
            color: '#888',
            fontSize: '1rem',
            lineHeight: '1',
            cursor: 'pointer',
            padding: '0 0.1rem',
        });
        minBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
        minBtn.addEventListener('click', () => {
            minimized = !minimized;
            minBtn.textContent = minimized ? '+' : '\u2212';
            body.style.display = minimized ? 'none' : '';
            titleBar.style.borderBottom = minimized
                ? '1px solid transparent'
                : '1px solid rgba(255,255,255,0.08)';
        });

        titleBtns.appendChild(refreshBtn);
        titleBtns.appendChild(minBtn);
        titleBar.appendChild(titleText);
        titleBar.appendChild(titleBtns);
        panel.appendChild(titleBar);

        // ── Drag handling ──
        let dragOffX = 0, dragOffY = 0;

        titleBar.addEventListener('pointerdown', (e) => {
            dragOffX = e.clientX - panel.offsetLeft;
            dragOffY = e.clientY - panel.offsetTop;
            titleBar.style.cursor = 'grabbing';
            titleBar.setPointerCapture(e.pointerId);
        });

        titleBar.addEventListener('pointermove', (e) => {
            if (!titleBar.hasPointerCapture(e.pointerId)) return;
            let x = e.clientX - dragOffX;
            let y = e.clientY - dragOffY;
            const maxX = window.innerWidth - panel.offsetWidth;
            const maxY = window.innerHeight - panel.offsetHeight;
            x = Math.max(0, Math.min(x, maxX));
            y = Math.max(0, Math.min(y, maxY));
            panel.style.left = x + 'px';
            panel.style.top = y + 'px';
        });

        titleBar.addEventListener('pointerup', () => {
            titleBar.style.cursor = 'grab';
        });

        titleBar.addEventListener('lostpointercapture', () => {
            titleBar.style.cursor = 'grab';
        });

        // ── Body ──
        body = document.createElement('div');
        Object.assign(body.style, {
            padding: '0.4rem 0.75rem 0.5rem',
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: '1',
            minHeight: '0',
        });
        panel.appendChild(body);

        // ── Read current values ──
        const attr = (name, fallback) => parseFloat(carousel.getAttribute(name)) || fallback;
        const strAttr = (name, fallback) => carousel.getAttribute(name) || fallback;
        const speed = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--t-speed')) || 1;

        // ── Timing ──
        const secTiming = addSection(body, 'Timing');

        addSlider(secTiming, 'Speed', speed, 0.25, 10, 0.25, '\u00d7',
            'Global transition speed multiplier (\u2011\u2011t\u2011speed)',
            (v) => { document.documentElement.style.setProperty('--t-speed', v); });

        addSlider(secTiming, 'Flip Duration', attr('flip-duration', 1500), 100, 3000, 50, 'ms',
            'Expand/collapse grid animation duration',
            (v) => { carousel.setAttribute('flip-duration', v); });

        addSlider(secTiming, 'Bounce', attr('bounce', 0.35), 0, 1, 0.05, '',
            'Overshoot easing on scroll snap',
            (v) => { carousel.setAttribute('bounce', v); });

        // ── Arc Geometry ──
        const secArc = addSection(body, 'Arc Geometry');

        addSlider(secArc, 'Arc Z', attr('arc-z', 24), 0, 50, 1, '',
            'Curvature depth \u2014 0 is flat, 50 is deep arc',
            (v) => { carousel.setAttribute('arc-z', v); });

        addSlider(secArc, 'Arc Y', attr('arc-y', 43), -60, 60, 1, 'px',
            'Vertical arc \u2014 positive smiles, negative frowns',
            (v) => { carousel.setAttribute('arc-y', v); });

        // ── Layout ──
        const secLayout = addSection(body, 'Layout', true);

        addSelect(secLayout, 'Controls Pos', ['above', 'below'], strAttr('controls-position', 'above'),
            'Arrow nav position relative to card track',
            (v) => { carousel.setAttribute('controls-position', v); });

        addSelect(secLayout, 'Section Align', ['left', 'center', 'right'], strAttr('section-align', 'left'),
            'Section label text alignment in carousel',
            (v) => { carousel.setAttribute('section-align', v); });

        addSelect(secLayout, 'Grid Align', ['left', 'center', 'right'], strAttr('grid-align', 'center'),
            'Grid container alignment when expanded',
            (v) => { carousel.setAttribute('grid-align', v); });

        addSelect(secLayout, 'Grid Items', ['stretch', 'left', 'center', 'right'], strAttr('grid-items-align', 'stretch'),
            'Card alignment within grid cells',
            (v) => { carousel.setAttribute('grid-items-align', v); });

        addSelect(secLayout, 'Card Title', ['none', 'above', 'top', 'center', 'bottom', 'below'],
            strAttr('card-title', 'none'),
            'Card title label position',
            (v) => { carousel.setAttribute('card-title', v); });

        // ── Toggles ──
        const secToggles = addSection(body, 'Toggles');

        addToggle(secToggles, 'Infinite', carousel.getAttribute('infinite') !== 'false',
            'Wrap-around scrolling at carousel ends',
            (v) => { carousel.setAttribute('infinite', v); });

        addToggle(secToggles, 'Expandable', carousel.getAttribute('expandable') !== 'false',
            'Show grid expand/collapse button',
            (v) => { carousel.setAttribute('expandable', v); });

        document.body.appendChild(panel);
    }

    function destroy() {
        if (panel) { panel.remove(); panel = null; body = null; minimized = false; }
    }

    // ── UI helpers ──

    const DESC_STYLE = {
        fontSize: '0.55rem',
        color: '#556',
        lineHeight: '1.3',
        marginBottom: '0.15rem',
    };

    function addDesc(parent, text) {
        if (!text) return;
        const el = document.createElement('div');
        el.textContent = text;
        Object.assign(el.style, DESC_STYLE);
        parent.appendChild(el);
    }

    /**
     * Add a collapsible section. Returns the content container to append controls into.
     * @param {boolean} [startCollapsed=false] — start with section collapsed
     */
    function addSection(parent, title, startCollapsed = false) {
        const wrapper = document.createElement('div');
        Object.assign(wrapper.style, { marginBottom: '0.15rem' });

        // Header row (clickable)
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            fontSize: '0.6rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#667',
            marginTop: '0.45rem',
            paddingBottom: '0.15rem',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
        });
        // No top margin on the very first section
        if (!parent.hasChildNodes()) header.style.marginTop = '0';

        const labelEl = document.createElement('span');
        labelEl.textContent = title;
        labelEl.style.pointerEvents = 'none';

        const chevron = document.createElement('span');
        chevron.style.pointerEvents = 'none';
        chevron.style.fontSize = '0.55rem';
        chevron.style.transition = 'transform 0.15s ease';

        header.appendChild(labelEl);
        header.appendChild(chevron);

        // Content container
        const content = document.createElement('div');
        Object.assign(content.style, {
            overflow: 'hidden',
            paddingTop: '0.2rem',
        });

        let collapsed = startCollapsed;
        const apply = () => {
            chevron.textContent = collapsed ? '\u25b8' : '\u25be'; // ▸ / ▾
            content.style.display = collapsed ? 'none' : '';
            header.style.marginBottom = collapsed ? '0' : '';
        };
        apply();

        header.addEventListener('click', () => {
            collapsed = !collapsed;
            apply();
        });

        wrapper.appendChild(header);
        wrapper.appendChild(content);
        parent.appendChild(wrapper);
        return content;
    }

    function addSlider(parent, label, initial, min, max, step, unit, desc, onChange) {
        const row = document.createElement('div');
        Object.assign(row.style, { marginBottom: '0.35rem' });

        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '0.05rem',
        });

        const lbl = document.createElement('span');
        lbl.textContent = label;

        const val = document.createElement('span');
        val.style.color = '#8af';
        val.textContent = formatVal(initial, step, unit);

        header.appendChild(lbl);
        header.appendChild(val);
        row.appendChild(header);

        addDesc(row, desc);

        const input = document.createElement('input');
        input.type = 'range';
        input.min = min;
        input.max = max;
        input.step = step;
        input.value = initial;
        Object.assign(input.style, {
            width: '100%',
            height: '14px',
            accentColor: '#6688cc',
            cursor: 'pointer',
        });

        input.addEventListener('input', () => {
            const v = parseFloat(input.value);
            val.textContent = formatVal(v, step, unit);
            onChange(v);
        });

        row.appendChild(input);
        parent.appendChild(row);
    }

    function addSelect(parent, label, options, initial, desc, onChange) {
        const row = document.createElement('div');
        Object.assign(row.style, { marginBottom: '0.35rem' });

        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.05rem',
        });

        const lbl = document.createElement('span');
        lbl.textContent = label;
        header.appendChild(lbl);

        const sel = document.createElement('select');
        Object.assign(sel.style, {
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '3px',
            color: '#8af',
            fontSize: '0.65rem',
            padding: '0.1rem 0.25rem',
            cursor: 'pointer',
            outline: 'none',
        });
        for (const opt of options) {
            const o = document.createElement('option');
            o.value = opt;
            o.textContent = opt;
            if (opt === initial) o.selected = true;
            sel.appendChild(o);
        }
        sel.addEventListener('change', () => onChange(sel.value));
        header.appendChild(sel);

        row.appendChild(header);
        addDesc(row, desc);
        parent.appendChild(row);
    }

    function addToggle(parent, label, initial, desc, onChange) {
        const row = document.createElement('div');
        Object.assign(row.style, { marginBottom: '0.35rem' });

        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
        });

        const lbl = document.createElement('span');
        lbl.textContent = label;
        header.appendChild(lbl);

        const btn = document.createElement('button');
        let on = initial;
        const update = () => {
            btn.textContent = on ? 'On' : 'Off';
            btn.style.color = on ? '#8f8' : '#f88';
        };
        Object.assign(btn.style, {
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '3px',
            padding: '0.1rem 0.4rem',
            fontSize: '0.65rem',
            cursor: 'pointer',
            minWidth: '2.2rem',
            textAlign: 'center',
        });
        update();
        btn.addEventListener('click', () => {
            on = !on;
            update();
            onChange(on);
        });
        header.appendChild(btn);

        row.appendChild(header);
        addDesc(row, desc);
        parent.appendChild(row);
    }

    function formatVal(v, step, unit) {
        const decimals = step < 1 ? 2 : 0;
        return v.toFixed(decimals) + unit;
    }

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            toggle();
        }
    });
}
