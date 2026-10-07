import React, { useState } from 'react';
import { Check, Copy, Play, Terminal } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

interface CodeBlockProps {
  language: string;
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.trim().split('\n');
  const canPreview = ['html', 'svg', 'json'].includes(language.toLowerCase());

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-white/10 bg-[#0d1017] text-xs font-mono">
      {/* Code header bar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#141822] border-b border-white/10 select-none">
        <div className="flex items-center gap-2 text-neutral-400">
          <Terminal className="w-3.5 h-3.5 text-blue-400" />
          <span className="uppercase tracking-wider font-semibold text-[11px] text-neutral-300">
            {language || 'code'}
          </span>
          <span className="text-neutral-600">·</span>
          <span className="text-[10px] text-neutral-500 tabular-nums">
            {lines.length} {lines.length === 1 ? 'line' : 'lines'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {canPreview && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                showPreview
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
              }`}
            >
              <Play className="w-3 h-3" />
              <span>{showPreview ? 'Show Code' : 'Preview'}</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-colors"
            title="Copy code to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-neutral-400" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code preview or raw code */}
      {showPreview && canPreview ? (
        <div className="p-4 bg-[#141822] border-t border-white/5">
          {language.toLowerCase() === 'html' || language.toLowerCase() === 'svg' ? (
            <div
              className="p-3 bg-white text-neutral-900 rounded overflow-auto max-h-80"
              dangerouslySetInnerHTML={{ __html: code }}
            />
          ) : (
            <pre className="p-3 bg-black/40 rounded text-emerald-400 overflow-x-auto text-[11px]">
              {JSON.stringify(JSON.parse(code), null, 2)}
            </pre>
          )}
        </div>
      ) : (
        <div className="p-3 overflow-x-auto bg-[#090b10] max-h-[500px]">
          <table className="w-full text-left border-collapse">
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02]">
                  <td className="pr-3 py-0.5 text-right select-none text-neutral-600 text-[11px] w-7 tabular-nums font-mono">
                    {idx + 1}
                  </td>
                  <td className="py-0.5 text-neutral-200 whitespace-pre font-mono text-[12px] leading-relaxed">
                    {line}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) return null;

  // Split content into code blocks vs text blocks
  const parts: React.ReactNode[] = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textChunk = content.substring(lastIndex, match.index);
      parts.push(<FormattedText key={`text-${lastIndex}`} rawText={textChunk} />);
    }

    const language = match[1] || 'text';
    const code = match[2];
    parts.push(
      <CodeBlock
        key={`code-${match.index}`}
        language={language}
        code={code}
      />
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const textChunk = content.substring(lastIndex);
    parts.push(<FormattedText key={`text-${lastIndex}`} rawText={textChunk} />);
  }

  return <div className="markdown-body space-y-2 text-neutral-200">{parts}</div>;
};

// Formats headings, tables, blockquotes, lists, bold, italics, links, inline code
const FormattedText: React.FC<{ rawText: string }> = ({ rawText }) => {
  const paragraphs = rawText.split('\n\n');

  return (
    <>
      {paragraphs.map((p, pIdx) => {
        const trimmed = p.trim();
        if (!trimmed) return null;

        // Headings
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={pIdx} className="text-sm font-semibold text-white mt-3 mb-1">
              {formatInline(trimmed.replace(/^###\s+/, ''))}
            </h3>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={pIdx} className="text-base font-bold text-white mt-3.5 mb-1.5">
              {formatInline(trimmed.replace(/^##\s+/, ''))}
            </h2>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h1 key={pIdx} className="text-lg font-bold text-white mt-4 mb-2">
              {formatInline(trimmed.replace(/^#\s+/, ''))}
            </h1>
          );
        }

        // Blockquotes
        if (trimmed.startsWith('> ')) {
          const quoteLines = trimmed.split('\n').map((l) => l.replace(/^>\s?/, '')).join('\n');
          return (
            <blockquote key={pIdx} className="border-l-2 border-blue-500 pl-3 my-2 text-neutral-300 text-xs bg-[#141822] py-1.5 rounded-r">
              {formatInline(quoteLines)}
            </blockquote>
          );
        }

        // Tables
        if (trimmed.includes('|') && trimmed.includes('\n|')) {
          const lines = trimmed.split('\n').filter((l) => l.trim().startsWith('|'));
          if (lines.length >= 2) {
            const headerCols = lines[0].split('|').map((c) => c.trim()).filter(Boolean);
            const bodyRows = lines.slice(2).map((l) =>
              l.split('|').map((c) => c.trim()).filter(Boolean)
            );

            return (
              <div key={pIdx} className="my-2.5 overflow-x-auto rounded border border-white/10 bg-[#141822]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1a202c] border-b border-white/10">
                      {headerCols.map((col, cIdx) => (
                        <th key={cIdx} className="px-3 py-1.5 font-semibold text-neutral-200">
                          {formatInline(col)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {bodyRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-white/[0.02]">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-3 py-1.5 text-neutral-300">
                            {formatInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
        }

        // Unordered lists
        if (trimmed.split('\n').every((l) => l.trim().startsWith('- ') || l.trim().startsWith('* '))) {
          const items = trimmed.split('\n').map((l) => l.trim().replace(/^[-*]\s+/, ''));
          return (
            <ul key={pIdx} className="space-y-1 my-1.5 pl-4 list-disc text-xs sm:text-sm text-neutral-300 marker:text-neutral-500">
              {items.map((it, itIdx) => (
                <li key={itIdx}>{formatInline(it)}</li>
              ))}
            </ul>
          );
        }

        // Ordered lists
        if (trimmed.split('\n').every((l) => /^\d+\.\s+/.test(l.trim()))) {
          const items = trimmed.split('\n').map((l) => l.trim().replace(/^\d+\.\s+/, ''));
          return (
            <ol key={pIdx} className="space-y-1 my-1.5 pl-4 list-decimal text-xs sm:text-sm text-neutral-300 marker:text-neutral-500">
              {items.map((it, itIdx) => (
                <li key={itIdx}>{formatInline(it)}</li>
              ))}
            </ol>
          );
        }

        // Regular paragraph
        return (
          <p key={pIdx} className="text-xs sm:text-sm leading-relaxed text-neutral-200">
            {formatInline(trimmed)}
          </p>
        );
      })}
    </>
  );
};

// Parse bold, italics, inline code, and URLs
function formatInline(text: string): React.ReactNode {
  const tokens: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.substring(lastIndex, match.index));
    }

    const matchedStr = match[0];

    if (matchedStr.startsWith('`') && matchedStr.endsWith('`')) {
      tokens.push(
        <code
          key={`code-${match.index}`}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-white/10 text-neutral-200 font-mono text-[11px] border border-white/5"
        >
          {matchedStr.slice(1, -1)}
        </code>
      );
    } else if (matchedStr.startsWith('**') && matchedStr.endsWith('**')) {
      tokens.push(
        <strong key={`bold-${match.index}`} className="font-semibold text-white">
          {matchedStr.slice(2, -2)}
        </strong>
      );
    } else if (matchedStr.startsWith('*') && matchedStr.endsWith('*')) {
      tokens.push(
        <em key={`italic-${match.index}`} className="italic text-neutral-300">
          {matchedStr.slice(1, -1)}
        </em>
      );
    } else if (matchedStr.startsWith('[') && matchedStr.includes('](')) {
      const linkMatch = matchedStr.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        tokens.push(
          <a
            key={`link-${match.index}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            {linkMatch[1]}
          </a>
        );
      }
    }

    lastIndex = match.index + matchedStr.length;
  }

  if (lastIndex < text.length) {
    tokens.push(text.substring(lastIndex));
  }

  return tokens;
}
