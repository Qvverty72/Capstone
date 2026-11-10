import { test as base, expect } from '@playwright/test';
import { installMockAPI } from './mock-api';

export const test = base.extend<{ api: Awaited<ReturnType<typeof installMockAPI>> }>({
  api: [async ({ context, baseURL }, use) => {
    const api = await installMockAPI(context, new URL(baseURL!).origin);
    await use(api);
    expect(api.unexpected, 'Unmocked external/API requests must be explicitly implemented').toEqual([]);
  }, { auto: true }],
});
export { expect };
