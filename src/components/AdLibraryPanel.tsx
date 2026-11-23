import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { adLibraryLinks } from '@/lib/adLinks'

export function AdLibraryPanel({ domain }: { domain: string }) {
  const links = adLibraryLinks(domain)

  return (
    <Card data-testid="ad-libraries">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
            Ad libraries
          </CardTitle>
          <Badge variant="outline">manual check</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Four public libraries, pre-filled for{' '}
          <span className="font-medium text-foreground">{domain}</span>. Open one to check the ads
          yourself — no key, no fee, and no scraping by this tool.
        </p>

        <div className="space-y-1.5">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="group flex items-start justify-between gap-2 rounded-lg border border-border bg-card/50 px-2.5 py-2 transition-colors hover:border-foreground/25 hover:bg-muted/30"
            >
              <span>
                <span className="block text-[12px] font-medium">{link.name}</span>
                <span className="mt-0.5 block text-[10.5px] leading-snug text-muted-foreground">
                  {link.note}
                </span>
              </span>
              <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground group-hover:text-foreground">
                Open <ExternalLink className="size-3" />
              </span>
            </a>
          ))}
        </div>

        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          Why manual: no free official API returns US commercial ads. Meta&apos;s free API covers
          political and EU-delivered ads; Google publishes a political dataset. Coverage and region
          vary by library; automatic commercial history needs a licensed provider.
        </p>
      </CardContent>
    </Card>
  )
}
