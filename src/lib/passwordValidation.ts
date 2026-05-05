/**
 * Centralized password validation utility
 * Provides consistent password security requirements across the application
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PasswordRequirement {
  regex: RegExp;
  message: string;
  type: 'error' | 'warning';
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    regex: /.{8,}/,
    message: 'La contraseña debe tener al menos 8 caracteres',
    type: 'error'
  },
  {
    regex: /[a-z]/,
    message: 'La contraseña debe contener al menos una letra minúscula',
    type: 'error'
  },
  {
    regex: /[A-Z]/,
    message: 'La contraseña debe contener al menos una letra mayúscula',
    type: 'error'
  },
  {
    regex: /[0-9]/,
    message: 'La contraseña debe contener al menos un número',
    type: 'error'
  },
  {
    regex: /[!@#$%^&*(),.?":{}|<>]/,
    message: 'La contraseña debe contener al menos un carácter especial (!@#$%^&*(),.?":{}|<>)',
    type: 'error'
  },
  {
    regex: /.{12,}/,
    message: 'Se recomienda que la contraseña tenga al menos 12 caracteres para mayor seguridad',
    type: 'warning'
  }
];

/**
 * Validates a password against security requirements
 * @param password - The password to validate
 * @returns PasswordValidationResult with validation results
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!password) {
    return {
      isValid: false,
      errors: ['La contraseña es requerida'],
      warnings: []
    };
  }

  // Check against all requirements
  for (const requirement of PASSWORD_REQUIREMENTS) {
    if (!requirement.regex.test(password)) {
      if (requirement.type === 'error') {
        errors.push(requirement.message);
      } else {
        warnings.push(requirement.message);
      }
    }
  }

  // Additional security checks
  if (password.toLowerCase().includes('password')) {
    errors.push('La contraseña no puede contener la palabra "password"');
  }

  if (password.toLowerCase().includes('123456')) {
    errors.push('La contraseña no puede contener secuencias comunes como "123456"');
  }

  if (/(.)\1{3,}/.test(password)) {
    errors.push('La contraseña no puede tener más de 3 caracteres consecutivos iguales');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates password confirmation
 * @param password - The original password
 * @param confirmPassword - The confirmation password
 * @returns boolean indicating if passwords match
 */
export function validatePasswordMatch(password: string, confirmPassword: string): boolean {
  return password === confirmPassword && password.length > 0;
}

/**
 * Gets password strength score (0-100)
 * @param password - The password to evaluate
 * @returns number representing password strength
 */
export function getPasswordStrength(password: string): number {
  if (!password) return 0;

  let score = 0;
  
  // Length scoring
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  // Character variety scoring
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 15;

  // Bonus for complexity
  if (/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/.test(password)) {
    score += 15;
  }

  return Math.min(score, 100);
}

/**
 * Gets password strength label
 * @param strength - The strength score (0-100)
 * @returns string label for the strength
 */
export function getPasswordStrengthLabel(strength: number): string {
  if (strength < 30) return 'Muy débil';
  if (strength < 50) return 'Débil';
  if (strength < 70) return 'Moderada';
  if (strength < 90) return 'Fuerte';
  return 'Muy fuerte';
}

/**
 * Gets password strength color
 * @param strength - The strength score (0-100)
 * @returns CSS color class for the strength
 */
export function getPasswordStrengthColor(strength: number): string {
  if (strength < 30) return 'text-destructive';
  if (strength < 50) return 'text-orange-500';
  if (strength < 70) return 'text-yellow-500';
  if (strength < 90) return 'text-blue-500';
  return 'text-green-500';
}