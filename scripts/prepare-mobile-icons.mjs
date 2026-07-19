import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mobileAssetsDir = path.join(projectRoot, "apps/mobile/assets");
const sharedIconPath = path.join(projectRoot, "apps/web/public/pwa-512x512.png");
const mobileIconPath = path.join(mobileAssetsDir, "icon.png");
const adaptiveIconSourcePath = path.join(mobileAssetsDir, "adaptive-icon-foreground.svg");
const adaptiveIconPath = path.join(mobileAssetsDir, "adaptive-icon-foreground.png");

await mkdir(mobileAssetsDir, { recursive: true });
await copyFile(sharedIconPath, mobileIconPath);
await sharp(adaptiveIconSourcePath, { density: 384 })
  .resize(1024, 1024)
  .png()
  .toFile(adaptiveIconPath);

console.log("已同步 Android 图标资源");
