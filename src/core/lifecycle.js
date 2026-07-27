import { runChecked } from "./process.js";

export async function runLifecycleCommands(commands, cwd) {
  for (const command of commands) {
    if (process.platform === "win32") {
      await runChecked("cmd.exe", ["/d", "/s", "/c", command], { cwd, inherit: true });
    } else {
      await runChecked("sh", ["-lc", command], { cwd, inherit: true });
    }
  }
}
