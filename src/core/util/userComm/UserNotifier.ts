export interface UserNotifier {
  showError(msg: string): void;

  showInfo(msg: string): void;
}
