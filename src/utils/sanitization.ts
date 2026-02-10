export function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

export function unescapeHtml(text: string): string {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = text;
  return tempDiv.textContent || tempDiv.innerText || "";
}

export function stripFormattedTextWrapper(value: string): string {
  if (!value.includes("<")) {
    return value;
  }

  const wrapperMatch = value.match(/^<(\w+)[^>]*>(.*)<\/\1>$/s);
  if (wrapperMatch) {
    const innerContent = wrapperMatch[2].trim();
    return unescapeHtml(innerContent);
  }

  return value;
}
