import { Logger } from '../utils/Logger';
import { AbstractBlockFinder } from './base/AbstractBlockFinder';
import { DefaultBlockFinder } from './implementations/DefaultBlockFinder';
import { HeadersOnlyBlockFinder } from './implementations/HeadersOnlyBlockFinder';
import { TopLineBlockFinder } from './implementations/TopLineBlockFinder';

export class BlockFinderFactory {
    static createBlockFinder(strategy: string, logger: Logger): AbstractBlockFinder {
        switch (strategy) {
            case 'headers-only':
                return new HeadersOnlyBlockFinder(logger);
            case 'top-line':
                return new TopLineBlockFinder(logger);
            case 'default':
            default:
                return new DefaultBlockFinder(logger);
        }
    }
} 