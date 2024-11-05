export class HeaderComponent {
    public createHeader(container: HTMLElement, text: string): HTMLElement {
        const header = container.createEl('h4', { text });
        return header;
    }
}
