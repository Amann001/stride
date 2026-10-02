import { z } from 'zod';

// These schemas check incoming data. The API uses them to reject bad requests,
// and the apps use them to validate forms before sending.

export const ACTIVITY_TYPES = ['run', 'ride', 'walk', 'hike'] as const;
export const activityTypeSchema = z.enum(ACTIVITY_TYPES);

// The same rule everywhere a password is chosen (sign-up, change, reset).
const newPassword = z.string().min(8, 'Password must be at least 8 characters').max(200);

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  email: z.email().transform((e) => e.toLowerCase()),
  password: newPassword,
});

// Changing your password logs out every other phone signed in to your account.
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword,
});

// "Forgot password": ask for a code by email, then use it to choose a new password.
export const forgotPasswordSchema = z.object({
  email: z.email('Enter the email you signed up with').transform((e) => e.toLowerCase()),
});
export const resetPasswordSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  code: z.string().trim().regex(/^\d{6}$/, 'The code is 6 digits'),
  newPassword,
});

// A crash or error from the app, for fixing bugs. No personal data.
export const errorReportSchema = z.object({
  message: z.string().max(2000),
  stack: z.string().max(8000).optional(),
  context: z
    .object({
      platform: z.string().max(20).optional(),
      appVersion: z.string().max(40).optional(),
      screen: z.string().max(200).optional(),
      fatal: z.boolean().optional(),
    })
    .optional(),
});

export const loginSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

// Deleting your account asks for your password once more.
export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password to confirm'),
});

// One GPS reading. `t` is a Unix timestamp in milliseconds.
export const trackPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  alt: z.number().nullable(),
  t: z.number().int().positive(),
});

export const createActivitySchema = z.object({
  type: activityTypeSchema,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  points: z.array(trackPointSchema).min(2, 'An activity needs at least 2 GPS points').max(100_000),
  // From the phone's motion sensor, for runs, walks and hikes. Left out if unavailable.
  steps: z.number().int().min(0).max(1_000_000).optional(),
  // A unique tag made by the phone for this recording. Sending the same tag again returns the
  // activity saved the first time instead of a duplicate, so uploads are safe to retry.
  clientId: z.string().min(8).max(64).optional(),
});

// Who can see an activity. Only "everyone" activities go into the shared heatmaps.
export const VISIBILITIES = ['everyone', 'followers', 'only_me'] as const;
export const visibilitySchema = z.enum(VISIBILITIES);

export const updateActivitySchema = z.object({
  title: z.string().trim().min(1, 'Give it a title').max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  visibility: visibilitySchema.optional(),
});

export type Visibility = z.infer<typeof visibilitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TrackPoint = z.infer<typeof trackPointSchema>;
export type ActivityType = z.infer<typeof activityTypeSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
