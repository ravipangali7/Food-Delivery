import type { ReactNode } from 'react';

/**
 * पसल "About us" सादा पाठ न्यूनतम फर्म्याटिङसहित render:
 * - `**topic**` → बोल्ड (शीर्षकका लागि छुट्टै लाइनमा प्रयोग)।
 * - अनुच्छेद विराम: ब्लक बीच खाली लाइन।
 * - एकल newline → अनुच्छेद भित्र लाइन ब्रेक।
 */
export function renderAboutPlainText(text: string): ReactNode {
  const paragraphs = text.trim() === '' ? [] : text.split(/\n\n+/);

  return (
    <div className="text-sm text-muted-foreground leading-relaxed">
      {paragraphs.map((para, pi) => (
        <p key={pi} className={pi > 0 ? 'mt-4' : undefined}>
          {para.split('\n').map((line, li) => (
            <span key={li}>
              {li > 0 ? <br /> : null}
              {renderLineWithBold(line)}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

function renderLineWithBold(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([\s\S]*?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) {
      out.push(<span key={`t${k++}`}>{line.slice(last, m.index)}</span>);
    }
    out.push(
      <strong key={`b${k++}`} className="font-semibold text-foreground">
        {m[1]}
      </strong>
    );
    last = m.index + m[0].length;
  }
  if (last < line.length) {
    out.push(<span key={`t${k++}`}>{line.slice(last)}</span>);
  }
  if (out.length === 0) {
    out.push(<span key="t0">{line}</span>);
  }
  return out;
}
