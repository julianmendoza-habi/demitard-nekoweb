class ImageCropper {
    constructor() {
        this.cropper = null;
        this.croppedBlob = null;
        this.currentRatio = 0;

        this.uploadZone = document.getElementById('upload-zone');
        this.fileInput = document.getElementById('file-input');
        this.cropperSection = document.getElementById('cropper-section');
        this.cropperImage = document.getElementById('cropper-image');
        this.previewSection = document.getElementById('preview-section');
        this.previewImage = document.getElementById('preview-image');
        this.cropBtn = document.getElementById('crop-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.downloadBtn = document.getElementById('download-btn');
        this.newCropBtn = document.getElementById('new-sticker-btn');
        this.ratioButtons = document.querySelectorAll('.ratio-btn');

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

        this.ratioButtons.forEach((btn) => {
            btn.addEventListener('click', () => this.setAspectRatio(btn));
        });

        this.cropBtn.addEventListener('click', () => this.cropAndPreview());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.downloadBtn.addEventListener('click', () => this.downloadImage());
        this.newCropBtn.addEventListener('click', () => this.reset());
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

        const ratio = this.currentRatio === 0 ? NaN : this.currentRatio;

        this.cropper = new Cropper(this.cropperImage, {
            aspectRatio: ratio,
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

    setAspectRatio(selectedBtn) {
        this.ratioButtons.forEach((btn) => btn.classList.remove('active'));
        selectedBtn.classList.add('active');

        const ratio = parseFloat(selectedBtn.dataset.ratio);
        this.currentRatio = ratio;

        if (this.cropper) {
            this.cropper.setAspectRatio(ratio === 0 ? NaN : ratio);
        }
    }

    cropAndPreview() {
        if (!this.cropper) return;

        const canvas = this.cropper.getCroppedCanvas({
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        });

        canvas.toBlob((blob) => {
            this.croppedBlob = blob;
            const url = URL.createObjectURL(blob);

            this.previewImage.src = url;
            this.cropperSection.classList.remove('active');
            this.previewSection.classList.add('active');

            if (this.cropper) {
                this.cropper.destroy();
                this.cropper = null;
            }
        }, 'image/png');
    }

    downloadImage() {
        if (!this.croppedBlob) return;

        const url = URL.createObjectURL(this.croppedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cropped_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    reset() {
        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
        }
        this.croppedBlob = null;
        this.cropperImage.src = '';
        this.previewImage.src = '';
        this.fileInput.value = '';

        this.ratioButtons.forEach((btn) => btn.classList.remove('active'));
        this.ratioButtons[0].classList.add('active');
        this.currentRatio = 0;

        this.cropperSection.classList.remove('active');
        this.previewSection.classList.remove('active');
        this.uploadZone.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ImageCropper();
});
