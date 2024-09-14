/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  InitiatePublishRequest,
  InitiateSubscribeRequest,
  PublishRequest,
  PubsubMessage,
  SubscribeRequest,
  isInitiatePublishResponse,
  isInitiateSubscribeResponse,
  isPublishResponse,
  isPublishTokenObject,
  isPubsubMessage,
  isSubscribeResponse,
  isSubscribeTokenObject,
} from "./types";

// const baseUrl = "http://localhost:8080";
// const websocketUrl = "ws://localhost:8080";

const baseUrl = "https://ephemeri-pubsub-1-a3c7d458bccb.herokuapp.com"
const websocketUrl = "wss://ephemeri-pubsub-1-a3c7d458bccb.herokuapp.com"

export class EphemeriPubsubClient {
  #onMessageHandlers: ((m: PubsubMessage) => void)[] = [];
  #websocketConnection: WebSocket | undefined = undefined;
  constructor(
    public publicKey: string,
    private privateKey: string,
    private o: { verbose?: boolean } = {}
  ) {}
  onMessage(callback: (m: PubsubMessage) => void) {
    this.#onMessageHandlers.push(callback);
  }
  userId() {
    return userIdFromPublicKey(this.publicKey);
  }
  async publish(channel: string, message: object | string) {
    const messageJson = JSON.stringify(message);
    const messageSignature = await signMessage(messageJson, this.privateKey);
    const req: InitiatePublishRequest = {
      type: "initiatePublishRequest",
      senderPublicKey: this.publicKey,
      channel: channel,
      messageSize: messageJson.length,
      messageSignature,
    };
    const resp = await postApiRequest("initiatePublish", req);
    if (!isInitiatePublishResponse(resp)) {
      throw new Error("Invalid response");
    }
    const { publishToken, tokenSignature } = resp;
    const tokenObject = JSON.parse(publishToken);
    if (!isPublishTokenObject(tokenObject)) {
      throw new Error("Invalid publish token");
    }
    const { difficulty, delay } = tokenObject;
    const challengeResponse = await solveChallenge(
      resp.publishToken,
      difficulty,
      delay,
      { verbose: this.o.verbose }
    );
    const req2: PublishRequest = {
      type: "publishRequest",
      publishToken: resp.publishToken,
      tokenSignature,
      messageJson,
      challengeResponse: challengeResponse,
    };
    const resp2 = await postApiRequest("publish", req2);
    if (!isPublishResponse(resp2)) {
      throw new Error("Invalid response");
    }
    if (!resp2.success) {
      throw new Error("Publish failed");
    }
  }
  async subscribeToChannels(channels: string[]) {
    if (this.#websocketConnection) {
      this.#websocketConnection.close();
      this.#websocketConnection = undefined;
    }
    const req: InitiateSubscribeRequest = {
      type: "initiateSubscribeRequest",
      channels: channels,
    };
    const resp = await postApiRequest("initiateSubscribe", req);
    if (!isInitiateSubscribeResponse(resp)) {
      throw new Error("Invalid response");
    }
    const { subscribeToken, tokenSignature } = resp;
    const subscribeTokenObject = JSON.parse(subscribeToken);
    if (!isSubscribeTokenObject(subscribeTokenObject)) {
      throw new Error("Invalid subscribe token");
    }
    const { difficulty, delay } = subscribeTokenObject;
    const challengeResponse = await solveChallenge(
      subscribeToken,
      difficulty,
      delay,
      {
        verbose: this.o.verbose,
      }
    );
    const initialMessage: SubscribeRequest = {
      type: "subscribeRequest",
      channels,
      subscribeToken: subscribeToken,
      tokenSignature: tokenSignature,
      challengeResponse: challengeResponse,
    };
    const onWebsocketMessage = async (wsMessage: any) => {
      try {
        if (typeof wsMessage !== "object") {
          throw new Error("Invalid message, not an object");
        }
        const type0 = wsMessage.type;
        if (type0 !== "pubsubMessage") {
          throw new Error("Invalid message type");
        }
        const channel0 = wsMessage.channel;
        if (!channel0) {
          throw new Error("No channel");
        }
        if (!channels.includes(channel0)) {
          throw new Error("Invalid channel");
        }
        const message = wsMessage.message;
        if (!isPubsubMessage(message)) {
          throw new Error("Not a pubsub message");
        }
        const {
          senderPublicKey,
          timestamp,
          messageJson,
          messageSignature,
          systemSignaturePayload,
          systemSignature,
          systemPublicKey,
        } = message;
        const okay1 = await verifySignature(
          senderPublicKey,
          messageJson,
          messageSignature
        );
        if (!okay1) {
          throw Error("Invalid message signature");
        }
        const okay2 = await verifySignature(
          systemPublicKey,
          systemSignaturePayload,
          systemSignature
        );
        if (!okay2) {
          throw Error("Invalid system signature");
        }
        const systemSignaturePayloadObject = JSON.parse(systemSignaturePayload);
        if (systemSignaturePayloadObject.channel !== channel0) {
          throw Error("Inconsistent channel in system signature payload");
        }
        if (systemSignaturePayloadObject.senderPublicKey !== senderPublicKey) {
          throw Error(
            "Inconsistent senderPublicKey in system signature payload"
          );
        }
        if (systemSignaturePayloadObject.timestamp !== timestamp) {
          throw Error("Inconsistent timestamp in system signature payload");
        }
        if (
          systemSignaturePayloadObject.messageSignature !== messageSignature
        ) {
          throw Error(
            "Inconsistent messageSignature in system signature payload"
          );
        }
        this.#onMessageHandlers.forEach((h) => h(message));
      } catch (e) {
        console.error("Failed to handle message", e);
        this.#websocketConnection?.close();
      }
    };
    this.#websocketConnection = await openWebsocketConnection(
      initialMessage,
      onWebsocketMessage
    );
  }
}

const openWebsocketConnection = async (
  initialMessage: SubscribeRequest,
  onWebsocketMessage: (message: object) => void
) => {
  const ws = new WebSocket(websocketUrl);
  let gotFirstMessage = false;
  const timeoutDuration = 2000;
  return new Promise<WebSocket>((resolve, reject) => {
    ws.onopen = () => {
      ws.send(JSON.stringify(initialMessage));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (!gotFirstMessage) {
        if (!isSubscribeResponse(msg)) {
          reject(new Error("Invalid initial message"));
          ws.close();
          return;
        }
        gotFirstMessage = true;
        resolve(ws);
        return;
      }
      // subsequent messages
      onWebsocketMessage(msg);
    };
    setTimeout(() => {
      if (!gotFirstMessage) {
        reject(new Error("Timeout"));
        ws.close();
      }
    }, timeoutDuration);
  });
};

export const generateKeyPair = async () => {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: { name: "SHA-256" },
    },
    true,
    ["sign", "verify"]
  );

  return {
    publicKey: await publicKeyToBase64(keyPair.publicKey),
    privateKey: await privateKeyToBase64(keyPair.privateKey),
  };
};

export const isValidKeyPair = async (publicKey: string, privateKey: string) => {
  try {
    const message = "Hello, world!";
    const signature = await signMessage(message, privateKey);
    const okay = await verifySignature(publicKey, message, signature);
    return okay;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err: any) {
    return false;
  }
};

const solveChallenge = async (
  prefix: string,
  difficulty: number,
  delay: number,
  o: { verbose?: boolean } = {}
): Promise<string> => {
  if (o.verbose) {
    console.info(`Solving challenge with difficulty ${difficulty}`);
  }
  const overallTimer = Date.now();
  let timer2 = Date.now();
  while (true) {
    const elapsed2 = Date.now() - timer2;
    if (elapsed2 > 100) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      timer2 = Date.now();
    }
    const overallElapsed = Date.now() - overallTimer;
    if (overallElapsed > 50 * 1000) {
      throw new Error("Timeout");
    }
    const challengeResponse = Math.random().toString().slice(2);
    const challengeResponseStringToHash = `${prefix}${challengeResponse}`;
    const challengeResponseSha1Bits = await sha1Bits(
      challengeResponseStringToHash
    );
    if (
      challengeResponseSha1Bits.slice(0, difficulty) === "0".repeat(difficulty)
    ) {
      if (o.verbose) {
        console.info(
          `Challenge with difficulty ${difficulty} solved in ${
            Date.now() - overallTimer
          }ms`
        );
      }
      if (Date.now() - overallTimer < delay) {
        if (o.verbose) {
          console.info(
            `Waiting ${
              delay - (Date.now() - overallTimer)
            }ms for delay ${delay}ms to pass`
          );
        }
        // wait for delay to pass
        while (Date.now() - overallTimer < delay) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }
      return challengeResponse;
    }
  }
};

const postApiRequest = async (endpoint: string, req: any) => {
  const response = await fetch(`${baseUrl}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
};

const sha1 = async (input: string) => {
  const msgUint8 = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-1", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
};

const sha1Bits = async (input: string) => {
  const hash = await sha1(input);
  const bits = BigInt("0x" + hash).toString(2);
  const expectedLength = hash.length * 4;
  return bits.padStart(expectedLength, "0");
};

const privateKeyFromBase64 = async (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const privateKey = await window.crypto.subtle.importKey(
    "pkcs8",
    bytes,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
  return privateKey;
};

const signMessage = async (message: string, privateKey: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  const pk = await privateKeyFromBase64(privateKey);

  const signature = await window.crypto.subtle.sign(
    {
      name: "RSASSA-PKCS1-v1_5",
    },
    pk,
    data
  );

  const signatureBase64 = btoa(
    String.fromCharCode(...new Uint8Array(signature))
  );
  return signatureBase64;
};

const publicKeyFromBase64 = async (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const publicKey = await window.crypto.subtle.importKey(
    "spki",
    bytes,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    true,
    ["verify"]
  );
  return publicKey;
};

const signatureFromBase64 = async (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const verifySignature = async (
  publicKeyBase64: string,
  message: string,
  signatureBase64: string
) => {
  const publicKey = await publicKeyFromBase64(publicKeyBase64);
  const signature = await signatureFromBase64(signatureBase64);
  const data = new TextEncoder().encode(message);
  return window.crypto.subtle.verify(
    {
      name: "RSASSA-PKCS1-v1_5",
    },
    publicKey,
    signature,
    data
  );
};

const publicKeyToBase64 = async (publicKey: CryptoKey) => {
  const exported = await window.crypto.subtle.exportKey(
    "spki", // Export format for public key
    publicKey
  );
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
};

const privateKeyToBase64 = async (privateKey: CryptoKey) => {
  const exported = await window.crypto.subtle.exportKey(
    "pkcs8", // Export format for private key
    privateKey
  );
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
};

export const checksumSync = (input: string) => {
  const a = new TextEncoder().encode(input);
  let hash = 0;
  for (let i = 0; i < a.length; i++) {
    hash = (hash << 5) - hash + a[i];
    hash |= 0;
  }
  return hash.toString(16);
};

export const userIdFromPublicKey = (publicKey: string) => {
  const hash = checksumSync(publicKey);
  return hash.slice(0, 8);
};
