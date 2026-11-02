// 데모용 가상 데이터. 와이어프레임 예시(김민준·김서연 형제, 중2 심화A 화·목 19시 등)와 같게 맞춘다.
// 이메일은 로컬 데모 로그인 버튼에서 쓴다. 비밀번호는 .env의 DEMO_PASSWORD (저장소에 적지 않음).

export const SEED_SCHOOLS = [
  { key: '한빛중', name: '한빛중학교', level: '중', region: '서울 강남구' },
  { key: '해운중', name: '해운중학교', level: '중', region: '부산 해운대구' },
  {
    key: '단대부중',
    name: '단국대학교사범대학부속중학교',
    level: '중',
    region: '서울 강남구',
  },
  { key: '대치중', name: '대치중학교', level: '중', region: '서울 강남구' },
  { key: '휘문고', name: '휘문고등학교', level: '고', region: '서울 강남구' },
] as const;

export const SEED_TEACHERS = [
  {
    key: '박강사',
    email: 'teacher1@naver.com',
    name: '박강사',
    subject: '중등 수학',
    hiredAt: '2024-02-01',
    isActive: true,
    mustChangePassword: false,
  },
  // 임시 비밀번호 상태 — 첫 로그인 때 비밀번호 변경 강제를 보여 준다 (공통8)
  {
    key: '최강사',
    email: 'teacher2@naver.com',
    name: '최강사',
    subject: '중등·고등 수학',
    hiredAt: '2025-08-15',
    isActive: true,
    mustChangePassword: true,
  },
  // 사용 중지 — 로그인이 막히는 것을 보여 준다 (공통7)
  {
    key: '윤강사',
    email: 'teacher3@naver.com',
    name: '윤강사',
    subject: '중등 수학',
    hiredAt: '2023-03-01',
    isActive: false,
    mustChangePassword: false,
  },
] as const;

/** weekday: 0 = 일요일 ... 6 = 토요일 */
export const SEED_CLASSES = [
  {
    name: '중1 기본A',
    targetGrade: 7,
    teacher: '박강사',
    capacity: 8,
    monthlyFee: 280000,
    intro: '중1 교과 개념을 차근차근 다져요',
    days: [1, 3],
    start: '17:00',
    end: '19:00',
  },
  {
    name: '중2 심화A',
    targetGrade: 8,
    teacher: '박강사',
    capacity: 8,
    monthlyFee: 280000,
    intro: '서술형과 심화 문제를 집중해서 풀어요',
    days: [2, 4],
    start: '19:00',
    end: '21:00',
  },
  {
    name: '중2 기본B',
    targetGrade: 8,
    teacher: '최강사',
    capacity: 8,
    monthlyFee: 280000,
    intro: '중2 교과 개념과 유형을 익혀요',
    days: [1, 3],
    start: '17:00',
    end: '19:00',
  },
  {
    name: '고1 내신',
    targetGrade: 10,
    teacher: '최강사',
    capacity: 8,
    monthlyFee: 280000,
    intro: '고1 내신 시험을 대비해요',
    days: [2, 4],
    start: '17:00',
    end: '19:00',
  },
] as const;

interface SeedParent {
  email: string | null; // 없으면 계정 없이 연락처만 (결정33)
  name: string;
  relation: '부' | '모';
  phone: string;
}

interface SeedStudent {
  email: string;
  name: string;
  birthDate: string;
  registeredAt: string;
  schools: {
    school: string;
    changeType: '처음등록' | '전학' | '진학';
    enteredOn: string;
    effectiveFrom: string;
    memo?: string;
  }[];
}

export interface SeedFamily {
  name: string;
  parents: SeedParent[];
  students: SeedStudent[];
  notes: {
    student?: string;
    parent?: string;
    category: '상담' | '학습' | '생활' | '연락' | '결제' | '기타';
    notedOn: string;
    content: string;
    by: string;
  }[];
}

export const SEED_FAMILIES: SeedFamily[] = [
  {
    name: '김민준 가족',
    parents: [
      {
        email: 'parent1@naver.com',
        name: '김지은',
        relation: '모',
        phone: '010-1111-0000',
      },
    ],
    students: [
      {
        email: 'student1@naver.com',
        name: '김민준',
        birthDate: '2013-05-10',
        registeredAt: '2025-03-02',
        schools: [
          {
            school: '해운중',
            changeType: '처음등록',
            enteredOn: '2025-03-02',
            effectiveFrom: '2025-03-02',
          },
          {
            school: '한빛중',
            changeType: '전학',
            enteredOn: '2025-03-02',
            effectiveFrom: '2025-09-01',
            memo: '이사로 전학',
          },
        ],
      },
      {
        email: 'student2@naver.com',
        name: '김서연',
        birthDate: '2014-08-21',
        registeredAt: '2026-03-03',
        schools: [
          {
            school: '한빛중',
            changeType: '처음등록',
            enteredOn: '2026-03-03',
            effectiveFrom: '2026-03-03',
          },
        ],
      },
    ],
    notes: [
      {
        student: '김민준',
        category: '학습',
        notedOn: '2026-11-05',
        content: '서술형 약함, 11/22 보충 수업 권유',
        by: '박강사',
      },
      {
        category: '상담',
        notedOn: '2026-10-28',
        content: '엄마와 진로 상담 — 고1 내신반 희망',
        by: 'admin',
      },
      {
        parent: '김지은',
        category: '연락',
        notedOn: '2026-09-03',
        content: '평일 낮에는 문자만 가능',
        by: 'admin',
      },
    ],
  },
  {
    name: '이지호 가족',
    parents: [
      {
        email: 'parent2@naver.com',
        name: '박수진',
        relation: '모',
        phone: '010-2222-0000',
      },
    ],
    students: [
      {
        email: 'student3@naver.com',
        name: '이지호',
        birthDate: '2013-02-14',
        registeredAt: '2025-03-10',
        schools: [
          {
            school: '단대부중',
            changeType: '처음등록',
            enteredOn: '2025-03-03',
            effectiveFrom: '2025-03-03',
          },
        ],
      },
    ],
    notes: [
      {
        student: '이지호',
        category: '생활',
        notedOn: '2026-11-11',
        content: '최근 결석이 잦음, 학부모 상담 필요',
        by: '박강사',
      },
    ],
  },
  {
    name: '박하린 가족',
    parents: [
      {
        email: 'parent3@naver.com',
        name: '박정우',
        relation: '부',
        phone: '010-3333-0000',
      },
      { email: null, name: '이미영', relation: '모', phone: '010-3333-1111' },
    ],
    students: [
      {
        email: 'student4@naver.com',
        name: '박하린',
        birthDate: '2013-11-30',
        registeredAt: '2025-04-01',
        schools: [
          {
            school: '대치중',
            changeType: '처음등록',
            enteredOn: '2025-03-03',
            effectiveFrom: '2025-03-03',
          },
        ],
      },
    ],
    notes: [],
  },
];
