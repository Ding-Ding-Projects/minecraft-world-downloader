# Language, humour levels and the emoji switch

**Module:** `app/src/renderer/features/language/`
**Surfaces:** the **Language and voice** settings section, the **Language** destination, the first-run
disclosure notification, four command-palette entries and two bundled documentation articles.

This feature owns the controls that decide how every label, message and notification in the desktop
application reads, and the preview that makes those choices checkable before they are made.

---

## What it does

### The language mode

Three modes, persisted, applied live without a restart:

| Mode | Value | What renders |
| --- | --- | --- |
| English | `en` | Every surface in English. |
| Cantonese | `yue` | Every surface in playful Hong Kong Cantonese. |
| Bilingual | `both` | English as the prominent primary line, with a compact Cantonese line beneath it. |

Bilingual is the mode that stresses the layout, because it produces the longest strings the
interface ever renders. The Language destination exists largely so that can be checked rather than
assumed.

### Two independent humour levels

One slider per language, 1 to 5. Level 1 reads fully professional; level 5 is maximum playfulness.
They move independently, so English at 1 beside Cantonese at 5 is a real combination, and both
halves of a bilingual line have to read correctly in it.

Each slider carries a **live preview pane** showing the same three sample messages re-rendered at the
chosen level for that language:

1. an ordinary information line,
2. a destructive warning,
3. an error.

Those three categories are the ones a person most wants to see before opting in, and they are
precisely the ones a "we only style the friendly messages" implementation would have quietly carved
out.

### The emoji switch

**Show emojis in dialogs and message boxes.** When it is on, a dialog or message box carries one
decorative emoji. A button, an action label, a field label and a screen-reader name never carry one
in either position of the switch, because a control name has to be readable aloud. The control shows
both states side by side rather than describing the difference.

### The first-run disclosure

Because the humour level reaches errors, warnings and the confirmation before something is deleted,
the user is told so before opting into it.

- At first run a **non-blocking notification** states it plainly and carries `timeoutMs: 0`, so it
  waits for the reader instead of a timer. It offers **Read it** (which teleports to the permanent
  card) and **I understand**.
- The same words live permanently on the Language destination, so somebody who dismissed the
  notification a year ago can still read them.
- Acknowledging changes nothing except recording that it was read, as one local-history entry.
- It is a notification rather than a modal dialog because it informs; it does not gate anything.

### The Language destination

A dedicated tab carrying:

- the permanent disclosure card;
- the four live controls (the same functions the settings rows render, writing the same settings);
- the **fact check** described below;
- the **preview matrix** — the same screen in all three modes at both humour extremes, six cells,
  with a **preview width** slider (240–720 CSS pixels) and a **preview text scale** select
  (100/125/150/200 per cent) so bilingual crowding and display scaling are visible and checkable
  rather than described;
- the **variant list** — thirty rows (3 samples × 2 languages × 5 levels) with full bulk actions.

### Voice changes, facts do not — and the feature checks it

Each sample declares the literal facts every rung of its ladder must carry: a count, a folder, a host
and port, a consequence, a recovery. `verifySamples()` reads all thirty rendered variants and reports
any rung that dropped one, and the result is displayed on the destination. A green line is a check
that ran; a red line names the exact sample, language and level at fault rather than reporting a
total that hides it.

---

## Configuration

### Application-wide settings this feature writes

These are owned by the shell and registered by it. This feature writes these exact ids, so the
controls here and the controls elsewhere can never disagree about what is in force.

| Setting id | Type | Shipped default |
| --- | --- | --- |
| `language.mode` | `en` \| `yue` \| `both` | `en` |
| `language.funny.en` | 1–5 | `3` |
| `language.funny.yue` | 1–5 | `3` |
| `language.emojiInDialogs` | boolean | `true` |

### Mirror ids, and why they exist

A setting id may be registered exactly once in the whole application, and a settings row prints the
provenance of the id it is registered under. So each control here is registered under a mirror id and
kept in lockstep with the real value **and** its provenance:

| Mirror id | Reflects |
| --- | --- |
| `language.voice.mode` | `language.mode` |
| `language.voice.funny.en` | `language.funny.en` |
| `language.voice.funny.yue` | `language.funny.yue` |
| `language.voice.emoji` | `language.emojiInDialogs` |

When the real setting has never been written, the mirror is **reset** rather than set, so the
provenance line reads "no file has ever set this" instead of presenting a shipped default as
somebody's deliberate choice. Each control states which pair it is working with, directly underneath
itself. `settings.set` is a no-op when the value is unchanged, so the two-way synchronisation cannot
loop.

### Settings this feature owns outright

| Setting id | Type | Shipped default | Purpose |
| --- | --- | --- | --- |
| `language.preview.width` | 240–720 | `380` | Width of each preview cell, in CSS pixels. |
| `language.preview.scale` | `100`/`125`/`150`/`200` | `100` | Text-and-layout scale applied to the previews only. |
| `language.disclosure.acknowledgedAt` | ISO timestamp | unset | When the disclosure was acknowledged. |
| `language.school.tabHidden` | boolean | `false` | Whether the study mode — and not the user — closed the destination. |

### Command palette

| Entry | Kind | Effect |
| --- | --- | --- |
| Language preview | destination | Teleports to the matrix. |
| Every rendered variant | destination | Teleports to the variant list. |
| Show the humour disclosure | command | Teleports to the disclosure card. |
| Reset the language and voice settings | command | Confirms, then resets the four settings. |

The four mirror settings and the two preview settings are also reachable as palette setting rows,
rendering their real controls inline, because the palette builds those from the registered sections.

---

## Behaviour under the renamable study mode

While that mode is on, this feature must behave as though it were **not installed** — omitted, not
disabled. It does that by withdrawing itself rather than greying itself out:

1. its settings section and its palette entries are removed from the arrays the registry reads, so
   any surface built afterwards simply never contains them;
2. if the Language destination is open it is closed, and `language.school.tabHidden` records that
   **this feature** closed it;
3. a settings panel that was already on screen has this feature's own rows removed from it in place,
   along with its section tab button — the one case the registry cannot reach;
4. the first-run disclosure is not raised at all, because disclosing a capability the person cannot
   see would be announcing it rather than disclosing it.

When the mode is switched off, the section and palette entries return, and the destination is
restored **only if** `language.school.tabHidden` says this feature was what closed it — a destination
the user closed themselves stays closed. It is restored by removing it from the closed set rather
than by opening it, so leaving the study mode never yanks somebody away from what they were looking
at. The user's own mode, levels and emoji choice are never altered by any of this.

---

## Failure modes

| Situation | What happens |
| --- | --- |
| A stored humour level is corrupt or out of range | `clampLevel` resolves it to the nearest real rung, so a bad value renders a message rather than `undefined`. An out-of-range value typed into the setting is refused by the control's own validator, which says the level is a whole number from 1 to 5 and that nothing was changed. |
| A stored language mode is unrecognised | Falls back to `en`. |
| A preview width or scale outside its range | Clamped on read to 240–720 and to a listed scale; nothing is written back, so a hand-edited file is not silently rewritten. |
| The clipboard refuses a copy | The notification names the reason and states that nothing was changed. A copy that did not happen is never reported as one. |
| An export is cancelled at the file dialog | Nothing is written, nothing is claimed and no history entry is recorded. |
| The chosen export format cannot carry a field | The preflight warning names the fields **before** anything is written. |
| A fact check fails | The card turns and names the exact sample, language and level. |
| A history write fails | The recorder logs it and never fails the operation the user asked for. |
| The Language destination is reached through a stale route while the study mode is on | It closes itself rather than rendering a capability that is meant to be absent. |

---

## Security and privacy considerations

- **No network access of any kind.** Every sample string is compiled into the build. There is no
  CDN, no remote font, no analytics and no telemetry on any surface this feature owns.
- **Nothing leaves the window** except an export the user explicitly asked for, to a path they chose
  in the system file dialog.
- **The personal vocabulary** is applied to previews exactly as it is applied everywhere else, through
  the shared `applyVocabulary`. This feature never reads, caches, copies or exports the vocabulary
  file, its path or its contents; a variant export contains only the shipped sample text after
  replacement, never the mapping that produced it.
- **No credentials** are read or written. The only things persisted are the six settings listed above.
- **The sample messages describe nothing real.** No world was saved, no profile is being deleted and
  no connection was refused. They are labelled as examples on every surface that renders them, so a
  preview can never be mistaken for a report of something that happened.
- **Emoji never reaches an accessible name**, so a screen reader is never handed a decoration in
  place of a control's name.

---

## Accessibility

- Every control is keyboard-operable with a visible focus ring: the segmented mode control has
  roving arrow-key focus, the sliders are native range inputs, the switch is a native checkbox with
  `role="switch"`.
- Preview cells are non-interactive and carry no focusable children, so keyboard traversal is not
  padded with thirty stops that do nothing.
- Each preview is a labelled group naming its mode and levels, and each is captioned as a static
  preview.
- The level readout, the selection count and the fact-check line are live regions, so a change is
  announced rather than only drawn.
- Cantonese text carries `lang="yue-Hant-HK"` so a screen reader picks the right voice.
- Variant checkboxes are 20 px with generous padding, keeping the row's target above the 44 px
  minimum; **Shift**-click and **Shift** with the arrow keys both select a range.
- Nothing has a fixed height. The matrix and the variant table each scroll inside their own
  container, so the page itself never scrolls sideways at any width or scale.

---

## Verification

1. **Both sliders reach the copy.** Set English to 1 and Cantonese to 5. Both preview panes change
   voice; every fact in them is unchanged. The fact-check card reads "All 30 rendered variants carry
   every fact they declare."
2. **They are independent.** Confirm moving one slider does not move the other, in either direction.
3. **Bilingual crowding.** Switch to bilingual, drag **Preview width** to 240 and confirm no cell
   clips: text wraps, and the page does not scroll sideways.
4. **Display scale.** Set **Preview text scale** to 200 per cent and repeat step 3.
5. **Emoji boundary.** Turn the switch off and confirm the emoji leaves the message boxes; confirm it
   was never on the action labels in the preview screens at either position.
6. **Disclosure.** With `language.disclosure.acknowledgedAt` unset, launch the application: the
   notification appears, does not steal focus, does not auto-dismiss, and **Read it** lands on the
   card. Acknowledge it and confirm the card shows the timestamp and that one history entry was
   recorded.
7. **Provenance honesty.** On a fresh profile, confirm each control's provenance line reads "no file
   has ever set this" and names the real shipped value; change one and confirm it becomes "set by
   you", stored in the settings file.
8. **Bulk actions.** Shift-click a range, search to hide part of the selection, and confirm the count
   line names the hidden part; confirm the two select-all actions state their own scope and their own
   counts.
9. **Export honesty.** Export the selection as CSV and confirm any lossy field is named before the
   file is written.
10. **Study mode.** Turn it on with the settings surface open: this section's rows and its section tab
    disappear, the Language destination leaves the strip, and its palette entries stop matching. Turn
    it off: all of them return, and the mode, levels and emoji choice are exactly as they were.
11. **Reset.** Run **Reset the language and voice settings**, confirm the dialog, and check that all
    four values return to their shipped defaults and that the change is readable in local history.

---

## Suggested related articles

- [`settings.md`](settings.md) — how a setting declares its explanation and its default provenance.
- [`accessibility-themes.md`](accessibility-themes.md) — the appearance system these previews are
  rendered with.
- [`locks.md`](locks.md) — the toy locks that can be placed on any of these controls.
- [`support-tickets.md`](support-tickets.md) — the recovery route referenced by a locked control.

In-application articles: **Choosing a language and a voice** (`language.voice`) and **The preview
matrix and the variant list** (`language.preview`), both bundled into the build and reachable from
the documentation destination.
