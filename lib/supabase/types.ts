/**
 * Hand-written schema types for the Phase 2 database.
 *
 * Kept by hand rather than generated so the repo has no codegen step and no
 * generated file that silently rots when nobody re-runs it. It mirrors
 * `supabase/migrations/0001_schema.sql` exactly; change one and change the
 * other. Every query in `lib/db/*` is typed through this, so a column renamed
 * in SQL but not here shows up as a build error rather than a runtime `null`.
 */

export type UserRole = 'student' | 'teacher' | 'school_admin' | 'buyer'
export type LessonStatus = 'not_started' | 'in_progress' | 'completed'
export type VideoTrack = 'student' | 'teacher'
export type PostTag = 'question' | 'idea' | 'success'
export type AiSource = 'standalone' | 'sandbox'
export type AiMessageRole = 'user' | 'assistant'

/** The five buckets `admin_teacher_activity()` reports. Never a live status. */
export type ActivityLevel = 'today' | 'week' | 'fortnight' | 'dormant' | 'never'

export type SchoolRow = {
  id: string
  name: string
  region: string | null
  created_at: string
}

export type ProfileRow = {
  id: string
  full_name: string
  role: UserRole
  school_id: string | null
  locale: string
  grade: string | null
  subject: string | null
  experience: string | null
  school_name: string | null
  created_at: string
}

export type ClassRow = {
  id: string
  school_id: string
  teacher_id: string | null
  name: string
  created_at: string
}

export type EnrollmentRow = {
  id: string
  class_id: string
  student_id: string
  joined_at: string
}

export type LessonRow = {
  id: string
  slug: string
  title_uz: string
  title_en: string
  body_uz: string
  body_en: string
  order_index: number
  has_simulator: boolean
  created_at: string
}

export type LessonProgressRow = {
  id: string
  student_id: string
  lesson_id: string
  status: LessonStatus
  completed_at: string | null
  updated_at: string
}

export type VideoLessonRow = {
  id: string
  slug: string
  title_uz: string
  title_en: string
  track: VideoTrack
  video_url: string | null
  duration_seconds: number
  order_index: number
  created_at: string
}

export type CommunityPostRow = {
  id: string
  author_id: string
  /** Denormalised at write time — see the note in 0001_schema.sql. */
  author_name: string
  author_role: UserRole
  title: string
  body: string
  tag: PostTag
  created_at: string
}

export type AiConversationRow = {
  id: string
  user_id: string
  context_lesson_id: string | null
  source: AiSource
  title: string | null
  created_at: string
}

export type AiMessageRow = {
  id: string
  conversation_id: string
  role: AiMessageRole
  content: string
  created_at: string
}

export type ActivityLogRow = {
  id: string
  user_id: string
  event_type: string
  occurred_at: string
}

/** Shorthand: a table whose Insert allows every generated column to be absent. */
type Table<Row, Optional extends keyof Row> = {
  Row: Row
  Insert: Omit<Row, Optional> & Partial<Pick<Row, Optional>>
  Update: Partial<Row>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      schools: Table<SchoolRow, 'id' | 'created_at' | 'region'>
      profiles: Table<ProfileRow, Exclude<keyof ProfileRow, 'id'>>
      classes: Table<ClassRow, 'id' | 'created_at' | 'teacher_id'>
      class_enrollments: Table<EnrollmentRow, 'id' | 'joined_at'>
      lessons: Table<LessonRow, 'id' | 'created_at' | 'body_uz' | 'body_en' | 'order_index' | 'has_simulator'>
      lesson_progress: Table<LessonProgressRow, 'id' | 'completed_at' | 'updated_at' | 'status'>
      video_lessons: Table<
        VideoLessonRow,
        'id' | 'created_at' | 'video_url' | 'duration_seconds' | 'order_index' | 'track'
      >
      community_posts: Table<CommunityPostRow, 'id' | 'created_at' | 'tag' | 'author_name' | 'author_role'>
      ai_conversations: Table<AiConversationRow, 'id' | 'created_at' | 'context_lesson_id' | 'source' | 'title'>
      ai_messages: Table<AiMessageRow, 'id' | 'created_at'>
      activity_log: Table<ActivityLogRow, 'id' | 'occurred_at'>
    }
    Views: Record<never, never>
    Functions: {
      ai_rate_limit_take: {
        Args: { p_limit: number }
        Returns: { allowed: boolean; used: number; limit_n: number }[]
      }
      ai_rate_limit_refund: { Args: Record<never, never>; Returns: undefined }
      admin_overview: {
        Args: Record<never, never>
        Returns: {
          students: number
          teachers: number
          classes: number
          lessons: number
          completions: number
          completionRate: number
        }
      }
      admin_teacher_activity: {
        Args: Record<never, never>
        Returns: {
          teacher_id: string
          full_name: string
          last_active: string | null
          level: ActivityLevel
          class_count: number
          student_count: number
        }[]
      }
      class_roster: {
        Args: { p_class_id: string }
        Returns: {
          student_id: string
          full_name: string
          grade: string | null
          completed: number
          total: number
          last_active: string | null
        }[]
      }
    }
    Enums: {
      user_role: UserRole
      lesson_status: LessonStatus
      video_track: VideoTrack
      post_tag: PostTag
      ai_source: AiSource
      ai_message_role: AiMessageRole
    }
    CompositeTypes: Record<never, never>
  }
}
