export type RawJob = {
  source: string
  externalId: string
  title: string
  company: string
  location: string
  url: string
  description: string
  postedAt: Date | null
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
}

function decodeEntities(input: string) {
  return input.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
}

export function htmlToText(html: string) {
  return decodeEntities(
    decodeEntities(html)
      .replace(/<(br|\/p|\/li|\/h\d)\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null
  const d = typeof value === 'number' ? new Date(value < 1e12 ? value * 1000 : value) : new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch (error) {
    console.error('[sources] fetch failed', url, error)
    return null
  }
}

type RemotiveResponse = {
  jobs: {
    id: number
    url: string
    title: string
    company_name: string
    candidate_required_location: string
    publication_date: string
    description: string
  }[]
}

async function fetchRemotive(search: string): Promise<RawJob[]> {
  const data = await getJson<RemotiveResponse>(
    `https://remotive.com/api/remote-jobs?limit=50&search=${encodeURIComponent(search)}`,
  )
  return (data?.jobs ?? []).map((j) => ({
    source: 'remotive',
    externalId: String(j.id),
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location ? `Remote (${j.candidate_required_location})` : 'Remote',
    url: j.url,
    description: htmlToText(j.description ?? ''),
    postedAt: toDate(j.publication_date),
  }))
}

type ArbeitnowResponse = {
  data: {
    slug: string
    company_name: string
    title: string
    description: string
    remote: boolean
    url: string
    location: string
    created_at: number
  }[]
}

async function fetchArbeitnow(): Promise<RawJob[]> {
  const data = await getJson<ArbeitnowResponse>('https://www.arbeitnow.com/api/job-board-api')
  return (data?.data ?? []).map((j) => ({
    source: 'arbeitnow',
    externalId: j.slug,
    title: j.title,
    company: j.company_name,
    location: j.remote ? `Remote${j.location ? ` / ${j.location}` : ''}` : j.location,
    url: j.url,
    description: htmlToText(j.description ?? ''),
    postedAt: toDate(j.created_at),
  }))
}

type GreenhouseResponse = {
  jobs: {
    id: number
    title: string
    absolute_url: string
    location?: { name?: string }
    updated_at?: string
    first_published?: string
    content?: string
    company_name?: string
  }[]
}

async function fetchGreenhouse(board: string): Promise<RawJob[]> {
  const data = await getJson<GreenhouseResponse>(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`,
  )
  return (data?.jobs ?? []).map((j) => ({
    source: `greenhouse:${board}`,
    externalId: String(j.id),
    title: j.title,
    company: j.company_name ?? board,
    location: j.location?.name ?? '',
    url: j.absolute_url,
    description: htmlToText(j.content ?? ''),
    postedAt: toDate(j.first_published ?? j.updated_at),
  }))
}

type LeverPosting = {
  id: string
  text: string
  hostedUrl: string
  categories?: { location?: string }
  createdAt?: number
  descriptionPlain?: string
  workplaceType?: string
}

async function fetchLever(company: string): Promise<RawJob[]> {
  const data = await getJson<LeverPosting[]>(
    `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`,
  )
  return (Array.isArray(data) ? data : []).map((j) => ({
    source: `lever:${company}`,
    externalId: j.id,
    title: j.text,
    company,
    location: [j.categories?.location, j.workplaceType === 'remote' ? 'Remote' : null]
      .filter(Boolean)
      .join(' · '),
    url: j.hostedUrl,
    description: j.descriptionPlain ?? '',
    postedAt: toDate(j.createdAt),
  }))
}

type AshbyResponse = {
  jobs: {
    id: string
    title: string
    location?: string
    isRemote?: boolean
    jobUrl: string
    publishedAt?: string
    descriptionPlain?: string
  }[]
}

async function fetchAshby(company: string): Promise<RawJob[]> {
  const data = await getJson<AshbyResponse>(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(company)}`,
  )
  return (data?.jobs ?? []).map((j) => ({
    source: `ashby:${company}`,
    externalId: j.id,
    title: j.title,
    company,
    location: [j.location, j.isRemote ? 'Remote' : null].filter(Boolean).join(' · '),
    url: j.jobUrl,
    description: j.descriptionPlain ?? '',
    postedAt: toDate(j.publishedAt),
  }))
}

export function parseList(value: string) {
  return value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function parseBoards(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean)
    .map((line) => {
      const [provider, slug] = line.split(':').map((s) => s.trim())
      return { provider, slug }
    })
    .filter(
      (b): b is { provider: 'greenhouse' | 'lever' | 'ashby'; slug: string } =>
        ['greenhouse', 'lever', 'ashby'].includes(b.provider) && /^[a-z0-9._-]+$/.test(b.slug ?? ''),
    )
    .slice(0, 25)
}

export async function fetchAllJobs(opts: { searchTerms: string[]; boards: string }) {
  const searches = opts.searchTerms.slice(0, 3)
  const boards = parseBoards(opts.boards)

  const tasks: Promise<RawJob[]>[] = [
    fetchArbeitnow(),
    ...(searches.length ? searches.map(fetchRemotive) : [fetchRemotive('')]),
    ...boards.map((b) =>
      b.provider === 'greenhouse'
        ? fetchGreenhouse(b.slug)
        : b.provider === 'lever'
          ? fetchLever(b.slug)
          : fetchAshby(b.slug),
    ),
  ]

  const results = await Promise.all(tasks)
  const seen = new Set<string>()
  return results.flat().filter((j) => {
    if (!j.title || !j.url) return false
    const key = `${j.source}|${j.externalId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function linkedInSearchUrl(title: string, company: string) {
  return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(`${title} ${company}`)}`
}
