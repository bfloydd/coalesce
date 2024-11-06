export class HeaderComponent {
    createHeader(
        container: HTMLElement, 
        fileCount: number, 
        blockCount: number,
        sortDescending: boolean,
        onSortToggle: () => void
    ): HTMLElement {
        const header = document.createElement('div');

        // Create and add SVG element
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 100 100");
        svg.setAttribute("width", "18");
        svg.setAttribute("height", "18");
        svg.setAttribute("fill", "currentColor");
        svg.innerHTML = `<path d="M85 40.5C85 22.5 70.5 10 52.5 10c-27.6 0-43.1 24.5-43.1 40 0 21.7 16.8 40 42.6 40 11.3 0 21.1-2.8 27.4-6.5 2.2-1.3 3.6-2.8 3.6-4.4 0-1.3-0.9-2.4-2.2-2.4-0.6 0-1.2 0.2-2 0.7-6.8 4.8-15.9 7.1-26.8 7.1-22.3 0-36.2-15.4-36.2-34.5 0-19.1 13.9-34.5 36.2-34.5 15.4 0 27.5 10.3 27.5 24.5 0 11.8-7.8 19.5-16.8 19.5-4.9 0-7.8-2.5-7.8-6.7 0-1.1 0.2-2.3 0.5-3.4l4.1-16.8c0.9-3.7-1.1-5.6-4-5.6-4.9 0-9.6 5-9.6 12.3 0 5.6 3.1 9.5 9.3 9.5 4.7 0 9.1-1.9 12.4-5.4 3.3 3.5 8.2 5.4 14.3 5.4C73.2 60 85 51.5 85 40.5z"/>`;
        header.appendChild(svg);


        header.classList.add('backlinks-header');
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.gap = '8px';
        header.style.marginBottom = '10px';

        const title = document.createElement('span');
        title.textContent = `${fileCount} ${fileCount === 1 ? 'Backlink' : 'Backlinks'}, ${blockCount} ${blockCount === 1 ? 'Block' : 'Blocks'}`;
        header.appendChild(title);

        const sortButton = document.createElement('button');
        sortButton.classList.add('clickable-icon');
        sortButton.style.background = 'none';
        sortButton.style.border = 'none';
        sortButton.style.padding = '4px';
        sortButton.style.cursor = 'pointer';
        sortButton.style.display = 'flex';
        sortButton.style.alignItems = 'center';
        sortButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" style="transform: ${sortDescending ? 'rotate(180deg)' : 'none'}">
                <path fill="currentColor" d="M8 3L4 7h8L8 3zm0 10l4-4H4l4 4z"/>
            </svg>
        `;
        sortButton.addEventListener('click', onSortToggle);
        header.appendChild(sortButton);

        return header;
    }
}
