export function isUniqueViolation(
  error: unknown,
): boolean {
  if (
    typeof error !== 'object' ||
    error === null
  ) {
    return false;
  }

  const candidate =
    error as {
      code?: string;
    };

  return candidate.code === '23505';
}

export function getUniqueViolationConstraint(
  error: unknown,
): string | undefined {
  if (
    typeof error !== 'object' ||
    error === null
  ) {
    return undefined;
  }

  const candidate =
    error as {
      code?: string;
      constraint?: string;
    };

  if (
    candidate.code !== '23505'
  ) {
    return undefined;
  }

  return candidate.constraint;
}