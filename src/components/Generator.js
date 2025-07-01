/* global chrome */ 
import React, { useState, useEffect } from 'react';
import { VscGear } from "react-icons/vsc";
import { ROUTES } from '../utils/routes';
import { loadData, saveData } from '../utils/localStorage';
import { postChatGPTMessage } from '../utils/chatGPTUtil';
import { scanWithInternetSecure, formatSecurityScanForLLM } from '../utils/internetSecureScanner';
import * as prompts from '../utils/prompts';
import { Button } from './ui/button';
import { Send, MessageCircle, ShieldAlert, Info } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
var format = require("string-template");

function Generator({ setPage, openAIKey, model, apiUrl }) {
  // State for analysis and chat content
  const [analysisContent, setAnalysisContent] = useState("");
  const [chatContent, setChatContent] = useState("");
  const [activeTab, setActiveTab] = useState("analysis");
  
  // Other state variables
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generalChatMessages, setGeneralChatMessages] = useState([]);
  const [generalQuestion, setGeneralQuestion] = useState('');
  const [isGeneralSending, setIsGeneralSending] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  
  // New state for the context toggle
  const [includeAnalysisContext, setIncludeAnalysisContext] = useState(false);
  const [showContextTooltip, setShowContextTooltip] = useState(false);

  // Load previously saved analysis content when component mounts
  useEffect(() => {
    const loadSavedAnalysis = async () => {
      try {
        const savedAnalysis = await loadData('savedAnalysisContent');
        if (savedAnalysis) {
          setAnalysisContent(savedAnalysis);
          setHasAnalyzed(true);
        }
      } catch (error) {
        console.error("Error loading saved analysis:", error);
      }
    };
    
    loadSavedAnalysis();
  }, []);

  /** 
   * Helper method to call the LLM.
   * - promptTemplate: the raw text prompt (with placeholders)
   * - inputFields: an object of { placeholderName: actualValue }
   * - convHistory: if you're storing multi-turn conversation, pass it here.
   */
  async function executeCommand(promptTemplate, inputFields, convHistory = []) {
    const message = format(promptTemplate, inputFields);
    console.log("Formatted message:\n", message);
    // postChatGPTMessage should return the AI's response as a string
    const response = await postChatGPTMessage(
      message,
      convHistory,
      setConversationHistory,
      openAIKey,
      model,
      apiUrl
    );
    return response;
  }

  // -- Below are helper functions to convert objects/arrays into readable text for the LLM --
  function stringifyForms(forms) {
    if (!forms) return "No forms found.";
    return forms.map((form, i) => {
      const fieldDetails = form.fields.map((f, idx) => 
        ` Field #${idx + 1}: name="${f.name}", type="${f.type}", value="${f.value}"`
      ).join("\n");
      return `Form #${i + 1}: Action: ${form.action} Method: ${form.method} Fields: ${fieldDetails}`;
    }).join("\n\n----------------\n\n");
  }

  function stringifyInputs(inputs) {
    if (!inputs) return "No separate inputs found.";
    return inputs.map((inp, i) => 
      `Input #${i + 1}: name="${inp.name}", type="${inp.type}", value="${inp.value}"`
    ).join("\n");
  }

  function stringifyScripts(scripts) {
    if (!scripts) return "No scripts found.";
    return scripts.map((scr, i) => {
      return `Script #${i + 1}: Source: ${scr.src} Snippet (first ~500 chars): ${scr.content}`;
    }).join("\n\n----------------\n\n");
  }

  function stringifyJSElements(jsElements) {
    if (!jsElements) return "No suspicious JS patterns found.";
    return jsElements.map((jsEl, i) => {
      return `JS Element #${i + 1}: Snippet: ${jsEl.snippet} Patterns: ${jsEl.patterns.join(", ")}`;
    }).join("\n\n----------------\n\n");
  }

  function stringifyMetaTags(metaTags) {
    if (!metaTags) return "No meta tags found.";
    return metaTags.map((tag, i) => 
      `Meta Tag #${i + 1}: name="${tag.name}", content="${tag.content}"`
    ).join("\n");
  }

  function stringifyComments(comments) {
    if (!comments || comments.length === 0) return "No HTML comments found.";
    return comments.join("\n----\n");
  }

  // Function to stringify headers for the LLM
  function stringifyHeaders(headers) {
    if (!headers || Object.keys(headers).length === 0) return "No security headers found.";
    return Object.entries(headers)
      .map(([name, value]) => `${name}: ${value}`)
      .join("\n");
  }

  // New function to stringify FTP directory findings
  function stringifyFtpDirectories(ftpDirs) {
    if (!ftpDirs || ftpDirs.length === 0) return "No FTP directories or sensitive file paths detected.";
    
    return ftpDirs.map((dir, i) => {
      let result = `Directory #${i + 1}: ${dir.path}\n`;
      result += `  Accessible: ${dir.accessible ? 'Yes' : 'No'}\n`;
      result += `  Directory Listing Enabled: ${dir.directoryListingEnabled ? 'Yes' : 'No'}\n`;
      result += `  Response Code: ${dir.responseCode}\n`;
      result += `  Contains Sensitive Content: ${dir.hasSensitiveContent ? 'Yes' : 'No'}\n`;
      
      if (dir.contentSnippet) {
        result += `  Content Snippet: ${dir.contentSnippet.substring(0, 100)}...\n`;
      }
      
      if (dir.files && dir.files.length > 0) {
        result += `  Files:\n`;
        dir.files.forEach(file => {
          result += `    - ${file.name} (${file.path})\n`;
        });
      }
      
      return result;
    }).join("\n\n");
  }

  // Function to stringify mixed content data
  function stringifyMixedContent(mixedContent) {
    if (!mixedContent || mixedContent.length === 0) return "No mixed content detected.";
    
    return mixedContent.map((item, i) => {
      return `Mixed Content #${i + 1}: Type: ${item.type}\nURL: ${item.url}\nElement: ${item.element}`;
    }).join("\n\n----------------\n\n");
  }

  /**
   * Handler for the comprehensive security analysis
   */
  const handleComprehensiveAnalysis = async () => {
    setIsLoading(true);
    setHasAnalyzed(false);
    
    // Update the analysis content state
    setAnalysisContent("Initializing comprehensive security analysis...");
    
    try {
      // Load data from chrome.storage
      const webUrl = await loadData('webUrl');
      const webPageInfo = await loadData('webPageInfo');
      
      if (!webPageInfo) {
        alert("No webPageInfo found. Make sure you've navigated to a site and it's loaded.");
        setIsLoading(false);
        setAnalysisContent("Error: No website data found. Please navigate to a website first.");
        return;
      }
      
      // Try to refresh headers if needed
      if (isChromeExtension() && (!webPageInfo.headers || Object.keys(webPageInfo.headers).length === 0)) {
        try {
          setAnalysisContent("Trying to refresh headers...");
          await refreshHeaders(webPageInfo.webUrl);
        } catch (error) {
          console.error("Failed to refresh headers:", error);
        }
      }
      
      // Convert arrays to human-readable text for the LLM
      const formsText = stringifyForms(webPageInfo.forms);
      const inputsText = stringifyInputs(webPageInfo.inputs);
      const scriptsText = stringifyScripts(webPageInfo.scripts);
      const jsElementsText = stringifyJSElements(webPageInfo.jsElements);
      const metaTagsText = stringifyMetaTags(webPageInfo.metaTags);
      const commentsText = stringifyComments(webPageInfo.comments);
      const headersText = stringifyHeaders(webPageInfo.headers);
      const ftpDirectoriesText = stringifyFtpDirectories(webPageInfo.ftpDirectories);
      const mixedContentText = stringifyMixedContent(webPageInfo.mixedContent);

      // Run security scan
      let securityScanText = "No security scan performed.";
      try {
        // Get current URL from web page info
        const url = webPageInfo.webUrl || webUrl;
        if (!url) {
          setAnalysisContent("Error: No URL available to scan.");
          setIsLoading(false);
          return;
        }
        
        setAnalysisContent("Running security scan...");
        
        // Run security scan
        const scanResults = await scanWithInternetSecure(url);
        securityScanText = formatSecurityScanForLLM(scanResults);
      } catch (error) {
        console.error("Error in security scan:", error);
        securityScanText = "Error running security scan: " + error.message;
      }

      // Common fields for comprehensive analysis
      const analysisFields = {
        webUrl: webPageInfo.webUrl || webUrl || "N/A",
        forms: formsText,
        inputs: inputsText,
        cookies: webPageInfo.cookies || "No cookies found.",
        scripts: scriptsText,
        jsElements: jsElementsText,
        metaTags: metaTagsText,
        comments: commentsText,
        headers: headersText,
        ftpDirectories: ftpDirectoriesText,
        mixedContent: mixedContentText,
        securityScan: securityScanText,
      };

      setAnalysisContent("Performing comprehensive security analysis across OWASP Top Ten security categories...");
      
      // Execute the comprehensive analysis prompt
      const response = await executeCommand(prompts.COMPREHENSIVE_SECURITY_ANALYSIS, analysisFields, []);
      
      setAnalysisContent(response);
      setHasAnalyzed(true);
      
      // Save the analysis content to storage
      saveData('savedAnalysisContent', response);
      saveData('analysisWebUrl', webPageInfo.webUrl || webUrl || "N/A");
      
    } catch (error) {
      console.error(error);
      setAnalysisContent("Error: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendGeneralQuestion = async () => {
    if (!generalQuestion.trim() || isGeneralSending) {
      return;
    }

    setIsGeneralSending(true);
    const newQuestion = generalQuestion;
    setGeneralQuestion('');
    
    // Format the question for display in the chat area
    const formattedQuestion = `## Your Question\n${newQuestion}\n\n`;
    setChatContent(formattedQuestion + "Thinking...");
    
    try {
      // Add system message for security context with improved prompt
      const securitySystemPrompt = `You are a web security expert assistant specializing in OWASP Top 10 vulnerabilities and web application security. 

If the user asks about web security topics:
- Provide detailed, accurate information about vulnerabilities, best practices, and defensive measures
- Explain security concepts clearly with practical examples
- Recommend specific solutions for security issues
- Help users understand both attack vectors and protection strategies

If the user asks about non-security topics:
- Briefly acknowledge their question
- Politely explain that you specialize in web security
- Steer the conversation back to security by suggesting a related security topic
- For example: "While I can't help much with general web development, I can discuss the security implications of that technology..."

Format your response with clear structure:
- Use headings (## and ###) for main sections
- Number sequential steps or recommendations (1., 2., etc.)
- Use bullet points for lists of related items
- Include code examples in code blocks when relevant
- Bold important terms or warnings`;
      
      // Check if we should include analysis context
      let fullPrompt;
      
      if (includeAnalysisContext && hasAnalyzed && analysisContent) {
        // Include the analysis results as context with improved instructions
        const analysisWebUrl = await loadData('analysisWebUrl') || "unknown website";
        fullPrompt = `${securitySystemPrompt}\n\n
WEBSITE SECURITY ANALYSIS CONTEXT:
The following is a security analysis of ${analysisWebUrl} that was previously performed.

${analysisContent}

IMPORTANT INSTRUCTION: The user is asking specifically about this security analysis. 
Provide a detailed, specific response that directly addresses their question about the analysis.
If their question is vague, focus on the most critical security findings and actionable recommendations.
Be specific to the website's actual issues rather than giving generic advice.

USER QUESTION: ${newQuestion}`;
      } else {
        // Regular question without analysis context
        fullPrompt = `${securitySystemPrompt}\n\nUser question: ${newQuestion}`;
      }
      
      // Use your existing chat function
      const response = await postChatGPTMessage(
        fullPrompt,
        [],
        () => {},
        openAIKey,
        model,
        apiUrl
      );
      
      if (response) {
        // Add a note about context if it was included
        let contextNote = "";
        if (includeAnalysisContext && hasAnalyzed) {
          contextNote = "*Response includes analysis context*\n\n";
        }
        
        // Update text with both question and answer
        setChatContent(formattedQuestion + `## Expert Response\n${contextNote}${response}`);
        
        // Store in chat history but don't display separately
        setGeneralChatMessages(prev => [...prev, 
          { type: 'user', content: newQuestion },
          { type: 'expert', content: response }
        ]);
      } else {
        setChatContent(formattedQuestion + "Failed to get response from the security expert");
      }
    } catch (error) {
      console.error("Chat error:", error);
      setChatContent(formattedQuestion + "Error: " + error.message);
    } finally {
      setIsGeneralSending(false);
    }
  };
  
  // Helper function to check if running in Chrome extension context
  function isChromeExtension() {
    return !!chrome?.runtime?.sendMessage;
  }
  
  // Function to force refresh headers
  async function refreshHeaders(url) {
    if (!url) return;
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "refreshHeaders", url: url },
        function(response) {
          if (response && response.success) {
            console.log("Headers refreshed successfully:", response.headers);
            resolve(response.headers);
          } else {
            console.error("Failed to refresh headers:", response?.error);
            reject(new Error(response?.error || "Unknown error"));
          }
        }
      );
    });
  }

  // Handle key press for chat input
  const handleKeyPress = (e) => {
    // Check if it's Enter without Shift
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendGeneralQuestion();
    }
    // If it's Shift+Enter, let the default behavior happen (add a new line)
  };

  // Helper function to get the content for the current tab
  const getCurrentTabContent = () => {
    return activeTab === "analysis" 
      ? (analysisContent || "Click 'Analyze Website Security' to scan this website for vulnerabilities across OWASP Top Ten security categories.")
      : (chatContent || "Ask any security-related questions in the chat box above.");
  };

  // Toggle the context inclusion
  const handleToggleContext = () => {
    setIncludeAnalysisContext(!includeAnalysisContext);
  };

  // Side panel layout only
  return (
    <div className="h-screen w-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-[#1e4da1] text-white">
        <div className="flex items-center gap-4">
          <img 
            src="websecbot.png" 
            alt="WebSecBot Logo" 
            className="h-16 w-16"
          />
          <div>
            <h2 className="text-xl font-semibold">WebSecBot</h2>
            <p className="text-sm opacity-75">Your Web Development Security Assistant</p>
          </div>
        </div>
        <button
          onClick={() => {
            setPage(ROUTES.PROFILE);
          }}
          className="border p-2 border-solid border-white hover:bg-[#173a7b]"
        >
          <VscGear className="text-white" />
        </button>
      </div>

      <div className="flex flex-col h-[calc(100%-88px)]">
        {/* Tab navigation */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="px-4 pt-4">
            <div className="grid w-full grid-cols-2 h-10 bg-gray-100 p-1 text-gray-500">
              <button 
                className={`inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium ${
                  activeTab === "analysis" 
                    ? "bg-white text-[#1e4da1] shadow-sm" 
                    : "hover:bg-gray-200"
                }`}
                onClick={() => setActiveTab("analysis")}
              >
                Analysis
              </button>
              <button 
                className={`inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium ${
                  activeTab === "security-chat" 
                    ? "bg-white text-[#1e4da1] shadow-sm" 
                    : "hover:bg-gray-200"
                }`}
                onClick={() => setActiveTab("security-chat")}
              >
                Security Chat
              </button>
            </div>
          </div>
          
          {/* Analysis Tab Content */}
          {activeTab === "analysis" && (
            <div className="p-4">
              <div className="mb-4">
                <Button
                  onClick={handleComprehensiveAnalysis}
                  disabled={isLoading}
                  className="w-full bg-[#1e4da1] hover:bg-[#173a7b] text-white py-6 text-lg"
                  size="lg"
                >
                  <ShieldAlert className="h-5 w-5 mr-2" />
                  {isLoading ? "Analyzing..." : hasAnalyzed ? "Run Analysis Again" : "Analyze Website Security"}
                </Button>
                <p className="text-sm text-gray-600 mt-2 text-center">
                  Performs a comprehensive scan across OWASP Top Ten security categories
                </p>
              </div>
            </div>
          )}
          
          {/* Security Chat Tab Content */}
          {activeTab === "security-chat" && (
            <div className="p-4">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <textarea
                    value={generalQuestion}
                    onChange={(e) => setGeneralQuestion(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Ask any security questions... (Shift+Enter for new line, Enter to send)"
                    className="flex-1 px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                  />
                  <Button
                    onClick={handleSendGeneralQuestion}
                    disabled={isGeneralSending || !generalQuestion.trim()}
                    size="icon"
                    className="bg-[#1e4da1] hover:bg-[#173a7b]"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Context toggle switch - with improved active state */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 relative">
                    <div className="relative inline-block w-10 mr-2 align-middle select-none">
                      <input 
                        type="checkbox" 
                        name="toggle" 
                        id="context-toggle"
                        className="sr-only"
                        checked={includeAnalysisContext}
                        onChange={handleToggleContext}
                        disabled={!hasAnalyzed} 
                      />
                      <label 
                        htmlFor="context-toggle"
                        className={`block overflow-hidden h-6 rounded-full cursor-pointer ${
                          !hasAnalyzed ? 'opacity-50 cursor-not-allowed bg-gray-300' : includeAnalysisContext ? 'bg-[#1e4da1]' : 'bg-gray-300'
                        }`}
                      >
                        <span 
                          className={`block h-6 w-6 rounded-full bg-white border-2 transform transition-transform duration-200 ease-in ${
                            includeAnalysisContext ? 'translate-x-4 border-[#1e4da1]' : 'translate-x-0 border-gray-300'
                          } ${!hasAnalyzed ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        ></span>
                      </label>
                    </div>
                    <label 
                      htmlFor="context-toggle" 
                      className={`text-sm ${!hasAnalyzed ? 'text-gray-400' : includeAnalysisContext ? 'text-[#1e4da1] font-medium' : 'text-gray-700'} cursor-pointer`}
                    >
                      Include analysis context
                    </label>
                    <div 
                      className="cursor-help relative"
                      onMouseEnter={() => setShowContextTooltip(true)}
                      onMouseLeave={() => setShowContextTooltip(false)}
                    >
                      <Info className="h-4 w-4 text-gray-500" />
                      {showContextTooltip && (
                        <div className="absolute left-0 bottom-8 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
                          When enabled, your security analysis results will be included as context with each question, allowing the AI to provide more specific answers about the analyzed website.
                        </div>
                      )}
                    </div>
                  </div>
                  {!hasAnalyzed && (
                    <span className="text-xs text-amber-600">
                      Run an analysis first to enable this feature
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-gray-600">
                  Ask any security-related questions, and the AI security expert will provide guidance and recommendations based on best practices.
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Results - with enhanced markdown formatting and code highlighting */}
        <div className="flex-grow p-4 overflow-y-auto">
          <div className="bg-white border border-gray-300 p-4 h-full overflow-y-auto">
            <ReactMarkdown
              className="markdown-content prose prose-blue max-w-none"
              components={{
                code({node, inline, className, children, ...props}) {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={tomorrow}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  )
                },
                // Enhanced list item formatting
                li({node, children, ...props}) {
                  return <li className="li-enhanced" {...props}>{children}</li>;
                },
                // Format paragraphs better
                p({node, children, ...props}) {
                  // Check if this paragraph contains "criticality level" (various formats)
                  const text = String(children);
                  
                  // Check for the exact format "Criticality Level: High/Medium/Low"
                  if (text.includes('Criticality Level: High')) {
                    return <p className="my-3" {...props}>
                      {text.split('Criticality Level:').map((part, i) => 
                        i === 0 ? part : <><span>Criticality Level:</span><span className="confidence-high"> High</span>{part.substring(5)}</>
                      )}
                    </p>;
                  } else if (text.includes('Criticality Level: Medium')) {
                    return <p className="my-3" {...props}>
                      {text.split('Criticality Level:').map((part, i) => 
                        i === 0 ? part : <><span>Criticality Level:</span><span className="confidence-medium"> Medium</span>{part.substring(7)}</>
                      )}
                    </p>;
                  } else if (text.includes('Criticality Level: Low')) {
                    return <p className="my-3" {...props}>
                      {text.split('Criticality Level:').map((part, i) => 
                        i === 0 ? part : <><span>Criticality Level:</span><span className="confidence-low"> Low</span>{part.substring(4)}</>
                      )}
                    </p>;
                  }
                  
                  // The original checks for inline mentions of criticality
                  if (text.includes('High criticality')) {
                    return <p className="my-3" {...props}>
                      {text.split('High criticality').map((part, i) => 
                        i === 0 ? part : <><span className="confidence-high">High criticality</span>{part}</>
                      )}
                    </p>;
                  } else if (text.includes('Medium criticality')) {
                    return <p className="my-3" {...props}>
                      {text.split('Medium criticality').map((part, i) => 
                        i === 0 ? part : <><span className="confidence-medium">Medium criticality</span>{part}</>
                      )}
                    </p>;
                  } else if (text.includes('Low criticality')) {
                    return <p className="my-3" {...props}>
                      {text.split('Low criticality').map((part, i) => 
                        i === 0 ? part : <><span className="confidence-low">Low criticality</span>{part}</>
                      )}
                    </p>;
                  }
                  
                  return <p className="my-3" {...props}>{children}</p>;
                },
                // Format headings
                h1({node, children, ...props}) {
                  return <h1 className="text-xl font-bold text-[#1e4da1] mt-6 mb-3" {...props}>{children}</h1>;
                },
                h2({node, children, ...props}) {
                  // Main title
                  const text = String(children);
                  if (text.includes('Analysis Results') || text.includes('Recommendations') || text.includes('Security Analysis')) {
                    return <h2 className="text-lg font-bold text-[#1e4da1] mt-2 mb-4 border-b-2 border-[#1e4da1] pb-2 text-center" {...props}>{children}</h2>;
                  }
                  return <h2 className="text-lg font-bold text-[#1e4da1] mt-5 mb-3 border-b border-gray-200 pb-2" {...props}>{children}</h2>;
                },
                h3({node, children, ...props}) {
                  return <h3 className="bg-[#f0f6ff] text-[#1e4da1] py-2 px-3 border-l-4 border-[#1e4da1] font-semibold mt-5 mb-3" {...props}>{children}</h3>;
                },
                // Format blockquotes
                blockquote({node, children, ...props}) {
                  return <blockquote className="border-l-4 border-[#1e4da1] pl-4 py-1 bg-gray-50" {...props}>{children}</blockquote>;
                },
                // Special formatting for strong text
                strong({node, children, ...props}) {
                  return <strong className="text-[#1a4789]" {...props}>{children}</strong>;
                },
              }}
            >
              {getCurrentTabContent()}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Generator;