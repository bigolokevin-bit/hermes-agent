import { ApiError } from '@/lib/api-error';

const SESSION_HEADER = 'X-Hermes-Session-Token';

/**
 * Read a BFF JSON endpoint without ever letting a non-JSON response surface
 * as a parser error. A static SPA shell or proxy HTML page is reported as a
 * human "not connected" condition with the request id, never as
 * `Unexpected token '<'`.
 */
function humanStatus(status: number): string {
  if (status === 401) return '需要登录：这个页面的登录状态已经失效，重新登录后再试。';
  if (status === 403) return '没有查看这项数据的权限；请联系管理员开通。';
  if (status === 404) return '这个数据接口还没有接入。';
  if (status === 429) return '请求太频繁，请稍后再试。';
  if (status >= 500) return '数据服务暂时没有响应，请稍后重试。';
  return '这次读取没有成功，请稍后重试。';
}

export async function fetchJsonStrict(url: string): Promise<unknown> {
  const headers = new Headers();
  const token = window.__HERMES_SESSION_TOKEN__;
  if (token) headers.set(SESSION_HEADER, token);

  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      credentials: 'include',
      mode: 'same-origin',
    });
  } catch {
    throw new ApiError('数据服务当前不可达，请检查连接后重试。', {
      status: 0,
      body: '',
      url,
    });
  }

  const requestId =
    response.headers.get('x-console-request-id') ?? response.headers.get('x-request-id') ?? undefined;
  const text = await response.text();

  if (!response.ok) {
    throw new ApiError(humanStatus(response.status), {
      status: response.status,
      body: '',
      url,
      requestId,
    });
  }

  const contentType = response.headers.get('content-type') ?? '';
  const looksJson = contentType.toLowerCase().includes('json');
  const body = text.trim();

  if (!looksJson && body.startsWith('<')) {
    throw new ApiError('这个接口还没有接入数据服务；当前返回的是页面，不是数据。', {
      status: response.status,
      body: '',
      url,
      requestId,
    });
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new ApiError('这个接口返回的内容无法解析为数据；请稍后重试或联系管理员。', {
      status: response.status,
      body: '',
      url,
      requestId,
    });
  }
}