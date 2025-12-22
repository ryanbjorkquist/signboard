/**
 * Split-Flap Display Component
 * Creates an animated split-flap display effect for text
 */

class SplitFlap {
    // Character set available on a typical split-flap display
    static CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.-°/\'!?';

    constructor(container, options = {}) {
        this.container = typeof container === 'string'
            ? document.querySelector(container)
            : container;

        this.options = {
            chars: options.chars || SplitFlap.CHARS,
            size: options.size || 'normal', // 'small', 'normal', 'large'
            flipDuration: options.flipDuration || 100,
            staggerDelay: options.staggerDelay || 50,
            ...options
        };

        this.flaps = [];
        this.currentText = '';
    }

    /**
     * Initialize the display with a specific number of characters
     */
    init(length) {
        this.container.innerHTML = '';
        this.container.classList.add('split-flap-container');
        this.flaps = [];

        for (let i = 0; i < length; i++) {
            const flap = this.createFlap();
            this.container.appendChild(flap.element);
            this.flaps.push(flap);
        }

        this.currentText = ' '.repeat(length);
        return this;
    }

    /**
     * Create a single flap element
     */
    createFlap() {
        const element = document.createElement('div');
        element.className = `split-flap ${this.options.size}`;

        // Top half (shows top of character)
        const flapTop = document.createElement('div');
        flapTop.className = 'flap flap-top';
        const topContent = document.createElement('span');
        topContent.className = 'flap-content';
        topContent.textContent = ' ';
        flapTop.appendChild(topContent);

        // Bottom half (shows bottom of character)
        const flapBottom = document.createElement('div');
        flapBottom.className = 'flap flap-bottom';
        const bottomContent = document.createElement('span');
        bottomContent.className = 'flap-content';
        bottomContent.textContent = ' ';
        flapBottom.appendChild(bottomContent);

        element.appendChild(flapTop);
        element.appendChild(flapBottom);

        return {
            element,
            flapTop,
            flapBottom,
            topContent,
            bottomContent,
            currentChar: ' '
        };
    }

    /**
     * Set text with animation
     */
    setText(text, animate = true) {
        text = text.toUpperCase().padEnd(this.flaps.length, ' ').substring(0, this.flaps.length);

        // Ensure all characters are in our character set
        text = text.split('').map(char => {
            return this.options.chars.includes(char) ? char : ' ';
        }).join('');

        if (text === this.currentText) return Promise.resolve();

        const promises = [];

        for (let i = 0; i < this.flaps.length; i++) {
            const targetChar = text[i];
            const currentChar = this.currentText[i];

            if (targetChar !== currentChar) {
                const delay = i * this.options.staggerDelay;
                if (animate) {
                    promises.push(this.flipToChar(i, targetChar, delay));
                } else {
                    this.setChar(i, targetChar);
                }
            }
        }

        this.currentText = text;
        return Promise.all(promises);
    }

    /**
     * Instantly set a character without animation
     */
    setChar(index, char) {
        const flap = this.flaps[index];
        if (!flap) return;

        flap.topContent.textContent = char;
        flap.bottomContent.textContent = char;
        flap.currentChar = char;
    }

    /**
     * Animate flip to a specific character
     */
    flipToChar(index, targetChar, delay = 0) {
        return new Promise(resolve => {
            setTimeout(() => {
                const flap = this.flaps[index];
                if (!flap) {
                    resolve();
                    return;
                }

                // Get the sequence of characters to flip through
                const sequence = this.getFlipSequence(flap.currentChar, targetChar);

                if (sequence.length === 0) {
                    resolve();
                    return;
                }

                let sequenceIndex = 0;
                const flipNext = () => {
                    if (sequenceIndex >= sequence.length) {
                        resolve();
                        return;
                    }

                    const nextChar = sequence[sequenceIndex];
                    this.animateSingleFlip(flap, nextChar).then(() => {
                        sequenceIndex++;
                        flipNext();
                    });
                };

                flipNext();
            }, delay);
        });
    }

    /**
     * Get sequence of characters to flip through
     */
    getFlipSequence(fromChar, toChar) {
        const chars = this.options.chars;
        const fromIndex = chars.indexOf(fromChar);
        const toIndex = chars.indexOf(toChar);

        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
            return [];
        }

        const sequence = [];
        let current = fromIndex;

        // Always flip forward (wrapping around if needed)
        while (current !== toIndex) {
            current = (current + 1) % chars.length;
            sequence.push(chars[current]);
        }

        // For performance, skip some characters if sequence is too long
        if (sequence.length > 5) {
            const reduced = [];
            const step = Math.ceil(sequence.length / 5);
            for (let i = 0; i < sequence.length - 1; i += step) {
                reduced.push(sequence[i]);
            }
            reduced.push(sequence[sequence.length - 1]);
            return reduced;
        }

        return sequence;
    }

    /**
     * Animate a single flip
     */
    animateSingleFlip(flap, newChar) {
        return new Promise(resolve => {
            const oldChar = flap.currentChar;

            // Create flip elements
            const flipTop = document.createElement('div');
            flipTop.className = 'flap-flip-top';
            const flipTopContent = document.createElement('span');
            flipTopContent.className = 'flap-content';
            flipTopContent.textContent = oldChar;
            flipTop.appendChild(flipTopContent);

            const flipBottom = document.createElement('div');
            flipBottom.className = 'flap-flip-bottom';
            const flipBottomContent = document.createElement('span');
            flipBottomContent.className = 'flap-content';
            flipBottomContent.textContent = newChar;
            flipBottom.appendChild(flipBottomContent);

            // Update the static bottom to show new character
            flap.bottomContent.textContent = newChar;

            // Add flip elements
            flap.element.appendChild(flipTop);
            flap.element.appendChild(flipBottom);
            flap.element.classList.add('flipping');

            // Play flip sound (optional)
            this.playFlipSound();

            // After animation, clean up and update
            setTimeout(() => {
                flap.element.classList.remove('flipping');
                flipTop.remove();
                flipBottom.remove();

                // Update top half to show new character
                flap.topContent.textContent = newChar;
                flap.currentChar = newChar;

                resolve();
            }, this.options.flipDuration * 2);
        });
    }

    /**
     * Play flip sound effect
     */
    playFlipSound() {
        // Could add Web Audio API sound here
        // For now, this is a placeholder
    }

    /**
     * Clear the display
     */
    clear() {
        this.setText(' '.repeat(this.flaps.length), false);
    }
}

/**
 * Split-Flap Row Component
 * Manages a full row of text with split-flap animation
 */
class SplitFlapRow {
    constructor(container, length, options = {}) {
        this.splitFlap = new SplitFlap(container, options);
        this.splitFlap.init(length);
    }

    setText(text, animate = true) {
        return this.splitFlap.setText(text, animate);
    }

    clear() {
        this.splitFlap.clear();
    }
}

/**
 * Temperature Display Component
 * Shows temperature with degree symbol
 */
class TemperatureDisplay extends SplitFlapRow {
    constructor(container, options = {}) {
        super(container, 5, { size: 'large', ...options });
    }

    setTemperature(temp, unit = 'F') {
        const tempStr = Math.round(temp).toString().padStart(3, ' ');
        const unitSymbol = unit.toUpperCase() === 'C' ? 'C' : 'F';
        return this.setText(`${tempStr}°${unitSymbol}`);
    }
}

/**
 * Time Display Component
 * Shows time in HH:MM format
 */
class TimeDisplay extends SplitFlapRow {
    constructor(container, options = {}) {
        super(container, 5, { size: 'large', ...options });
    }

    setTime(hours, minutes) {
        const h = hours.toString().padStart(2, '0');
        const m = minutes.toString().padStart(2, '0');
        return this.setText(`${h}:${m}`);
    }

    setFromDate(date = new Date()) {
        return this.setTime(date.getHours(), date.getMinutes());
    }
}

/**
 * Create split-flap text in a container
 */
function createSplitFlapText(container, text, options = {}) {
    const flap = new SplitFlap(container, options);
    flap.init(text.length);
    flap.setText(text, false);
    return flap;
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SplitFlap, SplitFlapRow, TemperatureDisplay, TimeDisplay, createSplitFlapText };
}
