import {
  monthSessions,
  overlaps,
  slotProblem,
  teacherConflict,
} from './schedule-rules.js';

const tueThu19 = [
  { weekday: 2, startTime: '19:00', endTime: '21:00' },
  { weekday: 4, startTime: '19:00', endTime: '21:00' },
];

describe('강사 시간 겹침 (B9)', () => {
  const others = [
    {
      weekday: 2,
      startTime: '19:00',
      endTime: '21:00',
      className: '중2 심화A',
    },
  ];

  it('같은 요일 같은 시간이면 거절하고 어느 반과 겹치는지 알려 준다', () => {
    expect(
      teacherConflict(
        '박강사',
        [{ weekday: 2, startTime: '20:00', endTime: '22:00' }],
        others,
      ),
    ).toBe(
      '저장할 수 없어요. 박강사는 화 19:00~21:00에 중2 심화A를 맡고 있어요.',
    );
  });

  it('앞 수업이 끝나는 시각에 시작하면 겹치지 않는다', () => {
    expect(
      teacherConflict(
        '박강사',
        [{ weekday: 2, startTime: '17:00', endTime: '19:00' }],
        others,
      ),
    ).toBeNull();
  });

  it('요일이 다르면 겹치지 않는다', () => {
    expect(
      overlaps({ weekday: 1, startTime: '19:00', endTime: '21:00' }, others[0]),
    ).toBe(false);
  });
});

describe('정규 요일 칸 검사', () => {
  it('끝 시간이 시작보다 빠르면 막는다', () => {
    expect(
      slotProblem([{ weekday: 1, startTime: '19:00', endTime: '18:00' }]),
    ).toMatch(/늦어야/);
  });

  it('같은 요일을 두 번 넣으면 막는다', () => {
    expect(slotProblem([tueThu19[0], tueThu19[0]])).toMatch(/두 번/);
  });

  it('정상이면 통과', () => {
    expect(slotProblem(tueThu19)).toBeNull();
  });
});

describe('월 수업일 만들기 (결정13)', () => {
  it('2026년 11월 화·목 → 화 4번 + 목 4번 = 8번', () => {
    const sessions = monthSessions(tueThu19, '2026-11');
    expect(sessions).toHaveLength(8);
    expect(sessions[0]).toEqual({
      date: '2026-11-03',
      startTime: '19:00',
      endTime: '21:00',
    });
    expect(sessions.at(-1)?.date).toBe('2026-11-26');
  });
});
