export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function createBlobFromBuffer(buffer: ArrayBuffer, type: string): Blob {
  return new Blob([buffer], { type });
}
