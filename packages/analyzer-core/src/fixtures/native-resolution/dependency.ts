/** Validates an invoice. */
export function validateInvoice() { return true; }
export const validateArrow = () => true;
export class Validator {
  validate() { return true; }
}

export function overloaded(value: string): string;
export function overloaded(value: number): number;
export function overloaded(value: string | number) { return value; }

export default function defaultFunction() { return true; }
