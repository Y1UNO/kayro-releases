import { t, type MessageKey } from "../i18n";
import type { AppError, ErrorCode } from "./bindings";

/** One catalogue entry per error code; a new Rust code breaks the build until it is added. */
export const ERROR_MESSAGE_KEYS: Record<ErrorCode, MessageKey> = {
  validation: "errors.validation",
  notFound: "errors.notFound",
  duplicate: "errors.duplicate",
  io: "errors.io",
  internal: "errors.internal",
  busy: "errors.busy",
  launchNotFound: "errors.launchNotFound",
  launchDenied: "errors.launchDenied",
  elevationRequired: "errors.elevationRequired",
  elevationCancelled: "errors.elevationCancelled",
  launchFailed: "errors.launchFailed",
  hotkeyConflict: "errors.hotkeyConflict",
  updateFailed: "errors.updateFailed",
  downloadFailed: "errors.downloadFailed",
};

/** Text shown to the user (the Rust `message` is for logs only). */
export function errorText(error: AppError): string {
  return t(ERROR_MESSAGE_KEYS[error.code]);
}
