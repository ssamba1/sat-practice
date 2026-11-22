/** Wrap the selected text inside root in <mark class="hl">. Skips text inside MathML
 *  (an HTML mark cannot live there) and text that is already highlighted.
 *  Ported from ModuleDrill (index.html:1684-1707). Returns true if anything was marked. */
export function markSelection(root: HTMLElement): boolean {
  const sel = getSelection();
  if (!sel || !sel.rangeCount || sel.isCollapsed) return false;
  const r = sel.getRangeAt(0);
  if (!root.contains(r.commonAncestorContainer)) return false;
  const c = r.commonAncestorContainer;
  const top = c.nodeType === 3 ? c.parentNode! : c;
  const walk = document.createTreeWalker(top, NodeFilter.SHOW_TEXT), nodes: Text[] = [];
  while (walk.nextNode()) {
    const n = walk.currentNode as Text;
    if (r.intersectsNode(n) && n.textContent!.trim() && !n.parentElement!.closest('math, mark.hl')) nodes.push(n);
  }
  for (let n of nodes) {
    if (n === r.endContainer) n.splitText(r.endOffset);        // end first: the start offset stays valid
    if (n === r.startContainer) n = n.splitText(r.startOffset);
    if (!n.textContent) continue;
    const m = document.createElement('mark');
    m.className = 'hl';
    n.replaceWith(m);
    m.appendChild(n);
  }
  sel.removeAllRanges();
  return nodes.length > 0;
}
