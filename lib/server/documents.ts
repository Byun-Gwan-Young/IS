import mammoth from "mammoth";
import busboy from "busboy";
import { Readable } from "node:stream";
import type { IncomingHttpHeaders } from "node:http";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { PDFParse } from "pdf-parse";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_EXTRACTED_CHARACTERS = 24_000;

type DocumentKind = "pdf" | "docx" | "txt" | "md";

export class DocumentUploadError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "DocumentUploadError";
    this.status = status;
  }
}

export async function readMultipartDocument(request: Request) {
  if (!request.body) throw new DocumentUploadError("업로드 본문이 비어 있습니다.");
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    throw new DocumentUploadError("multipart/form-data 형식으로 파일을 보내 주세요.");
  }

  let parser: ReturnType<typeof busboy>;
  try {
    parser = busboy({
      headers: Object.fromEntries(request.headers.entries()) as IncomingHttpHeaders,
      preservePath: false,
      limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1, fields: 2, parts: 3, headerPairs: 100 },
    });
  } catch {
    throw new DocumentUploadError("업로드 헤더나 파일 이름이 올바르지 않습니다.");
  }

  const chunks: Buffer[] = [];
  let fileName = "";
  let fileCount = 0;
  let tooLarge = false;
  let invalidPart = false;

  await new Promise<void>((resolve, reject) => {
    parser.on("file", (field, stream, info) => {
      fileCount += 1;
      if (fileCount > 1 || field !== "file") invalidPart = true;
      fileName = info.filename || "";
      stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      stream.on("limit", () => { tooLarge = true; });
      stream.on("error", reject);
    });
    parser.on("field", () => { invalidPart = true; });
    parser.on("filesLimit", () => { invalidPart = true; });
    parser.on("partsLimit", () => { invalidPart = true; });
    parser.on("error", reject);
    parser.on("close", resolve);

    const source = Readable.fromWeb(request.body as unknown as NodeReadableStream);
    request.signal.addEventListener("abort", () => {
      source.destroy(new Error("업로드가 취소되었습니다."));
      parser.destroy();
      reject(new Error("업로드가 취소되었습니다."));
    }, { once: true });
    source.on("error", reject);
    source.pipe(parser);
  });

  if (tooLarge) throw new DocumentUploadError("파일은 10MB 이하로 업로드해 주세요.", 413);
  if (invalidPart || fileCount !== 1 || !fileName) {
    throw new DocumentUploadError("파일 하나만 'file' 항목으로 업로드해 주세요.");
  }
  const buffer = Buffer.concat(chunks);
  if (buffer.length === 0) throw new DocumentUploadError("선택한 파일이 비어 있습니다.");
  return { name: fileName, buffer };
}

function findZipDirectory(buffer: Buffer) {
  const lowerBound = Math.max(0, buffer.length - 65_557);
  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= lowerBound; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0 || eocdOffset + 22 > buffer.length) return null;

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const directorySize = buffer.readUInt32LE(eocdOffset + 12);
  const directoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (entryCount > 2048 || directoryOffset + directorySize > eocdOffset) return null;
  return { entryCount, directoryOffset, directorySize };
}

export function validateDocxContainer(buffer: Buffer) {
  if (buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) return false;
  const directory = findZipDirectory(buffer);
  if (!directory || directory.entryCount === 0) return false;

  let offset = directory.directoryOffset;
  let expandedBytes = 0;
  let hasDocumentXml = false;
  for (let index = 0; index < directory.entryCount; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) return false;
    const flags = buffer.readUInt16LE(offset + 8);
    const compressedBytes = buffer.readUInt32LE(offset + 20);
    const uncompressedBytes = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > buffer.length || (flags & 1) !== 0 || compressedBytes === 0xffffffff || uncompressedBytes === 0xffffffff) return false;

    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8").replace(/\\/g, "/");
    if (name === "word/document.xml") hasDocumentXml = true;
    expandedBytes += uncompressedBytes;
    if (uncompressedBytes > 20 * 1024 * 1024 || expandedBytes > 35 * 1024 * 1024) return false;
    if (compressedBytes > 0 && uncompressedBytes / compressedBytes > 1000) return false;
    offset = end;
  }

  return hasDocumentXml && offset === directory.directoryOffset + directory.directorySize;
}

export function identifyDocument(name: string, buffer: Buffer): DocumentKind | null {
  const extension = name.toLowerCase().split(".").pop();
  if (extension === "pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-" ? "pdf" : null;
  if (extension === "docx") return validateDocxContainer(buffer) ? "docx" : null;
  if (extension === "txt" || extension === "md") {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, Math.min(buffer.length, 64 * 1024)));
      return extension;
    } catch {
      return null;
    }
  }
  return null;
}

export async function extractDocumentText(kind: DocumentKind, buffer: Buffer) {
  let text = "";
  if (kind === "pdf") {
    const parser = new PDFParse({ data: Uint8Array.from(buffer), stopAtErrors: true });
    try {
      const info = await parser.getInfo();
      if (info.total > 100) {
        text = (await parser.getText({ first: 100 })).text;
      } else {
        text = (await parser.getText()).text;
      }
      const normalized = text.replace(/\u0000/g, "").replace(/[\t\f\v ]+/g, " ").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      if (normalized.length < 40) return { text: "", truncated: info.total > 100 };
      return {
        text: normalized.slice(0, MAX_EXTRACTED_CHARACTERS),
        truncated: info.total > 100 || normalized.length > MAX_EXTRACTED_CHARACTERS,
      };
    } finally {
      await parser.destroy();
    }
  } else if (kind === "docx") {
    text = (await mammoth.extractRawText({ buffer })).value;
  } else {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  }

  const normalized = text.replace(/\u0000/g, "").replace(/[\t\f\v ]+/g, " ").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (normalized.length < 40) return { text: "", truncated: false };
  return {
    text: normalized.slice(0, MAX_EXTRACTED_CHARACTERS),
    truncated: normalized.length > MAX_EXTRACTED_CHARACTERS,
  };
}
