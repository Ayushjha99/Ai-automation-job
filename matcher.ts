import 'server-only'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import type { Profile } from '@/lib/db/schema'

const SCORING_MODEL = 'google/gemini-3.5-flash'
const WRITING_MODEL = 'anthropic/claude-sonnet-5.5'

const matchSchema = z.object({
  score: z.number().int().min(0).max(100).describe('How well the candidate fits this job, 0-100'),
  summary: z.string().describe('Two-sentence plain summary of the role and what it needs'),
  reasons: z.array(z.string()).max(4).describe('Short reasons the candidate is a good fit'),
  gaps: z.array(z.string()).max(3).describe('Short notes on missing requirements or concerns'),
})

export type MatchResult = z.infer<typeof matchSchema>

function profileBlock(p: Profile) {
  return [
    `Name: ${p.fullName || 'n/a'}`,
    `Headline: ${p.headline || 'n/a'}`,
    `Target roles: ${p.targetRoles || 'n/a'}`,
    `Preferred locations: ${p.locations || 'any'}${p.remoteOnly ? ' (remote only)' : ''}`,
    `Resume:\n${p.resume.slice(0, 6000)}`,
  ].join('\n')
}

type JobInput = { title: string; company: string; location: string; description: string }

export async function scoreJob(profile: Profile, job: JobInput): Promise<MatchResult> {
  const { output } = await generateText({
    model: SCORING_MODEL,
    output: Output.object({ schema: matchSchema }),
    system:
      'You are a careful career assistant. Score how well a candidate matches a job posting. Be honest: penalize location mismatches, seniority mismatches, and missing core skills. Keep every bullet under 15 words.',
    prompt: `CANDIDATE\n${profileBlock(profile)}\n\nJOB\nTitle: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location}\nDescription:\n${job.description.slice(0, 6000)}`,
  })
  return output
}

export async function writeCoverLetter(profile: Profile, job: JobInput) {
  const { text } = await generateText({
    model: WRITING_MODEL,
    system:
      'You write concise, specific cover letters (180-250 words). Use only facts from the resume; never invent experience. No placeholders, no subject line, plain text, warm but professional tone.',
    prompt: `CANDIDATE\n${profileBlock(profile)}\n\nJOB\nTitle: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location}\nDescription:\n${job.description.slice(0, 6000)}\n\nWrite the cover letter, signed with the candidate's name.`,
  })
  return text.trim()
}
