/* jshint esversion: 11 */

// ---- Tab switching ----
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

function fmtBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(2) + ' MB';
}

function setupUploadZone(zone, input, onFile) {
    zone.addEventListener('click', e => {
        if (!e.target.closest('label') && e.target !== input) input.click();
    });
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('dragover');
        if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', () => { if (input.files[0]) onFile(input.files[0]); });
}

// ========================
// IMAGE
// ========================
(function () {
    const uploadZone = document.getElementById('img-upload-zone');
    const fileInput  = document.getElementById('img-file-input');
    const workspace  = document.getElementById('img-workspace');
    const slider     = document.getElementById('img-quality');
    const sliderVal  = document.getElementById('img-quality-value');
    const fmtSelect  = document.getElementById('img-format');
    const prevOrig   = document.getElementById('img-preview-original');
    const prevComp   = document.getElementById('img-preview-compressed');
    const sizeOrig   = document.getElementById('img-size-original');
    const sizeComp   = document.getElementById('img-size-compressed');
    const dlBtn      = document.getElementById('img-download-btn');
    const resetBtn   = document.getElementById('img-reset-btn');

    let origFile = null, origImg = null, resultBlob = null, debounce = null;

    setupUploadZone(uploadZone, fileInput, loadFile);

    function loadFile(file) {
        if (!file.type.startsWith('image/')) return;
        origFile = file;
        const url = URL.createObjectURL(file);
        origImg = new Image();
        origImg.onload = () => {
            prevOrig.src = url;
            sizeOrig.textContent = fmtBytes(file.size);
            uploadZone.classList.add('hidden');
            workspace.classList.add('active');
            compress();
        };
        origImg.src = url;
    }

    async function compress() {
        if (!origImg) return;
        const quality = slider.value / 100;
        const mime = fmtSelect.value === 'webp' ? 'image/webp' : 'image/jpeg';
        const canvas = document.createElement('canvas');
        canvas.width  = origImg.naturalWidth;
        canvas.height = origImg.naturalHeight;
        canvas.getContext('2d').drawImage(origImg, 0, 0);
        resultBlob = await new Promise(res => canvas.toBlob(res, mime, quality));
        if (prevComp.src) URL.revokeObjectURL(prevComp.src);
        prevComp.src = URL.createObjectURL(resultBlob);
        sizeComp.textContent = fmtBytes(resultBlob.size);
    }

    slider.addEventListener('input', () => {
        sliderVal.textContent = slider.value + '%';
        clearTimeout(debounce);
        debounce = setTimeout(compress, 120);
    });

    fmtSelect.addEventListener('change', compress);

    dlBtn.addEventListener('click', () => {
        if (!resultBlob) return;
        const ext  = fmtSelect.value === 'webp' ? 'webp' : 'jpg';
        const name = (origFile.name.replace(/\.[^.]+$/, '') || 'image') + '_compressed.' + ext;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(resultBlob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });

    resetBtn.addEventListener('click', () => {
        origFile = origImg = resultBlob = null;
        fileInput.value = '';
        prevOrig.src = prevComp.src = '';
        sizeOrig.textContent = sizeComp.textContent = '—';
        workspace.classList.remove('active');
        uploadZone.classList.remove('hidden');
    });
})();

// ========================
// AUDIO
// ========================
(function () {
    const uploadZone  = document.getElementById('aud-upload-zone');
    const fileInput   = document.getElementById('aud-file-input');
    const workspace   = document.getElementById('aud-workspace');
    const rateSelect  = document.getElementById('aud-samplerate');
    const bitrateSelect = document.getElementById('aud-bitrate');
    const infoOrig    = document.getElementById('aud-info-original');
    const infoOut     = document.getElementById('aud-info-output');
    const playerOrig  = document.getElementById('aud-player-original');
    const playerOut   = document.getElementById('aud-player-output');
    const sizeOut     = document.getElementById('aud-size-output');
    const processBtn  = document.getElementById('aud-process-btn');
    const dlBtn       = document.getElementById('aud-download-btn');
    const resetBtn    = document.getElementById('aud-reset-btn');
    const statusText  = document.getElementById('aud-status');

    let origFile = null, resultBlob = null;

    setupUploadZone(uploadZone, fileInput, loadFile);

    function loadFile(file) {
        origFile = file;
        playerOrig.src = URL.createObjectURL(file);
        infoOrig.textContent = `Original: ${fmtBytes(file.size)}`;
        uploadZone.classList.add('hidden');
        workspace.classList.add('active');
        statusText.textContent = 'Adjust settings and click Process.';
    }

    processBtn.addEventListener('click', async () => {
        if (!origFile) return;
        processBtn.disabled = true;
        dlBtn.disabled = true;
        statusText.textContent = ffmpegReady ? 'Processing...' : 'Loading FFmpeg (~10 MB, first time only)...';

        try {
            await ensureFFmpeg();

            const ext    = (origFile.name.split('.').pop() || 'audio').toLowerCase();
            const inName = 'input.' + ext;
            statusText.textContent = 'Writing input...';
            await ffmpeg.writeFile(inName, await fetchFileFn(origFile));

            const rate   = rateSelect.value;
            const bitrate = bitrateSelect.value;
            statusText.textContent = 'Encoding to OGG...';
            await ffmpeg.exec([
                '-i', inName,
                '-c:a', 'libvorbis',
                '-b:a', bitrate + 'k',
                '-ar', rate,
                'output.ogg',
            ]);

            const data = await ffmpeg.readFile('output.ogg');
            resultBlob = new Blob([data.buffer], { type: 'audio/ogg' });

            if (playerOut.src) URL.revokeObjectURL(playerOut.src);
            playerOut.src = URL.createObjectURL(resultBlob);
            sizeOut.textContent = fmtBytes(resultBlob.size);
            infoOut.textContent = `Output: OGG Vorbis · ${parseInt(rate).toLocaleString()} Hz · ${bitrate} kbps · ${fmtBytes(resultBlob.size)}`;
            dlBtn.disabled = false;
            statusText.textContent = 'Done!';

            await ffmpeg.deleteFile(inName).catch(() => {});
            await ffmpeg.deleteFile('output.ogg').catch(() => {});
        } catch (e) {
            statusText.textContent = 'Error: ' + e.message;
        }
        processBtn.disabled = false;
    });

    dlBtn.addEventListener('click', () => {
        if (!resultBlob) return;
        const name = (origFile.name.replace(/\.[^.]+$/, '') || 'audio') + '_compressed.ogg';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(resultBlob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });

    resetBtn.addEventListener('click', () => {
        origFile = resultBlob = null;
        fileInput.value = '';
        playerOrig.src = playerOut.src = '';
        infoOrig.textContent = infoOut.textContent = '—';
        sizeOut.textContent = '—';
        statusText.textContent = '';
        dlBtn.disabled = true;
        workspace.classList.remove('active');
        uploadZone.classList.remove('hidden');
    });
})();

// ========================
// FFmpeg.wasm — shared by audio and video tabs
// ========================

// FFmpeg's constructor spawns a Worker using an unpkg URL (cross-origin).
// Browsers block cross-origin worker scripts, so we intercept Worker() and
// wrap any cross-origin module worker in a same-origin blob that re-imports it.
(function () {
    const _Worker = window.Worker;
    window.Worker = function (url, opts) {
        const href = url instanceof URL ? url.href : url;
        if (typeof href === 'string' && !href.startsWith('blob:')) {
            try {
                if (new URL(href).origin !== location.origin) {
                    const blob = new Blob([`import "${href}";`], { type: 'application/javascript' });
                    return new _Worker(URL.createObjectURL(blob), opts);
                }
            } catch (e) { /* relative URL, pass through */ }
        }
        return new _Worker(url, opts);
    };
    window.Worker.prototype = _Worker.prototype;
}());

let ffmpeg = null, fetchFileFn = null, ffmpegReady = false;

async function ensureFFmpeg() {
    if (ffmpegReady) return;
    const [ffmpegMod, utilMod] = await Promise.all([
        import('https://unpkg.com/@ffmpeg/ffmpeg@0.12.6/dist/esm/index.js'),
        import('https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js'),
    ]);
    fetchFileFn = utilMod.fetchFile;
    ffmpeg = new ffmpegMod.FFmpeg();
    const base = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
        coreURL: await utilMod.toBlobURL(`${base}/ffmpeg-core.js`,   'text/javascript'),
        wasmURL: await utilMod.toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegReady = true;
}

// ========================
// VIDEO
// ========================
(function () {
    const uploadZone   = document.getElementById('vid-upload-zone');
    const fileInput    = document.getElementById('vid-file-input');
    const workspace    = document.getElementById('vid-workspace');
    const qualSel      = document.getElementById('vid-quality');
    const resSel       = document.getElementById('vid-resolution');
    const playerOrig   = document.getElementById('vid-player-original');
    const sizeOrig     = document.getElementById('vid-size-original');
    const outputBox    = document.getElementById('vid-output-box');
    const playerOut    = document.getElementById('vid-player-output');
    const sizeOut      = document.getElementById('vid-size-output');
    const processBtn   = document.getElementById('vid-process-btn');
    const dlBtn        = document.getElementById('vid-download-btn');
    const resetBtn     = document.getElementById('vid-reset-btn');
    const statusText   = document.getElementById('vid-status');
    const progressBar  = document.getElementById('vid-progress-bar');
    const progressFill = document.getElementById('vid-progress-fill');

    let origFile = null, resultBlob = null;

    setupUploadZone(uploadZone, fileInput, loadFile);

    function loadFile(file) {
        origFile = file;
        playerOrig.src = URL.createObjectURL(file);
        sizeOrig.textContent = fmtBytes(file.size);
        outputBox.style.display = 'none';
        uploadZone.classList.add('hidden');
        workspace.classList.add('active');
        statusText.textContent = 'Adjust settings and click Process Video.';
    }

    processBtn.addEventListener('click', async () => {
        if (!origFile) return;
        processBtn.disabled = true;
        dlBtn.disabled = true;
        progressBar.style.display = 'block';
        progressFill.style.width = '0%';
        outputBox.style.display = 'none';

        try {
            if (!ffmpegReady) statusText.textContent = 'Loading FFmpeg (~10 MB, first time only)...';
            await ensureFFmpeg();
            ffmpeg.on('progress', ({ progress }) => {
                progressFill.style.width = Math.round(Math.min(progress, 1) * 100) + '%';
            });

            statusText.textContent = 'Writing input...';
            const ext = (origFile.name.split('.').pop() || 'mp4').toLowerCase();
            const inName = 'input.' + ext;
            await ffmpeg.writeFile(inName, await fetchFileFn(origFile));

            const crf = qualSel.value;
            const res = resSel.value;
            const args = ['-i', inName];
            if (res !== 'original') args.push('-vf', `scale=-2:${res}`);
            args.push('-c:v', 'libx264', '-crf', crf, '-preset', 'fast',
                      '-c:a', 'aac', '-b:a', '128k',
                      '-movflags', '+faststart', 'output.mp4');

            statusText.textContent = 'Encoding...';
            await ffmpeg.exec(args);

            const data   = await ffmpeg.readFile('output.mp4');
            resultBlob   = new Blob([data.buffer], { type: 'video/mp4' });
            progressFill.style.width = '100%';

            if (playerOut.src) URL.revokeObjectURL(playerOut.src);
            playerOut.src = URL.createObjectURL(resultBlob);
            sizeOut.textContent = fmtBytes(resultBlob.size);
            outputBox.style.display = 'flex';

            statusText.textContent = `Done! Output: ${fmtBytes(resultBlob.size)}`;
            dlBtn.disabled = false;

            await ffmpeg.deleteFile(inName).catch(() => {});
            await ffmpeg.deleteFile('output.mp4').catch(() => {});
        } catch (e) {
            statusText.textContent = 'Error: ' + e.message;
            progressBar.style.display = 'none';
        }
        processBtn.disabled = false;
    });

    dlBtn.addEventListener('click', () => {
        if (!resultBlob) return;
        const name = (origFile.name.replace(/\.[^.]+$/, '') || 'video') + '_compressed.mp4';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(resultBlob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });

    resetBtn.addEventListener('click', () => {
        origFile = resultBlob = null;
        fileInput.value = '';
        playerOrig.src = playerOut.src = '';
        sizeOrig.textContent = '—';
        sizeOut.textContent = '—';
        statusText.textContent = '';
        progressBar.style.display = 'none';
        progressFill.style.width = '0%';
        dlBtn.disabled = true;
        outputBox.style.display = 'none';
        workspace.classList.remove('active');
        uploadZone.classList.remove('hidden');
    });
})();
