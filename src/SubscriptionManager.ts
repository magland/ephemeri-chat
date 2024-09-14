import { PubsubMessage } from "./types";

export class Subscription {
  #channels: string[] = [];
  constructor(
    public subscriptionId: string,
    public sendWebsocketMessageToClient: (message: any) => void
  ) {}
  close() {}
  setChannels(channels: string[]) {
    this.#channels = channels;
  }
  get channels() {
    return [...this.#channels];
  }
  async handleWebsocketMessage(message: any) {
    // at this point, we don't expect any messages from the client
  }
}

class Channel {
  #subscriptions: { [subscriptionId: string]: Subscription } = {};
  constructor(public channelName: string) {}
  addSubscription(subscription: Subscription) {
    this.#subscriptions[subscription.subscriptionId] = subscription;
  }
  removeSubscription(subscription: Subscription) {
    if (!this.#subscriptions[subscription.subscriptionId]) {
      return;
    }
    delete this.#subscriptions[subscription.subscriptionId];
  }
  publishMessage(message: PubsubMessage) {
    for (const subscriptionId in this.#subscriptions) {
      this.#subscriptions[subscriptionId].sendWebsocketMessageToClient({
        type: "pubsubMessage",
        channel: this.channelName,
        message,
      });
    }
  }
}

export class SubscriptionManager {
  #subscriptions: { [subscriptionId: string]: Subscription } = {};
  #channels: { [channelName: string]: Channel } = {};
  constructor() {}
  addSubscription(subscription: Subscription) {
    this.#subscriptions[subscription.subscriptionId] = subscription;
    for (const channel of subscription.channels) {
      if (!this.#channels[channel]) {
        this.#channels[channel] = new Channel(channel);
      }
      this.#channels[channel].addSubscription(subscription);
    }
  }
  removeSubscription(subscription: Subscription) {
    if (!this.#subscriptions[subscription.subscriptionId]) {
      return;
    }
    delete this.#subscriptions[subscription.subscriptionId];
    for (const channel of subscription.channels) {
      if (!this.#channels[channel]) {
        continue;
      }
      this.#channels[channel].removeSubscription(subscription);
    }
  }
  publishMessage(channel: string, message: PubsubMessage) {
    if (!this.#channels[channel]) {
      return;
    }
    this.#channels[channel].publishMessage(message);
  }
}
