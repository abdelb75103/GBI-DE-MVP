import type { UserRole } from '@/lib/supabase';

type ProfileAccessCandidate = {
  id: string;
  role: UserRole;
};

export const PROJECT_LEAD_PROFILE_IDS = new Set([
  '550e8400-e29b-41d4-a716-446655440001', // Ben Clarsen
  '550e8400-e29b-41d4-a716-446655440002', // Eamonn Delahunt
  '550e8400-e29b-41d4-a716-446655440003', // Nicol van Dyk
]);

export function canAccessWorkspace(profile: ProfileAccessCandidate | null | undefined): boolean {
  if (!profile) {
    return false;
  }

  if (profile.role === 'admin') {
    return true;
  }

  if (profile.role === 'extractor') {
    return PROJECT_LEAD_PROFILE_IDS.has(profile.id);
  }

  return false;
}

export function getDisplayRole(profile: ProfileAccessCandidate): string | undefined {
  if (profile.role === 'extractor' && PROJECT_LEAD_PROFILE_IDS.has(profile.id)) {
    return 'Project Lead';
  }

  return undefined;
}
