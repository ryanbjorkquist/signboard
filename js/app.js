/**
 * SF Transit Board - Main Application
 * Coordinates all services and UI updates
 * Full split-flap display rendering
 */

class TransitBoardApp {
    constructor() {
        // Default settings
        this.defaultSettings = {
            refreshInterval: 60,
            theme: 'dark',
            useLocation: true,
            weatherApiKey: '',
            weatherLocation: 'San Francisco, CA',
            tempUnit: 'fahrenheit',
            transitApiKey: '',
            transitAgency: 'SF',
            maxStops: 5,
            favoriteStops: '',
            newsSource: 'sfstandard',
            maxNewsItems: 10,
            googleClientId: '',
            googleApiKey: '',
            calendarDays: 3
        };

        this.settings = { ...this.defaultSettings };
        this.refreshTimer = null;
        this.clockTimer = null;
        this.currentPosition = null;

        // Bind methods
        this.refresh = this.refresh.bind(this);
        this.updateClock = this.updateClock.bind(this);
    }

    // =============================================
    // SPLIT-FLAP TEXT RENDERING HELPERS
    // =============================================

    /**
     * Convert text to split-flap character HTML
     */
    toFlaps(text, maxLength = null) {
        if (maxLength) {
            text = text.substring(0, maxLength).padEnd(maxLength, ' ');
        }
        return text.split('').map(char => {
            const displayChar = char === ' ' ? '&nbsp;' : this.escapeHtml(char);
            return `<span class="flap-char">${displayChar}</span>`;
        }).join('');
    }

    /**
     * Create a flap row with text
     */
    flapRow(text, size = '', maxLength = null) {
        const sizeClass = size ? ` ${size}` : '';
        return `<div class="flap-row${sizeClass}">${this.toFlaps(text.toUpperCase(), maxLength)}</div>`;
    }

    /**
     * Create accent-colored flaps (for line numbers, etc)
     */
    accentFlaps(text) {
        return text.split('').map(char => {
            const displayChar = char === ' ' ? '&nbsp;' : this.escapeHtml(char);
            return `<span class="flap-char accent">${displayChar}</span>`;
        }).join('');
    }

    /**
     * Create TIME flaps - yellow background
     */
    timeFlaps(text) {
        return text.split('').map(char => {
            const displayChar = char === ' ' ? '&nbsp;' : this.escapeHtml(char);
            return `<span class="flap-char time">${displayChar}</span>`;
        }).join('');
    }

    /**
     * Create colored flaps with specified color class
     */
    colorFlaps(text, colorClass) {
        return text.split('').map(char => {
            const displayChar = char === ' ' ? '&nbsp;' : this.escapeHtml(char);
            return `<span class="flap-char ${colorClass}">${displayChar}</span>`;
        }).join('');
    }

    /**
     * Row colors for cycling through
     */
    getRowColor(index) {
        const colors = ['color-yellow', 'color-orange', 'color-red', 'color-pink', 'color-blue', 'color-green', 'color-teal'];
        return colors[index % colors.length];
    }

    /**
     * Create success-colored flaps (for "NOW" etc)
     */
    successFlaps(text) {
        return text.split('').map(char => {
            const displayChar = char === ' ' ? '&nbsp;' : this.escapeHtml(char);
            return `<span class="flap-char success">${displayChar}</span>`;
        }).join('');
    }

    // =============================================
    // INITIALIZATION
    // =============================================

    async init() {
        console.log('Initializing SF Transit Board...');

        // Load settings
        this.loadSettings();

        // Apply theme
        this.applyTheme();

        // Initialize audio
        this.initAudio();

        // Set up event listeners
        this.setupEventListeners();

        // Start clock
        this.updateClock();
        this.clockTimer = setInterval(this.updateClock, 1000);

        // Initial data fetch
        await this.refresh();

        // Start refresh timer
        this.startRefreshTimer();

        console.log('SF Transit Board initialized');
    }

    loadSettings() {
        try {
            const stored = localStorage.getItem('transitBoardSettings');
            if (stored) {
                this.settings = { ...this.defaultSettings, ...JSON.parse(stored) };
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }

        this.applySettingsToForm();
        this.configureServices();
    }

    saveSettings() {
        try {
            localStorage.setItem('transitBoardSettings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    applySettingsToForm() {
        const fields = [
            'refreshInterval', 'theme', 'useLocation',
            'weatherApiKey', 'weatherLocation', 'tempUnit',
            'transitApiKey', 'transitAgency', 'maxStops', 'favoriteStops',
            'maxNewsItems',
            'googleClientId', 'googleApiKey', 'calendarDays'
        ];

        fields.forEach(field => {
            const el = document.getElementById(field);
            if (el) {
                if (el.type === 'checkbox') {
                    el.checked = this.settings[field];
                } else {
                    el.value = this.settings[field];
                }
            }
        });
    }

    readSettingsFromForm() {
        const fields = [
            'refreshInterval', 'theme', 'useLocation',
            'weatherApiKey', 'weatherLocation', 'tempUnit',
            'transitApiKey', 'transitAgency', 'maxStops', 'favoriteStops',
            'maxNewsItems',
            'googleClientId', 'googleApiKey', 'calendarDays'
        ];

        fields.forEach(field => {
            const el = document.getElementById(field);
            if (el) {
                if (el.type === 'checkbox') {
                    this.settings[field] = el.checked;
                } else if (el.type === 'number') {
                    this.settings[field] = parseInt(el.value, 10) || this.defaultSettings[field];
                } else {
                    this.settings[field] = el.value;
                }
            }
        });
    }

    configureServices() {
        if (this.settings.weatherApiKey) {
            weatherService.setApiKey(this.settings.weatherApiKey);
        }

        if (this.settings.transitApiKey) {
            transitService.configure(this.settings.transitApiKey, this.settings.transitAgency);
        }

        newsService.setSource('sfstandard');

        if (this.settings.googleClientId && this.settings.googleApiKey) {
            calendarService.configure(this.settings.googleClientId, this.settings.googleApiKey);
        }
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.settings.theme);
    }

    setupEventListeners() {
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsModal = document.getElementById('settingsModal');
        const closeSettings = document.getElementById('closeSettings');
        const saveSettingsBtn = document.getElementById('saveSettings');
        const resetSettingsBtn = document.getElementById('resetSettings');

        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => settingsModal.classList.add('active'));
        }

        if (closeSettings) {
            closeSettings.addEventListener('click', () => settingsModal.classList.remove('active'));
        }

        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target === settingsModal) settingsModal.classList.remove('active');
            });
        }

        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => {
                this.readSettingsFromForm();
                this.saveSettings();
                this.configureServices();
                this.applyTheme();
                this.startRefreshTimer();
                settingsModal.classList.remove('active');
                this.refresh();
            });
        }

        if (resetSettingsBtn) {
            resetSettingsBtn.addEventListener('click', () => {
                this.settings = { ...this.defaultSettings };
                this.applySettingsToForm();
            });
        }

        // Settings tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                document.getElementById(`tab-${tabId}`)?.classList.add('active');
            });
        });

        // Google Calendar auth
        const googleAuthBtn = document.getElementById('googleAuthBtn');
        if (googleAuthBtn) {
            googleAuthBtn.addEventListener('click', async () => {
                try {
                    this.settings.googleClientId = document.getElementById('googleClientId')?.value;
                    this.settings.googleApiKey = document.getElementById('googleApiKey')?.value;

                    if (!this.settings.googleClientId || !this.settings.googleApiKey) {
                        this.updateAuthStatus('Enter Client ID and API Key first', 'error');
                        return;
                    }

                    calendarService.configure(this.settings.googleClientId, this.settings.googleApiKey);
                    this.updateAuthStatus('Authenticating...', 'pending');

                    await calendarService.authenticate();
                    this.updateAuthStatus('Connected!', 'success');
                    this.saveSettings();
                    this.updateCalendar();
                } catch (error) {
                    console.error('Calendar auth failed:', error);
                    this.updateAuthStatus('Authentication failed', 'error');
                }
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && settingsModal?.classList.contains('active')) {
                settingsModal.classList.remove('active');
            }
            if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                settingsModal?.classList.add('active');
            }
        });
    }

    updateAuthStatus(message, type) {
        const statusEl = document.getElementById('googleAuthStatus');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = type;
        }
    }

    // =============================================
    // CLOCK - Split-flap style
    // =============================================

    updateClock() {
        const clockEl = document.getElementById('clock');
        if (clockEl) {
            const now = new Date();
            const h = now.getHours().toString().padStart(2, '0');
            const m = now.getMinutes().toString().padStart(2, '0');
            const s = now.getSeconds().toString().padStart(2, '0');
            clockEl.textContent = `${h}:${m}:${s}`;
        }
    }

    startRefreshTimer() {
        if (this.refreshTimer) clearInterval(this.refreshTimer);
        this.refreshTimer = setInterval(this.refresh, this.settings.refreshInterval * 1000);
    }

    // =============================================
    // DATA REFRESH
    // =============================================

    async refresh() {
        console.log('Refreshing data...');

        const lastUpdateEl = document.getElementById('lastUpdate');
        if (lastUpdateEl) {
            const now = new Date();
            const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            lastUpdateEl.innerHTML = `<div class="flap-row small">${this.toFlaps(`UPDATED ${time}`.toUpperCase())}</div>`;
        }

        await Promise.all([
            this.updateWeather().catch(e => console.error('Weather update failed:', e)),
            this.updateTransit().catch(e => console.error('Transit update failed:', e)),
            this.updateNews().catch(e => console.error('News update failed:', e)),
            this.updateCalendar().catch(e => console.error('Calendar update failed:', e))
        ]);

        console.log('Data refresh complete');
    }

    // =============================================
    // WEATHER SECTION
    // =============================================

    async updateWeather() {
        const contentEl = document.getElementById('weatherContent');
        if (!contentEl) return;

        if (!weatherService.isConfigured()) {
            this.renderWeatherPlaceholder(contentEl);
            return;
        }

        try {
            const units = this.settings.tempUnit === 'celsius' ? 'metric' : 'imperial';
            let data;

            if (this.settings.useLocation) {
                data = await weatherService.getWeatherByCurrentLocation(units);
            } else {
                data = await weatherService.getWeatherByLocation(this.settings.weatherLocation, units);
            }

            this.renderWeather(contentEl, data);
        } catch (error) {
            console.error('Weather error:', error);
            this.renderWeatherError(contentEl, error.message);
        }
    }

    renderWeather(container, data) {
        const { current, forecast } = data;
        const unit = this.settings.tempUnit === 'celsius' ? 'C' : 'F';
        const tempStr = `${current.temp}°${unit}`;

        let html = `
            <div class="weather-main">
                <span class="weather-icon">${current.icon}</span>
                <div class="weather-temp-display">
                    <div class="flap-row large">${this.colorFlaps(tempStr, 'color-orange')}</div>
                </div>
            </div>
            <div class="weather-condition">
                <div class="flap-row small">${this.toFlaps(current.condition.toUpperCase().substring(0, 20))}</div>
            </div>
        `;

        if (forecast && forecast.length > 0) {
            html += `<div class="weather-forecast">`;
            forecast.slice(0, 5).forEach((day, idx) => {
                const highLow = `${day.high}/${day.low}`;
                const color = this.getRowColor(idx);
                html += `
                    <div class="forecast-day">
                        <div class="flap-row small">${this.colorFlaps(day.day.toUpperCase().padEnd(3, ' ').substring(0, 3), color)}</div>
                        <span class="forecast-icon">${day.icon}</span>
                        <div class="flap-row small">${this.colorFlaps(highLow.padEnd(7, ' '), color)}</div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        container.innerHTML = html;
        this.playFlapSound();
    }

    renderWeatherPlaceholder(container) {
        container.innerHTML = `
            <div class="weather-main">
                ${this.flapRow('--°F', 'large')}
            </div>
            <div class="weather-condition">
                ${this.flapRow('ADD API KEY IN SETTINGS', 'small')}
            </div>
        `;
    }

    renderWeatherError(container, message) {
        container.innerHTML = `
            <div class="weather-main">
                ${this.flapRow('ERR', 'large')}
            </div>
            <div class="weather-condition">
                ${this.flapRow(message.substring(0, 25).toUpperCase(), 'small')}
            </div>
        `;
    }

    // =============================================
    // TRANSIT SECTION
    // =============================================

    async updateTransit() {
        const contentEl = document.getElementById('transitContent');
        const listEl = document.getElementById('transitList');
        if (!contentEl || !listEl) return;

        if (!transitService.isConfigured()) {
            this.renderTransitPlaceholder(listEl);
            return;
        }

        try {
            let departures;

            if (this.settings.favoriteStops) {
                const stopIds = this.settings.favoriteStops.split(',').map(s => s.trim()).filter(Boolean);
                if (stopIds.length > 0) {
                    departures = await transitService.getDeparturesForStops(stopIds);
                }
            }

            if (!departures && this.settings.useLocation) {
                departures = await transitService.getDeparturesByCurrentLocation(this.settings.maxStops);
            }

            this.renderTransit(listEl, departures || []);
        } catch (error) {
            console.error('Transit error:', error);
            this.renderTransitError(listEl, error.message);
        }
    }

    renderTransit(container, departures) {
        if (departures.length === 0) {
            container.innerHTML = `
                <div class="transit-row">
                    ${this.flapRow('NO DEPARTURES FOUND', 'small')}
                </div>
            `;
            return;
        }

        container.innerHTML = departures.slice(0, 6).map((dep, idx) => {
            const line = dep.line.toString().padEnd(3, ' ').substring(0, 3);
            const dest = (dep.destination || '').substring(0, 16).padEnd(16, ' ');
            const mins = dep.minutesAway;
            const timeStr = mins === 0 ? 'NOW ' : `${mins}M`.padStart(4, ' ');
            const rowColor = this.getRowColor(idx);

            // Times are always yellow, NOW is green
            const timeFlaps = mins === 0 ? this.successFlaps(timeStr) : this.timeFlaps(timeStr);

            return `
                <div class="transit-row">
                    <div class="transit-line-display">
                        <div class="flap-row small">${this.colorFlaps(line, rowColor)}</div>
                    </div>
                    <div class="transit-destination-display">
                        <div class="flap-row small">${this.colorFlaps(dest.toUpperCase(), rowColor)}</div>
                    </div>
                    <div class="transit-time-display">
                        <div class="flap-row small">${timeFlaps}</div>
                    </div>
                </div>
            `;
        }).join('');
        this.playFlapSound();
    }

    renderTransitPlaceholder(container) {
        container.innerHTML = `
            <div class="transit-row">
                ${this.flapRow('ADD 511.ORG API KEY', 'small')}
            </div>
            <div class="transit-row">
                ${this.flapRow('IN SETTINGS', 'small')}
            </div>
        `;
    }

    renderTransitError(container, message) {
        container.innerHTML = `
            <div class="transit-row">
                ${this.flapRow('ERROR LOADING DATA', 'small')}
            </div>
        `;
    }

    // =============================================
    // NEWS SECTION
    // =============================================

    async updateNews() {
        const tickerEl = document.getElementById('newsTicker');
        if (!tickerEl) return;

        try {
            const news = await newsService.fetchNews(this.settings.maxNewsItems);
            this.renderNews(tickerEl, news);
        } catch (error) {
            console.error('News error:', error);
            this.renderNewsError(tickerEl, error.message);
        }
    }

    renderNews(container, news) {
        if (news.length === 0) {
            container.innerHTML = `
                <div class="news-item">
                    ${this.flapRow('NO NEWS AVAILABLE', 'small')}
                </div>
            `;
            return;
        }

        container.innerHTML = news.slice(0, 5).map((item, idx) => {
            const time = NewsService.formatRelativeTime(item.pubDate).toUpperCase();
            const title = item.title.toUpperCase().substring(0, 40);
            const rowColor = this.getRowColor(idx);

            return `
                <div class="news-item" onclick="window.open('${item.link}', '_blank')">
                    <div class="news-time-display">
                        <div class="flap-row small">${this.timeFlaps(time.padEnd(6, ' ').substring(0, 6))}</div>
                    </div>
                    <div class="news-headline-display">
                        <div class="flap-row small">${this.colorFlaps(title.padEnd(40, ' '), rowColor)}</div>
                    </div>
                </div>
            `;
        }).join('');
        this.playFlapSound();
    }

    renderNewsError(container, message) {
        container.innerHTML = `
            <div class="news-item">
                ${this.flapRow('NEWS UNAVAILABLE', 'small')}
            </div>
        `;
    }

    // =============================================
    // CALENDAR SECTION
    // =============================================

    async updateCalendar() {
        const listEl = document.getElementById('calendarList');
        if (!listEl) return;

        if (!calendarService.isConfigured()) {
            this.renderCalendarPlaceholder(listEl);
            return;
        }

        calendarService.restoreSession();

        if (!calendarService.isAuthenticated()) {
            this.renderCalendarNotAuthenticated(listEl);
            return;
        }

        try {
            const events = await calendarService.getUpcomingEvents(this.settings.calendarDays);
            this.renderCalendar(listEl, events);
        } catch (error) {
            console.error('Calendar error:', error);
            if (error.message.includes('Not authenticated')) {
                this.renderCalendarNotAuthenticated(listEl);
            } else {
                this.renderCalendarError(listEl, error.message);
            }
        }
    }

    renderCalendar(container, events) {
        if (events.length === 0) {
            container.innerHTML = `
                <div class="calendar-event">
                    ${this.flapRow('NO UPCOMING EVENTS', 'small')}
                </div>
            `;
            return;
        }

        container.innerHTML = events.slice(0, 5).map((event, idx) => {
            const dateStr = CalendarService.formatEventDate(event).toUpperCase().substring(0, 8);
            const timeStr = CalendarService.formatEventTime(event).toUpperCase().substring(0, 8);
            const title = event.title.toUpperCase().substring(0, 22).padEnd(22, ' ');
            const rowColor = this.getRowColor(idx);

            let eventClass = 'calendar-event';
            if (event.isNow) eventClass += ' now';
            else if (event.isToday) eventClass += ' today';

            return `
                <div class="${eventClass}">
                    <div class="event-time-display">
                        <div class="flap-row small">${this.colorFlaps(dateStr.padEnd(8, ' '), rowColor)}</div>
                        <div class="flap-row small">${this.timeFlaps(timeStr.padEnd(8, ' '))}</div>
                    </div>
                    <div class="event-details-display">
                        <div class="flap-row small">${this.colorFlaps(title, rowColor)}</div>
                        ${event.location ? `<div class="flap-row small">${this.toFlaps(event.location.toUpperCase().substring(0, 22).padEnd(22, ' '))}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderCalendarPlaceholder(container) {
        container.innerHTML = `
            <div class="calendar-event">
                ${this.flapRow('ADD GOOGLE CREDENTIALS', 'small')}
            </div>
            <div class="calendar-event">
                ${this.flapRow('IN SETTINGS', 'small')}
            </div>
        `;
    }

    renderCalendarNotAuthenticated(container) {
        container.innerHTML = `
            <div class="calendar-event">
                ${this.flapRow('CALENDAR NOT CONNECTED', 'small')}
            </div>
            <div class="calendar-event">
                ${this.flapRow('CLICK CONNECT IN SETTINGS', 'small')}
            </div>
        `;
    }

    renderCalendarError(container, message) {
        container.innerHTML = `
            <div class="calendar-event">
                ${this.flapRow('CALENDAR ERROR', 'small')}
            </div>
        `;
    }

    // =============================================
    // UTILITIES
    // =============================================

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // =============================================
    // AUDIO - Split-flap flip sound
    // =============================================

    initAudio() {
        // Create audio context for generating flip sounds
        this.audioContext = null;
        this.audioEnabled = true;

        // Initialize on first user interaction (browsers require this)
        document.addEventListener('click', () => {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
        }, { once: true });
    }

    playFlapSound() {
        if (!this.audioEnabled) return;

        // Initialize audio context if needed
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.log('Audio not available');
                return;
            }
        }

        // Create a short click/flap sound
        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // Multiple rapid clicks to simulate flipping
        for (let i = 0; i < 8; i++) {
            const clickTime = now + (i * 0.04) + (Math.random() * 0.02);

            // Noise burst for the mechanical click
            const bufferSize = ctx.sampleRate * 0.015; // 15ms
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);

            for (let j = 0; j < bufferSize; j++) {
                // Decaying noise
                const decay = 1 - (j / bufferSize);
                data[j] = (Math.random() * 2 - 1) * decay * 0.3;
            }

            const source = ctx.createBufferSource();
            source.buffer = buffer;

            // Bandpass filter to make it sound more mechanical
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 2000 + Math.random() * 1000;
            filter.Q.value = 5;

            // Gain control
            const gain = ctx.createGain();
            gain.gain.value = 0.15;

            source.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            source.start(clickTime);
        }
    }

    toggleAudio() {
        this.audioEnabled = !this.audioEnabled;
        return this.audioEnabled;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TransitBoardApp();
    window.app.init();
});
