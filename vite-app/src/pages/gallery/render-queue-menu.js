/**
 * Render queue section inside the site menu.
 * Pinned to the bottom of the menu, expands upward to fill available space.
 * Jobs are split into Active, Queued, and Completed sub-sections.
 * Updates in real-time from the render queue's onUpdate callback.
 */

import { t } from '../../i18n/locale.js';

/**
 * @param {Object} opts
 * @param {HTMLElement}       opts.drawerEl  — #rqMenu (the wrapper inside site menu)
 * @param {HTMLElement}       opts.barEl     — #rqMenuBar (clickable toggle bar)
 * @param {HTMLElement}       opts.listEl    — #rqJobList (job list container)
 * @param {HTMLElement}       opts.countEl   — #rqMenuCount (inline count on bar)
 * @param {HTMLElement}       opts.badgeEl   — #renderQueueBadge (on hamburger button)
 * @param {(jobId: string) => void}  opts.onCancel
 * @param {(job: Object) => void}    opts.onView
 */
export function initRenderQueueMenu(opts) {
    const { drawerEl, barEl, listEl, countEl, badgeEl } = opts;
    if (!drawerEl || !listEl) return null;

    const activeJobs = document.getElementById('rqActiveJobs');
    const queuedJobs = document.getElementById('rqQueuedJobs');
    const completedJobs = document.getElementById('rqCompletedJobs');
    const queuedSection = document.getElementById('rqQueued');
    const completedSection = document.getElementById('rqCompleted');
    const queuedHeader = queuedSection?.querySelector('.rq-section-header');
    const queuedLabel = queuedSection?.querySelector('.rq-section-label');
    const completedHeader = completedSection?.querySelector('.rq-section-header');
    const completedLabel = completedSection?.querySelector('.rq-section-label');

    let prevJobCount = 0;
    let expanded = false;

    const menuEl = drawerEl.closest('.site-menu');

    // Wire bar toggle
    if (barEl) {
        barEl.addEventListener('click', () => {
            expanded = !expanded;
            drawerEl.classList.toggle('rq-menu-expanded', expanded);
            // When expanded, prevent site-menu from scrolling so flex layout works
            if (menuEl) menuEl.classList.toggle('rq-expanded', expanded);
        });
    }

    // Wire collapsible toggles for Queued and Completed sub-sections
    for (const header of [queuedHeader, completedHeader]) {
        if (!header) continue;
        const body = header.nextElementSibling;
        body?.classList.add('collapsed');
        header.addEventListener('click', () => {
            const exp = header.getAttribute('aria-expanded') === 'true';
            header.setAttribute('aria-expanded', String(!exp));
            if (body) body.classList.toggle('collapsed', exp);
        });
    }

    function buildJobEl(job) {
        const el = document.createElement('div');
        el.className = 'rq-job';

        if (job.status === 'complete' && job.asset && job.asset.thumbDataUrl) {
            const thumb = document.createElement('img');
            thumb.className = 'rq-job-thumb';
            thumb.src = job.asset.thumbDataUrl;
            thumb.alt = job.name;
            el.appendChild(thumb);
        }

        const info = document.createElement('div');
        info.className = 'rq-job-info';

        const name = document.createElement('div');
        name.className = 'rq-job-name';
        name.textContent = job.name;
        info.appendChild(name);

        if (job.status === 'rendering') {
            const bar = document.createElement('div');
            bar.className = 'rq-job-bar';
            const fill = document.createElement('div');
            fill.className = 'rq-job-bar-fill';
            fill.style.width = job.progress + '%';
            bar.appendChild(fill);
            info.appendChild(bar);

            const label = document.createElement('div');
            label.className = 'rq-job-label';
            label.textContent = job.label || '';
            info.appendChild(label);
        } else if (job.status === 'failed') {
            const label = document.createElement('div');
            label.className = 'rq-job-label rq-failed';
            label.textContent = job.error || t('renderQueue.failed');
            info.appendChild(label);
        }

        el.appendChild(info);

        const actions = document.createElement('div');
        actions.className = 'rq-job-actions';

        if (job.status === 'queued' || job.status === 'rendering') {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'rq-job-btn';
            cancelBtn.textContent = '\u00d7';
            cancelBtn.title = t('renderQueue.cancel');
            cancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (opts.onCancel) opts.onCancel(job.id);
            });
            actions.appendChild(cancelBtn);
        }

        if (job.status === 'complete') {
            const viewBtn = document.createElement('button');
            viewBtn.className = 'rq-job-btn';
            viewBtn.textContent = t('renderQueue.view');
            viewBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (opts.onView) opts.onView(job);
            });
            actions.appendChild(viewBtn);
        }

        el.appendChild(actions);
        return el;
    }

    function buildEmptyEl(msgKey) {
        const el = document.createElement('div');
        el.className = 'rq-job-empty';
        el.textContent = t(msgKey);
        return el;
    }

    function update(jobs) {
        // Show/hide the section
        if (jobs.length > 0) {
            drawerEl.classList.remove('rq-menu-hidden');
        } else {
            drawerEl.classList.add('rq-menu-hidden');
        }

        // Auto-expand when first job arrives
        if (prevJobCount === 0 && jobs.length > 0) {
            expanded = true;
            drawerEl.classList.add('rq-menu-expanded');
            if (menuEl) menuEl.classList.add('rq-expanded');
        }
        prevJobCount = jobs.length;

        // Update hamburger badge
        const activeCount = jobs.filter(j => j.status === 'rendering' || j.status === 'queued').length;
        const isRendering = jobs.some(j => j.status === 'rendering');

        if (badgeEl) {
            if (activeCount > 0) {
                badgeEl.textContent = activeCount;
                badgeEl.classList.remove('hidden');
                badgeEl.classList.toggle('rendering', isRendering);
            } else {
                badgeEl.classList.add('hidden');
                badgeEl.classList.remove('rendering');
            }
        }

        // Update inline count on the bar
        if (countEl) {
            const queuedCount = jobs.filter(j => j.status === 'queued').length;
            if (isRendering) {
                // "Rendering (1/3)" — current position out of total (rendering + queued)
                const total = 1 + queuedCount;
                countEl.textContent = `Rendering (1/${total})`;
                countEl.classList.add('rendering');
            } else if (queuedCount > 0) {
                countEl.textContent = `${queuedCount} queued`;
                countEl.classList.remove('rendering');
            } else {
                const completedCount = jobs.filter(j => j.status === 'complete').length;
                countEl.textContent = completedCount > 0 ? `${completedCount} completed` : '';
                countEl.classList.remove('rendering');
            }
        }

        // Split jobs by status
        const active = jobs.filter(j => j.status === 'rendering');
        const queued = jobs.filter(j => j.status === 'queued');
        const completed = jobs.filter(j => j.status === 'complete' || j.status === 'failed');

        // Active section
        activeJobs.innerHTML = '';
        if (active.length > 0) {
            for (const job of active) activeJobs.appendChild(buildJobEl(job));
        } else {
            activeJobs.appendChild(buildEmptyEl('renderQueue.noActive'));
        }

        // Queued section
        queuedJobs.innerHTML = '';
        if (queued.length > 0) {
            for (const job of queued) queuedJobs.appendChild(buildJobEl(job));
        } else {
            queuedJobs.appendChild(buildEmptyEl('renderQueue.noQueued'));
        }
        if (queuedLabel) {
            queuedLabel.textContent = t('renderQueue.queuedSection') + ' (' + queued.length + ')';
        }

        // Completed section
        completedJobs.innerHTML = '';
        if (completed.length > 0) {
            for (const job of completed) completedJobs.appendChild(buildJobEl(job));
        } else {
            completedJobs.appendChild(buildEmptyEl('renderQueue.noCompleted'));
        }
        if (completedLabel) {
            completedLabel.textContent = t('renderQueue.completedSection') + ' (' + completed.length + ')';
        }
    }

    return { update };
}
