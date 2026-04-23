export const ARTICLE_LIST_PER_PAGE = 9
export const ARTICLE_LIST_MAX_PER_PAGE = 24
export const SEARCH_RESULTS_PER_PAGE = 20

export function normalizePositiveInteger(
  value: number | null | undefined,
  fallback = 1,
): number {
  return Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : fallback
}

export function normalizeArticleListPerPage(value: number | null | undefined): number {
  return Math.min(
    normalizePositiveInteger(value, ARTICLE_LIST_PER_PAGE),
    ARTICLE_LIST_MAX_PER_PAGE,
  )
}
