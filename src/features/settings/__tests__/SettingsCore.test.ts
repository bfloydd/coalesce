import { SettingsCore } from '../core/SettingsCore';
import { Logger } from '../../shared-utilities/Logger';
import type { CoalescePluginSettings, PluginInterface } from '../../shared-contracts/plugin';

class InMemoryPlugin implements PluginInterface {
  private data: Partial<CoalescePluginSettings> | null = null;

  async loadData(): Promise<Partial<CoalescePluginSettings>> {
    return this.data ?? {};
  }

  async saveData(settings: CoalescePluginSettings): Promise<void> {
    this.data = { ...settings };
  }
}

describe('SettingsCore', () => {
  let plugin: InMemoryPlugin;
  let logger: Logger;
  let core: SettingsCore;

  beforeEach(() => {
    plugin = new InMemoryPlugin();
    logger = new Logger('SettingsCore.test');
    core = new SettingsCore(logger, plugin);
  });

  it('loads default settings when store is empty', async () => {
    await core.start();

    const settings = core.getSettings();

    expect(settings.mySetting).toBe('default');
    expect(typeof settings.enableLogging).toBe('boolean');
    expect(typeof settings.theme).toBe('string');
  });

  it('persists updates via updateSetting', async () => {
    await core.start();

    await core.updateSetting('theme', 'modern');

    const updated = core.getSettings();
    expect(updated.theme).toBe('modern');
  });

  it('validates settings and reports errors for invalid values', () => {
    const result = core.validateSettings({
      theme: 'not-a-theme',
      headerStyle: 'invalid-style'
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});