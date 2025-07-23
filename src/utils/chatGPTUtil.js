import axios from "axios";

const CHATGPT_END_POINT = "http://localhost:3001/api/v1/workspace/my-workspace/chat";
const CHATGPT_MODEL = "my-workspace";

// Send a message to AnythingLLM and return the assistant's reply
export const postChatGPTMessage = async (
  message,
  conversationHistory,
  setConversationHistory,
  openAIKey,
  model = CHATGPT_MODEL,
  apiUrl = CHATGPT_END_POINT
) => {
  // Request headers - using Authorization header with the API key
  const config = {
    headers: {
      "Authorization": `Bearer ${openAIKey}`,
      "Content-Type": "application/json"
    },
  };

  // Format message for AnythingLLM v1 API
  const chatData = {
    message: message,
    chatId: "extension-" + Date.now()
  };

  try {
    console.log(`key: ${openAIKey}`);
    console.log(`endpoint: ${apiUrl}`);

    // Call AnythingLLM v1 API
    const response = await axios.post(apiUrl, chatData, config);
    console.log("Full response:", response.data);

    // Extract the text response from the v1 API format
    const responseText = response.data.textResponse || "No response from AnythingLLM";
    console.log("assistant reply:", responseText);

    // Create assistant message object for the conversation history
    const assistantMessage = { role: "assistant", content: responseText };
    
    // Update history with user message and assistant response
    setConversationHistory([
      ...conversationHistory,
      { role: "user", content: message },
      assistantMessage
    ]);

    return responseText;
  } catch (error) {
    console.error("Error calling AnythingLLM:", error);
    
    // More detailed error logging
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    }
    
    return `Error: ${error.response?.data?.error || error.message}`;
  }
};
