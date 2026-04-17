import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'
import type { Article, ArticleCategory, Edition } from '../src/lib/types'

interface NewsletterEmailProps {
  edition: Edition
  articles: Article[]
  unsubscribeUrl: string
}

const CATEGORY_ORDER: ArticleCategory[] = [
  'IA & Machine Learning',
  'Backend',
  'Frontend',
  'DevOps & Cloud',
  'Linguagens & Frameworks',
  'Ferramentas & Produtividade',
  'Open Source',
  'Segurança',
  'Carreira & Cultura',
]

const serif = "Georgia, 'Times New Roman', serif"
const mono = "ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', monospace"
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

const ink = '#1a1a1a'
const muted = '#666666'
const paper = '#faf9f6'
const rule = '#cccccc'

export function NewsletterEmail({ edition, articles, unsubscribeUrl }: NewsletterEmailProps) {
  const grouped = articles.reduce<Partial<Record<ArticleCategory, Article[]>>>((acc, a) => {
    if (!acc[a.category]) acc[a.category] = []
    acc[a.category]!.push(a)
    return acc
  }, {})

  const orderedCategories = CATEGORY_ORDER.filter((c) => grouped[c]?.length)

  const editionDate = new Date(edition.created_at).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const previewText = edition.summary
    ? edition.summary.slice(0, 90)
    : `${articles.length} artigos selecionados para devs brasileiros esta semana.`

  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: paper, margin: 0, padding: 0, fontFamily: sans }}>
        <Container
          style={{
            maxWidth: 600,
            margin: '0 auto',
            padding: '32px 24px',
          }}
        >
          {/* ── MASTHEAD ── */}
          <Section
            style={{
              borderBottom: `3px solid ${ink}`,
              paddingBottom: 16,
              marginBottom: 4,
            }}
          >
            <Text
              style={{
                fontFamily: mono,
                fontSize: 10,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: muted,
                margin: '0 0 8px',
                textAlign: 'center',
              }}
            >
              {editionDate} &nbsp;·&nbsp; Edição nº {edition.edition_number}
            </Text>
            <Heading
              as="h1"
              style={{
                fontFamily: serif,
                fontSize: 52,
                fontWeight: 900,
                letterSpacing: '-2px',
                textAlign: 'center',
                color: ink,
                margin: '0 0 8px',
                lineHeight: 1,
              }}
            >
              DEVPULSE
            </Heading>
            <Text
              style={{
                fontFamily: mono,
                fontSize: 10,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: muted,
                textAlign: 'center',
                margin: 0,
              }}
            >
              Newsletter · Semanal · IA &amp; Dev
            </Text>
          </Section>
          <Hr style={{ borderColor: ink, margin: '4px 0 24px' }} />

          {/* ── EDITION HEADER ── */}
          <Section style={{ marginBottom: 24 }}>
            <Heading
              as="h2"
              style={{
                fontFamily: serif,
                fontSize: 28,
                fontWeight: 700,
                lineHeight: 1.2,
                color: ink,
                margin: '0 0 8px',
              }}
            >
              {edition.title}
            </Heading>
            {edition.summary && (
              <Text
                style={{
                  fontFamily: sans,
                  fontSize: 15,
                  lineHeight: 1.65,
                  color: '#444',
                  margin: 0,
                }}
              >
                {edition.summary}
              </Text>
            )}
          </Section>

          <Hr style={{ borderColor: ink, margin: '0 0 28px' }} />

          {/* ── ARTICLES BY CATEGORY ── */}
          {orderedCategories.map((cat) => (
            <Section key={cat} style={{ marginBottom: 32 }}>
              {/* Category divider */}
              <Row style={{ marginBottom: 16 }}>
                <Column style={{ width: '30%', verticalAlign: 'middle' }}>
                  <Hr style={{ borderColor: ink, margin: 0 }} />
                </Column>
                <Column
                  style={{ width: '40%', textAlign: 'center', verticalAlign: 'middle', padding: '0 8px' }}
                >
                  <Text
                    style={{
                      fontFamily: mono,
                      fontSize: 10,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: ink,
                      margin: 0,
                      fontWeight: 700,
                    }}
                  >
                    {cat}
                  </Text>
                </Column>
                <Column style={{ width: '30%', verticalAlign: 'middle' }}>
                  <Hr style={{ borderColor: ink, margin: 0 }} />
                </Column>
              </Row>

              {/* Articles */}
              {grouped[cat]!.map((article) => (
                <Section key={article.id} style={{ marginBottom: 24 }}>
                  <Text
                    style={{
                      fontFamily: mono,
                      fontSize: 10,
                      color: muted,
                      margin: '0 0 4px',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {article.source}
                    {article.reading_time_min ? ` · ${article.reading_time_min} min` : ''}
                  </Text>
                  <Heading
                    as="h3"
                    style={{
                      fontFamily: serif,
                      fontSize: 20,
                      fontWeight: 700,
                      lineHeight: 1.25,
                      color: ink,
                      margin: '0 0 8px',
                    }}
                  >
                    {article.title}
                  </Heading>
                  <Text
                    style={{
                      fontFamily: sans,
                      fontSize: 14,
                      lineHeight: 1.7,
                      color: '#333',
                      margin: '0 0 8px',
                    }}
                  >
                    {article.summary_ptbr}
                  </Text>
                  <Link
                    href={article.url}
                    style={{
                      fontFamily: mono,
                      fontSize: 11,
                      color: ink,
                      textDecoration: 'underline',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Leia completo →
                  </Link>
                </Section>
              ))}
            </Section>
          ))}

          <Hr style={{ borderColor: rule, margin: '8px 0 24px' }} />

          {/* ── FOOTER ── */}
          <Section style={{ textAlign: 'center' }}>
            <Text
              style={{
                fontFamily: mono,
                fontSize: 11,
                color: muted,
                margin: '0 0 8px',
                lineHeight: 1.6,
              }}
            >
              Você recebe este email porque se inscreveu no DevPulse.
              <br />
              Entregue toda segunda-feira.
            </Text>
            <Link
              href={unsubscribeUrl}
              style={{
                fontFamily: mono,
                fontSize: 11,
                color: muted,
                textDecoration: 'underline',
              }}
            >
              Cancelar inscrição
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
