import type { DocArticle } from '../../core/registry';

/**
 * The narrator's in-application documentation.
 *
 * These articles are bundled into the build and rendered by the shared markdown
 * renderer. No remote asset appears in any of them.
 */

export const NARRATOR_DOCS: DocArticle[] = [
  {
    id: 'narrator.overview',
    title: 'The spoken narrator',
    category: 'Language and voice',
    body: [
      'The narrator reads out what the application is doing. It is **off in a new installation** and speaks nothing at all until you turn it on in Settings, or on its own tab.',
      '',
      '## What it speaks, and what it will not',
      '',
      'Events are grouped into categories — failures, warnings, completions, notices, progress, application events, navigation and settings changes. Each category has its own switch and its own minimum gap, so you can have failures spoken aloud while everything else stays quiet.',
      '',
      'Three separate mechanisms keep it sparing:',
      '',
      '1. **A wait before speaking.** A line does not go out immediately. Anything of the same category arriving inside that window *replaces* it rather than queueing behind it, so a burst of similar events becomes the single line that was current when the burst stopped.',
      '2. **A minimum gap per category.** A second line of the same kind inside its own gap is not spoken, and the reason is written into the log so a line you expected and did not hear is explainable rather than mysterious.',
      '3. **A serialized queue.** Exactly one line is spoken at a time. Nothing ever overlaps, including the two halves of a bilingual line.',
      '',
      '## Failures are the exception, deliberately',
      '',
      'The failure category jumps the queue, ignores the wait and the minimum gap, and interrupts an ordinary line that is already speaking. A rate limit that swallowed an error report would be worse than having no narrator at all, so spoken failure narration is never held back and always names the actual failure and what to do about it.',
      '',
      'Quiet hours are the one thing that does silence failures too. That is a deliberate choice you make by switching them on, and the log records every line the window suppressed.',
      '',
      '## Both languages, one at a time',
      '',
      'Choosing **Both** speaks the English line first and the Cantonese line after it, strictly serialized. They are never mixed into one utterance and never overlap. Each track keeps its own voice, rate and pitch.',
      '',
      'The humour level styles the sentence *around* the fact — the frame changes, the fact never does. A spoken failure names the same failure at level 1 and at level 5.',
      '',
      '## Emoji are removed before speaking',
      '',
      'A speech voice pronounces an emoji as its full name, so a cheerful tick mark becomes several spoken words in the middle of a sentence. Decoration is stripped before the line reaches the speech engine and the words survive untouched. The emoji switch still decorates dialogs on screen exactly as it did.',
      '',
      '## The study mode',
      '',
      'While the study mode is on, the narrator speaks English only. The Cantonese track, its voice, its rate and its pitch are not offered at all — the controls are omitted rather than disabled — and every choice you made for them is kept and returns the moment the mode goes off.'
    ].join('\n'),
    related: ['narrator.voices', 'narrator.accessibility', 'core.language']
  },
  {
    id: 'narrator.voices',
    title: 'Choosing narrator voices',
    category: 'Language and voice',
    body: [
      'There is **one picker per narrated language**, never one shared picker. Choosing an English voice says nothing about which Cantonese voice should read the other half of a bilingual line, so each track carries its own selection, its own rate, its own pitch and its own status.',
      '',
      '## Nothing ships with a named voice',
      '',
      'The shipped default for both tracks is **Choose automatically**. The application cannot know what is installed on your computer until it asks, so naming a favourite voice out of the box would be a preference for one that most machines do not have. Automatic picks the first voice this computer offers for the language, preferring one that runs locally, and the status line says which one it picked.',
      '',
      '## The list arrives late, and that is normal',
      '',
      'Platform voice enumeration commonly returns nothing on the first call and fills in a moment later. A picker that reads the list once reports "no voices installed" on a machine with forty of them. This one starts in a waiting state, subscribes to the platform event, re-reads on a bounded schedule, and only reports an empty list after the machine has genuinely had its chance to answer.',
      '',
      '## What the status line underneath is for',
      '',
      'A select box that merely shows a value implies that value is what will be heard. The line beneath it says what is *actually* in effect:',
      '',
      '- which voice will speak, and whether it runs locally or over the network;',
      '- that a network-backed voice **goes quiet when this computer is offline**, and whether it is offline right now;',
      '- that a chosen voice is **not installed on this computer** — in which case your choice is kept exactly as it is, a fallback speaks in the meantime, and the picker still shows your real choice rather than silently sliding back to automatic;',
      '- that **no voice on this computer can read the language at all**, in which case that track stays silent until one is installed in the operating system speech settings.',
      '',
      '## What is stored',
      '',
      'The platform voice identity, never the display name. Names are not unique — one machine can carry several voices with the same name from different engines — and platforms translate them, so a stored name silently stops matching on another install.',
      '',
      '## Rate and pitch',
      '',
      'Both are adjustable within the ranges the platform documents: rate from 0.1 to 10, pitch from 0 to 2. Both ship at 1, which is the voice speaking the way its author intended. Some voices ignore the extremes, and some cannot change pitch at all; that is the voice, not the setting.'
    ].join('\n'),
    related: ['narrator.overview', 'narrator.accessibility']
  },
  {
    id: 'narrator.accessibility',
    title: 'The narrator beside a screen reader',
    category: 'Language and voice',
    body: [
      'A window is given **no way to ask whether a screen reader is running**. This application does not claim to detect one, because a confident guess dressed as a fact is worse than an honest limit.',
      '',
      '## What automatic actually does',
      '',
      'On the automatic setting the narrator ducks around the application\'s own announcements instead. Whenever the application announces something on a live region — which is exactly when a screen reader, if one is running, starts talking — the narrator waits and drops its volume for a short window. It is a real signal about a real moment, rather than a claim about your setup.',
      '',
      '## Or simply tell it',
      '',
      'The other settings let you state what is true on this computer:',
      '',
      '- **A screen reader is running: always speak quietly and wait** — the narrator ducks all the time rather than only around announcements.',
      '- **A screen reader is running: say nothing at all** — the narrator yields completely and the status line says so, so silence is never mistaken for a fault.',
      '- **No screen reader: never duck** — the narrator speaks at full volume without waiting.',
      '',
      '## Quiet hours',
      '',
      'Between the two times you set, every spoken line stops, failures included. The events still happen and still appear as notifications; only the speaking stops, and every suppressed line is recorded with that exact reason. A window that crosses midnight, such as 22:00 to 07:00, works as written.',
      '',
      '## The log',
      '',
      'Everything the narrator said, and everything it did not, with the reason: the category was off, the gap had not elapsed, a newer line replaced it, the queue was full, quiet hours were in force, or no installed voice could read the language. The log is held in memory for the session only and is never written to disk. Clearing it is irreversible and goes through the destructive-action gate.'
    ].join('\n'),
    related: ['narrator.overview', 'narrator.voices', 'core.locks']
  }
];
