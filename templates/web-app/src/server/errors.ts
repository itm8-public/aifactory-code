import type { z } from 'zod';

/** An error with a status code and a message that is safe to show to the user. */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = 'The record') => new HttpError(404, `${what} was not found.`);
export const forbidden = () => new HttpError(403, 'You do not have permission to do this.');

/** Validates input with a shared zod schema; answers 400 with the field names that failed. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields = [...new Set(result.error.issues.map((i) => i.path.join('.') || 'body'))];
  throw new HttpError(400, `Check these fields: ${fields.join(', ')}.`);
}
