/**
 * Export blob interception and ZIP parsing via in-browser JSZip.
 */

/**
 * Inject a hook to capture the next blob passed to URL.createObjectURL.
 * Call this BEFORE triggering the export action.
 */
export async function interceptExportBlob(page) {
    await page.evaluate(() => {
        window.__testExportBlob = null;
        window.__testOrigCreateObjectURL = window.__testOrigCreateObjectURL || URL.createObjectURL.bind(URL);
        URL.createObjectURL = (blob) => {
            window.__testExportBlob = blob;
            return window.__testOrigCreateObjectURL(blob);
        };
    });
}

/**
 * After an export, parse the captured ZIP blob in-browser using JSZip.
 * Returns { filenames, metadata, titleTxt, altTxt, pngSignatureValid, blobSize }.
 */
export async function getExportZipContents(page) {
    return page.evaluate(async () => {
        const blob = window.__testExportBlob;
        if (!blob) return null;

        const JSZip = window.JSZip;
        if (!JSZip) return { error: 'JSZip not loaded' };

        try {
            const zip = await JSZip.loadAsync(blob);
            const filenames = Object.keys(zip.files);

            // Find files by suffix
            const metaFile = filenames.find(f => f.endsWith('metadata.json'));
            const titleFile = filenames.find(f => f.endsWith('title.txt'));
            const altFile = filenames.find(f => f.endsWith('alt-text.txt'));
            const pngFile = filenames.find(f => f.endsWith('image.png'));

            const metadata = metaFile
                ? JSON.parse(await zip.file(metaFile).async('string'))
                : null;
            const titleTxt = titleFile
                ? await zip.file(titleFile).async('string')
                : null;
            const altTxt = altFile
                ? await zip.file(altFile).async('string')
                : null;

            let pngSignatureValid = false;
            if (pngFile) {
                const pngBuf = await zip.file(pngFile).async('uint8array');
                pngSignatureValid = pngBuf[0] === 0x89
                    && pngBuf[1] === 0x50
                    && pngBuf[2] === 0x4E
                    && pngBuf[3] === 0x47;
            }

            return {
                filenames,
                metadata,
                titleTxt,
                altTxt,
                pngSignatureValid,
                blobSize: blob.size,
            };
        } catch (err) {
            return { error: err.message };
        }
    });
}

/**
 * Clean up the interceptor after use.
 */
export async function cleanupExportInterceptor(page) {
    await page.evaluate(() => {
        if (window.__testOrigCreateObjectURL) {
            URL.createObjectURL = window.__testOrigCreateObjectURL;
        }
        window.__testExportBlob = null;
    });
}
