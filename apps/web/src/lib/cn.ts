import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/** Koşullu sınıfları birleştirir; çakışan Tailwind sınıflarında sonuncusu kazanır. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
