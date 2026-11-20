// Shell commands an AI coding tool should not run on its own, for the PreToolUse command guard.
// Two tiers: "deny" (never run) and "ask" (a person confirms). A command line is first split into
// simple commands and words, so a rule looks at the program and its arguments. Text inside quotes,
// file names and ordinary commands (`git push`, `rm -rf node_modules`, `az group list`) are not
// caught. Heuristics, not a security boundary: a command can always be written so no rule sees it.
import { posix } from 'node:path';

const SH = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh']);
const SHELLS = new Set([...SH, 'fish', 'pwsh', 'powershell', 'cmd', 'iex', 'invoke-expression']);
const DOWNLOADERS = new Set(['curl', 'wget', 'iwr', 'irm', 'invoke-webrequest', 'invoke-restmethod']);
const SQL_CLIENTS = new Set(['psql', 'mysql', 'mariadb', 'sqlcmd', 'sqlite3', 'pgcli', 'mycli', 'usql', 'invoke-sqlcmd']);
const CONTAINER_TOOLS = new Set(['docker', 'podman', 'kubectl', 'docker-compose']);
// Programs that only search for or print their arguments.
const READERS = new Set(['grep', 'egrep', 'fgrep', 'rg', 'findstr', 'select-string', 'sls', 'echo', 'printf', 'write-output', 'write-host', 'git']);
const PREFIXES = new Set(['sudo', 'doas', 'env', 'time', 'nohup', 'command', 'exec', 'builtin']);
const PS_REMOVE = new Set(['remove-item', 'ri', 'rm', 'rmdir', 'rd', 'del', 'erase']);

const SQL_DESTROY = /\bDROP\s+(DATABASE|SCHEMA|TABLE)\b|\bTRUNCATE\s+(TABLE\s+)?["`[\w]/i;
const PROTECTED_BRANCH = /^(main|master)$/;

const slashes = (p) => p.replace(/\\/g, '/');
/** The program name of a word: no folder, no .exe, lower case. */
const name = (word) => slashes(word ?? '').split('/').pop().toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, '');
const plain = (args) => args.filter((a) => !a.startsWith('-'));
/** A short flag cluster such as -rf that holds the letter. */
const short = (letter) => (a) => new RegExp(`^-[a-zA-Z]*${letter}[a-zA-Z]*$`).test(a);

/** Here-documents and PowerShell here-strings hold data, not commands: drop their bodies. */
function withoutHereDocs(text) {
  return text
    .replace(/<<-?\s*(["']?)(\w+)\1([^\n]*)\n[\s\S]*?\n[ \t]*\2(?!\w)/g, '$3')
    .replace(/@(["'])[ \t]*\r?\n[\s\S]*?\n\1@/g, "''");
}

/**
 * Splits a command line into pipelines of simple commands, each a list of words. Quotes keep
 * their content together as one word. `;`, `&&`, `||`, `&` and a new line end a pipeline; `|`
 * ends a command inside it.
 */
export function splitCommands(line, shell = 'bash') {
  const pipelines = [[]];
  let words = [];
  let word = null;
  let quote = null;
  const endWord = () => {
    if (word !== null) words.push(word);
    word = null;
  };
  const endCommand = () => {
    endWord();
    if (words.length) pipelines.at(-1).push(words);
    words = [];
  };
  const endPipeline = () => {
    endCommand();
    if (pipelines.at(-1).length) pipelines.push([]);
  };
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const next = line[i + 1];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === '\\' && quote === '"' && shell === 'bash' && next && '"\\$`'.includes(next)) word += line[++i];
      else word += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      word ??= '';
    } else if (c === '\\' && shell === 'bash' && next !== undefined) {
      i++;
      if (next !== '\n') word = (word ?? '') + next;
    } else if (c === '`' && shell === 'powershell' && (next === '\n' || next === '\r')) {
      i += next === '\r' && line[i + 2] === '\n' ? 2 : 1; // a PowerShell line continuation
    } else if (c === ' ' || c === '\t' || c === '\r') {
      endWord();
    } else if (c === '\n' || c === ';') {
      endPipeline();
    } else if (c === '&' && (next === '>' || /[<>]$/.test(word ?? ''))) {
      word = (word ?? '') + c; // a redirection such as 2>&1 or &>file
    } else if (c === '|' && next !== '|') {
      endCommand();
      if (next === '&') i++;
    } else if (c === '|' || c === '&') {
      endPipeline();
      if (next === c) i++;
    } else {
      word = (word ?? '') + c;
    }
  }
  endPipeline();
  return pipelines.filter((p) => p.length);
}

/** A simple command as { prog, args, shell }: redirections, `sudo`, `env` and `VAR=value` removed. */
function toCommand(words, shell) {
  const argv = words.filter((w) => !/^(\d*>|\d*<(?!\()|&>)/.test(w));
  for (;;) {
    const first = argv[0];
    if (first === undefined) return null;
    if (/^[A-Za-z_]\w*=/.test(first)) argv.shift();
    else if (PREFIXES.has(name(first))) {
      argv.shift();
      while (argv[0]?.startsWith('-')) argv.shift();
    } else break;
  }
  return { prog: name(argv[0]), args: argv.slice(1), shell };
}

/** The script a wrapper runs (`bash -c "…"`, `powershell -Command "…"`, `cmd /c …`, `eval …`), or null. */
function innerScript(c) {
  if (SH.has(c.prog)) {
    const i = c.args.findIndex((a) => /^-[a-z]*c$/.test(a));
    return i >= 0 && c.args[i + 1] ? { text: c.args[i + 1], shell: 'bash' } : null;
  }
  if (c.prog === 'pwsh' || c.prog === 'powershell') {
    const i = c.args.findIndex((a) => /^-c(ommand)?$/i.test(a));
    return i >= 0 && c.args[i + 1] ? { text: c.args.slice(i + 1).join(' '), shell: 'powershell' } : null;
  }
  if (c.prog === 'cmd') {
    const i = c.args.findIndex((a) => /^\/[ck]$/i.test(a));
    return i >= 0 && c.args[i + 1] ? { text: c.args.slice(i + 1).join(' '), shell: c.shell } : null;
  }
  return c.prog === 'eval' && c.args.length ? { text: c.args.join(' '), shell: c.shell } : null;
}

/** The git subcommand and its arguments, with git's own options (`-C dir`, `-c k=v`) skipped. */
function git(c) {
  if (c.prog !== 'git') return null;
  let i = 0;
  while (c.args[i]?.startsWith('-')) i += /^(-C|-c|--git-dir|--work-tree|--namespace)$/.test(c.args[i]) ? 2 : 1;
  return c.args[i] ? { sub: c.args[i], args: c.args.slice(i + 1) } : null;
}

/** A `git push` as { forced, deletes, refs }, or null. */
function push(c) {
  const g = git(c);
  if (g?.sub !== 'push') return null;
  const refs = plain(g.args).slice(1);
  return {
    args: g.args,
    refs,
    forced: g.args.some((a) => /^--force($|-with-lease|-if-includes)/.test(a) || short('f')(a)) || refs.some((r) => r.startsWith('+')),
    deletes: g.args.some((a) => a === '--delete' || short('d')(a)) || refs.some((r) => /^:./.test(r)),
  };
}

/** Does a forced push reach main or master? Without a branch on the command line, the current branch counts. */
function pushesProtected(p, ctx) {
  if (p.args.some((a) => a === '--all' || a === '--mirror')) return true;
  const targets = p.refs.map((r) => r.replace(/^\+/, '').split(':').pop().replace(/^refs\/heads\//, ''));
  if (targets.some((t) => PROTECTED_BRANCH.test(t))) return true;
  const current = targets.length === 0 || targets.includes('HEAD');
  return current && PROTECTED_BRANCH.test(ctx.branch?.() ?? '');
}

/** `/`, `~`, `$HOME`, a drive root, or the folder that holds every home folder. */
export function isRootOrHome(target) {
  const t = slashes(target).replace(/\/+(\*\*?|\.)?$/, '');
  if (t === '') return target !== '';
  return /^(~|\$HOME|\$\{HOME\}|\$env:(USERPROFILE|HOME)|%USERPROFILE%|[A-Za-z]:|\/(mnt\/|cygdrive\/)?[A-Za-z]|(\/|[A-Za-z]:\/|\/(mnt\/|cygdrive\/)?[A-Za-z]\/)(home|Users))$/i.test(t);
}

/** One spelling for a path: forward slashes, `C:` and `/mnt/c` as `/c`, lower case. */
const canon = (p) =>
  slashes(p)
    .replace(/^([A-Za-z]):/, '/$1')
    .replace(/^\/(mnt|cygdrive)\/([A-Za-z])(?=\/|$)/, '/$2')
    .toLowerCase();

/** Is the path outside the project folder? true, false, or null when it cannot be told. */
export function outsideProject(target, ctx = {}) {
  let t = slashes(target);
  if (ctx.home) t = t.replace(/^(~|\$HOME|\$\{HOME\}|\$env:(USERPROFILE|HOME))(?=\/|$)/i, slashes(ctx.home));
  if (/^(~|\$env:|\$HOME|\$\{HOME\}|%)/i.test(t)) return true; // a home or environment folder
  if (t.startsWith('$')) return null; // a variable we cannot resolve
  const absolute = /^(\/|[A-Za-z]:)/.test(t);
  if (!absolute && !t.split('/').includes('..')) return false;
  const root = ctx.project ?? ctx.cwd;
  if (!root) return true;
  const full = absolute ? canon(t) : posix.join(canon(ctx.cwd ?? root), t.toLowerCase());
  const rel = posix.relative(canon(root), posix.normalize(full));
  return rel === '..' || rel.startsWith('../') || posix.isAbsolute(rel);
}

/** Is the absolute path a folder above this one, or (with `self`) the folder itself? */
function holds(target, folder, self) {
  if (!folder || !/^(\/|[A-Za-z]:)/.test(slashes(target))) return false;
  const inner = canon(folder);
  const outer = posix.normalize(canon(target)).replace(/\/+(\*\*?|\.)?$/, '');
  return inner.startsWith(`${outer}/`) || (self && inner === outer);
}

/** A recursive delete as { targets, force }, or null. Reads `rm -r` and PowerShell's Remove-Item. */
function removal(c) {
  if (c.prog === 'remove-item' || (c.shell === 'powershell' && PS_REMOVE.has(c.prog))) {
    if (!c.args.some((a) => /^-r(e(c(u(r(se?)?)?)?)?)?$/i.test(a))) return null;
    return {
      powershell: true,
      force: c.args.some((a) => /^-fo(r(ce?)?)?$/i.test(a)),
      targets: plain(c.args).flatMap((a) => a.split(',')).filter(Boolean),
    };
  }
  if (c.prog !== 'rm' || !c.args.some((a) => a === '--recursive' || short('[rR]')(a))) return null;
  return { force: true, targets: plain(c.args), noPreserveRoot: c.args.includes('--no-preserve-root') };
}

const hasDotDot = (t) => slashes(t).split('/').includes('..');
/** The first words of a CLI call that are not options, such as `group delete` in `az group delete -n x`. */
const verbs = (c, count = 2) => plain(c.args).slice(0, count);

/**
 * The rules. `command` looks at one simple command, `pipeline` at the commands joined by `|`,
 * `line` at the whole text. `what` and `why` go into the message.
 */
export const RULES = [
  // Never run.
  {
    id: 'rm-root',
    tier: 'deny',
    what: 'a recursive delete of the file system root, a drive root, the home folder or a folder above the project',
    why: 'It cannot be undone and takes far more than the project.',
    command: (c, ctx) => {
      const r = removal(c);
      if (!r) return false;
      return r.noPreserveRoot || r.targets.some((t) => isRootOrHome(t) || holds(t, ctx.home, true) || holds(t, ctx.project, false));
    },
  },
  {
    id: 'rm-outside-project',
    tier: 'deny',
    what: 'a recursive delete of a `..` path that leaves the project folder',
    why: 'It cannot be undone and the files are not part of this project.',
    command: (c, ctx) => {
      const r = removal(c);
      return Boolean(r) && !r.powershell && r.targets.some((t) => hasDotDot(t) && outsideProject(t, ctx));
    },
  },
  {
    id: 'force-push-main',
    tier: 'deny',
    what: 'a force push to main or master',
    why: 'It rewrites the history other people build on.',
    command: (c, ctx) => {
      const p = push(c);
      return Boolean(p?.forced) && pushesProtected(p, ctx);
    },
  },
  {
    id: 'download-to-shell',
    tier: 'deny',
    what: 'a download piped straight into a shell',
    why: 'The script would run unread. Download it to a file and read it first.',
    pipeline: (cmds) => {
      const i = cmds.findIndex((c) => DOWNLOADERS.has(c.prog) || /\bdownloadstring\b/i.test(`${c.prog} ${c.args.join(' ')}`));
      return i >= 0 && cmds.slice(i + 1).some((c) => SHELLS.has(c.prog));
    },
    command: (c) => {
      const rest = c.args.join(' ');
      if (SH.has(c.prog) || c.prog === 'source' || c.prog === '.') return /[<$]\(\s*(curl|wget)\b/.test(rest);
      if (c.prog === 'iex' || c.prog === 'invoke-expression') return /\b(iwr|irm|invoke-webrequest|invoke-restmethod|downloadstring|curl|wget)\b/i.test(rest);
      return false;
    },
  },
  {
    id: 'permission-skip',
    tier: 'deny',
    what: 'a flag that switches off permission checks',
    why: 'The person chooses the permission mode. A tool never turns it off.',
    command: (c) =>
      !READERS.has(c.prog) &&
      c.args.some(
        (a, i) =>
          /^--(allow-)?dangerously-[a-z-]+$/.test(a) ||
          a === '--yolo' ||
          a === '--permission-mode=bypassPermissions' ||
          (a === 'bypassPermissions' && c.args[i - 1] === '--permission-mode'),
      ),
  },
  {
    id: 'no-verify',
    tier: 'deny',
    what: 'a commit or push that skips the repository hooks (`--no-verify`)',
    why: "The hooks are the project's own checks. Fix what they report.",
    command: (c) => {
      const g = git(c);
      if (g?.sub === 'push') return g.args.includes('--no-verify');
      // `git commit -n` is the short form; `git push -n` is a dry run.
      return g?.sub === 'commit' && g.args.some((a) => a === '--no-verify' || /^-(?=[a-z]*n)[aemnqsv]+$/.test(a));
    },
  },

  // A person confirms.
  {
    id: 'force-push',
    tier: 'ask',
    what: 'a force push',
    why: 'It replaces commits on the remote branch.',
    command: (c) => Boolean(push(c)?.forced),
  },
  {
    id: 'remote-ref-delete',
    tier: 'ask',
    what: 'deleting a branch or tag on the remote',
    why: 'Other people lose it too.',
    command: (c) => Boolean(push(c)?.deletes),
  },
  {
    id: 'git-reset-hard',
    tier: 'ask',
    what: '`git reset --hard`',
    why: 'It throws away uncommitted work.',
    command: (c) => git(c)?.sub === 'reset' && git(c).args.includes('--hard'),
  },
  {
    id: 'git-clean',
    tier: 'ask',
    what: '`git clean` with force',
    why: 'It deletes untracked files, which git cannot bring back.',
    command: (c) => {
      const g = git(c);
      if (g?.sub !== 'clean') return false;
      const dryRun = g.args.some((a) => a === '--dry-run' || short('n')(a));
      return !dryRun && g.args.some((a) => a === '--force' || short('f')(a));
    },
  },
  {
    id: 'git-branch-delete',
    tier: 'ask',
    what: 'a forced branch delete (`git branch -D`)',
    why: 'Commits that are only on that branch are lost.',
    command: (c) => {
      const g = git(c);
      if (g?.sub !== 'branch') return false;
      const deletes = g.args.some((a) => a === '--delete' || short('d')(a));
      return g.args.some(short('D')) || (deletes && g.args.some((a) => a === '--force' || short('f')(a)));
    },
  },
  {
    id: 'git-tag-delete',
    tier: 'ask',
    what: 'deleting a tag',
    why: 'A release may point to it.',
    command: (c) => git(c)?.sub === 'tag' && git(c).args.some((a) => a === '--delete' || short('d')(a)),
  },
  {
    id: 'sql-destroy',
    tier: 'ask',
    what: 'a DROP or TRUNCATE statement sent to a database',
    why: 'The data is gone unless there is a backup.',
    line: (text, cmds) =>
      SQL_DESTROY.test(text) &&
      cmds.some((c) => SQL_CLIENTS.has(c.prog) || (CONTAINER_TOOLS.has(c.prog) && c.args.some((a) => SQL_CLIENTS.has(name(a))))),
    command: (c) => c.prog === 'dropdb',
  },
  {
    id: 'az-delete',
    tier: 'ask',
    what: 'an Azure CLI delete (`az … delete`)',
    why: 'It removes cloud resources, and a resource group takes everything in it.',
    command: (c) => {
      if (c.prog !== 'az') return false;
      const flag = c.args.findIndex((a) => a.startsWith('-'));
      const words = c.args.slice(0, flag < 0 ? undefined : flag);
      if (words[0] === 'rest') return c.args.some((a, i) => /^delete$/i.test(a) && /^(--method|-m)$/.test(c.args[i - 1]));
      return words.some((w) => /^(delete(-.+)?|purge)$/.test(w));
    },
  },
  {
    id: 'azure-powershell-remove',
    tier: 'ask',
    what: 'an Azure PowerShell remove (`Remove-Az…`)',
    why: 'It removes cloud resources, and a resource group takes everything in it.',
    command: (c) => /^remove-az\w+$/.test(c.prog),
  },
  {
    id: 'azd-down',
    tier: 'ask',
    what: '`azd down`',
    why: 'It deletes the deployed environment.',
    command: (c) => c.prog === 'azd' && verbs(c, 1)[0] === 'down',
  },
  {
    id: 'terraform-destroy',
    tier: 'ask',
    what: '`terraform destroy`',
    why: 'It deletes the infrastructure the state describes.',
    command: (c) =>
      ['terraform', 'tofu', 'terragrunt'].includes(c.prog) &&
      (verbs(c, 1)[0] === 'destroy' || (verbs(c, 1)[0] === 'apply' && c.args.some((a) => /^--?destroy$/.test(a)))),
  },
  {
    id: 'kubectl-delete',
    tier: 'ask',
    what: '`kubectl delete`',
    why: 'It removes resources from the cluster.',
    command: (c) => c.prog === 'kubectl' && verbs(c, 3).includes('delete'),
  },
  {
    id: 'remove-item-outside-project',
    tier: 'ask',
    what: '`Remove-Item -Recurse -Force` on a path outside the project folder',
    why: 'It cannot be undone and the files are not part of this project.',
    command: (c, ctx) => {
      const r = removal(c);
      return Boolean(r?.powershell) && r.force && r.targets.some((t) => outsideProject(t, ctx) === true);
    },
  },
  {
    id: 'package-publish',
    tier: 'ask',
    what: 'publishing a package to a registry',
    why: 'A published version is public and cannot be replaced.',
    command: (c) => ['npm', 'pnpm', 'yarn'].includes(c.prog) && verbs(c).includes('publish') && !c.args.includes('--dry-run'),
  },
  {
    id: 'gh-repo-delete',
    tier: 'ask',
    what: '`gh repo delete`',
    why: 'It deletes the repository with its issues and pull requests.',
    command: (c) => c.prog === 'gh' && verbs(c).join(' ') === 'repo delete',
  },
  {
    id: 'docker-system-prune',
    tier: 'ask',
    what: '`docker system prune`',
    why: 'It deletes stopped containers, unused images and, with --volumes, their data.',
    command: (c) => ['docker', 'podman'].includes(c.prog) && verbs(c).join(' ') === 'system prune',
  },
];

function scan(text, shell, ctx, hits, depth) {
  const body = withoutHereDocs(text);
  const pipelines = splitCommands(body, shell).map((p) => p.map((words) => toCommand(words, shell)).filter(Boolean));
  const all = pipelines.flat();
  for (const rule of RULES) {
    if (rule.line?.(text, all) || pipelines.some((p) => rule.pipeline?.(p)) || all.some((c) => rule.command?.(c, ctx))) hits.push(rule);
  }
  if (depth >= 3) return;
  for (const c of all) {
    const inner = innerScript(c);
    if (inner) scan(inner.text, inner.shell, ctx, hits, depth + 1);
  }
  // Command substitution: $(…), <(…) and, in sh, `…`. None starts inside single quotes or after
  // a backslash.
  const nested = shell === 'bash' ? /[$<]\(([^()]+)\)|`([^`]+)`/g : /\$\(([^()]+)\)/g;
  const live = (shell === 'bash' ? body.replace(/\\[\s\S]/g, '') : body).replace(/'[^']*'/g, "''");
  for (const m of live.matchAll(nested)) scan(m[1] ?? m[2], shell, ctx, hits, depth + 1);
}

/**
 * The first risky thing in a command line as { id, tier, what, why }, or null. A deny wins over
 * an ask. `ctx`: shell ('bash' or 'powershell'), cwd, project (the project folder), home, and
 * branch() for the current git branch.
 */
export function findRisk(commandLine, ctx = {}) {
  if (typeof commandLine !== 'string' || !commandLine.trim()) return null;
  const hits = [];
  scan(commandLine, ctx.shell === 'powershell' ? 'powershell' : 'bash', ctx, hits, 0);
  const hit = hits.find((h) => h.tier === 'deny') ?? hits[0];
  return hit ? { id: hit.id, tier: hit.tier, what: hit.what, why: hit.why } : null;
}
