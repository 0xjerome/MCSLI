export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ai_model_versions: {
        Row: {
          approved_by: string | null
          artifact_uri: string | null
          created_at: string
          created_by: string | null
          dataset_snapshot_at: string | null
          id: string
          metrics: Json
          name: string
          notes: string | null
          status: string
          task: string
          updated_at: string
          version: string
        }
        Insert: {
          approved_by?: string | null
          artifact_uri?: string | null
          created_at?: string
          created_by?: string | null
          dataset_snapshot_at?: string | null
          id?: string
          metrics?: Json
          name: string
          notes?: string | null
          status?: string
          task: string
          updated_at?: string
          version: string
        }
        Update: {
          approved_by?: string | null
          artifact_uri?: string | null
          created_at?: string
          created_by?: string | null
          dataset_snapshot_at?: string | null
          id?: string
          metrics?: Json
          name?: string
          notes?: string | null
          status?: string
          task?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_model_versions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_model_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_training_annotations: {
        Row: {
          annotation_type: string
          asset_id: string
          created_at: string
          created_by: string | null
          end_ms: number | null
          id: string
          reviewed_by: string | null
          start_ms: number | null
          status: string
          updated_at: string
          value: string
        }
        Insert: {
          annotation_type: string
          asset_id: string
          created_at?: string
          created_by?: string | null
          end_ms?: number | null
          id?: string
          reviewed_by?: string | null
          start_ms?: number | null
          status?: string
          updated_at?: string
          value: string
        }
        Update: {
          annotation_type?: string
          asset_id?: string
          created_at?: string
          created_by?: string | null
          end_ms?: number | null
          id?: string
          reviewed_by?: string | null
          start_ms?: number | null
          status?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_training_annotations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ai_training_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_training_annotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_training_annotations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_training_assets: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          label: string
          lesson_id: string | null
          media_ref: string
          notes: string | null
          practice_item_id: string | null
          quality_status: string
          reviewed_by: string | null
          sign_language: string
          signer_consent_confirmed: boolean
          source_kind: string
          training_approved: boolean
          training_rights_confirmed: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          lesson_id?: string | null
          media_ref: string
          notes?: string | null
          practice_item_id?: string | null
          quality_status?: string
          reviewed_by?: string | null
          sign_language?: string
          signer_consent_confirmed?: boolean
          source_kind: string
          training_approved?: boolean
          training_rights_confirmed?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          lesson_id?: string | null
          media_ref?: string
          notes?: string | null
          practice_item_id?: string | null
          quality_status?: string
          reviewed_by?: string | null
          sign_language?: string
          signer_consent_confirmed?: boolean
          source_kind?: string
          training_approved?: boolean
          training_rights_confirmed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_training_assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_training_assets_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_training_assets_practice_item_id_fkey"
            columns: ["practice_item_id"]
            isOneToOne: false
            referencedRelation: "practice_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_training_assets_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_attempts: {
        Row: {
          assessed_at: string
          assessed_by: string
          assessment_id: string
          attempt_number: number
          enrollment_id: string
          id: string
          month_id: string
          notes: string | null
          result: Database["public"]["Enums"]["assessment_result"]
          score: number | null
          trainer_feedback: string | null
        }
        Insert: {
          assessed_at?: string
          assessed_by: string
          assessment_id: string
          attempt_number: number
          enrollment_id: string
          id?: string
          month_id: string
          notes?: string | null
          result: Database["public"]["Enums"]["assessment_result"]
          score?: number | null
          trainer_feedback?: string | null
        }
        Update: {
          assessed_at?: string
          assessed_by?: string
          assessment_id?: string
          attempt_number?: number
          enrollment_id?: string
          id?: string
          month_id?: string
          notes?: string | null
          result?: Database["public"]["Enums"]["assessment_result"]
          score?: number | null
          trainer_feedback?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_attempts_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_attempts_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_attempts_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "course_months"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          created_at: string
          created_by: string | null
          enrollment_id: string
          id: string
          is_reassessment: boolean
          month_id: string
          notes: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["assessment_status"]
          trainer_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enrollment_id: string
          id?: string
          is_reassessment?: boolean
          month_id: string
          notes?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["assessment_status"]
          trainer_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enrollment_id?: string
          id?: string
          is_reassessment?: boolean
          month_id?: string
          notes?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["assessment_status"]
          trainer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "course_months"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["user_role"] | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          ip: unknown
          metadata: Json
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          ip?: unknown
          metadata?: Json
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          ip?: unknown
          metadata?: Json
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          certificate_number: string
          certificate_title: string
          completion_date: string
          course_title: string
          enrollment_id: string
          id: string
          issued_at: string
          issued_by: string | null
          pdf_path: string | null
          reissued_from: string | null
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: Database["public"]["Enums"]["certificate_status"]
          student_name: string
          user_id: string
        }
        Insert: {
          certificate_number: string
          certificate_title: string
          completion_date: string
          course_title: string
          enrollment_id: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          pdf_path?: string | null
          reissued_from?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: Database["public"]["Enums"]["certificate_status"]
          student_name: string
          user_id: string
        }
        Update: {
          certificate_number?: string
          certificate_title?: string
          completion_date?: string
          course_title?: string
          enrollment_id?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          pdf_path?: string | null
          reissued_from?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: Database["public"]["Enums"]["certificate_status"]
          student_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_reissued_from_fkey"
            columns: ["reissued_from"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_application_events: {
        Row: {
          actor_id: string | null
          application_id: string
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          application_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string | null
          application_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_application_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "cohort_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_applications: {
        Row: {
          answers: Json
          cohort_id: string
          consent_accepted_at: string | null
          created_at: string
          delivery_mode: string
          email: string
          email_verified_at: string | null
          enrollment_id: string | null
          external_ref: string | null
          full_name: string
          id: string
          internal_notes: string | null
          phone: string | null
          reference: string
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          status: string
          submitted_at: string
          updated_at: string
          user_id: string | null
          verify_token_hash: string | null
        }
        Insert: {
          answers?: Json
          cohort_id: string
          consent_accepted_at?: string | null
          created_at?: string
          delivery_mode: string
          email: string
          email_verified_at?: string | null
          enrollment_id?: string | null
          external_ref?: string | null
          full_name: string
          id?: string
          internal_notes?: string | null
          phone?: string | null
          reference: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string | null
          verify_token_hash?: string | null
        }
        Update: {
          answers?: Json
          cohort_id?: string
          consent_accepted_at?: string | null
          created_at?: string
          delivery_mode?: string
          email?: string
          email_verified_at?: string | null
          enrollment_id?: string | null
          external_ref?: string | null
          full_name?: string
          id?: string
          internal_notes?: string | null
          phone?: string | null
          reference?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string | null
          verify_token_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cohort_applications_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_applications_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_questions: {
        Row: {
          cohort_id: string
          created_at: string
          help_text: string | null
          id: string
          is_active: boolean
          is_sensitive: boolean
          key: string
          label: string
          options: Json
          position: number
          question_type: string
          required: boolean
          updated_at: string
        }
        Insert: {
          cohort_id: string
          created_at?: string
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_sensitive?: boolean
          key: string
          label: string
          options?: Json
          position?: number
          question_type: string
          required?: boolean
          updated_at?: string
        }
        Update: {
          cohort_id?: string
          created_at?: string
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_sensitive?: boolean
          key?: string
          label?: string
          options?: Json
          position?: number
          question_type?: string
          required?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_questions_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorts: {
        Row: {
          announcement_url: string | null
          application_deadline: string | null
          application_opens_at: string | null
          auto_accept: boolean
          capacity: number | null
          certificate_description: string | null
          cohort_number: number | null
          completion_summary: string | null
          course_id: string
          created_at: string
          currency: string
          delivery_mode: string
          description: string | null
          eligibility: string | null
          end_date: string | null
          fallback_form_url: string | null
          hero_image_path: string | null
          id: string
          is_featured: boolean
          is_open: boolean
          is_published: boolean
          name: string
          online_details: string | null
          physical_location: string | null
          registration_fee: number | null
          schedule_notes: string | null
          slug: string | null
          sources: Json
          start_date: string | null
          status_override: string | null
          tagline: string | null
          tuition_online: number | null
          tuition_physical: number | null
          updated_at: string
          verified_participant_count: number | null
        }
        Insert: {
          announcement_url?: string | null
          application_deadline?: string | null
          application_opens_at?: string | null
          auto_accept?: boolean
          capacity?: number | null
          certificate_description?: string | null
          cohort_number?: number | null
          completion_summary?: string | null
          course_id: string
          created_at?: string
          currency?: string
          delivery_mode?: string
          description?: string | null
          eligibility?: string | null
          end_date?: string | null
          fallback_form_url?: string | null
          hero_image_path?: string | null
          id?: string
          is_featured?: boolean
          is_open?: boolean
          is_published?: boolean
          name: string
          online_details?: string | null
          physical_location?: string | null
          registration_fee?: number | null
          schedule_notes?: string | null
          slug?: string | null
          sources?: Json
          start_date?: string | null
          status_override?: string | null
          tagline?: string | null
          tuition_online?: number | null
          tuition_physical?: number | null
          updated_at?: string
          verified_participant_count?: number | null
        }
        Update: {
          announcement_url?: string | null
          application_deadline?: string | null
          application_opens_at?: string | null
          auto_accept?: boolean
          capacity?: number | null
          certificate_description?: string | null
          cohort_number?: number | null
          completion_summary?: string | null
          course_id?: string
          created_at?: string
          currency?: string
          delivery_mode?: string
          description?: string | null
          eligibility?: string | null
          end_date?: string | null
          fallback_form_url?: string | null
          hero_image_path?: string | null
          id?: string
          is_featured?: boolean
          is_open?: boolean
          is_published?: boolean
          name?: string
          online_details?: string | null
          physical_location?: string | null
          registration_fee?: number | null
          schedule_notes?: string | null
          slug?: string | null
          sources?: Json
          start_date?: string | null
          status_override?: string | null
          tagline?: string | null
          tuition_online?: number | null
          tuition_physical?: number | null
          updated_at?: string
          verified_participant_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cohorts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          body: string
          created_at: string
          email: string
          full_name: string
          id: string
          kind: string
          metadata: Json
          phone: string | null
          status: string
          subject: string | null
        }
        Insert: {
          body: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          kind?: string
          metadata?: Json
          phone?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          kind?: string
          metadata?: Json
          phone?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: []
      }
      course_months: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          month_number: number
          requires_assessment: boolean
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          month_number: number
          requires_assessment?: boolean
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          month_number?: number
          requires_assessment?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_months_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          certificate_title: string
          cover_image_path: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          duration_months: number
          id: string
          installment_amounts: Json | null
          installment_count: number
          installment_due_before_month: Json
          installments_enabled: boolean
          is_archived: boolean
          is_published: boolean
          quiz_passing_score: number
          registration_fee: number
          requires_final_exam: boolean
          short_description: string | null
          slug: string
          title: string
          tuition_international: number
          tuition_national: number
          updated_at: string
        }
        Insert: {
          certificate_title?: string
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          duration_months: number
          id?: string
          installment_amounts?: Json | null
          installment_count?: number
          installment_due_before_month?: Json
          installments_enabled?: boolean
          is_archived?: boolean
          is_published?: boolean
          quiz_passing_score?: number
          registration_fee?: number
          requires_final_exam?: boolean
          short_description?: string | null
          slug: string
          title: string
          tuition_international: number
          tuition_national: number
          updated_at?: string
        }
        Update: {
          certificate_title?: string
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          duration_months?: number
          id?: string
          installment_amounts?: Json | null
          installment_count?: number
          installment_due_before_month?: Json
          installments_enabled?: boolean
          is_archived?: boolean
          is_published?: boolean
          quiz_passing_score?: number
          registration_fee?: number
          requires_final_exam?: boolean
          short_description?: string | null
          slug?: string
          title?: string
          tuition_international?: number
          tuition_national?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_posts: {
        Row: {
          author_id: string
          body: string
          created_at: string
          hidden_by: string | null
          id: string
          is_hidden: boolean
          parent_id: string | null
          thread_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          hidden_by?: string | null
          id?: string
          is_hidden?: boolean
          parent_id?: string | null
          thread_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          hidden_by?: string | null
          id?: string
          is_hidden?: boolean
          parent_id?: string | null
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_posts_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_posts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "discussion_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_posts_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "discussion_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_reports: {
        Row: {
          created_at: string
          id: string
          post_id: string | null
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          thread_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          post_id?: string | null
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          thread_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string | null
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discussion_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "discussion_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_reports_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "discussion_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_threads: {
        Row: {
          author_id: string
          body: string
          cohort_id: string | null
          course_id: string
          created_at: string
          hidden_by: string | null
          id: string
          is_announcement: boolean
          is_hidden: boolean
          is_locked: boolean
          is_pinned: boolean
          month_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          cohort_id?: string | null
          course_id: string
          created_at?: string
          hidden_by?: string | null
          id?: string
          is_announcement?: boolean
          is_hidden?: boolean
          is_locked?: boolean
          is_pinned?: boolean
          month_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          cohort_id?: string | null
          course_id?: string
          created_at?: string
          hidden_by?: string | null
          id?: string
          is_announcement?: boolean
          is_hidden?: boolean
          is_locked?: boolean
          is_pinned?: boolean
          month_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_threads_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_threads_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_threads_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_threads_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_threads_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "course_months"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          attempts: number
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          last_error: string | null
          payload: Json
          provider_message_id: string | null
          sent_at: string | null
          status: string
          subject: string
          template: string
          to_email: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          last_error?: string | null
          payload?: Json
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          template: string
          to_email: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          last_error?: string | null
          payload?: Json
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template?: string
          to_email?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          activated_at: string | null
          cohort_id: string | null
          completed_at: string | null
          course_id: string
          created_at: string
          currency: string
          delivery_mode: string | null
          final_approved_at: string | null
          final_approved_by: string | null
          id: string
          installments: Json
          nationality: Database["public"]["Enums"]["nationality_class"]
          plan_type: Database["public"]["Enums"]["payment_plan_type"]
          registration_fee: number
          status: Database["public"]["Enums"]["enrollment_status"]
          tuition_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          cohort_id?: string | null
          completed_at?: string | null
          course_id: string
          created_at?: string
          currency: string
          delivery_mode?: string | null
          final_approved_at?: string | null
          final_approved_by?: string | null
          id?: string
          installments: Json
          nationality: Database["public"]["Enums"]["nationality_class"]
          plan_type: Database["public"]["Enums"]["payment_plan_type"]
          registration_fee: number
          status?: Database["public"]["Enums"]["enrollment_status"]
          tuition_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          cohort_id?: string | null
          completed_at?: string | null
          course_id?: string
          created_at?: string
          currency?: string
          delivery_mode?: string | null
          final_approved_at?: string | null
          final_approved_by?: string | null
          id?: string
          installments?: Json
          nationality?: Database["public"]["Enums"]["nationality_class"]
          plan_type?: Database["public"]["Enums"]["payment_plan_type"]
          registration_fee?: number
          status?: Database["public"]["Enums"]["enrollment_status"]
          tuition_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_final_approved_by_fkey"
            columns: ["final_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          is_online: boolean
          is_published: boolean
          location: string | null
          registration_url: string | null
          starts_at: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_online?: boolean
          is_published?: boolean
          location?: string | null
          registration_url?: string | null
          starts_at: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_online?: boolean
          is_published?: boolean
          location?: string | null
          registration_url?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          answers: Json
          attempt_number: number
          auto_score: number | null
          deadline_at: string | null
          enrollment_id: string
          exam_id: string
          graded_at: string | null
          graded_by: string | null
          grader_feedback: string | null
          id: string
          manual_scores: Json | null
          passed: boolean | null
          question_order: string[]
          results_released_at: string | null
          started_at: string
          status: Database["public"]["Enums"]["exam_attempt_status"]
          submitted_at: string | null
          total_score: number | null
        }
        Insert: {
          answers?: Json
          attempt_number: number
          auto_score?: number | null
          deadline_at?: string | null
          enrollment_id: string
          exam_id: string
          graded_at?: string | null
          graded_by?: string | null
          grader_feedback?: string | null
          id?: string
          manual_scores?: Json | null
          passed?: boolean | null
          question_order?: string[]
          results_released_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["exam_attempt_status"]
          submitted_at?: string | null
          total_score?: number | null
        }
        Update: {
          answers?: Json
          attempt_number?: number
          auto_score?: number | null
          deadline_at?: string | null
          enrollment_id?: string
          exam_id?: string
          graded_at?: string | null
          graded_by?: string | null
          grader_feedback?: string | null
          id?: string
          manual_scores?: Json | null
          passed?: boolean | null
          question_order?: string[]
          results_released_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["exam_attempt_status"]
          submitted_at?: string | null
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          correct_answer: Json | null
          created_at: string
          exam_id: string
          id: string
          options: Json
          points: number
          position: number
          prompt: string
          question_type: Database["public"]["Enums"]["question_type"]
          requires_manual_grading: boolean
          video_path: string | null
          video_url: string | null
        }
        Insert: {
          correct_answer?: Json | null
          created_at?: string
          exam_id: string
          id?: string
          options?: Json
          points?: number
          position?: number
          prompt: string
          question_type?: Database["public"]["Enums"]["question_type"]
          requires_manual_grading?: boolean
          video_path?: string | null
          video_url?: string | null
        }
        Update: {
          correct_answer?: Json | null
          created_at?: string
          exam_id?: string
          id?: string
          options?: Json
          points?: number
          position?: number
          prompt?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          requires_manual_grading?: boolean
          video_path?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          closes_at: string | null
          course_id: string
          created_at: string
          created_by: string | null
          id: string
          instructions: string | null
          is_final: boolean
          max_attempts: number
          month_id: string | null
          opens_at: string | null
          passing_score: number
          randomize_questions: boolean
          status: Database["public"]["Enums"]["exam_status"]
          time_limit_minutes: number | null
          title: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          course_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          is_final?: boolean
          max_attempts?: number
          month_id?: string | null
          opens_at?: string | null
          passing_score?: number
          randomize_questions?: boolean
          status?: Database["public"]["Enums"]["exam_status"]
          time_limit_minutes?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          course_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          is_final?: boolean
          max_attempts?: number
          month_id?: string | null
          opens_at?: string | null
          passing_score?: number
          randomize_questions?: boolean
          status?: Database["public"]["Enums"]["exam_status"]
          time_limit_minutes?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "course_months"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_documents: {
        Row: {
          deleted_at: string | null
          file_name: string
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_at: string
          user_id: string
          verification_id: string
        }
        Insert: {
          deleted_at?: string | null
          file_name: string
          id?: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_at?: string
          user_id: string
          verification_id: string
        }
        Update: {
          deleted_at?: string | null
          file_name?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          uploaded_at?: string
          user_id?: string
          verification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_documents_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "identity_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_verifications: {
        Row: {
          consent_given_at: string
          created_at: string
          doc_type: Database["public"]["Enums"]["identity_doc_type"]
          full_name_on_document: string
          id: string
          id_number_encrypted: string
          id_number_hash: string
          id_number_last4: string | null
          issuing_country: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["identity_status"]
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          consent_given_at?: string
          created_at?: string
          doc_type: Database["public"]["Enums"]["identity_doc_type"]
          full_name_on_document: string
          id?: string
          id_number_encrypted: string
          id_number_hash: string
          id_number_last4?: string | null
          issuing_country: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["identity_status"]
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          consent_given_at?: string
          created_at?: string
          doc_type?: Database["public"]["Enums"]["identity_doc_type"]
          full_name_on_document?: string
          id?: string
          id_number_encrypted?: string
          id_number_hash?: string
          id_number_last4?: string | null
          issuing_country?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["identity_status"]
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          enrollment_id: string
          last_position_seconds: number
          lesson_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          enrollment_id: string
          last_position_seconds?: number
          lesson_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          enrollment_id?: string
          last_position_seconds?: number
          lesson_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_resources: {
        Row: {
          created_at: string
          external_url: string | null
          id: string
          is_downloadable: boolean
          lesson_id: string
          storage_path: string | null
          title: string
        }
        Insert: {
          created_at?: string
          external_url?: string | null
          id?: string
          is_downloadable?: boolean
          lesson_id: string
          storage_path?: string | null
          title: string
        }
        Update: {
          created_at?: string
          external_url?: string | null
          id?: string
          is_downloadable?: boolean
          lesson_id?: string
          storage_path?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_resources_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          captions_path: string | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          is_published: boolean
          is_required: boolean
          module_id: string
          objectives: string[]
          position: number
          thumbnail_path: string | null
          title: string
          transcript: string | null
          updated_at: string
          video_path: string | null
          video_url: string | null
        }
        Insert: {
          captions_path?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_published?: boolean
          is_required?: boolean
          module_id: string
          objectives?: string[]
          position?: number
          thumbnail_path?: string | null
          title: string
          transcript?: string | null
          updated_at?: string
          video_path?: string | null
          video_url?: string | null
        }
        Update: {
          captions_path?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_published?: boolean
          is_required?: boolean
          module_id?: string
          objectives?: string[]
          position?: number
          thumbnail_path?: string | null
          title?: string
          transcript?: string | null
          updated_at?: string
          video_path?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          month_id: string
          position: number
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          month_id: string
          position?: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          month_id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "course_months"
            referencedColumns: ["id"]
          },
        ]
      }
      month_overrides: {
        Row: {
          created_at: string
          created_by: string
          enrollment_id: string
          id: string
          month_id: string
          reason: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          enrollment_id: string
          id?: string
          month_id: string
          reason: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          enrollment_id?: string
          id?: string
          month_id?: string
          reason?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "month_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "month_overrides_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "month_overrides_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "course_months"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "month_overrides_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          account_name: string | null
          account_number: string | null
          bank_name: string | null
          branch: string | null
          currency: string
          display_name: string
          id: string
          instructions: string | null
          is_enabled: boolean
          merchant_code: string | null
          method_type: Database["public"]["Enums"]["payment_method_type"]
          position: number
          swift_code: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          branch?: string | null
          currency?: string
          display_name: string
          id?: string
          instructions?: string | null
          is_enabled?: boolean
          merchant_code?: string | null
          method_type: Database["public"]["Enums"]["payment_method_type"]
          position?: number
          swift_code?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          branch?: string | null
          currency?: string
          display_name?: string
          id?: string
          instructions?: string | null
          is_enabled?: boolean
          merchant_code?: string | null
          method_type?: Database["public"]["Enums"]["payment_method_type"]
          position?: number
          swift_code?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          enrollment_id: string
          id: string
          installment_number: number | null
          method_id: string | null
          method_type: Database["public"]["Enums"]["payment_method_type"]
          paid_at: string
          payer_name: string
          proof_path: string | null
          purpose: Database["public"]["Enums"]["payment_purpose"]
          receipt_number: string | null
          reference: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          enrollment_id: string
          id?: string
          installment_number?: number | null
          method_id?: string | null
          method_type: Database["public"]["Enums"]["payment_method_type"]
          paid_at: string
          payer_name: string
          proof_path?: string | null
          purpose: Database["public"]["Enums"]["payment_purpose"]
          receipt_number?: string | null
          reference: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          enrollment_id?: string
          id?: string
          installment_number?: number | null
          method_id?: string | null
          method_type?: Database["public"]["Enums"]["payment_method_type"]
          paid_at?: string
          payer_name?: string
          proof_path?: string | null
          purpose?: Database["public"]["Enums"]["payment_purpose"]
          receipt_number?: string | null
          reference?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_events: {
        Row: {
          created_at: string
          difficulty: string | null
          enrollment_id: string
          id: string
          is_correct: boolean
          question_id: string | null
          topic: string | null
        }
        Insert: {
          created_at?: string
          difficulty?: string | null
          enrollment_id: string
          id?: string
          is_correct: boolean
          question_id?: string | null
          topic?: string | null
        }
        Update: {
          created_at?: string
          difficulty?: string | null
          enrollment_id?: string
          id?: string
          is_correct?: boolean
          question_id?: string | null
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_events_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          month_id: string
          movement_notes: string | null
          position: number
          thumbnail_path: string | null
          title: string
          video_path: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          month_id: string
          movement_notes?: string | null
          position?: number
          thumbnail_path?: string | null
          title: string
          video_path?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          month_id?: string
          movement_notes?: string | null
          position?: number
          thumbnail_path?: string | null
          title?: string
          video_path?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_items_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "course_months"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          avatar_path: string | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          full_name: string
          id: string
          nationality: Database["public"]["Enums"]["nationality_class"]
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_path?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          full_name: string
          id: string
          nationality?: Database["public"]["Enums"]["nationality_class"]
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_path?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          full_name?: string
          id?: string
          nationality?: Database["public"]["Enums"]["nationality_class"]
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      quiz_attempt_questions: {
        Row: {
          answer: Json | null
          attempt_id: string
          correct_answer: Json
          difficulty: string | null
          explanation: string | null
          id: string
          is_correct: boolean | null
          options: Json
          points: number
          position: number
          prompt: string
          question_id: string | null
          question_type: Database["public"]["Enums"]["question_type"]
          question_version: number
          topic: string | null
          video_path: string | null
          video_url: string | null
        }
        Insert: {
          answer?: Json | null
          attempt_id: string
          correct_answer: Json
          difficulty?: string | null
          explanation?: string | null
          id?: string
          is_correct?: boolean | null
          options: Json
          points: number
          position: number
          prompt: string
          question_id?: string | null
          question_type: Database["public"]["Enums"]["question_type"]
          question_version?: number
          topic?: string | null
          video_path?: string | null
          video_url?: string | null
        }
        Update: {
          answer?: Json | null
          attempt_id?: string
          correct_answer?: Json
          difficulty?: string | null
          explanation?: string | null
          id?: string
          is_correct?: boolean | null
          options?: Json
          points?: number
          position?: number
          prompt?: string
          question_id?: string | null
          question_type?: Database["public"]["Enums"]["question_type"]
          question_version?: number
          topic?: string | null
          video_path?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempt_questions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempt_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json
          attempt_number: number
          bank_snapshot_at: string | null
          earned_points: number | null
          enrollment_id: string
          id: string
          passed: boolean | null
          quiz_id: string
          quiz_version: number | null
          score: number | null
          started_at: string
          status: string
          submitted_at: string | null
          total_points: number | null
          updated_at: string
        }
        Insert: {
          answers: Json
          attempt_number: number
          bank_snapshot_at?: string | null
          earned_points?: number | null
          enrollment_id: string
          id?: string
          passed?: boolean | null
          quiz_id: string
          quiz_version?: number | null
          score?: number | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          total_points?: number | null
          updated_at?: string
        }
        Update: {
          answers?: Json
          attempt_number?: number
          bank_snapshot_at?: string | null
          earned_points?: number | null
          enrollment_id?: string
          id?: string
          passed?: boolean | null
          quiz_id?: string
          quiz_version?: number | null
          score?: number | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          total_points?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_generation_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          difficulty_mix: Json
          error: string | null
          generated_count: number
          id: string
          model: string | null
          provider: string | null
          quiz_id: string
          requested_by: string
          requested_count: number
          source_lesson_ids: string[]
          source_practice_ids: string[]
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          difficulty_mix?: Json
          error?: string | null
          generated_count?: number
          id?: string
          model?: string | null
          provider?: string | null
          quiz_id: string
          requested_by: string
          requested_count: number
          source_lesson_ids?: string[]
          source_practice_ids?: string[]
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          difficulty_mix?: Json
          error?: string | null
          generated_count?: number
          id?: string
          model?: string | null
          provider?: string | null
          quiz_id?: string
          requested_by?: string
          requested_count?: number
          source_lesson_ids?: string[]
          source_practice_ids?: string[]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_generation_runs_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_generation_runs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          allow_practice: boolean
          correct_answer: Json
          created_at: string
          created_by: string | null
          difficulty: string
          explanation: string | null
          generation_id: string | null
          id: string
          learning_objective: string | null
          lesson_id: string | null
          options: Json
          points: number
          position: number
          practice_item_id: string | null
          prompt: string
          question_type: Database["public"]["Enums"]["question_type"]
          quiz_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          status: string
          topic: string | null
          updated_at: string
          version: number
          video_path: string | null
          video_url: string | null
        }
        Insert: {
          allow_practice?: boolean
          correct_answer: Json
          created_at?: string
          created_by?: string | null
          difficulty?: string
          explanation?: string | null
          generation_id?: string | null
          id?: string
          learning_objective?: string | null
          lesson_id?: string | null
          options?: Json
          points?: number
          position?: number
          practice_item_id?: string | null
          prompt: string
          question_type?: Database["public"]["Enums"]["question_type"]
          quiz_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          topic?: string | null
          updated_at?: string
          version?: number
          video_path?: string | null
          video_url?: string | null
        }
        Update: {
          allow_practice?: boolean
          correct_answer?: Json
          created_at?: string
          created_by?: string | null
          difficulty?: string
          explanation?: string | null
          generation_id?: string | null
          id?: string
          learning_objective?: string | null
          lesson_id?: string | null
          options?: Json
          points?: number
          position?: number
          practice_item_id?: string | null
          prompt?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          quiz_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          topic?: string | null
          updated_at?: string
          version?: number
          video_path?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_practice_item_id_fkey"
            columns: ["practice_item_id"]
            isOneToOne: false
            referencedRelation: "practice_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          avoid_recent_questions: boolean
          blueprint: Json
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          is_required: boolean
          max_attempts: number | null
          module_id: string | null
          month_id: string
          passing_score: number | null
          questions_per_attempt: number | null
          randomize_options: boolean
          randomize_questions: boolean
          reveal_policy: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          avoid_recent_questions?: boolean
          blueprint?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          is_required?: boolean
          max_attempts?: number | null
          module_id?: string | null
          month_id: string
          passing_score?: number | null
          questions_per_attempt?: number | null
          randomize_options?: boolean
          randomize_questions?: boolean
          reveal_policy?: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          avoid_recent_questions?: boolean
          blueprint?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          is_required?: boolean
          max_attempts?: number | null
          module_id?: string | null
          month_id?: string
          passing_score?: number | null
          questions_per_attempt?: number | null
          randomize_options?: boolean
          randomize_questions?: boolean
          reveal_policy?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "course_months"
            referencedColumns: ["id"]
          },
        ]
      }
      site_content: {
        Row: {
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "site_content_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["user_role"]
          status: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          email: string
          expires_at: string
          full_name: string
          id?: string
          invited_by: string
          role: Database["public"]["Enums"]["user_role"]
          status?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_staff: boolean
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_staff?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_staff?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          created_at: string
          id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_assignments: {
        Row: {
          assigned_by: string | null
          can_grade_exams: boolean
          can_moderate: boolean
          cohort_id: string | null
          course_id: string
          created_at: string
          id: string
          trainer_id: string
        }
        Insert: {
          assigned_by?: string | null
          can_grade_exams?: boolean
          can_moderate?: boolean
          cohort_id?: string | null
          course_id: string
          created_at?: string
          id?: string
          trainer_id: string
        }
        Update: {
          assigned_by?: string | null
          can_grade_exams?: boolean
          can_moderate?: boolean
          cohort_id?: string | null
          course_id?: string
          created_at?: string
          id?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_assignments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_assignments_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      exam_questions_student: {
        Row: {
          exam_id: string | null
          id: string | null
          options: Json | null
          points: number | null
          position: number | null
          prompt: string | null
          question_type: Database["public"]["Enums"]["question_type"] | null
          requires_manual_grading: boolean | null
          video_path: string | null
          video_url: string | null
        }
        Insert: {
          exam_id?: string | null
          id?: string | null
          options?: Json | null
          points?: number | null
          position?: number | null
          prompt?: string | null
          question_type?: Database["public"]["Enums"]["question_type"] | null
          requires_manual_grading?: boolean | null
          video_path?: string | null
          video_url?: string | null
        }
        Update: {
          exam_id?: string | null
          id?: string | null
          options?: Json | null
          points?: number | null
          position?: number | null
          prompt?: string | null
          question_type?: Database["public"]["Enums"]["question_type"] | null
          requires_manual_grading?: boolean | null
          video_path?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_staff_invitation: { Args: { p_token: string }; Returns: Json }
      account_is_active: { Args: never; Returns: boolean }
      admin_dashboard_stats: { Args: never; Returns: Json }
      admin_find_identity_by_number: {
        Args: { p_id_number: string }
        Returns: {
          full_name_on_document: string
          status: Database["public"]["Enums"]["identity_status"]
          submitted_at: string
          user_id: string
          verification_id: string
        }[]
      }
      admin_list_identities: {
        Args: { p_status?: Database["public"]["Enums"]["identity_status"] }
        Returns: {
          consent_given_at: string
          doc_type: Database["public"]["Enums"]["identity_doc_type"]
          full_name_on_document: string
          id: string
          id_number_masked: string
          issuing_country: string
          rejection_reason: string
          reviewed_at: string
          reviewed_by: string
          status: Database["public"]["Enums"]["identity_status"]
          submitted_at: string
          user_id: string
        }[]
      }
      admin_reveal_identity_number: {
        Args: { p_reason?: string; p_verification_id: string }
        Returns: string
      }
      admin_set_account_status: {
        Args: {
          p_reason?: string
          p_status: Database["public"]["Enums"]["account_status"]
          p_user_id: string
        }
        Returns: undefined
      }
      admin_set_enrollment_status: {
        Args: {
          p_enrollment_id: string
          p_reason?: string
          p_status: Database["public"]["Enums"]["enrollment_status"]
        }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["user_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      approve_enrollment_completion: {
        Args: { p_enrollment_id: string }
        Returns: undefined
      }
      assign_application_enrollment: {
        Args: { p_application_id: string; p_enrollment_id: string }
        Returns: Json
      }
      authorize_identity_document_access: {
        Args: { p_document_id: string }
        Returns: string
      }
      bootstrap_super_admin: { Args: { p_email: string }; Returns: string }
      can_edit_quiz: { Args: { p_quiz_id: string }; Returns: boolean }
      can_handle_ticket: { Args: { p_ticket_id: string }; Returns: boolean }
      can_manage_enrollment: {
        Args: { p_enrollment_id: string }
        Returns: boolean
      }
      can_moderate_thread: { Args: { p_thread_id: string }; Returns: boolean }
      cancel_staff_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      check_practice_answer: {
        Args: { p_answer: Json; p_question_id: string }
        Returns: Json
      }
      claim_email_batch: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          last_error: string | null
          payload: Json
          provider_message_id: string | null
          sent_at: string | null
          status: string
          subject: string
          template: string
          to_email: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "email_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_email: {
        Args: {
          p_error?: string
          p_id: string
          p_ok: boolean
          p_provider_id?: string
        }
        Returns: undefined
      }
      complete_quiz_generation_run: {
        Args: {
          p_drafts?: Json
          p_error?: string
          p_model?: string
          p_provider?: string
          p_run_id: string
          p_status: string
        }
        Returns: Json
      }
      copy_cohort_questions: {
        Args: { p_from_cohort: string; p_to_cohort: string }
        Returns: number
      }
      create_quiz_generation_run: {
        Args: {
          p_difficulty_mix?: Json
          p_include_practice?: boolean
          p_lesson_ids?: string[]
          p_quiz_id: string
          p_requested_count: number
        }
        Returns: Json
      }
      create_staff_invitation: {
        Args: {
          p_email: string
          p_full_name: string
          p_role: Database["public"]["Enums"]["user_role"]
          p_valid_days?: number
        }
        Returns: Json
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      delete_identity_document: {
        Args: { p_document_id: string }
        Returns: undefined
      }
      enroll_in_course: {
        Args: {
          p_cohort_id?: string
          p_course_id: string
          p_plan: Database["public"]["Enums"]["payment_plan_type"]
        }
        Returns: string
      }
      expire_staff_invitations: { Args: never; Returns: number }
      fn_audit: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_target_user?: string
        }
        Returns: undefined
      }
      fn_build_installments: {
        Args: {
          p_course_id: string
          p_nationality: Database["public"]["Enums"]["nationality_class"]
          p_plan: Database["public"]["Enums"]["payment_plan_type"]
        }
        Returns: Json
      }
      fn_certificate_eligibility: {
        Args: { p_enrollment_id: string }
        Returns: Json
      }
      fn_cohort_applications_state: {
        Args: { c: Database["public"]["Tables"]["cohorts"]["Row"] }
        Returns: string
      }
      fn_cohort_phase: {
        Args: { c: Database["public"]["Tables"]["cohorts"]["Row"] }
        Returns: string
      }
      fn_confirmed_totals: {
        Args: { p_enrollment_id: string }
        Returns: {
          registration: number
          tuition: number
        }[]
      }
      fn_course_publish_problems: {
        Args: { p_course_id: string }
        Returns: string[]
      }
      fn_exam_is_open: {
        Args: { p_exam: Database["public"]["Tables"]["exams"]["Row"] }
        Returns: boolean
      }
      fn_generate_certificate_number: { Args: never; Returns: string }
      fn_generate_receipt_number: { Args: never; Returns: string }
      fn_hash_token: { Args: { p_token: string }; Returns: string }
      fn_month_access: {
        Args: { p_enrollment_id: string; p_month_number: number }
        Returns: Json
      }
      fn_month_requirements_incomplete: {
        Args: { p_enrollment_id: string; p_month_id: string }
        Returns: Json
      }
      fn_notify: {
        Args: {
          p_body?: string
          p_link?: string
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_user: string
        }
        Returns: undefined
      }
      fn_notify_if_month_unlocked: {
        Args: { p_enrollment_id: string }
        Returns: undefined
      }
      fn_queue_email: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_payload: Json
          p_subject: string
          p_template: string
          p_user: string
        }
        Returns: undefined
      }
      fn_quiz_publish_problems: {
        Args: { p_quiz_id: string }
        Returns: string[]
      }
      fn_student_can_access_lesson: {
        Args: { p_lesson_id: string }
        Returns: boolean
      }
      fn_student_can_access_month: {
        Args: { p_month_id: string }
        Returns: boolean
      }
      fn_student_enrolled_in_course: {
        Args: { p_course_id: string }
        Returns: boolean
      }
      get_certificate_eligibility: {
        Args: { p_enrollment_id: string }
        Returns: Json
      }
      get_course_publish_problems: {
        Args: { p_course_id: string }
        Returns: string[]
      }
      get_my_course_map: { Args: { p_enrollment_id: string }; Returns: Json }
      get_my_identity: {
        Args: never
        Returns: {
          consent_given_at: string
          doc_type: Database["public"]["Enums"]["identity_doc_type"]
          full_name_on_document: string
          id: string
          id_number_masked: string
          issuing_country: string
          rejection_reason: string
          reviewed_at: string
          reviewed_by: string
          status: Database["public"]["Enums"]["identity_status"]
          submitted_at: string
          user_id: string
        }[]
      }
      get_public_settings: { Args: never; Returns: Json }
      get_quiz_attempt: { Args: { p_attempt_id: string }; Returns: Json }
      get_quiz_publish_problems: {
        Args: { p_quiz_id: string }
        Returns: string[]
      }
      get_site_content_public: {
        Args: never
        Returns: {
          key: string
          updated_at: string
          value: Json
        }[]
      }
      grade_exam_attempt: {
        Args: {
          p_attempt_id: string
          p_feedback?: string
          p_manual_scores: Json
        }
        Returns: Json
      }
      import_cohort_applications: {
        Args: { p_cohort_id: string; p_dry_run?: boolean; p_rows: Json }
        Returns: Json
      }
      import_quiz_questions: {
        Args: { p_questions: Json; p_quiz_id: string }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_trainer: { Args: never; Returns: boolean }
      issue_certificate: {
        Args: { p_completion_date?: string; p_enrollment_id: string }
        Returns: string
      }
      list_quiz_generation_runs: {
        Args: { p_quiz_id: string }
        Returns: {
          completed_at: string | null
          created_at: string
          difficulty_mix: Json
          error: string | null
          generated_count: number
          id: string
          model: string | null
          provider: string | null
          quiz_id: string
          requested_by: string
          requested_count: number
          source_lesson_ids: string[]
          source_practice_ids: string[]
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "quiz_generation_runs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_staff_invitations: {
        Args: never
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["user_role"]
          status: string
          token_hash: string
        }[]
        SetofOptions: {
          from: "*"
          to: "staff_invitations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mark_cohort_completed: {
        Args: {
          p_cohort_id: string
          p_participants?: number
          p_summary?: string
        }
        Returns: undefined
      }
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: number }
      mask_identifier: { Args: { p: string }; Returns: string }
      moderate_discussion: {
        Args: {
          p_hidden?: boolean
          p_locked?: boolean
          p_pinned?: boolean
          p_post_id?: string
          p_thread_id?: string
        }
        Returns: undefined
      }
      my_cohort_applications: { Args: never; Returns: Json[] }
      my_enrollable_cohorts: { Args: { p_course_id: string }; Returns: Json[] }
      my_exam_attempts: {
        Args: { p_enrollment_id: string }
        Returns: {
          answers: Json
          attempt_number: number
          deadline_at: string
          enrollment_id: string
          exam_id: string
          grader_feedback: string
          id: string
          passed: boolean
          question_order: string[]
          results_released_at: string
          started_at: string
          status: Database["public"]["Enums"]["exam_attempt_status"]
          submitted_at: string
          total_score: number
        }[]
      }
      my_topic_progress: {
        Args: { p_enrollment_id: string }
        Returns: {
          accuracy: number
          practice_answered: number
          practice_correct: number
          quiz_answered: number
          quiz_correct: number
          topic: string
        }[]
      }
      override_month_unlock: {
        Args: { p_enrollment_id: string; p_month_id: string; p_reason: string }
        Returns: string
      }
      owns_enrollment: { Args: { p_enrollment_id: string }; Returns: boolean }
      practice_questions: {
        Args: { p_count?: number; p_month_id: string; p_topic?: string }
        Returns: Json
      }
      preview_quiz_selection: { Args: { p_quiz_id: string }; Returns: Json }
      public_cohort: { Args: { p_slug: string }; Returns: Json }
      public_cohorts: { Args: never; Returns: Json[] }
      public_profiles_lookup: {
        Args: { p_ids: string[] }
        Returns: {
          avatar_path: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      record_assessment_result: {
        Args: {
          p_assessment_id: string
          p_feedback?: string
          p_notes?: string
          p_result: Database["public"]["Enums"]["assessment_result"]
          p_score: number
        }
        Returns: string
      }
      register_identity_document: {
        Args: {
          p_file_name: string
          p_mime: string
          p_size: number
          p_storage_path: string
        }
        Returns: string
      }
      reissue_certificate: {
        Args: {
          p_certificate_id: string
          p_reason: string
          p_student_name?: string
        }
        Returns: string
      }
      release_exam_results: { Args: { p_exam_id: string }; Returns: number }
      review_cohort_application: {
        Args: { p_application_id: string; p_decision: string; p_note?: string }
        Returns: Json
      }
      review_identity: {
        Args: {
          p_decision: Database["public"]["Enums"]["identity_status"]
          p_reason?: string
          p_verification_id: string
        }
        Returns: undefined
      }
      review_payment: {
        Args: {
          p_decision: Database["public"]["Enums"]["payment_status"]
          p_note?: string
          p_payment_id: string
        }
        Returns: undefined
      }
      review_quiz_question: {
        Args: { p_decision: string; p_note?: string; p_question_id: string }
        Returns: undefined
      }
      revoke_certificate: {
        Args: { p_certificate_id: string; p_reason: string }
        Returns: undefined
      }
      revoke_month_override: {
        Args: { p_override_id: string; p_reason: string }
        Returns: undefined
      }
      save_exam_answers: {
        Args: { p_answers: Json; p_attempt_id: string }
        Returns: Json
      }
      save_lesson_progress: {
        Args: {
          p_completed?: boolean
          p_lesson_id: string
          p_position_seconds: number
        }
        Returns: undefined
      }
      save_quiz_answers: {
        Args: { p_answers: Json; p_attempt_id: string }
        Returns: Json
      }
      schedule_assessment: {
        Args: {
          p_enrollment_id: string
          p_month_id: string
          p_notes?: string
          p_scheduled_at: string
          p_trainer_id?: string
        }
        Returns: string
      }
      seed_default_cohort_questions: {
        Args: { p_cohort_id: string }
        Returns: number
      }
      send_cohort_start_reminder: {
        Args: { p_cohort_id: string; p_message?: string }
        Returns: number
      }
      set_cohort_application_notes: {
        Args: { p_application_id: string; p_notes: string }
        Returns: undefined
      }
      set_cohort_applications_open: {
        Args: { p_cohort_id: string; p_open: boolean }
        Returns: undefined
      }
      set_platform_setting: {
        Args: { p_key: string; p_value: Json }
        Returns: undefined
      }
      set_site_content: {
        Args: { p_key: string; p_public?: boolean; p_value: Json }
        Returns: undefined
      }
      staff_cohort_stats: { Args: { p_cohort_id: string }; Returns: Json }
      staff_exam_attempts: {
        Args: { p_enrollment_id?: string; p_exam_id?: string }
        Returns: {
          answers: Json
          attempt_number: number
          auto_score: number | null
          deadline_at: string | null
          enrollment_id: string
          exam_id: string
          graded_at: string | null
          graded_by: string | null
          grader_feedback: string | null
          id: string
          manual_scores: Json | null
          passed: boolean | null
          question_order: string[]
          results_released_at: string | null
          started_at: string
          status: Database["public"]["Enums"]["exam_attempt_status"]
          submitted_at: string | null
          total_score: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "exam_attempts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      staff_exam_questions: {
        Args: { p_exam_id: string }
        Returns: {
          correct_answer: Json | null
          created_at: string
          exam_id: string
          id: string
          options: Json
          points: number
          position: number
          prompt: string
          question_type: Database["public"]["Enums"]["question_type"]
          requires_manual_grading: boolean
          video_path: string | null
          video_url: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "exam_questions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      staff_mfa_satisfied: { Args: never; Returns: boolean }
      staff_question_stats: {
        Args: { p_quiz_id: string }
        Returns: {
          answered: number
          correct_count: number
          correct_pct: number
          flag: string
          last_used: string
          question_id: string
          times_used: number
        }[]
      }
      staff_quiz_attempt_detail: {
        Args: { p_attempt_id: string }
        Returns: Json
      }
      staff_quiz_questions: {
        Args: { p_quiz_id: string }
        Returns: {
          allow_practice: boolean
          correct_answer: Json
          created_at: string
          created_by: string | null
          difficulty: string
          explanation: string | null
          generation_id: string | null
          id: string
          learning_objective: string | null
          lesson_id: string | null
          options: Json
          points: number
          position: number
          practice_item_id: string | null
          prompt: string
          question_type: Database["public"]["Enums"]["question_type"]
          quiz_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          status: string
          topic: string | null
          updated_at: string
          version: number
          video_path: string | null
          video_url: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "quiz_questions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      staff_quiz_stats: { Args: { p_quiz_id: string }; Returns: Json }
      start_exam_attempt: { Args: { p_exam_id: string }; Returns: Json }
      start_quiz_attempt: { Args: { p_quiz_id: string }; Returns: Json }
      storage_path_owner: { Args: { p_name: string }; Returns: boolean }
      submit_cohort_application: {
        Args: {
          p_answers?: Json
          p_consent?: boolean
          p_delivery_mode: string
          p_email: string
          p_full_name: string
          p_phone: string
          p_slug: string
          p_website?: string
        }
        Returns: Json
      }
      submit_exam_attempt: { Args: { p_attempt_id: string }; Returns: Json }
      submit_identity: {
        Args: {
          p_consent: boolean
          p_doc_type: Database["public"]["Enums"]["identity_doc_type"]
          p_full_name: string
          p_id_number: string
          p_issuing_country: string
        }
        Returns: string
      }
      submit_payment: {
        Args: {
          p_amount: number
          p_enrollment_id: string
          p_installment_number: number
          p_method_id: string
          p_paid_at: string
          p_payer_name: string
          p_proof_path?: string
          p_purpose: Database["public"]["Enums"]["payment_purpose"]
          p_reference: string
        }
        Returns: string
      }
      submit_quiz_attempt: {
        Args: { p_answers?: Json; p_attempt_id: string }
        Returns: Json
      }
      trainer_assigned_to_course: {
        Args: { p_course_id: string }
        Returns: boolean
      }
      trainer_assigned_to_enrollment: {
        Args: { p_enrollment_id: string }
        Returns: boolean
      }
      trainer_can_view_user: { Args: { p_user_id: string }; Returns: boolean }
      trainer_dashboard_stats: { Args: never; Returns: Json }
      update_ticket_status: {
        Args: {
          p_status: Database["public"]["Enums"]["ticket_status"]
          p_ticket_id: string
        }
        Returns: undefined
      }
      verify_certificate: { Args: { p_number: string }; Returns: Json }
      verify_cohort_application: { Args: { p_token: string }; Returns: Json }
    }
    Enums: {
      account_status: "active" | "suspended"
      assessment_result: "pass" | "not_passed"
      assessment_status: "scheduled" | "completed" | "cancelled"
      certificate_status: "issued" | "revoked"
      enrollment_status:
        | "pending_payment"
        | "active"
        | "completed"
        | "withdrawn"
        | "suspended"
      exam_attempt_status: "in_progress" | "submitted" | "graded"
      exam_status:
        | "draft"
        | "scheduled"
        | "open"
        | "closed"
        | "results_released"
      identity_doc_type: "national_id" | "passport" | "other"
      identity_status: "not_submitted" | "pending" | "verified" | "rejected"
      nationality_class: "ugandan" | "international"
      notification_type:
        | "payment_confirmed"
        | "payment_rejected"
        | "identity_verified"
        | "identity_rejected"
        | "assessment_scheduled"
        | "assessment_passed"
        | "reassessment_required"
        | "month_unlocked"
        | "trainer_announcement"
        | "exam_available"
        | "exam_graded"
        | "certificate_issued"
        | "support_response"
        | "discussion_reply"
        | "system"
      payment_method_type: "bank" | "mtn" | "airtel"
      payment_plan_type: "full" | "installments"
      payment_purpose: "registration" | "tuition"
      payment_status: "pending" | "under_review" | "confirmed" | "rejected"
      question_type:
        | "multiple_choice"
        | "video_multiple_choice"
        | "matching"
        | "practical"
      ticket_category: "payment" | "course" | "technical" | "identity" | "other"
      ticket_status: "open" | "in_progress" | "resolved"
      user_role: "STUDENT" | "TRAINER" | "ADMIN" | "SUPER_ADMIN"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["active", "suspended"],
      assessment_result: ["pass", "not_passed"],
      assessment_status: ["scheduled", "completed", "cancelled"],
      certificate_status: ["issued", "revoked"],
      enrollment_status: [
        "pending_payment",
        "active",
        "completed",
        "withdrawn",
        "suspended",
      ],
      exam_attempt_status: ["in_progress", "submitted", "graded"],
      exam_status: ["draft", "scheduled", "open", "closed", "results_released"],
      identity_doc_type: ["national_id", "passport", "other"],
      identity_status: ["not_submitted", "pending", "verified", "rejected"],
      nationality_class: ["ugandan", "international"],
      notification_type: [
        "payment_confirmed",
        "payment_rejected",
        "identity_verified",
        "identity_rejected",
        "assessment_scheduled",
        "assessment_passed",
        "reassessment_required",
        "month_unlocked",
        "trainer_announcement",
        "exam_available",
        "exam_graded",
        "certificate_issued",
        "support_response",
        "discussion_reply",
        "system",
      ],
      payment_method_type: ["bank", "mtn", "airtel"],
      payment_plan_type: ["full", "installments"],
      payment_purpose: ["registration", "tuition"],
      payment_status: ["pending", "under_review", "confirmed", "rejected"],
      question_type: [
        "multiple_choice",
        "video_multiple_choice",
        "matching",
        "practical",
      ],
      ticket_category: ["payment", "course", "technical", "identity", "other"],
      ticket_status: ["open", "in_progress", "resolved"],
      user_role: ["STUDENT", "TRAINER", "ADMIN", "SUPER_ADMIN"],
    },
  },
} as const

