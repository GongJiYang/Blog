import { html, HtmlString } from "./templates.ts";

import hljs_ from "highlight.js/lib/core";
const hljs: any = hljs_;
hljs.configure({ classPrefix: "hl-" });
import rust from "highlight.js/lib/languages/rust";
import latex from "highlight.js/lib/languages/latex.js";
import nix from "highlight.js/lib/languages/nix.js";
import x86asm from "highlight.js/lib/languages/x86asm.js";
import zig from "./highlight-zig.js";
hljs.registerLanguage("latex", latex);
hljs.registerLanguage("nix", nix);
hljs.registerLanguage("x86asm", x86asm);
hljs.registerLanguage("Zig", zig);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("ungrammar", () => ({
  name: "ungrammar",
  contains: [
    {
      className: "string",
      begin: "\\'",
      end: "\\'",
    },
    {
      scope: "literal",
      match:"[A-Z][_a-zA-Z0-9]*(?= =)"
    }
  ],
}));

export function highlight(
  source: string, //待高亮的源代码字符串
  language?: string, //指定代码的编程语言，帮助确定高亮规则
  highlight_spec?: string, //高亮的具体设置
): HtmlString {
  const spec = parse_highlight_spec(highlight_spec);
  let src = source;
  let callouts: Map<number, number[]>;
  [src, callouts] = parse_callouts(src); //解析源代码中的标记
  let highlighted: string = add_spans(src, language).value; //应用高亮规则
  highlighted = highlighted.trimEnd(); //去除末尾空白字符
  //处理高亮标签的嵌套和换行
  const openTags: string[] = [];
  highlighted = highlighted.replace(
    /(<span [^>]+>)|(<\/span>)|(\n)/g,
    (match) => {
      if (match === "\n") {
        return "</span>".repeat(openTags.length) + "\n" + openTags.join("");
      }

      if (match === "</span>") {
        openTags.pop();
      } else {
        openTags.push(match);
      }

      return match;
    },
  );
  const lines = highlighted.split("\n").map((it, idx) => {
    const cls = spec.includes(idx + 1) ? ' hl-line' : '';
    const calls = (callouts.get(idx) ?? [])
      .map((it) => `<i class="callout" data-value="${it}"></i>`)
      .join(" ");
    return `<span class="line${cls}">${it}${calls}</span>`;
  })
    .join("\n");
  return html`\n<pre><code>${new HtmlString(lines)}</code></pre>\n`;
}

function add_spans(source: string, language?: string): HtmlString {
  if (!language || language === "adoc") return html`${source}`;
  if (language == "console") return add_spans_console(source);
  const res = hljs.highlight(source, { language, ignoreIllegals: true });
  return new HtmlString(res.value);
}

function add_spans_console(source: string): HtmlString {
  let cont = false;
  const lines = source.trimEnd().split("\n").map((line) => {
    if (cont) {
      cont = line.endsWith("\\");
      return html`${line}\n`;
    }
    if (line.startsWith("$ ")) {
      cont = line.endsWith("\\");
      return html`<span class="hl-title function_">$</span> ${
        line.substring(2)
      }\n`;
    }
    if (line.startsWith("#")) {
      return html`<span class="hl-comment">${line}</span>\n`;
    }
    return html`<span class="hl-output">${line}</span>\n`;
  });
  return html`${lines}`;
}

function parse_highlight_spec(spec?: string): number[] {
  if (!spec) return [];
  return spec.split(",").flatMap((el) => {
    if (el.includes("-")) {
      const [los, his] = el.split("-");
      const lo = parseInt(los, 10);
      const hi = parseInt(his, 10);
      return Array.from({ length: (hi - lo) + 1 }, (x, i) => lo + i);
    }
    return [parseInt(el, 10)];
  });
}

function parse_callouts(source: string): [string, Map<number, number[]>] {
  const res: Map<number, number[]> = new Map();
  let line = 0;
  const without_callouts = source.replace(/<(\d)>|\n/g, (m, d) => {
    if (m === "\n") {
      line += 1;
      return m;
    }
    const arr = res.get(line) ?? [];
    arr.push(d);
    res.set(line, arr);
    return "";
  });
  return [without_callouts, res];
}