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
    ChatMessage,
    SubscribeRequest,
    SubscribeResponse,
    SubscribeTokenObject,
} from "./types";

let SYSTEM_PUBLIC_KEY = process.env.SYSTEM_PUBLIC_KEY;
if (!SYSTEM_PUBLIC_KEY) {
  throw new Error("Missing SYSTEM_PUBLIC_KEY");
}
let SYSTEM_PRIVATE_KEY = process.env.SYSTEM_PRIVATE_KEY;
if (!SYSTEM_PRIVATE_KEY) {
  throw new Error("Missing SYSTEM_PRIVATE_KEY");
}
if (SYSTEM_PUBLIC_KEY === 'test') {
  SYSTEM_PUBLIC_KEY = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqrzGJDnEnpf0Za7CMR7YNY9RbOWAvSeEhjLGpV64IRGWeGWBZp4XAwwUe5tzJxmjxIDPRf/ghR4BRn6xjTrjMemGu7jmrI/G2C/8vawZjkrBc/xR+KnzGGRhxBrcY40xPfHYVz5f0Uz25b+s643SIaWTTqZaZTEu8rEuHnqI5YLKvHyeS/KS40NeEUDDmgdPKfsTidd312vVkCi0R9QvZZi7FdfC/NGUxJDhj5LnCfbtcDMZrNSFn5j1hS4ive94qUa+p/RlaL/mhY2G0IkzbigwfWuOeiG7664owjQGOn4fzxnr9Q9eJzhGtLP4mHh0vAR9xnkcDZFx1qOjQIWr/QIDAQAB';
}
if (SYSTEM_PRIVATE_KEY === 'test') {
  SYSTEM_PRIVATE_KEY = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCqvMYkOcSel/RlrsIxHtg1j1Fs5YC9J4SGMsalXrghEZZ4ZYFmnhcDDBR7m3MnGaPEgM9F/+CFHgFGfrGNOuMx6Ya7uOasj8bYL/y9rBmOSsFz/FH4qfMYZGHEGtxjjTE98dhXPl/RTPblv6zrjdIhpZNOplplMS7ysS4eeojlgsq8fJ5L8pLjQ14RQMOaB08p+xOJ13fXa9WQKLRH1C9lmLsV18L80ZTEkOGPkucJ9u1wMxms1IWfmPWFLiK973ipRr6n9GVov+aFjYbQiTNuKDB9a456IbvrrijCNAY6fh/PGev1D14nOEa0s/iYeHS8BH3GeRwNkXHWo6NAhav9AgMBAAECggEAEQT18rjSyYUChuZM6OzsXCkX/UptXa2kRLpSrzu0urslltp2HolmEtbamIMOOgNmHe7senZUu6rvhpxCIlQQlLJKIh6pg+G7I7ljhhwIhModOZdugQ1JNGZr5nVPqxlxI1MfH9HnEZaMn/9OLew6WkHxNVcDeMXWf7kQt1dl8QwW0FWErVPwdY/+wlTGIcuzOFgjZI6E4opQd05ZmAV1urvBWIOJzLajf5TY1geY83Fm7bhtMVMs3AknAb5Q0rhMxX0zlZsUYcaM8zRjbP+BejTJXdq8wm5D3xbO0HTisTN3ljGGMYRn/yDRbqSF2CyK+LHpbY3+F+v6Ps793QmJswKBgQDrKXZ4fqcwyl51EqdlkPf5Dedf3wAm0lMMTy8Xbn/odMN8GsY4VFE9WItNsr0PsyLEMBnauQlOHxRPGYsibd+6nGODYhsARXtkBkQctkd3TQS+8xI8xGGRxmoyH0kNc3JmszA/Kum0NWwU4WsxsJtt0BZDDkK/ekPYPx1KuMqAWwKBgQC53d7gKq2jmQKgjTy+mgfy9Ykv7weDCGglO7fa1zy1pgoPXWsmNoDRBcvdidWCQ2k2cekaGbf4C0O/ritp+L+vMZz13iRLWiGwqYRJjlLn+JU9H2reztyfNVniuB3WN8/wZtOrZ0Z2aaabEAuEAaBi8TMA8llRHd1Ke32RWzS0hwKBgQDmMEz2P8u6d60kXiEby17gHJsKfkgwuBpw5yXKgvCTg5BC8BZt1yM6sGyTns1wC8KRViBIuG2CWevQTcmi5vhkO2cxmRujFWBmFbggftDP18U4gMiuUPDM9/LFo1gn4YTvQKGOg5wGOXDVs53xItXSFSlldBUkRzMX/xfWJ7KZFwKBgDCJSdxMCNAB8veuKkCzxIOjrtF/n/yNw3SFpbtWHZpp45KjmImADh+HXfdaOREtPVpkYLTaJnp1ppl1iAzCUnwTfqOOAPhUbxvNCKiUq/27om01uRi5+E7zBaf44IHCTWC/2WKXM4VUjZdMl1U/f3yW8/S5VK2kGNeMa/v7T0YdAoGACnvU7PEhz2OnLwiwFW5WZ5uJEfRlZaJ0C8rATT49u5FIi8zy7Xsa8VDIsZD9qWaD8ehlkFfYtXm4Uzdm/zdhc5mSpcHUgdaanA/O3kAwdeXBjDxd+W0YsfxEmtq/nlEKSIhmODLGEQPsHmbfjUp22/FNcCW34dI43ldaaIK6YOk=';
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
  const m: ChatMessage = {
    type: "message",
    channel,
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
