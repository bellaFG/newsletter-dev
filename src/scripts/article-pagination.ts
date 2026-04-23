declare global {
  interface Window {
    __devpulseArticlePaginationInitialized?: boolean
  }
}

type ArticleCardItem = {
  href: string
  title: string
  summary: string
  primarySourceLabel: string
  sourceCount: number
  readingTimeMin: number | null
  recencyLabel: string
}

type ArticlePaginationResponse = {
  items: ArticleCardItem[]
  page: number
  totalPages: number
  hasPrevious: boolean
  hasMore: boolean
}

const articleRequests = new WeakMap<HTMLElement, AbortController>()

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entityMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }

    return entityMap[char] ?? char
  })
}

function buildPageHref(root: HTMLElement, page: number) {
  const path = root.dataset.articlePaginationPath || window.location.pathname
  return page <= 1 ? path : `${path}?page=${page}`
}

function renderArticleCard(item: ArticleCardItem) {
  const sourceLabel =
    item.sourceCount > 1
      ? `${escapeHtml(item.primarySourceLabel)} · ${item.sourceCount} fontes`
      : escapeHtml(item.primarySourceLabel)

  return `
    <a
      href="${escapeHtml(item.href)}"
      class="group block border border-foreground/10 bg-background/70 p-5 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-link/40"
    >
      <h3 class="mb-2 font-serif text-lg font-bold leading-snug transition-colors group-hover:text-link">
        ${escapeHtml(item.title)}
      </h3>
      <p class="mb-3 line-clamp-2 text-sm leading-relaxed text-foreground/60">
        ${escapeHtml(item.summary)}
      </p>
      <div class="flex items-center justify-between font-mono text-[0.5rem] text-muted-foreground">
        <span class="text-link">
          ${sourceLabel}
        </span>
        <div class="flex items-center gap-2">
          ${item.readingTimeMin ? `<span>${item.readingTimeMin} min</span>` : ''}
          <span class="text-link">${escapeHtml(item.recencyLabel)}</span>
        </div>
      </div>
    </a>
  `
}

function updatePaginationLink(
  root: HTMLElement,
  direction: 'prev' | 'next',
  enabled: boolean,
  page: number,
) {
  const link = root.querySelector<HTMLAnchorElement>(`[data-article-page-link="${direction}"]`)
  if (!link) return

  link.dataset.articlePage = String(page)
  link.href = buildPageHref(root, page)
  link.setAttribute('aria-disabled', enabled ? 'false' : 'true')
  link.classList.toggle('pointer-events-none', !enabled)
  link.classList.toggle('text-muted-foreground/40', !enabled)

  if (direction === 'prev') {
    link.classList.toggle('text-muted-foreground', enabled)
    link.classList.toggle('hover:text-foreground', enabled)
  } else {
    link.classList.toggle('text-link', enabled)
    link.classList.toggle('hover:opacity-70', enabled)
  }
}

function updateArticlePaginationUi(root: HTMLElement, payload: ArticlePaginationResponse) {
  const grid = root.querySelector<HTMLElement>('[data-article-grid]')
  const indicator = root.querySelector<HTMLElement>('[data-article-page-indicator]')
  const summary = document.querySelector<HTMLElement>('[data-article-page-summary]')

  if (grid) {
    grid.innerHTML = payload.items.map(renderArticleCard).join('')
  }

  if (indicator) {
    indicator.textContent = `${payload.page} / ${payload.totalPages}`
  }

  if (summary) {
    summary.textContent = `Página ${payload.page} de ${payload.totalPages}`
  }

  root.dataset.articlePaginationCurrentPage = String(payload.page)
  root.dataset.articlePaginationTotalPages = String(payload.totalPages)

  updatePaginationLink(root, 'prev', payload.hasPrevious, Math.max(1, payload.page - 1))
  updatePaginationLink(root, 'next', payload.hasMore, Math.min(payload.totalPages, payload.page + 1))
}

function setArticlePaginationLoading(root: HTMLElement, isLoading: boolean) {
  const grid = root.querySelector<HTMLElement>('[data-article-grid]')
  root.setAttribute('aria-busy', isLoading ? 'true' : 'false')
  grid?.classList.toggle('opacity-60', isLoading)
}

async function loadArticlePage(root: HTMLElement, page: number) {
  const endpoint = root.dataset.articlePaginationEndpoint
  const perPage = Number(root.dataset.articlePaginationPerPage ?? '9')

  if (!endpoint) return

  articleRequests.get(root)?.abort()
  const controller = new AbortController()
  articleRequests.set(root, controller)
  setArticlePaginationLoading(root, true)

  try {
    const response = await fetch(
      `${endpoint}?page=${page}&perPage=${Number.isFinite(perPage) && perPage > 0 ? perPage : 9}`,
      { signal: controller.signal },
    )
    const data = (await response.json()) as Partial<ArticlePaginationResponse> & { error?: string }

    if (!response.ok) {
      throw new Error(data.error || 'Falha ao carregar artigos.')
    }

    updateArticlePaginationUi(root, {
      items: Array.isArray(data.items) ? (data.items as ArticleCardItem[]) : [],
      page: Number(data.page ?? page) || page,
      totalPages: Number(data.totalPages ?? 1) || 1,
      hasPrevious: Boolean(data.hasPrevious),
      hasMore: Boolean(data.hasMore),
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') return

    const fallbackHref = buildPageHref(root, page)
    window.location.assign(fallbackHref)
  } finally {
    setArticlePaginationLoading(root, false)
  }
}

function bindArticlePagination() {
  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return

    const link = target.closest<HTMLAnchorElement>('[data-article-page-link]')
    if (!link) return

    const root = link.closest<HTMLElement>('[data-article-pagination-root]')
    if (!root) return

    if (link.getAttribute('aria-disabled') === 'true') {
      event.preventDefault()
      return
    }

    const nextPage = Number(link.dataset.articlePage ?? '')
    if (!Number.isFinite(nextPage) || nextPage < 1) return

    event.preventDefault()
    void loadArticlePage(root, nextPage)
  })
}

if (!window.__devpulseArticlePaginationInitialized) {
  window.__devpulseArticlePaginationInitialized = true
  bindArticlePagination()
}

export {}
