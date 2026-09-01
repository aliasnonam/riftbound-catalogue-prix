import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const isWindows = process.platform === "win32";
const gradle = isWindows ? "gradlew.bat" : "./gradlew";

if (!existsSync(join("android", isWindows ? "gradlew.bat" : "gradlew"))) {
  throw new Error("Le projet Android est absent. Lance d'abord : npm run android:sync");
}

execFileSync(gradle, ["assembleDebug"], { stdio: "inherit", cwd: "android", shell: isWindows });
console.log("\nAPK créée : android/app/build/outputs/apk/debug/app-debug.apk");
