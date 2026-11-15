// Rehype plugin: highlights `pre > code` blocks with lowlight (highlight.js).
// - Uses the declared language of the fenced block when it is registered.
// - Maps common tags emitted by AI models (jsx, tsx, ...) onto a registered language.
// - Auto-detects the language when none is declared or it is unknown.
// - Leaves the app's custom `file:` blocks untouched (they are download payloads).
import {visit} from 'unist-util-visit';
import {toText} from 'hast-util-to-text';
import {createLowlight, common} from 'lowlight';

const lowlight = createLowlight(common);

const LANGUAGE_ALIASES = {
  jsx: 'javascript',
  tsx: 'typescript',
  mjs: 'javascript',
  cjs: 'javascript',
  sh: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  'c++': 'cpp',
  'c#': 'csharp',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  golang: 'go',
  htm: 'xml',
  html: 'xml',
};

export const rehypeCodeHighlight = () => (tree) => {
  visit(tree, 'element', (node, _index, parent) => {
    if (node.tagName !== 'code' || parent?.tagName !== 'pre') return;

    const classes = node.properties?.className || [];
    const langClass = classes.find(
      (name) => typeof name === 'string' && name.startsWith('language-')
    );
    const declared = langClass
      ? langClass.slice('language-'.length).trim().split(/[\s:+]/)[0].toLowerCase()
      : '';

    // `file:name` blocks carry download payloads, never highlight them.
    if (declared.startsWith('file')) return;

    const code = toText(node, {whitespace: 'pre'});
    if (!code.trim()) return;

    const language = LANGUAGE_ALIASES[declared] || declared;
    const result =
      language && lowlight.registered(language)
        ? lowlight.highlight(language, code)
        : lowlight.highlightAuto(code);

    node.properties.className = [
      'hljs',
      ...(result.data?.language ? [`language-${result.data.language}`] : []),
    ];
    node.children = result.children;
  });
};
