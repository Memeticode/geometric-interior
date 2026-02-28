import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.routeWebSocket('**', _ws => {});

const errors = [];
page.on('pageerror', err => errors.push(err.message));
page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`);
});

await page.goto('http://localhost:5204/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(2000);

console.log('=== JS errors before modal ===');
errors.forEach(e => console.log(' ', e));

// Check for duplicate IDs
const dupeCheck = await page.evaluate(() => {
    const ids = ['artistStatement', 'developerStatement', 'governanceStatement',
                 'statementModal', 'statementModalClose', 'selectedName', 'selectedCanvas'];
    const result = {};
    for (const id of ids) {
        const els = document.querySelectorAll(`#${id}`);
        if (els.length > 1) {
            result[id] = { count: els.length, parents: Array.from(els).map(e => e.parentElement?.className || 'none') };
        }
    }
    // Also check the total page structure
    const bodyChildren = Array.from(document.body.children).map(c => `${c.tagName}.${c.className}`);
    result._bodyChildren = bodyChildren;
    return result;
});
console.log('\n=== Duplicate IDs ===');
console.log(JSON.stringify(dupeCheck, null, 2));

// Click "Artist Statement" button
await page.locator('#artistStatement').first().click();
await page.waitForTimeout(1000);

// Check what's in each manifesto BEFORE modal opens
const manifestoCheck = await page.evaluate(() => {
    const results = {};
    document.querySelectorAll('.manifesto').forEach((el, i) => {
        results[`manifesto_${i}`] = {
            parent: el.parentElement?.id || el.parentElement?.className || 'unknown',
            tagName: el.tagName,
            innerHTML_length: el.innerHTML.length,
            innerHTML_preview: el.innerHTML.substring(0, 300),
            hasPageContent: el.innerHTML.includes('app-container') || el.innerHTML.includes('gallery-page'),
        };
    });
    return results;
});
console.log('\n=== Manifesto elements ===');
console.log(JSON.stringify(manifestoCheck, null, 2));

// Check modal visibility
const modalVisible = await page.locator('#statementModal').first().evaluate(el => {
    const style = getComputedStyle(el);
    return { display: style.display, visibility: style.visibility, hidden: el.classList.contains('hidden') };
});
console.log('\n=== Modal state ===');
console.log('Modal:', JSON.stringify(modalVisible));

// Check modal body content
const bodyContent = await page.locator('#statementModal .modal-body').first().evaluate(el => {
    return {
        innerHTML_length: el.innerHTML.length,
        textContent_preview: el.textContent.substring(0, 200),
        childCount: el.children.length,
        childClasses: Array.from(el.children).map(c => c.className),
    };
});
console.log('\n=== Modal body ===');
console.log('innerHTML length:', bodyContent.innerHTML_length);
console.log('Text preview:', JSON.stringify(bodyContent.textContent_preview));
console.log('Children:', bodyContent.childClasses);

// Check artist body specifically
const artistContent = await page.locator('#artistBody').evaluate(el => {
    return {
        hidden: el.classList.contains('hidden'),
        manifesto: el.querySelector('.manifesto')?.textContent?.substring(0, 200) || '(empty)',
    };
});
console.log('\n=== Artist body ===');
console.log('Hidden:', artistContent.hidden);
console.log('Content:', JSON.stringify(artistContent.manifesto));

// Check developer body
const devContent = await page.locator('#developerBody').evaluate(el => {
    return {
        hidden: el.classList.contains('hidden'),
        manifesto: el.querySelector('.manifesto')?.textContent?.substring(0, 200) || '(empty)',
    };
});
console.log('\n=== Developer body ===');
console.log('Hidden:', devContent.hidden);
console.log('Content:', JSON.stringify(devContent.manifesto));

// Check title
const title = await page.locator('#statementTitle').first().textContent();
console.log('\n=== Title ===');
console.log('Title:', JSON.stringify(title));

// Check close button visibility
const closeBtn = await page.locator('#statementModalClose').evaluate(el => {
    const icon = el.querySelector('.panel-toggle-icon');
    const bars = el.querySelectorAll('.bar');
    return {
        iconSize: icon ? `${icon.offsetWidth}x${icon.offsetHeight}` : 'null',
        barCount: bars.length,
        barVisible: bars.length > 0 ? bars[0].offsetWidth > 0 : false,
    };
});
console.log('\n=== Close button ===');
console.log('Icon size:', closeBtn.iconSize);
console.log('Bar visible:', closeBtn.barVisible);

console.log('\n=== All JS errors ===');
errors.forEach(e => console.log(' ', e));

await browser.close();
