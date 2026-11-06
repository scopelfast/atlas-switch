/** E8.2 — rascunho local (sem LLM): linhas com marcadores típicos de ata / lista de tarefas. */

export const TRANSCRIPT_DRAFT_MAX_CHARS = 120_000;
export const TRANSCRIPT_DRAFT_MAX_PROPOSALS = 40;
const TITLE_MAX = 200;

function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function stripListDecorators(line: string): string {
  let t = line.replace(/^\[\s*[xX ]\s*\]\s+/, '');
  t = t.replace(/^\d{1,2}[\.)]\s+/, '');
  t = t.replace(/^[-*•○▪]\s+/, '');
  t = t.replace(/^(action|todo|task|acção|acao|tarefa)\s*[:.\-]\s*/i, '');
  return collapseSpaces(t);
}

function lineLooksStructuralOnly(line: string): boolean {
  if (line.length <= 2) return true;
  if (line.length < 55 && line === line.toUpperCase() && /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9\s\-–]+$/.test(line)) {
    return true;
  }
  return false;
}

export type TranscriptDraftProposal = { title: string };

/**
 * Extrai possíveis títulos de acção a partir de texto livre (ata, notas, export de transcrição).
 * Não chama APIs externas — o utilizador deve rever antes de gravar.
 */
export function transcriptToDraftProposals(transcript: string): TranscriptDraftProposal[] {
  if (typeof transcript !== 'string') return [];
  const slice = transcript.slice(0, TRANSCRIPT_DRAFT_MAX_CHARS);
  const lines = slice.split(/\r?\n/);
  const out: TranscriptDraftProposal[] = [];
  const seen = new Set<string>();

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    let line = collapseSpaces(trimmed);
    const boldFull = /^\*\*(.+?)\*\*:?$/.exec(line);
    if (boldFull) {
      line = collapseSpaces(boldFull[1]);
    }

    if (lineLooksStructuralOnly(line)) continue;

    const isMarked =
      /^\d{1,2}[\.)]\s+/.test(trimmed) ||
      /^[-*•○▪]\s+/.test(trimmed) ||
      /^\[\s*[xX ]\s*\]\s+/.test(trimmed) ||
      /^(action|todo|task|acção|acao|tarefa)\s*[:.\-]/i.test(trimmed) ||
      boldFull != null;

    if (!isMarked) continue;

    const title = stripListDecorators(line).slice(0, TITLE_MAX);
    if (title.length < 4) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title });
    if (out.length >= TRANSCRIPT_DRAFT_MAX_PROPOSALS) break;
  }

  return out;
}
