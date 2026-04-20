import { type ClassValue, clsx } from "clsx";

/**
 * shadcn-style class merge. Uses clsx only; avoids tailwind-merge dep.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtPct(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(n);
}

export function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}
