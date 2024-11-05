import { basename, dirname, join } from "jsr:@std/path";
import { sprintf } from "jsr:@std/fmt/printf";
import { parseArgs } from "jsr:@std/cli/parse-args";
import {
  type Degrees,
  degrees,
  PDFDocument,
  PDFPage,
} from "https://cdn.skypack.dev/pdf-lib?dts";

import fontkit from "https://cdn.skypack.dev/@pdf-lib/fontkit?dts";

const withSuffix = (path: string, suffix: string): string => {
  const parts = path.split(".");
  const extension = parts.pop() || "pdf";
  return parts.join(".") + suffix + "." + extension;
};

const getRoot = (): string => {
  const p = Deno.execPath();
  if (p.endsWith(join("deno", "current", "deno.exe"))) {
    return Deno.cwd();
  }
  return dirname(p);
};

const getFonts = async (): Promise<string[]> => {
  const names: string[] = [];
  const d = getRoot();
  for await (const dirEntry of Deno.readDir(d)) {
    const n = dirEntry.name;
    if (n.endsWith(".ttf")) {
      names.push(join(d, n));
    }
  }
  return names;
};

interface OverlayResult {
  Returncode: number;
  Count: number;
}

interface TextPosition {
  x: number;
  y: number;
  rotation: Degrees;
}

const getTextPosition = (page: PDFPage, em: number): TextPosition => {
  const mbox = page.getMediaBox();
  const width = page.getWidth();
  const height = page.getHeight();
  let a = page.getRotation().angle;
  if (a < 0) {
    a = 360 + a;
  }
  const u = Math.round(a / 90);
  if (u == 1) {
    return {
      x: mbox.x + width,
      y: mbox.y + em,
      rotation: degrees(180),
    };
  }
  if (u == 2) {
    return {
      x: mbox.x + width - em,
      y: mbox.y + height,
      rotation: degrees(-90),
    };
  }
  if (u == 3) {
    return {
      x: mbox.x + 0,
      y: mbox.y + height - em,
      rotation: degrees(0),
    };
  }
  return {
    x: mbox.x + em,
    y: mbox.y + 0,
    rotation: degrees(90),
  };
};

const overlay = async (
  path: string,
  text: string,
  start: number,
  nombre: boolean,
): Promise<OverlayResult> => {
  const fonts = await getFonts();
  if (fonts.length < 1) {
    console.log("cannot find font file (.ttf) in the same directory as exe.");
    return { Returncode: 1, Count: 0 };
  }

  const data = await Deno.readFile(path);
  const srcDoc = await PDFDocument.load(data);
  const outDoc = await PDFDocument.create();
  const range = srcDoc.getPageIndices();
  const pages = await outDoc.copyPages(srcDoc, range);

  if (text.trim().length < 1) {
    text = basename(path);
  }

  const fontsize = 9;
  outDoc.registerFontkit(fontkit);
  const fontData = await outDoc.embedFont(
    Deno.readFileSync(fonts[0]),
  );

  pages.forEach((page: PDFPage, idx: number) => {
    const watermark = nombre
      ? sprintf("%s(p.%03d)  ", text, start + idx)
      : text + "  ";
    const added = outDoc.addPage(page);

    const tPos = getTextPosition(page, fontsize);
    added.drawText(watermark.repeat(100), {
      font: fontData,
      x: tPos.x,
      y: tPos.y,
      rotate: tPos.rotation,
      size: fontsize,
      opacity: 0.4,
    });
  });

  const bytes = await outDoc.save();
  const outPath = withSuffix(path, "_watermarked");
  await Deno.writeFile(outPath, bytes);
  return { Returncode: 0, Count: pages.length };
};

const main = async () => {
  const flags = parseArgs(Deno.args, {
    string: ["path", "text", "start"],
    boolean: ["nombre"],
    default: {
      path: "",
      text: "",
      start: "1",
      nombre: false,
    },
  });
  if (isNaN(Number(flags.start))) {
    console.log("invalid arg:", flags.start);
    Deno.exit(1);
  }
  const result = await overlay(
    flags.path,
    flags.text,
    Number(flags.start),
    flags.nombre,
  );
  console.log(result.Count);
  Deno.exit(result.Returncode);
};

main();
