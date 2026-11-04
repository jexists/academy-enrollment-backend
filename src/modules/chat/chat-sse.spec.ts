import { describe, expect, it } from 'vitest';
import {
  CHAT_MESSAGES,
  formatSse,
  mapDifyPayload,
  parseSseChunk,
  toSources,
  createChatRecorder,
} from './chat-sse.js';

describe('SSE 줄 파서', () => {
  it('빈 줄로 끝난 이벤트의 data만 꺼내고 남은 부분은 돌려준다', () => {
    const { payloads, rest } = parseSseChunk(
      'data: {"a":1}\n\nevent: ping\n\ndata: {"b"',
    );
    expect(payloads).toEqual(['{"a":1}']);
    expect(rest).toBe('data: {"b"');
  });

  it('조각이 나뉘어 와도 이어 붙이면 한 이벤트가 된다', () => {
    const first = parseSseChunk('data: {"ans');
    expect(first.payloads).toEqual([]);
    const second = parseSseChunk(`${first.rest}wer":"안녕"}\r\n\r\n`);
    expect(second.payloads).toEqual(['{"answer":"안녕"}']);
    expect(second.rest).toBe('');
  });

  it('data 줄이 여러 개면 줄바꿈으로 잇는다', () => {
    expect(parseSseChunk('data: a\ndata: b\n\n').payloads).toEqual(['a\nb']);
  });
});

describe('근거 변환', () => {
  it('합친 파일이면 청크의 "문서:" 줄로 원래 문서를 찾고 그 줄은 뺀다', () => {
    const [source] = toSources([
      {
        document_name: '한빛수학-학원안내.md',
        content: '수강료 및 환불 규정 · 제5조 (환불 기준)\n문서: 02-fees.md\n수업 시작 전 전액',
        score: 0.5,
      },
    ]);
    expect(source.document).toBe('02-fees.md');
    expect(source.snippet).toBe('수강료 및 환불 규정 · 제5조 (환불 기준) 수업 시작 전 전액');
  });

  it('문서 이름, 내용 앞 200자, 점수만 남긴다', () => {
    const long = '가'.repeat(250);
    const [source] = toSources([
      {
        document_name: '03-attendance.md',
        content: long,
        score: 0.87654,
        dataset_id: 'secret',
      },
    ]);
    expect(source).toEqual({
      document: '03-attendance.md',
      snippet: `${'가'.repeat(200)}…`,
      score: 0.88,
    });
  });

  it('형식이 이상한 값은 비우거나 기본값을 쓴다', () => {
    expect(toSources(undefined)).toEqual([]);
    expect(toSources([{ content: ' 줄\n\n바꿈 ' }])).toEqual([
      { document: '학원 안내 문서', snippet: '줄 바꿈', score: null },
    ]);
  });

  it('근거는 5개까지만 보낸다', () => {
    expect(toSources(Array.from({ length: 8 }, () => ({})))).toHaveLength(5);
  });
});

describe('Dify 이벤트 → 화면 이벤트', () => {
  it('message·agent_message의 answer는 delta가 된다', () => {
    expect(
      mapDifyPayload(
        '{"event":"message","answer":"환불은","conversation_id":"c1"}',
      ),
    ).toEqual({
      conversationId: 'c1',
      event: { event: 'delta', data: { text: '환불은' } },
    });
    expect(
      mapDifyPayload('{"event":"agent_message","answer":"네"}').event,
    ).toEqual({ event: 'delta', data: { text: '네' } });
  });

  it('message_end는 대화 번호와 근거를 담은 end가 된다', () => {
    const { event } = mapDifyPayload(
      JSON.stringify({
        event: 'message_end',
        conversation_id: 'c1',
        metadata: {
          retriever_resources: [
            { document_name: '02-fees.md', content: '환불 규정', score: 0.5 },
          ],
          usage: { total_tokens: 10 },
        },
      }),
    );
    expect(event).toEqual({
      event: 'end',
      data: {
        conversationId: 'c1',
        sources: [{ document: '02-fees.md', snippet: '환불 규정', score: 0.5 }],
      },
    });
  });

  it('Dify 오류는 원문 대신 쉬운 문구로 바꾼다', () => {
    const { event } = mapDifyPayload(
      '{"event":"error","status":429,"code":"rate_limit_error","message":"raw"}',
    );
    expect(event).toEqual({
      event: 'error',
      data: { message: CHAT_MESSAGES.busy },
    });
    expect(JSON.stringify(event)).not.toContain('raw');
  });

  it('ping·workflow 이벤트와 깨진 JSON은 버린다', () => {
    expect(mapDifyPayload('{"event":"workflow_started"}').event).toBeNull();
    expect(mapDifyPayload('{not json').event).toBeNull();
  });
});

describe('SSE 쓰기', () => {
  it('event와 JSON data로 한 덩어리를 만든다', () => {
    expect(formatSse({ event: 'delta', data: { text: '안녕' } })).toBe(
      'event: delta\ndata: {"text":"안녕"}\n\n',
    );
  });
});

describe('대화 기록 모으기 (결정42)', () => {
  const end = {
    event: 'end' as const,
    data: {
      conversationId: 'c-1',
      sources: [{ document: '02-fees.md', snippet: '환불', score: 0.5 }],
    },
  };

  it('글자를 이어 붙이고 끝나면 완료와 근거를 남긴다', () => {
    const rec = createChatRecorder();
    rec.add({ event: 'delta', data: { text: '전액을 ' } });
    rec.add({ event: 'delta', data: { text: '돌려받아요.' } });
    rec.add(end);
    expect(rec.finish(false)).toEqual({
      answer: '전액을 돌려받아요.',
      sources: end.data.sources,
      conversationId: 'c-1',
      status: '완료',
      error: null,
    });
  });

  it('화면이 중간에 끊으면 멈춤, 받은 글자까지 남긴다', () => {
    const rec = createChatRecorder('c-0');
    rec.add({ event: 'delta', data: { text: '전액' } });
    expect(rec.finish(true)).toMatchObject({
      answer: '전액',
      status: '멈춤',
      conversationId: 'c-0',
      error: null,
    });
  });

  it('오류 이벤트나 끝 없이 닫히면 오류', () => {
    const rec = createChatRecorder();
    rec.add({ event: 'error', data: { message: '지금 문의가 많아요.' } });
    expect(rec.finish(false)).toMatchObject({
      status: '오류',
      error: '지금 문의가 많아요.',
    });
    expect(createChatRecorder().finish(false).status).toBe('오류');
  });
});

