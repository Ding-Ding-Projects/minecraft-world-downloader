# External editor handoff

**Module:** `app/src/renderer/features/external-editor/`
**Destination:** *External editor* (tab id `external-editor.main`)
**Settings section:** *External editor*
**Inventory row:** 6.9 — *Open in an external editor, with Visual Studio Code as the first-class target for every export.*

Anything this application can point at on disk can be handed to a real editor in
one action: an export that was just written, the folder you work in, or a path
you browse for by hand. Visual Studio Code is the first-class target, and a
folder is handed over as a **workspace root** rather than as one lonely file —
a file tree is the entire reason to open a folder in an editor.

---

## Behaviour

### Detection

Detection runs through the privileged bridge (`studio.editor.detect()`), which
probes each known editor twice: as a bare command on `PATH`, and then at the
usual per-user and machine install locations. Visual Studio Code, Visual Studio
Code Insiders and VSCodium are tried first, in that order, and are the editors
that can open a directory as a workspace root.

The probe runs shortly after startup (this can be turned off) and on demand from
**Re-check**, the settings action, or the command palette. Re-checking also
re-verifies every executable the user added against the disk, so an editor that
has been uninstalled or moved since the last launch stops claiming to be there
instead of failing at the moment somebody uses it.

### Four states, said out loud

Every row in the inventory carries one of four states, and the surface never
blurs them:

| State | Meaning | Can it be started? |
| --- | --- | --- |
| Installed and ready | Found on this machine by the probe | Yes |
| The same file as a detected editor | Added by the user, and it turned out to be one the application already knows how to start | Yes |
| Not on this machine | Known by name, executable absent | No |
| Present, but this application cannot start it | Added by the user, verified on disk, not an editor the application knows how to launch | No |

The fourth row is the honest one, and it is a deliberate boundary rather than an
oversight. A handoff launches one of the editors the privileged part of the
application knows how to start; it does not run an arbitrary program named in
the interface, because that would be a general "run anything" capability wearing
an editor's label. An entry in that state keeps its **Open** control disabled
and names exactly that reason, and two routes that genuinely work are offered
beside it: opening the path with the operating system's default application, and
showing it in the file manager. Neither pretends to be the editor that was
chosen.

In practice the common case for a browsed executable is that it *is* one of the
known editors — the usual reason to browse is that the probe looked in the wrong
place — so it becomes startable the moment it is added.

### Choosing the active editor

The choice is either **Choose automatically**, which prefers Visual Studio Code
and falls back through the rest of its family, or a specific editor. An explicit
choice that is unavailable opens nothing and says so; nothing else is started in
its place, because a window from an editor nobody asked for explains nothing
about itself.

The picker is rebuilt from the machine's own answer whenever the inventory
changes, so it can never offer an editor that is not there.

### Adding an editor

Browse for the executable with the field's native browse control. The path is
verified against the disk before it is stored; a directory is refused with that
reason; a duplicate is refused by naming the entry that already holds it; the
name defaults to the file name when none is given. Forty stored editors is the
ceiling, stated when it is reached.

### Handing a path over

The *Open something* card takes a file or a folder (browse for either), asks
what the path is, and — for a file — how it should open: on its own, or with its
containing folder as a workspace root. The folder choice is fixed and disabled
with its reason when the path is a folder, because a folder is always a
workspace root.

The **Open the project folder** button and the matching palette command hand over
the folder set in settings, as a workspace root. With no project folder set,
both stay disabled and say exactly that, rather than guessing at a folder.

Every handoff, successful or refused, is written to **Recent handoffs** with its
exact failure text, so an error can be read again after its notification is gone.

### Where it appears

- **Tab** — *External editor*, containing the status card, the inventory, the add
  form, the handoff controls and the recent list.
- **Settings** — *External editor*: active editor, default file mode, probe at
  startup, project folder, recent-handoff retention, and three actions (open the
  tab, check now, download).
- **Command palette** — the destination, three teleport targets, five commands
  (open the project folder, open a file, open a folder, re-check, download) and
  five live setting rows.
- **Documentation browser** — `external-editor.overview` and
  `external-editor.troubleshooting`.

---

## Configuration

| Setting id | Kind | Default | What it does |
| --- | --- | --- | --- |
| `external-editor.active` | custom picker | `auto` | Which editor a handoff uses. Options come from real detection plus added editors. |
| `external-editor.fileMode` | select | `file` | Whether a single-file handoff opens the file alone or its folder as a workspace root. Each handoff can override it. |
| `external-editor.probeAtStart` | switch | `true` | Probe for editors shortly after startup, so the first handoff does not wait. |
| `external-editor.projectFolder` | folder | *(empty)* | The folder the project-folder command and button hand over. Empty leaves both disabled with that reason. |
| `external-editor.recentLimit` | number | `20` | How many recent handoffs are kept (0–200). Zero keeps none, and the list says so. |

Two stored values have no visible control of their own and are declared so that
reset and provenance work on them: `external-editor.customEditors` (the added
editors) and `external-editor.recent` (the handoff log).

Every setting carries its own explanation behind progressive disclosure and a
truthful provenance line naming the real value in effect, including when nothing
has ever written it.

---

## Failure modes

| Situation | What happens |
| --- | --- |
| The probe itself fails | The exact failure text is shown above the inventory and only added editors are listed. Nothing is invented to fill the gap. |
| No editor found at all | The status card says so plainly and offers the Visual Studio Code download. Nothing is opened. |
| The chosen editor is unavailable | The handoff is refused, naming that editor. No substitute is started. |
| A folder was asked for and the editor cannot take one | Refused with the editor's name, rather than downgraded to opening the file on its own. |
| The path has moved or been deleted | Checked immediately before the handoff, so the message names the path instead of reporting a mysterious editor failure. |
| The editor refuses to start | The exact text from the operating system is shown and stored in the recent list. |
| An added executable is not a known editor | Stored and verified, listed as present but not startable, with the default-application and file-manager routes offered instead. |
| The clipboard or file manager refuses | Reported with the exact reason; the path is repeated in the message so it can still be used. |

Nothing here ever reports success it did not have. Every refusal is a sentence
naming the cause, and the same sentence is what lands in the recent list.

---

## Security considerations

- **No arbitrary execution.** Launching happens in the privileged process, which
  starts a *known* editor by its identifier with the target path as its only
  argument, with no shell involved — so nothing inside a path can be interpreted
  as a command. The renderer cannot ask for an arbitrary program to be run,
  which is precisely why an unrecognised executable is stored but not started.
- **Paths are verified, not trusted.** A browsed executable is checked against
  the disk before it is stored, and a handoff target is checked immediately
  before it is handed over.
- **No network at runtime.** Nothing is fetched, no remote asset is referenced,
  and no request is made. The download button opens `code.visualstudio.com` in
  the user's own browser through the shell, which refuses anything that is not
  an `http(s)` address; that is the only outbound step and it belongs to the
  user, not the application.
- **No secrets.** This feature stores paths and names only. Nothing it writes to
  settings, history, exports or notifications is credential material.
- **Bounded storage.** Forty added editors and two hundred recent records are
  hard ceilings, so a stored list cannot grow without bound, and malformed
  stored entries are dropped when read rather than trusted.

---

## Verification

Run these by hand on a machine with Visual Studio Code installed, and again on
one without it.

1. Open the tab. The inventory names Visual Studio Code as installed and ready,
   or the status card says plainly that nothing usable was found and offers the
   download.
2. Browse for a file, leave the mode on *the file on its own*, and open it. The
   editor opens that file.
3. Switch to *its folder as a workspace root* and open the same file. The editor
   opens the containing folder with its tree, and the recent record names the
   folder rather than the file.
4. Set the project folder in settings and use **Open the project folder**, then
   the palette command of the same name. Both open that folder as a workspace
   root. Clear the setting and confirm both refuse with the exact reason.
5. Choose an editor that is not installed as the active one. **Open** goes
   disabled and names it; nothing else is started.
6. Add an executable that is not an editor the application knows. It is stored,
   verified and listed as present but not startable, its Open route is disabled
   with that reason, and the default-application and file-manager routes work.
7. Add the real Visual Studio Code executable by browsing for it. It is listed
   as the same file as a detected editor and can be used immediately.
8. Search both lists; select rows with Shift held and with Shift+Space; use
   *select the rows shown* against *select every row* with a search active and
   confirm the counts differ honestly; invert the selection.
9. Export a selection from each list in two different formats. The preflight
   names any field the format cannot carry before anything is written.
10. Remove added editors and forget recent records. Both go through the two-key
    gate, both are recorded in local history, and neither touches a file on disk.
11. Repeat step 2 in all three language modes and at humour levels 1 and 5 in
    each language. The wording changes; the editor name, the path and the reason
    do not.
12. Walk the whole surface with the keyboard only, then with a screen reader.
    Every control is reachable, every disabled control names its unmet
    condition, and the status lines announce.
13. Narrow the window and set the display scale to 125%, 150% and 200% in
    bilingual mode. Nothing clips; the tables scroll inside their own container
    and the panel never scrolls sideways.

School mode is not relevant to this feature: it exposes no Cantonese-only,
funny-level, personal-vocabulary or dim-sum capability of its own, so there is
nothing for that mode to omit. Its copy still follows the active language mode
and humour levels like every other surface.

---

## Suggested related articles

- [Export](export.md) — every export can be opened in the editor from the run
  that produced it.
- [Local history](history.md) — where the editor changes and handoffs are
  recorded.
- [Settings](settings.md) — where the five controls above live, with their
  explanations, provenance lines and the palette rows that render them.
- [Documentation browser](docs-browser.md) — where the two bundled articles for
  this feature are read offline.
