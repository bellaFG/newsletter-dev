/**
 * Template de email da newsletter DevPulse.
 *
 * Renderizado server-side pela Resend API — nunca roda no browser.
 * Usa inline styles (obrigatorio para compatibilidade com clientes de email).
 * Dark mode via CSS media query (prefers-color-scheme).
 *
 * Estilo: layout editorial inspirado em jornais impressos (Epoch Times, Tablet).
 */

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
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
}

const serif = "Georgia, 'Times New Roman', serif"
const mono = "ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', monospace"
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

// Cores — tom quente de jornal impresso
const ink = '#2a2520'
const catColor = '#8b1a1a'
const muted = '#777066'
const body = '#3d3730'
const paper = '#f5f0e8'
const rule = '#d4cec4'

const darkCSS = `
  @media (prefers-color-scheme: dark) {
    body, .ep { background-color: #1e1c19 !important; color: #e8e2d8 !important; }
    .ec { background-color: #1e1c19 !important; }
    .ems { border-color: #e8e2d8 !important; }
    .ek { color: #e8e2d8 !important; }
    .ecat { color: #d4856a !important; }
    .em { color: #998f82 !important; }
    .eb { color: #c4bdb2 !important; }
    .ehr { border-color: #3d3830 !important; }
    .ehr-d { border-color: #e8e2d8 !important; }
    a { color: #e8e2d8 !important; }
  }
`

export function NewsletterEmail({ edition, articles, unsubscribeUrl }: NewsletterEmailProps) {
  const grouped = groupByCategory(articles)
  const orderedCategories = getOrderedCategories(grouped)
  const editionDate = formatFullDate(edition.created_at)

  const previewText = edition.summary
    ? edition.summary.slice(0, 90)
    : `${articles.length} artigos selecionados para devs brasileiros esta semana.`

  return (
    <Html lang="pt-BR">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style dangerouslySetInnerHTML={{ __html: darkCSS }} />
      </Head>
      <Preview>{previewText}</Preview>
      <Body className="ep" style={{ backgroundColor: paper, margin: 0, padding: 0, fontFamily: sans }}>
        <Container
          className="ec"
          style={{ maxWidth: 600, margin: '0 auto', padding: '32px 20px' }}
        >
          {/* ── MASTHEAD ── */}
          <Section style={{ marginBottom: 4 }}>
            <Text
              className="em"
              style={{
                fontFamily: mono, fontSize: 10, letterSpacing: '0.15em',
                textTransform: 'uppercase', color: muted, margin: '0 0 6px', textAlign: 'center',
              }}
            >
              {editionDate} &nbsp;&middot;&nbsp; Edi\u00e7\u00e3o n\u00ba {edition.edition_number}
            </Text>

            <Hr className="ehr-d" style={{ borderColor: ink, borderWidth: '2px 0 0', margin: '0 0 6px' }} />

            <Heading
              as="h1"
              className="ek"
              style={{
                fontFamily: serif, fontSize: 48, fontWeight: 900, letterSpacing: '-2px',
                textAlign: 'center', color: ink, margin: '0 0 6px', lineHeight: 1,
              }}
            >
              {SITE_NAME.toUpperCase()}
            </Heading>

            <Hr className="ehr-d" style={{ borderColor: ink, borderWidth: '2px 0 0', margin: '0 0 6px' }} />

            <Text
              className="em"
              style={{
                fontFamily: mono, fontSize: 9, letterSpacing: '0.25em',
                textTransform: 'uppercase', color: muted, textAlign: 'center', margin: 0,
              }}
            >
              {MASTHEAD_SUBTITLE}
            </Text>
          </Section>

          <Hr className="ehr" style={{ borderColor: rule, margin: '12px 0 20px' }} />

          {/* ── EDITION HEADER ── */}
          {edition.summary && (
            <Section style={{ marginBottom: 20 }}>
              <Text
                className="eb"
                style={{ fontFamily: sans, fontSize: 15, lineHeight: 1.65, color: body, margin: 0, textAlign: 'center' }}
              >
                {edition.summary}
              </Text>
            </Section>
          )}

          {/* ── ARTICLES BY CATEGORY ── */}
          {orderedCategories.map((cat, catIdx) => (
            <Section key={cat} style={{ marginBottom: 28 }}>
              {/* Category header — estilo jornal (bold, left-aligned, com linha) */}
              <Hr className="ehr" style={{ borderColor: rule, margin: `${catIdx === 0 ? 0 : 8}px 0 0` }} />
              <Text
                className="ecat"
                style={{
                  fontFamily: mono, fontSize: 11, letterSpacing: '0.15em',
                  textTransform: 'uppercase', color: catColor, margin: '10px 0 14px',
                  fontWeight: 700,
                }}
              >
                {cat}
              </Text>

              {/* Articles */}
              {grouped[cat]!.map((article, artIdx) => (
                <Section key={article.id} style={{ marginBottom: artIdx < grouped[cat]!.length - 1 ? 20 : 0 }}>
                  <Heading
                    as="h3"
                    className="ek"
                    style={{
                      fontFamily: serif, fontSize: 20, fontWeight: 700,
                      lineHeight: 1.25, color: ink, margin: '0 0 6px',
                    }}
                  >
                    <Link href={article.url} style={{ color: ink, textDecoration: 'none' }}>
                      {article.title}
                    </Link>
                  </Heading>
                  <Text
                    className="eb"
                    style={{ fontFamily: sans, fontSize: 14, lineHeight: 1.7, color: body, margin: '0 0 6px' }}
                  >
                    {article.summary_ptbr}
                  </Text>
                  <Text
                    className="em"
                    style={{ fontFamily: mono, fontSize: 10, color: muted, margin: 0, letterSpacing: '0.03em' }}
                  >
                    {article.source}
                    {article.reading_time_min ? ` \u00b7 ${article.reading_time_min} min` : ''}
                    {' \u00b7 '}
                    <Link
                      href={article.url}
                      style={{ fontFamily: mono, fontSize: 10, color: muted, textDecoration: 'underline' }}
                    >
                      Leia completo \u2192
                    </Link>
                  </Text>
                </Section>
              ))}
            </Section>
          ))}

          <Hr className="ehr-d" style={{ borderColor: ink, borderWidth: '2px 0 0', margin: '8px 0 20px' }} />

          {/* ── FOOTER ── */}
          <Section style={{ textAlign: 'center' }}>
            <Text
              className="em"
              style={{ fontFamily: mono, fontSize: 10, color: muted, margin: '0 0 6px', lineHeight: 1.6 }}
            >
              Voc\u00ea recebe este email porque se inscreveu no {SITE_NAME}.
              <br />
              Entregue toda segunda-feira.
            </Text>
            <Link
              href={unsubscribeUrl}
              style={{ fontFamily: mono, fontSize: 10, color: muted, textDecoration: 'underline' }}
            >
              Cancelar inscri\u00e7\u00e3o
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
