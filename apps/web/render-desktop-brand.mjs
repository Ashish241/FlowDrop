import { chromium } from "./node_modules/playwright-core/index.mjs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 64, height: 64 },
    deviceScaleFactor: 2,
  });
  await page.setContent(
    `<style>html,body{margin:0;width:64px;height:64px;overflow:hidden}svg{width:64px;height:64px}</style>${await readFile("public/flowdrop-mark.svg", "utf8")}`,
  );
  await mkdir("../desktop/assets", { recursive: true });
  await page.screenshot({
    path: "../desktop/assets/flowdrop-mark.png",
    omitBackground: true,
  });
} finally {
  await browser.close();
}

const png = await readFile("../desktop/assets/flowdrop-mark.png");
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 128;
header[7] = 128;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
await writeFile("../desktop/assets/flowdrop.ico", Buffer.concat([header, png]));
