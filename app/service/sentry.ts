import * as node from '@sentry/node';

node.init({ dsn: process.env.SENTRY_DSN });

export class Sentry {
  sentry: any;
  constructor() {
    this.sentry = node;
  }

  getSentry() {
    return this.sentry;
  }
}
