import { HealthController } from '../../../src/health/health.controller';

describe('HealthController', () => {
  it('reports ok without touching any dependency', () => {
    const controller = new HealthController();

    expect(controller.check()).toEqual({ status: 'ok' });
  });
});
