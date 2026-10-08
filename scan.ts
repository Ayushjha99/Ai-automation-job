import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { jobs, profiles, type Profile } from '@/lib/db/schema'
import { fetchAllJobs, parseList, type RawJob } from '@/lib/sources'
import { scoreJob } from '@/lib/matcher'

const MAX_SCORED_PER_SCAN = 12
const MAX_AGE_DAYS = 14
export const MIN_SCAN_INTERVAL_MS = 10 * 60 * 1000

function matchesFilters(job: RawJob, profile: Profile) {
  const terms = [...parseList(profile.targetRoles), ...parseList(profile.keywords)].map((t) =>
    t.toLowerCase(),
  )
  const title = job.title.toLowerCase()
  if (terms.length && !terms.some((t) => title.includes(t))) return false

  if (profile.remoteOnly && !/remote|anywhere|worldwide/i.test(`${job.location} ${job.title}`)) {
    return false
  }

  if (job.postedAt) {
    const ageDays = (Date.now() - job.postedAt.getTime()) / 86_400_000
    if (ageDays > MAX_AGE_DAYS) return false
  }
  return true
}

export type ScanResult = { fetched: number; candidates: number; added: number; matches: number }

export async function scanForProfile(profile: Profile): Promise<ScanResult> {
  await db.update(profiles).set({ lastScanAt: new Date() }).where(eq(profiles.userId, profile.userId))

  const searchTerms = parseList(profile.targetRoles)
  const all = await fetchAllJobs({ searchTerms, boards: profile.companyBoards })
  const filtered = all.filter((j) => matchesFilters(j, profile))

  const sources = [...new Set(filtered.map((j) => j.source))]
  const existing = sources.length
    ? await db
        .select({ source: jobs.source, externalId: jobs.externalId })
        .from(jobs)
        .where(and(eq(jobs.userId, profile.userId), inArray(jobs.source, sources)))
    : []
  const known = new Set(existing.map((e) => `${e.source}|${e.externalId}`))

  const fresh = filtered
    .filter((j) => !known.has(`${j.source}|${j.externalId}`))
    .sort((a, b) => (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0))
    .slice(0, MAX_SCORED_PER_SCAN)

  const scored = await Promise.all(
    fresh.map(async (job) => {
      try {
        return { job, match: await scoreJob(profile, job) }
      } catch (error) {
        console.error('[scan] scoring failed', job.title, error)
        return null
      }
    }),
  )

  let matches = 0
  const rows = scored
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .map(({ job, match }) => {
      const isMatch = match.score >= profile.minScore
      if (isMatch) matches++
      return {
        userId: profile.userId,
        source: job.source,
        externalId: job.externalId,
        title: job.title.slice(0, 300),
        company: job.company.slice(0, 200),
        location: job.location.slice(0, 200),
        url: job.url,
        description: job.description.slice(0, 20000),
        postedAt: job.postedAt,
        score: match.score,
        summary: match.summary,
        reasons: match.reasons,
        gaps: match.gaps,
        status: isMatch ? 'new' : 'hidden',
      }
    })

  if (rows.length) {
    await db.insert(jobs).values(rows).onConflictDoNothing()
  }

  return { fetched: all.length, candidates: filtered.length, added: rows.length, matches }
}
