export class HeaderComponent {
    public createHeader(container: HTMLElement, backlinksCount: number, blocksCount: number): HTMLElement {
        const headerText = `${backlinksCount} Backlinks, ${blocksCount} Blocks`;
        const header = container.createEl('h4', { text: headerText });
        return header;
    }
}
