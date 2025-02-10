import React, { useContext } from 'react'
import "./App.css"
import va from "./assets/pheoni.gif"
import { TiMicrophone } from "react-icons/ti";
import { datacontext } from './context/UserContext';
import speakimg from './assets/speak.gif'
import speakingimg from './assets/aiVoice.gif'



function App() {
  // let {speak}=useContext(datacontext)
  // speak("Hello Arun, How can I help you today?")
  let {recog,speaking,setSpeaking,recogtext,response,setrecogtext,setresponse}=useContext(datacontext)
  return (
    <div className='main'>
      <img src={va} alt='' id='pheoni'/>
      <span>
        Hi, I'm Pheoni. How can I Help You?
      </span>
      {!speaking?
      <button onClick={()=>{
        setrecogtext("listening...")
        setSpeaking(true)
        setresponse(false)
        recog.start()
        }}>Click Here<TiMicrophone /></button>
        :
        <div className='response'>
          {!response?<img src={speakimg} alt='' id='speakimg' />:<img src={speakingimg} alt='' id='aigif' />}
          
          <p>{recogtext}</p>
        </div>
        }
      
        
    </div>
  )
}

export default App