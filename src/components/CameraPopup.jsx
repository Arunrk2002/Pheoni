import React, { useRef, useEffect, useContext } from 'react';
import { datacontext } from '../context/UserContext';
import './CameraPopup.css';

function CameraPopup({ stream, onCapture, onClose }) {
  const { modelLoading } = useContext(datacontext);
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const captureImage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg');
    onCapture(imageData);
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="camera-popup" onClick={e => e.stopPropagation()}>
        <video ref={videoRef} autoPlay />
        <div className="camera-controls">
          <button onClick={captureImage} disabled={modelLoading}>
            {modelLoading ? 'Loading Model...' : 'Capture'}
          </button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default CameraPopup;