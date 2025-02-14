import { ChatBarSelectors, SideBarSelectors } from '../selectors';

import { Chronology } from '@/e2e/src/testData';
import { keys } from '@/e2e/src/ui/keyboard';
import { IconSelectors } from '@/e2e/src/ui/selectors/iconSelectors';
import { Input } from '@/e2e/src/ui/webElements/input';
import { SideBarEntities } from '@/e2e/src/ui/webElements/sideBarEntities';
import { Page } from '@playwright/test';

interface ConversationsChronologyType {
  chronology: string;
  conversations: string[];
}

export class Conversations extends SideBarEntities {
  constructor(page: Page) {
    super(page, ChatBarSelectors.conversations, ChatBarSelectors.conversation);
  }

  getConversationInput(name: string): Input {
    return this.getEntityInput(this.entitySelector, name);
  }

  public chronologyByTitle = (chronology: string) =>
    this.getChildElementBySelector(
      SideBarSelectors.chronology,
    ).getElementLocatorByText(chronology);

  public getConversationByName(name: string, index?: number) {
    return this.getEntityByName(this.entitySelector, name, index);
  }

  public getConversationName(name: string, index?: number) {
    return this.getEntityName(
      this.entitySelector,
      ChatBarSelectors.conversationName,
      name,
      index,
    );
  }

  public getConversationArrowIcon(name: string, index?: number) {
    return this.getEntityArrowIcon(this.entitySelector, name, index);
  }

  public getConversationArrowIconColor(name: string, index?: number) {
    return this.getEntityArrowIconColor(this.entitySelector, name, index);
  }

  public async getConversationsByChronology() {
    await this.waitForState({ state: 'attached' });
    const allConversations = await this.getElementInnerContent();
    const conversationsChronology: ConversationsChronologyType[] = [];
    const chronologyIndexes: number[] = [];

    const allConversationsArray = allConversations.split('\n');
    allConversationsArray.forEach((conv) => {
      const isChronology = Object.values(Chronology).includes(conv);
      if (isChronology) {
        conversationsChronology.push({
          chronology: conv,
          conversations: [],
        });
        chronologyIndexes.push(allConversationsArray.indexOf(conv));
      }
    });

    for (let i = 0; i < chronologyIndexes.length; i++) {
      const chronologyConversations = allConversationsArray.slice(
        chronologyIndexes[i] + 1,
        chronologyIndexes[i + 1],
      );
      chronologyConversations.forEach((conv) =>
        conversationsChronology[i].conversations.push(conv),
      );
    }
    return conversationsChronology;
  }

  public async getTodayConversations() {
    return this.getChronologyConversations(Chronology.today);
  }

  public async getYesterdayConversations() {
    return this.getChronologyConversations(Chronology.yesterday);
  }

  public async getLastWeekConversations() {
    return this.getChronologyConversations(Chronology.lastSevenDays);
  }

  public async getLastMonthConversations() {
    return this.getChronologyConversations(Chronology.lastThirtyDays);
  }

  public async getChronologyConversations(chronology: string) {
    const conversationsChronology = await this.getConversationsByChronology();
    return conversationsChronology.find(
      (chron) => chron.chronology === chronology,
    )!.conversations;
  }

  public async selectConversation(name: string, index?: number) {
    await this.getConversationByName(name, index).click();
  }

  public async openConversationDropdownMenu(name: string, index?: number) {
    await this.openEntityDropdownMenu(this.entitySelector, name, index);
  }

  public async editConversationNameWithTick(name: string, newName: string) {
    await this.editEntityNameWithTick(this.entitySelector, name, newName);
  }

  public async editConversationNameWithEnter(name: string, newName: string) {
    await this.openEditConversationNameMode(name, newName);
    await this.page.keyboard.press(keys.enter);
    await this.getConversationByName(name).waitFor({ state: 'hidden' });
  }

  public async openEditConversationNameMode(name: string, newName: string) {
    return this.openEditEntityNameMode(this.entitySelector, name, newName);
  }

  public async getConversationIcon(name: string, index?: number) {
    return this.getEntityIcon(this.entitySelector, name, index);
  }

  public async isConversationHasPlaybackIcon(name: string, index?: number) {
    const playBackIcon = await this.getConversationByName(name, index).locator(
      IconSelectors.playbackIcon,
    );
    return playBackIcon.isVisible();
  }

  public async getConversationBackgroundColor(name: string, index?: number) {
    return this.getEntityBackgroundColor(this.entitySelector, name, index);
  }
}
