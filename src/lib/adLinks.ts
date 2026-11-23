export type AdLibraryLink = {
  id: 'meta' | 'google' | 'tiktok' | 'linkedin'
  name: string
  note: string
  href: string
}

/**
 * Free public ad libraries, opened in the user's browser. No API key, no fee,
 * and no server-side scraping: these pages are interactive and their terms do
 * not permit this tool to read them programmatically.
 */
export function adLibraryLinks(domain: string): AdLibraryLink[] {
  const cleaned = domain.trim().replace(/^www\./i, '')
  const query = encodeURIComponent(cleaned)

  return [
    {
      id: 'meta',
      name: 'Meta Ad Library',
      note: 'Facebook + Instagram · public library',
      href: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${query}&search_type=keyword_unordered&media_type=all`,
    },
    {
      id: 'google',
      name: 'Google Ads Transparency',
      note: 'Search, display, YouTube · public library',
      href: `https://adstransparency.google.com/?region=anywhere&domain=${query}`,
    },
    {
      id: 'tiktok',
      name: 'TikTok Commercial Content Library',
      note: 'EU commercial ads · public library',
      href: `https://library.tiktok.com/ads?region=EU&query=${query}`,
    },
    {
      id: 'linkedin',
      name: 'LinkedIn Ad Library',
      note: 'Sponsored posts · coverage varies',
      href: `https://www.linkedin.com/ad-library/search?keywords=${query}`,
    },
  ]
}
