export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function politeDelay(): Promise<void> {
  const delay = 500 + Math.floor(Math.random() * 500);

  await sleep(delay);
}