import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { json } from '../../../tests/fixtures';

let api: typeof import('./graphql');
beforeEach(async () => { vi.resetModules(); api = await import('./graphql'); });

test('GraphQL requests send variables and reject HTTP, GraphQL, and malformed errors', async () => {
  const fetch = vi.fn().mockResolvedValue(json({ data: { value: 1 } }));
  vi.stubGlobal('fetch', fetch);
  const controller = new AbortController();
  expect(await api.graphqlRequest('query', { a: 1 }, controller.signal)).toEqual({ value: 1 });
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ query: 'query', variables: { a: 1 } });
  for (const [response, expected] of [[json({}, 503), '503'], [json({ errors: [{ message: 'Graph error' }] }), 'Graph error'], [json({ errors: [] }), 'Invalid response'], [json({}), 'Invalid response']] as const) {
    fetch.mockResolvedValue(response);
    await expect(api.graphqlRequest('query', {})).rejects.toThrow(expected);
  }
});

test('query hooks share requests and publish merged cache updates', async () => {
  let resolve!: (response: Response) => void;
  const fetch = vi.fn().mockImplementation(() => new Promise<Response>(next => { resolve = next; }));
  vi.stubGlobal('fetch', fetch);
  const merge = (previous: number[] | undefined, incoming: number[]) => [...(previous || []), ...incoming];
  const first = renderHook(() => api.useQuery('shared', 'query', {}, { merge }));
  const second = renderHook(() => api.useQuery<number[]>('shared', 'query', {}));
  expect(fetch).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(json({ data: [1] })); });
  expect(first.result.current.data).toEqual([1]);
  expect(second.result.current.data).toEqual([1]);
  act(() => { api.updateQuery<number[]>('shared', current => [...(current || []), 2]); });
  expect(first.result.current.data).toEqual([1, 2]);
  first.unmount(); second.unmount();
});

test('query hooks respect skip and cached data and report errors only while mounted', async () => {
  const fetch = vi.fn().mockResolvedValue(json({ data: { value: 2 } }));
  vi.stubGlobal('fetch', fetch);
  api.seedQuery('cached', { value: 1 });
  const hook = renderHook(({ skip, key }) => api.useQuery(key, 'query', {}, { skip, revalidate: false }), { initialProps: { skip: true, key: 'cached' } });
  expect(hook.result.current.data).toEqual({ value: 1 });
  hook.rerender({ skip: false, key: 'cached' });
  expect(fetch).not.toHaveBeenCalled();
  hook.rerender({ skip: false, key: 'fresh' });
  await waitFor(() => expect(hook.result.current.data).toEqual({ value: 2 }));
  fetch.mockRejectedValue(Error('offline'));
  hook.rerender({ skip: false, key: 'failed' });
  await waitFor(() => expect(hook.result.current.error?.message).toBe('offline'));
  let reject!: (error: Error) => void;
  fetch.mockImplementation(() => new Promise((_resolve, next) => { reject = next; }));
  hook.rerender({ skip: false, key: 'unmounted' });
  hook.unmount();
  await act(async () => { reject(Error('late')); });
});
