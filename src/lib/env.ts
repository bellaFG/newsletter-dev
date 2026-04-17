/**
 * Validacao de variaveis de ambiente do servidor.
 * Falha rapido (fail-fast) se alguma variavel obrigatoria estiver ausente,
 * evitando erros obscuros em runtime nas chamadas ao Supabase/Resend.
 */

/**
 * Retorna o valor de uma variavel de ambiente ou lanca erro descritivo.
 * Usa `process.env` para compatibilidade com Astro SSR (server-side).
 *
 * @example
 * const url = requireEnv('SUPABASE_URL')
 */
export function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(
      `[env] Variavel de ambiente obrigatoria ausente: ${key}. ` +
        `Verifique seu arquivo .env.local ou as secrets do deploy.`,
    )
  }
  return value
}
