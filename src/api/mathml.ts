// College Board content uses <mfenced>, which MathML Core dropped: Chrome and Safari
// render it without its brackets. Rewrite each one into an mrow with explicit <mo>s.
const MML_NS = 'http://www.w3.org/1998/Math/MathML';

function expand(el: Element) {
  const doc = el.ownerDocument;
  const attr = (n: string, d: string) => el.hasAttribute(n) ? el.getAttribute(n)! : d;
  const open = attr('open', '('), close = attr('close', ')');
  const seps = attr('separators', ',').replace(/\s+/g, '');
  const mo = (ch: string) => { const o = doc.createElementNS(MML_NS, 'mo'); o.textContent = ch; return o; };
  const row = doc.createElementNS(MML_NS, 'mrow');
  if (open) row.appendChild(mo(open));
  const kids = Array.from(el.children);
  if (kids.length) {
    kids.forEach((k, i) => {
      if (i && seps) row.appendChild(mo(seps[Math.min(i - 1, seps.length - 1)]));
      row.appendChild(k);
    });
  } else {
    while (el.firstChild) row.appendChild(el.firstChild);
  }
  if (close) row.appendChild(mo(close));
  el.replaceWith(row);
}

export function fixMathML(html: string): string {
  if (!html || !html.includes('<mfenced')) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let el: Element | null, guard = 0;
  while ((el = doc.querySelector('mfenced')) && guard++ < 10000) {
    let inner = el, deeper: Element | null;
    while ((deeper = inner.querySelector('mfenced'))) inner = deeper;
    expand(inner);
  }
  return doc.body.innerHTML;
}
