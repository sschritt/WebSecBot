import React from 'react'
import { MdArrowBack } from "react-icons/md"
import { ROUTES } from '../utils/routes'
import { saveData } from '../utils/localStorage';

function Profile({ setPage, openAIKey, setOpenAIKey, model, setModel, apiUrl, setAPIUrl }) {
    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const updatedOpenAIKey = formData.get("openAIKey");
        const updatedModel = formData.get("model");
        const updatedApiUrl = formData.get("apiUrl");
        setOpenAIKey(updatedOpenAIKey);
        saveData('openAIKey', updatedOpenAIKey);
        setModel(updatedModel);
        saveData('model', updatedModel);
        setAPIUrl(updatedApiUrl);
        saveData('apiUrl', updatedApiUrl);
    }

  return (
    <div className='flex flex-col h-screen overflow-hidden'>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-[#1e4da1] text-white">
        <div className="flex items-center gap-4">
          <img 
            src="websecbot.png" 
            alt="WebSecBot Logo" 
            className="h-16 w-16"
          />
          <div>
            <h2 className="text-xl font-semibold">WebSecBot Settings</h2>
            <p className="text-sm opacity-75">Configure your API credentials</p>
          </div>
        </div>
        <button 
          onClick={()=>{setPage(ROUTES.GENERATOR)}}
          className="border p-2 border-solid border-white hover:bg-[#173a7b]"
        >
          <MdArrowBack className="text-white h-5 w-5" />
        </button>
      </div>

      {/* Form content */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <form className="space-y-6 max-w-md mx-auto bg-white p-6 shadow-sm border border-gray-200" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor='openAIKey'
              className='block mb-2 text-sm font-medium text-gray-900'
            >
              Your API Key
            </label>
            <input
              id="openAIKey"
              name="openAIKey"
              type='text'
              className='w-full px-4 py-3 bg-gray-50 border border-gray-300 text-gray-900 text-sm focus:ring-blue-500 focus:border-blue-500'
              placeholder='sk-...1234'
              defaultValue={openAIKey}
              required
            />
            <p className="mt-1 text-xs text-gray-500">API key from your language model provider</p>
          </div>
          
          <div>
            <label
              htmlFor='apiUrl'
              className='block mb-2 text-sm font-medium text-gray-900'
            >
              API Endpoint URL
            </label>
            <input
              id="apiUrl"
              name="apiUrl"
              type='text'
              className='w-full px-4 py-3 bg-gray-50 border border-gray-300 text-gray-900 text-sm focus:ring-blue-500 focus:border-blue-500'
              placeholder='https://api.openai.com/v1/chat/completions'
              defaultValue={apiUrl}
              required
            />
            <p className="mt-1 text-xs text-gray-500">The complete URL for your API endpoint</p>
          </div>
          
          <div>
            <label
              htmlFor='model'
              className='block mb-2 text-sm font-medium text-gray-900'
            >
              Model Name
            </label>
            <input
              id="model"
              name="model"
              type='text'
              className='w-full px-4 py-3 bg-gray-50 border border-gray-300 text-gray-900 text-sm focus:ring-blue-500 focus:border-blue-500'
              placeholder='gpt-4'
              defaultValue={model}
              required
            />
            <p className="mt-1 text-xs text-gray-500">Model name as specified by your provider</p>
          </div>
          
          <div className='flex justify-center'>
            <button 
              type='submit'
              className='px-6 py-3 bg-[#1e4da1] hover:bg-[#173a7b] text-white font-medium text-sm transition-colors'
            >
              Save Settings
            </button>
          </div>
        </form>
        
        <div className="mt-8 max-w-md mx-auto bg-blue-50 p-4 border border-blue-200 text-sm">
          <h3 className="font-medium text-blue-800 mb-2">How to set up WebSecBot</h3>
          <ol className="list-decimal pl-5 space-y-2 text-blue-700">
            <li>Enter your API key (from your LLM provider)</li>
            <li>Enter the complete URL endpoint for your API</li>
            <li>Enter the model name as specified by your provider</li>
            <li>Click Save to store your settings</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default Profile