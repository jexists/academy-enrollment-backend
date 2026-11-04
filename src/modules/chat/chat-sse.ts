/**
 * Dify 스트리밍(SSE)을 읽고, 화면에 보낼 줄인 이벤트로 바꾸는 순수 함수들.
 * Dify 원본 이벤트나 키는 화면으로 넘기지 않는다.
 */

/** 화면에 보내는 이벤트 */
export interface ChatSource {
  document: string;
  snippet: string;
  score: number | null;
}

export type ClientEvent =
  | { event: 'delta'; data: { text: string } }
  | { event: 'end'; data: { conversationId: string; sources: ChatSource[] } }
  | { event: 'error'; data: { message: string } };

export const SNIPPET_LENGTH = 200;
export const MAX_SOURCES = 5;

export const CHAT_MESSAGES = {
  notReady: '상담 챗봇을 준비하고 있어요',
  busy: '지금 문의가 많아요. 조금 뒤에 다시 물어봐 주세요.',
  failed: '답을 만들지 못했어요. 잠시 뒤에 다시 물어봐 주세요.',
  expired: '대화가 오래돼서 이어갈 수 없어요. 새 대화로 다시 물어봐 주세요.',
} as const;

/**
 * SSE 조각을 이어 붙인 문자열에서 완성된 이벤트의 data만 꺼낸다.
 * 아직 끝나지 않은 마지막 부분은 rest로 돌려줘서 다음 조각과 이어 붙인다.
 */
export function parseSseChunk(buffer: string): {
  payloads: string[];
  rest: string;
} {
  const normalized = buffer.replace(/\r\n?/g, '\n');
  const blocks = normalized.split('\n\n');
  const rest = blocks.pop() ?? '';
  const payloads: string[] = [];
  for (const block of blocks) {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n');
    if (data) payloads.push(data);
  }
  return { payloads, rest };
}

interface DifyRetrieverResource {
  document_name?: unknown;
  content?: unknown;
  score?: unknown;
}

/** message_end.metadata.retriever_resources → 근거 목록 (문서 이름, 내용 앞 200자, 점수) */
export function toSources(resources: unknown): ChatSource[] {
  if (!Array.isArray(resources)) return [];
  return (resources as DifyRetrieverResource[])
    .filter((r) => r && typeof r === 'object')
    .map((r) => {
      const content =
        typeof r.content === 'string'
          ? r.content.replace(/\s+/g, ' ').trim()
          : '';
      return {
        document:
          typeof r.document_name === 'string' && r.document_name.trim()
            ? r.document_name.trim()
            : '학원 안내 문서',
        snippet:
          content.length > SNIPPET_LENGTH
            ? `${content.slice(0, SNIPPET_LENGTH)}…`
            : content,
        score:
          typeof r.score === 'number' && Number.isFinite(r.score)
            ? Math.round(r.score * 100) / 100
            : null,
      };
    })
    .slice(0, MAX_SOURCES);
}

/** Dify 오류 상태 코드 → 쉬운 문구 */
export function errorMessageFor(status?: number, code?: string): string {
  if (status === 429 || code === 'rate_limit_error') return CHAT_MESSAGES.busy;
  if (status === 404 || code === 'conversation_not_exists')
    return CHAT_MESSAGES.expired;
  return CHAT_MESSAGES.failed;
}

interface DifyEvent {
  event?: unknown;
  answer?: unknown;
  conversation_id?: unknown;
  metadata?: { retriever_resources?: unknown };
  status?: unknown;
  code?: unknown;
}

/**
 * Dify 이벤트 하나(JSON 문자열)를 화면 이벤트로 바꾼다. 쓰지 않는 이벤트(ping, workflow 등)는 null.
 * conversationId는 Dify가 이벤트마다 넣어 주는 값을 따로 돌려준다.
 */
export function mapDifyPayload(payload: string): {
  event: ClientEvent | null;
  conversationId?: string;
} {
  let parsed: DifyEvent;
  try {
    parsed = JSON.parse(payload) as DifyEvent;
  } catch {
    return { event: null };
  }
  if (!parsed || typeof parsed !== 'object') return { event: null };
  const conversationId =
    typeof parsed.conversation_id === 'string' && parsed.conversation_id
      ? parsed.conversation_id
      : undefined;

  switch (parsed.event) {
    case 'message':
    case 'agent_message':
      return {
        conversationId,
        event:
          typeof parsed.answer === 'string' && parsed.answer
            ? { event: 'delta', data: { text: parsed.answer } }
            : null,
      };
    case 'message_end':
      return {
        conversationId,
        event: {
          event: 'end',
          data: {
            conversationId: conversationId ?? '',
            sources: toSources(parsed.metadata?.retriever_resources),
          },
        },
      };
    case 'error':
      return {
        conversationId,
        event: {
          event: 'error',
          data: {
            message: errorMessageFor(
              typeof parsed.status === 'number' ? parsed.status : undefined,
              typeof parsed.code === 'string' ? parsed.code : undefined,
            ),
          },
        },
      };
    default:
      return { event: null, conversationId };
  }
}

/** 화면 이벤트 → SSE 한 덩어리 */
export function formatSse(event: ClientEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}
