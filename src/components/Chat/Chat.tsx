import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { clearStateForMessages } from '@/src/utils/app/clear-messages-state';
import { throttle } from '@/src/utils/data/throttle';

import { OpenAIEntityModelID } from '../../types/openai';
import {
  Conversation,
  ConversationsTemporarySettings,
  MergedMessages,
  Message,
  Replay,
  Role,
} from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { Feature } from '@/src/types/features';

import {
  AddonsActions,
  AddonsSelectors,
} from '@/src/store/addons/addons.reducers';
import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';
import { PromptsSelectors } from '@/src/store/prompts/prompts.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { DEFAULT_ASSISTANT_SUBMODEL } from '@/src/constants/default-settings';

import { ChatCompareRotate } from './ChatCompareRotate';
import { ChatCompareSelect } from './ChatCompareSelect';
import ChatExternalControls from './ChatExternalControls';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput/ChatInput';
import ChatReplayControls from './ChatReplayControls';
import { ChatSettings } from './ChatSettings';
import { ChatSettingsEmpty } from './ChatSettingsEmpty';
import { ErrorMessageDiv } from './ErrorMessageDiv';
import { MemoizedChatMessage } from './MemoizedChatMessage';
import { NotAllowedModel } from './NotAllowedModel';
import { PlaybackControls } from './Playback/PlaybackControls';
import { PlaybackEmptyInfo } from './Playback/PlaybackEmptyInfo';

const scrollThrottlingTimeout = 250;

export const Chat = memo(() => {
  const dispatch = useAppDispatch();
  const appName = useAppSelector(SettingsSelectors.selectAppName);
  const models = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const modelError = useAppSelector(ModelsSelectors.selectModelsError);
  const isModelsLoaded = useAppSelector(ModelsSelectors.selectIsModelsLoaded);
  const defaultModelId = useAppSelector(SettingsSelectors.selectDefaultModelId);
  const addons = useAppSelector(AddonsSelectors.selectAddons);
  const addonsMap = useAppSelector(AddonsSelectors.selectAddonsMap);
  const isCompareMode = useAppSelector(UISelectors.selectIsCompareMode);
  const selectedConversationsIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  const isReplay = useAppSelector(
    ConversationsSelectors.selectIsReplaySelectedConversations,
  );
  const isReplayPaused = useAppSelector(
    ConversationsSelectors.selectIsReplayPaused,
  );
  const isExternal = useAppSelector(
    ConversationsSelectors.selectAreSelectedConversationsExternal,
  );

  const isPlayback = useAppSelector(
    ConversationsSelectors.selectIsPlaybackSelectedConversations,
  );

  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
  const [showScrollDownButton, setShowScrollDownButton] =
    useState<boolean>(false);
  const [mergedMessages, setMergedMessages] = useState<MergedMessages[]>([]);
  const [isShowChatSettings, setIsShowChatSettings] = useState(false);
  const selectedConversationsTemporarySettings = useRef<
    Record<string, ConversationsTemporarySettings>
  >({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const nextMessageBoxRef = useRef<HTMLDivElement | null>(null);
  const [inputHeight, setInputHeight] = useState<number>(142);
  const [notAllowedType, setNotAllowedType] = useState<EntityType | null>(null);
  const disableAutoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const showReplayControls = useMemo(() => {
    return isReplay && !messageIsStreaming && isReplayPaused;
  }, [isReplay, isReplayPaused, messageIsStreaming]);

  const isNotEmptyConversations = selectedConversations.some(
    (conv) => conv.messages.length > 0,
  );

  useEffect(() => {
    setIsShowChatSettings(false);

    if (selectedConversations.length > 0) {
      const mergedMessages: MergedMessages[] = [];
      for (let i = 0; i < selectedConversations[0].messages.length; i++) {
        if (selectedConversations[0].messages[i].role === Role.System) continue;

        mergedMessages.push(
          selectedConversations.map((conv) => [
            conv,
            conv.messages[i] || { role: Role.Assistant, content: '' },
            i,
          ]),
        );
      }
      setMergedMessages([...mergedMessages]);
    }

    if (selectedConversations.some((conv) => conv.messages.length === 0)) {
      setShowScrollDownButton(false);
    }
  }, [selectedConversations]);

  useEffect(() => {
    const modelIds = models.map((model) => model.id);
    const isNotAllowedModel =
      isModelsLoaded &&
      (models.length === 0 ||
        selectedConversations.some((conv) => {
          if (
            conv.replay.isReplay &&
            conv.replay.replayAsIs &&
            conv.replay.replayUserMessagesStack &&
            conv.replay.replayUserMessagesStack[0].model
          ) {
            return conv.replay.replayUserMessagesStack.some(
              (message) =>
                message.role === Role.User &&
                message.model?.id &&
                !modelIds.includes(message.model.id),
            );
          }
          return !modelIds.includes(conv.model.id);
        }));
    if (isNotAllowedModel) {
      setNotAllowedType(EntityType.Model);
    } else if (
      selectedConversations.some((conversation) =>
        conversation.selectedAddons.some((addonId) => !addonsMap[addonId]),
      )
    ) {
      setNotAllowedType(EntityType.Addon);
    } else {
      setNotAllowedType(null);
    }
  }, [selectedConversations, models, isModelsLoaded, addonsMap]);

  const onLikeHandler = useCallback(
    (index: number, conversation: Conversation) => (rate: number) => {
      dispatch(
        ConversationsActions.rateMessage({
          conversationId: conversation.id,
          messageIndex: index,
          rate,
        }),
      );
    },
    [dispatch],
  );

  const setAutoScroll = () => {
    clearTimeout(disableAutoScrollTimeoutRef.current);
    setAutoScrollEnabled(true);
    setShowScrollDownButton(false);
  };

  const scrollDown = useCallback(
    (force = false) => {
      if (autoScrollEnabled || force) {
        setAutoScroll();
        chatContainerRef.current?.scrollTo({
          top: chatContainerRef.current.scrollHeight,
        });
      }
    },
    [autoScrollEnabled],
  );

  useEffect(() => {
    scrollDown();
    textareaRef.current?.focus();
  }, [scrollDown]);

  const throttledScrollDown = throttle<boolean, typeof scrollDown>(
    scrollDown,
    scrollThrottlingTimeout,
  );

  useEffect(() => {
    throttledScrollDown();
  }, [conversations, throttledScrollDown]);

  const handleScrollDown = useCallback(() => {
    scrollDown(true);
  }, [scrollDown]);

  const handleScroll = useCallback(() => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        chatContainerRef.current;
      const bottomTolerance = 30;

      if (scrollTop + clientHeight < scrollHeight - bottomTolerance) {
        clearTimeout(disableAutoScrollTimeoutRef.current);
        disableAutoScrollTimeoutRef.current = setTimeout(() => {
          setAutoScrollEnabled(false);
          setShowScrollDownButton(true);
        }, scrollThrottlingTimeout);
      } else {
        setAutoScroll();
      }
    }
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setAutoScrollEnabled(entry.isIntersecting);
        if (entry.isIntersecting) {
          textareaRef.current?.focus();
        }
      },
      {
        threshold: 0.1,
      },
    );
    const messagesEndElement = messagesEndRef.current;
    if (messagesEndElement) {
      observer.observe(messagesEndElement);
    }
    return () => {
      if (messagesEndElement) {
        observer.unobserve(messagesEndElement);
      }
    };
  }, [messagesEndRef]);

  const handleClearConversation = useCallback(
    (conversation: Conversation) => {
      if (conversation) {
        const { messages } = conversation;

        dispatch(
          ConversationsActions.updateConversation({
            id: conversation.id,
            values: {
              messages: messages.filter(
                (message) => message.role === Role.System,
              ),
            },
          }),
        );
      }
    },
    [dispatch],
  );

  const handleReplayStart = useCallback(() => {
    dispatch(
      ConversationsActions.replayConversations({
        conversationsIds: selectedConversationsIds,
      }),
    );
  }, [selectedConversationsIds, dispatch]);

  const handleReplayReStart = useCallback(() => {
    dispatch(
      ConversationsActions.replayConversations({
        conversationsIds: selectedConversationsIds,
        isRestart: true,
      }),
    );
  }, [dispatch, selectedConversationsIds]);

  const handleSelectModel = useCallback(
    (conversation: Conversation, modelId: string) => {
      const newAiEntity = modelsMap[modelId];
      if (!newAiEntity) {
        return;
      }

      const updatedReplay: Replay = !conversation.replay.isReplay
        ? conversation.replay
        : {
            ...conversation.replay,
            replayAsIs: false,
          };
      const updatedAddons =
        conversation.replay.isReplay &&
        conversation.replay.replayAsIs &&
        !updatedReplay.replayAsIs
          ? conversation.selectedAddons.filter((addonId) => addonsMap[addonId])
          : conversation.selectedAddons;

      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: {
            model: { id: modelId },
            assistantModelId:
              newAiEntity.type === EntityType.Assistant
                ? DEFAULT_ASSISTANT_SUBMODEL.id
                : undefined,
            replay: updatedReplay,
            selectedAddons: updatedAddons,
          },
        }),
      );
    },
    [addonsMap, dispatch, modelsMap],
  );

  const handleSelectAssistantSubModel = useCallback(
    (conversation: Conversation, modelId: string) => {
      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: { assistantModelId: modelId },
        }),
      );
    },
    [dispatch],
  );

  const handleOnChangeAddon = useCallback(
    (conversation: Conversation, addonId: string) => {
      const isAddonInConversation = conversation.selectedAddons.some(
        (id) => id === addonId,
      );
      if (isAddonInConversation) {
        const filteredAddons = conversation.selectedAddons.filter(
          (id) => id !== addonId,
        );
        dispatch(
          ConversationsActions.updateConversation({
            id: conversation.id,
            values: { selectedAddons: filteredAddons },
          }),
        );
      } else {
        dispatch(
          ConversationsActions.updateConversation({
            id: conversation.id,
            values: {
              selectedAddons: conversation.selectedAddons.concat(addonId),
            },
          }),
        );
      }
    },
    [dispatch],
  );

  const handleOnApplyAddons = useCallback(
    (conversation: Conversation, addonIds: string[]) => {
      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: {
            selectedAddons: addonIds.filter((addonId) => addonsMap[addonId]),
          },
        }),
      );
    },
    [addonsMap, dispatch],
  );

  const handleChangePrompt = useCallback(
    (conversation: Conversation, prompt: string) => {
      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: { prompt },
        }),
      );
    },
    [dispatch],
  );

  const handleChangeTemperature = useCallback(
    (conversation: Conversation, temperature: number) => {
      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: { temperature },
        }),
      );
    },
    [dispatch],
  );

  const handleDeleteMessage = useCallback(
    (index: number) => {
      dispatch(ConversationsActions.deleteMessage({ index }));
    },
    [dispatch],
  );

  const onSendMessage = useCallback(
    (message: Message) => {
      dispatch(
        ConversationsActions.sendMessages({
          conversations: selectedConversations,
          message,
          deleteCount: 0,
          activeReplayIndex: 0,
        }),
      );
    },
    [dispatch, selectedConversations],
  );

  const onRegenerateMessage = useCallback(() => {
    const lastUserMessageIndex = selectedConversations[0].messages
      .map((msg) => msg.role)
      .lastIndexOf(Role.User);
    dispatch(
      ConversationsActions.sendMessages({
        conversations: selectedConversations,
        message: selectedConversations[0].messages[lastUserMessageIndex],
        deleteCount:
          selectedConversations[0].messages.length - lastUserMessageIndex,
        activeReplayIndex: 0,
      }),
    );
  }, [dispatch, selectedConversations]);

  const onEditMessage = useCallback(
    (editedMessage: Message, index: number) => {
      dispatch(ConversationsActions.stopStreamMessage());
      dispatch(
        ConversationsActions.sendMessages({
          conversations: selectedConversations,
          message: editedMessage,
          deleteCount: selectedConversations[0]?.messages.length - index,
          activeReplayIndex: 0,
        }),
      );
    },
    [dispatch, selectedConversations],
  );

  const handleApplyChatSettings = useCallback(() => {
    selectedConversations.forEach((conversation) => {
      const temporarySettings: ConversationsTemporarySettings | undefined =
        selectedConversationsTemporarySettings.current[conversation.id];
      if (temporarySettings) {
        dispatch(
          ConversationsActions.updateConversation({
            id: conversation.id,
            values: { messages: clearStateForMessages(conversation.messages) },
          }),
        );
        if (temporarySettings.modelId) {
          handleSelectModel(conversation, temporarySettings.modelId);
        }
        handleChangePrompt(conversation, temporarySettings.prompt);
        handleChangeTemperature(conversation, temporarySettings.temperature);
        if (temporarySettings.currentAssistentModelId) {
          handleSelectAssistantSubModel(
            conversation,
            temporarySettings.currentAssistentModelId,
          );
        }
        if (temporarySettings.addonsIds) {
          handleOnApplyAddons(conversation, temporarySettings.addonsIds);
        }
      }
    });
  }, [
    selectedConversations,
    dispatch,
    handleChangePrompt,
    handleChangeTemperature,
    handleSelectModel,
    handleSelectAssistantSubModel,
    handleOnApplyAddons,
  ]);

  const handleTemporarySettingsSave = useCallback(
    (conversation: Conversation, args: ConversationsTemporarySettings) => {
      selectedConversationsTemporarySettings.current[conversation.id] = args;
    },
    [],
  );

  const setChatContainerRef = useCallback((ref: HTMLDivElement | null) => {
    chatContainerRef.current = ref;

    if (!ref) {
      return;
    }

    ref.scrollTo({ top: ref.scrollHeight });
  }, []);

  const onChatInputResize = useCallback((inputHeight: number) => {
    setInputHeight(inputHeight);
  }, []);

  return (
    <div
      className="relative min-w-0 shrink grow basis-0 overflow-y-auto"
      data-qa="chat"
      id="chat"
    >
      {modelError ? (
        <ErrorMessageDiv error={modelError} />
      ) : (
        <>
          <div
            className={`flex h-full w-full ${
              isCompareMode ? 'landscape:hidden' : 'hidden'
            }`}
          >
            <ChatCompareRotate />
          </div>
          <div
            className={`relative h-full w-full ${
              isCompareMode ? 'portrait:hidden' : ''
            }`}
          >
            <div className="flex h-full">
              <div
                className={`flex h-full flex-col ${
                  isCompareMode && selectedConversations.length < 2
                    ? 'w-[50%]'
                    : 'w-full'
                }`}
                data-qa={isCompareMode ? 'compare-mode' : 'chat-mode'}
              >
                <div className="flex max-h-full w-full">
                  {selectedConversations.map(
                    (conv) =>
                      conv.messages.length === 0 &&
                      (!conv.playback?.isPlayback ? (
                        <div
                          key={conv.id}
                          className={`flex h-full flex-col justify-between ${
                            selectedConversations.length > 1
                              ? 'w-[50%]'
                              : 'w-full'
                          }`}
                        >
                          <div
                            className="shrink-0"
                            style={{
                              height: `calc(100% - ${inputHeight}px)`,
                            }}
                          >
                            <ChatSettingsEmpty
                              conversation={conv}
                              isModels={models.length !== 0}
                              prompts={prompts}
                              defaultModelId={
                                defaultModelId || OpenAIEntityModelID.GPT_3_5
                              }
                              isShowSettings={enabledFeatures.has(
                                Feature.EmptyChatSettings,
                              )}
                              onSelectModel={(modelId: string) =>
                                handleSelectModel(conv, modelId)
                              }
                              onSelectAssistantSubModel={(modelId: string) =>
                                handleSelectAssistantSubModel(conv, modelId)
                              }
                              onChangeAddon={(addonId: string) =>
                                handleOnChangeAddon(conv, addonId)
                              }
                              onChangePrompt={(prompt) =>
                                handleChangePrompt(conv, prompt)
                              }
                              onChangeTemperature={(temperature) =>
                                handleChangeTemperature(conv, temperature)
                              }
                              appName={appName}
                              onApplyAddons={handleOnApplyAddons}
                            />
                          </div>

                          <div
                            className="shrink-0"
                            style={{ height: inputHeight }}
                          />
                        </div>
                      ) : (
                        <div
                          key={conv.id}
                          className={`flex h-full flex-col justify-between overflow-auto ${
                            selectedConversations.length > 1
                              ? 'w-[50%]'
                              : 'w-full'
                          }`}
                        >
                          <div
                            className="shrink-0"
                            style={{
                              height: `calc(100%-${inputHeight})`,
                            }}
                          >
                            <PlaybackEmptyInfo
                              conversationName={conv.name}
                              appName={appName}
                            />
                          </div>
                        </div>
                      )),
                  )}
                </div>
                <div className="flex w-full">
                  {selectedConversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`${
                        isCompareMode && selectedConversations.length > 1
                          ? 'w-[50%]'
                          : 'w-full'
                      }`}
                    >
                      {conv.messages.length !== 0 &&
                        enabledFeatures.has(Feature.TopSettings) && (
                          <div className="z-10 flex flex-col">
                            <ChatHeader
                              conversation={conv}
                              isCompareMode={isCompareMode}
                              isShowChatInfo={enabledFeatures.has(
                                Feature.TopChatInfo,
                              )}
                              isShowClearConversation={
                                enabledFeatures.has(
                                  Feature.TopClearConversation,
                                ) &&
                                !isPlayback &&
                                !isExternal
                              }
                              isShowModelSelect={
                                enabledFeatures.has(
                                  Feature.TopChatModelSettings,
                                ) &&
                                !isPlayback &&
                                !isExternal
                              }
                              isShowSettings={isShowChatSettings}
                              setShowSettings={(isShow) => {
                                if (isShow) {
                                  dispatch(ModelsActions.getModels());
                                  dispatch(AddonsActions.getAddons());
                                }
                                setIsShowChatSettings(isShow);
                              }}
                              selectedConversationIds={selectedConversationsIds}
                              onClearConversation={() =>
                                handleClearConversation(conv)
                              }
                              onUnselectConversation={(id) => {
                                dispatch(
                                  ConversationsActions.unselectConversations({
                                    conversationIds: [id],
                                  }),
                                );
                              }}
                            />
                          </div>
                        )}
                    </div>
                  ))}
                </div>
                {mergedMessages?.length > 0 && (
                  <div
                    className="flex max-h-full flex-col overflow-x-hidden"
                    ref={setChatContainerRef}
                    onScroll={handleScroll}
                    data-qa="chat-messages"
                  >
                    {mergedMessages.map(
                      (
                        mergedStr: [Conversation, Message, number][],
                        i: number,
                      ) => (
                        <div
                          key={i}
                          className="flex w-full"
                          data-qa={
                            isCompareMode
                              ? 'compare-message-row'
                              : 'message-row'
                          }
                        >
                          {mergedStr.map(
                            ([conv, message, index]: [
                              Conversation,
                              Message,
                              number,
                            ]) => (
                              <div
                                key={conv.id}
                                className={`${
                                  isCompareMode &&
                                  selectedConversations.length > 1
                                    ? 'w-[50%]'
                                    : 'w-full'
                                }`}
                              >
                                <div className="h-full w-full">
                                  <MemoizedChatMessage
                                    key={conv.id}
                                    message={message}
                                    messageIndex={index}
                                    conversation={conv}
                                    isLikesEnabled={enabledFeatures.has(
                                      Feature.Likes,
                                    )}
                                    editDisabled={!!notAllowedType}
                                    onEdit={onEditMessage}
                                    onLike={onLikeHandler(index, conv)}
                                    onDelete={() => {
                                      handleDeleteMessage(index);
                                    }}
                                  />
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      ),
                    )}
                    <div
                      className="shrink-0 "
                      style={{ height: inputHeight + 56 }}
                      ref={messagesEndRef}
                    />
                  </div>
                )}
              </div>
              {isShowChatSettings && (
                <div
                  className={`absolute left-0 top-0 grid h-full w-full ${
                    selectedConversations.length === 1
                      ? 'grid-cols-1'
                      : 'grid-cols-2'
                  }`}
                >
                  {selectedConversations.map((conv) => (
                    <div className="relative h-full" key={conv.id}>
                      <ChatSettings
                        conversation={conv}
                        defaultModelId={
                          defaultModelId || OpenAIEntityModelID.GPT_3_5
                        }
                        modelId={conv.model.id}
                        prompts={prompts}
                        addons={addons}
                        onChangeSettings={(args) => {
                          handleTemporarySettingsSave(conv, args);
                        }}
                        onApplySettings={handleApplyChatSettings}
                        onClose={() => setIsShowChatSettings(false)}
                      />
                    </div>
                  ))}
                </div>
              )}
              {isCompareMode && selectedConversations.length < 2 && (
                <div className="flex h-full w-[50%] flex-col overflow-auto">
                  <ChatCompareSelect
                    conversations={conversations}
                    selectedConversations={selectedConversations}
                    onConversationSelect={(conversation) => {
                      dispatch(
                        ConversationsActions.selectConversations({
                          conversationIds: [
                            selectedConversations[0].id,
                            conversation.id,
                          ],
                        }),
                      );
                    }}
                  />
                  <div
                    className="shrink-0 "
                    style={{ height: inputHeight + 56 }}
                  />
                </div>
              )}
            </div>
            {!isPlayback && notAllowedType ? (
              <NotAllowedModel type={notAllowedType} />
            ) : (
              <>
                {!isPlayback && (
                  <ChatInput
                    textareaRef={textareaRef}
                    isMessagesPresented={isNotEmptyConversations}
                    showScrollDownButton={showScrollDownButton}
                    onSend={onSendMessage}
                    onScrollDownClick={handleScrollDown}
                    onRegenerate={onRegenerateMessage}
                    onStopConversation={() => {
                      dispatch(ConversationsActions.stopStreamMessage());
                    }}
                    onResize={onChatInputResize}
                    isShowInput={
                      (!isReplay || isNotEmptyConversations) && !isExternal
                    }
                  >
                    {showReplayControls && (
                      <ChatReplayControls
                        onClickReplayStart={handleReplayStart}
                        onClickReplayReStart={handleReplayReStart}
                        showReplayStart={!isNotEmptyConversations}
                      />
                    )}
                    {isExternal && <ChatExternalControls />}
                  </ChatInput>
                )}

                {isPlayback && (
                  <PlaybackControls
                    nextMessageBoxRef={nextMessageBoxRef}
                    showScrollDownButton={showScrollDownButton}
                    onScrollDownClick={handleScrollDown}
                    onResize={onChatInputResize}
                  />
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
});
Chat.displayName = 'Chat';
