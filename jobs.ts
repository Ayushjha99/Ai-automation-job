'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireUserId } from '@/lib/auth'
import { db } from '@/lib/db'
import { jobs, profiles, type JobStatus } from '@/lib/db/schema'
import { writeCoverLetter } from '@/lib/matcher'

const ALLOWED: JobStatus[] = ['new', 'saved', 'applied', 'dismissed']

export async function setJobStatus(id: number, status: JobStatus) {
  const userId = await requireUserId()
  if (!Number.isInteger(id) || !ALLOWED.includes(status)) throw new Error('Invalid input')
  await db
    .update(jobs)
    .set({ status })
    .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
  revalidatePath(`/jobs/${id}`)
}

export async function generateCoverLetter(id: number) {
  const userId = await requireUserId()
  if (!Number.isInteger(id)) throw new Error('Invalid input')

  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId))
  if (!job || !profile) throw new Error('Not found')

  const letter = await writeCoverLetter(profile, job)
  await db
    .update(jobs)
    .set({ coverLetter: letter })
    .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
  return letter
}
