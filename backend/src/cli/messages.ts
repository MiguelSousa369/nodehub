// ---------------------------------------------------------------------------
// CLI texts in the team language (GET /api/settings): English or Portuguese (Portugal).
// Session field names in printed records stay recognisable in both languages for Claude.
// ---------------------------------------------------------------------------

export type CliLanguage = 'en' | 'pt';

const en = {
  cannotReach   : (url: string) => `Cannot reach nodehub at ${url}. Is the dashboard running (start.cmd)?`,
  notConnected  : 'This PC is not connected. Run: nodehub login',
  disconnected  : 'This PC was disconnected (or your user deactivated). Run: nodehub login',
  connecting    : (device: string) => `Connecting "${device}" to nodehub.`,
  approveAt     : (url: string) => `  Approve it in the browser: ${url}`,
  code          : (code: string) => `  Code: ${code}`,
  waiting       : 'Waiting for approval... (Ctrl+C to cancel)',
  connected     : (name: string, username: string) => `Connected. This PC now works as ${name} (${username}).`,
  expired       : 'The connection request expired. Run "nodehub login" again.',
  loggedOut     : 'This PC forgot its token. Disconnect it in the dashboard (Connected PCs) to revoke it.',
  whoami        : (name: string, username: string, role: string, url: string) => `${name} (${username}, ${role}) on ${url}`,
  teamLanguage  : 'Team language: English',
  recordsLanguage: 'Records language: English. Write the session record (nodehub log / update) and the profile in English.',
  client        : 'Client',
  name          : 'Name',
  sshUser       : 'SSH user',
  notes         : 'Notes',
  profile       : 'Profile',
  emptyProfile  : '(empty: fill it in with "nodehub profile")',
  recentSessions: (shown: number, total: number) => `Recent sessions (${shown} of ${total})`,
  noSessions    : '(none yet)',
  historyTitle  : (host: string, shown: number, total: number) => `# ${host}: ${shown} of ${total} sessions`,
  edited        : (date: string) => `(edited ${date})`,
  technician    : 'Technician',
  deletedUser   : '(deleted user)',
  problem       : 'Problem',
  diagnosis     : 'Diagnosis',
  actions       : 'Actions',
  result        : 'Result',
  pending       : 'Pending',
  recorded      : (id: number, host: string, result: string) => `Session #${id} recorded for ${host} (${result}).`,
  updated       : (id: number, host: string, result: string, pending: string) =>
    `Session #${id} on ${host} updated (${result}${pending ? `, pending: ${pending}` : ', nothing pending'}).`,
  profileUpdated: (host: string) => `Profile of ${host} updated.`,
  badHost       : 'Missing or invalid machine name.',
  badSessionId  : 'Missing or invalid session number (e.g. nodehub update 12 ...).',
  profileUsage  : 'Use --file <profile.md> or --text "<profile>".',
  error         : 'Error',
  keysTitle     : (n: number) => `Team SSH keys (${n}):`,
  keysNone      : 'No keys yet. An admin adds them in the dashboard (Users → SSH keys).',
  keysHint      : 'After adding or removing a key, run "nodehub keys sync" to apply the list to the client PCs.',
  syncNoKeys    : 'The team key list is empty: refusing to remove every key from the client PCs.',
  syncOwnMissing: 'None of this PC\'s keys (~/.ssh/*.pub) is in the team list: after the sync this PC could no longer reach the machines. Add your key in the dashboard first (or use --force).',
  syncStart     : (machines: number, keys: number, dryRun: boolean) =>
    `${dryRun ? '[dry run] ' : ''}Applying ${keys} key(s) to ${machines} machine(s)...`,
  syncNothing   : 'No online client machines to update.',
  syncUpdated   : (label: string, added: number, removed: number) => `  ✓ ${label}: updated (+${added} −${removed})`,
  syncWouldUpdate: (label: string, added: number, removed: number) => `  • ${label}: would change (+${added} −${removed})`,
  syncUnchanged : (label: string) => `  ✓ ${label}: already up to date`,
  syncFailed    : (label: string, error: string) => `  ✗ ${label}: ${error}`,
  syncSkipped   : (n: number) => `${n} offline machine(s) skipped: run the sync again when they are online.`,
  syncSummary   : (updated: number, unchanged: number, failed: number) =>
    `Done: ${updated} updated, ${unchanged} already up to date, ${failed} failed.`,
};

type CliMessages = typeof en;

const pt: CliMessages = {
  cannotReach   : (url: string) => `Não foi possível contactar o nodehub em ${url}. O dashboard está a correr (start.cmd)?`,
  notConnected  : 'Este PC não está ligado. Corra: nodehub login',
  disconnected  : 'Este PC foi desligado (ou o seu utilizador desativado). Corra: nodehub login',
  connecting    : (device: string) => `A ligar "${device}" ao nodehub.`,
  approveAt     : (url: string) => `  Aprove no browser: ${url}`,
  code          : (code: string) => `  Código: ${code}`,
  waiting       : 'À espera da aprovação... (Ctrl+C para cancelar)',
  connected     : (name: string, username: string) => `Ligado. Este PC passa a trabalhar como ${name} (${username}).`,
  expired       : 'O pedido de ligação expirou. Corra "nodehub login" outra vez.',
  loggedOut     : 'Este PC esqueceu o token. Desligue-o no dashboard (PCs ligados) para o revogar.',
  whoami        : (name: string, username: string, role: string, url: string) => `${name} (${username}, ${role}) em ${url}`,
  teamLanguage  : 'Idioma da equipa: português (Portugal)',
  recordsLanguage: 'Idioma dos registos: português (Portugal). Escreve o registo da sessão (nodehub log / update) e o perfil em português de Portugal.',
  client        : 'Cliente',
  name          : 'Nome',
  sshUser       : 'Utilizador SSH',
  notes         : 'Notas',
  profile       : 'Perfil',
  emptyProfile  : '(vazio: preencha-o com "nodehub profile")',
  recentSessions: (shown: number, total: number) => `Sessões recentes (${shown} de ${total})`,
  noSessions    : '(ainda nenhuma)',
  historyTitle  : (host: string, shown: number, total: number) => `# ${host}: ${shown} de ${total} sessões`,
  edited        : (date: string) => `(editada ${date})`,
  technician    : 'Técnico',
  deletedUser   : '(utilizador apagado)',
  problem       : 'Problema',
  diagnosis     : 'Diagnóstico',
  actions       : 'Ações',
  result        : 'Resultado',
  pending       : 'Pendente',
  recorded      : (id: number, host: string, result: string) => `Sessão #${id} registada em ${host} (${result}).`,
  updated       : (id: number, host: string, result: string, pending: string) =>
    `Sessão #${id} em ${host} atualizada (${result}${pending ? `, pendente: ${pending}` : ', nada pendente'}).`,
  profileUpdated: (host: string) => `Perfil de ${host} atualizado.`,
  badHost       : 'Nome da máquina em falta ou inválido.',
  badSessionId  : 'Número da sessão em falta ou inválido (ex.: nodehub update 12 ...).',
  profileUsage  : 'Use --file <perfil.md> ou --text "<perfil>".',
  error         : 'Erro',
  keysTitle     : (n: number) => `Chaves SSH da equipa (${n}):`,
  keysNone      : 'Ainda não há chaves. Um administrador adiciona-as no dashboard (Utilizadores → Chaves SSH).',
  keysHint      : 'Depois de adicionar ou remover uma chave, corra "nodehub keys sync" para aplicar a lista aos PCs dos clientes.',
  syncNoKeys    : 'A lista de chaves da equipa está vazia: recuso remover todas as chaves dos PCs dos clientes.',
  syncOwnMissing: 'Nenhuma das chaves deste PC (~/.ssh/*.pub) está na lista da equipa: depois da sincronização este PC deixava de chegar às máquinas. Adicione primeiro a sua chave no dashboard (ou use --force).',
  syncStart     : (machines: number, keys: number, dryRun: boolean) =>
    `${dryRun ? '[simulação] ' : ''}A aplicar ${keys} chave(s) a ${machines} máquina(s)...`,
  syncNothing   : 'Não há máquinas cliente online para atualizar.',
  syncUpdated   : (label: string, added: number, removed: number) => `  ✓ ${label}: atualizada (+${added} −${removed})`,
  syncWouldUpdate: (label: string, added: number, removed: number) => `  • ${label}: mudaria (+${added} −${removed})`,
  syncUnchanged : (label: string) => `  ✓ ${label}: já estava atualizada`,
  syncFailed    : (label: string, error: string) => `  ✗ ${label}: ${error}`,
  syncSkipped   : (n: number) => `${n} máquina(s) offline ignorada(s): corra a sincronização outra vez quando estiverem online.`,
  syncSummary   : (updated: number, unchanged: number, failed: number) =>
    `Concluído: ${updated} atualizada(s), ${unchanged} já atualizada(s), ${failed} com erro.`,
};

const MESSAGES: Record<CliLanguage, CliMessages> = { en, pt };

/** Result values as stored (fixed / partial / unresolved), worded for people. */
export const RESULT_WORDS: Record<CliLanguage, Record<string, string>> = {
  en: { FIXED: 'fixed', PARTIAL: 'partial', UNRESOLVED: 'unresolved' },
  pt: { FIXED: 'resolvido', PARTIAL: 'parcial', UNRESOLVED: 'por resolver' },
};

/** Portuguese wording for API error codes; in English the server's own message is used. */
const PT_ERRORS: Record<string, string> = {
  SESSION_NOT_FOUND     : 'Essa sessão não existe.',
  MACHINE_NOT_CONFIGURED: 'Essa máquina não está configurada no dashboard.',
  NOT_FOUND             : 'Não encontrado.',
  FORBIDDEN             : 'Não tem permissão para esta ação (só quem registou a sessão, ou um administrador).',
  SESSION_REQUIRED      : 'Esta ação exige ter sessão iniciada no dashboard.',
  VALIDATION_ERROR      : 'Pedido inválido.',
  LOGIN_DENIED          : 'O pedido de ligação foi recusado no dashboard.',
  LOGIN_EXPIRED         : 'O pedido de ligação expirou. Corra "nodehub login" outra vez.',
  TOO_MANY_REQUESTS     : 'Demasiados pedidos de ligação pendentes. Tente daqui a alguns minutos.',
  INTERNAL_ERROR        : 'Ocorreu um erro no servidor. Os detalhes estão no log do servidor.',
};

let current: CliLanguage = 'en';

let tag = '';
export const setClientTag = (value: unknown): void => { tag = typeof value === 'string' ? value : ''; };
export const clientTagFromServer = (): string => tag;

export function setCliLanguage(language: unknown): void {
  current = language === 'pt' ? 'pt' : 'en';
}

export const cliLanguage = (): CliLanguage => current;

/** Texts in the active language. */
export const m = (): CliMessages => MESSAGES[current];

/** The message for an API error in the active language. */
export function apiErrorText(code: string | undefined, serverMessage: string): string {
  return (current === 'pt' && code && PT_ERRORS[code]) || serverMessage;
}

/** fixed / resolvido, partial / parcial, ... */
export const resultWord = (result: string): string => RESULT_WORDS[current][result] ?? result.toLowerCase();
