import { JOBS, QUEUES } from '../../../src/constants/queues';

describe('queues constants', () => {
  it('defines exactly two queues', () => {
    expect(Object.values(QUEUES)).toEqual(['webhooks', 'ai-classify']);
  });

  it('defines exactly two job names', () => {
    expect(Object.values(JOBS)).toEqual(['deliver', 'classify']);
  });
});
