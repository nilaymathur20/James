/**
 * Error types and mapping utilities.
 * Backend errors are mapped to user-facing categories per
 * react-native-ui-ux-plan.md §7 and §8.
 */

export type ErrorCategory =
  | 'offline'
  | 'permission_blocked'
  | 'confirmation_required'
  | 'file_changed'
  | 'expired_proposal'
  | 'provider_unavailable'
  | 'invalid_input'
  | 'not_found'
  | 'conflict'
  | 'unknown_error';

export interface AppError extends Error {
  category: ErrorCategory;
  statusCode?: number;
  originalMessage: string;
}

/** Map HTTP status codes + messages to user-facing error categories. */
export function mapHttpError(
  status: number,
  message: string,
): AppError {
  let category: ErrorCategory;

  if (status === 0 || status >= 502) {
    category = 'offline';
  } else if (status === 401 || status === 403) {
    category = 'permission_blocked';
  } else if (status === 404) {
    category = 'not_found';
  } else if (status === 409) {
    // Could be file_changed (409) or expired proposal
    if (/expired|fresh/i.test(message)) {
      category = 'expired_proposal';
    } else {
      category = 'file_changed';
    }
  } else if (status === 410) {
    category = 'expired_proposal';
  } else if (status === 422) {
    category = 'invalid_input';
  } else {
    category = 'unknown_error';
  }

  const error = new Error(message) as AppError;
  error.category = category;
  error.statusCode = status;
  error.originalMessage = message;
  return error;
}

/** Map a WebSocket error code to a user-facing category. */
export function mapWsError(code?: string, message?: string): AppError {
  const statusMessage = message || 'The live connection returned an error.';
  let category: ErrorCategory = 'unknown_error';

  if (code === 'invalid_request' || code === 'invalid_request_id') {
    category = 'invalid_input';
  } else if (code === 'message_too_large' || code === 'invalid_json') {
    category = 'unknown_error';
  } else {
    category = 'unknown_error';
  }

  const error = new Error(statusMessage) as AppError;
  error.category = category;
  error.statusCode = code ? undefined : undefined;
  error.originalMessage = statusMessage;
  return error;
}

export function getErrorLabel(category: ErrorCategory): string {
  switch (category) {
    case 'offline':
      return 'Backend unavailable';
    case 'permission_blocked':
      return 'Permission blocked';
    case 'confirmation_required':
      return 'Confirmation required';
    case 'file_changed':
      return 'File changed';
    case 'expired_proposal':
      return 'Proposal expired';
    case 'provider_unavailable':
      return 'Provider unavailable';
    case 'invalid_input':
      return 'Invalid input';
    case 'not_found':
      return 'Not found';
    case 'conflict':
      return 'Conflict';
    default:
      return 'Something went wrong';
  }
}
