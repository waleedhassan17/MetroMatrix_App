// The text AuthErrorNotice shows for an error: app copy (errorCopy), the
// fields VALIDATION_FAILED names, or the server's own message. Pure, so it is
// unit-tested without rendering.

import { ERROR_CODES, errorCopy, fieldErrors } from '../../networks/network/apiHelpers';
import type { ServerError } from '../../screens/Auth/shared/formStatus';

export const authErrorMessage = (error: ServerError): string => {
  if (error.code === ERROR_CODES.VALIDATION_FAILED) {
    const fields = Object.values(fieldErrors(error.details));
    if (fields.length) return fields.join('\n');
  }
  return errorCopy(error.code, error.details) ?? error.message;
};
