import { Logger } from '../../shared-utilities/Logger';
import { AbstractBlockFinder } from './base/AbstractBlockFinder';
import { DefaultBlockFinder } from './implementations/DefaultBlockFinder';
import { HeadersOnlyBlockFinder } from './implementations/HeadersOnlyBlockFinder';
import { TopLineBlockFinder } from './implementations/TopLineBlockFinder';

export class BlockFinderFactory {
    private static readonly VALID_STRATEGIES = ['headers-only', 'top-line', 'default'] as const;
    private static logger: Logger = new Logger('BlockFinderFactory');

    /**
     * Returns the list of valid block finder strategies
     * with 'default' always at the top
     */
    static getValidStrategies(): ReadonlyArray<string> {
        // Create a sorted array with 'default' first, then others in original order
        const strategies = Array.from(this.VALID_STRATEGIES);
        
        // If 'default' exists in the array, move it to the front
        const defaultIndex = strategies.indexOf('default');
        if (defaultIndex > 0) {
            strategies.splice(defaultIndex, 1);
            strategies.unshift('default');
        }
        
        return strategies;
    }

    /**
     * Returns a map of strategy IDs to their display labels
     */
    static getStrategyLabels(): Record<string, string> {
        return {
            'default': 'Default',
            'headers-only': 'Headers only',
            'top-line': 'Top line'
        };
    }

    static createBlockFinder(strategy: string, logger: Logger): AbstractBlockFinder {
        this.logger.debug('Creating block finder', { 
            requestedStrategy: strategy,
            validStrategies: this.VALID_STRATEGIES
        });

        const blockFinder = this.instantiateBlockFinder(strategy, logger);
        
        this.logger.debug('Block finder created', {
            strategy,
            type: blockFinder.constructor.name
        });

        return blockFinder;
    }
    
    private static instantiateBlockFinder(strategy: string, logger: Logger): AbstractBlockFinder {
        switch (strategy) {
            case 'headers-only':
                return new HeadersOnlyBlockFinder(logger);
            case 'top-line':
                return new TopLineBlockFinder(logger);
            case 'default':
                return new DefaultBlockFinder(logger);
            default:
                return this.handleInvalidStrategy(strategy, logger);
        }
    }
    
    private static handleInvalidStrategy(strategy: string, logger: Logger): AbstractBlockFinder {
        // Use type predicate to check if strategy is in VALID_STRATEGIES
        const isValidStrategy = (s: string): s is typeof this.VALID_STRATEGIES[number] => 
            this.VALID_STRATEGIES.includes(s as typeof this.VALID_STRATEGIES[number]);
            
        if (!isValidStrategy(strategy)) {
            this.logger.warn('Invalid block finder strategy, falling back to default', {
                invalidStrategy: strategy,
                validStrategies: this.VALID_STRATEGIES
            });
        }
        return new DefaultBlockFinder(logger);
    }
} 