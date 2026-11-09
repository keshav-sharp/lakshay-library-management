import React, { useMemo, useState } from 'react';
import { Search, WrapText, Hash, X } from 'lucide-react';

interface KotlinCodeHighlighterProps {
  code: string;
  showToolbar?: boolean;
  maxHeightClass?: string;
}

type TokenType =
  | 'comment'
  | 'annotation'
  | 'string'
  | 'keyword'
  | 'compose_type'
  | 'number'
  | 'function'
  | 'plain';

interface CodeToken {
  type: TokenType;
  value: string;
}

const KOTLIN_KEYWORDS = new Set([
  'package',
  'import',
  'class',
  'data',
  'enum',
  'interface',
  'object',
  'fun',
  'val',
  'var',
  'by',
  'private',
  'protected',
  'public',
  'internal',
  'override',
  'suspend',
  'if',
  'else',
  'when',
  'for',
  'while',
  'do',
  'in',
  'is',
  'as',
  'return',
  'true',
  'false',
  'null',
  'this',
  'super',
  'init',
  'try',
  'catch',
  'finally',
  'throw',
  'companion',
  'sealed',
  'lateinit',
  'const',
]);

const COMPOSE_AND_KOTLIN_TYPES = new Set([
  'Composable',
  'Modifier',
  'MaterialTheme',
  'Scaffold',
  'TopAppBar',
  'TopAppBarDefaults',
  'ModalNavigationDrawer',
  'ModalDrawerSheet',
  'NavigationDrawerItem',
  'NavigationDrawerItemDefaults',
  'DrawerValue',
  'ExtendedFloatingActionButton',
  'FloatingActionButton',
  'ModalBottomSheet',
  'Surface',
  'Column',
  'Row',
  'Box',
  'Spacer',
  'LazyColumn',
  'Text',
  'Icon',
  'IconButton',
  'TextButton',
  'Button',
  'OutlinedButton',
  'OutlinedTextField',
  'TextField',
  'OutlinedTextFieldDefaults',
  'Card',
  'CardDefaults',
  'AnimatedVisibility',
  'RoundedCornerShape',
  'Icons',
  'Color',
  'FontWeight',
  'Alignment',
  'Arrangement',
  'PaddingValues',
  'ImageVector',
  'ViewModel',
  'StateFlow',
  'MutableStateFlow',
  'Flow',
  'SharingStarted',
  'Student',
  'PaymentRecord',
  'StudentRepository',
  'MainViewModel',
  'TabScreen',
  'FabActionItem',
  'LakshayLibraryTheme',
  'LakshayLibraryAppRoot',
  'MainDashboardScaffold',
  'ExpandableSpeedDialFab',
  'FirebaseFirestore',
  'Timestamp',
  'LocalDate',
  'ZoneId',
  'Calendar',
  'CoroutineWorker',
  'WorkerParameters',
  'Result',
  'Context',
  'String',
  'Int',
  'Double',
  'Float',
  'Long',
  'Boolean',
  'Unit',
  'List',
  'Map',
  'Set',
  'Exception',
]);

function tokenizeKotlinLine(line: string, inBlockComment: boolean): {
  tokens: CodeToken[];
  nextInBlockComment: boolean;
} {
  const tokens: CodeToken[] = [];
  let i = 0;
  const len = line.length;
  let blockComment = inBlockComment;

  while (i < len) {
    // 1. Inside a multi-line /* ... */ comment
    if (blockComment) {
      const endIdx = line.indexOf('*/', i);
      if (endIdx === -1) {
        tokens.push({ type: 'comment', value: line.slice(i) });
        return { tokens, nextInBlockComment: true };
      } else {
        tokens.push({ type: 'comment', value: line.slice(i, endIdx + 2) });
        i = endIdx + 2;
        blockComment = false;
        continue;
      }
    }

    // 2. Start of multi-line comment /*
    if (line[i] === '/' && line[i + 1] === '*') {
      const endIdx = line.indexOf('*/', i + 2);
      if (endIdx === -1) {
        tokens.push({ type: 'comment', value: line.slice(i) });
        return { tokens, nextInBlockComment: true };
      } else {
        tokens.push({ type: 'comment', value: line.slice(i, endIdx + 2) });
        i = endIdx + 2;
        continue;
      }
    }

    // 3. Single-line comment //
    if (line[i] === '/' && line[i + 1] === '/') {
      tokens.push({ type: 'comment', value: line.slice(i) });
      break;
    }

    // 4. Annotation @Composable, @OptIn, etc.
    if (line[i] === '@' && /[A-Za-z_]/.test(line[i + 1] || '')) {
      let j = i + 1;
      while (j < len && /[A-Za-z0-9_]/.test(line[j])) j++;
      tokens.push({ type: 'annotation', value: line.slice(i, j) });
      i = j;
      continue;
    }

    // 5. String literal "..."
    if (line[i] === '"') {
      let j = i + 1;
      while (j < len) {
        if (line[j] === '\\') {
          j += 2;
          continue;
        }
        if (line[j] === '"') {
          j++;
          break;
        }
        j++;
      }
      tokens.push({ type: 'string', value: line.slice(i, j) });
      i = j;
      continue;
    }

    // 6. Numbers & Hex literals (e.g., 0xFFD97706, 12.dp, 0.8f, 5000)
    if (/[0-9]/.test(line[i]) && (i === 0 || !/[A-Za-z_]/.test(line[i - 1]))) {
      let j = i;
      if (line[i] === '0' && (line[i + 1] === 'x' || line[i + 1] === 'X')) {
        j += 2;
        while (j < len && /[0-9a-fA-F_]/.test(line[j])) j++;
      } else {
        while (j < len && /[0-9._fL]/.test(line[j])) j++;
        // Check for .dp or .sp suffix
        if (line.slice(j, j + 2) === 'dp' || line.slice(j, j + 2) === 'sp') {
          j += 2;
        }
      }
      tokens.push({ type: 'number', value: line.slice(i, j) });
      i = j;
      continue;
    }

    // 7. Identifiers, Keywords, Compose Types, Function calls
    if (/[A-Za-z_]/.test(line[i])) {
      let j = i + 1;
      while (j < len && /[A-Za-z0-9_]/.test(line[j])) j++;
      const word = line.slice(i, j);

      if (KOTLIN_KEYWORDS.has(word)) {
        tokens.push({ type: 'keyword', value: word });
      } else if (COMPOSE_AND_KOTLIN_TYPES.has(word) || /^[A-Z]/.test(word)) {
        tokens.push({ type: 'compose_type', value: word });
      } else if (line[j] === '(' || line[j] === ' ' && line[j + 1] === '{') {
        tokens.push({ type: 'function', value: word });
      } else {
        tokens.push({ type: 'plain', value: word });
      }
      i = j;
      continue;
    }

    // 8. Punctuation & whitespace
    let j = i + 1;
    while (
      j < len &&
      !/[A-Za-z0-9_@"\/]/.test(line[j])
    ) {
      j++;
    }
    tokens.push({ type: 'plain', value: line.slice(i, j) });
    i = j;
  }

  return { tokens, nextInBlockComment: blockComment };
}

const getTokenClassName = (type: TokenType): string => {
  switch (type) {
    case 'comment':
      return 'text-slate-400 italic';
    case 'annotation':
      return 'text-amber-300 font-semibold';
    case 'string':
      return 'text-emerald-300';
    case 'keyword':
      return 'text-sky-400 font-semibold';
    case 'compose_type':
      return 'text-cyan-300 font-medium';
    case 'number':
      return 'text-orange-300';
    case 'function':
      return 'text-amber-200';
    case 'plain':
    default:
      return 'text-slate-100';
  }
};

export const KotlinCodeHighlighter: React.FC<KotlinCodeHighlighterProps> = ({
  code,
  showToolbar = true,
  maxHeightClass = 'flex-1',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [wrapLines, setWrapLines] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);

  const parsedLines = useMemo(() => {
    const rawLines = (code || '').split('\n');
    let inBlock = false;
    return rawLines.map((lineText, idx) => {
      const { tokens, nextInBlockComment } = tokenizeKotlinLine(lineText, inBlock);
      inBlock = nextInBlockComment;
      return {
        lineNumber: idx + 1,
        raw: lineText,
        tokens,
      };
    });
  }, [code]);

  const matchingLineCount = useMemo(() => {
    if (!searchTerm.trim()) return 0;
    const q = searchTerm.toLowerCase();
    return parsedLines.filter((l) => l.raw.toLowerCase().includes(q)).length;
  }, [parsedLines, searchTerm]);

  return (
    <div className={`flex flex-col bg-slate-950 text-slate-100 overflow-hidden ${maxHeightClass}`}>
      {showToolbar && (
        <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap shrink-0 text-xs">
          {/* Syntax Legend Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono text-slate-400">
              {parsedLines.length} lines
            </span>
            <span className="text-slate-700">&bull;</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
              @Composable
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-sky-400">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              Keywords
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-cyan-300">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-300" />
              Types
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
              Strings
            </span>
          </div>

          {/* Code Search & View Controls */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Find in Kotlin snippet..."
                style={{ color: '#f8fafc' }}
                className="pl-8 pr-6 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-amber-500 w-44 sm:w-52"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {searchTerm.trim() && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {matchingLineCount} match{matchingLineCount === 1 ? '' : 'es'}
              </span>
            )}

            <button
              type="button"
              onClick={() => setShowLineNumbers((prev) => !prev)}
              className={`p-1.5 rounded-lg border text-xs transition-colors ${
                showLineNumbers
                  ? 'bg-slate-800 border-slate-600 text-amber-400'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Toggle line numbers"
            >
              <Hash className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setWrapLines((prev) => !prev)}
              className={`p-1.5 rounded-lg border text-xs transition-colors ${
                wrapLines
                  ? 'bg-slate-800 border-slate-600 text-amber-400'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Toggle line wrapping"
            >
              <WrapText className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Highlighted Code Body */}
      <div className="flex-1 overflow-auto p-3 sm:p-4 font-mono text-xs leading-relaxed selection:bg-amber-500/40 selection:text-white">
        <table className="w-full border-collapse">
          <tbody>
            {parsedLines.map((line) => {
              const isMatch =
                searchTerm.trim().length > 0 &&
                line.raw.toLowerCase().includes(searchTerm.toLowerCase());

              return (
                <tr
                  key={line.lineNumber}
                  className={
                    isMatch
                      ? 'bg-amber-500/20 ring-1 ring-amber-500/40'
                      : 'hover:bg-slate-900/80'
                  }
                >
                  {showLineNumbers && (
                    <td className="select-none pr-4 text-right text-[11px] text-slate-500 w-9 align-top font-mono border-r border-slate-800/80">
                      {line.lineNumber}
                    </td>
                  )}
                  <td
                    className={`pl-3 align-top ${
                      wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
                    }`}
                  >
                    {line.tokens.length === 0 ? (
                      <span>&nbsp;</span>
                    ) : (
                      line.tokens.map((tok, i) => (
                        <span key={i} className={getTokenClassName(tok.type)}>
                          {tok.value}
                        </span>
                      ))
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
