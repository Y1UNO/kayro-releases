import type { AppError } from "../../ipc/bindings";
import { errorText } from "../../ipc/errors";
import type { CoreRefusal } from "./ManualForm";
import { fieldOfCoreError } from "./validation";

/** A refusal from the core as the form shows it: a duplicate is about the target. */
export function refusalOf(error: AppError): CoreRefusal {
  return {
    field: error.code === "duplicate" ? "target" : fieldOfCoreError(error.field),
    message: errorText(error),
  };
}
