/**
 * Funcoes de formatacao de datas em pt-BR.
 * Centraliza os padroes de exibicao usados nas paginas e no template de email.
 */

function toDate(input: Date | string): Date {
  return typeof input === 'string' ? new Date(input) : input
}

/**
 * Data completa com dia da semana.
 * @example formatFullDate('2025-04-14') // "segunda-feira, 14 de abril de 2025"
 */
export function formatFullDate(date: Date | string): string {
  return toDate(date).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Data media sem dia da semana.
 * @example formatMediumDate('2025-04-14') // "14 de abril de 2025"
 */
export function formatMediumDate(date: Date | string): string {
  return toDate(date).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Data curta com mes abreviado.
 * @example formatShortDate('2025-04-14') // "14 abr. 2025"
 */
export function formatShortDate(date: Date | string): string {
  return toDate(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Data compacta sem ano.
 * @example formatCompactDate('2025-04-14') // "14 abr."
 */
export function formatCompactDate(date: Date | string): string {
  return toDate(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

/**
 * Numero de edicao com zero-padding (3 digitos).
 * @example formatEditionNumber(1) // "001"
 * @example formatEditionNumber(42) // "042"
 */
export function formatEditionNumber(n: number): string {
  return String(n).padStart(3, '0')
}
