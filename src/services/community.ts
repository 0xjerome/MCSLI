import { getSupabase } from '@/lib/supabase';
import type { DiscussionPost, DiscussionThread, Notification, PublicProfile, SupportMessage, SupportTicket } from '@/types/database';
import type { TicketCategory, TicketStatus } from '@/domain/types';

const sb = () => getSupabase();
function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

/**
 * Attach name/role/avatar of the people referenced by `idField` as `as`. Goes through
 * public_profiles_lookup(), a SECURITY DEFINER function that only returns people the caller may
 * see (self, staff, classmates, managed students) – never other profile columns.
 */
async function attachProfiles<T extends object>(rows: T[], idField: keyof T, as: string): Promise<T[]> {
  const ids = [...new Set(rows.map((r) => r[idField]).filter((v): v is T[keyof T] & string => typeof v === 'string'))];
  if (!ids.length) return rows;
  const profiles = (must(await sb().rpc('public_profiles_lookup', { p_ids: ids })) as PublicProfile[] | null) ?? [];
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return rows.map((r) => ({ ...r, [as]: byId.get(r[idField] as unknown as string) ?? null }));
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export async function listNotifications(limit = 30): Promise<Notification[]> {
  return must(await sb().from('notifications').select('*').order('created_at', { ascending: false }).limit(limit)) as Notification[];
}
export async function countUnread(): Promise<number> {
  const res = await sb().from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  if (res.error) throw res.error;
  return res.count ?? 0;
}
export async function markNotificationsRead(ids?: string[]): Promise<number> {
  return must(await sb().rpc('mark_notifications_read', { p_ids: ids ?? null })) as number;
}

// ---------------------------------------------------------------------------
// Discussions
// ---------------------------------------------------------------------------
export async function listThreads(courseId: string, monthId?: string | null): Promise<DiscussionThread[]> {
  let q = sb().from('discussion_threads').select('*, posts:discussion_posts(count)').eq('course_id', courseId).order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
  if (monthId) q = q.eq('month_id', monthId);
  return attachProfiles(must(await q) as DiscussionThread[], 'author_id', 'author');
}

export async function getThread(threadId: string): Promise<DiscussionThread | null> {
  const t = must(await sb().from('discussion_threads').select('*').eq('id', threadId).maybeSingle()) as DiscussionThread | null;
  return t ? (await attachProfiles([t], 'author_id', 'author'))[0]! : null;
}

export async function listPosts(threadId: string): Promise<DiscussionPost[]> {
  return attachProfiles(must(await sb().from('discussion_posts').select('*').eq('thread_id', threadId).order('created_at')) as DiscussionPost[], 'author_id', 'author');
}

export async function createThread(input: { courseId: string; monthId?: string | null; authorId: string; title: string; body: string; isAnnouncement?: boolean; isPinned?: boolean }): Promise<string> {
  const res = await sb()
    .from('discussion_threads')
    .insert({ course_id: input.courseId, month_id: input.monthId ?? null, author_id: input.authorId, title: input.title.trim(), body: input.body.trim(), is_announcement: Boolean(input.isAnnouncement), is_pinned: Boolean(input.isPinned) })
    .select('id')
    .single();
  return (must(res) as { id: string }).id;
}

export async function createPost(input: { threadId: string; authorId: string; body: string; parentId?: string | null }): Promise<void> {
  must(await sb().from('discussion_posts').insert({ thread_id: input.threadId, author_id: input.authorId, body: input.body.trim(), parent_id: input.parentId ?? null }));
}

export async function reportContent(input: { threadId?: string; postId?: string; reporterId: string; reason: string }): Promise<void> {
  must(await sb().from('discussion_reports').insert({ thread_id: input.threadId ?? null, post_id: input.postId ?? null, reporter_id: input.reporterId, reason: input.reason.trim() }));
}

export async function moderate(input: { threadId?: string; postId?: string; hidden?: boolean; pinned?: boolean; locked?: boolean }): Promise<void> {
  must(await sb().rpc('moderate_discussion', { p_thread_id: input.threadId ?? null, p_post_id: input.postId ?? null, p_hidden: input.hidden ?? null, p_pinned: input.pinned ?? null, p_locked: input.locked ?? null }));
}

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------
export async function listTickets(opts: { all?: boolean; status?: TicketStatus } = {}): Promise<SupportTicket[]> {
  let q = sb().from('support_tickets').select('*').order('updated_at', { ascending: false });
  if (opts.status) q = q.eq('status', opts.status);
  return attachProfiles(must(await q) as SupportTicket[], 'user_id', 'user');
}
export async function getTicket(id: string): Promise<SupportTicket | null> {
  const t = must(await sb().from('support_tickets').select('*').eq('id', id).maybeSingle()) as SupportTicket | null;
  return t ? (await attachProfiles([t], 'user_id', 'user'))[0]! : null;
}
export async function listTicketMessages(ticketId: string): Promise<SupportMessage[]> {
  return attachProfiles(must(await sb().from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at')) as SupportMessage[], 'author_id', 'author');
}
export async function createTicket(input: { userId: string; category: TicketCategory; subject: string; body: string }): Promise<string> {
  const t = must(await sb().from('support_tickets').insert({ user_id: input.userId, category: input.category, subject: input.subject.trim() }).select('id').single()) as { id: string };
  must(await sb().from('support_messages').insert({ ticket_id: t.id, author_id: input.userId, is_staff: false, body: input.body.trim() }));
  return t.id;
}
export async function replyToTicket(input: { ticketId: string; authorId: string; isStaff: boolean; body: string }): Promise<void> {
  must(await sb().from('support_messages').insert({ ticket_id: input.ticketId, author_id: input.authorId, is_staff: input.isStaff, body: input.body.trim() }));
}
export async function setTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
  must(await sb().rpc('update_ticket_status', { p_ticket_id: ticketId, p_status: status }));
}
