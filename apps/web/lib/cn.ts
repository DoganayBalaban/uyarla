import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/** Koşullu sınıfları birleştirir; çakışan Tailwind sınıflarında sonuncusu kazanır. */
export function cn(...girdiler: ClassValue[]): string {
  return twMerge(clsx(girdiler))
}
