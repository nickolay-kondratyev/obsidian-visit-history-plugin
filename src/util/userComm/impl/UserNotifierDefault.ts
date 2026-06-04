import { UserNotifier } from "../UserNotifier";
import { MarkdownView, Notice, Plugin } from "obsidian";

export class UserNotifierDefault implements UserNotifier {
  constructor(private readonly plugin: Plugin) {

  }

  showError(msg: string) {
    new Notice(msg);
  }

  showInfo(msg: string) {
    new Notice(msg);
  }
}