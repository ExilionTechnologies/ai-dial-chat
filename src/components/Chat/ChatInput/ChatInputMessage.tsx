import {
  KeyboardEvent,
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { usePromptSelection } from '@/src/hooks/usePromptSelection';

import { getUserCustomContent } from '@/src/utils/app/file';
import { isMobile } from '@/src/utils/app/mobile';
import { getPromptLimitDescription } from '@/src/utils/app/modals';

import { Message, Role } from '@/src/types/chat';
import { Feature } from '@/src/types/features';
import { DialFile } from '@/src/types/files';
import { OpenAIEntityModels, defaultModelLimits } from '@/src/types/openai';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';

import { ScrollDownButton } from '../../Common/ScrollDownButton';
import { AttachButton } from '../../Files/AttachButton';
import { ChatInputAttachments } from './ChatInputAttachments';
import { PromptDialog } from './PromptDialog';
import { PromptList } from './PromptList';
import { SendMessageButton } from './SendMessageButton';

interface Props {
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  showScrollDownButton: boolean;
  onScrollDownClick: () => void;
  onSend: (message: Message) => void;
}

const MAX_HEIGHT = 320;

export const ChatInputMessage = ({
  textareaRef,
  showScrollDownButton,
  onScrollDownClick,
  onSend,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [showPluginSelect, setShowPluginSelect] = useState(false);

  const isIframe = useAppSelector(SettingsSelectors.selectIsIframe);
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const isReplay = useAppSelector(
    ConversationsSelectors.selectIsReplaySelectedConversations,
  );
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const selectedFiles = useAppSelector(FilesSelectors.selectSelectedFiles);
  const isUploadingFilePresent = useAppSelector(
    FilesSelectors.selectIsUploadingFilePresent,
  );

  const maximumAttachmentsAmount = useAppSelector(
    ConversationsSelectors.selectMaximumAttachmentsAmount,
  );
  const displayAttachFunctionality =
    enabledFeatures.has(Feature.InputFiles) && maximumAttachmentsAmount > 0;
  const attachedFilesIds = useAppSelector(
    FilesSelectors.selectSelectedFilesIds,
  );

  const isMessageError = useAppSelector(
    ConversationsSelectors.selectIsMessagesError,
  );
  const isLastAssistantMessageEmpty = useAppSelector(
    ConversationsSelectors.selectIsLastAssistantMessageEmpty,
  );
  const notModelConversations = useAppSelector(
    ConversationsSelectors.selectNotModelConversations,
  );
  const isModelsLoaded = useAppSelector(ModelsSelectors.selectIsModelsLoaded);
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);

  const isError =
    isLastAssistantMessageEmpty || (isMessageError && notModelConversations);

  const maxLength = useMemo(() => {
    const maxLengthArray = selectedConversations.map(
      ({ model }) =>
        modelsMap[model.id]?.maxLength ??
        OpenAIEntityModels[model.id]?.maxLength ??
        defaultModelLimits.maxLength,
    );

    return Math.min(...maxLengthArray);
  }, [modelsMap, selectedConversations]);

  const {
    content,
    setContent,
    activePromptIndex,
    setActivePromptIndex,
    isModalVisible,
    setIsModalVisible,
    isPromptLimitModalOpen,
    setIsPromptLimitModalOpen,
    showPromptList,
    setShowPromptList,
    updatePromptListVisibility,
    handleInitModal,
    filteredPrompts,
    variables,
    handleKeyDownIfShown,
  } = usePromptSelection(maxLength);

  const isInputEmpty = useMemo(() => {
    return content.trim().length === 0 && selectedFiles.length === 0;
  }, [content, selectedFiles.length]);
  const isSendDisabled =
    messageIsStreaming ||
    isReplay ||
    isError ||
    isInputEmpty ||
    !isModelsLoaded ||
    isUploadingFilePresent;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;

      if (maxLength && value.length > maxLength) {
        setIsPromptLimitModalOpen(true);
        return;
      }

      setContent(value);
      updatePromptListVisibility(value);
    },
    [
      maxLength,
      setContent,
      setIsPromptLimitModalOpen,
      updatePromptListVisibility,
    ],
  );

  const handleSend = useCallback(() => {
    if (isSendDisabled) {
      return;
    }

    onSend({
      role: Role.User,
      content,
      custom_content: getUserCustomContent(selectedFiles),
    });
    dispatch(FilesActions.resetSelectedFiles());
    setContent('');

    if (window.innerWidth < 640 && textareaRef && textareaRef.current) {
      textareaRef.current.blur();
    }
  }, [
    isSendDisabled,
    onSend,
    content,
    selectedFiles,
    dispatch,
    setContent,
    textareaRef,
  ]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (showPromptList && filteredPrompts.length > 0) {
        handleKeyDownIfShown(e);
      } else if (e.key === 'Enter' && !isTyping && !isMobile() && !e.shiftKey) {
        e.preventDefault();
        if (isReplay) {
          return;
        }
        handleSend();
      } else if (e.key === '/' && e.metaKey) {
        e.preventDefault();
        setShowPluginSelect(!showPluginSelect);
      }
    },
    [
      handleKeyDownIfShown,
      handleSend,
      isReplay,
      isTyping,
      showPluginSelect,
      showPromptList,
      filteredPrompts,
    ],
  );

  const handleSubmit = useCallback(
    (updatedVariables: string[]) => {
      const newContent = content.replace(/{{(.*?)}}/g, (match, variable) => {
        const index = variables.indexOf(variable);
        return updatedVariables[index];
      });

      setContent(newContent);

      if (textareaRef && textareaRef.current) {
        textareaRef.current.focus();
      }
    },
    [content, setContent, textareaRef, variables],
  );

  useEffect(() => {
    if (textareaRef && textareaRef.current) {
      textareaRef.current.style.height = 'inherit'; // reset height
      const scrollHeight = textareaRef.current.scrollHeight; // then check scroll height
      textareaRef.current.style.height = `${scrollHeight}px`;
      textareaRef.current.style.overflow = `${
        scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden'
      }`;
    }
  }, [content, textareaRef]);

  const handleUnselectFile = useCallback(
    (fileId: string) => {
      dispatch(FilesActions.unselectFiles({ ids: [fileId] }));
    },
    [dispatch],
  );

  const handleRetry = useCallback(
    (fileId: string) => {
      dispatch(FilesActions.reuploadFile({ fileId }));
    },
    [dispatch],
  );

  const handleSelectAlreadyUploaded = useCallback(
    (result: unknown) => {
      if (typeof result === 'object') {
        const selectedFilesIds = result as string[];
        dispatch(FilesActions.resetSelectedFiles());
        dispatch(
          FilesActions.selectFiles({
            ids: selectedFilesIds,
          }),
        );
      }
    },
    [dispatch],
  );

  const handleUploadFromDevice = useCallback(
    (
      selectedFiles: Required<Pick<DialFile, 'fileContent' | 'id' | 'name'>>[],
      folderPath: string | undefined,
    ) => {
      selectedFiles.forEach((file) => {
        dispatch(
          FilesActions.uploadFile({
            fileContent: file.fileContent,
            id: file.id,
            relativePath: folderPath,
            name: file.name,
          }),
        );
      });
      dispatch(
        FilesActions.selectFiles({
          ids: selectedFiles.map(({ id }) => id),
        }),
      );
    },
    [dispatch],
  );

  const tooltipContent = (): string => {
    if (messageIsStreaming) {
      return t(
        'Please wait for full assistant answer to continue working with chat',
      );
    }
    if (!isModelsLoaded) {
      return t(
        'Please wait for models will be loaded to continue working with chat',
      );
    }
    if (isReplay) {
      return t('Please continue replay to continue working with chat');
    }
    if (isError) {
      return t('Please regenerate response to continue working with chat');
    }
    if (isUploadingFilePresent) {
      return t('Please wait for the attachment to load');
    }
    return t('Please type a message');
  };

  return (
    <div
      className={classNames(
        'mx-2 mb-2 flex flex-row gap-3 md:mx-4 md:mb-0  md:last:mb-6',
        isChatFullWidth ? 'lg:ml-20 lg:mr-[84px]' : 'lg:mx-auto lg:max-w-3xl',
      )}
    >
      <div
        className="relative m-0 flex max-h-[400px] min-h-[40px] w-full grow flex-col rounded bg-layer-3 focus-within:border-accent-primary"
        data-qa="message"
      >
        <textarea
          ref={textareaRef}
          className={classNames(
            'm-0 min-h-[40px] w-full grow resize-none bg-transparent py-3 pr-10 outline-none placeholder:text-secondary',
            displayAttachFunctionality ? 'pl-12' : 'pl-4',
          )}
          style={{ maxHeight: `${MAX_HEIGHT}px` }}
          placeholder={
            isIframe
              ? t('Type a message') || ''
              : t('Type a message or type "/" to select a prompt...') || ''
          }
          value={content}
          rows={1}
          onCompositionStart={() => setIsTyping(true)}
          onCompositionEnd={() => setIsTyping(false)}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />

        <SendMessageButton
          handleSend={handleSend}
          isDisabled={isSendDisabled}
          tooltip={tooltipContent()}
        />

        {displayAttachFunctionality && (
          <>
            <div className="absolute left-4 top-[calc(50%_-_12px)] rounded disabled:cursor-not-allowed">
              <AttachButton
                selectedFilesIds={attachedFilesIds}
                onSelectAlreadyUploaded={handleSelectAlreadyUploaded}
                onUploadFromDevice={handleUploadFromDevice}
              />
            </div>
            {selectedFiles.length > 0 && (
              <div className="mb-2.5 flex max-h-[100px] flex-col gap-1 overflow-auto px-12 md:grid md:grid-cols-3">
                <ChatInputAttachments
                  files={selectedFiles}
                  onUnselectFile={handleUnselectFile}
                  onRetryFile={handleRetry}
                />
              </div>
            )}
          </>
        )}

        {showScrollDownButton && (
          <ScrollDownButton
            className="-top-14 right-0 xl:right-2 2xl:bottom-0 2xl:right-[-60px] 2xl:top-auto"
            onScrollDownClick={onScrollDownClick}
          />
        )}

        {showPromptList && filteredPrompts.length > 0 && (
          <div className="absolute bottom-12 w-full">
            <PromptList
              activePromptIndex={activePromptIndex}
              prompts={filteredPrompts}
              onSelect={handleInitModal}
              onMouseEnter={setActivePromptIndex}
              isOpen={showPromptList && filteredPrompts.length > 0}
              onClose={() => setShowPromptList(false)}
            />
          </div>
        )}

        {isModalVisible && (
          <PromptDialog
            prompt={filteredPrompts[activePromptIndex]}
            variables={variables}
            onSubmit={handleSubmit}
            onClose={() => setIsModalVisible(false)}
          />
        )}
      </div>

      <ConfirmDialog
        isOpen={isPromptLimitModalOpen}
        heading={t('Prompt limit exceeded')}
        description={
          t(
            `Prompt limit is ${maxLength} characters. 
            ${getPromptLimitDescription(content, maxLength)}`,
          ) || ''
        }
        confirmLabel={t('Confirm')}
        onClose={() => {
          setIsPromptLimitModalOpen(false);
        }}
      />
    </div>
  );
};
