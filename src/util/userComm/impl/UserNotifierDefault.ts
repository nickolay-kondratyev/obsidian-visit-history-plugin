import { UserNotifier } from "../UserNotifier";
import { MarkdownView, Notice, Plugin } from "obsidian";

export class UserNotifierDefault implements UserNotifier {
  constructor(private readonly plugin: Plugin) {

  }

  showError(msg: string) {
    console.error(msg);
    new Notice(msg);
  }

  showInfo(msg: string) {
    console.log(msg);

    new Notice(msg);
  }
}