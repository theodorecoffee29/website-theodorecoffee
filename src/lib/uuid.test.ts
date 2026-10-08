// Tes untuk src/lib/uuid.ts.
//
// Yang diuji: menerima uuid yang benar (huruf besar maupun kecil), dan menolak
// apa pun yang bukan uuid (teks biasa, huruf campur, versi/varian salah, dan
// nilai yang bukan teks).

import { describe, expect, it } from "vitest";
import { apakahUuidValid } from "./uuid";

describe("apakahUuidValid", () => {
  it("menerima uuid v4 yang normal", () => {
    expect(apakahUuidValid("123e4567-e89b-42d3-a456-426614174000")).toBe(true);
  });

  it("menerima uuid dengan huruf besar", () => {
    expect(apakahUuidValid("123E4567-E89B-42D3-A456-426614174000")).toBe(true);
  });

  it("menerima uuid versi lain (v1) selama polanya benar", () => {
    expect(apakahUuidValid("c9bf9e57-1685-4c89-bafb-ff5af830be8a")).toBe(true);
  });

  it("menolak teks biasa", () => {
    expect(apakahUuidValid("order-1")).toBe(false);
    expect(apakahUuidValid("undefined")).toBe(false);
    expect(apakahUuidValid("")).toBe(false);
  });

  it("menolak uuid yang versi/variannya tidak sesuai", () => {
    // Digit versi 0 (harus 1-8).
    expect(apakahUuidValid("123e4567-e89b-02d3-a456-426614174000")).toBe(false);
    // Digit varian 4 (harus 8, 9, a, atau b).
    expect(apakahUuidValid("123e4567-e89b-42d3-4456-426614174000")).toBe(false);
  });

  it("menolak nilai yang bukan teks", () => {
    expect(apakahUuidValid(null)).toBe(false);
    expect(apakahUuidValid(undefined)).toBe(false);
    expect(apakahUuidValid(123)).toBe(false);
    expect(apakahUuidValid({})).toBe(false);
  });
});
