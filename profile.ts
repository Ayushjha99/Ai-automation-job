'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUserId } from '@/lib/auth'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'

const profileSchema = z.object({
  fullName: z.string().trim().max(120),
  headline: z.string().trim().max(200),
  resume: z.string().trim().max(20000),
  targetRoles: z.string().trim().max(500),
  keywords: z.string().trim().max(500),
  locations: z.string().trim().max(300),
  remoteOnly: z.boolean(),
  companyBoards: z.string().trim().max(3000),
  minScore: z.coerce.number().int().min(0).max(100),
})

export type ProfileFormState = { ok: boolean; message: string } | null

export async function saveProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const userId = await requireUserId()
  const parsed = profileSchema.safeParse({
    fullName: formData.get('fullName') ?? '',
    headline: formData.get('headline') ?? '',
    resume: formData.get('resume') ?? '',
    targetRoles: formData.get('targetRoles') ?? '',
    keywords: formData.get('keywords') ?? '',
    locations: formData.get('locations') ?? '',
    remoteOnly: formData.get('remoteOnly') === 'on',
    companyBoards: formData.get('companyBoards') ?? '',
    minScore: formData.get('minScore') ?? 60,
  })
  if (!parsed.success) return { ok: false, message: 'Please check the fields and try again.' }

  const values = { ...parsed.data, updatedAt: new Date() }
  await db
    .insert(profiles)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: profiles.userId, set: values })

  revalidatePath('/')
  revalidatePath('/profile')
  return { ok: true, message: 'Profile saved' }
}
