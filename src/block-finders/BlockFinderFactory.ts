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

        let blockFinder: AbstractBlockFinder;
        
        switch (strategy) {
            case 'headers-only':
                blockFinder = new HeadersOnlyBlockFinder(logger);
                break;
            case 'top-line':
                blockFinder = new TopLineBlockFinder(logger);
                break;
            case 'default':
            default:
                if (!this.VALID_STRATEGIES.includes(strategy as any)) {
                    this.logger.warn('Invalid block finder strategy, falling back to default', {
                        invalidStrategy: strategy,
                        validStrategies: this.VALID_STRATEGIES
                    });
                }
                blockFinder = new DefaultBlockFinder(logger);
                break;
        }

        this.logger.debug('Block finder created', {
            strategy,
            type: blockFinder.constructor.name
        });

        return blockFinder;
    }
} 