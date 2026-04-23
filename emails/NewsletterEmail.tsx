/**
 * Template de email da newsletter DevPulse.
 *
 * Layout espelha a pagina da edicao no site (edicao/[slug]/index.astro).
 * Fundo branco (Gmail) + folha com fundo do site (paper).
 * Usa inline styles (obrigatorio para compatibilidade com clientes de email).
 *
 * Design system compartilhado com o site:
 * - Links sempre azuis
 * - Datas e metadados temporais em azul
 * - Botao principal: borda azul + hover preenchido
 * - Botao secundario (fonte original): apenas borda, sem preenchimento
 */

import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'
import type { Article, Edition } from '../src/lib/types'
import { getOrderedCategories, getPrimarySource, groupByCategory } from '../src/lib/articles'
import { getEditionDisplayDate } from '../src/lib/editions'
import { formatFullDate, formatEditionNumber } from '../src/lib/date'
import { SITE_NAME } from '../src/lib/config'

interface NewsletterEmailProps {
  edition: Edition
  articles: Article[]
  unsubscribeUrl: string
  siteUrl: string
}

const serif = "Georgia, 'Times New Roman', Times, serif"
const mono = "Menlo, Consolas, 'Courier New', monospace"
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"

// Cores — alinhadas com o site (oklch convertido para hex)
const ink = '#1a1816' // --foreground
const muted = '#6b6662' // --muted-foreground
const bodyColor = '#3a3735' // foreground/85
const paper = '#faf8f5' // --background
const rule = '#e0ddd8' // --border
const blue = '#2563EB' // --link
const fgLight = '#8a8580' // foreground/40

function buildEditionUrl(siteUrl: string, edition: Pick<Edition, 'slug'>): string {
  return `${siteUrl}/edicao/${edition.slug}`
}

function buildArticleUrl(
  siteUrl: string,
  edition: Pick<Edition, 'slug'>,
  article: Pick<Article, 'slug'>
): string {
  return article.slug
    ? `${siteUrl}/edicao/${edition.slug}/${article.slug}`
    : buildEditionUrl(siteUrl, edition)
}

export function NewsletterEmail({
  edition,
  articles,
  unsubscribeUrl,
  siteUrl,
}: NewsletterEmailProps) {
  const grouped = groupByCategory(articles)
  const orderedCategories = getOrderedCategories(grouped)
  const editionDate = formatFullDate(getEditionDisplayDate(edition))
  const editionUrl = buildEditionUrl(siteUrl, edition)

  const previewText = edition.summary
    ? edition.summary.slice(0, 90)
    : `${articles.length} artigos selecionados para devs brasileiros esta semana.`

  return (
    <Html lang="pt-BR">
      <Head>
        <meta charSet="utf-8" />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: '#ffffff', margin: 0, padding: 0, fontFamily: sans }}>
        <Container style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
          <Section style={{ backgroundColor: paper, padding: '0', border: `1px solid ${rule}` }}>
            {/* -- MASTHEAD -- */}
            <Section style={{ padding: '16px 24px', borderBottom: `1px solid ${rule}` }}>
              <Row>
                <Column style={{ width: '33%' }}>
                  <Text
                    style={{
                      fontFamily: mono,
                      fontSize: 9,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: blue,
                      margin: 0,
                    }}
                  >
                    {editionDate}
                  </Text>
                </Column>
                <Column style={{ width: '34%', textAlign: 'center' }}>
                  <Link href={editionUrl} style={{ textDecoration: 'none' }}>
                    <Text
                      style={{
                        fontFamily: serif,
                        fontSize: 22,
                        fontWeight: 900,
                        letterSpacing: '-1px',
                        textTransform: 'uppercase',
                        color: ink,
                        margin: 0,
                        lineHeight: 1,
                      }}
                    >
                      {SITE_NAME}
                    </Text>
                  </Link>
                </Column>
                <Column style={{ width: '33%', textAlign: 'right' }}>
                  <Text
                    style={{
                      fontFamily: mono,
                      fontSize: 9,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: blue,
                      margin: 0,
                    }}
                  >
                    {'Edição #'}
                    {formatEditionNumber(edition.edition_number)}
                  </Text>
                </Column>
              </Row>
            </Section>

            {edition.summary && (
              <Section style={{ padding: '20px 24px 0' }}>
                <Text
                  style={{
                    fontFamily: sans,
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: bodyColor,
                    margin: 0,
                  }}
                >
                  {edition.summary}
                </Text>
              </Section>
            )}

            {/* -- ARTIGOS POR CATEGORIA -- */}
            {orderedCategories.map((cat) => {
              const catArticles = grouped[cat]!

              return (
                <Section key={cat} style={{ padding: '0 24px' }}>
                  {/* Divisor de categoria */}
                  <Section style={{ marginTop: 28 }}>
                    <Row>
                      <Column style={{ width: '30%', verticalAlign: 'middle' }}>
                        <Hr style={{ borderColor: rule, margin: 0 }} />
                      </Column>
                      <Column style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                        <Text
                          style={{
                            fontFamily: mono,
                            fontSize: 9,
                            letterSpacing: '0.2em',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            color: muted,
                            margin: 0,
                            padding: '0 8px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {cat}
                        </Text>
                      </Column>
                      <Column style={{ width: '30%', verticalAlign: 'middle' }}>
                        <Hr style={{ borderColor: rule, margin: 0 }} />
                      </Column>
                    </Row>
                  </Section>

                  {catArticles.map((article, artIdx) => {
                    const articleUrl = buildArticleUrl(siteUrl, edition, article)
                    const primarySource = getPrimarySource(article)

                    return (
                      <Section key={article.id} style={{ marginTop: artIdx === 0 ? 20 : 0 }}>
                        {/* Source + reading time — always blue */}
                        <Text
                          style={{
                            fontFamily: mono,
                            fontSize: 9,
                            letterSpacing: '0.08em',
                            color: blue,
                            margin: '0 0 6px',
                          }}
                        >
                          {primarySource.label}
                          {article.source_count > 1 && (
                            <>
                              <span style={{ color: fgLight }}>{' · '}</span>
                              {`${article.source_count} fontes`}
                            </>
                          )}
                          {article.reading_time_min && (
                            <>
                              <span style={{ color: fgLight }}>{' · '}</span>
                              {`${article.reading_time_min} min de leitura`}
                            </>
                          )}
                        </Text>

                        {/* Titulo */}
                        <Heading
                          as="h3"
                          style={{
                            fontFamily: serif,
                            fontSize: 21,
                            fontWeight: 700,
                            lineHeight: 1.25,
                            color: ink,
                            margin: '0 0 8px',
                          }}
                        >
                          <Link href={articleUrl} style={{ color: ink, textDecoration: 'none' }}>
                            {article.title_ptbr ?? article.title}
                          </Link>
                        </Heading>

                        {/* Summary */}
                        <Text
                          style={{
                            fontFamily: sans,
                            fontSize: 14,
                            lineHeight: 1.7,
                            color: bodyColor,
                            margin: '0 0 12px',
                          }}
                        >
                          {article.summary_ptbr}
                        </Text>

                        {/* CTAs — primary (blue border) + secondary (muted, no fill) */}
                        <Section style={{ marginBottom: 0 }}>
                          <Row>
                            <Column>
                              <Link
                                href={articleUrl}
                                style={{
                                  fontFamily: mono,
                                  fontSize: 9,
                                  letterSpacing: '0.12em',
                                  textTransform: 'uppercase',
                                  color: blue,
                                  textDecoration: 'none',
                                  fontWeight: 700,
                                }}
                              >
                                {'Ler na íntegra →'}
                              </Link>
                              <span style={{ display: 'inline-block', width: 16 }}> </span>
                              <Link
                                href={primarySource.url}
                                style={{
                                  fontFamily: mono,
                                  fontSize: 9,
                                  letterSpacing: '0.12em',
                                  textTransform: 'uppercase',
                                  color: muted,
                                  textDecoration: 'none',
                                }}
                              >
                                {'Fonte principal ↗'}
                              </Link>
                            </Column>
                          </Row>
                        </Section>

                        {artIdx < catArticles.length - 1 && (
                          <Hr style={{ borderColor: rule, margin: '20px 0 20px' }} />
                        )}
                      </Section>
                    )
                  })}
                </Section>
              )
            })}

            {/* -- FOOTER -- */}
            <Section style={{ padding: '28px 24px 24px', textAlign: 'center' }}>
              <Hr style={{ borderColor: rule, margin: '0 0 20px' }} />

              <Text
                style={{
                  fontFamily: mono,
                  fontSize: 9,
                  color: muted,
                  margin: '0 0 6px',
                  lineHeight: 1.7,
                  letterSpacing: '0.03em',
                }}
              >
                {'Você recebe este email porque se inscreveu no'} {SITE_NAME}.
                <br />
                Entregue toda segunda-feira.
              </Text>
              <Link
                href={unsubscribeUrl}
                style={{ fontFamily: mono, fontSize: 9, color: muted, textDecoration: 'underline' }}
              >
                {'Cancelar inscrição'}
              </Link>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
