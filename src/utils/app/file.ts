import { Attachment } from '@/src/types/chat';
import { DialFile } from '@/src/types/files';

export function triggerDownload(url: string, name: string): void {
  const link = document.createElement('a');
  link.download = name;
  link.href = url;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const getPathNameId = (name: string, relativePath?: string): string => {
  return [relativePath, name].filter(Boolean).join('/');
};

export const getRelativePath = (
  absolutePath: string | undefined,
): string | undefined => {
  // '/users/asd/files/folder-1/folder-2' -> folder-1/folder-2
  return absolutePath?.split('/').toSpliced(0, 4).join('/') || undefined;
};

export const getUserCustomContent = (
  files: Pick<DialFile, 'contentType' | 'absolutePath' | 'name' | 'status'>[],
) => {
  if (files.length === 0) {
    return undefined;
  }

  return {
    custom_content: {
      attachments: files
        .filter(
          (file) => file.status !== 'FAILED' && file.status !== 'UPLOADING',
        )
        .map((file) => ({
          type: file.contentType,
          title: file.name,
          url: encodeURI(`${file.absolutePath}/${file.name}`),
        })),
    },
  };
};

export const getDialFilesWithInvalidFileType = (
  files: DialFile[],
  allowedFileTypes: string[],
): DialFile[] => {
  return allowedFileTypes.includes('*/*')
    ? []
    : files.filter((file) => !allowedFileTypes.includes(file.contentType));
};

export const getDialFilesWithInvalidFileSize = (
  files: DialFile[],
  sizeLimit: number,
): DialFile[] => {
  return files.filter((file) => file.contentLength > sizeLimit);
};

export const getFilesWithInvalidFileType = (
  files: File[],
  allowedFileTypes: string[],
): File[] => {
  return allowedFileTypes.includes('*/*')
    ? []
    : files.filter((file) => !allowedFileTypes.includes(file.type));
};

export const getFilesWithInvalidFileSize = (
  files: File[],
  sizeLimit: number,
): File[] => {
  return files.filter((file) => file.size > sizeLimit);
};

const parseAttachmentUrl = (url: string) => {
  const lastIndexSlash = url.lastIndexOf('/');
  const decodedUrl = decodeURI(url);
  return {
    absolutePath: decodedUrl.slice(0, lastIndexSlash),
    name: decodedUrl.slice(lastIndexSlash + 1),
  };
};

export const getDialFilesFromAttachments = (
  attachments: Attachment[] | undefined,
): Omit<DialFile, 'contentLength'>[] => {
  if (!attachments) {
    return [];
  }

  return attachments
    .map((attachment): Omit<DialFile, 'contentLength'> | null => {
      if (!attachment.url?.startsWith('/')) {
        return null;
      }

      const { absolutePath, name } = parseAttachmentUrl(attachment.url);
      const relativePath = getRelativePath(absolutePath);

      return {
        id: getPathNameId(name, relativePath),
        name,
        contentType: attachment.type,
        absolutePath: absolutePath,
      };
    })
    .filter(Boolean) as Omit<DialFile, 'contentLength'>[];
};
