import { Logger } from '../utils/Logger';
import { AbstractBlockFinder } from './base/AbstractBlockFinder';
import { DefaultBlockFinder } from './implementations/DefaultBlockFinder';
import { HeadersOnlyBlockFinder } from './implementations/HeadersOnlyBlockFinder';
import { TopLineBlockFinder } from './implementations/TopLineBlockFinder';

export class BlockFinderFactory {
    private static readonly VALID_STRATEGIES = ['headers-only', 'top-line', 'default'] as const;
    private static logger: Logger = new Logger('BlockFinderFactory');

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
        if (!this.VALID_STRATEGIES.includes(strategy as any)) {
            this.logger.warn('Invalid block finder strategy, falling back to default', {
                invalidStrategy: strategy,
                validStrategies: this.VALID_STRATEGIES
            });
        }
        return new DefaultBlockFinder(logger);
    }
} 