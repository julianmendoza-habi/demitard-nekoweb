class StickerMaker {
    constructor() {
        this.cropper = null;
        this.stickerBlob = null;

        this.uploadZone = document.getElementById('upload-zone');
        this.fileInput = document.getElementById('file-input');
        this.cropperSection = document.getElementById('cropper-section');
        this.cropperImage = document.getElementById('cropper-image');
        this.previewSection = document.getElementById('preview-section');
        this.previewImage = document.getElementById('preview-image');
        this.cropBtn = document.getElementById('crop-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.downloadBtn = document.getElementById('download-btn');
        this.shareBtn = document.getElementById('share-btn');
        this.newStickerBtn = document.getElementById('new-sticker-btn');

        this.bindEvents();
    }

    bindEvents() {
        this.fileInput.addEventListener('change', (e) => this.handleFile(e.target.files[0]));

        this.uploadZone.addEventListener('click', (e) => {
            if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') {
                this.fileInput.click();
            }
        });

        this.uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadZone.classList.add('dragover');
        });

        this.uploadZone.addEventListener('dragleave', () => {
            this.uploadZone.classList.remove('dragover');
        });

        this.uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.handleFile(file);
            }
        });

        this.cropBtn.addEventListener('click', () => this.cropAndPreview());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.downloadBtn.addEventListener('click', () => this.downloadSticker());
        this.shareBtn.addEventListener('click', () => this.shareToWhatsApp());
        this.newStickerBtn.addEventListener('click', () => this.reset());
    }

    handleFile(file) {
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.showCropper(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    showCropper(imageSrc) {
        this.uploadZone.classList.add('hidden');
        this.previewSection.classList.remove('active');
        this.cropperSection.classList.add('active');

        this.cropperImage.src = imageSrc;

        if (this.cropper) {
            this.cropper.destroy();
        }

        this.cropper = new Cropper(this.cropperImage, {
            aspectRatio: 1,
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 0.9,
            responsive: true,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
        });
    }

    cropAndPreview() {
        if (!this.cropper) return;

        const canvas = this.cropper.getCroppedCanvas({
            width: 512,
            height: 512,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        });

        canvas.toBlob((blob) => {
            this.stickerBlob = blob;
            const url = URL.createObjectURL(blob);

            this.previewImage.src = url;
            this.cropperSection.classList.remove('active');
            this.previewSection.classList.add('active');

            if (this.cropper) {
                this.cropper.destroy();
                this.cropper = null;
            }
        }, 'image/webp', 0.9);
    }

    downloadSticker() {
        if (!this.stickerBlob) return;

        const url = URL.createObjectURL(this.stickerBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sticker_${Date.now()}.webp`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async shareToWhatsApp() {
        if (!this.stickerBlob) return;

        const file = new File([this.stickerBlob], 'sticker.webp', { type: 'image/webp' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'WhatsApp Sticker',
                    text: '',
                });
            } catch (err) {
                if (err.name !== 'AbortError') {
                    this.fallbackShare();
                }
            }
        } else {
            this.fallbackShare();
        }
    }

    fallbackShare() {
        this.downloadSticker();
        window.open('https://web.whatsapp.com/', '_blank');
    }

    reset() {
        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
        }
        this.stickerBlob = null;
        this.cropperImage.src = '';
        this.previewImage.src = '';
        this.fileInput.value = '';

        this.cropperSection.classList.remove('active');
        this.previewSection.classList.remove('active');
        this.uploadZone.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new StickerMaker();
});
