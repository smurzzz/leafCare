/**
 * Plant create/update payload parsing.
 *
 * The Expo app posts multipart when it has a photo and JSON otherwise, so both
 * shapes funnel into one field map before zod validates them.
 */

import { createPlantSchema, updatePlantSchema, type CreatePlantInput, type UpdatePlantInput } from '@leafcare/shared';

import { badRequest, readJson, uploadedImageFromFile, type UploadedImage } from './http';
import { LOCATION_KINDS } from '@leafcare/shared';

export type ParsedPlantPayload<T> = { input: T; image: UploadedImage | null };

const NULLABLE_TEXT_FIELDS = [
  'speciesScientific',
  'speciesCommon',
  'locationCustom',
  'notes',
  'light',
  'difficulty',
] as const;

const NUMBER_FIELDS = ['intervalDays', 'confidence'] as const;

/** Converts one multipart field into the JSON scalar zod expects. */
const coerceField = (key: string, raw: string): unknown => {
  const value = raw.trim();
  if (value === '' ) {
    return (NULLABLE_TEXT_FIELDS as readonly string[]).includes(key) ? null : undefined;
  }
  if (value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if ((NUMBER_FIELDS as readonly string[]).includes(key)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (key === 'locationKind') {
    return (LOCATION_KINDS as readonly string[]).includes(value) ? value : undefined;
  }
  return value;
};

const fromFormData = (form: FormData): Record<string, unknown> => {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (value instanceof File) continue;
    const coerced = coerceField(key, value);
    if (coerced !== undefined) fields[key] = coerced;
  }
  return fields;
};

const readBody = async (
  request: Request,
): Promise<{ fields: unknown; image: UploadedImage | null }> => {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('image');
    return {
      fields: fromFormData(form),
      image: file instanceof File ? await uploadedImageFromFile(file) : null,
    };
  }
  if (contentType.includes('application/json')) {
    return { fields: await readJson<unknown>(request, (value) => value), image: null };
  }
  throw badRequest('Expected a JSON or multipart/form-data body');
};

export const parseCreatePlant = async (
  request: Request,
): Promise<ParsedPlantPayload<CreatePlantInput>> => {
  const { fields, image } = await readBody(request);
  const input = createPlantSchema.parse(fields ?? {});
  return { input, image };
};

export const parseUpdatePlant = async (
  request: Request,
): Promise<ParsedPlantPayload<UpdatePlantInput>> => {
  const { fields, image } = await readBody(request);
  const input = updatePlantSchema.parse(fields ?? {});
  return { input, image };
};
