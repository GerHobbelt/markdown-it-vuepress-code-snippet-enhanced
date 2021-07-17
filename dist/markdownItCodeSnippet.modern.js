/*! markdown-it-vuepress-code-snippet-enhanced 2.0.1-1 https://github.com//GerHobbelt/markdown-it-vuepress-code-snippet-enhanced @license MIT */

import fs from 'fs';
import path from 'path';

const TRANSCLUDE_WITH = 'TRANSCLUDE_WITH';
const TRANSCLUDE_AUTO = 'TRANSCLUDE_AUTO';
const TRANSCLUDE_LINE = 'TRANSCLUDE_LINE';
const TRANSCLUDE_TAG = 'TRANSCLUDE_TAG';
const NO_LINES_MATCHED = 'No lines matched.';
function plugin(md, options) {
  options = Object.assign({}, options);

  function getRootPath() {
    return options.root || process.cwd();
  }

  function mkPathAbsolute(f) {
    return path.resolve(f).replace(/[\\]/g, '/');
  }

  const fileExists = f => {
    return fs.existsSync(f);
  };

  const readFileSync = f => {
    return fileExists(f) ? fs.readFileSync(f).toString() : `Not Found: ${f}`;
  };

  function mkRegexSnippet(r) {

    if (typeof r === 'string') {
      r = r.replace(/([.\[\]|(){}+?*$^])/g, '\\$1');
    }

    return r;
  }

  const parseOptions = opts => {
    const _t = {};
    opts.trim().split(' ').forEach(pair => {
      const [opt, value] = pair.split('=');
      _t[opt] = value;
    });
    return _t;
  };

  const dataFactory = (state, pos, max) => {
    const start = pos + 6;
    const end = state.skipSpacesBack(max, pos) - 1;
    const [opts, fullpathWithAtSym] = state.src.slice(start, end).trim().split('](');
    const fullpath = mkPathAbsolute(fullpathWithAtSym.trim().replace(/^@/, getRootPath()).trim());
    const pathParts = fullpath.split('/');
    const fileParts = pathParts[pathParts.length - 1].split('.');
    return {
      file: {
        resolve: fullpath,
        path: pathParts.slice(0, pathParts.length - 1).join('/'),
        name: fileParts.slice(0, fileParts.length - 1).join('.'),
        ext: fileParts[fileParts.length - 1]
      },
      options: parseOptions(opts),
      content: readFileSync(fullpath),
      fileExists: fileExists(fullpath)
    };
  };

  const optionsMap = ({
    options
  }) => ({
    hasHighlight: options.highlight || false,
    hasTransclusion: options.transclude || options.transcludeWith || options.transcludeAuto || options.transcludeTag || false,

    get transclusionType() {
      if (options.transcludeWith) return TRANSCLUDE_WITH;
      if (options.transcludeAuto) return TRANSCLUDE_AUTO;
      if (options.transcludeTag) return TRANSCLUDE_TAG;
      if (options.transclude) return TRANSCLUDE_LINE;
      return '';
    },

    get meta() {
      return this.hasHighlight ? options.highlight : '';
    }

  });

  const contentTransclusion = ({
    content,
    options
  }, transcludeType) => {
    const lines = content.split(/\r?\n/);
    let _content = '';
    let _block = [];

    function pushBlock() {
      let indent = -1;

      _block.forEach(line => {
        if (line !== '') {
          const lineIndent = line.match(/^\s*/)[0].length;
          indent = indent < 0 ? lineIndent : Math.min(indent, lineIndent);
        }
      });

      _content += _block.map(line => line.substring(indent)).join('\n') + '\n';
      _block = [];
    }

    if (transcludeType === TRANSCLUDE_LINE) {
      let matchLines = options.transclude.replace(/[^\d|,-]/g, '').split(/[|,]/).map(l => l.split('-').map(v => +v));
      matchLines = matchLines.map(l => {
        if (l.length === 1) {
          l = [l[0], l[0]];
        }

        return l;
      });
      matchLines.sort((a, b) => {
        return a[0] - b[0];
      }); // add sentinel at the end of the lines' spec list:

      matchLines.push([lines.length + 1000, lines.length + 1000]);
      let matchIndex = -1;
      let tStart = 0;
      let tEnd = 0;
      lines.forEach((line, idx) => {
        const i = idx + 1;

        if (tEnd < i) {
          for (matchIndex++; matchLines[matchIndex][1] < i; matchIndex++);

          const slot = matchLines[matchIndex];
          tStart = slot[0];
          tEnd = slot[1];
        }

        if (i >= tStart && i <= tEnd) {
          _block.push(line);
        }
      });
      pushBlock();
    } else if (transcludeType === TRANSCLUDE_TAG) {
      const t = mkRegexSnippet(options.transcludeTag);
      const tag = new RegExp(`${t}>$|^<${t}`);
      let matched = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (matched && tag.test(line)) {
          _block.push(line);

          pushBlock();
          break;
        } else if (matched) {
          _block.push(line);
        } else if (tag.test(line)) {
          _block.push(line);

          matched = true;
        }
      }
    } else if (transcludeType === TRANSCLUDE_WITH) {
      const t = mkRegexSnippet(options.transcludeWith);
      const tag = new RegExp(`(?:(?:###?)|(?:\\/\\/\\/?))\\s*${t}`);
      let matched = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (tag.test(line)) {
          matched = !matched;
          continue;
        }

        if (matched) {
          _block.push(line);
        }
      }

      pushBlock();
    } else if (transcludeType === TRANSCLUDE_AUTO) {
      const t = mkRegexSnippet(options.transcludeAuto);
      const tag = new RegExp(`(?:[#/;!(*]*)\\s*${t}`);
      let matched = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (tag.test(line)) {
          matched = !matched;
          continue;
        }

        if (matched) {
          _block.push(line);
        }
      }

      pushBlock();
    }

    return _content === '' ? NO_LINES_MATCHED : _content;
  };

  function parser(state, startLine, endLine, silent) {
    const matcher = [64, 91, 99, 111, 100, 101];
    const pos = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];

    if (state.sCount[startLine] - state.blkIndent >= 4) {
      return false;
    }

    for (let i = 0; i < 6; ++i) {
      const ch = state.src.charCodeAt(pos + i);
      if (ch !== matcher[i] || pos + i >= max) return false;
    }

    if (silent) return true; // handle code snippet include

    const d = dataFactory(state, pos, max);
    const opts = optionsMap(d);
    const token = state.push('fence', 'code', 0);
    token.info = (d.options.lang || d.file.ext) + opts.meta;
    token.content = d.fileExists && opts.hasTransclusion ? contentTransclusion(d, opts.transclusionType) : d.content;

    if (token.content === NO_LINES_MATCHED) {
      console.warn(NO_LINES_MATCHED, 'Filepath:', d.file.path, 'options:', d.options);
    }

    token.markup = '```';
    token.map = [startLine, startLine + 1];
    state.line = startLine + 1;
    return true;
  }

  md.block.ruler.before('fence', 'snippet', parser);
}

export default plugin;
//# sourceMappingURL=markdownItCodeSnippet.modern.js.map
