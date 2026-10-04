import { ZodError } from "zod";

/**
 * Domain error model (docs/06 §4.3, docs/09 §2.4). Isomorphic: no server-only imports,
 * so client code can switch on `code` for user-facing copy.
 */
export const ERROR_STATUS = {
  VALIDATION: 422,
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  REVERIFICATION_REQUIRED: 403,
  NOT_FOUND: 404,
  GONE: 410,
  CONFLICT: 409,
  OUT_OF_STOCK: 409,
  COUPON_INVALID: 422,
  RATE_LIMITED: 429,
  PAYMENT_PROVIDER: 502,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

/** Default user-facing copy; features may pass more specific messages. Brand voice: 14 §3. */
export const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION: "Please check the highlighted fields.",
  BAD_REQUEST: "That request didn't look right. Please try again.",
  UNAUTHENTICATED: "Please sign in to continue.",
  FORBIDDEN: "You don't have access to do that.",
  REVERIFICATION_REQUIRED: "Please confirm it's you to continue.",
  NOT_FOUND: "We couldn't find what you were looking for.",
  GONE: "This is no longer available.",
  CONFLICT: "Something changed in the meantime. Please refresh and try again.",
  OUT_OF_STOCK: "Sorry, that's no longer in stock.",
  COUPON_INVALID: "This code isn't valid.",
  RATE_LIMITED: "Please wait a moment and try again.",
  PAYMENT_PROVIDER: "Payments are temporarily unavailable. You haven't been charged.",
  INTERNAL: "Something went wrong on our side. Please try again.",
};

export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;
  readonly fieldErrors?: FieldErrors;

  constructor(
    code: ErrorCode,
    message: string = DEFAULT_MESSAGES[code],
    options: { details?: Record<string, unknown>; fieldErrors?: FieldErrors; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.details = options.details;
    this.fieldErrors = options.fieldErrors;
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }
}

export function zodFieldErrors(error: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.length ? issue.path.join(".") : "_root";
    (out[path] ??= []).push(issue.message);
  }
  return out;
}

/** Normalizes anything thrown into an AppError. Unknown errors become INTERNAL (details hidden). */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new AppError("VALIDATION", DEFAULT_MESSAGES.VALIDATION, {
      fieldErrors: zodFieldErrors(error),
      cause: error,
    });
  }
  return new AppError("INTERNAL", DEFAULT_MESSAGES.INTERNAL, { cause: error });
}

/** Serializable error shape shared by Server Actions and REST responses (09 §2.3). */
export type SerializedError = {
  code: ErrorCode;
  message: string;
  requestId: string;
  details?: Record<string, unknown>;
  fieldErrors?: FieldErrors;
};

export function serializeError(error: AppError, requestId: string): SerializedError {
  return {
    code: error.code,
    message: error.message,
    requestId,
    ...(error.details ? { details: error.details } : {}),
    ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
  };
}
