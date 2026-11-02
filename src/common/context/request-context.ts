import { AsyncLocalStorage } from 'node:async_hooks';

/** 요청 하나 동안 "누가·어디서"를 들고 다닌다. 공통 칼럼(created_by 등)과 audit_log가 여기서 읽는다. */
export interface RequestContext {
  userId: number | null;
  ip: string | null;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function currentContext(): RequestContext {
  return requestContext.getStore() ?? { userId: null, ip: null };
}
