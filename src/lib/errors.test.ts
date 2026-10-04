import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AppError, DEFAULT_MESSAGES, serializeError, toAppError } from "./errors";

describe("toAppError", () => {
  it("passes AppError through unchanged", () => {
    const err = new AppError("OUT_OF_STOCK", "Only 2 left.", { details: { available: 2 } });
    expect(toAppError(err)).toBe(err);
    expect(err.status).toBe(409);
  });

  it("maps ZodError to VALIDATION with field errors keyed by path", () => {
    const schema = z.object({
      qty: z.number().int().min(1),
      address: z.object({ zip: z.string() }),
    });
    const result = schema.safeParse({ qty: 0, address: {} });
    expect(result.success).toBe(false);
    const err = toAppError(result.error);
    expect(err.code).toBe("VALIDATION");
    expect(err.status).toBe(422);
    expect(Object.keys(err.fieldErrors ?? {})).toEqual(
      expect.arrayContaining(["qty", "address.zip"]),
    );
  });

  it("hides unknown errors behind INTERNAL", () => {
    const err = toAppError(new Error("connection string leaked: postgres://secret"));
    expect(err.code).toBe("INTERNAL");
    expect(err.message).toBe(DEFAULT_MESSAGES.INTERNAL);
    expect(serializeError(err, "req_1")).toEqual({
      code: "INTERNAL",
      message: DEFAULT_MESSAGES.INTERNAL,
      requestId: "req_1",
    });
  });
});
