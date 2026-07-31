import fs from 'node:fs/promises';

const invalidFilenameCharacters = new Set(['"', '&', '*', '/', ':', '<', '>', '?', '`', '|']);

export async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeName(name: string) {
  const withoutIndex = name.replace(/^\d+\)\s*/v, '');
  return [...withoutIndex].map((character) => (invalidFilenameCharacters.has(character) ? '_' : character)).join('');
}

export function stripMetadata(name: string) {
  let result = '';
  let bufferedGroup = '';
  let parenthesisDepth = 0;
  let bracketDepth = 0;

  for (const character of name) {
    const isInsideGroup = parenthesisDepth > 0 || bracketDepth > 0;
    if (character === '(') {
      bufferedGroup += character;
      parenthesisDepth++;
    } else if (character === '[') {
      bufferedGroup += character;
      bracketDepth++;
    } else if (character === ')' && parenthesisDepth > 0) {
      bufferedGroup += character;
      parenthesisDepth--;
    } else if (character === ']' && bracketDepth > 0) {
      bufferedGroup += character;
      bracketDepth--;
    } else if (isInsideGroup) {
      bufferedGroup += character;
    } else {
      result += character;
    }

    if (parenthesisDepth === 0 && bracketDepth === 0) {
      bufferedGroup = '';
    }
  }

  return `${result}${bufferedGroup}`.trim();
}
