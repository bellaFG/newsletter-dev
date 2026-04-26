import { THEME_STORAGE_KEY } from '@/lib/config'
import { formatEditionNumber } from '@/lib/date'
import { isValidEmailAddress, normalizeEmailAddress } from '@/lib/email'

declare global {
  interface Window {
    __devpulseSiteShellInitialized?: boolean
  }
}

let lastFocusedElement: HTMLElement | null = null
let modalCloseTimer = 0
let searchDebounceTimer = 0
let searchAbortController: AbortController | null = null
let currentSearchPage = 1
let navigationPending = false

function queryElement<T extends Element>(selector: string, root: ParentNode = document): T | null {
  return root.querySelector(selector) as T | null
}

function getModalElements() {
  return {
    modal: queryElement<HTMLElement>('#subscribe-modal'),
    overlay: queryElement<HTMLElement>('#subscribe-overlay'),
    card: queryElement<HTMLElement>('#subscribe-card'),
    form: queryElement<HTMLFormElement>('#subscribe-form'),
    msg: queryElement<HTMLElement>('#subscribe-msg'),
    formContent: queryElement<HTMLElement>('#subscribe-form-content'),
    successContent: queryElement<HTMLElement>('#subscribe-success'),
    submitBtn: queryElement<HTMLButtonElement>('[data-subscribe-submit]'),
  }
}

function getSearchElements() {
  const homeInput = queryElement<HTMLInputElement>('[data-home-search-input]')

  if (homeInput) {
    return {
      kind: 'home' as const,
      header: queryElement<HTMLElement>('[data-site-header]'),
      panel: null,
      input: homeInput,
      results: queryElement<HTMLElement>('[data-home-search-results]'),
      meta: queryElement<HTMLElement>('[data-home-search-meta]'),
    }
  }

  return {
    kind: 'nav' as const,
    header: queryElement<HTMLElement>('[data-site-header]'),
    panel: queryElement<HTMLElement>('[data-search-panel]'),
    input: queryElement<HTMLInputElement>('[data-nav-search-input]'),
    results: queryElement<HTMLElement>('[data-nav-search-results]'),
    meta: queryElement<HTMLElement>('[data-nav-search-meta]'),
  }
}

function setRouteReady(isReady: boolean) {
  document.documentElement.dataset.routeReady = isReady ? 'true' : 'false'
}

function runRouteEntrance() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setRouteReady(true)
    })
  })
}

function getPreferredTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY)

  if (saved === 'dark' || saved === 'light') {
    return saved
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(targetDocument: Document = document) {
  const theme = getPreferredTheme()
  const isDark = theme === 'dark'
  const root = targetDocument.documentElement

  root.classList.toggle('dark', isDark)
  root.style.colorScheme = theme

  return theme
}

function updateThemeToggle() {
  const html = document.documentElement
  const themeToggle = queryElement<HTMLElement>('#theme-toggle')
  const moonIcon = themeToggle?.querySelector<HTMLElement>('[data-theme-icon="moon"]')
  const sunIcon = themeToggle?.querySelector<HTMLElement>('[data-theme-icon="sun"]')
  const themeLabel = queryElement<HTMLElement>('#theme-label')
  const isDark = html.classList.contains('dark')

  moonIcon?.classList.toggle('hidden', isDark)
  sunIcon?.classList.toggle('hidden', !isDark)
  themeToggle?.setAttribute('aria-label', isDark ? 'Ativar tema claro' : 'Ativar tema escuro')

  if (themeLabel) {
    themeLabel.textContent = isDark ? 'Ativar tema claro' : 'Ativar tema escuro'
  }
}

function toggleTheme() {
  const nowDark = !document.documentElement.classList.contains('dark')
  localStorage.setItem(THEME_STORAGE_KEY, nowDark ? 'dark' : 'light')
  applyTheme()
  updateThemeToggle()
}

function setPageInert(isInert: boolean) {
  const pageShell = queryElement<HTMLElement>('#page-shell')
  if (!pageShell) return

  if (isInert) {
    pageShell.setAttribute('inert', '')
    pageShell.setAttribute('aria-hidden', 'true')
  } else {
    pageShell.removeAttribute('inert')
    pageShell.removeAttribute('aria-hidden')
  }
}

function isModalOpen() {
  const { modal } = getModalElements()
  return Boolean(modal && !modal.classList.contains('hidden'))
}

function getFocusableModalElements() {
  const { card } = getModalElements()
  if (!card) return []

  return Array.from(
    card.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => {
    if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') {
      return false
    }

    if (element.tabIndex < 0) {
      return false
    }

    if (
      element instanceof HTMLInputElement &&
      (element.type === 'hidden' || element.name === 'website')
    ) {
      return false
    }

    return true
  })
}

function resetModalState() {
  const { form, formContent, successContent, submitBtn, msg } = getModalElements()

  form?.reset()
  formContent?.classList.remove('hidden')
  successContent?.classList.add('hidden')
  submitBtn?.removeAttribute('disabled')

  if (msg) {
    msg.textContent = ''
    msg.className = 'mt-3 text-sm font-mono text-center hidden'
  }
}

function openModal(source?: HTMLElement | null) {
  const { modal, overlay, card, form } = getModalElements()
  if (!modal || !overlay || !card) return

  window.clearTimeout(modalCloseTimer)
  lastFocusedElement = source ?? (document.activeElement as HTMLElement | null)
  resetModalState()
  modal.classList.remove('hidden')
  document.body.classList.add('overflow-hidden')
  setPageInert(true)

  requestAnimationFrame(() => {
    overlay.classList.remove('opacity-0')
    overlay.classList.add('opacity-100')
    card.classList.remove('translate-y-4', 'opacity-0')
    card.classList.add('translate-y-0', 'opacity-100')
    ;(form?.elements.namedItem('email') as HTMLInputElement | null)?.focus()
  })
}

function closeModal() {
  const { modal, overlay, card } = getModalElements()
  if (!modal || !overlay || !card) return

  overlay.classList.remove('opacity-100')
  overlay.classList.add('opacity-0')
  card.classList.remove('translate-y-0', 'opacity-100')
  card.classList.add('translate-y-4', 'opacity-0')

  modalCloseTimer = window.setTimeout(() => {
    modal.classList.add('hidden')
    document.body.classList.remove('overflow-hidden')
    setPageInert(false)
    lastFocusedElement?.focus()
  }, 300)
}

function updateSearchToggleState(isOpen: boolean) {
  document.querySelectorAll<HTMLElement>('[data-search-toggle]').forEach((button) => {
    button.dataset.searchOpen = isOpen ? 'true' : 'false'
    button.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
  })
}

function closeCategoryMenus(target?: Element) {
  document.querySelectorAll<HTMLDetailsElement>('[data-category-menu][open]').forEach((menu) => {
    if (target && menu.contains(target)) return
    menu.open = false
  })
}

function clearSearchResults() {
  const { results, meta } = getSearchElements()

  searchAbortController?.abort()
  searchAbortController = null
  currentSearchPage = 1

  if (results) {
    results.classList.add('hidden')
    results.innerHTML = ''
    results.setAttribute('aria-busy', 'false')
  }

  if (meta) {
    meta.textContent = ''
    meta.classList.add('hidden')
  }
}

function isSearchPanelOpen() {
  const { panel } = getSearchElements()
  return panel?.dataset.open === 'true'
}

function setSearchPanelOpen(
  isOpen: boolean,
  options: { focusInput?: boolean; keepResults?: boolean } = {},
) {
  const { panel, input } = getSearchElements()
  if (!panel) return

  panel.dataset.open = isOpen ? 'true' : 'false'
  panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true')
  updateSearchToggleState(isOpen)

  if (!isOpen && !options.keepResults && !input?.value.trim()) {
    clearSearchResults()
  }

  if (isOpen && options.focusInput) {
    requestAnimationFrame(() => {
      input?.focus()
      input?.select()
    })
  }
}

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

function renderSearchSkeletons() {
  const { results, meta } = getSearchElements()
  if (!results) return

  if (meta) {
    meta.textContent = 'Buscando no acervo'
    meta.classList.remove('hidden')
  }

  results.innerHTML = `
    <div class="space-y-3" aria-hidden="true">
      ${Array.from({ length: 3 })
        .map(
          () => `
            <div class="border border-foreground/10 p-4 animate-pulse motion-reduce:animate-none">
              <div class="mb-3 h-3 w-32 bg-foreground/10"></div>
              <div class="mb-3 h-6 w-4/5 bg-foreground/10"></div>
              <div class="mb-2 h-4 w-full bg-foreground/10"></div>
              <div class="h-4 w-3/4 bg-foreground/10"></div>
            </div>
          `,
        )
        .join('')}
    </div>
  `
  results.classList.remove('hidden')
  results.setAttribute('aria-busy', 'true')
}

function renderSearchMessage(message: string, tone: 'default' | 'error' = 'default') {
  const { results, meta } = getSearchElements()
  if (!results) return

  if (meta) {
    meta.textContent = ''
    meta.classList.add('hidden')
  }

  const toneClass = tone === 'error' ? 'text-destructive' : 'text-muted-foreground'

  results.innerHTML = `
    <p class="px-1 py-3 text-center font-mono text-[0.6rem] uppercase tracking-widest ${toneClass}">
      ${escapeHtml(message)}
    </p>
  `
  results.classList.remove('hidden')
  results.setAttribute('aria-busy', 'false')
}

function renderSearchResults(
  query: string,
  page: number,
  resultsData: any[],
  hasPrevious: boolean,
  hasMore: boolean,
) {
  const { results, meta } = getSearchElements()
  if (!results) return

  const items = resultsData
    .map((result) => {
      const title = escapeHtml(String(result.title ?? ''))
      const summary = escapeHtml(String(result.summary ?? ''))
      const excerpt = escapeHtml(String(result.excerpt ?? ''))
      const category = escapeHtml(String(result.category ?? ''))
      const primarySource = escapeHtml(String(result.primarySource ?? ''))
      const editionSlug = escapeHtml(String(result.edition?.slug ?? ''))
      const articleSlug = escapeHtml(String(result.slug ?? ''))
      const editionNumber = formatEditionNumber(Number(result.edition?.edition_number ?? 0))
      const sourceLabel =
        Number(result.sourceCount ?? 1) > 1
          ? `${Number(result.sourceCount)} fontes`
          : primarySource

      return `
        <a
          href="/edicao/${editionSlug}/${articleSlug}"
          class="group block border border-foreground/10 bg-background/70 px-4 py-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-link/45"
        >
          <div class="mb-2 flex flex-wrap items-center gap-2 font-mono text-[0.52rem] uppercase tracking-[0.2em] text-muted-foreground">
            <span class="text-link">#${editionNumber}</span>
            <span>${category}</span>
            <span>&middot;</span>
            <span>${escapeHtml(sourceLabel)}</span>
          </div>
          <h3 class="mb-2 font-serif text-xl font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-link">
            ${title}
          </h3>
          <p class="mb-2 text-sm leading-relaxed text-foreground/75">${summary}</p>
          <p class="text-sm leading-relaxed text-foreground/55">${excerpt}</p>
        </a>
      `
    })
    .join('')

  const paginationMarkup =
    hasPrevious || hasMore
      ? `
          <div class="flex items-center justify-center gap-3 pt-2 font-mono text-[0.55rem] uppercase tracking-widest">
            <button
              type="button"
              data-search-page="prev"
              class="text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-30"
              ${hasPrevious ? '' : 'disabled'}
            >
              &larr; Anterior
            </button>
            <span class="text-muted-foreground">Página ${page}</span>
            <button
              type="button"
              data-search-page="next"
              class="text-link transition-opacity hover:opacity-70 disabled:cursor-default disabled:opacity-30"
              ${hasMore ? '' : 'disabled'}
            >
              Próxima &rarr;
            </button>
          </div>
        `
      : ''

  if (meta) {
    meta.textContent = `${resultsData.length} resultado${resultsData.length === 1 ? '' : 's'} para "${query}"`
    meta.classList.remove('hidden')
  }

  results.innerHTML = `
    <div class="space-y-3">
      ${items}
      ${paginationMarkup}
    </div>
  `
  results.classList.remove('hidden')
  results.setAttribute('aria-busy', 'false')
}

async function loadSearchResults(page: number, providedQuery?: string) {
  const { input, results } = getSearchElements()
  if (!input || !results) return

  const currentQuery = (providedQuery ?? input.value).trim()
  if (!currentQuery) {
    clearSearchResults()
    return
  }

  searchAbortController?.abort()
  searchAbortController = new AbortController()
  currentSearchPage = Math.max(1, page)
  renderSearchSkeletons()

  try {
    const response = await fetch(
      `/api/search?q=${encodeURIComponent(currentQuery.toLowerCase())}&page=${currentSearchPage}`,
      { signal: searchAbortController.signal },
    )
    const data = await response.json()

    if (!response.ok) {
      throw new Error(typeof data?.error === 'string' ? data.error : 'Falha ao buscar no acervo.')
    }

    const normalizedPage = Number(data.page ?? currentSearchPage) || currentSearchPage
    const resultsData = Array.isArray(data.results) ? data.results : []
    const hasMore = Boolean(data.hasMore)
    const hasPrevious = Boolean(data.hasPrevious)

    currentSearchPage = normalizedPage

    if (resultsData.length === 0) {
      const pageSuffix = normalizedPage > 1 ? ` na página ${normalizedPage}` : ''
      renderSearchMessage(`Nenhum resultado${pageSuffix} para "${currentQuery}".`)
      return
    }

    renderSearchResults(currentQuery, normalizedPage, resultsData, hasPrevious, hasMore)
  } catch (error) {
    if ((error as Error).name === 'AbortError') return
    renderSearchMessage((error as Error).message || 'Falha ao buscar no acervo.', 'error')
  }
}

function syncSearchFromUrl() {
  const { input, panel } = getSearchElements()
  if (!input) return

  const url = new URL(window.location.href)
  const query = url.searchParams.get('q')?.trim() ?? ''
  const requestedPage = Number(url.searchParams.get('searchPage') ?? '1')
  const page =
    Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1

  if (!query) {
    input.value = ''
    clearSearchResults()
    if (panel) {
      setSearchPanelOpen(false)
    }
    return
  }

  input.value = query
  if (panel) {
    setSearchPanelOpen(true)
  }
  void loadSearchResults(page, query)
}

async function handleSubscribeSubmit(form: HTMLFormElement) {
  const { msg, formContent, successContent, submitBtn } = getModalElements()
  const email = normalizeEmailAddress((form.elements.namedItem('email') as HTMLInputElement).value)
  const website = (form.elements.namedItem('website') as HTMLInputElement | null)?.value ?? ''

  if (!isValidEmailAddress(email)) {
    if (msg) {
      msg.classList.remove('hidden')
      msg.textContent = 'Digite um email válido.'
      msg.className = 'mt-3 text-sm font-mono text-center text-destructive'
    }
    return
  }

  submitBtn?.setAttribute('disabled', 'true')

  try {
    const response = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, website }),
    })
    const data = await response.json()

    if (response.ok) {
      formContent?.classList.add('hidden')
      successContent?.classList.remove('hidden')
    } else if (msg) {
      msg.classList.remove('hidden')
      msg.textContent = data.error ?? 'Erro ao inscrever. Tente novamente.'
      msg.className = 'mt-3 text-sm font-mono text-center text-destructive'
    }
  } catch {
    if (msg) {
      msg.classList.remove('hidden')
      msg.textContent = 'Erro de conexão. Tente novamente.'
      msg.className = 'mt-3 text-sm font-mono text-center text-destructive'
    }
  } finally {
    submitBtn?.removeAttribute('disabled')
  }
}

function bindGlobalHandlers() {
  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return

    const themeToggle = target.closest('#theme-toggle')
    if (themeToggle instanceof HTMLElement) {
      event.preventDefault()
      toggleTheme()
      closeCategoryMenus()
      return
    }

    const subscribeOpen = target.closest('[data-subscribe-open], #subscribe-open-btn')
    if (subscribeOpen instanceof HTMLElement) {
      event.preventDefault()
      closeCategoryMenus()
      openModal(subscribeOpen)
      return
    }

    const modal = target.closest('#subscribe-modal')
    const modalCard = target.closest('#subscribe-card')
    if (target.closest('#subscribe-close-btn') || (isModalOpen() && modal && !modalCard)) {
      event.preventDefault()
      closeModal()
      return
    }

    closeCategoryMenus(target)

    const searchToggle = target.closest('[data-search-toggle]')
    if (searchToggle instanceof HTMLElement) {
      event.preventDefault()
      const shouldOpen = !isSearchPanelOpen()
      setSearchPanelOpen(shouldOpen, { focusInput: shouldOpen, keepResults: true })

      if (shouldOpen) {
        const { input } = getSearchElements()
        const query = input?.value.trim()
        if (query) {
          currentSearchPage = 1
          void loadSearchResults(1, query)
        }
      }
      return
    }

    if (target.closest('[data-search-close]')) {
      event.preventDefault()
      setSearchPanelOpen(false, { keepResults: true })
      return
    }

    const paginationButton = target.closest('[data-search-page]')
    if (paginationButton instanceof HTMLButtonElement && !paginationButton.disabled) {
      event.preventDefault()
      const direction = paginationButton.dataset.searchPage === 'next' ? 1 : -1
      void loadSearchResults(Math.max(1, currentSearchPage + direction))
      return
    }

    const { header } = getSearchElements()
    if (isSearchPanelOpen() && header && !header.contains(target)) {
      setSearchPanelOpen(false, { keepResults: true })
    }
  })

  document.addEventListener('submit', (event) => {
    const target = event.target
    if (!(target instanceof HTMLFormElement)) return

    if (target.matches('[data-nav-search-form], [data-home-search-form]')) {
      event.preventDefault()
      const query =
        queryElement<HTMLInputElement>('[data-nav-search-input], [data-home-search-input]', target)
          ?.value.trim() ?? ''

      if (!query) {
        clearSearchResults()
        return
      }

      if (getSearchElements().panel) {
        setSearchPanelOpen(true, { keepResults: true })
      }
      currentSearchPage = 1
      void loadSearchResults(1, query)
      return
    }

    if (target.id === 'subscribe-form') {
      event.preventDefault()
      void handleSubscribeSubmit(target)
    }
  })

  document.addEventListener('input', (event) => {
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return
    if (!target.matches('[data-nav-search-input], [data-home-search-input]')) return

    window.clearTimeout(searchDebounceTimer)
    searchDebounceTimer = window.setTimeout(() => {
      const query = target.value.trim()
      currentSearchPage = 1

      if (!query) {
        clearSearchResults()
        return
      }

      if (getSearchElements().panel) {
        setSearchPanelOpen(true, { keepResults: true })
      }
      void loadSearchResults(1, query)
    }, 220)
  })

  document.addEventListener('keydown', (event) => {
    if (isModalOpen()) {
      if (event.key === 'Escape') {
        closeModal()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = getFocusableModalElements()
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (!event.shiftKey && active === last) {
        event.preventDefault()
        first?.focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last?.focus()
      }
      return
    }

    if (event.key === 'Escape' && isSearchPanelOpen()) {
      setSearchPanelOpen(false, { keepResults: true })
    }
  })

  document.addEventListener('astro:before-preparation', () => {
    navigationPending = true
    setRouteReady(false)
    if (isSearchPanelOpen()) {
      setSearchPanelOpen(false, { keepResults: true })
    }
  })

  document.addEventListener('astro:before-swap', (event) => {
    const incomingDocument = (event as Event & { newDocument?: Document }).newDocument
    if (incomingDocument) {
      applyTheme(incomingDocument)
    }
  })

  document.addEventListener('astro:after-swap', () => {
    applyTheme()
  })

  document.addEventListener('astro:page-load', () => {
    applyTheme()
    updateThemeToggle()
    syncSearchFromUrl()

    if (navigationPending) {
      navigationPending = false
      runRouteEntrance()
    }
  })
}

if (!window.__devpulseSiteShellInitialized) {
  window.__devpulseSiteShellInitialized = true
  bindGlobalHandlers()
  applyTheme()
  updateThemeToggle()
  syncSearchFromUrl()
  setRouteReady(true)
}

export {}
