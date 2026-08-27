import fs from 'node:fs/promises';
import path from 'node:path';

export async function saveRawHtml(
  university: string,
  type: string,
  id: string,
  html: string,
): Promise<void> {
  const directory = path.join(
    'output',
    'raw',
    university,
    type,
  );

  await fs.mkdir(directory, {
    recursive: true,
  });

  await fs.writeFile(
    path.join(directory, `${id}.html`),
    html,
    'utf8',
  );
}