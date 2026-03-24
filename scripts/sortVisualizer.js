/* jshint esversion: 11 */

class SortVisualizer {
    constructor() {
        this.array = [];
        this.size = 50;
        this.speed = 50;
        this.running = false;
        this.stopped = false;
        this.muted = false;
        this.audioCtx = null;
        this.oscillator = null;
        this.gainNode = null;
        this.comparisons = 0;
        this.swapCount = 0;
        this.startTime = 0;
        this.timerInterval = null;
        this._highlighted = [];

        this.barsContainer = document.getElementById('bars-container');
        this.algorithmSelect = document.getElementById('algorithm-select');
        this.sizeSlider = document.getElementById('size-slider');
        this.speedSlider = document.getElementById('speed-slider');
        this.sizeValue = document.getElementById('size-value');
        this.speedValue = document.getElementById('speed-value');
        this.runBtn = document.getElementById('run-btn');
        this.shuffleBtn = document.getElementById('shuffle-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.muteBtn = document.getElementById('mute-btn');
        this.statsComparisons = document.getElementById('stats-comparisons');
        this.statsSwaps = document.getElementById('stats-swaps');
        this.statsTime = document.getElementById('stats-time');

        this.bindEvents();
        this.generateArray();
    }

    bindEvents() {
        this.sizeSlider.addEventListener('input', () => {
            this.size = parseInt(this.sizeSlider.value);
            this.sizeValue.textContent = this.size;
            if (!this.running) this.generateArray();
        });

        this.speedSlider.addEventListener('input', () => {
            this.speed = parseInt(this.speedSlider.value);
            this.speedValue.textContent = this.speed;
        });

        this.runBtn.addEventListener('click', () => this.run());
        this.shuffleBtn.addEventListener('click', () => {
            if (!this.running) this.generateArray();
        });
        this.stopBtn.addEventListener('click', () => this.stop());
        this.muteBtn.addEventListener('click', () => this.toggleMute());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !this.running) this.run();
            if (e.key === 'Escape' && this.running) this.stop();
        });
    }

    toggleMute() {
        this.muted = !this.muted;
        this.muteBtn.textContent = this.muted ? 'Sound: OFF' : 'Sound: ON';
        this.muteBtn.classList.toggle('muted', this.muted);
    }

    generateArray() {
        this.array = Array.from({ length: this.size }, (_, i) => i + 1);
        this.fisherYatesShuffle();
        this.resetStats();
        this.rebuildBars();
        this.renderAll();
    }

    fisherYatesShuffle() {
        for (let i = this.array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.array[i], this.array[j]] = [this.array[j], this.array[i]];
        }
    }

    resetStats() {
        this.comparisons = 0;
        this.swapCount = 0;
        this.statsComparisons.textContent = '0';
        this.statsSwaps.textContent = '0';
        this.statsTime.textContent = '0.00s';
    }

    startTimer() {
        this.startTime = performance.now();
        this.timerInterval = setInterval(() => {
            const elapsed = ((performance.now() - this.startTime) / 1000).toFixed(2);
            this.statsTime.textContent = elapsed + 's';
        }, 50);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        if (this.startTime) {
            const elapsed = ((performance.now() - this.startTime) / 1000).toFixed(2);
            this.statsTime.textContent = elapsed + 's';
        }
    }

    // ======================== RENDERING ========================

    rebuildBars() {
        this.barsContainer.innerHTML = '';
        const barWidth = Math.max(
            1,
            this.barsContainer.clientWidth / this.size - (this.size > 150 ? 0 : 1)
        );
        const gap = this.size > 150 ? '0' : '1px';
        for (let i = 0; i < this.size; i++) {
            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.width = `${barWidth}px`;
            bar.style.marginRight = gap;
            this.barsContainer.appendChild(bar);
        }
        this._highlighted = [];
    }

    renderAll() {
        const bars = this.barsContainer.children;
        for (let i = 0; i < this.array.length; i++) {
            bars[i].style.height = `${(this.array[i] / this.size) * 100}%`;
            bars[i].style.backgroundColor = 'white';
        }
        this._highlighted = [];
    }

    clearHighlights() {
        const bars = this.barsContainer.children;
        for (const idx of this._highlighted) {
            if (bars[idx]) bars[idx].style.backgroundColor = 'white';
        }
        this._highlighted = [];
    }

    highlightBars(indices, color) {
        this.clearHighlights();
        const bars = this.barsContainer.children;
        for (const idx of indices) {
            if (bars[idx]) bars[idx].style.backgroundColor = color;
        }
        this._highlighted = indices;
    }

    updateBarHeight(idx) {
        this.barsContainer.children[idx].style.height =
            `${(this.array[idx] / this.size) * 100}%`;
    }

    // ======================== AUDIO ========================

    initAudio() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        if (!this.oscillator) {
            this.oscillator = this.audioCtx.createOscillator();
            this.gainNode = this.audioCtx.createGain();
            this.oscillator.connect(this.gainNode);
            this.gainNode.connect(this.audioCtx.destination);
            this.oscillator.type = 'sine';
            this.gainNode.gain.value = 0;
            this.oscillator.start();
        }
    }

    playSound(value) {
        if (this.muted || !this.oscillator) return;
        const freq = 150 + (value / this.size) * 900;
        const now = this.audioCtx.currentTime;
        this.oscillator.frequency.setValueAtTime(freq, now);
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(0.06, now);
        this.gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    }

    // ======================== TIMING ========================

    getDelay() {
        const maxDelay = 250;
        const minDelay = 0;
        return maxDelay - (this.speed / 100) * (maxDelay - minDelay);
    }

    async delay() {
        const ms = this.getDelay();
        if (ms <= 2) {
            return new Promise((resolve) => requestAnimationFrame(resolve));
        }
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // ======================== CORE OPERATIONS ========================

    checkStopped() {
        if (this.stopped) throw 'stopped';
    }

    async compare(i, j) {
        this.checkStopped();
        this.comparisons++;
        this.statsComparisons.textContent = this.comparisons;
        this.playSound(this.array[j]);
        this.highlightBars([i, j], '#ffdf42');
        await this.delay();
        return this.array[i] - this.array[j];
    }

    async swap(i, j) {
        this.checkStopped();
        [this.array[i], this.array[j]] = [this.array[j], this.array[i]];
        this.swapCount++;
        this.statsSwaps.textContent = this.swapCount;
        this.playSound(this.array[i]);
        this.updateBarHeight(i);
        this.updateBarHeight(j);
        this.highlightBars([i, j], '#ff4444');
        await this.delay();
    }

    async write(idx, value) {
        this.checkStopped();
        this.array[idx] = value;
        this.swapCount++;
        this.statsSwaps.textContent = this.swapCount;
        this.playSound(value);
        this.updateBarHeight(idx);
        this.highlightBars([idx], '#ff4444');
        await this.delay();
    }

    // ======================== CONTROLS ========================

    setControls(running) {
        this.running = running;
        this.runBtn.disabled = running;
        this.shuffleBtn.disabled = running;
        this.sizeSlider.disabled = running;
        this.algorithmSelect.disabled = running;
        this.stopBtn.disabled = !running;
    }

    async run() {
        this.initAudio();
        this.stopped = false;
        this.setControls(true);
        this.resetStats();
        this.startTimer();

        const algorithm = this.algorithmSelect.value;

        try {
            switch (algorithm) {
                case 'bubble': await this.bubbleSort(); break;
                case 'selection': await this.selectionSort(); break;
                case 'insertion': await this.insertionSort(); break;
                case 'merge': await this.mergeSort(0, this.array.length - 1); break;
                case 'quick': await this.quickSort(0, this.array.length - 1); break;
                case 'heap': await this.heapSort(); break;
                case 'shell': await this.shellSort(); break;
                case 'cocktail': await this.cocktailSort(); break;
                case 'gnome': await this.gnomeSort(); break;
                case 'comb': await this.combSort(); break;
                case 'bogo': await this.bogoSort(); break;
                case 'radix': await this.radixSort(); break;
            }
            if (!this.stopped) {
                await this.completionSweep();
            }
        } catch (e) {
            if (e !== 'stopped') console.error(e);
        }

        this.stopTimer();
        this.setControls(false);
    }

    stop() {
        this.stopped = true;
    }

    async completionSweep() {
        this.clearHighlights();
        const bars = this.barsContainer.children;
        const sweepDelay = Math.max(3, 600 / this.array.length);
        for (let i = 0; i < this.array.length; i++) {
            if (this.stopped) return;
            this.playSound(this.array[i]);
            bars[i].style.backgroundColor = '#4CAF50';
            await new Promise((r) => setTimeout(r, sweepDelay));
        }
        await new Promise((r) => setTimeout(r, 300));
    }

    // ======================== SORTING ALGORITHMS ========================

    async bubbleSort() {
        const n = this.array.length;
        for (let i = 0; i < n - 1; i++) {
            let swapped = false;
            for (let j = 0; j < n - i - 1; j++) {
                if (await this.compare(j, j + 1) > 0) {
                    await this.swap(j, j + 1);
                    swapped = true;
                }
            }
            if (!swapped) break;
        }
    }

    async selectionSort() {
        const n = this.array.length;
        for (let i = 0; i < n - 1; i++) {
            let minIdx = i;
            for (let j = i + 1; j < n; j++) {
                if (await this.compare(j, minIdx) < 0) {
                    minIdx = j;
                }
            }
            if (minIdx !== i) {
                await this.swap(i, minIdx);
            }
        }
    }

    async insertionSort() {
        const n = this.array.length;
        for (let i = 1; i < n; i++) {
            let j = i;
            while (j > 0 && (await this.compare(j - 1, j)) > 0) {
                await this.swap(j - 1, j);
                j--;
            }
        }
    }

    async mergeSort(left, right) {
        if (left >= right) return;
        const mid = Math.floor((left + right) / 2);
        await this.mergeSort(left, mid);
        await this.mergeSort(mid + 1, right);
        await this.mergeProcedure(left, mid, right);
    }

    async mergeProcedure(left, mid, right) {
        const temp = this.array.slice(left, right + 1);
        let i = 0;
        let j = mid - left + 1;
        let k = left;

        while (i <= mid - left && j <= right - left) {
            this.comparisons++;
            this.statsComparisons.textContent = this.comparisons;
            if (temp[i] <= temp[j]) {
                await this.write(k, temp[i]);
                i++;
            } else {
                await this.write(k, temp[j]);
                j++;
            }
            k++;
        }

        while (i <= mid - left) {
            await this.write(k, temp[i]);
            i++;
            k++;
        }

        while (j <= right - left) {
            await this.write(k, temp[j]);
            j++;
            k++;
        }
    }

    async quickSort(low, high) {
        if (low >= high) return;
        const pivotIdx = await this.partition(low, high);
        await this.quickSort(low, pivotIdx - 1);
        await this.quickSort(pivotIdx + 1, high);
    }

    async partition(low, high) {
        let i = low - 1;

        for (let j = low; j < high; j++) {
            if (await this.compare(j, high) < 0) {
                i++;
                await this.swap(i, j);
            }
        }

        await this.swap(i + 1, high);
        return i + 1;
    }

    async heapSort() {
        const n = this.array.length;

        for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
            await this.heapify(n, i);
        }

        for (let i = n - 1; i > 0; i--) {
            await this.swap(0, i);
            await this.heapify(i, 0);
        }
    }

    async heapify(n, i) {
        let largest = i;
        const left = 2 * i + 1;
        const right = 2 * i + 2;

        if (left < n && (await this.compare(left, largest)) > 0) {
            largest = left;
        }

        if (right < n && (await this.compare(right, largest)) > 0) {
            largest = right;
        }

        if (largest !== i) {
            await this.swap(i, largest);
            await this.heapify(n, largest);
        }
    }

    async shellSort() {
        const n = this.array.length;
        let gap = Math.floor(n / 2);

        while (gap > 0) {
            for (let i = gap; i < n; i++) {
                let j = i;
                while (j >= gap && (await this.compare(j - gap, j)) > 0) {
                    await this.swap(j - gap, j);
                    j -= gap;
                }
            }
            gap = Math.floor(gap / 2);
        }
    }

    async cocktailSort() {
        let start = 0;
        let end = this.array.length - 1;
        let swapped = true;

        while (swapped) {
            swapped = false;

            for (let i = start; i < end; i++) {
                if (await this.compare(i, i + 1) > 0) {
                    await this.swap(i, i + 1);
                    swapped = true;
                }
            }

            if (!swapped) break;
            end--;
            swapped = false;

            for (let i = end - 1; i >= start; i--) {
                if (await this.compare(i, i + 1) > 0) {
                    await this.swap(i, i + 1);
                    swapped = true;
                }
            }

            start++;
        }
    }

    async gnomeSort() {
        let i = 0;
        const n = this.array.length;

        while (i < n) {
            if (i === 0 || (await this.compare(i - 1, i)) <= 0) {
                i++;
            } else {
                await this.swap(i - 1, i);
                i--;
            }
        }
    }

    async combSort() {
        const n = this.array.length;
        let gap = n;
        const shrink = 1.3;
        let sorted = false;

        while (!sorted) {
            gap = Math.floor(gap / shrink);
            if (gap <= 1) {
                gap = 1;
                sorted = true;
            }

            for (let i = 0; i + gap < n; i++) {
                if (await this.compare(i, i + gap) > 0) {
                    await this.swap(i, i + gap);
                    sorted = false;
                }
            }
        }
    }

    async bogoSort() {
        if (this.size > 8) {
            this.size = 8;
            this.sizeSlider.value = 8;
            this.sizeValue.textContent = 8;
            this.generateArray();
            this.resetStats();
            this.startTime = performance.now();
        }

        while (!this.isSorted()) {
            this.checkStopped();
            this.fisherYatesShuffle();
            this.swapCount++;
            this.statsSwaps.textContent = this.swapCount;
            this.playSound(this.array[Math.floor(Math.random() * this.array.length)]);
            this.renderAll();
            await this.delay();
        }
    }

    isSorted() {
        for (let i = 0; i < this.array.length - 1; i++) {
            this.comparisons++;
            if (this.array[i] > this.array[i + 1]) return false;
        }
        this.statsComparisons.textContent = this.comparisons;
        return true;
    }

    async radixSort() {
        const max = Math.max(...this.array);
        let exp = 1;

        while (Math.floor(max / exp) > 0) {
            await this.countingSortByDigit(exp);
            exp *= 10;
        }
    }

    async countingSortByDigit(exp) {
        const n = this.array.length;
        const output = new Array(n);
        const count = new Array(10).fill(0);

        for (let i = 0; i < n; i++) {
            const digit = Math.floor(this.array[i] / exp) % 10;
            count[digit]++;
        }

        for (let i = 1; i < 10; i++) {
            count[i] += count[i - 1];
        }

        for (let i = n - 1; i >= 0; i--) {
            const digit = Math.floor(this.array[i] / exp) % 10;
            output[count[digit] - 1] = this.array[i];
            count[digit]--;
        }

        for (let i = 0; i < n; i++) {
            await this.write(i, output[i]);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SortVisualizer();
});
