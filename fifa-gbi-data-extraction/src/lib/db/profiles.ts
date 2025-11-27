import { supabaseClient } from '@/lib/db/shared';

export const getProfileGeminiKey = async (profileId: string): Promise<string | null> => {
  const supabase = supabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('gemini_api_key')
    .eq('id', profileId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Gemini API key: ${error.message}`);
  }

  return (data as { gemini_api_key: string | null } | null)?.gemini_api_key ?? null;
};

export const setProfileGeminiKey = async (profileId: string, apiKey: string): Promise<void> => {
  const supabase = supabaseClient();
  const { error } = await supabase
    .from('profiles')
    .update({ gemini_api_key: apiKey.trim(), updated_at: new Date().toISOString() })
    .eq('id', profileId);

  if (error) {
    throw new Error(`Failed to save Gemini API key: ${error.message}`);
  }
};

export const clearProfileGeminiKey = async (profileId: string): Promise<void> => {
  const supabase = supabaseClient();
  const { error } = await supabase
    .from('profiles')
    .update({ gemini_api_key: null, updated_at: new Date().toISOString() })
    .eq('id', profileId);

  if (error) {
    throw new Error(`Failed to clear Gemini API key: ${error.message}`);
  }
};

export const hasProfileGeminiKey = async (profileId: string): Promise<boolean> => {
  const key = await getProfileGeminiKey(profileId);
  return Boolean(key);
};
