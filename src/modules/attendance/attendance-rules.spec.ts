import {
  attendanceRate,
  makeupProblem,
  type MakeupCheckInput,
} from './attendance-rules.js';

describe('출석률 (C13, 결정10)', () => {
  it('지각 3번 = 결석 1번', () => {
    expect(attendanceRate({ 출석: 9, 지각: 3, 결석: 0 })).toEqual({
      total: 12,
      convertedAbsence: 1,
      rate: 92,
    });
  });

  it('지각 2번은 아직 결석이 아니다', () => {
    expect(attendanceRate({ 출석: 6, 지각: 2, 결석: 0 }).convertedAbsence).toBe(
      0,
    );
  });

  it('수업이 없으면 출석률을 비운다', () => {
    expect(attendanceRate({ 출석: 0, 지각: 0, 결석: 0 }).rate).toBeNull();
  });
});

describe('보강 조건 (B11, 결정11)', () => {
  const ok: MakeupCheckInput = {
    absence: {
      date: '2026-11-04',
      status: '결석',
      attendType: '수강',
      classId: 2,
      targetGrade: 8,
    },
    absencesInMonth: 2,
    target: {
      date: '2026-11-11',
      classId: 3,
      targetGrade: 8,
      status: '정상',
      capacity: 8,
      headcount: 7,
    },
    studentBusy: false,
    today: '2026-11-05',
  };

  it('조건을 다 맞으면 통과', () => {
    expect(makeupProblem(ok)).toBeNull();
  });

  it('그 달 결석이 2회 미만이면 거절', () => {
    expect(makeupProblem({ ...ok, absencesInMonth: 1 })).toMatch(/2회 미만/);
  });

  it('B11 그날 인원(원래+보강)이 정원이면 거절', () => {
    expect(
      makeupProblem({ ...ok, target: { ...ok.target, headcount: 8 } }),
    ).toBe('그날 인원이 정원(8명)을 넘어요.');
  });

  it('결석한 달을 넘기면 거절', () => {
    expect(
      makeupProblem({ ...ok, target: { ...ok.target, date: '2026-12-01' } }),
    ).toMatch(/결석한 달/);
  });

  it('보강 수업에서 결석한 것으로는 다시 보강할 수 없다 (QA BUG-004)', () => {
    expect(
      makeupProblem({ ...ok, absence: { ...ok.absence, attendType: '보강' } }),
    ).toMatch(/보강 수업 결석/);
  });

  it('학년이 다른 반이면 거절', () => {
    expect(
      makeupProblem({ ...ok, target: { ...ok.target, targetGrade: 7 } }),
    ).toMatch(/같은 학년/);
  });
});
