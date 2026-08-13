import { registry } from './registry';
import type { DocArticle, DocsService } from './types';

/**
 * The in-application documentation index.
 *
 * Every article is bundled into the build by whichever feature owns it, so the
 * browser works with no network connection at all. There is no fetch here and
 * no remote asset in any article.
 *
 * The completeness guard below is deliberately inverted: it checks that every
 * registered FEATURE contributed at least one article, rather than only checking
 * that the articles present are well formed. A rule that validates what it finds
 * passes cleanly on a feature that shipped no documentation at all, because it
 * never looked.
 */

let openArticle: ((articleId: string) => void) | null = null;

export function setDocsOpener(opener: (articleId: string) => void): void {
  openArticle = opener;
}

class DocsImpl implements DocsService {
  all(): DocArticle[] {
    return registry.docs();
  }

  byId(id: string): DocArticle | null {
    return this.all().find((article) => article.id === id) ?? null;
  }

  categories(): string[] {
    return [...new Set(this.all().map((article) => article.category))].sort();
  }

  open(articleId: string): void {
    openArticle?.(articleId);
  }
}

export const docsService = new DocsImpl();

export interface DocsCoverageReport {
  /** Feature ids that registered no article at all. */
  missing: string[];
  /** Articles naming a related article that does not exist. */
  danglingRelated: Array<{ article: string; related: string }>;
  total: number;
}

/**
 * Reports documentation gaps.
 *
 * A feature with a user-facing surface and no article is undocumented in
 * practice however good its code is, so the gap is reported by name rather than
 * left as an absence nobody notices.
 */
export function docsCoverage(): DocsCoverageReport {
  const articles = registry.docs();
  const byId = new Set(articles.map((article) => article.id));
  const missing: string[] = [];
  for (const module of registry.modules()) {
    const hasSurface = (module.tabs?.length ?? 0) > 0 || (module.settings?.length ?? 0) > 0;
    if (hasSurface && (module.docs?.length ?? 0) === 0) missing.push(module.id);
  }
  const danglingRelated: Array<{ article: string; related: string }> = [];
  for (const article of articles) {
    for (const related of article.related) {
      if (!byId.has(related)) danglingRelated.push({ article: article.id, related });
    }
  }
  return { missing, danglingRelated, total: articles.length };
}
