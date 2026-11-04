/** 강사 소개(결정41) 규칙 — 소개 300자, 이력은 한 줄에 하나·최대 6줄·줄당 60자 */
export const BIO_MAX = 300;
export const CAREER_MAX_LINES = 6;
export const CAREER_LINE_MAX = 60;

/** 이력 칸 검사용: 빈 줄 없이 최대 6줄, 줄마다 60자 이하 */
export const CAREER_PATTERN = new RegExp(
  `^[^\\n]{1,${CAREER_LINE_MAX}}(\\n[^\\n]{1,${CAREER_LINE_MAX}}){0,${CAREER_MAX_LINES - 1}}$`,
);

/** 소개 글: 앞뒤 공백을 지우고, 비면 null */
export function normalizeBio(raw: string | null | undefined): string | null {
  const text = (raw ?? '').replace(/\r\n?/g, '\n').trim();
  return text === '' ? null : text;
}

/** 이력 글: 줄마다 공백을 지우고 빈 줄을 뺀 뒤 다시 잇는다. 비면 null */
export function normalizeCareer(raw: string | null | undefined): string | null {
  const lines = careerLines(raw);
  return lines.length === 0 ? null : lines.join('\n');
}

/** 화면용: 이력 글을 줄 목록으로 */
export function careerLines(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}
