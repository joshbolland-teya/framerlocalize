import { framer } from "framer-plugin";
import { NotificationVariant } from "../types";

export function notify(
  message: string,
  variant: NotificationVariant = "info",
): void {
  try {
    framer.notify(message, { variant });
  } catch {
    console.log(`[${variant}] ${message}`);
  }
}
