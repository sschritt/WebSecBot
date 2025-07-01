import React, {useEffect, useState} from 'react';
import Generator from './components/Generator';
import Profile from './components/Profile';
import {ROUTES} from './utils/routes'
import { loadData } from './utils/localStorage';

function App() {
  const [page, setPage] = useState();
  const [openAIKey, setOpenAIKey] = useState("test key");
  const [model, setModel] = useState("test model");
  const [apiUrl, setAPIUrl] = useState("test api url");

  //always runs
  useEffect(() => {
    // need async
      const fetchLocalData = async() => {
      const fetchedOpenAIKey = await loadData("openAIKey");
      setOpenAIKey(fetchedOpenAIKey);
      const fetchedModel = await loadData("model");
      setModel(fetchedModel);
      const fetchedApiUrl = await loadData("apiUrl");
      setAPIUrl(fetchedApiUrl);
    };

    fetchLocalData();
  }, []);

    switch (page) {
      case ROUTES.GENERATOR:
        return (
          <Generator setPage={setPage} openAIKey={openAIKey} model={model} apiUrl={apiUrl}/>
        );

      case ROUTES.PROFILE:
        return (
          <Profile 
            setPage={setPage}
            openAIKey={openAIKey} 
            setOpenAIKey={setOpenAIKey}
            model={model}
            setModel={setModel}
            apiUrl={apiUrl}
            setAPIUrl={setAPIUrl} />
        );

      default:
        return (
          <Generator setPage={setPage} openAIKey={openAIKey} model={model} apiUrl={apiUrl}/>
        );
    }
}

export default App;