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
            // Transit 1
            transit1ApiKey: '',
            transit1Agency: 'SF',
            transit1Stops: '',
            // Transit 2
            transit2ApiKey: '',
            transit2Agency: 'BA',
            transit2Stops: '',
            // Calendar
            calendarId: 'ebgs7j9vj5tn2gs6gt3f2gvgtc@group.calendar.google.com',
            googleApiKey: '',
            calendarDays: 7
        };

        // Create second transit service instance
        this.transitService2 = new TransitService();

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

    /**
     * Create urgency-colored flaps for ETA
     * Green: >10 min, Yellow: 5-10 min, Red: <5 min
     */
    urgencyFlaps(text, minutesAway) {
        let urgencyClass = 'urgency-green';
        if (minutesAway < 5) {
            urgencyClass = 'urgency-red';
        } else if (minutesAway < 10) {
            urgencyClass = 'urgency-yellow';
        }
        return text.split('').map(char => {
            const displayChar = char === ' ' ? '&nbsp;' : this.escapeHtml(char);
            return `<span class="flap-char ${urgencyClass}">${displayChar}</span>`;
        }).join('');
    }

    /**
     * Define fixed row width for transit (consistent card count)
     */
    get TRANSIT_ROW_WIDTH() {
        return 40; // Total characters per transit row
    }

    get TRANSIT_LINE_WIDTH() {
        return 4; // Line number width
    }

    get TRANSIT_TIME_WIDTH() {
        return 5; // Time display width
    }

    get TRANSIT_DEST_WIDTH() {
        return this.TRANSIT_ROW_WIDTH - this.TRANSIT_LINE_WIDTH - this.TRANSIT_TIME_WIDTH - 2; // -2 for spacing
    }

    get WEATHER_ROW_WIDTH() {
        return 40; // Same as transit for consistency
    }

    /**
     * Get wind description with emoji based on speed (mph)
     */
    getWindDescription(speed) {
        if (speed < 5) return { text: 'CALM', emoji: '🍃' };
        if (speed < 12) return { text: 'LIGHT', emoji: '🍃' };
        if (speed < 20) return { text: 'BREEZY', emoji: '💨' };
        if (speed < 30) return { text: 'WINDY', emoji: '💨' };
        if (speed < 40) return { text: 'VERY WINDY', emoji: '🌬️' };
        return { text: 'DANGEROUS', emoji: '🌪️' };
    }

    /**
     * Get UV index description
     */
    getUVDescription(uvIndex) {
        if (uvIndex <= 2) return { text: 'LOW', emoji: '😎' };
        if (uvIndex <= 5) return { text: 'MODERATE', emoji: '🧴' };
        if (uvIndex <= 7) return { text: 'HIGH', emoji: '⚠️' };
        if (uvIndex <= 10) return { text: 'VERY HIGH', emoji: '🔥' };
        return { text: 'EXTREME', emoji: '☠️' };
    }

    // =============================================
    // INITIALIZATION
    // =============================================

    async init() {
        console.log('Initializing Duncan Station...');

        // Load settings
        this.loadSettings();

        // Apply theme
        this.applyTheme();

        // Initialize audio
        this.initAudio();

        // Set up event listeners
        this.setupEventListeners();

        // Update title with date
        this.updateTitle();

        // Initial data fetch
        await this.refresh();

        // Start refresh timer
        this.startRefreshTimer();

        // Update title at midnight
        this.startTitleTimer();

        console.log('Duncan Station initialized');
    }

    updateTitle() {
        const titleEl = document.getElementById('boardTitle');
        if (titleEl) {
            const now = new Date();
            const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
            const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
            titleEl.textContent = `DUNCAN STATION · ${dayName} · ${dateStr}`;
        }
    }

    startTitleTimer() {
        // Update title every minute to catch midnight
        setInterval(() => this.updateTitle(), 60000);
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
            'transit1ApiKey', 'transit1Agency', 'transit1Stops',
            'transit2ApiKey', 'transit2Agency', 'transit2Stops',
            'calendarId', 'googleApiKey', 'calendarDays'
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
            'transit1ApiKey', 'transit1Agency', 'transit1Stops',
            'transit2ApiKey', 'transit2Agency', 'transit2Stops',
            'calendarId', 'googleApiKey', 'calendarDays'
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

        // Configure Transit 1
        if (this.settings.transit1ApiKey) {
            transitService.configure(this.settings.transit1ApiKey, this.settings.transit1Agency);
        }

        // Configure Transit 2
        if (this.settings.transit2ApiKey) {
            this.transitService2.configure(this.settings.transit2ApiKey, this.settings.transit2Agency);
        }

        if (this.settings.googleApiKey && this.settings.calendarId) {
            calendarService.configure(this.settings.googleApiKey, this.settings.calendarId);
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
            this.updateTransit1().catch(e => console.error('Transit 1 update failed:', e)),
            this.updateTransit2().catch(e => console.error('Transit 2 update failed:', e)),
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
        const W = this.WEATHER_ROW_WIDTH;

        // Row 1: Current temp + feels like + condition icon
        const currentRow = `${current.icon} ${current.temp}° FEELS ${current.feelsLike}°`.padEnd(W, ' ');

        // Row 2: Today's high/low from forecast
        const todayForecast = forecast && forecast.length > 0 ? forecast[0] : null;
        const highLowRow = todayForecast
            ? `TODAY ${todayForecast.high}°/${todayForecast.low}° ${todayForecast.icon}`.padEnd(W, ' ')
            : 'TODAY --/--'.padEnd(W, ' ');

        // Row 3: Precipitation chance
        const precipEmoji = current.precipitationProbability > 50 ? '🌧️' : current.precipitationProbability > 20 ? '🌦️' : '☀️';
        const precipRow = `PRECIP ${current.precipitationProbability}% ${precipEmoji}`.padEnd(W, ' ');

        // Row 4: Wind
        const wind = this.getWindDescription(current.windSpeed);
        const windRow = `${wind.text} ${current.windSpeed}MPH ${wind.emoji}`.padEnd(W, ' ');

        // Row 5: UV Index
        const uv = this.getUVDescription(current.uvIndex);
        const uvRow = `UV ${current.uvIndex} ${uv.text} ${uv.emoji}`.padEnd(W, ' ');

        let html = `
            <div class="weather-rows">
                <div class="flap-row small">${this.colorFlaps(currentRow, 'color-orange')}</div>
                <div class="flap-row small">${this.colorFlaps(highLowRow, 'color-yellow')}</div>
                <div class="flap-row small">${this.colorFlaps(precipRow, 'color-blue')}</div>
                <div class="flap-row small">${this.colorFlaps(windRow, 'color-teal')}</div>
                <div class="flap-row small">${this.colorFlaps(uvRow, 'color-pink')}</div>
            </div>
        `;

        // Forecast rows (remaining days)
        if (forecast && forecast.length > 1) {
            html += `<div class="weather-forecast-rows">`;
            forecast.slice(1, 4).forEach((day, idx) => {
                const forecastRow = `${day.day.toUpperCase().substring(0, 3)} ${day.high}°/${day.low}° ${day.icon}`.padEnd(W, ' ');
                const color = this.getRowColor(idx + 2);
                html += `<div class="flap-row small">${this.colorFlaps(forecastRow, color)}</div>`;
            });
            html += `</div>`;
        }

        container.innerHTML = html;
        this.triggerFlipAnimation(container);
        this.playFlapSound();
    }

    renderWeatherPlaceholder(container) {
        const W = this.WEATHER_ROW_WIDTH;
        container.innerHTML = `
            <div class="weather-rows">
                <div class="flap-row small">${this.toFlaps('WEATHER'.padEnd(W, ' '))}</div>
                <div class="flap-row small">${this.toFlaps('ADD API KEY IN SETTINGS'.padEnd(W, ' '))}</div>
                <div class="flap-row small">${this.toFlaps(''.padEnd(W, ' '))}</div>
            </div>
        `;
    }

    renderWeatherError(container, message) {
        const W = this.WEATHER_ROW_WIDTH;
        container.innerHTML = `
            <div class="weather-rows">
                <div class="flap-row small">${this.colorFlaps('WEATHER ERROR'.padEnd(W, ' '), 'color-red')}</div>
                <div class="flap-row small">${this.toFlaps(message.substring(0, W).toUpperCase().padEnd(W, ' '))}</div>
            </div>
        `;
    }

    // =============================================
    // TRANSIT SECTIONS (Two feeds)
    // =============================================

    async updateTransit1() {
        const listEl = document.getElementById('transitList1');
        if (!listEl) return;

        if (!transitService.isConfigured()) {
            this.renderTransitPlaceholder(listEl, '1');
            return;
        }

        try {
            let departures = [];
            if (this.settings.transit1Stops) {
                const stopIds = this.settings.transit1Stops.split(',').map(s => s.trim()).filter(Boolean);
                if (stopIds.length > 0) {
                    departures = await transitService.getDeparturesForStops(stopIds);
                }
            }
            this.renderTransit(listEl, departures || [], 0);
        } catch (error) {
            console.error('Transit 1 error:', error);
            this.renderTransitError(listEl);
        }
    }

    async updateTransit2() {
        const listEl = document.getElementById('transitList2');
        if (!listEl) return;

        if (!this.transitService2.isConfigured()) {
            this.renderTransitPlaceholder(listEl, '2');
            return;
        }

        try {
            let departures = [];
            if (this.settings.transit2Stops) {
                const stopIds = this.settings.transit2Stops.split(',').map(s => s.trim()).filter(Boolean);
                if (stopIds.length > 0) {
                    departures = await this.transitService2.getDeparturesForStops(stopIds);
                }
            }
            this.renderTransit(listEl, departures || [], 3); // Start with different color offset
        } catch (error) {
            console.error('Transit 2 error:', error);
            this.renderTransitError(listEl);
        }
    }

    renderTransit(container, departures, colorOffset = 0) {
        if (departures.length === 0) {
            // Show empty row with full blank cards
            const emptyRow = 'NO DEPARTURES'.padEnd(this.TRANSIT_ROW_WIDTH, ' ');
            container.innerHTML = `
                <div class="transit-row">
                    <div class="flap-row small">${this.toFlaps(emptyRow)}</div>
                </div>
            `;
            return;
        }

        container.innerHTML = departures.slice(0, 4).map((dep, idx) => {
            // Line number - padded to fixed width, YELLOW
            const line = dep.line.toString().toUpperCase().padEnd(this.TRANSIT_LINE_WIDTH, ' ').substring(0, this.TRANSIT_LINE_WIDTH);

            // Destination - NO TRUNCATION, pad to fill remaining space
            const dest = (dep.destination || '').toUpperCase().padEnd(this.TRANSIT_DEST_WIDTH, ' ').substring(0, this.TRANSIT_DEST_WIDTH);

            // Time - use urgency coloring
            const mins = dep.minutesAway;
            const timeStr = mins === 0 ? ' NOW ' : `${mins}M`.padStart(this.TRANSIT_TIME_WIDTH, ' ');

            // Line numbers are YELLOW
            const lineFlaps = this.timeFlaps(line);

            // Destination uses row color
            const rowColor = this.getRowColor(idx + colorOffset);
            const destFlaps = this.colorFlaps(dest, rowColor);

            // ETA uses urgency-based coloring (red/yellow/green)
            const timeFlaps = mins === 0 ? this.successFlaps(timeStr) : this.urgencyFlaps(timeStr, mins);

            return `
                <div class="transit-row">
                    <div class="flap-row small">${lineFlaps}${this.toFlaps(' ')}${destFlaps}${this.toFlaps(' ')}${timeFlaps}</div>
                </div>
            `;
        }).join('');

        this.triggerFlipAnimation(container);
        this.playFlapSound();
    }

    /**
     * Trigger flip animation on newly rendered flaps
     */
    triggerFlipAnimation(container) {
        const flaps = container.querySelectorAll('.flap-char');
        flaps.forEach((flap, index) => {
            // Stagger the animation for wave effect
            setTimeout(() => {
                flap.classList.add('flipping');
                // Remove class after animation completes
                setTimeout(() => flap.classList.remove('flipping'), 150);
            }, index * 15); // 15ms stagger between each flap
        });
    }

    renderTransitPlaceholder(container, num) {
        container.innerHTML = `
            <div class="transit-row">
                ${this.flapRow(`CONFIGURE TRANSIT ${num}`, 'small')}
            </div>
            <div class="transit-row">
                ${this.flapRow('IN SETTINGS', 'small')}
            </div>
        `;
    }

    renderTransitError(container) {
        container.innerHTML = `
            <div class="transit-row">
                ${this.flapRow('ERROR LOADING DATA', 'small')}
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

        try {
            const events = await calendarService.getUpcomingEvents(this.settings.calendarDays, 12);
            this.renderCalendar(listEl, events);
        } catch (error) {
            console.error('Calendar error:', error);
            this.renderCalendarError(listEl, error.message);
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

        // Debug: log events to see what we're getting
        console.log('Calendar events to render:', events);

        // Show up to 10 events since calendar has full right side
        container.innerHTML = events.slice(0, 10).map((event, idx) => {
            const dateStr = CalendarService.formatEventDate(event).toUpperCase().substring(0, 10);
            const timeStr = CalendarService.formatEventTime(event).toUpperCase().substring(0, 8);
            const title = event.title.toUpperCase().substring(0, 28).padEnd(28, ' ');

            // Use the event's Google Calendar color, fallback to cycling colors
            const eventColor = event.colorClass || this.getRowColor(idx);

            let eventClass = 'calendar-event';
            if (event.isNow) eventClass += ' now';
            else if (event.isToday) eventClass += ' today';

            return `
                <div class="${eventClass}">
                    <div class="event-time-display">
                        <div class="flap-row small">${this.colorFlaps(dateStr.padEnd(10, ' '), eventColor)}</div>
                        <div class="flap-row small">${this.timeFlaps(timeStr.padEnd(8, ' '))}</div>
                    </div>
                    <div class="event-details-display">
                        <div class="flap-row small">${this.colorFlaps(title, eventColor)}</div>
                    </div>
                </div>
            `;
        }).join('');
        this.triggerFlipAnimation(container);
        this.playFlapSound();
    }

    renderCalendarPlaceholder(container) {
        container.innerHTML = `
            <div class="calendar-event">
                ${this.flapRow('ADD GOOGLE API KEY', 'small')}
            </div>
            <div class="calendar-event">
                ${this.flapRow('IN SETTINGS', 'small')}
            </div>
        `;
    }

    renderCalendarError(container, message) {
        container.innerHTML = `
            <div class="calendar-event">
                ${this.flapRow('CALENDAR ERROR', 'small')}
            </div>
            <div class="calendar-event">
                ${this.flapRow(message.substring(0, 25).toUpperCase(), 'small')}
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
