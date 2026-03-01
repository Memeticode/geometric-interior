/**
 * Render queue section inside the site menu drawer.
 * Jobs are split into Active, Queued, and Completed sub-sections.
 * Queued and Completed are collapsible; all sections always visible.
 * Updates in real-time from the render queue's onUpdate callback.
 */

import { t } from '../i18n/locale.js';

/**
 * @param {Object} opts
 * @param {HTMLElement}       opts.groupEl   — #rqGroup (the settings-group wrapper)
 * @param {HTMLElement}       opts.listEl    — #rqJobList (job list container)
 * @param {HTMLElement}       opts.badgeEl   — #renderQueueBadge (on hamburger button)
 * @param {HTMLButtonElement} opts.clearBtn  — #rqClearBtn
 * @param {(jobId: string) => void}  opts.onCancel
 * @param {() => void}              opts.onClear
 * @param {(job: Object) => void}   opts.onView
 */
export function initRenderQueueMenu(opts) {
    const { groupEl, listEl, badgeEl, clearBtn } = opts;
    if (!groupEl || !listEl) return null;

    const activeSection = document.getElementById('rqActive');
    const queuedSection = document.getElementById('rqQueued');
    const completedSection = document.getElementById('rqCompleted');
    const activeJobs = document.getElementById('rqActiveJobs');
    const queuedJobs = document.getElementById('rqQueuedJobs');
    const completedJobs = document.getElementById('rqCompletedJobs');
    const activeLabel = activeSection?.querySelector('.rq-section-label');
    const queuedHeader = queuedSection?.querySelector('.rq-section-header');
    const queuedLabel = queuedSection?.querySelector('.rq-section-label');
    const completedHeader = completedSection?.querySelector('.rq-section-header');
    const completedLabel = completedSection?.querySelector('.rq-section-label');

    // Wire collapsible toggles for Queued and Completed
    for (const header of [queuedHeader, completedHeader]) {
        if (!header) continue;
        const body = header.nextElementSibling;
        // Start collapsed
        body?.classList.add('collapsed');
        header.addEventListener('click', () => {
            const expanded = header.getAttribute('aria-expanded') === 'true';
            header.setAttribute('aria-expanded', String(!expanded));
            if (body) body.classList.toggle('collapsed', expanded);
        });
    }

    // Clear finished jobs
    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (opts.onClear) opts.onClear();
        });
    }

    /**
     * Build DOM for a single job item.
     */
    function buildJobEl(job) {
        const el = document.createElement('div');
        el.className = 'rq-job';

        // Thumbnail for completed jobs
        if (job.status === 'complete' && job.asset && job.asset.thumbDataUrl) {
            const thumb = document.createElement('img');
            thumb.className = 'rq-job-thumb';
            thumb.src = job.asset.thumbDataUrl;
            thumb.alt = job.name;
            el.appendChild(thumb);
        }

        // Info column
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

        // Action buttons
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

    /**
     * Build empty-state placeholder element.
     */
    function buildEmptyEl(msgKey) {
        const el = document.createElement('div');
        el.className = 'rq-job-empty';
        el.textContent = t(msgKey);
        return el;
    }

    /**
     * Update the job list and badge from the current job list.
     */
    function update(jobs) {
        // Show/hide the render queue group
        groupEl.style.display = jobs.length > 0 ? '' : 'none';

        // Update hamburger badge
        if (badgeEl) {
            const activeCount = jobs.filter(j => j.status === 'rendering' || j.status === 'queued').length;
            const isRendering = jobs.some(j => j.status === 'rendering');

            if (activeCount > 0) {
                badgeEl.textContent = activeCount;
                badgeEl.classList.remove('hidden');
                badgeEl.classList.toggle('rendering', isRendering);
            } else {
                badgeEl.classList.add('hidden');
                badgeEl.classList.remove('rendering');
            }
        }

        // Show/hide clear button
        const hasFinished = jobs.some(j => j.status === 'complete' || j.status === 'failed');
        if (clearBtn) clearBtn.style.display = hasFinished ? '' : 'none';

        // Split jobs by status
        const active = jobs.filter(j => j.status === 'rendering');
        const queued = jobs.filter(j => j.status === 'queued');
        const completed = jobs.filter(j => j.status === 'complete' || j.status === 'failed');

        // Active section — always visible, show empty state
        activeJobs.innerHTML = '';
        if (active.length > 0) {
            for (const job of active) activeJobs.appendChild(buildJobEl(job));
        } else {
            activeJobs.appendChild(buildEmptyEl('renderQueue.noActive'));
        }

        // Queued section — always visible, show count + empty state
        queuedJobs.innerHTML = '';
        if (queued.length > 0) {
            for (const job of queued) queuedJobs.appendChild(buildJobEl(job));
        } else {
            queuedJobs.appendChild(buildEmptyEl('renderQueue.noQueued'));
        }
        if (queuedLabel) {
            queuedLabel.textContent = t('renderQueue.queuedSection') + ' (' + queued.length + ')';
        }

        // Completed section — always visible, show count + empty state
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
