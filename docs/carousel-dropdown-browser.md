# `<carousel-dropdown-browser>` Component

A custom element that presents a collection of image cards in a 3D arc carousel, with an expandable grid dropdown for browsing all items at once. Cards can be grouped into sections, titled, selected, and deleted. The carousel supports drag navigation, infinite looping, and smooth FLIP-animated transitions between carousel and grid layouts.

**Files**:
- Component: `vite-app/src/components/carousel-dropdown-browser.js`
- Styles: `vite-app/css/components/carousel-browser.css`

---

## Content Model

The component uses **light DOM child elements** (no Shadow DOM). Items are declared as children:

```html
<carousel-dropdown-browser
    controls-position="above"
    card-title="below"
    infinite
    bounce="0.35"
    expandable>

    <carousel-dropdown-browser-section label="Portraits">
        <carousel-dropdown-browser-card
            key="portrait-001"
            label="The Thinker"
            thumb-src="/thumbs/thinker.jpg"
            fallback-src="/thumbs/default.jpg">
        </carousel-dropdown-browser-card>
        <carousel-dropdown-browser-card
            key="portrait-002"
            label="Ethereal"
            thumb-src="/thumbs/ethereal.jpg"
            deletable>
        </carousel-dropdown-browser-card>
    </carousel-dropdown-browser-section>

    <carousel-dropdown-browser-section label="Generated">
        <!-- more cards -->
    </carousel-dropdown-browser-section>

</carousel-dropdown-browser>
```

A `MutationObserver` watches for child changes and triggers a rebuild. Cards outside any `<carousel-dropdown-browser-section>` are treated as unsectioned.

### Child Elements

**`<carousel-dropdown-browser-section>`**

| Attribute | Type   | Description                         |
|-----------|--------|-------------------------------------|
| `label`   | string | Section header text shown in grid   |

**`<carousel-dropdown-browser-card>`**

| Attribute      | Type    | Description                                  |
|----------------|---------|----------------------------------------------|
| `key`          | string  | **Required.** Unique identifier for the card |
| `label`        | string  | Display name rendered as title overlay        |
| `thumb-src`    | string  | Image URL for the card thumbnail              |
| `fallback-src` | string  | Fallback image if `thumb-src` fails           |
| `deletable`    | boolean | Show a delete button in the grid view         |

Cards also accept a `.data` property for attaching arbitrary data (returned in events).

---

## Attributes

| Attribute            | Type    | Default   | Description |
|----------------------|---------|-----------|-------------|
| `arc-z`              | int     | `24`      | Arc depth (0-50). Higher values push side cards further back in 3D space, creating a more pronounced arc. At 0, cards are flat. |
| `arc-y`              | float   | `38`      | Vertical lift at card edges (px). Creates a subtle smile curve. |
| `flip-duration`      | int     | `450`     | Duration (ms) of expand/collapse FLIP animations. |
| `controls-position`  | string  | `"above"` | `"above"` or `"below"` — where nav arrows + toggle sit. |
| `infinite`           | boolean | `true`    | Wrap around at carousel edges. |
| `bounce`             | float   | `0.35`    | Overshoot in easing curve (0 = smooth, 1 = pronounced). |
| `expandable`         | boolean | `true`    | Show/hide the grid expand toggle button. |
| `card-title`         | string  | `"none"`  | Card title position in both carousel and grid modes (see Title System). |
| `debug-show-controls`| boolean | `false`   | Show debug controls panel for tuning arc, title, and layout settings. |

---

## Properties

| Property       | Type              | Access    | Description |
|----------------|-------------------|-----------|-------------|
| `items`        | Array             | get / set | Array of `{ key, label, thumbSrc, fallbackSrc, deletable, data, section, sectionIndex }`. Setting replaces all children. |
| `selectedKey`  | string \| null    | get / set | Highlights the matching card in both carousel and grid. |
| `centerIndex`  | number            | get       | Index of the currently centered carousel card. |
| `expanded`     | boolean           | get       | Whether the grid dropdown is open. |

---

## Methods

| Method                  | Returns   | Description |
|-------------------------|-----------|-------------|
| `expand()`              | `Promise` | Animate from carousel to grid layout. |
| `collapse()`            | `Promise` | Animate from grid back to carousel layout. |
| `toggle()`              | `void`    | Toggle between expand and collapse. |
| `syncToKey(key)`        | `void`    | Instantly center carousel on the card with `key` (no animation). |
| `clearItems()`          | `void`    | Remove all child card/section elements. |
| `requestUpdate()`       | `void`    | Notify component that child data changed (debounced via microtask). |

---

## Events

| Event            | `detail`                        | Fires when |
|------------------|---------------------------------|------------|
| `item-select`    | `{ key, index, item }`          | User clicks a card (carousel or grid). |
| `center-change`  | `{ key, index }`                | Carousel center changes (drag, arrow, momentum). |
| `item-delete`    | `{ key, index, item }`          | User clicks a grid card's delete button. |
| `expand-change`  | `{ expanded: boolean }`         | Expand/collapse animation completes. |

---

## Title System

Title position is set via the `card-title` attribute, which applies uniformly to both carousel and grid views. The value format is `"vAlign"` or `"vAlign hAlign"`. The card border wraps both the title and image.

**Vertical positions** (`vAlign`):

| Value    | Behavior                                                        |
|----------|-----------------------------------------------------------------|
| `above`   | Static element above the image, inside the card border                        |
| `top`     | Absolute overlay at the top of the image with themed semi-transparent bg      |
| `center`  | Absolute overlay centered on the image with themed semi-transparent bg        |
| `bottom`  | Absolute overlay at the bottom of the image with themed semi-transparent bg   |
| `below`   | Static element below the image, inside the card border                        |
| `tooltip` | Hidden until hover; shown via the global tooltip system                       |
| `none`    | Hidden                                                                        |

**Horizontal alignment** (`hAlign`): `left`, `center` (default), `right`. Alignment is ignored for `tooltip` and `none`.

Overlay positions (`top`, `center`, `bottom`) use the `--title-overlay` CSS variable for their background, which adapts to light/dark theme. The `tooltip` position uses the global tooltip system (`data-tooltip` attribute on card elements). When titles are `above` or `below`, the carousel track height adjusts automatically to prevent clipping.

---

## Sections & Grouping

Cards wrapped in `<carousel-dropdown-browser-section>` elements are grouped:

- **Carousel**: A scrolling section label strip appears above the track, showing the currently visible section. Labels scroll in sync with the carousel.
- **Grid**: Full-width section headers are inserted between card groups.
- **Transitions**: During collapse, section headers morph from grid positions to carousel label positions using absolutely-positioned phantom overlays. Phantoms match the source element's font size and letter spacing at the start, then animate to the target's styling. Sections without a carousel counterpart (e.g., off-screen sections) fade out with bounded drift (max 30px) rather than flying to distant targets.

---

## Carousel Interaction

### Drag Navigation
Click and drag on the track to scroll through cards. The carousel uses momentum-based scrolling — release mid-drag and cards coast to a stop, snapping to the nearest item.

### Arrow Navigation
Left/right arrows (single chevron SVG) jump by the number of visible cards in that direction. Hold an arrow for auto-repeat (400ms initial delay, ~100ms repeat).

### Section Navigation
When multiple sections exist, double-chevron arrows (`<<` / `>>`) appear flanking the single-chevron arrows. They jump to the first card of the previous/next section. With `infinite`, they wrap around at the boundaries.

### Hover Effects
Hovering a card lifts it in 3D space (`translateZ`, `scale`). Adjacent cards receive a gradient mask that fades the entire card frame (image, title, and border) at their edges, keeping focus on the hovered card. Hover effects and masks are suppressed while cards are transitioning between positions (arrow navigation, momentum snap) and during drag.

### Infinite vs Clamped
With `infinite`, the carousel loops seamlessly. Without it, arrows disable at the boundaries and drag stops at edges.

---

## Grid Expand / Collapse

### Expand (Carousel to Grid)
1. Grid rendered invisibly; target positions measured.
2. Carousel cards animate from arc positions to grid cell positions (staggered by distance from center).
3. Section labels FLIP from carousel label positions to grid header positions.
4. Controls FLIP to their new position (grid takes more vertical space).
5. Carousel collapses (`max-height: 0`) and grid becomes interactive.

### Collapse (Grid to Carousel)
1. Grid card/header positions captured; grid content hidden (`opacity: 0` with `transition: none`).
2. Carousel un-flattened; cards positioned at their grid positions as starting state.
3. Phantom overlays created at grid header positions, animating to carousel label positions. Phantoms match the source element's font-size/letter-spacing and morph to the target's styling. Real section labels stay hidden during the animation.
4. Cards animate from grid positions to arc positions via Web Animations API (staggered by distance from center). Off-screen cards animate to edge positions and fade out.
5. After animation: dropdown collapsed, scroll compensated, controls/section-label-container FLIP'd for any layout shift. All transitions on controls, labels, cards, and track are suppressed (`transition: none`) during the final recompute. Phantoms removed and real section labels revealed only after FLIP transitions complete.
6. A `requestAnimationFrame` defers transition restoration until the browser has settled, preventing any residual layout shift from becoming animated. The `#animatingExpand` flag stays `true` through this entire sequence (including the deferred recompute) so the `ResizeObserver` guard blocks spurious `#positionCards()` calls.

Both directions use the FLIP technique (First-Last-Invert-Play) with phantom overlays for elements that exist in only one layout. Animations respect `flip-duration` and the `bounce` easing parameter.

---

## CSS Custom Properties

### Layout (responsive, set on `:root`)

| Property    | Default | Description |
|-------------|---------|-------------|
| `--card-w`  | `180px` | Base card width. Scales with viewport (110px at 767px to 280px at 2560px). |

### Per-Card (set by JS on `.cdb-card`)

| Property           | Description |
|--------------------|-------------|
| `--cx`             | Horizontal offset from track center |
| `--cy`             | Vertical offset from track center |
| `--ry`             | 3D Y-axis rotation |
| `--tz`             | 3D Z-axis translation (depth) |
| `--sc`             | Scale factor |
| `--card-opacity`   | Card opacity (0-1) |

### Animation Timing

| Property             | Default | Description |
|----------------------|---------|-------------|
| `--carousel-speed`   | `0.85s` | Card repositioning transition duration |
| `--cdb-easing`       | cubic-bezier (bounce-derived) | Main easing curve |
| `--cdb-label-easing` | cubic-bezier (half bounce)    | Section label easing |

### Theming

| Property             | Dark default              | Light default               | Description |
|----------------------|---------------------------|-----------------------------|-------------|
| `--title-overlay`    | `rgba(0, 0, 0, 0.5)`     | `rgba(255, 255, 255, 0.55)` | Semi-transparent bg for overlay title positions (top/center/bottom) |

### Spacing

| Property              | Default   | Description |
|-----------------------|-----------|-------------|
| `--cdb-controls-gap`  | `0.35rem` | Gap between controls bar and carousel track |
| `--cdb-label-height`  | `1.1rem`  | Height of the section label container |

---

## Responsive Breakpoints

| Viewport       | `--card-w` | Grid columns |
|----------------|------------|--------------|
| < 768px        | 110px      | auto-fill, minmax(140px, 1fr) |
| 768px - 1023px | 160px      | " |
| 1024px+        | 180px      | " |
| 1440px+        | 210px      | " |
| 1920px+        | 240px      | " |
| 2560px+        | 280px      | " |

The carousel track `min-height` is derived from `--card-w` via `calc(var(--card-w) * 9/14 + 2.5rem)`, with an extra `1.5em` added when titles are `above` or `below`.

---

## DOM Structure (generated)

```
<carousel-dropdown-browser>
  .cdb-strip                          ← flex column (controls + carousel + dropdown)
    .cdb-controls                     ← nav arrows + expand toggle (position depends on controls-position)
      button.cdb-arrow.cdb-sec-arrow  ← section nav left (double chevron SVG, hidden if ≤1 section)
      button.cdb-arrow.cdb-arrow-left ← left nav (single chevron SVG)
      button.cdb-toggle               ← grid expand/collapse toggle
      button.cdb-arrow.cdb-arrow-right← right nav (single chevron SVG)
      button.cdb-arrow.cdb-sec-arrow  ← section nav right (double chevron SVG, hidden if ≤1 section)
    .cdb-container                    ← carousel viewport wrapper
      .cdb-section-label-container    ← scrolling section labels (above track)
        .cdb-section-label            ← per-section label (absolute, translateX positioned)
      .cdb-viewport                   ← overflow:hidden clip region
        .cdb-track                    ← absolute container for cards
          .cdb-card[data-flip-key]    ← carousel card (absolute, transformed)
            .cdb-card-frame           ← bordered card container (3D transforms, flex column, mask target)
              .cdb-card-title         ← title (flex-ordered above/below or absolute overlay)
              .cdb-card-img           ← image container (aspect-ratio 14/9)
                img                   ← thumbnail
    .cdb-dropdown                     ← grid container (hidden when collapsed)
      .cdb-grid                       ← CSS grid
        .cdb-grid-section-header      ← full-width section header
        .cdb-grid-card[data-flip-key] ← grid card (flex column)
          img                         ← thumbnail
          .cdb-grid-card-name         ← title
          .cdb-grid-card-actions      ← delete button etc.
```

The order of `.cdb-controls` relative to `.cdb-container` changes based on `controls-position`.

---

## Programmatic Usage

```js
const carousel = document.querySelector('carousel-dropdown-browser');

// Populate from data
carousel.clearItems();
const sec = document.createElement('carousel-dropdown-browser-section');
sec.setAttribute('label', 'My Section');
for (const entry of entries) {
    const card = document.createElement('carousel-dropdown-browser-card');
    card.setAttribute('key', entry.id);
    card.setAttribute('label', entry.name);
    card.setAttribute('thumb-src', entry.thumb);
    if (entry.canDelete) card.setAttribute('deletable', '');
    card.data = entry;
    sec.appendChild(card);
}
carousel.appendChild(sec);

// Select and center
carousel.selectedKey = 'item-42';
carousel.syncToKey('item-42');

// Listen for interaction
carousel.addEventListener('item-select', e => {
    console.log('Selected:', e.detail.key, e.detail.item.data);
});

carousel.addEventListener('item-delete', e => {
    e.detail.item.data; // original data object
    // remove from DOM, carousel auto-rebuilds via MutationObserver
});

// Toggle grid view
await carousel.expand();
await carousel.collapse();
```

---

## Host Page: Scrollbar Layout Shift

When the carousel's grid dropdown expands/collapses, the scroll parent's content height can cross the scrollbar threshold, causing the browser scrollbar to appear or disappear. This changes the viewport width and shifts all centered content.

**Fix**: The scroll parent (`.gallery-main` in the gallery page) uses `scrollbar-gutter: stable both-edges` to permanently reserve scrollbar space on both sides, keeping content centered regardless of scrollbar state. This is set in `vite-app/css/pages/gallery.css`.

If embedding this component in a different scroll container, apply the same property to prevent layout shift during expand/collapse:

```css
.your-scroll-container {
    overflow-y: auto;
    scrollbar-gutter: stable both-edges;
}
```
