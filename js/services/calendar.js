/**
 * Calendar Service
 * Fetches events from public Google Calendar using API key only (no OAuth needed)
 */

class CalendarService {
    constructor() {
        this.apiKey = null;
        this.calendarId = null;
        this.cache = null;
        this.cacheTime = 0;
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Configure the service with API key and calendar ID
     */
    configure(apiKey, calendarId) {
        this.apiKey = apiKey;
        this.calendarId = calendarId;
        this.cache = null;
    }

    /**
     * Check if service is configured
     */
    isConfigured() {
        return !!(this.apiKey && this.calendarId);
    }

    /**
     * Fetch upcoming events from public calendar
     */
    async getUpcomingEvents(days = 7, maxResults = 15) {
        // Check cache
        const now = Date.now();
        if (this.cache && (now - this.cacheTime) < this.cacheDuration) {
            return this.cache;
        }

        if (!this.isConfigured()) {
            throw new Error('Calendar service not configured');
        }

        const timeMin = new Date().toISOString();
        const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

        const params = new URLSearchParams({
            key: this.apiKey,
            timeMin: timeMin,
            timeMax: timeMax,
            showDeleted: 'false',
            singleEvents: 'true',
            maxResults: maxResults.toString(),
            orderBy: 'startTime'
        });

        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events?${params}`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const events = (data.items || []).map(event => this.formatEvent(event));

            // Update cache
            this.cache = events;
            this.cacheTime = now;

            return events;
        } catch (error) {
            console.error('Failed to fetch calendar events:', error);
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
}

// Create global instance
const calendarService = new CalendarService();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CalendarService, calendarService };
}
