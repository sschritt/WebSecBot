import axios from "axios";

const CHATGPT_END_POINT = "http://localhost:3001/api/v1/openai/chat/completions";
const CHATGPT_MODEL     = "my-new-workspace";          //  ← slug: my-new-workspace 

// Send a message to AnythingLLM and return the assistant’s reply
export const postChatGPTMessage = async (
  message,
  conversationHistory,
  setConversationHistory,
  openAIKey,                           // developer key from Settings → API Keys
  model  = CHATGPT_MODEL,
  apiUrl = CHATGPT_END_POINT
) => {
  // Request headers
  const config = {
    headers: {
      Authorization: `Bearer ${openAIKey}`,
    },
  };

  // Build the message array
  const messages = [
    ...conversationHistory,
    { role: "user", content: message },
  ];

  // Payload for the OpenAI-compatible endpoint
  const chatGPTData = { model, messages };

  try {
    console.log(`key: ${openAIKey}`);
    console.log(`endpoint: ${apiUrl}`);

    // Call AnythingLLM
    const response  = await axios.post(apiUrl, chatGPTData, config);
    const assistant = response?.data?.choices?.[0]?.message;
    console.log("assistant reply:", assistant?.content);

    // Update history
    setConversationHistory([...messages, assistant]);

    return assistant?.content ?? null;
  } catch (error) {
    console.error("Error calling AnythingLLM:", error);
    return null;
  }
};
