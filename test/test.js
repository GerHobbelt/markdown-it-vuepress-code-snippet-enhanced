/* eslint-env mocha, es6 */

import path from 'path';
import fs from 'fs';
import assert from 'assert';
import yaml from 'js-yaml';

import markdownit from '@gerhobbelt/markdown-it';
import generate from '@gerhobbelt/markdown-it-testgen';

import { fileURLToPath } from 'url';

// see https://nodejs.org/docs/latest-v13.x/api/esm.html#esm_no_require_exports_module_exports_filename_dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import codeSnippetPlugin from '../src/plugin.js';


function cleanCRLF(text) {
  return text.replace(/\r\n|\n|\r/g, '\n');
}


describe('markdown-it-code-snippets', function () {
  generate(path.join(__dirname, 'fixtures/snippets.txt'), {
    test: (it, testTitle, fixture, options, md, env) => {
      it(testTitle, function () {
        const md = markdownit({ linkify: true })
                    .use(codeSnippetPlugin, {
                      root: __dirname
                    });

        options.assert.strictEqual(cleanCRLF(md.render(fixture.first.text, env)), cleanCRLF(fixture.second.text));
      });
    }
  });
});
