import { SideBarSelectors } from '../selectors';

import { FolderPrompts } from '@/e2e/src/ui/webElements/folderPrompts';
import { Prompts } from '@/e2e/src/ui/webElements/prompts';
import { SideBar } from '@/e2e/src/ui/webElements/sideBar';
import { Page } from '@playwright/test';

export class PromptBar extends SideBar {
  constructor(page: Page) {
    super(page, SideBarSelectors.promptBar);
  }

  private prompts!: Prompts;
  private folderPrompts!: FolderPrompts;

  getFolderPrompts(): FolderPrompts {
    if (!this.folderPrompts) {
      this.folderPrompts = new FolderPrompts(this.page);
    }
    return this.folderPrompts;
  }

  getPrompts(): Prompts {
    if (!this.prompts) {
      this.prompts = new Prompts(this.page);
    }
    return this.prompts;
  }

  public async createNewPrompt() {
    await this.newEntityButton.waitForState();
    await this.newEntityButton.click();
  }

  public async dragAndDropPromptFromFolder(
    folderName: string,
    promptName: string,
  ) {
    const folderPrompt = await this.getFolderPrompts().getFolderEntity(
      folderName,
      promptName,
    );
    await this.dragAndDropEntityFromFolder(folderPrompt);
  }

  public async drugPromptToFolder(folderName: string, promptName: string) {
    const folder = this.getFolderPrompts().getFolderByName(folderName);
    const prompt = this.getPrompts().getPromptByName(promptName);
    await this.dragEntityToFolder(prompt, folder);
  }

  public async drugAndDropPromptToFolderPrompt(
    folderName: string,
    folderPromptName: string,
    promptName: string,
  ) {
    const folderPrompt = this.getFolderPrompts().getFolderEntity(
      folderName,
      folderPromptName,
    );
    const prompt = this.getPrompts().getPromptByName(promptName);
    await this.dragAndDropEntityToFolder(prompt, folderPrompt);
  }
}
