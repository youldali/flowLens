import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ts from 'typescript';
import { getDisplayName } from './function-naming.js';
import { isExecutableFunction, type ExecutableFunctionDeclaration } from './functions.js';

function functions(source: string): ExecutableFunctionDeclaration[] {
  const file = ts.createSourceFile('naming.ts', source, ts.ScriptTarget.Latest, true);
  const nodes: ExecutableFunctionDeclaration[] = [];
  const visit = (node: ts.Node): void => {
    if (isExecutableFunction(node)) nodes.push(node);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return nodes;
}

describe('getDisplayName', () => {
  const cases: [string, string, string[]][] = [
    ['named declaration', 'function validate() {}', ['validate']],
    ['variable arrow', 'const validate = () => {};', ['validate']],
    ['variable function', 'const validate = function() {};', ['validate']],
    ['explicit name wins', 'const validate = function actual() {}; retry(function named() {});', ['actual', 'named']],
    ['object properties', 'const handlers = { onSubmit: () => {}, onCancel: function() {}, method() {} };', ['onSubmit', 'onCancel', 'method']],
    ['static property keys', 'const h = { "submit": () => {}, ["cancel"]: function() {}, [key]: () => {} };', ['submit', 'cancel', 'anonymous at line 1']],
    ['assignments', 'handlers.onSubmit = () => {}; handlers["cancel"] = function() {}; validate = () => {};', ['onSubmit', 'cancel', 'validate']],
    ['dynamic assignment', 'handlers[key] = () => {};', ['anonymous at line 1']],
    ['class members', 'class H { constructor() {} get value() { return 1; } set value(v) {} onSubmit = () => {}; method() {} }', ['constructor', 'value', 'value', 'onSubmit', 'method']],
    ['map callback', 'items.map(item => item.id);', ['map callback']],
    ['retry callback', 'retry(() => execute());', ['retry callback']],
    ['callee shapes', 'foo(() => {}); obj.foo(() => {}); obj.nested.foo(() => {}); obj["foo"](() => {});', ['foo callback', 'foo callback', 'foo callback', 'foo callback']],
    ['event handler', 'element.addEventListener("click", () => {});', ['click handler']],
    ['static template event', 'element.addEventListener(`click`, () => {});', ['click handler']],
    ['unclear event', 'element.addEventListener(event, () => {}); element.addEventListener(`event${id}`, () => {}); element.addEventListener("", () => {});', ['addEventListener callback', 'addEventListener callback', 'addEventListener callback']],
    ['event argument position', 'element.addEventListener(() => {}, "click");', ['addEventListener callback']],
    ['transparent wrappers', 'const validate = ((() => {}) as Handler)!; retry(((() => {}) satisfies Handler)); handlers.submit = <Handler>(() => {});', ['validate', 'retry callback', 'submit']],
    ['nested callbacks', 'retry(() => items.map(() => {}));', ['retry callback', 'map callback']],
    ['unclear callees', 'getCallbackRunner()(() => {}); handlers[key](() => {});', ['anonymous at line 1', 'anonymous at line 1']],
    ['no inference through conditional', 'const handler = ready ? () => {} : () => {};', ['anonymous at line 1', 'anonymous at line 1']],
    ['IIFE', '(() => {})();', ['anonymous at line 1']],
    ['anonymous default declaration', 'export default function() {}', ['anonymous at line 1']],
    ['location fallbacks', 'function parent() { foo(() => {}); [() => {}, () => {}]; }', ['parent', 'foo callback', 'anonymous at line 1', 'anonymous at line 1']],
  ];

  for (const [description, source, expected] of cases) {
    it(description, () => {
      assert.deepEqual(functions(source).map(getDisplayName), expected);
    });
  }

  it('uses source-line fallbacks independently of request order', () => {
    const nodes = functions(`
      [() => { [() => {}, () => {}]; }, () => {}];
      function parent() { [() => { return () => {}; }, () => {}]; }
    `);
    const expected = [
      'anonymous at line 2',
      'anonymous at line 2',
      'anonymous at line 2',
      'anonymous at line 2',
      'parent',
      'anonymous at line 3',
      'anonymous at line 3',
      'anonymous at line 3',
    ];
    for (let index = nodes.length - 1; index >= 0; index--) {
      assert.equal(getDisplayName(nodes[index]!), expected[index]);
    }
    assert.deepEqual(nodes.map(getDisplayName), expected);
  });
});
