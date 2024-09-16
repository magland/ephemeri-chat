import { useEffect, useReducer, useState } from "react";
import { EphemeriChatClient, generateKeyPair } from "./EphemeriChatClient/EphemeriChatClient";
import { ChatMessage } from "./EphemeriChatClient/types";

type MessagesState = ChatMessage[];

type MessagesAction = {
  type: "add";
  message: ChatMessage;
};

const messagesReducer = (
  state: MessagesState,
  action: MessagesAction,
): MessagesState => {
  switch (action.type) {
    case "add": {
      const mm = state.find(
        (m) => m.systemSignature === action.message.systemSignature,
      );
      if (mm) {
        return state;
      }
      return [...state, action.message].sort(
        (a, b) => a.timestamp - b.timestamp,
      );
    }
    default:
      return state;
  }
};

function App() {
  const [messages, messagesDispatch] = useReducer(messagesReducer, []);
  const [client, setClient] = useState<EphemeriChatClient | null>(null);
  useEffect(() => {
    (async () => {
      const { publicKey, privateKey } = await generateKeyPair();
      const client = new EphemeriChatClient(publicKey, privateKey, {verbose: true});
      client.onMessage((e: ChatMessage) => {
        if (e.type === "message") {
          messagesDispatch({ type: "add", message: e });
        }
      });
      client.subscribeToChannels(["channel1a"]);
      setClient(client);
      await sleep(1000);
      client.publish(
        "channel1a",
        "Hello channel1a from client1 --- " + Math.random(),
      );
    })();
  }, []);
  return (
    <div>
      <h1>Hchat test</h1>
      <p>
        <button
          onClick={() => {
            generateKeyPair().then(({ publicKey, privateKey }) => {
              console.log("publicKey", publicKey);
              console.log("privateKey", privateKey);
            });
          }}
        >
          Generate key pair in developer console
        </button>
      </p>
      <div>
        <h3>Send message</h3>
        <input type="text" placeholder="Message" id="message" name="message" />
        <button
          onClick={() => {
            if (client) {
              const message = (
                document.getElementById("message") as HTMLInputElement
              ).value;
              client.publish("channel1a", message);
            }
          }}
        >
          Send message
        </button>
      </div>
      <div>
        <h3>Messages</h3>
        {messages.map((m, i) => {
          const msg = JSON.parse(m.messageJson);
          return (
            <div key={i}>
              <hr />
              <p>
                Sender: {m.senderPublicKey.slice(10)}; Timestamp: {m.timestamp}
              </p>
              <p>Message: {msg}</p>
              <hr />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const sleep = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export default App;
