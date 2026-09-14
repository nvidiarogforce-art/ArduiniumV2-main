/**
 * Two roles only.
 *
 * "Buyer" was dropped because buying is open to anyone who registers — it is
 * not a distinct kind of account. "School representative" was dropped because
 * school access is granted separately rather than self-served through this
 * form. Anything else found in storage is treated as no registration at all,
 * so an older save cannot resurrect a role the product no longer has.
 */
export const ROLES = ['student', 'teacher'] as const
export type Role = (typeof ROLES)[number]

export type Account = {
  role: Role
  fields: Record<string, string>
  /** ISO date, stamped at submit time on the client. */
  createdAt: string
}

export const ACCOUNT_KEY = 'arduinium.account'

export const isRole = (v: unknown): v is Role => ROLES.includes(v as Role)

/** Where each role lands after registering. */
export const ROLE_HOME: Record<Role, string> = {
  student: '/learn',
  teacher: '/teach',
}

export type FieldSpec = {
  key: string
  type: 'text' | 'number' | 'tel' | 'email' | 'select'
  required?: boolean
  /** Key into `t.register.subjects` / `t.register.experienceOptions`. */
  options?: 'subjects' | 'experienceOptions' | 'grades'
}

export const ROLE_FIELDS: Record<Role, FieldSpec[]> = {
  student: [
    { key: 'name', type: 'text', required: true },
    { key: 'grade', type: 'select', options: 'grades' },
    { key: 'school', type: 'text' },
  ],
  teacher: [
    { key: 'name', type: 'text', required: true },
    { key: 'subject', type: 'select', options: 'subjects' },
    { key: 'school', type: 'text', required: true },
    { key: 'experience', type: 'select', options: 'experienceOptions' },
  ],
}
