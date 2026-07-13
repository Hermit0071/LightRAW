export async function saveCatalogUnlessCancelled(
  serialize: () => Promise<string>,
  shouldCancel: () => boolean,
  save: (contents: string) => Promise<void>,
): Promise<void> {
  const contents = await serialize();
  if (!shouldCancel()) await save(contents);
}
