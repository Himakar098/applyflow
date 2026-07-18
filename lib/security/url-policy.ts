export function isCredentialFreeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function publicUrlForLog(value: URL) {
  return `${value.origin}${value.pathname}`.slice(0, 2_000);
}
