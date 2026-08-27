import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import {
  dirname,
} from 'node:path';

export async function readJsonSnapshot<T>(
  filePath: string,
): Promise<T | undefined> {
  try {
    const content =
      await readFile(
        filePath,
        'utf8',
      );

    return JSON.parse(
      content,
    ) as T;
  } catch (error) {
    if (
      isNodeError(error) &&
      error.code === 'ENOENT'
    ) {
      return undefined;
    }

    throw error;
  }
}

export async function writeJsonSnapshot(
  filePath: string,
  data: unknown,
): Promise<void> {
  await mkdir(
    dirname(filePath),
    {
      recursive: true,
    },
  );

  await writeFile(
    filePath,
    JSON.stringify(
      data,
      null,
      2,
    ),
    'utf8',
  );
}

function isNodeError(
  error: unknown,
): error is NodeJS.ErrnoException {
  return (
    typeof error ===
      'object' &&
    error !== null &&
    'code' in error
  );
}