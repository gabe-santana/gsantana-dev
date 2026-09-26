import { enUs, type Dictionary } from "@/lib/dictionaries/en-us";
import { ptBr } from "@/lib/dictionaries/pt-br";
import type { Locale } from "@/lib/i18n";

export type { Dictionary };

const dictionaries: Record<Locale, Dictionary> = {
  "en-us": enUs,
  "pt-br": ptBr,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Fills {placeholders}: format("{n} min", { n: 5 }) -> "5 min". */
export function format(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match
  );
}
