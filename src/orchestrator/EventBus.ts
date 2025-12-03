import { Logger } from '../features/shared-utilities/Logger';
import { EventBus as IEventBus } from './types';

/**
 * Event Bus for Plugin Orchestrator
 * 
 * Provides event-driven communication between slices in the vertical slice architecture.
 */
export class EventBus implements IEventBus {
    private logger: Logger;
    private listeners: Map<string, Function[]> = new Map();
    private onceListeners: Map<string, Function[]> = new Map();
    private statistics: {
        totalEventsEmitted: number;
        totalListenersAdded: number;
        totalListenersRemoved: number;
        totalEventProcessingTime: number;
        lastEventEmitted?: Date;
    };

    constructor(logger: Logger) {
        this.logger = logger.child('EventBus');
        
        this.statistics = {
            totalEventsEmitted: 0,
            totalListenersAdded: 0,
            totalListenersRemoved: 0,
            totalEventProcessingTime: 0
        };
        
        this.logger.debug('EventBus initialized');
    }

    /**
     * Emit an event
     */
    emit(event: string, data: any): void {
        const startTime = Date.now();
        
        this.logger.debug('Emitting event', { event, data });
        
        try {
            // Update statistics
            this.statistics.totalEventsEmitted++;
            this.statistics.lastEventEmitted = new Date();
            
            // Get all listeners for this event
            const regularListeners = this.listeners.get(event) || [];
            const onceListeners = this.onceListeners.get(event) || [];
            const allListeners = [...regularListeners, ...onceListeners];
            
            // Execute all listeners
            for (const listener of allListeners) {
                try {
                    listener(data);
                } catch (error) {
                    this.logger.error('Event listener failed', { event, error });
                }
            }
            
            // Clear once listeners
            this.onceListeners.delete(event);
            
            // Update processing time
            const processingTime = Date.now() - startTime;
            this.statistics.totalEventProcessingTime += processingTime;
            
            this.logger.debug('Event emitted successfully', { 
                event, 
                listenerCount: allListeners.length,
                processingTime 
            });
        } catch (error) {
            this.logger.error('Failed to emit event', { event, data, error });
        }
    }

    /**
     * Add event listener
     */
    on(event: string, handler: Function): void {
        this.logger.debug('Adding event listener', { event });
        
        try {
            const listeners = this.listeners.get(event) || [];
            listeners.push(handler);
            this.listeners.set(event, listeners);
            
            // Update statistics
            this.statistics.totalListenersAdded++;
            
            this.logger.debug('Event listener added successfully', { 
                event, 
                totalListeners: listeners.length 
            });
        } catch (error) {
            this.logger.error('Failed to add event listener', { event, error });
        }
    }

    /**
     * Remove event listener
     */
    off(event: string, handler: Function): void {
        this.logger.debug('Removing event listener', { event });
        
        try {
            const listeners = this.listeners.get(event);
            if (listeners) {
                const index = listeners.indexOf(handler);
                if (index !== -1) {
                    listeners.splice(index, 1);
                    this.listeners.set(event, listeners);
                    
                    // Update statistics
                    this.statistics.totalListenersRemoved++;
                    
                    this.logger.debug('Event listener removed successfully', { 
                        event, 
                        remainingListeners: listeners.length 
                    });
                } else {
                    this.logger.debug('Event listener not found', { event });
                }
            }
        } catch (error) {
            this.logger.error('Failed to remove event listener', { event, error });
        }
    }

    /**
     * Add one-time event listener
     */
    once(event: string, handler: Function): void {
        this.logger.debug('Adding one-time event listener', { event });
        
        try {
            const listeners = this.onceListeners.get(event) || [];
            listeners.push(handler);
            this.onceListeners.set(event, listeners);
            
            // Update statistics
            this.statistics.totalListenersAdded++;
            
            this.logger.debug('One-time event listener added successfully', { 
                event, 
                totalListeners: listeners.length 
            });
        } catch (error) {
            this.logger.error('Failed to add one-time event listener', { event, error });
        }
    }

    /**
     * Remove all listeners
     */
    removeAllListeners(event?: string): void {
        this.logger.debug('Removing all listeners', { event });
        
        try {
            if (event) {
                // Remove listeners for specific event
                const listenerCount = (this.listeners.get(event) || []).length + 
                                     (this.onceListeners.get(event) || []).length;
                
                this.listeners.delete(event);
                this.onceListeners.delete(event);
                
                // Update statistics
                this.statistics.totalListenersRemoved += listenerCount;
                
                this.logger.debug('All listeners removed for event', { 
                    event, 
                    removedCount: listenerCount 
                });
            } else {
                // Remove all listeners
                let totalRemoved = 0;
                
                for (const [event, listeners] of this.listeners.entries()) {
                    totalRemoved += listeners.length;
                }
                
                for (const [event, listeners] of this.onceListeners.entries()) {
                    totalRemoved += listeners.length;
                }
                
                this.listeners.clear();
                this.onceListeners.clear();
                
                // Update statistics
                this.statistics.totalListenersRemoved += totalRemoved;
                
                this.logger.debug('All listeners removed', { totalRemoved });
            }
        } catch (error) {
            this.logger.error('Failed to remove all listeners', { event, error });
        }
    }

    /**
     * Get listener count for an event
     */
    getListenerCount(event: string): number {
        try {
            const regularListeners = this.listeners.get(event) || [];
            const onceListeners = this.onceListeners.get(event) || [];
            return regularListeners.length + onceListeners.length;
        } catch (error) {
            this.logger.error('Failed to get listener count', { event, error });
            return 0;
        }
    }

    /**
     * Get all event names
     */
    getEventNames(): string[] {
        try {
            const regularEvents = Array.from(this.listeners.keys());
            const onceEvents = Array.from(this.onceListeners.keys());
            return [...new Set([...regularEvents, ...onceEvents])];
        } catch (error) {
            this.logger.error('Failed to get event names', { error });
            return [];
        }
    }

    /**
     * Get statistics
     */
    getStatistics(): {
        totalEventsEmitted: number;
        totalListenersAdded: number;
        totalListenersRemoved: number;
        totalEventProcessingTime: number;
        lastEventEmitted?: Date;
    } {
        return { ...this.statistics };
    }

    /**
     * Reset statistics
     */
    resetStatistics(): void {
        this.logger.debug('Resetting statistics');
        
        this.statistics = {
            totalEventsEmitted: 0,
            totalListenersAdded: 0,
            totalListenersRemoved: 0,
            totalEventProcessingTime: 0
        };
        
        this.logger.debug('Statistics reset successfully');
    }

    /**
     * Get average event processing time
     */
    getAverageEventProcessingTime(): number {
        if (this.statistics.totalEventsEmitted === 0) {
            return 0;
        }
        
        return this.statistics.totalEventProcessingTime / this.statistics.totalEventsEmitted;
    }

    /**
     * Get total listener count
     */
    getTotalListenerCount(): number {
        let total = 0;
        
        for (const [event, listeners] of this.listeners.entries()) {
            total += listeners.length;
        }
        
        for (const [event, listeners] of this.onceListeners.entries()) {
            total += listeners.length;
        }
        
        return total;
    }

    /**
     * Check if event has listeners
     */
    hasListeners(event: string): boolean {
        return this.getListenerCount(event) > 0;
    }

    /**
     * Get listener details for debugging
     */
    getListenerDetails(): Record<string, { regular: number; once: number; total: number }> {
        const details: Record<string, { regular: number; once: number; total: number }> = {};
        
        for (const event of this.getEventNames()) {
            const regular = (this.listeners.get(event) || []).length;
            const once = (this.onceListeners.get(event) || []).length;
            
            details[event] = {
                regular,
                once,
                total: regular + once
            };
        }
        
        return details;
    }

    /**
     * Cleanup resources used by this event bus
     */
    cleanup(): void {
        this.logger.debug('Cleaning up EventBus');
        
        try {
            // Remove all listeners
            this.removeAllListeners();
            
            // Reset statistics
            this.resetStatistics();
            
            this.logger.debug('EventBus cleanup completed');
        } catch (error) {
            this.logger.error('Failed to cleanup EventBus', { error });
        }
    }
}