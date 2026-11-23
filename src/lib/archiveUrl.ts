/** Only fixed Wayback capture URLs can be loaded in the archived-page frame. */
export const isArchiveUrl = (url: string): boolean =>
  /^https:\/\/web\.archive\.org\/web\//.test(url)
