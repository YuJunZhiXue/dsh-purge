import { reapplyInstalled } from "./reapply.js";

const result = await reapplyInstalled();
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exit(result.ok ? 0 : 1);
