/**
 * Environment access for the API.
 *
 * Nothing is validated at import time: the project must build and boot without
 * real secrets so the app and CI work before keys are provisioned. Requests that
 * genuinely need a secret throw a clear, actionable error instead.
 */

export class MissingEnvironmentError extends Error {
  constructor(readonly key: string) {
    super(`Missing environment variable ${key}. See apps/api/.env.example.`);
    this.name = 'MissingEnvironmentError';
  }
}

const read = (key: string): string | undefined => {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
};

const required = (key: string): string => {
  const value = read(key);
  if (!value) throw new MissingEnvironmentError(key);
  return value;
};

export const env = {
  get clerkSecretKey(): string {
    return required('CLERK_SECRET_KEY');
  },
  get clerkJwtKey(): string | undefined {
    return read('CLERK_JWT_KEY');
  },
  get clerkWebhookSecret(): string | undefined {
    return read('CLERK_WEBHOOK_SECRET');
  },
  get supabaseUrl(): string {
    return read('SUPABASE_URL') ?? read('EXPO_PUBLIC_SUPABASE_URL') ?? required('SUPABASE_URL');
  },
  get supabaseServiceRoleKey(): string {
    return required('SUPABASE_SERVICE_ROLE_KEY');
  },
  get photoBucket(): string {
    return read('SUPABASE_PHOTO_BUCKET') ?? 'plant-photos';
  },
  get expoAccessToken(): string | undefined {
    return read('EXPO_ACCESS_TOKEN');
  },
  get cronSecret(): string | undefined {
    return read('CRON_SECRET');
  },
  get appOrigin(): string | undefined {
    return read('APP_ORIGIN');
  },
  get identifyProvider(): 'plant_id' | 'plantnet' | 'mock' {
    const explicit = read('IDENTIFY_PROVIDER')?.toLowerCase();
    if (explicit === 'plant_id' || explicit === 'plantnet' || explicit === 'mock') {
      return explicit;
    }
    if (read('PLANT_ID_API_KEY')) return 'plant_id';
    if (read('PLANTNET_API_KEY')) return 'plantnet';
    return 'mock';
  },
  get plantIdApiKey(): string | undefined {
    return read('PLANT_ID_API_KEY');
  },
  get plantIdApiUrl(): string {
    return read('PLANT_ID_API_URL') ?? 'https://api.plant.id/v3/identification';
  },
  get plantNetApiKey(): string | undefined {
    return read('PLANTNET_API_KEY');
  },
  get plantNetApiUrl(): string {
    return read('PLANTNET_API_URL') ?? 'https://my-api.plantnet.org/v2/identify/all';
  },
};

/** `true` when every secret the product needs is present. */
export const environmentReport = () => ({
  clerk: Boolean(read('CLERK_SECRET_KEY')),
  supabase: Boolean(read('SUPABASE_SERVICE_ROLE_KEY') && (read('SUPABASE_URL') ?? read('EXPO_PUBLIC_SUPABASE_URL'))),
  identifyProvider: env.identifyProvider,
  webhook: Boolean(read('CLERK_WEBHOOK_SECRET')),
  push: Boolean(read('EXPO_ACCESS_TOKEN')),
});
