import {
  refundAmount,
  siblingDiscount,
  siblingOrders,
} from './payment-rules.js';

describe('형제 할인 (결정9)', () => {
  it('등록순 두 번째 학생부터 10%', () => {
    const order = siblingOrders([
      { id: 2, registeredAt: '2026-03-03' },
      { id: 1, registeredAt: '2025-03-02' },
    ]);
    expect(order.get(1)).toBe(1);
    expect(order.get(2)).toBe(2);
    expect(siblingDiscount(280000, order.get(1)!)).toBe(0);
    expect(siblingDiscount(280000, order.get(2)!)).toBe(28000);
  });
});

describe('환불 (D20, 결정12) — 월 280,000원, 수업 8회', () => {
  const base = { charged: 280000, totalSessions: 8 };

  it('수업 시작 전이면 전액', () => {
    expect(refundAmount({ ...base, passedSessions: 0 }).amount).toBe(280000);
  });

  it('2회 지남(1/4) → 1/3 전이라 2/3 = 186,666원', () => {
    expect(refundAmount({ ...base, passedSessions: 2 }).amount).toBe(186666);
  });

  it('3회 지남(3/8) → 1/2 전이라 1/2 = 140,000원', () => {
    expect(refundAmount({ ...base, passedSessions: 3 }).amount).toBe(140000);
  });

  it('4회 지남(1/2) → 환불 없음', () => {
    expect(refundAmount({ ...base, passedSessions: 4 }).amount).toBe(0);
  });

  it('형제 할인된 252,000원을 냈고 1회 지남 → 168,000원', () => {
    expect(
      refundAmount({ charged: 252000, totalSessions: 8, passedSessions: 1 })
        .amount,
    ).toBe(168000);
  });
});
