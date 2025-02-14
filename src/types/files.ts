import { FolderInterface } from './folder';

export type ImageMIMEType = 'image/jpeg' | 'image/png' | string;

export type MIMEType =
  | 'text/markdown'
  | 'text/plain'
  | 'text/html'
  | ImageMIMEType
  | string;

export enum BackendDataNodeType {
  ITEM = 'ITEM',
  FOLDER = 'FOLDER',
}

interface BackendDataEntity {
  name: string;
  nodeType: BackendDataNodeType;
  resourceType: 'FILE'; // only 1 type for now
  bucket: string;
  parentPath: string | null | undefined;
}

export interface BackendFile extends BackendDataEntity {
  nodeType: BackendDataNodeType.ITEM;
  contentLength: number;
  contentType: MIMEType;
}
export interface BackendFileFolder extends BackendDataEntity {
  nodeType: BackendDataNodeType.FOLDER;
  items: (BackendFile | BackendFileFolder)[];
}

export type DialFile = Omit<
  BackendFile,
  'path' | 'nodeType' | 'resourceType' | 'bucket' | 'parentPath'
> & {
  // Combination of relative path and name
  id: string;
  // Only for files fetched uploaded to backend
  // Same as relative path but has some absolute prefix like <HASH>
  absolutePath?: string;
  relativePath?: string;
  // Same as relative path, but needed for simplicity and backward compatibility
  folderId?: string;

  status?: 'UPLOADING' | 'FAILED';
  percent?: number;
  fileContent?: File;
  serverSynced?: boolean;
};

// For file folders folderId is relative path and id is relative path + '/' + name
export type FileFolderInterface = FolderInterface & {
  absolutePath?: string;
  relativePath?: string;
};
