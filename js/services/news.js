/**
 * News Service
 * Fetches news from RSS feeds using a CORS proxy
 */

class NewsService {
    constructor() {
        // Use a public CORS proxy for RSS feeds
        this.corsProxy = 'https://api.allorigins.win/raw?url=';

        // Predefined RSS feed URLs for SF news sources
        this.sources = {
            sfchronicle: {
                name: 'SF Chronicle',
                url: 'https://www.sfchronicle.com/bayarea/feed/Bay-Area-News-702.php'
            },
            sfgate: {
                name: 'SFGate',
                url: 'https://www.sfgate.com/bayarea/feed/Bay-Area-News-702.php'
            },
            kqed: {
                name: 'KQED',
                url: 'https://www.kqed.org/news/feed'
            },
            sfexaminer: {
                name: 'SF Examiner',
                url: 'https://www.sfexaminer.com/feed/'
            },
            missionlocal: {
                name: 'Mission Local',
                url: 'https://missionlocal.org/feed/'
            }
        };

        this.currentSource = 'kqed';
        this.customRssUrl = null;
        this.cache = null;
        this.cacheTime = 0;
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Set news source
     */
    setSource(source, customUrl = null) {
        this.currentSource = source;
        this.customRssUrl = customUrl;
        this.cache = null; // Clear cache when source changes
    }

    /**
     * Check if service is configured
     */
    isConfigured() {
        return this.currentSource === 'custom'
            ? !!this.customRssUrl
            : !!this.sources[this.currentSource];
    }

    /**
     * Get the current feed URL
     */
    getFeedUrl() {
        if (this.currentSource === 'custom' && this.customRssUrl) {
            return this.customRssUrl;
        }
        return this.sources[this.currentSource]?.url;
    }

    /**
     * Get current source name
     */
    getSourceName() {
        if (this.currentSource === 'custom') {
            return 'Custom Feed';
        }
        return this.sources[this.currentSource]?.name || 'News';
    }

    /**
     * Parse RSS XML into news items
     */
    parseRSS(xmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'text/xml');

        // Check for parse errors
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            throw new Error('Failed to parse RSS feed');
        }

        const items = [];
        const itemElements = doc.querySelectorAll('item');

        itemElements.forEach((item, index) => {
            const title = item.querySelector('title')?.textContent || '';
            const link = item.querySelector('link')?.textContent || '';
            const pubDate = item.querySelector('pubDate')?.textContent || '';
            const description = item.querySelector('description')?.textContent || '';

            // Extract image from various possible locations
            let image = null;
            const mediaContent = item.querySelector('media\\:content, content');
            if (mediaContent) {
                image = mediaContent.getAttribute('url');
            }
            if (!image) {
                const enclosure = item.querySelector('enclosure[type^="image"]');
                if (enclosure) {
                    image = enclosure.getAttribute('url');
                }
            }

            // Clean up description (remove HTML)
            const cleanDescription = description
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .trim()
                .substring(0, 200);

            items.push({
                id: index,
                title: title.trim(),
                link: link.trim(),
                pubDate: pubDate ? new Date(pubDate) : new Date(),
                description: cleanDescription,
                image: image,
                source: this.getSourceName()
            });
        });

        return items;
    }

    /**
     * Fetch news from RSS feed
     */
    async fetchNews(maxItems = 10) {
        // Check cache
        const now = Date.now();
        if (this.cache && (now - this.cacheTime) < this.cacheDuration) {
            return this.cache.slice(0, maxItems);
        }

        const feedUrl = this.getFeedUrl();
        if (!feedUrl) {
            throw new Error('No news source configured');
        }

        try {
            const proxyUrl = `${this.corsProxy}${encodeURIComponent(feedUrl)}`;
            const response = await fetch(proxyUrl);

            if (!response.ok) {
                throw new Error(`Failed to fetch news: ${response.status}`);
            }

            const xmlText = await response.text();
            const items = this.parseRSS(xmlText);

            // Update cache
            this.cache = items;
            this.cacheTime = now;

            return items.slice(0, maxItems);
        } catch (error) {
            console.error('News fetch error:', error);

            // Return cached data if available, even if stale
            if (this.cache) {
                console.log('Returning stale cached news');
                return this.cache.slice(0, maxItems);
            }

            throw error;
        }
    }

    /**
     * Format relative time for news items
     */
    static formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    /**
     * Get available sources
     */
    getAvailableSources() {
        return Object.entries(this.sources).map(([key, value]) => ({
            id: key,
            name: value.name
        }));
    }
}

// Create global instance
const newsService = new NewsService();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NewsService, newsService };
}
