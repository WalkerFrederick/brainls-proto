/** UploadThing domain patterns — only images from these hosts are permitted. */
const ALLOWED_IMAGE_HOSTS = [/\.ufs\.sh$/, /^utfs\.io$/];

export function isAllowedImageUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_IMAGE_HOSTS.some((re) => re.test(hostname));
  } catch {
    return false;
  }
}

/**
 * Removes markdown image references (`![alt](url)`) whose URL
 * doesn't point to an allowed UploadThing host.
 * Preserves alt text as plain text so the user doesn't lose it silently.
 */
export function stripDisallowedImages(text: string): string {
  return text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, _alt, url) => {
    return isAllowedImageUrl(url) ? match : "";
  });
}
