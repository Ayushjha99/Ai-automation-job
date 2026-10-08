import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  serial,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

export const profiles = pgTable('profiles', {
  userId: text('userId').primaryKey(),
  fullName: text('fullName').notNull().default(''),
  headline: text('headline').notNull().default(''),
  resume: text('resume').notNull().default(''),
  targetRoles: text('targetRoles').notNull().default(''),
  keywords: text('keywords').notNull().default(''),
  locations: text('locations').notNull().default(''),
  remoteOnly: boolean('remoteOnly').notNull().default(false),
  companyBoards: text('companyBoards').notNull().default(''),
  minScore: integer('minScore').notNull().default(60),
  lastScanAt: timestamp('lastScanAt'),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const jobs = pgTable(
  'jobs',
  {
    id: serial('id').primaryKey(),
    userId: text('userId').notNull(),
    source: text('source').notNull(),
    externalId: text('externalId').notNull(),
    title: text('title').notNull(),
    company: text('company').notNull(),
    location: text('location').notNull().default(''),
    url: text('url').notNull(),
    description: text('description').notNull().default(''),
    postedAt: timestamp('postedAt'),
    score: integer('score'),
    summary: text('summary'),
    reasons: jsonb('reasons').$type<string[]>(),
    gaps: jsonb('gaps').$type<string[]>(),
    coverLetter: text('coverLetter'),
    status: text('status').notNull().default('new'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('jobs_user_source_ext').on(t.userId, t.source, t.externalId)],
)

export type Profile = typeof profiles.$inferSelect
export type Job = typeof jobs.$inferSelect
export type JobStatus = 'new' | 'saved' | 'applied' | 'dismissed' | 'hidden'
