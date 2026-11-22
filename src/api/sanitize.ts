// Question HTML comes from College Board or from a bundle file someone may have shared,
// and it is rendered with innerHTML. Strip anything that can run code.
const DROP = 'script,iframe,object,embed,link,meta,base,form,frame,frameset,noscript,template';
const URL_ATTR = /^(href|src|xlink:href|action|formaction|srcset)$/i;

export function sanitizeHtml(html: string): string {
  if (!html) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  doc.body.querySelectorAll(DROP).forEach(el => el.remove());
  doc.body.querySelectorAll('*').forEach(el => {
    for (const a of Array.from(el.attributes)) {
      const v = a.value.replace(/[\s\u0000-\u001f]/g, '').toLowerCase();
      if (/^on/i.test(a.name) || (URL_ATTR.test(a.name) && /^(javascript|vbscript|data:(?!image\/(png|gif|jpe?g|webp)))/.test(v))) el.removeAttribute(a.name);
    }
  });
  return doc.body.innerHTML;
}
