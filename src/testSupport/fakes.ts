import { TFile } from 'obsidian';
import { Backlink, LinkUtil } from '../core/util/linkUtil/LinkUtil';
import { UserNotifier } from '../core/util/userComm/UserNotifier';
import { DeviceNameProvider } from '../core/util/env/DeviceNameProvider';
import { makeTFile } from './fileFactory';

export class FakeLinkUtil implements LinkUtil {
  private readonly backlinks: Backlink[] = [];

  addBacklinkFromPath(sourcePath: string): TFile {
    const file = makeTFile({ path: sourcePath });
    this.backlinks.push({ file, path: file.path, title: file.basename });
    return file;
  }

  getBacklinks(_file: TFile): Backlink[] {
    return this.backlinks;
  }
}

export class FakeUserNotifier implements UserNotifier {
  readonly errors: string[] = [];
  readonly infos: string[] = [];

  showError(msg: string): void {
    this.errors.push(msg);
  }

  showInfo(msg: string): void {
    this.infos.push(msg);
  }
}

export class FixedDeviceNameProvider implements DeviceNameProvider {
  constructor(private readonly name: string) {
  }

  getDeviceName(): string {
    return this.name;
  }
}
