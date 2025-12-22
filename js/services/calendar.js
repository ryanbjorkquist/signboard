/**
 * Calendar Service
 * Integrates with Google Calendar API
 */

class CalendarService {
    constructor() {
        this.clientId = null;
        this.apiKey = null;
        this.accessToken = null;
        this.tokenExpiry = null;
        this.isInitialized = false;
        this.gapiLoaded = false;
        this.gisLoaded = false;

        // Google Calendar API scopes
        this.scopes = 'https://www.googleapis.com/auth/calendar.readonly';
        this.discoveryDocs = ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'];

        this.cache = null;
        this.cacheTime = 0;
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Configure the service
     */
    configure(clientId, apiKey) {
        this.clientId = clientId;
        this.apiKey = apiKey;
        this.cache = null;
    }

    /**
     * Check if service is configured
     */
    isConfigured() {
        return !!(this.clientId && this.apiKey);
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!(this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry);
    }

    /**
     * Load Google APIs
     */
    async loadGoogleApis() {
        if (this.gapiLoaded && this.gisLoaded) {
            return;
        }

        // Load GAPI script
        if (!window.gapi) {
            await this.loadScript('https://apis.google.com/js/api.js');
        }

        // Load GIS (Google Identity Services) script
        if (!window.google?.accounts) {
            await this.loadScript('https://accounts.google.com/gsi/client');
        }

        // Initialize GAPI client
        await new Promise((resolve, reject) => {
            window.gapi.load('client', { callback: resolve, onerror: reject });
        });

        await window.gapi.client.init({
            apiKey: this.apiKey,
            discoveryDocs: this.discoveryDocs
        });

        this.gapiLoaded = true;
        this.gisLoaded = true;
        this.isInitialized = true;
    }

    /**
     * Load external script
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.defer = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Authenticate with Google
     */
    async authenticate() {
        if (!this.isConfigured()) {
            throw new Error('Calendar service not configured');
        }

        await this.loadGoogleApis();

        return new Promise((resolve, reject) => {
            const tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: this.clientId,
                scope: this.scopes,
                callback: (response) => {
                    if (response.error) {
                        reject(new Error(response.error));
                        return;
                    }

                    this.accessToken = response.access_token;
                    this.tokenExpiry = new Date(Date.now() + response.expires_in * 1000);

                    // Store in localStorage
                    localStorage.setItem('gcal_token', this.accessToken);
                    localStorage.setItem('gcal_expiry', this.tokenExpiry.toISOString());

                    resolve();
                }
            });

            tokenClient.requestAccessToken({ prompt: 'consent' });
        });
    }

    /**
     * Try to restore session from localStorage
     */
    restoreSession() {
        const token = localStorage.getItem('gcal_token');
        const expiry = localStorage.getItem('gcal_expiry');

        if (token && expiry) {
            const expiryDate = new Date(expiry);
            if (expiryDate > new Date()) {
                this.accessToken = token;
                this.tokenExpiry = expiryDate;
                return true;
            }
        }
        return false;
    }

    /**
     * Sign out
     */
    signOut() {
        if (this.accessToken && window.google?.accounts) {
            window.google.accounts.oauth2.revoke(this.accessToken);
        }

        this.accessToken = null;
        this.tokenExpiry = null;
        localStorage.removeItem('gcal_token');
        localStorage.removeItem('gcal_expiry');
    }

    /**
     * Fetch upcoming events
     */
    async getUpcomingEvents(days = 3, maxResults = 10) {
        // Check cache
        const now = Date.now();
        if (this.cache && (now - this.cacheTime) < this.cacheDuration) {
            return this.cache;
        }

        if (!this.isAuthenticated()) {
            // Try to restore session
            if (!this.restoreSession()) {
                throw new Error('Not authenticated');
            }
        }

        await this.loadGoogleApis();

        // Set the access token
        window.gapi.client.setToken({ access_token: this.accessToken });

        const timeMin = new Date().toISOString();
        const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

        try {
            const response = await window.gapi.client.calendar.events.list({
                calendarId: 'primary',
                timeMin: timeMin,
                timeMax: timeMax,
                showDeleted: false,
                singleEvents: true,
                maxResults: maxResults,
                orderBy: 'startTime'
            });

            const events = (response.result.items || []).map(event => this.formatEvent(event));

            // Update cache
            this.cache = events;
            this.cacheTime = now;

            return events;
        } catch (error) {
            console.error('Failed to fetch calendar events:', error);

            // If token expired, clear session
            if (error.status === 401) {
                this.signOut();
            }

            throw error;
        }
    }

    /**
     * Format a calendar event
     */
    formatEvent(event) {
        const start = event.start.dateTime
            ? new Date(event.start.dateTime)
            : new Date(event.start.date);

        const end = event.end.dateTime
            ? new Date(event.end.dateTime)
            : new Date(event.end.date);

        const isAllDay = !event.start.dateTime;
        const now = new Date();

        // Check if event is happening now
        const isNow = start <= now && end > now;

        // Check if event is today
        const isToday = start.toDateString() === now.toDateString();

        return {
            id: event.id,
            title: event.summary || '(No title)',
            description: event.description || '',
            location: event.location || '',
            start: start,
            end: end,
            isAllDay: isAllDay,
            isNow: isNow,
            isToday: isToday,
            color: event.colorId || 'default',
            link: event.htmlLink
        };
    }

    /**
     * Format event time for display
     */
    static formatEventTime(event) {
        if (event.isAllDay) {
            return 'All day';
        }

        const options = { hour: 'numeric', minute: '2-digit', hour12: true };
        return event.start.toLocaleTimeString('en-US', options);
    }

    /**
     * Format event date for display
     */
    static formatEventDate(event) {
        const now = new Date();
        const eventDate = event.start;

        if (eventDate.toDateString() === now.toDateString()) {
            return 'Today';
        }

        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (eventDate.toDateString() === tomorrow.toDateString()) {
            return 'Tomorrow';
        }

        return eventDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * Get demo events for testing without auth
     */
    getDemoEvents() {
        const now = new Date();

        return [
            {
                id: 'demo1',
                title: 'Team Standup',
                description: 'Daily standup meeting',
                location: 'Zoom',
                start: new Date(now.getTime() + 30 * 60 * 1000),
                end: new Date(now.getTime() + 45 * 60 * 1000),
                isAllDay: false,
                isNow: false,
                isToday: true,
                color: 'default'
            },
            {
                id: 'demo2',
                title: 'Lunch with Alex',
                description: '',
                location: 'Blue Bottle Coffee',
                start: new Date(now.getTime() + 3 * 60 * 60 * 1000),
                end: new Date(now.getTime() + 4 * 60 * 60 * 1000),
                isAllDay: false,
                isNow: false,
                isToday: true,
                color: 'default'
            },
            {
                id: 'demo3',
                title: 'Project Review',
                description: 'Quarterly project review',
                location: 'Conference Room A',
                start: new Date(now.getTime() + 24 * 60 * 60 * 1000),
                end: new Date(now.getTime() + 25 * 60 * 60 * 1000),
                isAllDay: false,
                isNow: false,
                isToday: false,
                color: 'default'
            }
        ];
    }
}

// Create global instance
const calendarService = new CalendarService();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CalendarService, calendarService };
}
