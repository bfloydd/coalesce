import { Logger } from '../../shared-utilities/Logger';
import { CoalesceEvent, EventHandler } from '../../shared-contracts/events';

/**
 * Event facade for the Backlinks feature.
 *
 * This class encapsulates the event handler map and exposes a small,
 * focused API for emitting and subscribing to Coalesce events related
 * to backlinks.
 *
 * It is extracted from BacklinksSlice to:
 * - reduce responsibilities on the slice
 * - make event behavior easier to test in isolation
 * - provide a reusable abstraction for other collaborators if needed
 */
export class BacklinksEvents {
    private readonly logger: Logger;
    private readonly eventHandlers: Map<string, EventHandler[]> = new Map();

    constructor(logger: Logger) {
        this.logger = logger.child('BacklinksEvents');
        this.logger.debug('BacklinksEvents initialized');
    }

    /**
     * Emit an event to all registered handlers.
     */
    emitEvent(event: CoalesceEvent): void {
        this.logger.debug('Emitting event', { event });

        try {
            const handlers = this.eventHandlers.get(event.type) || [];

            for (const handler of handlers) {
                try {
                    handler(event);
                } catch (error) {
                    this.logger.error('Event handler failed', { event, error });
                }
            }

            this.logger.debug('Event emitted successfully', { eventType: event.type, handlerCount: handlers.length });
        } catch (error) {
            this.logger.error('Failed to emit event', { event, error });
        }
    }

    /**
     * Register an event listener for a specific event type.
     */
    addEventListener<T extends CoalesceEvent>(eventType: T['type'], handler: EventHandler<T>): void {
        this.logger.debug('Adding event listener', { eventType });

        try {
            const handlers = this.eventHandlers.get(eventType) || [];
            handlers.push(handler as EventHandler);
            this.eventHandlers.set(eventType, handlers);

            this.logger.debug('Event listener added successfully', {
                eventType,
                totalHandlers: handlers.length
            });
        } catch (error) {
            this.logger.error('Failed to add event listener', { eventType, error });
        }
    }

    /**
     * Remove a previously registered event listener.
     */
    removeEventListener<T extends CoalesceEvent>(eventType: T['type'], handler: EventHandler<T>): void {
        this.logger.debug('Removing event listener', { eventType });

        try {
            const handlers = this.eventHandlers.get(eventType) || [];
            const index = handlers.indexOf(handler as EventHandler);

            if (index !== -1) {
                handlers.splice(index, 1);
                this.eventHandlers.set(eventType, handlers);

                this.logger.debug('Event listener removed successfully', {
                    eventType,
                    remainingHandlers: handlers.length
                });
            } else {
                this.logger.debug('Event listener not found', { eventType });
            }
        } catch (error) {
            this.logger.error('Failed to remove event listener', { eventType, error });
        }
    }

    /**
     * Clear all registered listeners for all event types.
     * Intended to be called from BacklinksSlice.cleanup().
     */
    clearAllListeners(): void {
        this.logger.debug('Clearing all event listeners');

        try {
            this.eventHandlers.clear();
            this.logger.debug('All event listeners cleared');
        } catch (error) {
            this.logger.error('Failed to clear event listeners', { error });
        }
    }
}