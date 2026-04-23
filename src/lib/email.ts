export const EMAIL_MAX_LENGTH = 254

export const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/

export function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase()
}

export function isValidEmailAddress(value: string): boolean {
  const normalized = normalizeEmailAddress(value)
  return normalized.length > 0 && normalized.length <= EMAIL_MAX_LENGTH && EMAIL_RE.test(normalized)
}
