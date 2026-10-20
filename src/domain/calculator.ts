/**
 * Amount keypad with a built-in calculator. The expression is kept in a canonical ASCII form
 * ("12.5+3*2") and rendered with the locale decimal separator and × ÷ − glyphs.
 */

export type CalcKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | '+' | '-' | '*' | '/' | 'back' | 'clear';

const OPERATORS = new Set(['+', '-', '*', '/']);
const MAX_INTEGER_DIGITS = 10;

function isOperator(char: string | undefined): boolean {
  return char !== undefined && OPERATORS.has(char);
}

/** The number currently being typed (after the last operator). */
export function currentOperand(expression: string): string {
  return /[\d.]*$/.exec(expression)?.[0] ?? '';
}

export function pressKey(expression: string, key: CalcKey, decimals: number): string {
  if (key === 'clear') return '';
  if (key === 'back') return expression.slice(0, -1);

  const last = expression[expression.length - 1];
  if (isOperator(key)) {
    if (expression === '') return expression;
    if (isOperator(last) || last === '.') return expression.slice(0, -1) + key;
    return expression + key;
  }

  const operand = currentOperand(expression);
  if (key === '.') {
    if (decimals === 0 || operand.includes('.')) return expression;
    return expression + (operand === '' ? '0.' : '.');
  }

  const [integer = '', fraction] = operand.split('.');
  if (fraction !== undefined) return fraction.length >= decimals ? expression : expression + key;
  if (integer === '0') return expression.slice(0, -1) + key;
  if (integer.length >= MAX_INTEGER_DIGITS) return expression;
  return expression + key;
}

export function hasOperator(expression: string): boolean {
  return /[+\-*/]\d/.test(expression);
}

/** Evaluates with × ÷ before + −. Returns null for empty input or division by zero. */
export function evaluate(expression: string): number | null {
  const tokens = expression.match(/\d+(?:\.\d*)?|\.\d+|[+\-*/]/g);
  if (!tokens) return null;
  while (tokens.length && isOperator(tokens[tokens.length - 1])) tokens.pop();
  if (!tokens.length || isOperator(tokens[0])) return null;

  // First pass: fold * and / into terms.
  const terms: number[] = [Number(tokens[0])];
  const signs: string[] = [];
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i]!;
    const value = Number(tokens[i + 1]);
    if (op === '*' || op === '/') {
      if (op === '/' && value === 0) return null;
      const previous = terms.pop()!;
      terms.push(op === '*' ? previous * value : previous / value);
    } else {
      signs.push(op);
      terms.push(value);
    }
  }
  let result = terms[0]!;
  for (let i = 0; i < signs.length; i++) result = signs[i] === '+' ? result + terms[i + 1]! : result - terms[i + 1]!;
  return Number.isFinite(result) ? result : null;
}

/** Keypad text to start editing an existing amount: 12.50 → "12.5", 7.00 → "7". */
export function expressionFromDecimal(decimal: string): string {
  if (!decimal.includes('.')) return decimal;
  return decimal.replace(/0+$/, '').replace(/\.$/, '');
}

export function displayExpression(expression: string, decimalSeparator: string): string {
  return expression
    .replace(/\./g, decimalSeparator)
    .replace(/\*/g, ' × ')
    .replace(/\//g, ' ÷ ')
    .replace(/\+/g, ' + ')
    .replace(/-/g, ' − ');
}
