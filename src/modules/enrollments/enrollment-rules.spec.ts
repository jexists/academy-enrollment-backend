import {
  checkEnrollment,
  type EnrollmentCheckInput,
} from './enrollment-rules.js';

const base: EnrollmentCheckInput = {
  studentGrade: 8,
  cls: {
    name: '중2 심화A',
    targetGrade: 8,
    capacity: 8,
    isActive: true,
    schedules: [
      { weekday: 2, startTime: '19:00', endTime: '21:00' },
      { weekday: 4, startTime: '19:00', endTime: '21:00' },
    ],
  },
  enrolled: 6,
  duplicate: false,
  others: [],
};

describe('수강 신청 규칙', () => {
  it('학년이 맞고 자리가 있고 시간이 안 겹치면 통과', () => {
    expect(checkEnrollment(base)).toEqual({ code: '통과', message: null });
  });

  it('B8 학년이 다르면 거절', () => {
    expect(checkEnrollment({ ...base, studentGrade: 7 })).toEqual({
      code: '학년 불일치',
      message: '신청할 수 없어요. 중2 반이에요 (학생은 중1)',
    });
  });

  it('B7 정원이 차면 거절 (원장 인터뷰: 9명째를 받아 버림)', () => {
    expect(checkEnrollment({ ...base, enrolled: 8 })).toEqual({
      code: '정원 초과',
      message: '신청할 수 없어요. 정원(8명)이 찼어요',
    });
  });

  it('B6 같은 반에 이미 진행 중이면 거절', () => {
    expect(checkEnrollment({ ...base, duplicate: true }).code).toBe('중복');
  });

  it('결정5 같은 학생이 같은 시간에 다른 반이면 거절', () => {
    const result = checkEnrollment({
      ...base,
      others: [
        {
          className: '중2 서술형',
          schedules: [{ weekday: 2, startTime: '20:00', endTime: '22:00' }],
        },
      ],
    });
    expect(result).toEqual({
      code: '시간 겹침',
      message: '신청할 수 없어요. 시간이 겹쳐요 (중2 서술형 화 20:00)',
    });
  });
});
