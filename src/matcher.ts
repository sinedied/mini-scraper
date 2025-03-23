import { closest } from 'fastest-levenshtein';
import stringComparison from 'string-comparison';
import createDebug from 'debug';
import { type Options } from './options.js';
import { getCompletion } from './ollama.js';
import { stats } from './stats.js';

const debug = createDebug('matcher');

export async function findBestMatch(search: string, name: string, candidates: string[], options: Options) {
  if (!candidates?.length) return undefined;

  if (options?.ai) {
    const bestMatch = await findBestMatchWithAi(search, name, candidates, options);
    if (bestMatch) return bestMatch;
  }

  // Use Levenstein distance after removing (...) and [...] in the name
  const strippedCandidates = candidates.map((c) => c.replaceAll(/(\(.*?\)|\[.*?])/g, '').trim());
  const best = closest(search, strippedCandidates);
  const bestIndex = strippedCandidates.indexOf(best);
  const bestMatch = candidates[bestIndex];

  console.info(`Partial match for "${name}" (searched: "${search}"): "${bestMatch}"`);
  stats.matches.partial++;
  return bestMatch;
}

export async function findBestMatchWithAi(
  search: string,
  name: string,
  candidates: string[],
  options: Options,
  retries = 2
): Promise<string | undefined> {
  const prompt = `
## Candidates
${candidates.map((c) => `${c}`).join('\n')}

## Instructions
Find the best matching image for the ROM name "${name}" in the listed candidates.
If a direct match isn't available, use the closest match trying to translate the name in english.
For example, "Pokemon - Version Or (France) (SGB Enhanced)" should match "Pokemon - Gold Version (USA, Europe) (SGB Enhanced) (GB Compatible).png".
Game sequels MUST NOT match, "Sonic" is NOT the same as "Sonic 2".
When multiple regions are available, prefer the one that matches the region of the ROM if possible.
If the region is not available, use this order of preference: ${options.regions}.
If no close match is found, return null.

## Output
Answer with JSON using the following format:
{
  "bestMatch": "<best matching candidate>"
}`;

  const response = await getCompletion(prompt, options.aiModel);
  debug('AI response:', response);

  const bestMatch = response?.bestMatch;
  if (!bestMatch) {
    debug(`AI failed to find a match for "${name}" (searched: "${search}")`);
    return undefined;
  }

  if (!candidates.includes(bestMatch)) {
    debug(`AI found a match for "${name}" (searched: "${search}"), but it's not a candidate: "${bestMatch}"`);
    if (retries <= 0) return undefined;

    debug(`Retrying AI match for "${name}" (Tries left: ${retries})`);
    return findBestMatchWithAi(search, name, candidates, options, retries - 1);
  }

  console.info(`AI match for "${name}" (searched: "${search}"): "${bestMatch}"`);
  stats.matches.ai++;
  return bestMatch;
}

export async function findFuzzyMatches(search: string, candidates: string[], _options: Options) {
  // Remove (...) and [...] in candidates' name
  const strippedCandidates = candidates.map((c) => c.replaceAll(/(\(.*?\)|\[.*?])/g, '').trim());
  const jaroMatches = new Set(
    strippedCandidates
      .map((c) => ({ c, similarity: stringComparison.jaroWinkler.similarity(search, c) }))
      .filter(({ similarity }) => similarity >= 0.85)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 25)
      .map(({ c }) => c)
  );
  const matches: string[] = [];
  for (const [index, strippedCandidate] of strippedCandidates.entries()) {
    if (jaroMatches.has(strippedCandidate)) {
      matches.push(candidates[index]);
    }
  }

  debug(`Fuzzy matches for "${search}":`, matches);

  return matches;
}
