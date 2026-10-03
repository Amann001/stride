import { z } from 'zod';

import { activityTypeSchema, type ActivityType } from './schemas';
import type { ActivitySummary } from './types';

// Friends: people, following, kudos, comments, messages, notifications and clubs.

// The smallest useful picture of a person: enough for a name and avatar.
export interface AthleteRef {
  id: string;
  name: string;
}

// A person in a list (search results, suggestions, followers).
export interface AthleteSummary extends AthleteRef {
  location: string | null;
  isFollowing: boolean;
  followsYou: boolean;
  // Why they're suggested, e.g. "Followed by Riya" or "Near you".
  reason?: string;
}

export interface AthleteProfile extends AthleteSummary {
  bio: string | null;
  followerCount: number;
  followingCount: number;
  activityCount: number;
  // Distance this week and this year across all their activities you can see.
  weekDistanceMeters: number;
  yearDistanceMeters: number;
  isMe: boolean;
  // You blocked them: show Unblock instead of Follow.
  blockedByYou: boolean;
}

export interface Comment {
  id: string;
  activityId: string;
  athlete: AthleteRef;
  body: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  other: AthleteRef;
  lastMessage: Message | null;
  unreadCount: number;
}

export type NotificationKind = 'follow' | 'kudos' | 'comment' | 'challenge_invite';

export interface Notification {
  id: string;
  kind: NotificationKind;
  actor: AthleteRef;
  activity: { id: string; title: string } | null;
  // The challenge you were invited to, for challenge invites.
  challenge: { id: string; title: string } | null;
  // The comment text, for comment notifications.
  text: string | null;
  createdAt: string;
  read: boolean;
}

// Red dots on the Home header.
export interface Badges {
  notifications: number;
  messages: number;
}

export interface Club {
  id: string;
  name: string;
  sport: ActivityType;
  location: string | null;
  description: string | null;
  memberCount: number;
  isMember: boolean;
  isOwner: boolean;
  createdAt: string;
}

export interface ClubLeader {
  athlete: AthleteRef;
  distanceMeters: number;
  activityCount: number;
}

export interface ClubDetail extends Club {
  members: AthleteRef[];
  // This week's distance leaderboard for the club's sport.
  leaderboard: ClubLeader[];
  recentActivities: ActivitySummary[];
}

export const commentSchema = z.object({ body: z.string().trim().min(1, 'Write something first').max(1000) });
export const messageSchema = z.object({ body: z.string().trim().min(1, 'Write something first').max(2000) });
export const startConversationSchema = z.object({ athleteId: z.uuid() });
export const followAllSchema = z.object({ ids: z.array(z.uuid()).min(1).max(50) });

// Reporting a person (and optionally the activity, comment or message that's the problem).
export const REPORT_REASONS = ['spam', 'harassment', 'inappropriate', 'impersonation', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam or scam',
  harassment: 'Harassment or bullying',
  inappropriate: 'Inappropriate content',
  impersonation: 'Pretending to be someone else',
  other: 'Something else',
};
export const reportSchema = z.object({
  targetUserId: z.uuid(),
  activityId: z.uuid().optional(),
  commentId: z.uuid().optional(),
  messageId: z.uuid().optional(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).optional(),
});
export type ReportInput = z.infer<typeof reportSchema>;
export const createClubSchema = z.object({
  name: z.string().trim().min(2, 'Give your club a name').max(80),
  sport: activityTypeSchema,
  location: z.string().trim().max(80).optional(),
  description: z.string().trim().max(1000).optional(),
});
export const athleteSearchSchema = z.object({ q: z.string().trim().max(80).default('') });
export const clubSearchSchema = z.object({
  q: z.string().trim().max(80).default(''),
  sport: activityTypeSchema.optional(),
});
// For paging back through older items: pass the createdAt/startedAt of the last one you have.
export const beforeSchema = z.object({ before: z.iso.datetime().optional() });
export const afterSchema = z.object({ after: z.iso.datetime().optional() });

export type CreateClubInput = z.infer<typeof createClubSchema>;
