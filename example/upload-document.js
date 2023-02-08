import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fileList, login, uploadFile } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

(async () => {
  const email = process.env.SUPERNOTE_CLOUD_EMAIL;
  const password = process.env.SUPERNOTE_CLOUD_PASSWORD;

  if (!email || !password) {
    console.error("Missing email or password environment variables");
    process.exit(1);
  }

  const token = await login(email, password);
  const folders = await fileList(token);
  const [documentFolder] = folders.filter(
    ({ fileName }) => fileName === "Document"
  );

  await uploadFile(token, join(__dirname, "example.pdf"), documentFolder.id);
})();
