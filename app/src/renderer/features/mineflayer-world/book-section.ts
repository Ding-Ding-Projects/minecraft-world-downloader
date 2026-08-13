/**
 * Book writing and signing (row 15.14). Covers `book.js`.
 *
 * The vendored library places no numeric limit on page count or page length
 * itself -- `bot.writeBook`/`bot.signBook` just write whatever is handed to
 * them. The limits shown here, before they can be hit, are the ones this
 * application's own runtime host actually enforces: 1-100 pages, and at most
 * 4096 characters in any one string argument (`../mineflayer/bot-host.js`).
 *
 * Signing calls a `signBook` method that is not on that host's allow-list
 * yet (only `writeBook` is). This surface still offers the Sign action --
 * refusing it with the runtime's own honest "not on the list of methods"
 * error -- and `docs/features/mineflayer-world.md` names the exact addition
 * `../mineflayer/bot-host.js` needs for it to work.
 */

import type { SectionDeps } from './panel';
import { BOOK_ELEMENT, normaliseWindow } from './model';

const MAX_PAGES = 100;
const MAX_PAGE_CHARS = 4096;

export function mountBookSection(host: HTMLElement, deps: SectionDeps): () => void {
  const { ctx } = deps;
  host.id = BOOK_ELEMENT;
  host.append(
    ctx.components.sectionHeading({
      title: ctx.t('mineflayerWorld.book.heading', 'Write and sign a book'),
      description: ctx.t(
        'mineflayerWorld.book.heading.description',
        'Up to {maxPages} pages, each up to {maxChars} characters -- the real limits this runtime enforces, shown before you can hit them.',
        { values: { maxPages: MAX_PAGES, maxChars: MAX_PAGE_CHARS } }
      )
    })
  );

  const slotSelect = ctx.components.select({
    label: ctx.t('mineflayerWorld.book.slot', 'Inventory slot holding an unsigned book'),
    options: [{ value: '', label: ctx.t('mineflayerWorld.book.noSlot', 'No writable book found yet') }],
    value: ''
  });
  host.append(slotSelect.root);
  const slotSelectRef = { current: slotSelect };

  async function refreshSlots(): Promise<void> {
    try {
      const raw = await deps.call('inventory', []);
      const win = normaliseWindow(raw);
      const books = win.slots.filter((item) => item.name === 'writable_book');
      const options =
        books.length > 0
          ? books.map((item) => ({ value: String(item.slot), label: ctx.t('mineflayerWorld.book.slotLabel', 'Slot {slot} ({count} book(s))', { values: { slot: item.slot, count: item.count } }) }))
          : [{ value: '', label: ctx.t('mineflayerWorld.book.noSlot', 'No writable book found yet') }];
      const fresh = ctx.components.select({ label: ctx.t('mineflayerWorld.book.slot', 'Inventory slot holding an unsigned book'), options, value: '' });
      slotSelectRef.current.root.replaceWith(fresh.root);
      slotSelectRef.current = fresh;
    } catch (error) {
      deps.notifyError(ctx.t('mineflayerWorld.book.refresh', 'Refresh the book slot list'), error);
    }
  }

  host.append(
    ctx.components.button({
      label: ctx.t('mineflayerWorld.book.refresh', 'Refresh the book slot list'),
      icon: 'refresh',
      variant: 'text',
      onClick: () => void refreshSlots()
    })
  );
  void refreshSlots();

  const authorField = ctx.components.textField({ label: ctx.t('mineflayerWorld.book.author', 'Author (for signing only)') });
  const titleField = ctx.components.textField({ label: ctx.t('mineflayerWorld.book.title', 'Title (for signing only)') });
  host.append(authorField.root, titleField.root);

  const pageCount = document.createElement('p');
  pageCount.className = 'md-typescale-body-small';
  pageCount.setAttribute('role', 'status');
  host.append(pageCount);

  const pagesHost = document.createElement('div');
  pagesHost.className = 'mineflayer-world-pages';
  host.append(pagesHost);

  let pages: string[] = [''];

  function renderPages(): void {
    pagesHost.replaceChildren();
    pageCount.textContent = ctx.t('mineflayerWorld.book.pageCount', '{count} of {max} pages', { values: { count: pages.length, max: MAX_PAGES } });

    pages.forEach((text, index) => {
      const row = document.createElement('div');
      row.className = 'mineflayer-world-page-row';

      const field = ctx.components.textField({
        label: ctx.t('mineflayerWorld.book.page', 'Page {n}', { values: { n: index + 1 } }),
        multiline: true,
        rows: 3,
        value: text,
        supportingText: ctx.t('mineflayerWorld.book.pageChars', '{count} of {max} characters', {
          values: { count: text.length, max: MAX_PAGE_CHARS }
        }),
        error: text.length > MAX_PAGE_CHARS ? ctx.t('mineflayerWorld.book.pageTooLong', 'This page is over the limit and will be refused.') : undefined,
        onChange: (value) => {
          pages[index] = value;
        }
      });

      const remove = ctx.components.iconButton({
        icon: 'trash',
        label: ctx.t('mineflayerWorld.book.removePage', 'Remove page {n}', { values: { n: index + 1 } }),
        variant: 'standard',
        disabled: pages.length <= 1,
        disabledReason: ctx.t('mineflayerWorld.book.needOnePage', 'A book needs at least one page.'),
        onClick: () => {
          pages.splice(index, 1);
          renderPages();
        }
      });

      row.append(field.root, remove);
      pagesHost.append(row);
    });
  }

  renderPages();

  host.append(
    ctx.components.button({
      label: ctx.t('mineflayerWorld.book.addPage', 'Add page'),
      icon: 'add',
      variant: 'text',
      disabled: pages.length >= MAX_PAGES,
      disabledReason: ctx.t('mineflayerWorld.book.pageLimit', 'This runtime allows at most {max} pages.', { values: { max: MAX_PAGES } }),
      onClick: () => {
        if (pages.length >= MAX_PAGES) return;
        pages.push('');
        renderPages();
      }
    })
  );

  const bookStatus = document.createElement('p');
  bookStatus.className = 'md-typescale-body-small';
  bookStatus.setAttribute('role', 'status');
  host.append(bookStatus);

  const bookActions = document.createElement('div');
  bookActions.className = 'mineflayer-world-actions';
  host.append(bookActions);

  function requireSlot(): number | null {
    const raw = Number(slotSelectRef.current.get());
    return Number.isFinite(raw) ? raw : null;
  }

  function tooLong(): boolean {
    return pages.some((p) => p.length > MAX_PAGE_CHARS);
  }

  bookActions.append(
    ctx.components.button({
      label: ctx.t('mineflayerWorld.book.write', 'Write (leave unsigned)'),
      icon: 'save',
      variant: 'filled',
      onClick: async () => {
        const slot = requireSlot();
        if (slot === null) {
          bookStatus.textContent = ctx.t('mineflayerWorld.book.needSlot', 'Choose a slot holding an unsigned book first.');
          return;
        }
        if (tooLong()) {
          bookStatus.textContent = ctx.t('mineflayerWorld.book.pageTooLong', 'This page is over the limit and will be refused.');
          return;
        }
        try {
          await deps.call('writeBook', [slot, pages]);
          bookStatus.textContent = ctx.t('mineflayerWorld.book.written', 'The book was written.');
          ctx.notify.success(ctx.t('mineflayerWorld.book.write', 'Write'), ctx.t('mineflayerWorld.book.written', 'The book was written.'));
        } catch (error) {
          deps.notifyError(ctx.t('mineflayerWorld.book.write', 'Write'), error);
        }
      }
    }),
    ctx.components.button({
      label: ctx.t('mineflayerWorld.book.sign', 'Sign and finish'),
      icon: 'edit',
      variant: 'outlined',
      onClick: async () => {
        const slot = requireSlot();
        if (slot === null) {
          bookStatus.textContent = ctx.t('mineflayerWorld.book.needSlot', 'Choose a slot holding an unsigned book first.');
          return;
        }
        if (authorField.get().trim().length === 0 || titleField.get().trim().length === 0) {
          bookStatus.textContent = ctx.t('mineflayerWorld.book.needAuthorTitle', 'Enter both an author and a title to sign a book.');
          return;
        }
        try {
          await deps.call('signBook', [slot, pages, authorField.get(), titleField.get()]);
          bookStatus.textContent = ctx.t('mineflayerWorld.book.signed', 'The book was signed.');
        } catch (error) {
          const code = (error as { code?: string } | undefined)?.code;
          if (code === 'METHOD_NOT_ALLOWED') {
            bookStatus.textContent = ctx.t(
              'mineflayerWorld.book.signUnavailable',
              'Signing is not reachable yet: the shared bot runtime does not expose "signBook" on its method list. See this feature\'s documentation for the exact addition it needs.'
            );
          } else {
            deps.notifyError(ctx.t('mineflayerWorld.book.sign', 'Sign and finish'), error);
          }
        }
      }
    })
  );

  return () => {
    /* nothing to unsubscribe */
  };
}
