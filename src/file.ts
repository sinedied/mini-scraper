import fs from 'node:fs/promises';

export async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeName(name: string) {
  return name.replaceAll(/^\d+\)\s*/g, '').replaceAll(/[&*/:`<>?|"]/g, '_');
}
