/** Isolated transport endpoints: no backend or Supabase service listens here. */
export const MOCK_API = 'http://127.0.0.1:4010';
export const MOCK_AUTH = 'http://127.0.0.1:54321';
export const LOCAL_WEB = 'http://localhost:8088';
export const isReal = process.env.E2E_MODE === 'real';
export const baseURL = process.env.E2E_BASE_URL || LOCAL_WEB;
export const mockEnvironment = {
  EXPO_NO_DOTENV: '1',
  EXPO_PUBLIC_API_URL: MOCK_API,
  EXPO_PUBLIC_SUPABASE_URL: MOCK_AUTH,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_campuslink_synthetic_qa',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: '',
};

export function requireQATarget() {
  if (process.env.E2E_QA_AUTHORIZED !== '1' || !process.env.E2E_BASE_URL) {
    throw new Error('Real mode requires E2E_QA_AUTHORIZED=1 and an explicit E2E_BASE_URL for an authorized QA environment.');
  }
}
