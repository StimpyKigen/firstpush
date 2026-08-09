// Central config for the M-Pesa "Send Money" receiving line used across the app.
// Since STK Push (Lipa na M-Pesa Online) requires a registered Safaricom
// Paybill/Till business shortcode and Daraja production approval: it cannot
// push directly to a personal phone number: MshindiRoom instead uses the
// standard personal "Send Money" flow: the punter sends money to this number
// via their own M-Pesa app/USSD, then pastes the SMS confirmation code back
// here to instantly verify and unlock access.

export const RECEIVER_MPESA_NUMBER = '+254 743 304 579';
export const RECEIVER_MPESA_NUMBER_RAW = '254743304579';
export const RECEIVER_NAME = 'MshindiRoom Ltd';

// M-Pesa confirmation codes are 10-character alphanumeric strings, e.g. "QFT7K9L2M1".
const CODE_PATTERN = /^[A-Z0-9]{8,12}$/;

export function isValidMpesaCode(code: string): boolean {
  return CODE_PATTERN.test(code.trim().toUpperCase());
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}
