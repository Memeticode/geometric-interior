/**
 * localStorage and profile gallery helpers for Playwright tests.
 */

const PROFILES_KEY = 'geo_self_portrait_profiles_v3';
const ORDER_KEY = 'geo_self_portrait_profile_order_v1';
const ANIM_KEY = 'geo_self_portrait_anim_profiles_v1';
const PANEL_KEY = 'geo-self-portrait-panel-collapsed';

export async function clearAllStorage(page) {
    await page.evaluate(() => localStorage.clear());
}

export async function getLocalStorageProfiles(page) {
    return page.evaluate((key) =>
        JSON.parse(localStorage.getItem(key) || '{}'), PROFILES_KEY);
}

export async function setLocalStorageProfiles(page, profiles) {
    await page.evaluate(({ key, val }) =>
        localStorage.setItem(key, JSON.stringify(val)), { key: PROFILES_KEY, val: profiles });
}

export async function getProfileOrder(page) {
    return page.evaluate((key) =>
        JSON.parse(localStorage.getItem(key) || '[]'), ORDER_KEY);
}

export async function getPanelCollapsedState(page) {
    return page.evaluate((key) => localStorage.getItem(key), PANEL_KEY);
}

export async function countProfileCards(page, galleryId) {
    return page.$$eval(`#${galleryId} .profile-card`, cards => cards.length);
}

export async function getActiveProfileCardName(page) {
    return page.$eval('.profile-card.active-profile .profile-card-name',
        el => el.textContent).catch(() => null);
}

export async function getProfileCardNames(page, galleryId) {
    return page.$$eval(`#${galleryId} .profile-card .profile-card-name`,
        els => els.map(el => el.textContent));
}

/**
 * Click a profile card by its name within a given gallery.
 */
export async function clickProfileCard(page, galleryId, profileName) {
    await page.$eval(
        `#${galleryId} .profile-card`,
        (cards, name) => {
            const card = Array.from(cards.length !== undefined ? cards : [cards])
                .find(c => c.querySelector('.profile-card-name')?.textContent === name);
            if (card) card.querySelector('.profile-card-header').click();
        },
        profileName
    );
}

/**
 * Click a profile card by its name across both galleries.
 */
export async function clickAnyProfileCard(page, profileName) {
    await page.evaluate((name) => {
        const cards = document.querySelectorAll('.profile-card');
        for (const card of cards) {
            if (card.querySelector('.profile-card-name')?.textContent === name) {
                card.querySelector('.profile-card-header').click();
                return;
            }
        }
    }, profileName);
}

/**
 * Click the delete button on a profile card by name.
 */
export async function deleteProfileCard(page, profileName) {
    await page.evaluate((name) => {
        const cards = document.querySelectorAll('#userGallery .profile-card');
        for (const card of cards) {
            if (card.querySelector('.profile-card-name')?.textContent === name) {
                card.querySelector('.profile-card-delete').click();
                return;
            }
        }
    }, profileName);
}

/**
 * Click the move-up or move-down button on a profile card.
 * @param {string} direction 'up' or 'down'
 */
export async function moveProfileCard(page, profileName, direction) {
    await page.evaluate(({ name, dir }) => {
        const cards = document.querySelectorAll('#userGallery .profile-card');
        for (const card of cards) {
            if (card.querySelector('.profile-card-name')?.textContent === name) {
                const buttons = card.querySelectorAll('.profile-card-move');
                (dir === 'up' ? buttons[0] : buttons[1]).click();
                return;
            }
        }
    }, { name: profileName, dir: direction });
}
