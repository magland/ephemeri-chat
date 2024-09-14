import crypto from "crypto";
import { SubscriptionManager } from "./SubscriptionManager";
import {
    InitiatePublishRequest,
    InitiatePublishResponse,
    InitiateSubscribeRequest,
    InitiateSubscribeResponse,
    isPublishTokenObject,
    isSubscribeTokenObject,
    PublishRequest,
    PublishResponse,
    PublishTokenObject,
    PubsubMessage,
    SubscribeRequest,
    SubscribeResponse,
    SubscribeTokenObject,
} from "./types";

const SYSTEM_PUBLIC_KEY = process.env.SYSTEM_PUBLIC_KEY;
if (!SYSTEM_PUBLIC_KEY) {
  throw new Error("Missing SYSTEM_PUBLIC_KEY");
}
const SYSTEM_PRIVATE_KEY = process.env.SYSTEM_PRIVATE_KEY;
if (!SYSTEM_PRIVATE_KEY) {
  throw new Error("Missing SYSTEM_PRIVATE_KEY");
}

const currentPublishDifficulty = 13;
const currentPublishDelay = 500;
const currentSubscribeDifficulty = 13;
const currentSubscribeDelay = 500;

export const initiatePublishHandler = async (
  request: InitiatePublishRequest
): Promise<InitiatePublishResponse> => {
  assertValidChannel(request.channel);
  assertValidMessageSize(request.messageSize);
  const publishTokenObject: PublishTokenObject = {
    timestamp: Date.now(),
    difficulty: currentPublishDifficulty,
    delay: currentPublishDelay,
    senderPublicKey: request.senderPublicKey,
    channel: request.channel,
    messageSize: request.messageSize,
    messageSignature: request.messageSignature,
  };
  const publishToken = JSON.stringify(publishTokenObject);
  const tokenSignature = await signMessage(publishToken, SYSTEM_PRIVATE_KEY);
  const resp: InitiatePublishResponse = {
    type: "initiatePublishResponse",
    publishToken,
    tokenSignature,
  };
  return resp;
};

export const publishHandler = async (
  request: PublishRequest,
  subscriptionManager: SubscriptionManager
): Promise<PublishResponse> => {
  const { publishToken, tokenSignature, messageJson, challengeResponse } =
    request;
  const tokenSignatureToVerify = await signMessage(
    publishToken,
    SYSTEM_PRIVATE_KEY
  );
  if (tokenSignature !== tokenSignatureToVerify) {
    throw new Error("Invalid token signature");
  }
  const publishTokenObject = JSON.parse(publishToken);
  if (!isPublishTokenObject(publishTokenObject)) {
    throw new Error("Invalid publish token");
  }
  const {
    timestamp,
    difficulty,
    delay,
    channel,
    senderPublicKey,
    messageSize,
    messageSignature,
  } = publishTokenObject;
  const timestampDifference = Math.abs(Date.now() - timestamp);
  if (timestampDifference < delay) {
    throw new Error("Too soon to publish");
  }
  if (timestampDifference > 60 * 1000) {
    throw new Error("Invalid timestamp for publish token");
  }
  if (messageSize !== messageJson.length) {
    throw new Error("Invalid message size");
  }
  if (!verifySignature(senderPublicKey, messageJson, messageSignature)) {
    throw new Error("Invalid message signature");
  }
  const challengeResponseStringToHash = `${publishToken}${challengeResponse}`;
  const challengeResponseSha1Bits = sha1Bits(challengeResponseStringToHash);
  if (
    challengeResponseSha1Bits.slice(0, difficulty) !== "0".repeat(difficulty)
  ) {
    throw new Error("Invalid challenge response");
  }
  const timestamp0 = Date.now();
  const systemSignaturePayload = JSON.stringify({
    channel,
    senderPublicKey,
    timestamp: timestamp0,
    messageSignature,
  });
  const systemSignature = await signMessage(
    systemSignaturePayload,
    SYSTEM_PRIVATE_KEY
  );
  const m: PubsubMessage = {
    type: "message",
    senderPublicKey,
    timestamp: timestamp0,
    messageJson,
    messageSignature,
    systemSignaturePayload,
    systemSignature,
    systemPublicKey: SYSTEM_PUBLIC_KEY,
  };
  subscriptionManager.publishMessage(channel, m);
  const resp: PublishResponse = { type: "publishResponse", success: true };
  return resp;
};

export const initiateSubscribeHandler = async (
  request: InitiateSubscribeRequest
): Promise<InitiateSubscribeResponse> => {
  const { channels } = request;
  if (channels.length > 10) {
    throw new Error("Too many channels");
  }
  for (const channel of channels) {
    assertValidChannel(channel);
  }
  const subscribeTokenObject: SubscribeTokenObject = {
    timestamp: Date.now(),
    difficulty: currentSubscribeDifficulty,
    delay: currentSubscribeDelay,
    channels,
  };
  const subscribeToken = JSON.stringify(subscribeTokenObject);
  const tokenSignature = await signMessage(subscribeToken, SYSTEM_PRIVATE_KEY);
  const resp: InitiateSubscribeResponse = {
    type: "initiateSubscribeResponse",
    subscribeToken,
    tokenSignature,
  };
  return resp;
};

export const subscribeHandler = async (
  request: SubscribeRequest
): Promise<SubscribeResponse> => {
  const { subscribeToken, tokenSignature, challengeResponse, channels } =
    request;
  const tokenSignatureToVerify = await signMessage(
    subscribeToken,
    SYSTEM_PRIVATE_KEY
  );
  if (tokenSignature !== tokenSignatureToVerify) {
    throw new Error("Invalid token signature");
  }
  const subscribeTokenObject = JSON.parse(subscribeToken);
  if (!isSubscribeTokenObject(subscribeTokenObject)) {
    throw new Error("Invalid subscribe token");
  }
  const {
    timestamp,
    difficulty,
    delay,
    channels: channelsInToken,
  } = subscribeTokenObject;
  if (!stringArraysMatch(channels, channelsInToken)) {
    throw new Error("Channels do not match subscribe token");
  }
  const timestampDifference = Math.abs(Date.now() - timestamp);
  if (timestampDifference < delay) {
    throw new Error("Too soon to subscribe");
  }
  if (timestampDifference > 60 * 1000) {
    throw new Error("Invalid timestamp for subscribe token");
  }
  const challengeResponseStringToHash = `${subscribeToken}${challengeResponse}`;
  const challengeResponseSha1Bits = sha1Bits(challengeResponseStringToHash);
  if (
    challengeResponseSha1Bits.slice(0, difficulty) !== "0".repeat(difficulty)
  ) {
    throw new Error("Invalid challenge response");
  }
  const resp: SubscribeResponse = { type: "subscribeResponse" };
  return resp;
};

const assertValidChannel = (channel: string) => {
  // needs to be alphanumeric
  // alphanumeric plus underscore, dash, dot, and colon
  if (!/^[a-zA-Z0-9_\-:.]+$/.test(channel)) {
    throw new Error("Invalid channel");
  }
};

const assertValidMessageSize = (size: number) => {
  if (size < 1 || size > 20000) {
    throw new Error("Invalid message size");
  }
};

const sha1 = (input: string) => {
  const sha1 = crypto.createHash("sha1");
  sha1.update(input);
  return sha1.digest("hex");
};

const sha1Bits = (input: string) => {
  const hash = sha1(input);
  const bits = BigInt("0x" + hash).toString(2);
  const expectedLength = hash.length * 4;
  return bits.padStart(expectedLength, "0");
};

const verifySignature = (
  publicKeyBase64: string,
  message: string,
  signatureBase64: string
) => {
  const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${publicKeyBase64}\n-----END PUBLIC KEY-----\n`;
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(message);
  const signature = Buffer.from(signatureBase64, "base64");
  const isValid = verifier.verify(publicKeyPem, signature);
  return isValid;
};

const signMessage = async (message: string, privateKeyBase64: string) => {
  const pem = `-----BEGIN PRIVATE KEY-----\n${privateKeyBase64}\n-----END PRIVATE KEY-----\n`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(message);
  const signature = signer.sign(pem);
  return signature.toString("base64");
};

const stringArraysMatch = (a: string[], b: string[]) => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};
