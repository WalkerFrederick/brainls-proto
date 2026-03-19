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
