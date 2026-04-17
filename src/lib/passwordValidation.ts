export interface PasswordRule {
  id: string;
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { id: "upper", label: "1 uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { id: "number", label: "1 number", test: (pw) => /[0-9]/.test(pw) },
  { id: "special", label: "1 special character (e.g. !@#$%)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export function validatePassword(pw: string) {
  const results = PASSWORD_RULES.map((r) => ({ ...r, passed: r.test(pw) }));
  return { results, isValid: results.every((r) => r.passed) };
}
