import { Logger } from './Logger';

/**
 * PerformanceMonitor
 *
 * Lightweight utility for measuring async and sync operations using the
 * existing Logger infrastructure. Designed to be cheap when disabled.
 */
export class PerformanceMonitor {
    constructor(
        private readonly logger: Logger,
        private readonly enabled: () => boolean
    ) {}

    /**
     * Measure an async operation.
     *
     * When disabled, this simply executes the operation without any overhead.
     */
    async measureAsync<T>(
        label: string,
        operation: () => Promise<T>,
        meta: Record<string, unknown> = {}
    ): Promise<T> {
        if (!this.enabled()) {
            return operation();
        }

        const start = performance.now();
        try {
            const result = await operation();
            const duration = performance.now() - start;
            this.logger.logPerformance(label, duration, meta);
            return result;
        } catch (error) {
            const duration = performance.now() - start;
            this.logger.logPerformance(label, duration, {
                ...meta,
                errorName: (error as Error).name,
                errorMessage: (error as Error).message
            });
            throw error;
        }
    }

    /**
     * Measure a sync operation.
     *
     * When disabled, this simply executes the operation without any overhead.
     */
    measureSync<T>(
        label: string,
        operation: () => T,
        meta: Record<string, unknown> = {}
    ): T {
        if (!this.enabled()) {
            return operation();
        }

        const start = performance.now();
        const result = operation();
        const duration = performance.now() - start;
        this.logger.logPerformance(label, duration, meta);
        return result;
    }
}