/**
 * RateLimiter
 *
 * Keeps simple in-memory sliding windows to avoid hitting Riot API rate limits.
 */
export class RateLimiter {
    private shortWindow: number[] = [];
    private longWindow: number[] = [];
    private readonly SHORT_LIMIT = 20;
    private readonly SHORT_WINDOW = 1000; // 1 second
    private readonly LONG_LIMIT = 100;
    private readonly LONG_WINDOW = 120000; // 2 minutes
    private rateLimitPenalty = 0;

    async waitForSlot(): Promise<void> {
        const now = Date.now();

        if (this.rateLimitPenalty > now) {
            const penaltyWait = this.rateLimitPenalty - now;
            console.warn(`[RateLimiter] penalty active, waiting ${penaltyWait}ms`);
            await new Promise((r) => setTimeout(r, penaltyWait));
        }

        this.shortWindow = this.shortWindow.filter((t) => now - t < this.SHORT_WINDOW);
        this.longWindow = this.longWindow.filter((t) => now - t < this.LONG_WINDOW);

        while (this.shortWindow.length >= this.SHORT_LIMIT || this.longWindow.length >= this.LONG_LIMIT) {
            const oldestShort = this.shortWindow[0];
            const oldestLong = this.longWindow[0];
            let waitTime = 0;
            if (this.shortWindow.length >= this.SHORT_LIMIT && oldestShort) {
                waitTime = Math.max(waitTime, this.SHORT_WINDOW - (now - oldestShort) + 100);
            }
            if (this.longWindow.length >= this.LONG_LIMIT && oldestLong) {
                waitTime = Math.max(waitTime, this.LONG_WINDOW - (now - oldestLong) + 100);
            }
            await new Promise((r) => setTimeout(r, waitTime));
            const newNow = Date.now();
            this.shortWindow = this.shortWindow.filter((t) => newNow - t < this.SHORT_WINDOW);
            this.longWindow = this.longWindow.filter((t) => newNow - t < this.LONG_WINDOW);
        }

        const ts = Date.now();
        this.shortWindow.push(ts);
        this.longWindow.push(ts);
    }

    handle429Error(retryAfterSeconds?: number): void {
        const penaltyDuration = (retryAfterSeconds || 120) * 1000;
        this.rateLimitPenalty = Date.now() + penaltyDuration;
        console.error(`[RateLimiter] 429 received, pausing for ${penaltyDuration}ms`);
        this.shortWindow = [];
        this.longWindow = [];
    }

    getPenaltyStatus() {
        const now = Date.now();
        const isPenalty = this.rateLimitPenalty > now;
        return {
            isPenalty,
            penaltyEndsAt: this.rateLimitPenalty,
            remainingSeconds: isPenalty ? Math.ceil((this.rateLimitPenalty - now) / 1000) : 0,
        };
    }

    getStats() {
        const now = Date.now();
        this.shortWindow = this.shortWindow.filter((t) => now - t < this.SHORT_WINDOW);
        this.longWindow = this.longWindow.filter((t) => now - t < this.LONG_WINDOW);
        return {
            shortWindow: `${this.shortWindow.length}/${this.SHORT_LIMIT}`,
            longWindow: `${this.longWindow.length}/${this.LONG_LIMIT}`,
            penaltyActive: this.rateLimitPenalty > now,
        };
    }
}

export const rateLimiter = new RateLimiter();

/**
 * apiCallWithRetry
 *
 * Wraps an API call with the rate limiter and retries on 429 responses.
 */
export async function apiCallWithRetry<T>(apiCall: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await rateLimiter.waitForSlot();
            return await apiCall();
        } catch (error: any) {
            // Axios-style error handling (backend may wrap responses similarly)
            const status = error?.response?.status;
            if (status === 429) {
                console.warn(`[apiCallWithRetry] 429 on attempt ${attempt}`);
                const retryAfterHeader = error.response?.headers?.['retry-after'];
                const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 120;
                rateLimiter.handle429Error(retryAfterSeconds);
                if (attempt === maxRetries) {
                    throw new Error(`Rate limit exceeded after ${maxRetries} attempts`);
                }
                // allow loop to continue - wait will be handled by waitForSlot
                continue;
            }
            throw error;
        }
    }
    throw new Error('Max retries exceeded');
}
