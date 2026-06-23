import { getDomain } from 'tldts';

export function eTLDPlusOne(url: string): string | null {
  const domain = getDomain(url);
  return domain && domain.length > 0 ? domain : null;
}
