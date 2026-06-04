import { Out, OutFactory } from "../Out";

export class OutFactoryConsole implements OutFactory {
  getOutForClassName(className: String): Out {
    return new OutConsole();
  }
}

export class OutConsole implements Out {
  info(msg: String) {
    console.log(msg);
  }
}

