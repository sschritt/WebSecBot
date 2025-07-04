import axios from "axios";

// Define constants
const CHATGPT_END_POINT = "http://localhost:3001/api/v1/openai/chat/completions";
const CHATGPT_MODEL = "WebSecBot";

// Function to send a message to the ChatGPT API and return the response
export const postChatGPTMessage = async (message, conversationHistory, setConversationHistory, openAIKey, model = CHATGPT_MODEL, apiUrl = CHATGPT_END_POINT) => {
    // Set headers for the axios request
    const config = {
      headers: {
        Authorization: `Bearer ${openAIKey}`,
      },
    };
  
    // Create the message object to send to the API
    var messages = conversationHistory;
    const userMessage = { role: "user", content: message };
    messages.push(userMessage);
  
    // Define the data to send in the request body
    const chatGPTData = {
      model: model,
      messages: messages,
    };
  
    try {
      console.log(`my key: ${openAIKey}`)
      console.log(`my endpoint: ${apiUrl}`)
    
      // Send a POST request to the ChatGPT API
      const response = await axios.post(apiUrl, chatGPTData, config);

      // Extract the message content from the API response
      var message = response?.data?.choices[0]?.message;
      console.log("result message: " + message.content);

      //add the resonse message to the histroy
      messages.push(message);
      setConversationHistory(messages);
  
      // Return the message content
      return message.content;
    } catch (error) {
      console.error("Error with ChatGPT API"); // Log error message
      console.error(error);
  
      // Return null if an error occurs
      return null;
    }
  };