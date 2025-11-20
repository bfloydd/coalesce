import { createDropdown } from '../Dropdown';

describe('createDropdown', () => {
  let parent: HTMLElement;

  beforeEach(() => {
    parent = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(parent);
  });

  it('creates a select element with coalesce-dropdown class and items', () => {
    const items = [
      { value: 'default', label: 'Default' },
      { value: 'modern', label: 'Modern' },
      { value: 'compact', label: 'Compact' }
    ];

    const select = createDropdown({
      parent,
      items,
      value: 'modern',
      onChange: () => {},
      classes: ['coalesce-theme-select'],
      ariaLabel: 'Theme'
    });

    expect(select).toBeInstanceOf(HTMLSelectElement);
    expect(parent.contains(select)).toBe(true);
    expect(select.classList.contains('coalesce-dropdown')).toBe(true);
    expect(select.classList.contains('coalesce-theme-select')).toBe(true);
    expect(select.getAttribute('aria-label')).toBe('Theme');

    // Options populated
    const options = Array.from(select.querySelectorAll('option'));
    expect(options).toHaveLength(items.length);
    expect(options.map(o => o.value)).toEqual(items.map(i => i.value));

    // Initial value applied
    expect(select.value).toBe('modern');
  });

  it('invokes onChange callback when selection changes', () => {
    const items = [
      { value: 'default', label: 'Default' },
      { value: 'modern', label: 'Modern' }
    ];

    const onChange = jest.fn();

    const select = createDropdown({
      parent,
      items,
      value: 'default',
      onChange
    });

    // Simulate user changing selection
    select.value = 'modern';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('modern');
  });
});