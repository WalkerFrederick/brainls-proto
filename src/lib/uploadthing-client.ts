import { generateReactHelpers } from "@uploadthing/react";
import type { AppFileRouter } from "@/lib/uploadthing";

export const { useUploadThing, uploadFiles } = generateReactHelpers<AppFileRouter>();
