/**
 * Database-level guarantees (docs/08, review R-11/R-12/R-19/R-21). These run against real
 * Postgres with the production migration SQL, because the guarantees live in the database.
 */
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { seed } from "../../prisma/seed/seed";

import { connectPg, createTestPrisma, inRollback, pgConstraint, pgErrorCode } from "./helpers";

let pg: Client;
let prisma: PrismaClient;

const idOfSku = async (sku: string) => {
  const { rows } = await pg.query<{ id: string }>(
    "SELECT id FROM product_variants WHERE sku = $1",
    [sku],
  );
  return rows[0]!.id;
};

beforeAll(async () => {
  pg = await connectPg();
  prisma = createTestPrisma();
});

afterAll(async () => {
  await pg.end();
  await prisma.$disconnect();
});

describe("seed", () => {
  it("is idempotent: re-running changes nothing and never resets stock", async () => {
    const before = await pg.query(
      "SELECT sum(on_hand)::int AS s, count(*)::int AS n FROM inventory_items",
    );
    const summary = await seed(prisma);
    const after = await pg.query(
      "SELECT sum(on_hand)::int AS s, count(*)::int AS n FROM inventory_items",
    );
    expect(summary.inventoryCreated).toBe(0);
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it("loads the launch catalogue", async () => {
    const { rows } = await pg.query(
      // Other test files add `test-*` products to the shared database; count the seeded catalogue only.
      "SELECT type, count(*)::int AS n FROM products WHERE status = 'PUBLISHED' AND slug NOT LIKE 'test-%' GROUP BY type ORDER BY type",
    );
    expect(rows).toEqual([
      { type: "SINGLE", n: 14 },
      { type: "BUNDLE", n: 5 },
    ]);
  });
});

describe("CHECK constraints", () => {
  const expectViolation = async (sql: string, params: unknown[], constraint: string) => {
    const error = await inRollback(pg, (c) => c.query(sql, params));
    expect(pgErrorCode(error), `expected ${constraint} to reject`).toBe("23514");
    expect(pgConstraint(error)).toBe(constraint);
  };

  it("inventory cannot reserve more than is on hand", async () => {
    const variantId = await idOfSku("NURA-SER-DEW-30");
    await expectViolation(
      "UPDATE inventory_items SET reserved = on_hand + 1 WHERE variant_id = $1",
      [variantId],
      "inventory_items_reserved_range",
    );
  });

  it("a paid order must have a number and an email (reviews R-11, R-12)", async () => {
    await expectViolation(
      `INSERT INTO orders (id, subtotal_cents, shipping_cents, total_cents, paid_at, email, updated_at)
       VALUES ('ord_t1', 1000, 0, 1000, now(), 'a@b.co', now())`,
      [],
      "orders_paid_has_number",
    );
    await expectViolation(
      `INSERT INTO orders (id, number, subtotal_cents, shipping_cents, total_cents, paid_at, updated_at)
       VALUES ('ord_t2', 1, 1000, 0, 1000, now(), now())`,
      [],
      "orders_paid_has_email",
    );
  });

  it("allows a pending guest order without number or email", async () => {
    const error = await inRollback(pg, (c) =>
      c.query(
        `INSERT INTO orders (id, subtotal_cents, shipping_cents, total_cents, updated_at)
         VALUES ('ord_t3', 1000, 650, 1650, now())`,
      ),
    );
    expect(error).toBeUndefined();
  });

  it("order totals must add up", async () => {
    await expectViolation(
      `INSERT INTO orders (id, subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents, updated_at)
       VALUES ('ord_t4', 1000, 100, 650, 0, 1600, now())`,
      [],
      "orders_total_consistent",
    );
  });

  it("ingredient conflicts are stored once per ordered pair", async () => {
    const { rows } = await pg.query<{ a: string; b: string }>(
      "SELECT ingredient_a_id AS a, ingredient_b_id AS b FROM ingredient_conflicts LIMIT 1",
    );
    const { a, b } = rows[0]!;
    await expectViolation(
      "INSERT INTO ingredient_conflicts (id, ingredient_a_id, ingredient_b_id, severity, reason) VALUES ('c_t', $1, $2, 'caution', 'x')",
      [b, a],
      "ingredient_conflicts_ordered_pair",
    );
  });

  it("a reservation belongs to exactly one of order or subscription", async () => {
    const variantId = await idOfSku("NURA-SER-DEW-30");
    await expectViolation(
      `INSERT INTO inventory_reservations (id, variant_id, quantity, expires_at) VALUES ('r_t', $1, 1, now())`,
      [variantId],
      "inventory_reservations_one_owner",
    );
  });

  it("variant compare-at price must exceed the price", async () => {
    await expectViolation(
      "UPDATE product_variants SET compare_at_price_cents = price_cents WHERE sku = 'NURA-SER-DEW-30'",
      [],
      "product_variants_compare_at_gt_price",
    );
  });

  it("a routine step needs a variant unless a shade choice is pending (review R-23)", async () => {
    await expectViolation(
      "INSERT INTO routine_steps (id, recommendation_id, time_of_day, slot, step_order, product_id, rationale, usage, frequency, score) VALUES ('s_t', 'x', 'AM', 'PROTECT', 1, 'x', 'r', 'u', 'daily', 50)",
      [],
      "routine_steps_variant_or_choice",
    );
  });
});

describe("append-only tables", () => {
  it("rejects UPDATE and DELETE on the inventory ledger", async () => {
    const update = await inRollback(pg, (c) =>
      c.query("UPDATE inventory_movements SET quantity = 999"),
    );
    const del = await inRollback(pg, (c) => c.query("DELETE FROM inventory_movements"));
    expect(pgErrorCode(update)).toBe("23001");
    expect(pgErrorCode(del)).toBe("23001");
  });

  it("rejects mutating the audit log", async () => {
    const error = await inRollback(pg, async (c) => {
      await c.query(
        "INSERT INTO audit_logs (id, action, entity_type, entity_id) VALUES ('a_t', 'test', 'product', 'p1')",
      );
      await c.query("DELETE FROM audit_logs WHERE id = 'a_t'");
    });
    expect(pgErrorCode(error)).toBe("23001");
  });
});

describe("partial unique indexes", () => {
  it("allows only one default variant per product", async () => {
    const error = await inRollback(pg, (c) =>
      c.query("UPDATE product_variants SET is_default = true WHERE sku = 'NURA-SPF-TINT-MEDIUM'"),
    );
    expect(pgErrorCode(error)).toBe("23505");
    expect(pgConstraint(error)).toBe("product_variants_one_default_per_product");
  });
});

describe("row locking through the Prisma adapter (review R-21)", () => {
  it("SELECT … FOR UPDATE in an interactive transaction blocks a concurrent locker", async () => {
    const variantId = await idOfSku("NURA-SER-GLOW-30");
    let competitorError: unknown;

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM inventory_items WHERE variant_id = ${variantId} FOR UPDATE`;
      // A second connection must not be able to take the same row lock.
      competitorError = await inRollback(pg, (c) =>
        c.query("SELECT id FROM inventory_items WHERE variant_id = $1 FOR UPDATE NOWAIT", [
          variantId,
        ]),
      );
    });

    expect(pgErrorCode(competitorError)).toBe("55P03"); // lock_not_available
  });
});

describe("full-text search trigger", () => {
  it("indexes key ingredients and refreshes when a product's INCI changes", async () => {
    const search = async (term: string) =>
      (
        await pg.query<{ slug: string }>(
          "SELECT slug FROM products WHERE search_vector @@ plainto_tsquery('simple', $1) ORDER BY slug",
          [term],
        )
      ).rows.map((r) => r.slug);

    expect(await search("retinaldehyde")).toEqual(["renew-night-serum"]);

    const error = await inRollback(pg, async (c) => {
      await c.query(
        `DELETE FROM product_ingredients WHERE product_id = (SELECT id FROM products WHERE slug = 'renew-night-serum')
         AND ingredient_id = (SELECT id FROM ingredients WHERE slug = 'retinal')`,
      );
      const { rows } = await c.query(
        "SELECT slug FROM products WHERE search_vector @@ plainto_tsquery('simple', 'retinaldehyde')",
      );
      if (rows.length !== 0) throw new Error("search vector was not refreshed");
    });
    expect(error).toBeUndefined();
  });
});

describe("analytics partitions (review R-19)", () => {
  it("routes events into the current month's partition", async () => {
    const error = await inRollback(pg, async (c) => {
      await c.query(
        "INSERT INTO analytics_events (name, occurred_at) VALUES ('test_event', now())",
      );
      const { rows } = await c.query<{ part: string }>(
        "SELECT tableoid::regclass::text AS part FROM analytics_events WHERE name = 'test_event'",
      );
      if (!/^analytics_events_y\d{4}m\d{2}$/.test(rows[0]?.part ?? "")) {
        throw new Error(`unexpected partition ${rows[0]?.part}`);
      }
    });
    expect(error).toBeUndefined();
  });

  it("ensure_analytics_partition is idempotent", async () => {
    const error = await inRollback(pg, async (c) => {
      const first = await c.query("SELECT ensure_analytics_partition('2031-03-15') AS p");
      const second = await c.query("SELECT ensure_analytics_partition('2031-03-01') AS p");
      if (first.rows[0].p !== "analytics_events_y2031m03" || second.rows[0].p !== first.rows[0].p) {
        throw new Error("partition naming/idempotency broken");
      }
    });
    expect(error).toBeUndefined();
  });
});
