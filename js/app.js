/**
 * SF Transit Board - Main Application
 * Coordinates all services and UI updates
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

        // Temperature display
        this.tempDisplay = null;

        // Bind methods
        this.refresh = this.refresh.bind(this);
        this.updateClock = this.updateClock.bind(this);
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('Initializing SF Transit Board...');

        // Load settings
        this.loadSettings();

        // Apply theme
        this.applyTheme();

        // Initialize UI components
        this.initUI();

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

    /**
     * Initialize UI components
     */
    initUI() {
        // Initialize temperature split-flap display
        const weatherTempEl = document.getElementById('weatherTemp');
        if (weatherTempEl) {
            this.tempDisplay = new TemperatureDisplay(weatherTempEl);
        }
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        try {
            const stored = localStorage.getItem('transitBoardSettings');
            if (stored) {
                this.settings = { ...this.defaultSettings, ...JSON.parse(stored) };
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }

        // Apply settings to form fields
        this.applySettingsToForm();

        // Configure services
        this.configureServices();
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        try {
            localStorage.setItem('transitBoardSettings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    /**
     * Apply settings to form fields
     */
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

    /**
     * Read settings from form fields
     */
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

    /**
     * Configure services with current settings
     */
    configureServices() {
        // Weather service
        if (this.settings.weatherApiKey) {
            weatherService.setApiKey(this.settings.weatherApiKey);
        }

        // Transit service
        if (this.settings.transitApiKey) {
            transitService.configure(this.settings.transitApiKey, this.settings.transitAgency);
        }

        // News service - SF Standard only
        newsService.setSource('sfstandard');

        // Calendar service
        if (this.settings.googleClientId && this.settings.googleApiKey) {
            calendarService.configure(this.settings.googleClientId, this.settings.googleApiKey);
        }
    }

    /**
     * Apply theme
     */
    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.settings.theme);
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Settings modal
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsModal = document.getElementById('settingsModal');
        const closeSettings = document.getElementById('closeSettings');
        const saveSettingsBtn = document.getElementById('saveSettings');
        const resetSettingsBtn = document.getElementById('resetSettings');

        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                settingsModal.classList.add('active');
            });
        }

        if (closeSettings) {
            closeSettings.addEventListener('click', () => {
                settingsModal.classList.remove('active');
            });
        }

        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target === settingsModal) {
                    settingsModal.classList.remove('active');
                }
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
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;

                // Update button states
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update content visibility
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`tab-${tabId}`)?.classList.add('active');
            });
        });

        // Google Calendar auth
        const googleAuthBtn = document.getElementById('googleAuthBtn');
        if (googleAuthBtn) {
            googleAuthBtn.addEventListener('click', async () => {
                try {
                    // Read current form values first
                    this.settings.googleClientId = document.getElementById('googleClientId')?.value;
                    this.settings.googleApiKey = document.getElementById('googleApiKey')?.value;

                    if (!this.settings.googleClientId || !this.settings.googleApiKey) {
                        this.updateAuthStatus('Please enter Client ID and API Key first', 'error');
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

        // Keyboard shortcut for settings
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

    /**
     * Update Google auth status indicator
     */
    updateAuthStatus(message, type) {
        const statusEl = document.getElementById('googleAuthStatus');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = type;
        }
    }

    /**
     * Update clock display
     */
    updateClock() {
        const clockEl = document.getElementById('clock');
        if (clockEl) {
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const seconds = now.getSeconds().toString().padStart(2, '0');
            clockEl.textContent = `${hours}:${minutes}:${seconds}`;
        }
    }

    /**
     * Start the refresh timer
     */
    startRefreshTimer() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
        this.refreshTimer = setInterval(this.refresh, this.settings.refreshInterval * 1000);
    }

    /**
     * Refresh all data
     */
    async refresh() {
        console.log('Refreshing data...');

        // Update last update time
        const lastUpdateEl = document.getElementById('lastUpdate');
        if (lastUpdateEl) {
            lastUpdateEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        }

        // Update all sections in parallel
        await Promise.all([
            this.updateWeather().catch(e => console.error('Weather update failed:', e)),
            this.updateTransit().catch(e => console.error('Transit update failed:', e)),
            this.updateNews().catch(e => console.error('News update failed:', e)),
            this.updateCalendar().catch(e => console.error('Calendar update failed:', e))
        ]);

        console.log('Data refresh complete');
    }

    /**
     * Update weather section
     */
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

            this.renderWeather(data);
        } catch (error) {
            console.error('Weather error:', error);
            this.renderWeatherError(contentEl, error.message);
        }
    }

    /**
     * Render weather data
     */
    renderWeather(data) {
        const { current, forecast } = data;

        // Update temperature display with split-flap animation
        if (this.tempDisplay) {
            const unit = this.settings.tempUnit === 'celsius' ? 'C' : 'F';
            this.tempDisplay.setTemperature(current.temp, unit);
        }

        // Update condition
        const conditionEl = document.getElementById('weatherCondition');
        if (conditionEl) {
            conditionEl.textContent = `${current.icon} ${current.condition.toUpperCase()} • ${current.location}`;
        }

        // Update forecast
        const forecastEl = document.getElementById('weatherForecast');
        if (forecastEl && forecast) {
            forecastEl.innerHTML = forecast.slice(0, 5).map(day => `
                <div class="forecast-item">
                    <span class="forecast-day">${day.day}</span>
                    <span class="forecast-icon">${day.icon}</span>
                    <span class="forecast-temp">
                        ${day.high}° <span class="forecast-temp-low">${day.low}°</span>
                    </span>
                </div>
            `).join('');
        }
    }

    /**
     * Render weather placeholder
     */
    renderWeatherPlaceholder(container) {
        container.innerHTML = `
            <div class="no-data">
                <p>Weather API not configured</p>
                <p><small>Add your OpenWeatherMap API key in Settings</small></p>
            </div>
        `;
    }

    /**
     * Render weather error
     */
    renderWeatherError(container, message) {
        container.innerHTML = `
            <div class="error-message">
                <p>Failed to load weather</p>
                <p><small>${message}</small></p>
            </div>
        `;
    }

    /**
     * Update transit section
     */
    async updateTransit() {
        const contentEl = document.getElementById('transitContent');
        const listEl = document.getElementById('transitList');
        if (!contentEl || !listEl) return;

        if (!transitService.isConfigured()) {
            this.renderTransitPlaceholder(contentEl);
            return;
        }

        try {
            let departures;

            // Check for favorite stops first
            if (this.settings.favoriteStops) {
                const stopIds = this.settings.favoriteStops.split(',').map(s => s.trim()).filter(Boolean);
                if (stopIds.length > 0) {
                    departures = await transitService.getDeparturesForStops(stopIds);
                }
            }

            // If no favorites, use location
            if (!departures && this.settings.useLocation) {
                departures = await transitService.getDeparturesByCurrentLocation(this.settings.maxStops);
            }

            this.renderTransit(listEl, departures || []);
        } catch (error) {
            console.error('Transit error:', error);
            this.renderTransitError(contentEl, error.message);
        }
    }

    /**
     * Render transit departures
     */
    renderTransit(container, departures) {
        if (departures.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <p>No upcoming departures found</p>
                </div>
            `;
            return;
        }

        container.innerHTML = departures.slice(0, 8).map(dep => {
            const timeClass = dep.minutesAway === 0 ? 'transit-time arriving' : 'transit-time';
            const timeText = TransitService.formatMinutes(dep.minutesAway);

            return `
                <div class="transit-row" style="border-left-color: ${dep.color}">
                    <div class="transit-line" style="background: ${dep.color}">${dep.line}</div>
                    <div class="transit-info">
                        <div class="transit-destination">${dep.destination}</div>
                        <div class="transit-stop-name">${dep.stopName || ''}</div>
                    </div>
                    <div class="transit-times">
                        <span class="${timeClass}">${timeText}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render transit placeholder
     */
    renderTransitPlaceholder(container) {
        container.innerHTML = `
            <div class="no-data">
                <p>Transit API not configured</p>
                <p><small>Add your 511.org API key in Settings</small></p>
            </div>
        `;
    }

    /**
     * Render transit error
     */
    renderTransitError(container, message) {
        container.innerHTML = `
            <div class="error-message">
                <p>Failed to load transit data</p>
                <p><small>${message}</small></p>
            </div>
        `;
    }

    /**
     * Update news section
     */
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

    /**
     * Render news items
     */
    renderNews(container, news) {
        if (news.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <p>No news available</p>
                </div>
            `;
            return;
        }

        container.innerHTML = news.map(item => `
            <div class="news-item" onclick="window.open('${item.link}', '_blank')">
                <div class="news-time">${NewsService.formatRelativeTime(item.pubDate)}</div>
                <div>
                    <div class="news-headline">${this.escapeHtml(item.title)}</div>
                    <div class="news-source">${item.source}</div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Render news error
     */
    renderNewsError(container, message) {
        container.innerHTML = `
            <div class="error-message">
                <p>Failed to load news</p>
                <p><small>${message}</small></p>
            </div>
        `;
    }

    /**
     * Update calendar section
     */
    async updateCalendar() {
        const listEl = document.getElementById('calendarList');
        if (!listEl) return;

        // Check if calendar is configured
        if (!calendarService.isConfigured()) {
            this.renderCalendarPlaceholder(listEl);
            return;
        }

        // Try to restore session
        calendarService.restoreSession();

        // Check if authenticated
        if (!calendarService.isAuthenticated()) {
            this.renderCalendarNotAuthenticated(listEl);
            return;
        }

        try {
            const events = await calendarService.getUpcomingEvents(this.settings.calendarDays);
            this.renderCalendar(listEl, events);
        } catch (error) {
            console.error('Calendar error:', error);

            // If not authenticated, show auth prompt
            if (error.message.includes('Not authenticated')) {
                this.renderCalendarNotAuthenticated(listEl);
            } else {
                this.renderCalendarError(listEl, error.message);
            }
        }
    }

    /**
     * Render calendar events
     */
    renderCalendar(container, events) {
        if (events.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <p>No upcoming events</p>
                </div>
            `;
            return;
        }

        container.innerHTML = events.map(event => {
            let eventClass = 'calendar-event';
            if (event.isNow) eventClass += ' now';
            else if (event.isToday) eventClass += ' today';

            return `
                <div class="${eventClass}">
                    <div class="event-time">
                        <span class="event-date">${CalendarService.formatEventDate(event)}</span>
                        <span class="event-hour">${CalendarService.formatEventTime(event)}</span>
                    </div>
                    <div class="event-details">
                        <div class="event-title">${this.escapeHtml(event.title)}</div>
                        ${event.location ? `<div class="event-location">📍 ${this.escapeHtml(event.location)}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render calendar placeholder
     */
    renderCalendarPlaceholder(container) {
        container.innerHTML = `
            <div class="no-data">
                <p>Calendar not configured</p>
                <p><small>Add your Google API credentials in Settings</small></p>
            </div>
        `;
    }

    /**
     * Render calendar not authenticated
     */
    renderCalendarNotAuthenticated(container) {
        container.innerHTML = `
            <div class="no-data">
                <p>Calendar not connected</p>
                <p><small>Click "Connect Google Calendar" in Settings</small></p>
            </div>
        `;
    }

    /**
     * Render calendar error
     */
    renderCalendarError(container, message) {
        container.innerHTML = `
            <div class="error-message">
                <p>Failed to load calendar</p>
                <p><small>${message}</small></p>
            </div>
        `;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TransitBoardApp();
    window.app.init();
});
