import { PerformanceMonitor } from '../PerformanceMonitor';

describe('PerformanceMonitor', () => {
  const makeLogger = () => ({
    logPerformance: jest.fn(),
    child: jest.fn().mockReturnThis()
  });

  it('measureSync bypasses logging when disabled', () => {
    const logger = makeLogger();
    const monitor = new PerformanceMonitor(logger as any, () => false);
    const op = jest.fn().mockReturnValue(42);

    const result = monitor.measureSync('test-sync-disabled', op);

    expect(result).toBe(42);
    expect(op).toHaveBeenCalledTimes(1);
    expect(logger.logPerformance).not.toHaveBeenCalled();
  });

  it('measureSync logs performance when enabled', () => {
    const logger = makeLogger();
    const monitor = new PerformanceMonitor(logger as any, () => true);
    const op = jest.fn().mockReturnValue('ok');

    const result = monitor.measureSync('test-sync', op, { foo: 'bar' });

    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(1);
    expect(logger.logPerformance).toHaveBeenCalledTimes(1);

    const [label, duration, meta] = (logger.logPerformance as jest.Mock).mock.calls[0];
    expect(label).toBe('test-sync');
    expect(typeof duration).toBe('number');
    expect(duration).toBeGreaterThanOrEqual(0);
    expect(meta).toMatchObject({ foo: 'bar' });
  });

  it('measureAsync logs performance and returns result when enabled', async () => {
    const logger = makeLogger();
    const monitor = new PerformanceMonitor(logger as any, () => true);
    const op = jest.fn().mockResolvedValue('async-ok');

    const result = await monitor.measureAsync('test-async', op, { x: 1 });

    expect(result).toBe('async-ok');
    expect(op).toHaveBeenCalledTimes(1);
    expect(logger.logPerformance).toHaveBeenCalledTimes(1);

    const [label, duration, meta] = (logger.logPerformance as jest.Mock).mock.calls[0];
    expect(label).toBe('test-async');
    expect(typeof duration).toBe('number');
    expect(duration).toBeGreaterThanOrEqual(0);
    expect(meta).toMatchObject({ x: 1 });
  });

  it('measureAsync logs error metadata and rethrows', async () => {
    const logger = makeLogger();
    const monitor = new PerformanceMonitor(logger as any, () => true);
    const error = new Error('boom');
    const op = jest.fn().mockRejectedValue(error);

    await expect(monitor.measureAsync('test-async-error', op)).rejects.toThrow(error);

    expect(logger.logPerformance).toHaveBeenCalledTimes(1);

    const [, , meta] = (logger.logPerformance as jest.Mock).mock.calls[0];
    expect(meta.errorName).toBe('Error');
    expect(meta.errorMessage).toBe('boom');
  });
});