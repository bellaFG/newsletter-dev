/**
 * Script para preview do email no browser.
 * Uso: npx tsx emails/preview.tsx
 * Abre o arquivo gerado: emails/preview.html
 */
import { render } from '@react-email/render'
import { NewsletterEmail } from './NewsletterEmail'
import * as fs from 'fs'

const edition = {
  id: 'preview-001',
  slug: '2026-04-17',
  edition_number: 1,
  title: 'DevPulse #001',
  summary: null,
  published_at: '2026-04-17T08:00:00Z',
  sent_at: null,
  created_at: '2026-04-17T08:00:00Z',
}

const articles = [
  {
    id: '1', edition_id: 'preview-001', title: 'C++26: Reflection, Memory Safety, Contracts, and a New Async Model',
    title_ptbr: 'C++26: Reflexão, Segurança de Memória, Contratos e um Novo Modelo Assíncrono',
    url: 'https://example.com/cpp26', summary_ptbr: 'O rascunho do padrão C++26 foi finalizado com recursos como reflexão e contratos. Essas adições visam facilitar a escrita de código mais seguro sem reescritas extensivas.',
    content_ptbr: null, source: 'InfoQ', category: 'Linguagens & Frameworks' as const, original_language: 'en',
    reading_time_min: 5, position: 1, slug: 'cpp26-reflection-memory-safety', created_at: '2026-04-17T08:00:00Z',
  },
  {
    id: '2', edition_id: 'preview-001', title: 'Meta Reports 4x Higher Bug Detection with Just-in-Time Testing',
    title_ptbr: 'Meta Reporta Detecção de Bugs 4x Maior com Testes Just-in-Time',
    url: 'https://example.com/meta-jit', summary_ptbr: 'A Meta introduziu o sistema JiT que gera testes dinamicamente durante code review. A detecção de bugs melhorou em até quatro vezes, especialmente em código assistido por IA.',
    content_ptbr: null, source: 'InfoQ', category: 'Ferramentas & Produtividade' as const, original_language: 'en',
    reading_time_min: 5, position: 2, slug: 'meta-jit-testing', created_at: '2026-04-17T08:00:00Z',
  },
  {
    id: '3', edition_id: 'preview-001', title: 'AWS Introduces S3 Files, Bringing File System Access to S3 Buckets',
    title_ptbr: 'AWS Lança S3 Files: Acesso de Sistema de Arquivos para Buckets S3',
    url: 'https://example.com/s3-files', summary_ptbr: 'A AWS lançou o S3 Files, permitindo acesso a buckets como sistema de arquivos padrão. Isso simplifica integrações e reduz a complexidade ao trabalhar com dados na nuvem.',
    content_ptbr: null, source: 'InfoQ', category: 'DevOps & Cloud' as const, original_language: 'en',
    reading_time_min: 5, position: 3, slug: 'aws-s3-files', created_at: '2026-04-17T08:00:00Z',
  },
  {
    id: '4', edition_id: 'preview-001', title: 'Google Opens Gemma 4 Under Apache 2.0 with Multimodal and Agentic Capabilities',
    title_ptbr: 'Google Abre Gemma 4 com Apache 2.0: Capacidades Multimodais e Agênticas',
    url: 'https://example.com/gemma4', summary_ptbr: 'O Google lançou o Gemma 4, modelos de IA open source com capacidades multimodais e janelas de contexto expandidas. A licença Apache 2.0 facilita adoção e personalização.',
    content_ptbr: null, source: 'InfoQ', category: 'IA & Machine Learning' as const, original_language: 'en',
    reading_time_min: 5, position: 4, slug: 'google-gemma-4', created_at: '2026-04-17T08:00:00Z',
  },
  {
    id: '5', edition_id: 'preview-001', title: 'Cursor 3 Introduces Agent-First Interface',
    title_ptbr: 'Cursor 3: Interface que Prioriza Agentes de Codificação',
    url: 'https://example.com/cursor3', summary_ptbr: 'A Anysphere lançou o Cursor 3 com interface agent-first para gerenciar agentes de codificação. Permite execução paralela de tarefas em múltiplos repositórios.',
    content_ptbr: null, source: 'The Changelog', category: 'Ferramentas & Produtividade' as const, original_language: 'en',
    reading_time_min: 4, position: 5, slug: 'cursor-3-agent-first', created_at: '2026-04-17T08:00:00Z',
  },
  {
    id: '6', edition_id: 'preview-001', title: 'CNCF Warns Kubernetes Alone Is Not Enough to Secure LLM Workloads',
    title_ptbr: 'CNCF Alerta: Kubernetes Sozinho Não Basta para Segurança de LLMs',
    url: 'https://example.com/k8s-llm', summary_ptbr: 'A CNCF alertou que o Kubernetes não garante segurança de LLMs por si só. Desenvolvedores devem considerar medidas adicionais para controlar o comportamento de sistemas de IA.',
    content_ptbr: null, source: 'InfoQ', category: 'Segurança' as const, original_language: 'en',
    reading_time_min: 6, position: 6, slug: 'cncf-k8s-llm-security', created_at: '2026-04-17T08:00:00Z',
  },
  {
    id: '7', edition_id: 'preview-001', title: 'Healthchecks.io now uses self-hosted object storage',
    title_ptbr: 'Healthchecks.io Migra para Armazenamento de Objetos Auto-Hospedado',
    url: 'https://example.com/healthchecks', summary_ptbr: 'O Healthchecks.io agora usa storage auto-hospedado, melhorando flexibilidade e controle sobre dados. Boa prática para equipes que buscam autonomia na infraestrutura.',
    content_ptbr: null, source: 'Healthchecks.io', category: 'Open Source' as const, original_language: 'en',
    reading_time_min: 5, position: 7, slug: 'healthchecks-self-hosted', created_at: '2026-04-17T08:00:00Z',
  },
  {
    id: '8', edition_id: 'preview-001', title: 'OpenTelemetry Declarative Configuration Reaches Stability Milestone',
    title_ptbr: 'Configuração Declarativa do OpenTelemetry Alcança Estabilidade',
    url: 'https://example.com/otel', summary_ptbr: 'O OpenTelemetry anunciou estabilidade na configuração declarativa. Isso significa uma maneira mais padronizada e eficiente de implementar observabilidade em aplicações.',
    content_ptbr: null, source: 'InfoQ', category: 'DevOps & Cloud' as const, original_language: 'en',
    reading_time_min: 5, position: 8, slug: 'opentelemetry-stable', created_at: '2026-04-17T08:00:00Z',
  },
  {
    id: '9', edition_id: 'preview-001', title: 'Understanding Transformers Part 9: Stacking Self-Attention Layers',
    title_ptbr: 'Entendendo Transformers: Empilhando Camadas de Autoatenção',
    url: 'https://example.com/transformers', summary_ptbr: 'A série sobre Transformers analisa como camadas de autoatenção funcionam em conjunto. Entender esses conceitos é crucial para otimizar e implementar modelos de IA mais eficazes.',
    content_ptbr: null, source: 'dev.to', category: 'IA & Machine Learning' as const, original_language: 'en',
    reading_time_min: 8, position: 9, slug: 'transformers-self-attention', created_at: '2026-04-17T08:00:00Z',
  },
]

async function main() {
  const html = await render(
    NewsletterEmail({
      edition,
      articles,
      unsubscribeUrl: 'https://example.com/unsubscribe?email=test@test.com',
      siteUrl: 'https://newsletter-dev.vercel.app',
    }),
  )

  fs.writeFileSync('emails/preview.html', html)
  console.log('Preview salvo em emails/preview.html')
}

main()
