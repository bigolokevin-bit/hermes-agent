// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';
import { fetchJsonStrict } from './fetchJson';

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as { __HERMES_SESSION_TOKEN__?: string }).__HERMES_SESSION_TOKEN__;
});

describe('fetchJsonStrict', () => {
  it('turns an HTML SPA shell into a human not-connected error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<!doctype html><html><body>app</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html', 'x-request-id': 'req-html' },
        }),
      ),
    );
    const error = await fetchJsonStrict('/agent-api/api/models/pricing').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toContain('页面，不是数据');
    expect((error as ApiError).message).not.toContain('Unexpected token');
    expect((error as ApiError).requestId).toBe('req-html');
    expect((error as ApiError).body).toBe('');
  });

  it('turns malformed JSON into a human parse error without the raw payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{not-json', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const error = await fetchJsonStrict('/agent-api/api/models').catch((e: unknown) => e);
    expect((error as ApiError).message).toContain('无法解析为数据');
    expect((error as ApiError).body).toBe('');
  });

  it('keeps non-2xx status and request id behind a human message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{"detail":"boom"}', {
          status: 502,
          headers: { 'content-type': 'application/json', 'x-console-request-id': 'req-502' },
        }),
      ),
    );
    const error = await fetchJsonStrict('/agent-api/api/models').catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).requestId).toBe('req-502');
    expect((error as ApiError).message).not.toContain('boom');
  });
});