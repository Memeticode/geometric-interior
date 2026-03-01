/**
 * Import handler — modal for importing profiles via file upload or JSON paste.
 */

import { validateStillConfig, configToProfile } from '../../lib/core/config-schema.js';
import { loadProfiles, saveProfiles } from '../ui/profiles.js';
import { toast } from '../shared/toast.js';
import { t } from '../i18n/locale.js';

/**
 * @param {object} opts
 * @param {Function} opts.onImported - (lastName, count) called after successful import
 */
export function initImportHandler({ onImported }) {
    const modal = document.getElementById('importModal');
    const fileInput = document.getElementById('importFile');
    const jsonArea = document.getElementById('importJson');
    const errorEl = document.getElementById('importError');
    const dropZone = document.getElementById('fileDropZone');
    const dropName = document.getElementById('fileDropName');

    function showError(msg) {
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
    }

    function clear() {
        fileInput.value = '';
        jsonArea.value = '';
        errorEl.style.display = 'none';
        dropName.textContent = '';
    }

    function open() {
        clear();
        modal.classList.remove('hidden');
        modal.classList.add('modal-entering');
    }

    function close() {
        modal.classList.remove('modal-entering');
        modal.classList.add('modal-leaving');
        setTimeout(() => {
            modal.classList.remove('modal-leaving');
            modal.classList.add('hidden');
        }, 250);
    }

    function validateAndImport(raw) {
        let data;
        try { data = JSON.parse(raw); } catch { showError('Invalid JSON.'); return; }

        const items = Array.isArray(data) ? data : [data];
        if (items.length === 0) { showError('No profiles found.'); return; }

        for (let i = 0; i < items.length; i++) {
            const label = items.length > 1 ? `Item ${i + 1}` : 'Profile';
            const { ok, errors } = validateStillConfig(items[i]);
            if (!ok) { showError(`${label}:\n${errors.join('\n')}`); return; }
        }

        const profiles = loadProfiles();
        let lastName = '';
        for (const item of items) {
            const { name, profile } = configToProfile(item);
            profiles[name] = profile;
            lastName = name;
        }
        saveProfiles(profiles);

        close();
        toast(t('toast.imported', { count: items.length, s: items.length > 1 ? 's' : '' }));
        onImported(lastName, items.length);
    }

    // Wire up event listeners
    document.getElementById('importBtn').addEventListener('click', open);
    document.getElementById('importModalClose').addEventListener('click', close);
    document.getElementById('importCancelBtn').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    document.getElementById('importConfirmBtn').addEventListener('click', () => {
        if (fileInput.files.length > 0) {
            const reader = new FileReader();
            reader.onload = () => validateAndImport(reader.result);
            reader.onerror = () => showError('Failed to read file.');
            reader.readAsText(fileInput.files[0]);
        } else if (jsonArea.value.trim()) {
            validateAndImport(jsonArea.value.trim());
        } else {
            showError('Upload a file or paste JSON.');
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            dropName.textContent = fileInput.files[0].name;
            const reader = new FileReader();
            reader.onload = () => { jsonArea.value = reader.result; errorEl.style.display = 'none'; };
            reader.readAsText(fileInput.files[0]);
        }
    });

    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('drag-over'); });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            fileInput.dispatchEvent(new Event('change'));
        }
    });

    return { open, close };
}
