export interface BlockBoundaryStrategy {
    findBlockBoundaries(content: string, currentNoteName: string): { start: number, end: number }[];
}
