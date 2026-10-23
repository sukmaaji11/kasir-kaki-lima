import bcrypt from 'bcryptjs';

const PIN_REGEX = /^\d{6}$/;
const PIN_HASH_ROUNDS = 12;

export function validateCashierPin(pin: unknown): pin is string {
  return typeof pin === 'string' && PIN_REGEX.test(pin);
}

export async function hashCashierPin(pin: string): Promise<string> {
  if (!validateCashierPin(pin)) {
    throw new Error('PIN kasir harus terdiri dari tepat 6 digit.');
  }

  return bcrypt.hash(pin, PIN_HASH_ROUNDS);
}

export async function verifyCashierPin(
  pin: string,
  pinHash: string,
): Promise<boolean> {
  if (!validateCashierPin(pin)) {
    return false;
  }

  return bcrypt.compare(pin, pinHash);
}
