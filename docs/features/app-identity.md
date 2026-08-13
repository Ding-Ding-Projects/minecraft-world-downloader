# Application identity

**Module:** `app/src/renderer/features/app-identity/`
**Satisfies:** feature inventory row **2.7** (user-renamable application display name), and carries
the About surface that row's notes require — shipped name, chosen name, version, release code name
with its catalogue link, licence and credits.

The whole feature rests on one separation:

> **Display is a setting. Identity is a constant. Neither is ever derived from the other.**

The name the application shows you lives in a single settings key. The package identity and the
shipped product name arrive from the main process as compiled-in constants and cannot be written
from the renderer at all — there is no bridge call that changes them.

---

## Behaviour

### The rename

The **About** tab's first card holds the editor:

- a **Display name** text field, pre-filled with whatever you chose (empty when you have not chosen
  anything), whose placeholder is the shipped name;
- **Use this name**, which applies it — as does pressing Enter or leaving the field;
- **Restore the shipped name**, which clears it in one action;
- a truthful provenance line: either *"No file has ever set this. The application is using its
  shipped name: `<value>`"* or *"Set by you, and stored in `<settings file path>`"*;
- a note, always visible, stating that diagnostics use the shipped name rather than the chosen one.

Applying a name writes `app.displayName`. The core shell already listens for that key and updates
the title bar, the window title the operating system shows, and its own brand text. Notifications
and this surface read the same value.

Clearing the field is treated as a reset rather than as an error. Somebody who deletes the text
intends to go back to the shipped name, and refusing an empty value would trap them.

### The live preview

A static preview shows four lines: the title bar, a notification, this surface, and a diagnostic
report. The first three follow what you are typing as you type it; the fourth shows the **shipped**
name and does not move, which is the clearest possible statement of the rule.

It is labelled a static preview and is styled as one. Nothing in it is a control.

### What a rename does not move

Five checks run when the surface opens and again whenever **Run the checks again** is pressed. Each
reads real state and reports what it found; the evidence beside each verdict is the value that was
read, not a description of it.

| Check | What it evaluates |
| --- | --- |
| Data directory named by the package identity | The final segment of `AppInfo.userDataDir` is compared with `AppInfo.packageName`. |
| Everything stored sits inside that directory | `historyDir`, `logsDir` and the settings file are tested for containment. |
| Renaming writes exactly one settings key | Every settings key is scanned for one whose value equals the chosen name; the holders are listed by key. Passes only when the sole holder is `app.displayName`. |
| No setting can move the package identity | The store is checked for `app.packageName`, `app.productName`, `app.userDataDir` and `app.updateFeed`. |
| The shipped name is available | `AppInfo.productName` is confirmed non-empty, and both names are shown side by side. |

A check that cannot decide reports **Inconclusive** rather than guessing. Each verdict is stated in
words as well as by colour.

**Verification of the underlying claim, by reading the code that resolves the data directory:**
`app/src/main/paths.ts` declares `PACKAGE_NAME = 'world-downloader-studio'` and derives
`userDataRoot()`, `settingsFilePath()`, `vaultFilePath()`, `historyDir()`, `logsDir()`,
`cacheDir()` and `vocabularyCacheDir()` from it. `applyStablePaths()` pins Electron's `userData`,
`sessionData` and `logs` paths to that root before `app.whenReady()`, precisely so the installed
product name cannot drag the data directory around. No function in that file reads a setting.

### Identity values

A searchable, selectable table of every identity value the build holds, with a **Kind** column:
`Constant`, `Display`, `Path`, `Runtime`. It carries the full list contract — search field with its
anchored pattern builder, multi-select with shift ranges and an arrow-key path, a select-all that
names its scope (*the N shown* versus *every one of the M*), inverse selection, per-row copy, bulk
copy behind a preview, and export in every format the exporter offers with the preflight losses
shown before anything is written.

### Release code name

Every release carries a dim sum code name beside its version number. The code name is a label and
never a replacement for the version.

The card states plainly when no code name has been recorded for the build rather than inventing one:
the release notes hold the authoritative name. A picker populated from the real dish list records it
locally so the window agrees with the notes; clearing it is one action.

No photograph is bundled. The dish photographs live in the public catalogue at
`https://github.com/Ding-Ding-Projects/dim-sum-photos`, and the card links there rather than
shipping a copy.

### Licence, cost and credits

- The licence (`GPL-3.0-or-later`) with a link to its full text.
- A plain statement that the application costs nothing in any direction: no purchase, fee,
  subscription, lapsing trial, or held-back capability, and no payment routed through this project.
- The credits: every project this application depends on, with its role, the part of the product it
  serves, and a link to **that project's own page**. If you want to fund any of it, fund them —
  anything they accept goes to them, and no link here passes through this project. Whether a given
  project accepts money at all is stated on their page and is deliberately not guessed at here.

The credits are a list, so they carry the same bulk-action contract as the identity table.

### Diagnostic report

A plain-text report you can paste into an issue. It is headed with the **shipped** name, lists the
versions and paths, and records what the identity checks found. It can be copied, saved to a file,
and then opened in an external editor — that last button stays disabled until the report has been
saved, and says why.

---

## Configuration

| Setting id | Kind | Default | What it does |
| --- | --- | --- | --- |
| `app.displayName` | text | `''` (the shipped name) | The name the application shows. Declared by the core appearance section; this feature reads and writes it rather than registering a second control for the same value. |
| `app-identity.diagnostics.includeChosenName` | switch | `false` | Adds a line naming the local display name to a diagnostic report. The shipped name is in the report either way. |
| `app-identity.diagnostics.redactPaths` | switch | `true` | Writes paths from the application directory downwards, with an ellipsis above it. That part is an account name and a machine layout. |
| `app-identity.codeName` | stored value | `''` | The dim sum code name recorded for this build. Surfaced only on the About tab, never as a settings row, so the study mode can omit it entirely. |
| `app-identity.openAbout` | action | — | Teleports to the About surface. |
| `app-identity.resetName` | action | — | Restores the shipped name in one action. |

Limits: a display name is at most **80 characters**; invisible control and formatting characters
(`U+0000`–`U+001F`, `U+007F`, `U+200B`–`U+200F`, `U+2028`, `U+2029`, `U+FEFF`) are refused.

---

## Failure modes

| Situation | What happens |
| --- | --- |
| Name longer than 80 characters | Refused with the reason inline and announced assertively. Nothing changes; the previous name stays in force. |
| Name containing invisible characters | Refused the same way, naming the actual problem. |
| Name is only whitespace | Trimmed to empty, which means the shipped name — treated as a reset, not an error. |
| Reset pressed when no name is set | An informational notification saying it is already using the shipped name and that nothing was changed. |
| A settings write fails | The store reports it; the value in the window and the value on disk are the same store, so nothing silently diverges. The history entry for the change is separate and never fails the rename. |
| A history write fails | Logged by the recorder and never thrown into the rename. The rename still happens; the history status surface reports the failure. |
| The clipboard refuses text | An error notification naming the reason. Nothing is silently dropped. |
| `openExternal` refuses a link | An error notification naming the reason. The application never opens a non-`http(s)` scheme. |
| An identity check finds a mismatch | Reported as **Failed** with the values that were read. It is not suppressed, and the diagnostic report carries the same verdict. |
| The settings file path is not reported yet | Shown as *Not reported yet* rather than as an empty cell, and the containment check simply omits it. |
| Study mode is on | The release code name card is omitted from the surface entirely — not rendered and disabled. |

---

## Security and privacy considerations

- **No network at runtime.** Nothing here fetches anything. The three links (licence text, dish
  catalogue, and each credited project's page) go through `studio.shell.openExternal`, which refuses
  any scheme that is not `http(s)` and opens the user's own browser. No CDN, no remote font, no
  remote image, no analytics.
- **Paths are shortened by default** in the diagnostic report, because the part above the
  application directory is the account name and the machine layout. The setting that turns the
  shortening off says exactly what it exposes.
- **The chosen name is omitted from diagnostics by default.** It is a local label; the shipped name
  is what identifies the software to a reader.
- **No secret is read, displayed, or recorded.** The feature never touches the credential vault, and
  its history entries carry only the names before and after, the shipped name and the package
  identity.
- **A rename cannot escalate into anything.** It writes one settings key. The bridge exposes no call
  that changes the package identity, the data directory, the installer identity or the update feed,
  which is why the fourth check can look for such a setting and expect to find none.

---

## Verification

Manual, against a built artifact:

1. Open **About**. The provenance line reads *"No file has ever set this…"* and names the shipped
   name; the four preview lines all show the shipped name.
2. Type a name. The first three preview lines follow each keystroke; the diagnostic line does not.
3. Apply it. The title bar and the window title change; a success notification names the new name
   and states that the data directory, package identity, installer and update feed did not move.
4. Re-run the identity checks. All five pass, and the *"Renaming writes exactly one settings key"*
   evidence lists exactly `app.displayName`.
5. Open the data folder from the header. Its final segment is the package identity, not the name
   you typed.
6. Restart the application. The chosen name is still in force and the data directory is unchanged —
   the history, logs and settings are all still there.
7. Press **Restore the shipped name**. One action returns it; the notification names the previous
   name; the history panel holds both entries.
8. Paste more than 80 characters, and paste a string containing a zero-width space. Both are refused
   with a reason, and the name in force does not change.
9. Switch to bilingual mode at funny level 1 for English and 5 for Cantonese. Every heading shows
   both languages, nothing clips, and the facts (paths, versions, names) are identical at every
   level.
10. Turn the study mode on. The release code name card disappears from the surface entirely.
11. In the identity table: filter, select a range with Shift, move with the arrow keys, use both
    select-all buttons and confirm their counts differ when a filter is active, export as CSV and
    confirm the preflight lists nothing lost, then export as JSON.
12. Copy the diagnostic report and read it. It is headed with the shipped name, the paths are
    shortened, and the check verdicts match what the surface shows.
13. Press `Ctrl+Shift+F` and search for "rename". Selecting the result lands on the display-name
    field with focus on it.

---

## Suggested related articles

- [Settings](./settings.md) — where the two diagnostic-report switches and the two identity actions
  live, and how every setting states its own provenance.
- [Language, humour levels and the emoji switch](./language.md) — the three modes every string on
  this surface is written for, including the longest bilingual layouts it is checked against.
- [School mode](./school-mode.md) — why the release code name card is omitted rather than disabled
  while that mode is on.
- [The dim sum surprise](./dim-sum.md) — the dish list the release code name is drawn from, and the
  public catalogue the photographs actually live in.
- [Toy locks and Support Tickets](./locks.md) — the recovery route that names the same application
  data folder this surface opens.

In the application's own documentation browser, the two articles this feature registers are
**Renaming the application** and **The About surface**, both under the *Identity* category.
