/**
 * Turning raw output lines into captured messages.
 *
 * A line becomes a message only when a capture rule matches it. Nothing is
 * guessed and nothing is fabricated: a run that prints no chat produces no chat
 * rows, and the surface says so rather than filling the table with plausible
 * looking placeholders.
 */

import type { CaptureRule, CapturedMessage, LogSeverity, MessageChannel } from './state';
import { newId } from './state';

/* ================================================================== */
/* Compiling rules                                                     */
/* ================================================================== */

export interface CompiledRule {
  rule: CaptureRule;
  regex: RegExp | null;
  /** The exact reason a rule does not compile, shown beside it in the editor. */
  error: string | null;
}

export function compileRule(rule: CaptureRule): CompiledRule {
  if (!rule.enabled) return { rule, regex: null, error: null };
  try {
    const flags = rule.flags.replace(/[^imsuy]/g, '');
    return { rule, regex: new RegExp(rule.pattern, flags), error: null };
  } catch (error) {
    return { rule, regex: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export function compileRules(rules: CaptureRule[]): CompiledRule[] {
  return rules.map((rule) => compileRule(rule));
}

/* ================================================================== */
/* Severity of a raw line                                              */
/* ================================================================== */

const ERROR_MARKERS = /\b(?:error|failed|fatal|kicked|cannot|refused|exception)\b/i;
const WARNING_MARKERS = /\b(?:warn|warning|note|not installed|skipped|disconnected|timeout)\b/i;

/**
 * How a line is classified in the run log.
 *
 * Anything the scraper writes to standard error is at least a warning, because
 * that is what the stream means; the text is then read for a stronger marker.
 * The classification only decides the filter and the colour — the line itself is
 * always shown verbatim.
 */
export function severityOf(text: string, stream: 'stdout' | 'stderr' | 'runner'): LogSeverity {
  if (ERROR_MARKERS.test(text)) return 'error';
  if (stream === 'stderr') return 'warning';
  if (WARNING_MARKERS.test(text)) return 'warning';
  return 'info';
}

/* ================================================================== */
/* Applying rules                                                      */
/* ================================================================== */

function expandSender(template: string, match: RegExpMatchArray): string {
  const expanded = template.replace(/\{(\d+)\}/g, (_, index: string) => match[Number(index)] ?? '');
  const trimmed = expanded.trim();
  return trimmed.length > 0 ? trimmed : 'unknown';
}

/**
 * Resolves a time captured out of a line.
 *
 * A bare `HH:MM:SS` has no date in it, so it is anchored to the day the line was
 * read. That is stated on the row rather than silently presented as if the log
 * carried a full timestamp.
 */
function resolveTimestamp(raw: string, capturedAt: Date): { iso: string; fromLine: boolean } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { iso: capturedAt.toISOString(), fromLine: false };

  const clock = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (clock) {
    const stamped = new Date(capturedAt);
    stamped.setHours(Number(clock[1]), Number(clock[2]), Number(clock[3] ?? '0'), 0);
    return { iso: stamped.toISOString(), fromLine: true };
  }

  const parsed = Date.parse(trimmed);
  if (Number.isFinite(parsed)) return { iso: new Date(parsed).toISOString(), fromLine: true };
  return { iso: capturedAt.toISOString(), fromLine: false };
}

export interface CaptureContext {
  origin: string;
  source: 'run' | 'import';
  capturedAt?: Date;
}

/**
 * Runs the rules over one line and returns the first match, or null.
 *
 * First match rather than every match, so a line cannot appear several times in
 * the table under different channels. Rules are tried in their listed order,
 * which the editor lets the user change.
 */
export function captureLine(
  line: string,
  compiled: CompiledRule[],
  context: CaptureContext
): { message: CapturedMessage; ruleId: string } | null {
  const text = line.trim();
  if (text.length === 0) return null;
  const capturedAt = context.capturedAt ?? new Date();

  for (const entry of compiled) {
    if (!entry.regex) continue;
    const match = entry.regex.exec(text);
    if (!match) continue;

    const messageGroup = entry.rule.messageGroup;
    const body = (messageGroup > 0 ? match[messageGroup] : match[0]) ?? '';
    if (body.trim().length === 0) continue;

    const stamp =
      entry.rule.timestampGroup > 0
        ? resolveTimestamp(match[entry.rule.timestampGroup] ?? '', capturedAt)
        : { iso: capturedAt.toISOString(), fromLine: false };

    return {
      ruleId: entry.rule.id,
      message: {
        id: newId('bot-msg'),
        timestamp: stamp.iso,
        timestampFromLine: stamp.fromLine,
        sender: expandSender(entry.rule.senderTemplate, match),
        channel: entry.rule.channel,
        message: body.trim(),
        tags: [],
        origin: context.origin,
        source: context.source
      }
    };
  }

  return null;
}

export interface CaptureSummary {
  messages: CapturedMessage[];
  /** Lines read, including the ones no rule matched. */
  linesRead: number;
  /** How many rows each rule produced, so an unproductive rule is visible. */
  perRule: Map<string, number>;
}

export function captureLines(
  lines: string[],
  compiled: CompiledRule[],
  context: CaptureContext
): CaptureSummary {
  const messages: CapturedMessage[] = [];
  const perRule = new Map<string, number>();
  let linesRead = 0;

  for (const line of lines) {
    if (line.trim().length === 0) continue;
    linesRead += 1;
    const captured = captureLine(line, compiled, context);
    if (!captured) continue;
    messages.push(captured.message);
    perRule.set(captured.ruleId, (perRule.get(captured.ruleId) ?? 0) + 1);
  }

  return { messages, linesRead, perRule };
}

/** Human-readable channel names, used by the filter and the exported rows. */
export const CHANNEL_LABEL_KEYS: Record<MessageChannel, string> = {
  chat: 'bot.channel.chat',
  system: 'bot.channel.system',
  auth: 'bot.channel.auth',
  progress: 'bot.channel.progress',
  disconnect: 'bot.channel.disconnect',
  error: 'bot.channel.error'
};
