/**
 * Echo neural node definitions and content generators.
 *
 * Each of the 15 neural nodes has a color (per spec) and a content generator
 * that transforms a Project into structured, renderable data. Content is
 * derived deterministically from project fields — no external AI call — so the
 * "AI Analysis" feels instant and consistent.
 */
import type { Project } from '@/types/project'
import { DISTRICT_MAP } from '@/types/project'

export type NodeId =
  | 'overview'
  | 'timeline'
  | 'founder'
  | 'technology'
  | 'funding'
  | 'community'
  | 'roadmap'
  | 'users'
  | 'growth'
  | 'aiAnalysis'
  | 'failures'
  | 'revival'
  | 'metrics'
  | 'media'
  | 'comments'

export interface NeuralNodeDef {
  id: NodeId
  label: string
  color: string
}

/** All 15 nodes with their spec colors, in canonical orbit order. */
export const NEURAL_NODES: NeuralNodeDef[] = [
  { id: 'overview', label: 'Overview', color: '#F8F8F8' },
  { id: 'timeline', label: 'Timeline', color: '#3DD8FF' },
  { id: 'founder', label: 'Founder', color: '#F8F8F8' },
  { id: 'technology', label: 'Technology', color: '#3BFF91' },
  { id: 'funding', label: 'Funding', color: '#3BFF91' },
  { id: 'community', label: 'Community', color: '#FFB547' },
  { id: 'roadmap', label: 'Roadmap', color: '#FFB547' },
  { id: 'users', label: 'Users', color: '#FFB547' },
  { id: 'growth', label: 'Growth', color: '#3DD8FF' },
  { id: 'aiAnalysis', label: 'AI Analysis', color: '#3DD8FF' },
  { id: 'failures', label: 'Failures', color: '#FF5959' },
  { id: 'revival', label: 'Revival', color: '#3BFF91' },
  { id: 'metrics', label: 'Metrics', color: '#F8F8F8' },
  { id: 'media', label: 'Media', color: '#3BFF91' },
  { id: 'comments', label: 'Comments', color: '#FFB547' },
]

export const NODE_MAP: Record<NodeId, NeuralNodeDef> = Object.fromEntries(
  NEURAL_NODES.map((n) => [n.id, n]),
) as Record<NodeId, NeuralNodeDef>

// ---- Content types ----------------------------------------------------- //

export interface KeyValueRow {
  label: string
  value: string
  color?: string
}

export interface TimelineMilestone {
  id: string
  label: string
  year: number | null
  reached: boolean
  description: string
}

export interface FailureDiagnosis {
  problem: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  explanation: string
  recovery: string
}

export interface AnalysisSection {
  title: string
  items: string[]
}

export interface RoadmapMilestone {
  id: string
  label: string
  completed: boolean
}

export interface MetricBar {
  label: string
  value: number
  max: number
  color: string
}

export type NodeContent =
  | { kind: 'keyValues'; rows: KeyValueRow[] }
  | { kind: 'timeline'; milestones: TimelineMilestone[] }
  | { kind: 'failures'; diagnoses: FailureDiagnosis[] }
  | { kind: 'analysis'; sections: AnalysisSection[] }
  | { kind: 'roadmap'; milestones: RoadmapMilestone[] }
  | { kind: 'metrics'; bars: MetricBar[]; rows: KeyValueRow[] }
  | { kind: 'revive' }
  | { kind: 'media' }
  | { kind: 'comments' }

// ---- Helpers ----------------------------------------------------------- //

function aiScore(p: Project): number {
  return Math.round(p.momentum * 0.6 + p.followers * 0.001 + p.stage * 5)
}

function healthLabel(p: Project): string {
  switch (p.status) {
    case 'alive': return 'Healthy'
    case 'decaying': return 'Declining'
    case 'abandoned': return 'Critical'
    case 'reviving': return 'Recovering'
  }
}

// ---- Content generators ------------------------------------------------ //

function overviewContent(p: Project): NodeContent {
  return {
    kind: 'keyValues',
    rows: [
      { label: 'Project', value: p.name },
      { label: 'Category', value: DISTRICT_MAP[p.category].name },
      { label: 'Founder', value: p.founder || 'Unknown' },
      { label: 'Stage', value: `${p.stage} / 5` },
      { label: 'Health', value: healthLabel(p), color: p.status === 'alive' ? '#3BFF91' : p.status === 'abandoned' ? '#FF5959' : '#FFB547' },
      { label: 'Followers', value: p.followers.toLocaleString() },
      { label: 'Status', value: p.status, color: p.status === 'reviving' ? '#3BFF91' : undefined },
      { label: 'AI Score', value: `${aiScore(p)}` },
      { label: 'Founded', value: String(p.foundedYear) },
      { label: 'Current Goal', value: p.status === 'abandoned' ? 'Awaiting Revival' : p.status === 'reviving' ? 'Rebuild & Relaunch' : 'Scale Operations' },
    ],
  }
}

function timelineContent(p: Project): NodeContent {
  const milestones: TimelineMilestone[] = [
    { id: 'prototype', label: 'Prototype', year: p.foundedYear, reached: true, description: 'Initial concept and prototype development began.' },
    { id: 'launch', label: 'Launch', year: p.foundedYear + 1, reached: p.stage >= 2, description: 'Product launched to early users.' },
    { id: 'growth', label: 'Growth', year: p.foundedYear + 2, reached: p.stage >= 3, description: 'User base and team expanded.' },
    { id: 'funding', label: 'Funding', year: p.foundedYear + 2, reached: p.stage >= 3, description: 'Capital raised to fuel growth.' },
    { id: 'failure', label: 'Failure', year: p.failureYear, reached: p.status !== 'alive', description: p.failureReason ?? 'Project encountered critical challenges.' },
    { id: 'abandonment', label: 'Abandonment', year: p.failureYear ?? null, reached: p.status === 'abandoned' || p.status === 'reviving', description: 'Project was abandoned by the original team.' },
    { id: 'revival', label: 'Revival', year: null, reached: p.status === 'reviving', description: 'Community initiated revival efforts.' },
  ]
  return { kind: 'timeline', milestones }
}

function founderContent(p: Project): NodeContent {
  return {
    kind: 'keyValues',
    rows: [
      { label: 'Name', value: p.founder || 'Unknown' },
      { label: 'Project', value: p.name },
      { label: 'Founded', value: String(p.foundedYear) },
      { label: 'Category', value: DISTRICT_MAP[p.category].name },
      { label: 'Status', value: p.status === 'abandoned' ? 'Moved on' : p.status === 'reviving' ? 'Re-engaged' : 'Active' },
    ],
  }
}

function technologyContent(p: Project): NodeContent {
  return {
    kind: 'keyValues',
    rows: [
      { label: 'Tags', value: p.tags.join(', ') || 'None' },
      { label: 'Category', value: DISTRICT_MAP[p.category].name },
      { label: 'Stage', value: `${p.stage} / 5` },
      { label: 'Infrastructure', value: p.stage >= 4 ? 'Production-scale' : p.stage >= 2 ? 'Development' : 'Prototype' },
    ],
  }
}

function fundingContent(p: Project): NodeContent {
  const investment = p.stage * 250 + p.followers * 2
  const runway = Math.max(0, 12 - (p.status === 'abandoned' ? 12 : p.stage))
  const monthlyCost = Math.round(investment / Math.max(runway, 1) / 1000) * 1000
  const revenue = p.status === 'alive' ? Math.round(p.followers * 1.5) : 0
  const health = p.status === 'alive' ? 'Stable' : p.status === 'abandoned' ? 'Exhausted' : 'At Risk'
  return {
    kind: 'metrics',
    bars: [
      { label: 'Investment', value: investment, max: 5000, color: '#3BFF91' },
      { label: 'Runway (months)', value: runway, max: 12, color: '#3DD8FF' },
      { label: 'Revenue', value: revenue, max: 5000, color: '#3BFF91' },
    ],
    rows: [
      { label: 'Monthly Cost', value: `$${monthlyCost.toLocaleString()}` },
      { label: 'Funding Health', value: health, color: p.status === 'alive' ? '#3BFF91' : '#FF5959' },
      { label: 'Growth Potential', value: p.momentum > 50 ? 'High' : p.momentum > 20 ? 'Moderate' : 'Low' },
    ],
  }
}

function communityContent(p: Project): NodeContent {
  return {
    kind: 'metrics',
    bars: [
      { label: 'Followers', value: p.followers, max: 10000, color: '#FFB547' },
      { label: 'Engagement', value: Math.round(p.momentum * 0.8), max: 100, color: '#FFB547' },
    ],
    rows: [
      { label: 'Contributors', value: String(Math.max(1, Math.round(p.followers / 200))) },
      { label: 'Activity Level', value: p.momentum > 60 ? 'High' : p.momentum > 30 ? 'Moderate' : 'Low' },
    ],
  }
}

function roadmapContent(p: Project): NodeContent {
  return {
    kind: 'roadmap',
    milestones: [
      { id: 'prototype', label: 'Prototype', completed: p.stage >= 1 },
      { id: 'beta', label: 'Beta', completed: p.stage >= 2 },
      { id: 'launch', label: 'Launch', completed: p.stage >= 3 },
      { id: 'scale', label: 'Scale', completed: p.stage >= 4 },
      { id: 'global', label: 'Global', completed: p.stage >= 5 },
    ],
  }
}

function usersContent(p: Project): NodeContent {
  return {
    kind: 'metrics',
    bars: [
      { label: 'Active Users', value: p.followers, max: 10000, color: '#FFB547' },
      { label: 'Retention', value: Math.round(p.momentum * 0.7), max: 100, color: '#FFB547' },
      { label: 'Growth Rate', value: p.momentum, max: 100, color: '#3DD8FF' },
    ],
    rows: [
      { label: 'Total Signups', value: (p.followers * 3).toLocaleString() },
      { label: 'DAU', value: Math.round(p.followers * 0.15).toLocaleString() },
    ],
  }
}

function growthContent(p: Project): NodeContent {
  return {
    kind: 'metrics',
    bars: [
      { label: 'Momentum', value: p.momentum, max: 100, color: '#3DD8FF' },
      { label: 'Followers', value: p.followers, max: 10000, color: '#3DD8FF' },
      { label: 'Stage Progress', value: p.stage * 20, max: 100, color: '#3DD8FF' },
    ],
    rows: [
      { label: 'Trend', value: p.status === 'alive' ? 'Upward' : p.status === 'reviving' ? 'Recovering' : 'Flat' },
    ],
  }
}

function aiAnalysisContent(p: Project): NodeContent {
  const sections: AnalysisSection[] = []
  const alive = p.status === 'alive' || p.status === 'reviving'

  sections.push({
    title: 'Strengths',
    items: [
      p.stage >= 3 ? 'Established product with proven market presence' : 'Early-stage with flexibility',
      p.followers > 500 ? `Strong community of ${p.followers.toLocaleString()} followers` : 'Niche focused audience',
      p.tags.length > 2 ? `Diverse technology stack: ${p.tags.slice(0, 3).join(', ')}` : 'Focused technology approach',
    ],
  })

  sections.push({
    title: 'Weaknesses',
    items: [
      p.momentum < 50 ? 'Low momentum indicates stalling growth' : 'Growth pacing is healthy',
      p.status === 'abandoned' ? 'Project is currently abandoned with no active development' : 'Active development ongoing',
      p.stage < 3 ? 'Pre-scale stage with unproven revenue model' : 'Revenue model in place',
    ],
  })

  sections.push({
    title: 'Risks',
    items: [
      p.failureYear ? 'Previous failure history increases relaunch risk' : 'No prior failure data',
      p.momentum < 30 ? 'Critical momentum loss may lead to full abandonment' : 'Momentum is stable',
      alive ? 'Competition in the market remains active' : 'Market may have moved on during abandonment',
    ],
  })

  sections.push({
    title: 'Opportunities',
    items: [
      p.status === 'abandoned' ? 'Revival could capture unused brand equity' : 'Scaling to adjacent markets',
      p.connections.length > 0 ? `${p.connections.length} partnership opportunities via network` : 'Building network connections',
      'Open-source revival could reduce operational costs',
    ],
  })

  sections.push({
    title: 'Recommended Actions',
    items: [
      p.status === 'abandoned' ? 'Initiate community-driven revival process' : 'Focus on user retention optimization',
      'Expand content marketing to rebuild awareness',
      `Leverage ${p.tags[0] ?? 'core'} expertise for new positioning`,
    ],
  })

  return { kind: 'analysis', sections }
}

function failuresContent(p: Project): NodeContent {
  const diagnoses: FailureDiagnosis[] = []

  if (p.failureReason) {
    diagnoses.push({
      problem: 'Primary Failure Cause',
      severity: 'critical',
      explanation: p.failureReason,
      recovery: 'Address root cause before attempting revival. Conduct a postmortem with the original team if possible.',
    })
  }

  if (p.momentum < 30) {
    diagnoses.push({
      problem: 'Low User Retention',
      severity: 'high',
      explanation: 'Momentum score indicates users are not returning. Product may lack stickiness or core value loop.',
      recovery: 'Identify the aha-moment in the user journey and optimize onboarding to reach it faster.',
    })
  }

  if (p.stage < 3 && p.status !== 'alive') {
    diagnoses.push({
      problem: 'Incomplete MVP',
      severity: 'medium',
      explanation: 'Project did not reach a mature enough stage to demonstrate clear product-market fit.',
      recovery: 'Scope down to a single core feature and rebuild with a focused value proposition.',
    })
  }

  if (p.followers < 200) {
    diagnoses.push({
      problem: 'Poor Product Market Fit',
      severity: 'high',
      explanation: 'Low follower count suggests the product did not resonate with a wide enough audience.',
      recovery: 'Revalidate the problem with user interviews. Pivot the target audience or use case.',
    })
  }

  if (p.failureYear) {
    diagnoses.push({
      problem: 'Funding Exhausted',
      severity: 'high',
      explanation: `Project ended in ${p.failureYear}, likely due to capital depletion.`,
      recovery: 'Seek community funding or open-source the project to reduce operational costs.',
    })
  }

  diagnoses.push({
    problem: 'Technical Debt',
    severity: 'low',
    explanation: 'Rapid development likely accumulated architectural shortcuts.',
    recovery: 'Audit the codebase during revival. Prioritize critical refactors before new features.',
  })

  if (diagnoses.length === 0) {
    diagnoses.push({
      problem: 'No Diagnoses',
      severity: 'low',
      explanation: 'This project has no recorded failure data.',
      recovery: 'Continue monitoring health metrics.',
    })
  }

  return { kind: 'failures', diagnoses }
}

function metricsContent(p: Project): NodeContent {
  return {
    kind: 'metrics',
    bars: [
      { label: 'AI Score', value: aiScore(p), max: 100, color: '#3DD8FF' },
      { label: 'Momentum', value: p.momentum, max: 100, color: '#3DD8FF' },
      { label: 'Stage', value: p.stage * 20, max: 100, color: '#F8F8F8' },
      { label: 'Followers', value: p.followers, max: 10000, color: '#FFB547' },
      { label: 'Health', value: p.status === 'alive' ? 90 : p.status === 'reviving' ? 50 : p.status === 'decaying' ? 30 : 10, max: 100, color: p.status === 'alive' ? '#3BFF91' : '#FF5959' },
    ],
    rows: [
      { label: 'Connections', value: String(p.connections.length) },
      { label: 'Tags', value: String(p.tags.length) },
    ],
  }
}

/** Main content dispatcher. */
export function getNodeContent(nodeId: NodeId, project: Project): NodeContent {
  switch (nodeId) {
    case 'overview': return overviewContent(project)
    case 'timeline': return timelineContent(project)
    case 'founder': return founderContent(project)
    case 'technology': return technologyContent(project)
    case 'funding': return fundingContent(project)
    case 'community': return communityContent(project)
    case 'roadmap': return roadmapContent(project)
    case 'users': return usersContent(project)
    case 'growth': return growthContent(project)
    case 'aiAnalysis': return aiAnalysisContent(project)
    case 'failures': return failuresContent(project)
    case 'revival': return { kind: 'revive' }
    case 'metrics': return metricsContent(project)
    case 'media': return { kind: 'media' }
    case 'comments': return { kind: 'comments' }
  }
}

// ---- Echo voice lines -------------------------------------------------- //

export function echoVoiceLine(nodeId: NodeId, project: Project): string {
  switch (nodeId) {
    case 'overview': return `${project.name}. ${healthLabel(project)}.`
    case 'timeline': return project.failureYear ? `Failed in ${project.failureYear}.` : 'Project is active.'
    case 'founder': return `Founded by ${project.founder || 'an unknown builder'}.`
    case 'technology': return `Built with ${project.tags.slice(0, 2).join(' and ') || 'proprietary tech'}.`
    case 'funding': return project.status === 'abandoned' ? 'Funding exhausted.' : 'Funding stable.'
    case 'community': return project.followers > 500 ? 'Community activity stable.' : 'Community is niche.'
    case 'roadmap': return `Stage ${project.stage} of 5.`
    case 'users': return `${Math.round(project.followers * 0.15).toLocaleString()} daily active users.`
    case 'growth': return project.momentum > 50 ? 'Growth trajectory upward.' : 'Growth plateau detected.'
    case 'aiAnalysis': return 'Analysis complete.'
    case 'failures': return project.failureReason ? 'Failure cause identified.' : 'No failure data.'
    case 'revival': return project.status === 'reviving' ? 'Revival in progress.' : 'Revival available.'
    case 'metrics': return `AI Score: ${aiScore(project)}.`
    case 'media': return 'No media loaded.'
    case 'comments': return 'No community comments.'
  }
}
