import { Conversation } from '@/src/types/chat';
import { OpenAIEntityModel } from '@/src/types/openai';

import test from '@/e2e/src/core/fixtures';
import {
  API,
  ExpectedConstants,
  ExpectedMessages,
  ModelIds,
  Theme,
} from '@/e2e/src/testData';
import { Cursors, Styles } from '@/e2e/src/ui/domData';
import { keys } from '@/e2e/src/ui/keyboard';
import { GeneratorUtil, ModelsUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

const userRequests = ['first request', 'second request', 'third request'];
const requestTerm = 'qwer';
const request = 'write cinderella story';
const expectedResponse = 'The sky is blue.';
const sysPrompt = `Type: "${expectedResponse}" if user types ${requestTerm}`;
let gpt35Model: OpenAIEntityModel;
let gpt4Model: OpenAIEntityModel;

test.beforeAll(async () => {
  gpt35Model = ModelsUtil.getModel(ModelIds.GPT_3_5_TURBO)!;
  gpt4Model = ModelsUtil.getModel(ModelIds.GPT_4)!;
});

test('Regenerate response when answer was received', async ({
  dialHomePage,
  conversationData,
  chat,
  localStorageManager,
  setTestIds,
  chatMessages,
}) => {
  setTestIds('EPMRTC-476');
  let conversation: Conversation;
  const userRequests = [
    'first request',
    'second request',
    'write down 100 adjectives',
  ];
  await test.step('Prepare model conversation', async () => {
    conversation = conversationData.prepareModelConversationBasedOnRequests(
      gpt35Model,
      userRequests,
    );
    await localStorageManager.setConversationHistory(conversation);
    await localStorageManager.setSelectedConversation(conversation);
  });

  await test.step('Regenerate response and verify only last response is regenerating', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    const receivedPartialContent = await chatMessages.getGeneratedChatContent(
      conversation.messages.length,
    );
    await chat.regenerateResponse(false);
    const preservedPartialContent = await chatMessages.getGeneratedChatContent(
      conversation.messages.length,
    );
    expect
      .soft(
        preservedPartialContent.includes(receivedPartialContent),
        ExpectedMessages.onlyLastResponseIsRegenerating,
      )
      .toBeTruthy();
  });
});

test(
  'Regenerate response when answer was not received.\n' +
    'Model: Send action is unavailable if there is an error instead of response',
  async ({
    dialHomePage,
    chat,
    setTestIds,
    chatMessages,
    context,
    sendMessage,
    tooltip,
    localStorageManager,
    page,
  }) => {
    setTestIds('EPMRTC-477', 'EPMRTC-1463');
    await test.step('Set random application theme', async () => {
      const theme = GeneratorUtil.randomArrayElement(Object.keys(Theme));
      await localStorageManager.setSettings(theme);
    });

    await test.step('Send a request in chat and emulate error until response received', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
      await context.setOffline(true);
      await chat.sendRequestWithButton('Type a fairytale', false);
    });
    await test.step('Verify error is displayed as a response, regenerate button is available', async () => {
      const generatedContent = await chatMessages.getLastMessageContent();
      expect
        .soft(generatedContent, ExpectedMessages.errorReceivedOnReplay)
        .toBe(ExpectedConstants.answerError);

      const isGenerateResponseVisible = await chat.regenerate.isVisible();
      expect
        .soft(isGenerateResponseVisible, ExpectedMessages.regenerateIsAvailable)
        .toBeTruthy();
    });

    await test.step('Hover over Send button and verify it is disabled and tooltip is shown', async () => {
      await context.setOffline(false);
      for (let i = 1; i <= 2; i++) {
        if (i === 2) {
          const messagesCountBefore =
            await chatMessages.chatMessages.getElementsCount();
          await sendMessage.messageInput.fillInInput(
            GeneratorUtil.randomString(5),
          );
          await page.keyboard.press(keys.enter);
          const messagesCountAfter =
            await chatMessages.chatMessages.getElementsCount();
          expect
            .soft(
              messagesCountBefore === messagesCountAfter,
              ExpectedMessages.messageCountIsCorrect,
            )
            .toBeTruthy();
        }
        const isSendMessageBtnEnabled =
          await sendMessage.sendMessageButton.isElementEnabled();
        expect
          .soft(
            isSendMessageBtnEnabled,
            ExpectedMessages.sendMessageButtonDisabled,
          )
          .toBeFalsy();

        await sendMessage.sendMessageButton.hoverOver();
        const sendBtnCursor =
          await sendMessage.sendMessageButton.getComputedStyleProperty(
            Styles.cursor,
          );
        expect
          .soft(sendBtnCursor[0], ExpectedMessages.sendButtonCursorIsNotAllowed)
          .toBe(Cursors.notAllowed);

        const tooltipContent = await tooltip.getContent();
        expect
          .soft(tooltipContent, ExpectedMessages.tooltipContentIsValid)
          .toBe(ExpectedConstants.regenerateResponseTooltip);
      }
    });

    await test.step('Type any message, hit Enter key and verify Send button is disabled and tooltip is shown', async () => {
      const isSendMessageBtnEnabled =
        await sendMessage.sendMessageButton.isElementEnabled();
      expect
        .soft(
          isSendMessageBtnEnabled,
          ExpectedMessages.sendMessageButtonDisabled,
        )
        .toBeFalsy();

      await sendMessage.sendMessageButton.hoverOver();
      const sendBtnCursor =
        await sendMessage.sendMessageButton.getComputedStyleProperty(
          Styles.cursor,
        );
      expect
        .soft(sendBtnCursor[0], ExpectedMessages.sendButtonCursorIsNotAllowed)
        .toBe(Cursors.notAllowed);

      const tooltipContent = await tooltip.getContent();
      expect
        .soft(tooltipContent, ExpectedMessages.tooltipContentIsValid)
        .toBe(ExpectedConstants.regenerateResponseTooltip);
    });

    await test.step('Click Regenerate response and validate answer received', async () => {
      await chat.regenerateResponse(false);
      await chatMessages.waitForPartialMessageReceived(2);
      const generatedContent = await chatMessages.getLastMessageContent();
      expect
        .soft(generatedContent, ExpectedMessages.messageContentIsValid)
        .not.toContain(ExpectedConstants.answerError);
    });
  },
);

test(
  'Edit the message in the middle. Cancel.\n' +
    'Edit the message in the middle. Save & Submit.\n' +
    'Edited message can not be empty',
  async ({
    dialHomePage,
    conversationData,
    localStorageManager,
    setTestIds,
    chatMessages,
  }) => {
    setTestIds('EPMRTC-485', 'EPMRTC-486', 'EPMRTC-487');
    const editData = 'updated message';
    let conversation: Conversation;
    const userRequests = ['1+2=', '2+3=', '3+4='];
    await test.step('Prepare conversation with 3 requests', async () => {
      conversation = conversationData.prepareModelConversationBasedOnRequests(
        gpt35Model,
        userRequests,
      );
      await localStorageManager.setConversationHistory(conversation);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await test.step('Edit 2nd request, cancel edit and verify nothing changed', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await chatMessages.openEditMessageMode(userRequests[1]);
      await chatMessages.fillEditData(userRequests[1], editData);
      await chatMessages.cancel.click();

      const isEditTextareaVisible = await chatMessages
        .getChatMessageTextarea(userRequests[1])
        .isVisible();
      expect
        .soft(isEditTextareaVisible, ExpectedMessages.editModeIsClosed)
        .toBeFalsy();

      const isResponseLoading = await chatMessages.isResponseLoading();
      expect
        .soft(isResponseLoading, ExpectedMessages.responseIsNotLoading)
        .toBeFalsy();
    });

    await test.step('Edit 2nd request, clear field and verify Save button is disabled', async () => {
      await chatMessages.openEditMessageMode(userRequests[1]);
      await chatMessages.fillEditData(userRequests[1], '');

      const isSaveButtonDisabled = await chatMessages.isSaveButtonEnabled();
      expect
        .soft(isSaveButtonDisabled, ExpectedMessages.saveIsDisabled)
        .toBeFalsy();
      await chatMessages.cancel.click();
    });

    await test.step('Edit 2nd request, save changes and verify response is received, last request is removed', async () => {
      await chatMessages.openEditMessageMode(userRequests[1]);
      await chatMessages.editMessage(userRequests[1], editData);

      const messagesCount = await chatMessages.chatMessages.getElementsCount();
      expect
        .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
        .toBe((userRequests.length - 1) * 2);

      const isMessageEdited = await chatMessages
        .getChatMessage(editData)
        .isVisible();
      expect
        .soft(isMessageEdited, ExpectedMessages.requestMessageIsEdited)
        .toBeTruthy();

      const lastMessage = await chatMessages.getLastMessageContent();
      expect
        .soft(lastMessage, ExpectedMessages.messageContentIsValid)
        .not.toBe(conversation.messages[3].content);
    });
  },
);

test(
  'Delete the message in the middle. Cancel.\n' +
    'Delete the message in the middle. Remove',
  async ({
    dialHomePage,
    conversationData,
    localStorageManager,
    setTestIds,
    chatMessages,
    confirmationDialog,
  }) => {
    setTestIds('EPMRTC-488', 'EPMRTC-489');
    await test.step('Prepare conversation with 3 requests', async () => {
      const conversation =
        conversationData.prepareModelConversationBasedOnRequests(
          gpt35Model,
          userRequests,
        );
      await localStorageManager.setConversationHistory(conversation);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await test.step('Try to delete 2nd request but cancel deleting', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await chatMessages.openDeleteMessageDialog(userRequests[1]);
      await confirmationDialog.cancelDialog();
      const messagesCount = await chatMessages.chatMessages.getElementsCount();
      expect
        .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
        .toBe(userRequests.length * 2);
    });

    await test.step('Delete 2nd request and verify request is deleted, other requests remain', async () => {
      await chatMessages.openDeleteMessageDialog(userRequests[1]);
      await confirmationDialog.confirm();

      const messagesCount = await chatMessages.chatMessages.getElementsCount();
      expect
        .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
        .toBe((userRequests.length - 1) * 2);

      const isMessageVisible = await chatMessages
        .getChatMessage(userRequests[1])
        .isVisible();
      expect
        .soft(isMessageVisible, ExpectedMessages.messageIsDeleted)
        .toBeFalsy();
    });
  },
);

test('System prompt is applied in Model', async ({
  dialHomePage,
  chat,
  setTestIds,
  chatMessages,
  talkToSelector,
  entitySettings,
}) => {
  setTestIds('EPMRTC-1085');
  await test.step('Set system prompt for model and send request', async () => {
    await dialHomePage.openHomePage({ iconsToBeLoaded: [gpt4Model.iconUrl] });
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await talkToSelector.selectModel(gpt4Model.name);
    await entitySettings.setSystemPrompt(sysPrompt);
    await chat.sendRequestWithButton(requestTerm);
  });

  await test.step('Verify response correspond system prompt', async () => {
    const response = await chatMessages.getLastMessageContent();
    expect
      .soft(response, ExpectedMessages.regenerateIsAvailable)
      .toBe(expectedResponse);
  });
});

test(
  'Stop generating for models like GPT (1 symbol = 1 token).\n' +
    'Model: Send action is unavailable if there is empty response.\n' +
    'Edit the message after the response was stopped',
  async ({
    dialHomePage,
    chat,
    setTestIds,
    chatMessages,
    sendMessage,
    page,
    tooltip,
    localStorageManager,
    apiHelper,
  }) => {
    setTestIds('EPMRTC-478', 'EPMRTC-1480', 'EPMRTC-1309');
    const expectedModelIcon = await apiHelper.getEntityIcon(gpt35Model);

    await test.step('Set random application theme', async () => {
      const theme = GeneratorUtil.randomArrayElement(Object.keys(Theme));
      await localStorageManager.setSettings(theme);
    });

    await test.step('Send request and stop generation immediately', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
      await dialHomePage.throttleAPIResponse(API.chatHost);
      await chat.sendRequestWithButton(request, false);
      await chat.stopGenerating.click();
    });

    await test.step('Verify no content received and model icon is visible', async () => {
      await dialHomePage.unRouteResponse(API.chatHost);
      const receivedContent = await chatMessages.getLastMessageContent();
      expect
        .soft(receivedContent, ExpectedMessages.messageContentIsValid)
        .toBe('');

      const conversationIcon = await chatMessages.getIconAttributesForMessage();
      expect
        .soft(conversationIcon, ExpectedMessages.entityIconIsValid)
        .toBe(expectedModelIcon);

      const isRegenerateButtonVisible = await chat.regenerate.isVisible();
      expect
        .soft(isRegenerateButtonVisible, ExpectedMessages.regenerateIsAvailable)
        .toBeTruthy();
    });

    await test.step('Hover over Send button and verify it is disabled and tooltip is shown', async () => {
      for (let i = 1; i <= 2; i++) {
        if (i === 2) {
          const messagesCountBefore =
            await chatMessages.chatMessages.getElementsCount();
          await sendMessage.messageInput.fillInInput('   ');
          await page.keyboard.press(keys.enter);
          const messagesCountAfter =
            await chatMessages.chatMessages.getElementsCount();
          expect
            .soft(
              messagesCountBefore === messagesCountAfter,
              ExpectedMessages.messageCountIsCorrect,
            )
            .toBeTruthy();
        }
        const isSendMessageBtnEnabled =
          await sendMessage.sendMessageButton.isElementEnabled();
        expect
          .soft(
            isSendMessageBtnEnabled,
            ExpectedMessages.sendMessageButtonDisabled,
          )
          .toBeFalsy();

        await sendMessage.sendMessageButton.hoverOver();
        const sendBtnCursor =
          await sendMessage.sendMessageButton.getComputedStyleProperty(
            Styles.cursor,
          );
        expect
          .soft(sendBtnCursor[0], ExpectedMessages.sendButtonCursorIsNotAllowed)
          .toBe(Cursors.notAllowed);

        const tooltipContent = await tooltip.getContent();
        expect
          .soft(tooltipContent, ExpectedMessages.tooltipContentIsValid)
          .toBe(ExpectedConstants.regenerateResponseTooltip);
      }
    });

    await test.step('Send request and stop generation when partial content received', async () => {
      await chat.regenerateResponse(false);
      await chatMessages.waitForPartialMessageReceived(2);
      await chat.stopGenerating.click();
    });

    await test.step('Verify partial content is preserved and model icon is visible', async () => {
      const generatedContent = await chatMessages.getLastMessageContent();
      expect
        .soft(generatedContent, ExpectedMessages.messageContentIsValid)
        .not.toBe('');
      const conversationIcon = await chatMessages.getIconAttributesForMessage();
      expect
        .soft(conversationIcon, ExpectedMessages.entityIconIsValid)
        .toBe(expectedModelIcon);

      const isRegenerateButtonVisible = await chat.regenerate.isVisible();
      expect
        .soft(isRegenerateButtonVisible, ExpectedMessages.regenerateIsAvailable)
        .toBeTruthy();
    });

    await test.step('Edit request, click "Save & Submit" and verify response is regenerated', async () => {
      const updatedRequest = '1+2=';
      await chatMessages.openEditMessageMode(request);
      await chatMessages.editMessage(request, updatedRequest);
      const messagesCount = await chatMessages.chatMessages.getElementsCount();
      expect
        .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
        .toBe(2);
    });
  },
);

test(
  'Send button in new message is available for Model if previous response is partly received when Stop generating was used.\n' +
    'Compare mode button is not available while response is being generated',
  async ({
    dialHomePage,
    chat,
    setTestIds,
    chatMessages,
    sendMessage,
    chatBar,
  }) => {
    setTestIds('EPMRTC-1533', 'EPMRTC-538');
    await test.step('Send request, verify Compare button is disabled while generating the response and stop generation immediately', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
      await dialHomePage.throttleAPIResponse(API.chatHost, 1500);
      await chat.sendRequestWithButton(request, false);

      const isCompareButtonEnabled =
        await chatBar.compareButton.isElementEnabled();
      expect
        .soft(isCompareButtonEnabled, ExpectedMessages.compareButtonIsDisabled)
        .toBeFalsy();

      await chatMessages.waitForPartialMessageReceived(2);
      await chat.stopGenerating.click();
      await chat.stopGenerating.waitForState({ state: 'hidden' });
    });

    await test.step('Type a new message and verify Send button is enabled', async () => {
      await sendMessage.messageInput.fillInInput(
        GeneratorUtil.randomString(10),
      );
      const isSendButtonEnabled =
        await sendMessage.sendMessageButton.isElementEnabled();
      expect
        .soft(isSendButtonEnabled, ExpectedMessages.sendMessageButtonEnabled)
        .toBeTruthy();
    });
  },
);
