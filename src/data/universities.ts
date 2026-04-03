import rawData from "./universities.json";

export interface University {
  name: string;
  abbrev: string;
  primaryColor: string;
  secondaryColor: string;
}

interface RawUniversity {
  name: string;
  colors: string[];
  id: string;
  slug: string;
}

function deriveAbbrev(name: string): string {
  const words = name.split(" ");
  // Last word is usually the mascot — take initials of remaining words
  const schoolWords = words.length > 1 ? words.slice(0, -1) : words;
  return schoolWords.map((w) => w.charAt(0)).join("").toUpperCase();
}

function pickPrimaryColor(colors: string[]): string {
  // Pick the last non-white, non-near-white color as primary
  const nonWhite = colors.filter(
    (c) => c.toUpperCase() !== "#FFFFFF" && c.toUpperCase() !== "#FFF"
  );
  return nonWhite.length > 0 ? nonWhite[nonWhite.length - 1] : colors[0];
}

function pickSecondaryColor(colors: string[], primary: string): string {
  const others = colors.filter(
    (c) => c !== primary && c.toUpperCase() !== "#FFFFFF"
  );
  return others.length > 0 ? others[0] : primary;
}

export const universities: University[] = (rawData as RawUniversity[]).map(
  (entry) => {
    const primary = pickPrimaryColor(entry.colors);
    return {
      name: entry.name,
      abbrev: deriveAbbrev(entry.name),
      primaryColor: primary,
      secondaryColor: pickSecondaryColor(entry.colors, primary),
    };
  }
);
