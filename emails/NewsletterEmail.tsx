/**
 * Template de email da newsletter DevPulse.
 *
 * Renderizado server-side pelo SendGrid — nunca roda no browser.
 * Usa inline styles (obrigatorio para compatibilidade com clientes de email).
 *
 * Estilo: editorial jornal impresso (inspirado em Tablet Magazine).
 * Fundo creme quente, headlines serif bold, categorias com fundo escuro.
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
import * as React from 'react'
import type { Article, Edition } from '../src/lib/types'
import { groupByCategory, getOrderedCategories } from '../src/lib/articles'
import { formatFullDate } from '../src/lib/date'
import { SITE_NAME, MASTHEAD_SUBTITLE } from '../src/lib/config'

interface NewsletterEmailProps {
  edition: Edition
  articles: Article[]
  unsubscribeUrl: string
  siteUrl: string
}

const serif = "Georgia, 'Times New Roman', Times, serif"
const mono = "Menlo, Consolas, 'Courier New', monospace"
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"

// Cores — jornal impresso, tom quente
const ink = '#1a1714'
const darkBg = '#2a2520'
const lightText = '#f5f0e8'
const muted = '#8a8279'
const bodyColor = '#3d3730'
const paper = '#f0e8db'
const rule = '#c8c0b4'
const blue = '#2563EB'

export function NewsletterEmail({ edition, articles, unsubscribeUrl, siteUrl }: NewsletterEmailProps) {
  const grouped = groupByCategory(articles)
  const orderedCategories = getOrderedCategories(grouped)
  const editionDate = formatFullDate(edition.created_at)
  const hero = articles[0]

  const previewText = edition.summary
    ? edition.summary.slice(0, 90)
    : `${articles.length} artigos selecionados para devs brasileiros esta semana.`

  return (
    <Html lang="pt-BR">
      <Head>
        <meta charSet="utf-8" />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: '#e8e0d4', margin: 0, padding: 0, fontFamily: sans }}>
        <Container style={{ maxWidth: 600, margin: '0 auto', padding: '16px' }}>
          {/* Wrapper com fundo papel */}
          <Section style={{ backgroundColor: paper, padding: '0' }}>

            {/* ── TOP BAR ── */}
            <Section style={{ padding: '16px 24px 0' }}>
              <Row>
                <Column style={{ width: '50%' }}>
                  <Text style={{
                    fontFamily: mono, fontSize: 9, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: blue, margin: 0,
                  }}>
                    {editionDate}
                  </Text>
                </Column>
                <Column style={{ width: '50%', textAlign: 'right' }}>
                  <Text style={{
                    fontFamily: mono, fontSize: 9, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: blue, margin: 0,
                  }}>
                    {'Edição nº'} {edition.edition_number}
                  </Text>
                </Column>
              </Row>
            </Section>

            {/* ── MASTHEAD ── */}
            <Section style={{ padding: '0 24px' }}>
              <Hr style={{ borderColor: ink, borderWidth: '3px 0 0', margin: '8px 0 0' }} />
              <Hr style={{ borderColor: ink, borderWidth: '1px 0 0', margin: '3px 0 0' }} />

              <Heading
                as="h1"
                style={{
                  fontFamily: serif, fontSize: 56, fontWeight: 900, letterSpacing: '-3px',
                  textAlign: 'center', color: ink, margin: '12px 0 8px', lineHeight: 1,
                  textTransform: 'uppercase',
                }}
              >
                {SITE_NAME}
              </Heading>

              <Hr style={{ borderColor: ink, borderWidth: '1px 0 0', margin: '0 0 3px' }} />
              <Hr style={{ borderColor: ink, borderWidth: '3px 0 0', margin: '0 0 0' }} />

              <Text style={{
                fontFamily: mono, fontSize: 8, letterSpacing: '0.3em',
                textTransform: 'uppercase', color: muted, textAlign: 'center',
                margin: '10px 0 0',
              }}>
                {MASTHEAD_SUBTITLE}
              </Text>
            </Section>

            <Section style={{ padding: '0 24px' }}>
              <Hr style={{ borderColor: rule, margin: '14px 0 0' }} />
            </Section>

            {/* ── HERO ARTICLE ── */}
            {hero && (
              <Section style={{ padding: '20px 24px 0' }}>
                <Text style={{
                  fontFamily: mono, fontSize: 9, letterSpacing: '0.15em',
                  textTransform: 'uppercase', color: muted, margin: '0 0 10px',
                  textAlign: 'center',
                }}>
                  {hero.category}
                </Text>

                <Heading
                  as="h2"
                  style={{
                    fontFamily: serif, fontSize: 28, fontWeight: 900,
                    lineHeight: 1.15, color: ink, margin: '0 0 12px',
                    textAlign: 'center', letterSpacing: '-0.5px',
                  }}
                >
                  <Link href={hero.url} style={{ color: ink, textDecoration: 'none' }}>
                    {hero.title_ptbr ?? hero.title}
                  </Link>
                </Heading>

                <Text style={{
                  fontFamily: sans, fontSize: 15, lineHeight: 1.7, color: bodyColor,
                  margin: '0 0 8px', textAlign: 'center',
                }}>
                  {hero.summary_ptbr}
                </Text>

                <Text style={{
                  fontFamily: mono, fontSize: 9, color: muted, margin: '0 0 0',
                  textAlign: 'center', letterSpacing: '0.03em',
                }}>
                  <span style={{ color: blue }}>{hero.source}</span>
                  {hero.reading_time_min ? ` · ${hero.reading_time_min} min` : ''}
                  {' · '}
                  <Link
                    href={hero.slug ? `${siteUrl}/edicao/${edition.slug}/${hero.slug}` : `${siteUrl}/${edition.slug}`}
                    style={{ color: blue, textDecoration: 'underline' }}
                  >
                    {'Leia na íntegra →'}
                  </Link>
                  {' · '}
                  <Link href={hero.url} style={{ color: blue, textDecoration: 'underline' }}>
                    {'Fonte original →'}
                  </Link>
                </Text>

                <Hr style={{ borderColor: ink, borderWidth: '2px 0 0', margin: '24px 0 0' }} />
              </Section>
            )}

            {/* ── ARTICLES BY CATEGORY ── */}
            {orderedCategories.map((cat, catIdx) => {
              const catArticles = grouped[cat]!
              // Skip hero if it's the first article in its category
              const isHeroCategory = hero && catArticles[0]?.id === hero.id
              const displayArticles = isHeroCategory ? catArticles.slice(1) : catArticles
              if (displayArticles.length === 0) return null

              return (
                <Section key={cat} style={{ padding: '0 24px' }}>
                  {/* Category label — fundo escuro, texto claro (estilo jornal) */}
                  <Section style={{ marginTop: catIdx === 0 && !hero ? 20 : 20 }}>
                    <Row>
                      <Column>
                        <Text style={{
                          fontFamily: mono, fontSize: 9, letterSpacing: '0.18em',
                          textTransform: 'uppercase', fontWeight: 700,
                          backgroundColor: darkBg, color: lightText,
                          padding: '5px 10px', margin: 0,
                          display: 'inline-block',
                        }}>
                          {cat}
                        </Text>
                      </Column>
                    </Row>
                  </Section>

                  {displayArticles.map((article, artIdx) => (
                    <Section key={article.id} style={{ marginTop: artIdx === 0 ? 16 : 0 }}>
                      <Heading
                        as="h3"
                        style={{
                          fontFamily: serif, fontSize: 19, fontWeight: 700,
                          lineHeight: 1.25, color: ink, margin: '0 0 6px',
                        }}
                      >
                        <Link href={article.url} style={{ color: ink, textDecoration: 'none' }}>
                          {article.title_ptbr ?? article.title}
                        </Link>
                      </Heading>
                      <Text style={{
                        fontFamily: sans, fontSize: 14, lineHeight: 1.7, color: bodyColor,
                        margin: '0 0 6px',
                      }}>
                        {article.summary_ptbr}
                      </Text>
                      <Text style={{
                        fontFamily: mono, fontSize: 9, color: muted, margin: '0 0 0',
                        letterSpacing: '0.03em',
                      }}>
                        <span style={{ color: blue }}>{article.source}</span>
                        {article.reading_time_min ? ` · ${article.reading_time_min} min` : ''}
                        {' · '}
                        <Link
                          href={article.slug ? `${siteUrl}/edicao/${edition.slug}/${article.slug}` : `${siteUrl}/${edition.slug}`}
                          style={{ color: blue, textDecoration: 'underline' }}
                        >
                          {'Leia na íntegra →'}
                        </Link>
                        {' · '}
                        <Link href={article.url} style={{ color: blue, textDecoration: 'underline' }}>
                          {'Fonte original →'}
                        </Link>
                      </Text>

                      {artIdx < displayArticles.length - 1 && (
                        <Hr style={{ borderColor: rule, margin: '18px 0 18px' }} />
                      )}
                    </Section>
                  ))}

                  <Hr style={{ borderColor: ink, borderWidth: '1px 0 0', margin: '20px 0 0' }} />
                </Section>
              )
            })}

            {/* ── FOOTER ── */}
            <Section style={{ padding: '20px 24px 24px', textAlign: 'center' }}>
              <Hr style={{ borderColor: ink, borderWidth: '3px 0 0', margin: '0 0 3px' }} />
              <Hr style={{ borderColor: ink, borderWidth: '1px 0 0', margin: '0 0 16px' }} />

              <Text style={{
                fontFamily: mono, fontSize: 9, color: muted, margin: '0 0 6px',
                lineHeight: 1.7, letterSpacing: '0.03em',
              }}>
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
