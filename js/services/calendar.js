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

        // Google Calendar color ID mapping to hex colors
        // These are the standard Google Calendar event colors
        this.colorMap = {
            '1': { name: 'Lavender', hex: '#7986cb', flapClass: 'color-blue' },
            '2': { name: 'Sage', hex: '#33b679', flapClass: 'color-green' },
            '3': { name: 'Grape', hex: '#8e24aa', flapClass: 'color-pink' },
            '4': { name: 'Flamingo', hex: '#e67c73', flapClass: 'color-red' },
            '5': { name: 'Banana', hex: '#f6c026', flapClass: 'color-yellow' },
            '6': { name: 'Tangerine', hex: '#f5511d', flapClass: 'color-orange' },
            '7': { name: 'Peacock', hex: '#039be5', flapClass: 'color-teal' },
            '8': { name: 'Graphite', hex: '#616161', flapClass: 'color-default' },
            '9': { name: 'Blueberry', hex: '#3f51b5', flapClass: 'color-blue' },
            '10': { name: 'Basil', hex: '#0b8043', flapClass: 'color-green' },
            '11': { name: 'Tomato', hex: '#d60000', flapClass: 'color-red' },
            'default': { name: 'Default', hex: '#4285f4', flapClass: 'color-blue' }
        };
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
        // TEMPORARILY DISABLE CACHE FOR DEBUGGING
        this.cache = null;

        const now = Date.now();
        alert('🔔 CALENDAR API CALLED - Check console for details!');
        console.log('%c CALENDAR SERVICE CALLED', 'background: blue; color: white; font-size: 16px');
        console.log('Calendar: fetching fresh data from API (cache disabled for debug)');

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

            // Debug: log the raw API response to see what Google returns
            console.log('Google Calendar API raw response:', data);
            console.log('Raw items from API:', data.items);

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
        // Debug: log raw event to see what we're getting
        console.log('%c RAW EVENT FROM GOOGLE:', 'background: green; color: white; font-size: 14px; padding: 4px;');
        console.log('Event ID:', event.id);
        console.log('summary field type:', typeof event.summary);
        console.log('summary field value:', event.summary);
        console.log('summary is undefined?', event.summary === undefined);
        console.log('summary is null?', event.summary === null);
        console.log('summary is empty string?', event.summary === '');
        console.log('All event keys:', Object.keys(event));
        console.log('Full event object:', JSON.stringify(event, null, 2));

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

        // Get title - try summary first, then other fields
        const title = event.summary || event.title || event.subject || '(No title)';

        console.log('%c TITLE RESOLUTION:', 'background: orange; color: white; font-size: 14px; padding: 4px;');
        console.log('Final title value:', title);
        console.log('Title came from summary?', !!event.summary);

        // Get color - colorId maps to Google's color scheme
        const colorId = event.colorId || 'default';
        const colorInfo = this.colorMap[colorId] || this.colorMap['default'];

        return {
            id: event.id,
            title: title,
            description: event.description || '',
            location: event.location || '',
            start: start,
            end: end,
            isAllDay: isAllDay,
            isNow: isNow,
            isToday: isToday,
            colorId: colorId,
            colorHex: colorInfo.hex,
            colorClass: colorInfo.flapClass,
            colorName: colorInfo.name,
            link: event.htmlLink
        };
    }

    /**
     * Get flap color class for a color ID
     */
    getColorClass(colorId) {
        const colorInfo = this.colorMap[colorId] || this.colorMap['default'];
        return colorInfo.flapClass;
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
