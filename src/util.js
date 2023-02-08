import { createHash } from "node:crypto";

export function md5Of(data) {
  return createHash("md5").update(data).digest("hex");
}

export function sha256Of(data) {
  return createHash("sha256").update(data).digest("hex");
}
