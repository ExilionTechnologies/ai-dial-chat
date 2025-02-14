import { Dispatch, SetStateAction, useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import {
  getChildAndCurrentFoldersIdsById,
  validateFolderRenaming,
} from '@/src/utils/app/folders';

import { FolderInterface } from '@/src/types/folder';
import { Translation } from '@/src/types/translation';

import { FilesActions } from '@/src/store/files/files.reducers';
import { useAppDispatch } from '@/src/store/hooks';

/**
 * Custom hook to handle attachment folder operations.
 *
 * @param folders - Array of folders.
 * @param setErrorMessage - Function to set error message.
 * @param openedFoldersIds - Array of opened folders ids.
 * @param setOpenedFoldersIds - Function to set opened folders ids.
 * @param setIsAllFilesOpened - Function to set if all files are opened.
 * @returns Object containing various handlers for folder operations.
 */
export const useHandleFileFolders = (
  folders: FolderInterface[],
  openedFoldersIds: string[],
  setErrorMessage: Dispatch<SetStateAction<string | undefined>>,
  setOpenedFoldersIds: Dispatch<SetStateAction<string[]>>,
  setIsAllFilesOpened: Dispatch<SetStateAction<boolean>>,
) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  /**
   * Handles renaming of a folder.
   *
   * @param newName - New name for the folder.
   * @param folderId - ID of the folder to be renamed.
   */
  const handleRenameFolder = useCallback(
    (newName: string, folderId: string) => {
      const error = validateFolderRenaming(folders, newName, folderId);

      if (error) {
        setErrorMessage(t(error) as string);
        return;
      }

      dispatch(FilesActions.renameFolder({ folderId, newName }));
    },
    [dispatch, folders, setErrorMessage, t],
  );

  /**
   * Handles adding a new folder.
   *
   * @param relativePath - The relative path where the new folder will be added.
   */
  const handleAddFolder = useCallback(
    (relativePath: string) => {
      dispatch(FilesActions.addNewFolder({ relativePath }));

      if (!openedFoldersIds.includes(relativePath)) {
        setOpenedFoldersIds(openedFoldersIds.concat(relativePath));
        dispatch(FilesActions.getFolders({ path: relativePath }));
      }
    },
    [dispatch, openedFoldersIds, setOpenedFoldersIds],
  );

  /**
   * Toggles the state of a folder (open/close).
   *
   * @param folderId - ID of the folder to toggle.
   */
  const handleToggleFolder = useCallback(
    (folderId: string | undefined) => {
      if (!folderId) {
        setIsAllFilesOpened((value) => !value);
        setOpenedFoldersIds([]);
        return;
      }

      if (openedFoldersIds.includes(folderId)) {
        const childFoldersIds = getChildAndCurrentFoldersIdsById(
          folderId,
          folders,
        );
        setOpenedFoldersIds(
          openedFoldersIds.filter((id) => !childFoldersIds.includes(id)),
        );
      } else {
        setOpenedFoldersIds(openedFoldersIds.concat(folderId));
        dispatch(FilesActions.getFilesWithFolders({ path: folderId }));
      }
    },
    [
      dispatch,
      folders,
      openedFoldersIds,
      setIsAllFilesOpened,
      setOpenedFoldersIds,
    ],
  );

  /**
   * Handles the creation of a new folder.
   */
  const handleNewFolder = useCallback(() => {
    dispatch(FilesActions.addNewFolder({}));
    setIsAllFilesOpened(true);
  }, [dispatch, setIsAllFilesOpened]);

  return {
    handleRenameFolder,
    handleAddFolder,
    handleToggleFolder,
    handleNewFolder,
  };
};
