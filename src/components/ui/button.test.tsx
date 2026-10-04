// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders an accessible button and handles clicks", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Add to cart</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("loading state keeps the label, sets aria-busy and blocks clicks", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("asChild renders the child element with button styles", () => {
    render(
      <Button asChild variant="accent">
        <a href="/finder">Find my routine</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Find my routine" });
    expect(link).toHaveAttribute("href", "/finder");
    expect(link.className).toContain("bg-accent");
  });
});
