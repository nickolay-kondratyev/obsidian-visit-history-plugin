export interface OutFactory {
  getOutForClassName(className: String): Out;
}

export interface Out {
  info(msg: String): void;
}


