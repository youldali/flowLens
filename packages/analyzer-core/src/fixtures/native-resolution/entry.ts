import defaultFunction, { validateInvoice as aliased, validateArrow, Validator, overloaded as aliasedOverload } from './dependency.js';
import { reexported } from './barrel.js';

export function createInvoice() {
  local();
  aliased();
  reexported();
  defaultFunction();
  aliasedOverload('invoice');
  validateArrow();
  new Validator().validate();
  const expression = function namedExpression() { local(); };
  expression();
  function nested() { local(); }
  nested();
  // @ts-expect-error Deliberately unresolved for graph characterization.
  missing();
}
function local() { return true; }
