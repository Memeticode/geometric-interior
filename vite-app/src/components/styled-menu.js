/**
 * Reusable animated-slider navigation menu.
 *
 * Usage:
 *   const menu = createStyledMenu({
 *       containerEl: document.getElementById('myMenu'),
 *       items: [
 *           { key: 'images',     label: 'Images' },
 *           { key: 'animations', label: 'Animations' },
 *       ],
 *       onSelect(key) { console.log('selected', key); },
 *   });
 *   menu.setActive('animations');
 */

/**
 * @param {object}   opts
 * @param {HTMLElement} opts.containerEl
 * @param {{key:string, label:string}[]} opts.items
 * @param {(key:string)=>void} opts.onSelect
 */
export function createStyledMenu({ containerEl, items, onSelect }) {
    containerEl.classList.add('styled-menu');
    containerEl.style.position = 'relative';

    // Slider highlight
    const slider = document.createElement('div');
    slider.className = 'styled-menu-slider';
    containerEl.appendChild(slider);

    // Buttons
    const buttons = items.map(({ key, label }) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'styled-menu-item';
        btn.dataset.key = key;
        btn.textContent = label;
        containerEl.appendChild(btn);
        return btn;
    });

    let activeKey = null;

    function positionSlider(animate) {
        const activeBtn = buttons.find(b => b.dataset.key === activeKey);
        if (!activeBtn) return;
        const containerRect = containerEl.getBoundingClientRect();
        const btnRect = activeBtn.getBoundingClientRect();
        const top = btnRect.top - containerRect.top + containerEl.scrollTop;

        if (!animate) slider.style.transition = 'none';
        slider.style.transform = `translateY(${top}px)`;
        slider.style.height = `${btnRect.height}px`;
        slider.classList.add('visible');
        if (!animate) {
            slider.offsetHeight; // force reflow
            slider.style.transition = '';
        }
    }

    function setActive(key) {
        activeKey = key;
        buttons.forEach(b => b.classList.toggle('active', b.dataset.key === key));
        positionSlider(true);
    }

    function getActive() {
        return activeKey;
    }

    // Click handlers
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.key;
            if (key === activeKey) return;
            setActive(key);
            onSelect(key);
        });
    });

    // Reposition on resize
    const onResize = () => positionSlider(false);
    window.addEventListener('resize', onResize);

    function destroy() {
        window.removeEventListener('resize', onResize);
        containerEl.innerHTML = '';
        containerEl.classList.remove('styled-menu');
    }

    return { setActive, getActive, destroy };
}
