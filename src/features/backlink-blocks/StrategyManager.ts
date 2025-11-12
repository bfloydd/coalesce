import { Logger } from '../shared-utilities/Logger';
import { IStrategyManager } from './types';

/**
 * Strategy Manager for Backlink Blocks Slice
 * 
 * Handles management of block boundary strategies
 * for the vertical slice architecture.
 */
export class StrategyManager implements IStrategyManager {
    private logger: Logger;
    private currentStrategy: string;
    private strategies: Map<string, string> = new Map(); // name -> description

    constructor(logger: Logger, defaultStrategy: string = 'default') {
        this.logger = logger.child('StrategyManager');
        this.currentStrategy = defaultStrategy;
        
        // Initialize built-in strategies
        this.initializeBuiltInStrategies();
        
        this.logger.debug('StrategyManager initialized', { defaultStrategy });
    }

    /**
     * Get current strategy
     */
    getCurrentStrategy(): string {
        return this.currentStrategy;
    }

    /**
     * Set current strategy
     */
    setCurrentStrategy(strategy: string): void {
        this.logger.debug('Setting current strategy', { strategy, previousStrategy: this.currentStrategy });
        
        if (!this.strategies.has(strategy)) {
            this.logger.warn('Unknown strategy, keeping current', { strategy, currentStrategy: this.currentStrategy });
            return;
        }
        
        this.currentStrategy = strategy;
        
        this.logger.debug('Current strategy set successfully', { strategy });
    }

    /**
     * Get available strategies
     */
    getAvailableStrategies(): string[] {
        return Array.from(this.strategies.keys());
    }

    /**
     * Register a new strategy
     */
    registerStrategy(strategy: string, description: string): void {
        this.logger.debug('Registering strategy', { strategy, description });
        
        this.strategies.set(strategy, description);
        
        this.logger.debug('Strategy registered successfully', { strategy });
    }

    /**
     * Get strategy description
     */
    getStrategyDescription(strategy: string): string {
        const description = this.strategies.get(strategy);
        return description || 'Unknown strategy';
    }

    /**
     * Check if strategy exists
     */
    hasStrategy(strategy: string): boolean {
        return this.strategies.has(strategy);
    }

    /**
     * Get strategy count
     */
    getStrategyCount(): number {
        return this.strategies.size;
    }

    /**
     * Remove a strategy
     */
    removeStrategy(strategy: string): boolean {
        this.logger.debug('Removing strategy', { strategy });
        
        const existed = this.strategies.has(strategy);
        
        if (existed) {
            this.strategies.delete(strategy);
            
            // If we removed the current strategy, set a new one
            if (this.currentStrategy === strategy) {
                const availableStrategies = this.getAvailableStrategies();
                this.currentStrategy = availableStrategies.length > 0 ? availableStrategies[0] : 'default';
                
                this.logger.debug('Current strategy changed due to removal', { 
                    removedStrategy: strategy, 
                    newStrategy: this.currentStrategy 
                });
            }
        }
        
        this.logger.debug('Strategy removal completed', { strategy, existed });
        return existed;
    }

    /**
     * Get all strategies with descriptions
     */
    getAllStrategies(): Array<{ name: string; description: string }> {
        const result: Array<{ name: string; description: string }> = [];
        
        for (const [name, description] of this.strategies.entries()) {
            result.push({ name, description });
        }
        
        return result;
    }

    /**
     * Initialize built-in strategies
     */
    private initializeBuiltInStrategies(): void {
        this.logger.debug('Initializing built-in strategies');
        
        try {
            // Register common strategies
            this.registerStrategy('default', 'Default block extraction strategy');
            this.registerStrategy('headers-only', 'Extract only headers from content');
            this.registerStrategy('top-line', 'Extract only the first line of content');
            
            this.logger.debug('Built-in strategies initialized', { 
                strategyCount: this.strategies.size 
            });
        } catch (error) {
            this.logger.error('Failed to initialize built-in strategies', { error });
        }
    }

    /**
     * Reset to default strategy
     */
    resetToDefault(): void {
        this.logger.debug('Resetting to default strategy');
        
        this.currentStrategy = 'default';
        
        this.logger.debug('Reset to default strategy completed');
    }

    /**
     * Validate strategy name
     */
    validateStrategyName(strategy: string): boolean {
        // Basic validation: non-empty, alphanumeric with hyphens/underscores
        const isValid = typeof strategy === 'string' && 
                       strategy.length > 0 && 
                       /^[a-zA-Z0-9_-]+$/.test(strategy);
        
        this.logger.debug('Strategy name validation', { strategy, isValid });
        
        return isValid;
    }

    /**
     * Get strategy metadata
     */
    getStrategyMetadata(): {
        currentStrategy: string;
        totalStrategies: number;
        strategies: Array<{ name: string; description: string }>;
    } {
        return {
            currentStrategy: this.currentStrategy,
            totalStrategies: this.strategies.size,
            strategies: this.getAllStrategies()
        };
    }

    /**
     * Cleanup resources used by this strategy manager
     */
    cleanup(): void {
        this.logger.debug('Cleaning up StrategyManager');
        
        // Clear strategies
        this.strategies.clear();
        
        // Reset to default
        this.currentStrategy = 'default';
        
        this.logger.debug('StrategyManager cleanup completed');
    }
}