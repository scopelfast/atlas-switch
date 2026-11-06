/**
 * Verificação rápida de idempotência (E8.13). Executar: `pnpm check:ai-pipeline`
 */
import { assertReunifyTranscriptPipelineIdempotent } from '@/lib/ai/pipeline/reunify-transcript-pipeline';

const sample = `
## Ata
1. Enviar relatório mensal até sexta
- [ ] Ligar para o cliente ACME sobre prazo
* Rever orçamento Q2
`;

assertReunifyTranscriptPipelineIdempotent(sample);
assertReunifyTranscriptPipelineIdempotent('');

console.log('check:ai-pipeline — OK');
