import { App, TFile } from 'obsidian';
import { Logger } from '../shared-utilities/Logger';
import { IBlockExtractor, BlockData, BlockExtractionResult, BlockBoundaryStrategy } from './types';
import { AbstractBlockFinder } from './block-finders/base/AbstractBlockFinder';
import { BlockFinderFactory } from './block-finders/BlockFinderFactory';

/**
 * Block Extractor for Backlink Blocks Slice
 * 
 * Handles extraction of blocks from file content using different strategies
 * for the vertical slice architecture.
 */
export class BlockExtractor implements IBlockExtractor {
    private app: App;
    private logger: Logger;
    private strategies: Map<string, BlockBoundaryStrategy> = new Map();
    private statistics = {
        totalBlocksExtracted: 0,
        totalExtractions: 0,
        averageExtractionTime: 0,
        lastExtractionTime: new Date()
    };

    constructor(app: App, logger: Logger) {
        this.app = app;
        this.logger = logger.child('BlockExtractor');
        
        // Initialize built-in strategies
        this.initializeBuiltInStrategies();
        
        this.logger.debug('BlockExtractor initialized');
    }

    /**
     * Extract blocks from file content
     */
    async extractBlocks(content: string, currentNoteName: string, strategy: string): Promise<BlockData[]> {
        this.logger.debug('Extracting blocks', { contentLength: content.length, currentNoteName, strategy });
        
        const startTime = Date.now();
        const result: BlockData[] = [];
        
        try {
            // Get the strategy
            const blockStrategy = this.getStrategy(strategy);
            if (!blockStrategy) {
                this.logger.error('Unknown strategy', { strategy });
                return result;
            }
            
            // Find block boundaries
            const boundaries = blockStrategy.findBlockBoundaries(content, currentNoteName);
            
            // Extract blocks from boundaries
            for (let i = 0; i < boundaries.length; i++) {
                const { start, end } = boundaries[i];
                const blockContent = content.substring(start, end);
                
                // Create block data
                const blockData: BlockData = {
                    id: this.generateBlockId(currentNoteName, i),
                    content: blockContent,
                    sourcePath: currentNoteName,
                    startLine: this.getLineNumber(content, start),
                    endLine: this.getLineNumber(content, end),
                    heading: this.extractHeading(blockContent),
                    headingLevel: this.extractHeadingLevel(blockContent),
                    hasBacklinkLine: this.hasBacklinkLine(blockContent, currentNoteName),
                    isVisible: true,
                    isCollapsed: false
                };
                
                result.push(blockData);
            }
            
            // Update statistics
            const extractionTime = Date.now() - startTime;
            this.updateStatistics(result.length, extractionTime);
            
            this.logger.debug('Blocks extracted successfully', { 
                blockCount: result.length, 
                strategy, 
                extractionTime 
            });
            
            return result;
        } catch (error) {
            this.logger.error('Failed to extract blocks', { currentNoteName, strategy, error });
            return result;
        }
    }

    /**
     * Get available strategies
     */
    getAvailableStrategies(): string[] {
        return Array.from(this.strategies.keys());
    }

    /**
     * Check if strategy is available
     */
    isStrategyAvailable(strategy: string): boolean {
        return this.strategies.has(strategy);
    }

    /**
     * Get strategy description
     */
    getStrategyDescription(strategy: string): string {
        const blockStrategy = this.strategies.get(strategy);
        return blockStrategy?.description || 'Unknown strategy';
    }

    /**
     * Register a new strategy
     */
    registerStrategy(name: string, description: string, findBlockBoundaries: (content: string, currentNoteName: string) => Array<{start: number, end: number}>): void {
        this.logger.debug('Registering strategy', { name, description });
        
        const strategy: BlockBoundaryStrategy = {
            name,
            description,
            findBlockBoundaries
        };
        
        this.strategies.set(name, strategy);
        
        this.logger.debug('Strategy registered successfully', { name });
    }

    /**
     * Get statistics
     */
    getStatistics(): {
        totalBlocksExtracted: number;
        totalExtractions: number;
        averageExtractionTime: number;
        lastExtractionTime: Date;
    } {
        return { ...this.statistics };
    }

    /**
     * Initialize built-in strategies using existing block finders
     */
    private initializeBuiltInStrategies(): void {
        this.logger.debug('Initializing built-in strategies');
        
        try {
            // Get available strategies from BlockFinderFactory
            const availableStrategies = BlockFinderFactory.getValidStrategies();
            
            for (const strategyName of availableStrategies) {
                // Create a block finder to get its behavior
                const blockFinder = BlockFinderFactory.createBlockFinder(strategyName, this.logger as any);
                
                // Register as a strategy
                this.registerStrategy(
                    strategyName,
                    this.getStrategyDescriptionFromFinder(blockFinder),
                    (content: string, currentNoteName: string) => {
                        return blockFinder.findBlockBoundaries(content, currentNoteName);
                    }
                );
            }
            
            this.logger.debug('Built-in strategies initialized', { 
                strategyCount: availableStrategies.length 
            });
        } catch (error) {
            this.logger.error('Failed to initialize built-in strategies', { error });
        }
    }

    /**
     * Get strategy description from block finder
     */
    private getStrategyDescriptionFromFinder(blockFinder: AbstractBlockFinder): string {
        // Try to get description from the block finder class
        const className = blockFinder.constructor.name;
        
        // Provide descriptions based on class name
        switch (className) {
            case 'DefaultBlockFinder':
                return 'Default block extraction strategy';
            case 'HeadersOnlyBlockFinder':
                return 'Extract only headers from content';
            case 'TopLineBlockFinder':
                return 'Extract only the first line of content';
            default:
                return `${className} strategy`;
        }
    }

    /**
     * Get a strategy by name
     */
    private getStrategy(strategy: string): BlockBoundaryStrategy | null {
        return this.strategies.get(strategy) || null;
    }

    /**
     * Generate a unique block ID
     */
    private generateBlockId(sourcePath: string, index: number): string {
        return `block-${sourcePath}-${index}-${Date.now()}`;
    }

    /**
     * Get line number from character position
     */
    private getLineNumber(content: string, position: number): number {
        const beforePosition = content.substring(0, position);
        return beforePosition.split('\n').length;
    }

    /**
     * Extract heading from block content
     */
    private extractHeading(content: string): string | undefined {
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#')) {
                // Remove # characters and trim
                return trimmed.replace(/^#+\s*/, '');
            }
        }
        
        return undefined;
    }

    /**
     * Extract heading level from block content
     */
    private extractHeadingLevel(content: string): number | undefined {
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#')) {
                // Count # characters
                const match = trimmed.match(/^(#+)/);
                return match ? match[1].length : 1;
            }
        }
        
        return undefined;
    }

    /**
     * Check if block has a backlink line
     */
    private hasBacklinkLine(content: string, currentNoteName: string): boolean {
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Check for link patterns
            if (trimmed.includes(`[[${currentNoteName}]]`) || 
                trimmed.includes(`[[${currentNoteName}|`) ||
                trimmed.includes(`[[./${currentNoteName}]]`) ||
                trimmed.includes(`[[../${currentNoteName}]]`)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Update statistics
     */
    private updateStatistics(blockCount: number, extractionTime: number): void {
        this.statistics.totalBlocksExtracted += blockCount;
        this.statistics.totalExtractions++;
        this.statistics.lastExtractionTime = new Date();
        
        // Calculate average extraction time
        if (this.statistics.totalExtractions > 0) {
            this.statistics.averageExtractionTime = 
                (this.statistics.averageExtractionTime * (this.statistics.totalExtractions - 1) + extractionTime) / 
                this.statistics.totalExtractions;
        }
        
        this.logger.debug('Statistics updated', { 
            blockCount, 
            extractionTime, 
            statistics: this.statistics 
        });
    }

    /**
     * Reset statistics
     */
    resetStatistics(): void {
        this.logger.debug('Resetting statistics');
        
        this.statistics = {
            totalBlocksExtracted: 0,
            totalExtractions: 0,
            averageExtractionTime: 0,
            lastExtractionTime: new Date()
        };
        
        this.logger.debug('Statistics reset successfully');
    }

    /**
     * Cleanup resources used by this block extractor
     */
    cleanup(): void {
        this.logger.debug('Cleaning up BlockExtractor');
        
        // Clear strategies
        this.strategies.clear();
        
        // Reset statistics
        this.resetStatistics();
        
        this.logger.debug('BlockExtractor cleanup completed');
    }
}